import { useEffect, useState } from 'react'
import { View } from 'react-native'
import type { Tx } from '../lib/data'
import { useApp } from '../lib/store'
import { longDate, money, normalize } from '../lib/format'
import { makeStyles } from '../theme'
import { Button, Divided, RadioRow, Surface, T, TextField } from '../ui/kit'
import { Sheet } from '../ui/overlays'

export type Day = { date: string; items: Tx[]; total: number }

export function byDay(list: Tx[]): Day[] {
  const sorted = [...list].sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)))
  const days: Day[] = []
  for (const t of sorted) {
    const last = days[days.length - 1]
    if (last && last.date === t.date) {
      last.items.push(t)
      last.total += t.amount
    } else days.push({ date: t.date, items: [t], total: t.amount })
  }
  return days
}

export function DayHeader({ date, total }: { date: string; total: number }) {
  const s = useStyles()
  return (
    <View style={s.dayHeader}>
      <T v="sec" w="medium" tone="fg2" accessibilityRole="header">
        {longDate(date)}
      </T>
      <T v="sec" w="medium" tone="fg2" num>
        {money(total)}
      </T>
    </View>
  )
}

export function ChangeGroupSheet({ txId, onClose }: { txId: string | null; onClose: () => void }) {
  const { allTxs, groups, moveTx, createGroupAndMove, findGroupByName } = useApp()
  const live = allTxs.find((t) => t.id === txId)
  const [kept, setKept] = useState<Tx | undefined>(live)
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
  const sorted = [
    ...groups.filter((g) => !g.system && (!g.code || g.id === live?.groupId)).sort((a, b) => a.name.localeCompare(b.name)),
    ...groups.filter((g) => g.system),
  ]

  const create = () => {
    if (!tx) return
    const n = name.trim()
    if (!n) return setError('Enter a group name.')
    const existing = findGroupByName(n)
    if (existing) moveTx(tx.id, existing.id)
    else createGroupAndMove(n, tx.id)
    onClose()
  }

  return (
    <Sheet open={!!txId} onClose={onClose} title="Change group">
      <Surface>
        <View accessibilityRole="radiogroup" accessibilityLabel="Groups">
          <Divided>
            {sorted.map((g) => (
              <RadioRow
                key={g.id}
                checked={tx?.groupId === g.id}
                onSelect={() => {
                  if (tx) moveTx(tx.id, g.id)
                  onClose()
                }}
                label={g.name}
                sub={g.system ? 'System group' : undefined}
              />
            ))}
          </Divided>
        </View>
      </Surface>
      <View style={{ marginTop: 24 }}>
        <TextField
          label="Create new group"
          value={name}
          onChange={setName}
          error={error}
          helper="The payment moves into the new group."
          onFocus={() => setError(null)}
          onSubmitEditing={create}
          returnKeyType="done"
          autoComplete="off"
        />
        <Button full variant="secondary" style={{ marginTop: 12 }} onPress={create}>
          Create group
        </Button>
      </View>
    </Sheet>
  )
}

export function matches(q: string, ...fields: (string | null | undefined)[]) {
  const n = normalize(q)
  return !n || fields.some((f) => f && normalize(f).includes(n))
}

const useStyles = makeStyles((c) => ({
  dayHeader: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 8,
    backgroundColor: c.canvas,
  },
}))
