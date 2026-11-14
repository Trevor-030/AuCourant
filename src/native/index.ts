/**
 * Typed bridge to the Java modules in native/android/java/com/aucourant/nativebridge.
 *
 * The UI talks only to these functions. When a module is missing (Expo Go, web, or a
 * build made before `expo prebuild`), each call fails with NativeMissingError so the
 * screen can show its normal error state instead of crashing.
 */
import { AppState, NativeModules, PermissionsAndroid, Platform } from 'react-native'
import Constants, { ExecutionEnvironment } from 'expo-constants'

/**
 * True inside Expo Go. Expo Go has none of AuCourant's Java modules and does not declare the
 * SMS permissions, so message access cannot work there: use a development build instead.
 */
export const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient

export class NativeMissingError extends Error {
  constructor(name: string) {
    super(`${name} is not available. Build the app with "npx expo run:android".`)
    this.name = 'NativeMissingError'
  }
}

function mod<T>(name: string): T {
  const m = NativeModules[name] as T | undefined
  if (!m) throw new NativeMissingError(name)
  return m
}

export const hasNative = (name: 'AuCourantExport' | 'AuCourantLock' | 'AuCourantSms') => !!NativeModules[name]

// ---- Export (ExportModule.java) -------------------------------------------------

type ExportNative = {
  writeReport(fileName: string, content: string, encoding: 'utf8' | 'latin1'): Promise<string>
  shareFile(path: string, mimeType: string, title: string): Promise<boolean>
  openFile(path: string, mimeType: string): Promise<boolean>
}

export type ReportFile = { path: string; name: string; mimeType: string }

export const ExportNative = {
  async write(name: string, content: string, format: 'pdf' | 'csv'): Promise<ReportFile> {
    const mimeType = format === 'pdf' ? 'application/pdf' : 'text/csv'
    const path = await mod<ExportNative>('AuCourantExport').writeReport(name, content, format === 'pdf' ? 'latin1' : 'utf8')
    return { path, name, mimeType }
  },
  share: (f: ReportFile) => mod<ExportNative>('AuCourantExport').shareFile(f.path, f.mimeType, f.name),
  open: (f: ReportFile) => mod<ExportNative>('AuCourantExport').openFile(f.path, f.mimeType),
}

// ---- Lock (LockModule.java) -----------------------------------------------------

export type SecretHash = { hash: string; salt: string }

type LockNative = {
  hashSecret(secret: string): Promise<SecretHash>
  verifySecret(secret: string, hash: string, salt: string): Promise<boolean>
  makeRecoveryCode(): Promise<string>
}

/** Recovery codes are checked without dashes, upper case. */
export const normalizeRecovery = (code: string) => code.replace(/-/g, '').toUpperCase()

export const LockNative = {
  hash: (secret: string) => mod<LockNative>('AuCourantLock').hashSecret(secret),
  verify: (secret: string, h: SecretHash) => mod<LockNative>('AuCourantLock').verifySecret(secret, h.hash, h.salt),
  recoveryCode: () => mod<LockNative>('AuCourantLock').makeRecoveryCode(),
}

// ---- SMS (SmsModule.java) -------------------------------------------------------

export type RawSms = { id: string; address: string; body: string; date: number }

/** Mirrors com.aucourant.parser.ParsedSms. Several MTN templates are provisional (no real sample yet). */
export type ParsedType = 'RECEIVED' | 'CASH_IN' | 'REVERSAL' | 'SENT' | 'MERCHANT' | 'BILL' | 'CASH_OUT' | 'AIRTIME' | 'UNREAD'
export type ParsedSms = {
  type: ParsedType
  direction: 'IN' | 'OUT' | 'NONE'
  status: 'PARSED' | 'PARTIAL' | 'UNREAD'
  amount: number | null
  fee: number | null
  tax: number | null
  balance: number | null
  counterpartyName: string | null
  counterpartyNumber: string | null
  merchant: string | null
  rawReference: string | null
  reference: string | null
  referenceKind: 'TYPED' | 'CODE' | 'NONE'
  txId: string | null
  raw: string
}

type SmsNative = {
  hasPermission(): Promise<boolean>
  readInbox(senders: string[], sinceMillis: number): Promise<RawSms[]>
  parseMessages(bodies: string[]): Promise<ParsedSms[]>
}

/** Provisional sender IDs for MTN MoMo. Confirm against real phones (architecture spike 2). */
export const MOMO_SENDERS = ['MobileMoney', 'MTN MoMo', 'MTNMoMo']

export type SmsPermission = 'granted' | 'denied' | 'never_ask_again' | 'unavailable'

/** How long after the app comes back to the front we stop waiting for the prompt's own answer. */
const PROMPT_SETTLE_MS = 1500

export const SmsNative = {
  hasPermission: () => mod<SmsNative>('AuCourantSms').hasPermission(),
  /** False in Expo Go, on non-Android platforms, or in a build made before the Java modules were added. */
  canReadMessages: () => Platform.OS === 'android' && !inExpoGo && hasNative('AuCourantSms'),
  /**
   * Shows the Android prompt. Resolves 'granted', 'denied', 'never_ask_again', or 'unavailable'
   * when this build cannot read messages at all (see canReadMessages).
   *
   * Some hosts never deliver the prompt's result to React Native, which used to leave the button
   * loading forever. So when the app returns to the front after the prompt closes, the permission is
   * checked directly and that answer wins if the prompt's own result has not arrived.
   */
  async requestPermission(): Promise<SmsPermission> {
    if (!SmsNative.canReadMessages()) return 'unavailable'
    const asked = PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    ]).then((r): SmsPermission => {
      const read = r[PermissionsAndroid.PERMISSIONS.READ_SMS]
      return read === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : read === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'never_ask_again' : 'denied'
    })
    let sub: { remove(): void } | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const settled = new Promise<SmsPermission>((resolve) => {
      sub = AppState.addEventListener('change', (st) => {
        if (st !== 'active') return
        clearTimeout(timer)
        timer = setTimeout(async () => {
          const ok = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS).catch(() => false)
          resolve(ok ? 'granted' : 'denied')
        }, PROMPT_SETTLE_MS)
      })
    })
    try {
      return await Promise.race([asked, settled])
    } finally {
      sub?.remove()
      clearTimeout(timer)
    }
  },
  readInbox: (sinceMillis = 0, senders = MOMO_SENDERS) => mod<SmsNative>('AuCourantSms').readInbox(senders, sinceMillis),
  /** Parses bodies with the Java MTN templates. Nothing is stored. */
  parse: (bodies: string[]) => mod<SmsNative>('AuCourantSms').parseMessages(bodies),
}
