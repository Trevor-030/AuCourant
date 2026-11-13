import { useEffect, useState, type ReactNode } from 'react'
import { View } from 'react-native'
import { useApp } from '../../lib/store'
import { TODAY, addDays, longDate, money, plural } from '../../lib/format'
import { PRESET_PERIODS, periodInfo } from '../../lib/periods'
import type { PTx } from '../../lib/personal-data'
import { makeStyles } from '../../theme'
import { Button, Divided, RadioRow, Row, SectionLabel, Surface, T, TextField } from '../../ui/kit'
import { CalendarBlankIcon } from '../../ui/icons'
import { Sheet } from '../../ui/overlays'
import { DateField } from '../../ui/pickers'

/** "+GHS 50.00" for money in, "−GHS 50.00" for money out. */
export const signed = (t: Pick<PTx, 'direction' | 'amount'>) => (t.direction === 'in' ? '+' : '−') + money(t.amount)

export type PDay = { date: string; items: PTx[]; moneyIn: number; moneyOut: number }

export function pByDay(list: PTx[]): PDay[] {
  const sorted = [...list].sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)))
  const days: PDay[] = []
  for (const t of sorted) {
    let d = days[days.length - 1]
    if (!d || d.date !== t.date) {
      d = { date: t.date, items: [], moneyIn: 0, moneyOut: 0 }
      days.push(d)
    }
    d.items.push(t)
    if (t.direction === 'in') d.moneyIn += t.amount
    else d.moneyOut += t.amount
  }
  return days
}

export function PDayHeader({ day }: { day: PDay }) {
  const s = useStyles()
  const parts = [day.moneyIn > 0 && `+${money(day.moneyIn)}`, day.moneyOut > 0 && `−${money(day.moneyOut)}`].filter(Boolean)
  return (
    <View style={s.dayHeader}>
      <T v="sec" w="medium" tone="fg2" accessibilityRole="header" style={{ flexShrink: 1 }} numberOfLines={1}>
        {longDate(day.date)}
      </T>
      <T v="sec" w="medium" tone="fg2" num>
        {parts.join(' · ')}
      </T>
    </View>
  )
}

/** One payment: who, when and category, with a signed amount. */
export function PTxRow({ t, onPress, hidePerson }: { t: PTx; onPress: () => void; hidePerson?: boolean }) {
  const { personName, categoryName } = useApp()
  return (
    <Row
      title={hidePerson ? categoryName(t.categoryId) : personName(t.personKey)}
      sub={hidePerson ? t.time : `${t.time} · ${categoryName(t.categoryId)}`}
      end={signed(t)}
      endTone={t.direction === 'in' ? 'accent' : 'fg'}
      onPress={onPress}
    />
  )
}

/** Today, This week, This month, Last month, or chosen dates. */
export function PeriodSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { periodId, setPeriodId, pTxsIn } = useApp()
  const [range, setRange] = useState(periodId.startsWith('range:'))
  const [from, setFrom] = useState(addDays(TODAY, -27))
  const [to, setTo] = useState(TODAY)
  const [error, setError] = useState<string | null>(null)

  const pick = (id: typeof periodId) => {
    setPeriodId(id)
    onClose()
  }
  const applyRange = () => {
    if (!from || !to) return setError('Choose both dates.')
    if (to < from) return setError('The end date must be on or after the start date.')
    pick(`range:${from}:${to}`)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Choose period">
      <Surface>
        <View accessibilityRole="radiogroup" accessibilityLabel="Periods">
          <Divided>
            {PRESET_PERIODS.map((id) => {
              const p = periodInfo(id)
              return (
                <RadioRow
                  key={id}
                  checked={periodId === id}
                  onSelect={() => pick(id)}
                  label={p.title}
                  sub={p.label}
                  end={
                    <T v="sec" tone="fg2" num>
                      {plural(pTxsIn(id).length, 'payment')}
                    </T>
                  }
                />
              )
            })}
          </Divided>
        </View>
      </Surface>
      <View style={{ marginTop: 16, alignItems: 'flex-start' }}>
        {range ? (
          <Surface style={{ padding: 16, alignSelf: 'stretch' }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <DateField label="From" value={from} onChange={(v) => (setFrom(v), setError(null))} />
              </View>
              <View style={{ flex: 1 }}>
                <DateField label="To" value={to} onChange={(v) => (setTo(v), setError(null))} />
              </View>
            </View>
            {error && (
              <T v="sec" tone="error" style={{ marginTop: 8 }} accessibilityRole="alert">
                {error}
              </T>
            )}
            <Button full variant="secondary" style={{ marginTop: 16 }} onPress={applyRange}>
              Show these dates
            </Button>
          </Surface>
        ) : (
          <Button variant="text" icon={CalendarBlankIcon} style={{ marginLeft: -12 }} onPress={() => setRange(true)}>
            Choose dates
          </Button>
        )}
      </View>
    </Sheet>
  )
}

/** Put one payment in a category, or make a new one for it. */
export function CategorySheet({ txId, onClose }: { txId: string | null; onClose: () => void }) {
  const { allPTxs, categories, setCategory, addCategory, findCategoryByName } = useApp()
  const live = allPTxs.find((t) => t.id === txId)
  const [kept, setKept] = useState<PTx | undefined>(live)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (live) setKept(live)
  }, [live])
  useEffect(() => {
    if (!txId) {
      setName('')
      setError(null)
    }
  }, [txId])
  const tx = live ?? kept

  const choose = (id: string | null, label?: string) => {
    if (tx) setCategory(tx.id, id, label)
    onClose()
  }
  const create = () => {
    const n = name.trim()
    if (!n) return setError('Enter a category name.')
    const existing = findCategoryByName(n)
    if (existing?.hidden) return setError(`${existing.name} is hidden. Show it again in Manage categories.`)
    const id = existing?.id ?? addCategory(n)
    if (id) choose(id, existing?.name ?? n)
  }

  return (
    <Sheet open={!!txId} onClose={onClose} title="Choose category">
      <Surface>
        <View accessibilityRole="radiogroup" accessibilityLabel="Categories">
          <Divided>
            {categories.map((c) => (
              <RadioRow key={c.id} checked={tx?.categoryId === c.id} onSelect={() => choose(c.id)} label={c.name} />
            ))}
            <RadioRow checked={!!tx && !tx.categoryId} onSelect={() => choose(null)} label="Uncategorised" sub="Leave it for later" />
          </Divided>
        </View>
      </Surface>
      <View style={{ marginTop: 24 }}>
        <TextField
          label="New category"
          value={name}
          onChange={setName}
          error={error}
          helper="The payment moves into the new category."
          onFocus={() => setError(null)}
          onSubmitEditing={create}
          returnKeyType="done"
          autoComplete="off"
        />
        <Button full variant="secondary" style={{ marginTop: 12 }} onPress={create}>
          Create category
        </Button>
      </View>
    </Sheet>
  )
}

export function SectionList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <SectionLabel>{label}</SectionLabel>
      <Surface>
        <Divided>{children}</Divided>
      </Surface>
    </View>
  )
}

const useStyles = makeStyles((c) => ({
  dayHeader: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 8,
    backgroundColor: c.canvas,
  },
}))
