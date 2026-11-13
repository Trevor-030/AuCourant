import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, PanResponder, Pressable, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { statsOf, useApp, type ReviewTab } from '../lib/store'
import { longDate, money, plural } from '../lib/format'
import { DURATION, RADIUS, makeStyles, useTheme } from '../theme'
import { AppBar, Button, Divided, EmptyState, Surface, T } from '../ui/kit'
import { ArrowDownIcon, ChatSlashIcon, CopyIcon, GitMergeIcon, HashIcon } from '../ui/icons'
import { Body, Footer } from '../ui/layout'
import { CodeSheet, type CodeSheetState } from './codes'

const THRESHOLD = 96

export function Review({ initialTab }: { initialTab?: ReviewTab }) {
  const s = useStyles()
  const { c } = useTheme()
  const { suggestions, unread, pendingCodes, back, setTab, skipUnread, notify, useType } = useApp()
  // Personal has no merges or codes: only messages the app could not read.
  const personal = useType === 'personal'
  const [tab, setTabState] = useState<ReviewTab>(
    personal ? 'unread' : (initialTab ?? (suggestions.length ? 'merges' : pendingCodes.length ? 'codes' : unread.length ? 'unread' : 'merges')),
  )
  const [codeSheet, setCodeSheet] = useState<CodeSheetState>(null)

  const copy = async (raw: string) => {
    try {
      await Clipboard.setStringAsync(raw)
      notify('Message copied. Paste it into a message to support.')
    } catch {
      notify("Couldn't copy the message. Long-press it to select the text.")
    }
  }

  const allTabs = [
    ['merges', `Merges (${suggestions.length})`],
    ['codes', `Codes (${pendingCodes.length})`],
    ['unread', `Not read (${unread.length})`],
  ] as const
  const tabs = personal ? allTabs.filter(([k]) => k === 'unread') : allTabs

  return (
    <>
      <AppBar title="Review" onBack={back} />
      <View accessibilityRole="tablist" style={s.tabs}>
        {tabs.map(([k, label]) => {
          const on = tab === k
          return (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setTabState(k)}
              style={({ pressed }) => [s.tab, pressed && { backgroundColor: c.inset }]}
            >
              <T v="sec" w="medium" tone={on ? 'accent' : 'fg2'}>
                {label}
              </T>
              {on && <View style={s.tabBar} />}
            </Pressable>
          )
        })}
      </View>

      {tab === 'merges' ? (
        <Merges onGoCodes={() => setTabState('codes')} onGoUnread={() => setTabState('unread')} />
      ) : tab === 'codes' ? (
        <Body style={{ paddingTop: 16 }}>
          {pendingCodes.length > 0 ? (
            <>
              <T v="sec" tone="fg2" style={{ marginBottom: 16 }}>
                Givers typed these numbers as the reference. Until you name one, its payments sit in a group called Code and the number.
              </T>
              <Surface>
                <Divided>
                  {pendingCodes.map((p) => (
                    <View key={p.code} style={s.listRow}>
                      <View style={{ flex: 1 }}>
                        <T num>{p.code}</T>
                        <T v="sec" tone="fg2" num numberOfLines={1}>
                          {plural(p.count, 'payment')} · {money(p.total)}
                        </T>
                      </View>
                      <Button variant="text" onPress={() => setCodeSheet({ mode: 'name', code: p.code })}>
                        Name this code
                      </Button>
                    </View>
                  ))}
                </Divided>
              </Surface>
            </>
          ) : (
            <Surface>
              <EmptyState icon={HashIcon} title="No codes to name" body="Numbers used as references will show up here once." action="Go to Home" onAction={() => setTab('home')} />
            </Surface>
          )}
        </Body>
      ) : (
        <Body style={{ paddingTop: 16 }}>
          {unread.length > 0 ? (
            <>
              <T v="sec" tone="fg2" style={{ marginBottom: 16 }}>
                We couldn't read this message. Copy it and send it to support so we can add it.
              </T>
              <Surface>
                <Divided>
                  {unread.map((u) => (
                    <View key={u.id} style={s.unread}>
                      <View style={s.between}>
                        <T v="meta" tone="fg3" num>
                          {longDate(u.date)}
                        </T>
                        <T v="meta" tone="fg3" num>
                          {u.time}
                        </T>
                      </View>
                      <T v="sec" tone="fg2" selectable style={{ marginTop: 4 }}>
                        {u.raw}
                      </T>
                      <View style={{ flexDirection: 'row', marginLeft: -12 }}>
                        <Button variant="text" icon={CopyIcon} onPress={() => copy(u.raw)}>
                          Copy message
                        </Button>
                        <Button variant="text" onPress={() => skipUnread(u.id)}>
                          Skip message
                        </Button>
                      </View>
                    </View>
                  ))}
                </Divided>
              </Surface>
            </>
          ) : (
            <Surface>
              <EmptyState icon={ChatSlashIcon} title="Every message was read" body="Messages the app can't understand show up here." action="Go to Home" onAction={() => setTab('home')} />
            </Surface>
          )}
        </Body>
      )}
      <CodeSheet state={codeSheet} onClose={() => setCodeSheet(null)} />
    </>
  )
}

/** One suggested merge at a time. Swipe right to merge, left to keep separate. */
function Merges({ onGoCodes, onGoUnread }: { onGoCodes: () => void; onGoUnread: () => void }) {
  const s = useStyles()
  const { c, reduced } = useTheme()
  const { suggestions, pendingCodes, unread, groupName, txs, mergeGroups, keepSeparate, setTab } = useApp()
  const [seen, setSeen] = useState(suggestions.length)
  const [leaving, setLeaving] = useState(false)
  const dx = useRef(new Animated.Value(0)).current
  const enter = useRef(new Animated.Value(1)).current
  const [dragDir, setDragDir] = useState(0)

  const totalSeen = Math.max(seen, suggestions.length)
  useEffect(() => {
    if (totalSeen !== seen) setSeen(totalSeen)
  }, [totalSeen, seen])
  const cur = suggestions[0]
  const next = suggestions[1]
  const position = totalSeen - suggestions.length + 1

  // New card: rise in.
  useEffect(() => {
    if (!cur) return
    dx.setValue(0)
    setDragDir(0)
    enter.setValue(0)
    Animated.timing(enter, { toValue: 1, duration: reduced ? DURATION.fast : DURATION.enter, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }).start()
    // Only when the card on top changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id])

  const decide = useRef<(dir: 'left' | 'right') => void>(() => {})
  decide.current = (dir) => {
    if (!cur || leaving) return
    setLeaving(true)
    const done = () => {
      if (dir === 'right') mergeGroups(cur.mergeId, cur.keepId)
      else keepSeparate(cur.id)
      setLeaving(false)
    }
    if (reduced) {
      Animated.timing(enter, { toValue: 0, duration: DURATION.fast, useNativeDriver: true }).start(done)
    } else {
      Animated.timing(dx, { toValue: dir === 'right' ? 420 : -420, duration: DURATION.enter, easing: Easing.bezier(0.7, 0, 0.84, 0), useNativeDriver: true }).start(done)
    }
  }

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        dx.setValue(g.dx)
        setDragDir(Math.sign(g.dx))
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > THRESHOLD) decide.current('right')
        else if (g.dx < -THRESHOLD) decide.current('left')
        else {
          setDragDir(0)
          Animated.timing(dx, { toValue: 0, duration: DURATION.exit, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }).start()
        }
      },
    }),
  ).current

  if (!cur) {
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Surface>
          <EmptyState icon={GitMergeIcon} title="No merges to review" body="Similar group names will be suggested here." action="Go to Home" onAction={() => setTab('home')} />
        </Surface>
        {pendingCodes.length > 0 ? (
          <Button variant="text" full style={{ marginTop: 8 }} onPress={onGoCodes}>
            {`Name ${plural(pendingCodes.length, 'code')}`}
          </Button>
        ) : unread.length > 0 ? (
          <Button variant="text" full style={{ marginTop: 8 }} onPress={onGoUnread}>
            {`Check ${plural(unread.length, 'message')} not read`}
          </Button>
        ) : null}
      </View>
    )
  }

  const block = (id: string) => {
    const st = statsOf(txs.filter((t) => t.groupId === id))
    return (
      <View>
        <T v="section" w="semibold" tone="onDecision" numberOfLines={1}>
          {groupName(id)}
        </T>
        <T v="sec" tone="onDecision2" num style={{ marginTop: 4 }}>
          {plural(st.count, 'payment')} · {money(st.total)}
        </T>
      </View>
    )
  }

  const rotate = dx.interpolate({ inputRange: [-300, 300], outputRange: ['-10deg', '10deg'] })
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 8, 0] })
  const badgeOpacity = dx.interpolate({ inputRange: [-THRESHOLD, 0, THRESHOLD], outputRange: [1, 0, 1], extrapolate: 'clamp' })

  return (
    <>
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        <View style={s.between}>
          <T v="sec" tone="fg2" num accessibilityLiveRegion="polite">
            {position} of {totalSeen}
          </T>
          <T v="sec" tone="fg2">
            Suggested merge
          </T>
        </View>
        <View style={{ height: 320, marginTop: 12 }}>
          {next && <View style={s.nextCard} />}
          <Animated.View
            accessibilityLabel={`Merge ${groupName(cur.mergeId)} into ${groupName(cur.keepId)}?`}
            style={[s.card, { opacity: enter, transform: [{ translateX: dx }, { translateY }, { rotate: reduced ? '0deg' : rotate }] }]}
            {...(reduced ? {} : pan.panHandlers)}
          >
            <T v="sec" tone="onDecision2">
              Looks like the same group
            </T>
            <View style={{ marginTop: 20 }}>{block(cur.keepId)}</View>
            <View style={s.arrow}>
              <ArrowDownIcon size={16} color={c.onDecision2} style={{ transform: [{ rotate: '180deg' }] }} />
              <T v="sec" tone="onDecision2" style={{ flex: 1 }}>
                {groupName(cur.mergeId)} would count as {groupName(cur.keepId)}
              </T>
            </View>
            {block(cur.mergeId)}
            <T v="meta" tone="onDecision2" style={{ marginTop: 'auto' }}>
              Swipe right to merge, left to keep separate.
            </T>
            {dragDir !== 0 && (
              <Animated.View
                pointerEvents="none"
                style={[s.badge, dragDir > 0 ? { right: 20, borderColor: c.accent } : { left: 20, borderColor: c.onDecision2 }, { opacity: badgeOpacity }]}
              >
                <T v="sec" w="medium" tone={dragDir > 0 ? 'accent' : 'onDecision'}>
                  {dragDir > 0 ? 'Merge' : 'Keep separate'}
                </T>
              </Animated.View>
            )}
          </Animated.View>
        </View>
      </View>
      <Footer style={{ flexDirection: 'row', gap: 8 }}>
        <Button variant="secondary" style={{ flex: 1 }} onPress={() => decide.current('left')}>
          Keep separate
        </Button>
        <Button style={{ flex: 1 }} icon={GitMergeIcon} onPress={() => decide.current('right')}>
          Confirm merge
        </Button>
      </Footer>
    </>
  )
}

const useStyles = makeStyles((c) => ({
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.stroke, paddingHorizontal: 16 },
  tab: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' },
  tabBar: { position: 'absolute', left: 12, right: 12, bottom: 0, height: 2, borderRadius: 1, backgroundColor: c.accent },
  between: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  listRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingLeft: 16, paddingRight: 4 },
  unread: { backgroundColor: c.inset, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  nextCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 8,
    bottom: -8,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: c.stroke,
    backgroundColor: c.decision,
    opacity: 0.5,
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: c.stroke,
    backgroundColor: c.decision,
    padding: 20,
  },
  arrow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 16 },
  badge: { position: 'absolute', top: 20, borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4 },
}))
