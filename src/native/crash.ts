/**
 * Records what goes wrong (CrashLog.java). Imported first in index.ts, so it is listening before any
 * screen runs. Not available in Expo Go, where every call does nothing.
 */
import { NativeModules } from 'react-native'
import { describeError } from '../lib/crash'

type Native = {
  pending(): Promise<string | null>
  clear(): Promise<void>
  step(what: string): void
  recordNow(kind: string, details: string): boolean
}

const native = () => NativeModules.AuCourantCrash as Native | undefined

export const CrashNative = {
  available: () => !!native(),
  /** The report of the last problem, until it is dismissed. */
  pending: async (): Promise<string | null> => (await native()?.pending()) ?? null,
  clear: async () => {
    await native()?.clear()
  },
  /** One thing the app did, for the report. Screen names and counts only, never payments or people. */
  step(what: string) {
    try {
      native()?.step(what)
    } catch {
      // A missing step costs nothing.
    }
  },
  /** Saves a problem before returning: the app may be closing. */
  record(kind: string, details: string) {
    try {
      native()?.recordNow(kind, details)
    } catch {
      // Java records the same error when it closes the app.
    }
  },
}

// Errors outside screens (events, timers). The earlier handler then does what it always did.
const earlier = ErrorUtils.getGlobalHandler()
ErrorUtils.setGlobalHandler((error, isFatal) => {
  if (isFatal) CrashNative.record('JavaScript error', describeError(error))
  earlier(error, isFatal)
})
CrashNative.step('JavaScript started')
