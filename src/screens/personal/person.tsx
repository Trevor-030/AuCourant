import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useApp } from '../../lib/store'
import { totalsOf } from '../../lib/personal'
import { money, plural } from '../../lib/format'
import { makeStyles } from '../../theme'
import { AppBar, Button, Divided, EmptyState, IconButton, Row, Surface, T, TextField } from '../../ui/kit'
import { PencilSimpleIcon, UsersIcon } from '../../ui/icons'
import { Body } from '../../ui/layout'
import { Sheet } from '../../ui/overlays'
import { PDayHeader, PTxRow, pByDay } from './shared'

/** Everything with one person or shop. For a business, this is the customer view. */
export function Person({ id }: { id: string }) {
  const s = useStyles()
  const { allPTxs, people, personName, back, push, rules, categoryName } = useApp()
  const [edit, setEdit] = useState(false)
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
  const tot = totalsOf(list)
  const rule = rules.find((r) => r.kind === 'person' && r.value === id)
  const canNickname = id !== 'm:airtime'

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
    </>
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
