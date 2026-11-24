import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useApp } from '../../lib/store'
import { totalsOf } from '../../lib/personal'
import { longDate, money, plural } from '../../lib/format'
import { matches } from '../../lib/search'
import type { PersonMerge } from '../../lib/personal-merge'
import { makeStyles } from '../../theme'
import { AppBar, Button, Divided, EmptyState, IconButton, RadioRow, Row, SearchField, SectionLabel, Surface, T, TextField } from '../../ui/kit'
import { PencilSimpleIcon, UsersIcon } from '../../ui/icons'
import { Body } from '../../ui/layout'
import { Sheet } from '../../ui/overlays'
import { PDayHeader, PTxRow, pByDay } from './shared'

/** Everything with one person or shop. For a business, this is the customer view. */
export function Person({ id }: { id: string }) {
  const s = useStyles()
  const { allPTxs, people, personName, back, push, rules, categoryName, refunds, personMerges, separatePerson } = useApp()
  const [edit, setEdit] = useState(false)
  const [merging, setMerging] = useState(false)
  const p = people.get(id)
  const list = allPTxs.filter((t) => t.personKey === id)
  if (!p || list.length === 0) {
    return (
      <>
        <AppBar title="Person" onBack={back} />
        <EmptyState icon={UsersIcon} title="No payments with this person" body="They may have been removed when data was erased." action="Go back" onAction={back} />
      </>
    )
  }
  const tot = totalsOf(list, refunds)
  const rule = rules.find((r) => r.kind === 'person' && r.value === id)
  const canNickname = id !== 'm:airtime'
  const merged = personMerges.filter((m) => m.toKey === id)
  /** Who was merged in: the name and number on their payments, or the key when none are left. */
  const mergedLabel = (m: PersonMerge) => {
    const t = allPTxs.find((x) => m.txIds.includes(x.id))
    return t ? [t.name, t.phone].filter(Boolean).join(' · ') : m.fromKey
  }

  return (
    <>
      <AppBar
        title="Person"
        onBack={back}
        actions={canNickname ? <IconButton label="Edit nickname" icon={PencilSimpleIcon} onPress={() => setEdit(true)} tipAlign="end" /> : undefined}
      />
      <Body>
        <View style={{ paddingTop: 8 }}>
          <T v="title" w="display" accessibilityRole="header">
            {personName(id)}
          </T>
          {(p.nickname || p.phone) && (
            <T v="sec" tone="fg2" num>
              {[p.nickname ? p.name : null, p.phone].filter(Boolean).join(' · ')}
            </T>
          )}
        </View>

        <Surface style={s.totals}>
          <View style={{ flex: 1 }}>
            <T v="sec" tone="fg2">
              Money in
            </T>
            <T w="semibold" num tone="accent">
              {money(tot.moneyIn)}
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T v="sec" tone="fg2">
              Money out
            </T>
            <T w="semibold" num>
              {money(tot.moneyOut)}
            </T>
          </View>
          <View>
            <T v="sec" tone="fg2">
              Payments
            </T>
            <T w="semibold" num>
              {tot.count}
            </T>
          </View>
        </Surface>

        {rule && (
          <Surface style={{ marginTop: 12 }}>
            <Row title={`Always ${categoryName(rule.categoryId)}`} sub="New payments with this person go there." onPress={() => push({ name: 'manage-categories' })} />
          </Surface>
        )}

        {canNickname && (
          <Surface style={{ marginTop: 12 }}>
            <Row title="Merge with another person" sub="The same person with another number or spelling." onPress={() => setMerging(true)} />
          </Surface>
        )}

        {merged.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <SectionLabel>Merged into this person</SectionLabel>
            <Surface divided>
              {merged.map((m) => (
                <Row
                  key={m.id}
                  title={mergedLabel(m)}
                  sub={`Merged ${longDate(m.date)}`}
                  trailing={
                    <Button variant="text" onPress={() => separatePerson(m.id)}>
                      Separate
                    </Button>
                  }
                />
              ))}
            </Surface>
          </View>
        )}

        {pByDay(list).map((d) => (
          <View key={d.date}>
            <PDayHeader day={d} />
            <Surface>
              <Divided>
                {d.items.map((t) => (
                  <PTxRow key={t.id} t={t} hidePerson onPress={() => push({ name: 'tx', id: t.id })} />
                ))}
              </Divided>
            </Surface>
          </View>
        ))}
        <T v="sec" tone="fg2" num style={{ marginTop: 16 }}>
          {plural(tot.count, 'payment')}, fees {money(tot.fees)}
        </T>
      </Body>
      <NicknameSheet open={edit} personKey={id} onClose={() => setEdit(false)} />
      <MergePersonSheet open={merging} personKey={id} onClose={() => setMerging(false)} />
    </>
  )
}

/** Pick the other person, then which name to keep. The person whose page this is stays; the other merges in. */
function MergePersonSheet({ open, personKey, onClose }: { open: boolean; personKey: string; onClose: () => void }) {
  const { people, personName, mergePerson } = useApp()
  const [q, setQ] = useState('')
  const [other, setOther] = useState<string | null>(null)
  const [keepOther, setKeepOther] = useState(false)
  useEffect(() => {
    if (open) {
      setQ('')
      setOther(null)
      setKeepOther(false)
    }
  }, [open])
  const me = people.get(personKey)
  const o = other ? people.get(other) : undefined
  const myName = personName(personKey)
  const otherName = other ? personName(other) : ''
  const candidates = [...people.values()]
    .filter((x) => x.key !== personKey && x.key !== 'm:airtime' && matches(q, x.name, x.nickname, x.phone, x.phone?.replace(/\s/g, '')))
    .slice(0, 30)
  const merge = () => {
    if (!other) return
    mergePerson(other, personKey, keepOther ? otherName : myName)
    onClose()
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={o ? 'Which name to keep?' : 'Merge with'}
      footer={
        o ? (
          <Button full onPress={merge}>
            Merge
          </Button>
        ) : undefined
      }
    >
      {o ? (
        <>
          <T v="sec" tone="fg2" style={{ marginBottom: 8 }}>
            Payments with {otherName} move here, and new messages from {o.phone ?? 'them'} come here too. You can separate them again on this page.
          </T>
          <RadioRow checked={!keepOther} onSelect={() => setKeepOther(false)} label={myName} sub={me?.phone ?? undefined} />
          <RadioRow checked={keepOther} onSelect={() => setKeepOther(true)} label={otherName} sub={o.phone ?? undefined} />
          <Button full variant="text" style={{ marginTop: 8 }} onPress={() => setOther(null)}>
            Choose someone else
          </Button>
        </>
      ) : (
        <>
          <SearchField label="Search name or number" value={q} onChange={setQ} />
          <Divided>
            {candidates.map((x) => (
              <Row key={x.key} title={personName(x.key)} sub={x.phone ?? undefined} onPress={() => setOther(x.key)} />
            ))}
          </Divided>
          {candidates.length === 0 && (
            <T v="sec" tone="fg2" style={{ marginTop: 12 }}>
              No one matches.
            </T>
          )}
        </>
      )}
    </Sheet>
  )
}

function NicknameSheet({ open, personKey, onClose }: { open: boolean; personKey: string; onClose: () => void }) {
  const { people, setNickname } = useApp()
  const p = people.get(personKey)
  const [value, setValue] = useState(p?.nickname ?? '')
  useEffect(() => {
    if (open) setValue(p?.nickname ?? '')
  }, [open, p?.nickname])
  const save = () => {
    setNickname(personKey, value)
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Nickname">
      <TextField
        label="Nickname"
        value={value}
        onChange={setValue}
        helper={`Shown instead of "${p?.name ?? ''}". Search finds both.`}
        onSubmitEditing={save}
        returnKeyType="done"
        autoComplete="off"
      />
      <Button full style={{ marginTop: 16 }} onPress={save}>
        Save nickname
      </Button>
      {p?.nickname && (
        <Button full variant="text" style={{ marginTop: 8 }} onPress={() => (setNickname(personKey, ''), onClose())}>
          Remove nickname
        </Button>
      )}
    </Sheet>
  )
}

const useStyles = makeStyles(() => ({
  totals: { marginTop: 16, padding: 16, flexDirection: 'row', gap: 16 },
}))
