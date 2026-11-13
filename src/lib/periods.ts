import { TODAY, addDays, dayMonth, parseDate, shortDate, toIso, weekdayOf } from './format'

/** Personal replaces the church's service with a period. */
export type PeriodId = 'today' | 'week' | 'month' | 'last-month' | `range:${string}:${string}`
export type Period = { id: PeriodId; title: string; label: string; from: string; to: string }

export const PRESET_PERIODS: PeriodId[] = ['today', 'week', 'month', 'last-month']

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function monthBounds(iso: string, offset: number) {
  const d = parseDate(iso)
  const first = new Date(d.getFullYear(), d.getMonth() + offset, 1)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  return { from: toIso(first), to: toIso(last), name: `${MONTHS[first.getMonth()]} ${first.getFullYear()}` }
}

export function periodInfo(id: PeriodId, today = TODAY): Period {
  if (id.startsWith('range:')) {
    const [, from, to] = id.split(':')
    return { id, title: 'Chosen dates', label: `${shortDate(from)} to ${shortDate(to)}`, from, to }
  }
  switch (id) {
    case 'today':
      return { id, title: 'Today', label: shortDate(today), from: today, to: today }
    case 'week': {
      // Weeks start on Monday.
      const from = addDays(today, -((weekdayOf(today) + 6) % 7))
      return { id, title: 'This week', label: `${dayMonth(from)} to ${dayMonth(today)}`, from, to: today }
    }
    case 'month': {
      const m = monthBounds(today, 0)
      return { id, title: 'This month', label: m.name, from: m.from, to: today }
    }
    default: {
      const m = monthBounds(today, -1)
      return { id: 'last-month', title: 'Last month', label: m.name, from: m.from, to: m.to }
    }
  }
}

export const inPeriod = (p: Period, date: string) => date >= p.from && date <= p.to
