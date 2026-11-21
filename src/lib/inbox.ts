import type { Group, Merge, Suggestion, Tx, Unread } from './data'
import type { ParsedSms, RawSms } from '../native'

/**
 * Real messages are read, sorted and saved in Java: the grouping rules (match key, built-in pairs,
 * code book, suggest and confirm) live in native/android/java/com/aucourant/sorting, checked by
 * `npm run test:inbox`. What stays here are the shared types and the screen-side checks.
 */

export type InboxRow = { sms: RawSms; parsed: ParsedSms }
export type CodeName = { code: string; name: string }
export type ChurchData = {
  txs: Tx[]
  groups: Group[]
  merges: Merge[]
  suggestions: Suggestion[]
  unread: Unread[]
  /** Code book: number code to group id. */
  codes: Record<string, string>
}

export const NO_REFERENCE = 'noref'

/**
 * Why a number reference may not be a code, so the treasurer is asked to confirm before naming it:
 * 'long' for 4 or more digits (1001), 'amount' when it equals what a giver paid ("50" on GHS 50).
 */
export function codeDoubt(code: string, amounts: number[]): 'long' | 'amount' | null {
  if (code.length >= 4) return 'long'
  return amounts.some((a) => a === Number(code)) ? 'amount' : null
}
