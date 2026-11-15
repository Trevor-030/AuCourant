const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** The sample data's "today". Keeps the sample payments and defaults stable. Real messages use the phone's date (store `today`). */
export const TODAY = '2026-10-28'

/** 1234.5 -> "1,234.50". Locale-free so it renders the same on every Android build. */
export function amount2(n: number) {
  const [whole, frac] = Math.abs(n).toFixed(2).split('.')
  return (n < 0 ? '-' : '') + group(whole) + '.' + frac
}

function group(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function money(n: number) {
  return 'GHS ' + amount2(n)
}

export function parseDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toIso(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** The phone's date today. */
export const phoneToday = () => toIso(new Date())

/** The most recent date, today included, that falls on this weekday (0 is Sunday). */
export function latestWeekday(today: string, day: number) {
  let d = today
  while (weekdayOf(d) !== day) d = addDays(d, -1)
  return d
}

export function addDays(iso: string, n: number) {
  const d = parseDate(iso)
  d.setDate(d.getDate() + n)
  return toIso(d)
}

export function weekdayOf(iso: string) {
  return parseDate(iso).getDay()
}

/** Sunday, 25 Oct 2026 */
export function longDate(iso: string) {
  const d = parseDate(iso)
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** 25 Oct 2026 */
export function shortDate(iso: string) {
  const d = parseDate(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** 25 Oct */
export function dayMonth(iso: string) {
  const d = parseDate(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function toMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function fromMin(n: number) {
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
}

export function inWindow(t: string, start: string, end: string) {
  const v = toMin(t)
  return v >= toMin(start) && v <= toMin(end)
}

export function plural(n: number, one: string, many = one + 's') {
  return `${group(String(n))} ${n === 1 ? one : many}`
}

export function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}
