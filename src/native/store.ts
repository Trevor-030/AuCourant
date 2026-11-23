/**
 * Typed bridge to StoreModule.java: saved data, scans and the lock (Room). JSON is parsed and
 * written only here. Not available in Expo Go or a build made before the module was added, where
 * the app keeps its sample data in memory.
 */
import { NativeEventEmitter, NativeModules, Platform } from 'react-native'
import type { Change } from '../lib/persist'
import type { CodeName } from '../lib/inbox'
import { inExpoGo, NativeMissingError } from './index'

type Native = {
  load(): Promise<string>
  save(changesJson: string): Promise<void>
  saveSettings(json: string): Promise<void>
  eraseAll(): Promise<void>
  scan(sinceMillis: number, optsJson: string): Promise<string>
  setLock(type: string, secret: string, recovery: string, fingerprint: boolean): Promise<void>
  changeSecret(type: string, secret: string): Promise<void>
  setRecovery(code: string): Promise<void>
  setFingerprint(on: boolean): Promise<void>
  clearLock(): Promise<void>
  lockWait(): Promise<number>
  checkLock(secret: string): Promise<LockCheck>
  checkRecovery(code: string): Promise<LockCheck>
}

const NAME = 'AuCourantStore'

function mod(): Native {
  const m = NativeModules[NAME] as Native | undefined
  if (!m) throw new NativeMissingError(NAME)
  return m
}

/** What `load` returns: each saved list by name, the settings, and the lock without its secrets. */
export type Snapshot = {
  lists: Partial<Record<string, unknown[]>>
  settings: Record<string, unknown>
  lock: { type: 'pin4' | 'pin6' | 'password'; fingerprint: boolean } | null
}

export type ScanOpts = { useType: string; firstRunCodes: CodeName[]; defaultCategories: unknown[] }
/** The rows a scan added or changed, by list. `categories` only on the first scan. */
export type ScanChanged = Partial<Record<'txs' | 'groups' | 'merges' | 'suggestions' | 'unread' | 'codes' | 'pTxs' | 'categories', unknown[]>>
/** `newestSms`: phone time of the newest message read so far; the next check starts a little before it. */
export type NativeScanResult = { messages: number; newPayments: number; first: boolean; newestSms: number; changed: ScanChanged }
export type LockCheck = { ok: boolean; waitSeconds: number }

export const StoreNative = {
  /** False in Expo Go, on other platforms, or in a build made before StoreModule existed. */
  available: () => Platform.OS === 'android' && !inExpoGo && !!NativeModules[NAME],
  load: async (): Promise<Snapshot> => JSON.parse(await mod().load()),
  save: (changes: Change[]) => mod().save(JSON.stringify(changes)),
  saveSettings: (settings: Record<string, unknown>) => mod().saveSettings(JSON.stringify(settings)),
  eraseAll: () => mod().eraseAll(),
  /** Reads the inbox from `since`, sorts and saves in Java. `onProgress` gets (read, total). */
  async scan(since: number, opts: ScanOpts, onProgress?: (read: number, total: number) => void): Promise<NativeScanResult> {
    const emitter = new NativeEventEmitter(NativeModules[NAME])
    const sub = onProgress ? emitter.addListener('AuCourantScanProgress', (e: Object) => {
          const p = e as { read: number; total: number }
          onProgress(p.read, p.total)
        }) : null
    try {
      return JSON.parse(await mod().scan(since, JSON.stringify(opts)))
    } finally {
      sub?.remove()
    }
  },
  /** Calls `run` when a MoMo message arrives while the app is running (SmsReceiver.java). Returns the stop function. */
  onNewMessage(run: () => void): () => void {
    const sub = new NativeEventEmitter(NativeModules[NAME]).addListener('AuCourantNewMessage', run)
    return () => sub.remove()
  },
  setLock: (type: string, secret: string, recovery: string, fingerprint = false) => mod().setLock(type, secret, recovery, fingerprint),
  changeSecret: (type: string, secret: string) => mod().changeSecret(type, secret),
  setRecovery: (code: string) => mod().setRecovery(code),
  setFingerprint: (on: boolean) => mod().setFingerprint(on),
  clearLock: () => mod().clearLock(),
  /** Seconds left of a wait the app was restarted in. */
  lockWait: () => mod().lockWait(),
  checkLock: (secret: string) => mod().checkLock(secret),
  checkRecovery: (code: string) => mod().checkRecovery(code),
}
