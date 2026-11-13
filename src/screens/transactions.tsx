import { useEffect, useRef, useState } from 'react'
import { Animated, PanResponder, Pressable, ScrollView, View } from 'react-native'
import { isCode, type Tx } from '../lib/data'
import { useApp } from '../lib/store'
import { longDate, money, plural } from '../lib/format'
import { DURATION, RADIUS, makeStyles, useTheme } from '../theme'
import { AppBar, Button, Chip, Divided, EmptyState, Expandable, Field, RadioRow, Row, SearchField, SectionLabel, Skel, SkeletonRows, Surface, T } from '../ui/kit'
import { ArrowsLeftRightIcon, CaretRightIcon, FunnelIcon, ReceiptIcon } from '../ui/icons'
import { Body } from '../ui/layout'
import { Sheet } from '../ui/overlays'
import { ChangeGroupSheet, DayHeader, byDay, matches } from './shared'

const ACTION_W = 136

/** Payment row. Swipe left to reveal Change group. Swipes are off with reduced motion. */
function SwipeRow({
  tx,
  sub,
  open,
  reduced,
  onOpen,
  onClose,
  onTap,
  onAction,
}: {
  tx: Tx
  sub: string
  open: boolean
  reduced: boolean
  onOpen: () => void
  onClose: () => void
  onTap: () => void
  onAction: () => void
}) {
  const s = useStyles()
  const { c } = useTheme()
  const x = useRef(new Animated.Value(0)).current
  const base = useRef(0)
  const cbs = useRef({ onOpen, onClose })
  cbs.current = { onOpen, onClose }

  useEffect(() => {
    base.current = open ? -ACTION_W : 0
    Animated.timing(x, { toValue: base.current, duration: reduced ? 0 : DURATION.exit, useNativeDriver: true }).start()
  }, [open, reduced, x])

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      // Keep the gesture once it is horizontal, so the list does not steal it.
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => x.setValue(Math.max(-ACTION_W, Math.min(0, base.current + g.dx))),
      onPanResponderRelease: (_, g) => {
        const end = base.current + g.dx
        if (end < -ACTION_W / 2) {
          cbs.current.onOpen()
          if (base.current === -ACTION_W) Animated.timing(x, { toValue: -ACTION_W, duration: DURATION.exit, useNativeDriver: true }).start()
        } else {
          cbs.current.onClose()
          if (base.current === 0) Animated.timing(x, { toValue: 0, duration: DURATION.exit, useNativeDriver: true }).start()
        }
      },
      onPanResponderTerminate: () => Animated.timing(x, { toValue: base.current, duration: DURATION.exit, useNativeDriver: true }).start(),
    }),
  ).current

  return (
    <View style={s.swipe}>
      <Pressable
        accessibilityRole="button"
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        onPress={onAction}
        style={({ pressed }) => [s.swipeAction, pressed && { opacity: 0.8 }]}
      >
        <ArrowsLeftRightIcon size={20} color={c.accent} />
        <T v="sec" w="medium" tone="accent">
          Change group
        </T>
      </Pressable>
      <Animated.View style={[s.swipeFront, { transform: [{ translateX: x }] }]} {...(reduced ? {} : pan.panHandlers)}>
        <Row
          title={tx.sender}
          sub={sub}
          end={money(tx.amount)}
          onPress={() => (open ? onClose() : onTap())}
        />
      </Animated.View>
    </View>
  )
}

export function Transactions() {
  const s = useStyles()
  const { demo, motion, txs, service, txsIn, txFilters: f, setTxFilters, groups, groupName, push, useType } = useApp()
  const [limit, setLimit] = useState(50)
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [change, setChange] = useState<string | null>(null)
  const [groupSheet, setGroupSheet] = useState(false)
  const loading = demo === 'loading'

  const base = f.thisService ? txsIn(service.id) : txs
  const filtered = base.filter((t) => (!f.groupId || t.groupId === f.groupId) && matches(f.query, t.sender, t.reference, groupName(t.groupId), money(t.amount), t.phone))
  const total = filtered.reduce((sum, t) => sum + t.amount, 0)

  let left = limit
  const days = byDay(filtered).flatMap((d) => {
    if (left <= 0) return []
    const items = d.items.slice(0, left)
    left -= items.length
    return [{ ...d, items }]
  })

  const set = (patch: Partial<typeof f>) => {
    setTxFilters({ ...f, ...patch })
    setLimit(50)
    setOpenRow(null)
  }
  const groupChip = f.groupId && f.groupId !== 'noref'
  const unit = useType === 'organisation' ? 'period' : 'service'

  return (
    <>
      <AppBar title="Transactions" />
      <Body>
        <SearchField label="Search payments" value={f.query} onChange={(q) => set({ query: q })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={s.chipsInner} accessibilityLabel="Filters">
          <Chip selected={f.thisService} onPress={() => set({ thisService: !f.thisService })}>
            This {unit}
          </Chip>
          <Chip selected={!!groupChip} caret onPress={() => setGroupSheet(true)}>
            {groupChip ? groupName(f.groupId!) : 'All groups'}
          </Chip>
          <Chip selected={f.groupId === 'noref'} onPress={() => set({ groupId: f.groupId === 'noref' ? null : 'noref' })}>
            No reference
          </Chip>
        </ScrollView>
        <View style={s.meta}>
          <T v="sec" tone="fg2" numberOfLines={1} style={{ flex: 1 }}>
            {f.thisService ? `${service.title}, ${service.dateLabel}` : `All ${unit}s`}
          </T>
          {loading ? (
            <Skel h={12} w={64} />
          ) : (
            <T v="sec" tone="fg2" num>
              {plural(filtered.length, 'payment')}
            </T>
          )}
        </View>

        {loading ? (
          <View>
            <View style={{ height: 44, justifyContent: 'flex-end', paddingBottom: 8 }}>
              <Skel h={12} w={160} />
            </View>
            <Surface>
              <SkeletonRows n={8} />
            </Surface>
          </View>
        ) : filtered.length === 0 ? (
          <Surface style={{ marginTop: 12 }}>
            {txs.length === 0 ? (
              <EmptyState icon={ReceiptIcon} title="No payments yet" body="Received MoMo payments show up here." action="Scan messages again" onAction={() => push({ name: 'rescan' })} />
            ) : (
              <EmptyState
                icon={FunnelIcon}
                title="No payments match your filters"
                body="Try a wider period or clear filters."
                action="Clear all filters"
                onAction={() => set({ thisService: false, groupId: null, query: '' })}
              />
            )}
          </Surface>
        ) : (
          <>
            {days.map((d) => (
              <View key={d.date}>
                <DayHeader date={d.date} total={d.total} />
                <Surface>
                  <Divided>
                    {d.items.map((t) => (
                      <SwipeRow
                        key={t.id}
                        tx={t}
                        sub={`${t.time} · ${groupName(t.groupId)}`}
                        open={openRow === t.id}
                        reduced={motion === 'reduced'}
                        onOpen={() => setOpenRow(t.id)}
                        onClose={() => setOpenRow(null)}
                        onTap={() => push({ name: 'tx', id: t.id })}
                        onAction={() => {
                          setOpenRow(null)
                          setChange(t.id)
                        }}
                      />
                    ))}
                  </Divided>
                </Surface>
              </View>
            ))}
            <View style={[s.meta, { marginTop: 16 }]}>
              <T v="sec" tone="fg2" num>
                Showing {Math.min(limit, filtered.length)} of {filtered.length}
              </T>
              <T v="sec" tone="fg2" num>
                {money(total)}
              </T>
            </View>
            {filtered.length > limit && (
              <Button variant="secondary" full style={{ marginTop: 12 }} onPress={() => setLimit(limit + 50)}>
                Show more payments
              </Button>
            )}
          </>
        )}
      </Body>

      <ChangeGroupSheet txId={change} onClose={() => setChange(null)} />
      <Sheet open={groupSheet} onClose={() => setGroupSheet(false)} title="Filter by group">
        <Surface>
          <View accessibilityRole="radiogroup" accessibilityLabel="Group">
            <Divided>
              <RadioRow
                label="All groups"
                checked={!f.groupId}
                onSelect={() => {
                  set({ groupId: null })
                  setGroupSheet(false)
                }}
              />
              {[...groups]
                .sort((a, b) => Number(!!a.system) - Number(!!b.system) || a.name.localeCompare(b.name))
                .map((g) => (
                  <RadioRow
                    key={g.id}
                    label={g.name}
                    sub={g.system ? 'System group' : undefined}
                    checked={f.groupId === g.id}
                    onSelect={() => {
                      set({ groupId: g.id })
                      setGroupSheet(false)
                    }}
                  />
                ))}
            </Divided>
          </View>
        </Surface>
      </Sheet>
    </>
  )
}

export function TxDetail({ id }: { id: string }) {
  const s = useStyles()
  const { c } = useTheme()
  const { allTxs, groupName, back, serviceOfTx, serviceInfo, codes, useType } = useApp()
  const [change, setChange] = useState(false)
  const t = allTxs.find((x) => x.id === id)
  if (!t) {
    return (
      <>
        <AppBar title="Payment" onBack={back} />
        <EmptyState icon={ReceiptIcon} title="Payment not found" body="It may have been removed when data was erased." action="Go back" onAction={back} />
      </>
    )
  }
  const sid = serviceOfTx(t)
  const svc = sid ? serviceInfo(sid) : null
  const ref = t.reference?.trim() ?? ''
  const unit = useType === 'organisation' ? 'period' : 'service'

  return (
    <>
      <AppBar title="Payment" onBack={back} />
      <Body>
        <View style={{ paddingTop: 8 }}>
          <T v="big" w="semibold" num>
            {money(t.amount)}
          </T>
          <T w="medium" style={{ marginTop: 4 }}>
            {t.sender}
          </T>
          <T v="sec" tone="fg2">
            {longDate(t.date)} at {t.time}
          </T>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Group: ${groupName(t.groupId)}. Change group`}
          onPress={() => setChange(true)}
          style={({ pressed }) => [s.groupBtn, pressed && { backgroundColor: c.inset }]}
        >
          <View style={{ flex: 1 }}>
            <T v="sec" tone="fg2">
              Group
            </T>
            <T numberOfLines={1}>{groupName(t.groupId)}</T>
          </View>
          <CaretRightIcon size={20} color={c.fg2} />
        </Pressable>

        <View style={{ marginTop: 24 }}>
          <SectionLabel>Payment</SectionLabel>
          <Surface style={s.card}>
            {t.reference ? (
              <Field label="Reference" helper={isCode(t.reference) ? 'The giver typed a number. Reference codes say what it means.' : undefined}>
                {isCode(t.reference) ? (codes[ref] ? `${t.reference}, counted as ${groupName(codes[ref])}` : `${t.reference}, not named yet`) : t.reference}
              </Field>
            ) : (
              <Field label="Reference" helper="The giver did not type a note.">
                No reference
              </Field>
            )}
            <Field label={unit === 'period' ? 'Period' : 'Service'}>{svc ? `${svc.title}, ${svc.dateLabel}` : `Outside any ${unit}`}</Field>
          </Surface>
        </View>

        <View style={{ marginTop: 24 }}>
          <SectionLabel>Sender</SectionLabel>
          <Surface style={s.card}>
            <Field label="Name">{t.sender}</Field>
            <Field label="Phone number">
              <T num>{t.phone}</T>
            </Field>
          </Surface>
        </View>

        <View style={{ marginTop: 24 }}>
          <Expandable title="More details" sub="Transaction ID, fee and original message">
            <View style={{ gap: 16, paddingTop: 4 }}>
              <Field label="Transaction ID">
                <T num selectable>
                  {t.txId}
                </T>
              </Field>
              <Field label="Fee">
                <T num>{money(t.fee)}</T>
              </Field>
              <View>
                <T v="sec" tone="fg2">
                  Original message
                </T>
                <View style={s.raw}>
                  <T v="sec" selectable>
                    {t.raw}
                  </T>
                </View>
              </View>
            </View>
          </Expandable>
        </View>
      </Body>
      <ChangeGroupSheet txId={change ? id : null} onClose={() => setChange(false)} />
    </>
  )
}

const useStyles = makeStyles((c) => ({
  chips: { marginHorizontal: -16, marginTop: 4 },
  chipsInner: { paddingHorizontal: 16, gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  swipe: { overflow: 'hidden' },
  swipeAction: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: ACTION_W,
    backgroundColor: c.inset,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  swipeFront: { backgroundColor: c.surface },
  groupBtn: {
    marginTop: 24,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: c.stroke,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  card: { padding: 16, gap: 16 },
  raw: { marginTop: 4, borderRadius: RADIUS.lg, backgroundColor: c.inset, padding: 12 },
}))
