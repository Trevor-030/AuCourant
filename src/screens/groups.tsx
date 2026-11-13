import { useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { statsOf, useApp } from '../lib/store'
import { money, plural } from '../lib/format'
import { FONT, RADIUS, TYPE, makeStyles, useTheme } from '../theme'
import { AppBar, Divided, EmptyState, IconButton, LinkText, RadioRow, Row, SearchField, Skel, SkeletonRows, Surface, T } from '../ui/kit'
import { CheckIcon, DotsThreeVerticalIcon, GitMergeIcon, MagnifyingGlassIcon, PencilSimpleIcon, ReceiptIcon, StackIcon } from '../ui/icons'
import { Body } from '../ui/layout'
import { MenuList, Sheet } from '../ui/overlays'
import { DayHeader, byDay, matches } from './shared'
import { CodeSheet, type CodeSheetState } from './codes'

export function Groups() {
  const s = useStyles()
  const { demo, groups, txs, push, useType } = useApp()
  const [q, setQ] = useState('')
  const loading = demo === 'loading'
  const withStats = groups.map((g) => ({ g, s: statsOf(txs.filter((t) => t.groupId === g.id)) }))
  const pinned = withStats.filter((x) => x.g.system && matches(q, x.g.name))
  const rest = withStats.filter((x) => !x.g.system && matches(q, x.g.name)).sort((a, b) => b.s.total - a.s.total)
  const shown = [...pinned, ...rest]

  return (
    <>
      <AppBar title="Groups" />
      <Body>
        <SearchField label="Search groups" value={q} onChange={setQ} />
        <View style={s.meta}>
          <T v="sec" tone="fg2">
            All {useType === 'organisation' ? 'periods' : 'services'}
          </T>
          {loading ? (
            <Skel h={12} w={64} />
          ) : (
            <T v="sec" tone="fg2" num>
              {plural(groups.filter((g) => !g.system).length, 'group')}
            </T>
          )}
        </View>
        <Surface>
          {loading ? (
            <SkeletonRows n={7} />
          ) : groups.length === 0 ? (
            <EmptyState icon={StackIcon} title="No groups yet" body="Groups appear when MoMo payments arrive." action="Scan messages again" onAction={() => push({ name: 'rescan' })} />
          ) : shown.length === 0 ? (
            <EmptyState
              icon={MagnifyingGlassIcon}
              title="No groups match"
              body={`Nothing is called “${q.trim()}”. Check the spelling or try a shorter word.`}
              action="Clear search"
              onAction={() => setQ('')}
            />
          ) : (
            <Divided>
              {shown.map(({ g, s: st }) => (
                <Row
                  key={g.id}
                  title={g.name}
                  sub={g.system ? `System group · ${plural(st.count, 'payment')}` : g.code ? `Code to name · ${plural(st.count, 'payment')}` : plural(st.count, 'payment')}
                  end={money(st.total)}
                  onPress={() => push({ name: 'group', id: g.id })}
                />
              ))}
            </Divided>
          )}
        </Surface>
      </Body>
    </>
  )
}

export function GroupDetail({ id }: { id: string }) {
  const s = useStyles()
  const { c } = useTheme()
  const { allGroups, groups, txs, merges, alsoCounted, renameGroup, findGroupByName, back, push, replace, mergeGroups, notify, setTab, useType } = useApp()
  const g = allGroups.find((x) => x.id === id)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [menu, setMenu] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [codeSheet, setCodeSheet] = useState<CodeSheetState>(null)

  if (!g || g.hidden) {
    return (
      <>
        <AppBar onBack={back} />
        <EmptyState icon={GitMergeIcon} title="This group was merged" body="Its payments now count in another group." action="Go to Groups" onAction={() => setTab('groups')} />
      </>
    )
  }

  const list = txs.filter((t) => t.groupId === id)
  const st = statsOf(list)
  const also = alsoCounted(id)
  const hasWordings = merges.some((m) => m.targetId === id && !m.code)
  const isCodeGroup = !!g.code
  const editable = !g.system && !isCodeGroup
  const targets = groups.filter((x) => !x.system && !x.code && x.id !== id).sort((a, b) => a.name.localeCompare(b.name))

  const startEdit = () => {
    setDraft(g.name)
    setEditing(true)
  }
  const save = () => {
    if (!editing) return
    setEditing(false)
    const n = draft.trim()
    if (!n || n === g.name) return
    const clash = findGroupByName(n)
    if (clash && clash.id !== id) return notify(`${clash.name} already exists. Use Merge into another group instead.`)
    renameGroup(id, n)
  }

  return (
    <>
      <AppBar onBack={back} actions={editable && <IconButton label="More options" icon={DotsThreeVerticalIcon} onPress={() => setMenu(!menu)} tipAlign="end" />} />
      <Body>
        <View style={s.nameRow}>
          {editing ? (
            <TextInput
              autoFocus
              accessibilityLabel="Group name"
              value={draft}
              onChangeText={setDraft}
              onBlur={save}
              onSubmitEditing={save}
              returnKeyType="done"
              selectionColor={c.accent}
              cursorColor={c.accent}
              style={[s.nameInput, { borderBottomColor: c.accent }]}
            />
          ) : (
            <T v="title" w="display" numberOfLines={1} style={s.name} accessibilityRole="header">
              {g.name}
            </T>
          )}
          {editable &&
            (editing ? (
              <IconButton label="Save name" icon={CheckIcon} color={c.accent} onPress={save} tipAlign="end" />
            ) : (
              <IconButton label="Rename group" icon={PencilSimpleIcon} size={20} onPress={startEdit} tipAlign="end" />
            ))}
        </View>
        {g.system ? (
          <T v="sec" tone="fg2">
            Payments where the giver did not type a note.
          </T>
        ) : isCodeGroup ? (
          <View style={s.inline}>
            <T v="sec" tone="fg2">
              Givers typed {g.code} as the reference.
            </T>
            <LinkText onPress={() => setCodeSheet({ mode: 'name', code: g.code! })}>Name this code</LinkText>
          </View>
        ) : also.length > 0 ? (
          <View style={s.inline}>
            <T v="sec" tone="fg2" numberOfLines={1} style={{ flexShrink: 1 }}>
              Also counted: {also.join(', ')}
            </T>
            <LinkText onPress={() => push({ name: hasWordings ? 'merge-history' : 'reference-codes' })}>Manage</LinkText>
          </View>
        ) : null}

        <T v="big" w="semibold" num style={{ marginTop: 24 }}>
          {money(st.total)}
        </T>
        <T v="sec" tone="fg2">
          {plural(st.count, 'payment')}, all {useType === 'organisation' ? 'periods' : 'services'}
        </T>

        <View style={{ marginTop: 16 }}>
          {list.length === 0 ? (
            <Surface style={{ marginTop: 16 }}>
              <EmptyState
                icon={ReceiptIcon}
                title="No payments in this group"
                body="Payments you move here show up in this list."
                action="Go to Transactions"
                onAction={() => setTab('transactions')}
              />
            </Surface>
          ) : (
            byDay(list).map((d) => (
              <View key={d.date}>
                <DayHeader date={d.date} total={d.total} />
                <Surface>
                  <Divided>
                    {d.items.map((t) => (
                      <Row key={t.id} title={t.sender} sub={t.time} end={money(t.amount)} onPress={() => push({ name: 'tx', id: t.id })} />
                    ))}
                  </Divided>
                </Surface>
              </View>
            ))
          )}
        </View>
      </Body>

      {menu && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} accessibilityLabel="Close menu" />
          <MenuList>
            <Row
              title="Merge into another group"
              leading={<GitMergeIcon size={20} color={c.fg2} />}
              onPress={() => {
                setMenu(false)
                setMergeOpen(true)
              }}
            />
          </MenuList>
        </>
      )}

      <Sheet open={mergeOpen} onClose={() => setMergeOpen(false)} title={`Merge ${g.name} into…`}>
        <T v="sec" tone="fg2" style={{ marginBottom: 16 }}>
          Payments in {g.name} move into the group you choose. You can undo this in Merge history.
        </T>
        <Surface>
          <View accessibilityRole="radiogroup" accessibilityLabel="Merge into">
            <Divided>
              {targets.map((t) => (
                <RadioRow
                  key={t.id}
                  checked={false}
                  label={t.name}
                  sub={plural(txs.filter((x) => x.groupId === t.id).length, 'payment')}
                  onSelect={() => {
                    setMergeOpen(false)
                    mergeGroups(id, t.id)
                    replace({ name: 'group', id: t.id })
                  }}
                />
              ))}
            </Divided>
          </View>
        </Surface>
      </Sheet>
      <CodeSheet state={codeSheet} onClose={() => setCodeSheet(null)} onSaved={(to) => replace({ name: 'group', id: to })} />
    </>
  )
}

const useStyles = makeStyles((c) => ({
  meta: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 },
  nameRow: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { flex: 1, borderBottomWidth: 2, borderBottomColor: 'transparent', paddingVertical: 8 },
  nameInput: {
    flex: 1,
    height: 48,
    borderBottomWidth: 2,
    color: c.fg,
    fontFamily: FONT.display,
    fontSize: TYPE.title.fontSize,
    padding: 0,
  },
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 4, minHeight: 24 },
  radius: { borderRadius: RADIUS.lg },
}))
