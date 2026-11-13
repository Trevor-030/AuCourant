import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { statsOf, useApp } from '../lib/store'
import { money, plural } from '../lib/format'
import { BRAND, RADIUS, makeStyles, useTheme } from '../theme'
import { AppBar, Button, Divided, EmptyState, IconButton, Row, SectionTitle, Skel, SkeletonRows, Surface, T, Wordmark } from '../ui/kit'
import { CaretDownIcon, CaretRightIcon, ChatSlashIcon, CheckCircleIcon, GearSixIcon, GitMergeIcon, HashIcon, ReceiptIcon } from '../ui/icons'
import { Body, BrandGradient } from '../ui/layout'
import { useCoachTarget } from '../ui/overlays'
import { ServicePickerSheet } from './services'

export function Home() {
  const s = useStyles()
  const { c } = useTheme()
  const { demo, service, txsIn, suggestions, unread, pendingCodes, groups, push, setTab } = useApp()
  const [picker, setPicker] = useState(false)
  const serviceTarget = useCoachTarget('service')
  const reviewTarget = useCoachTarget('review')
  const loading = demo === 'loading'
  const list = txsIn(service.id)
  const total = statsOf(list)
  const last = list.reduce<string | null>((m, t) => (!m || t.time > m ? t.time : m), null)
  const top = groups
    .map((g) => ({ g, s: statsOf(list.filter((t) => t.groupId === g.id)) }))
    .filter((x) => x.s.count > 0)
    .sort((a, b) => b.s.total - a.s.total)
    .slice(0, 5)
  const attention = suggestions.length + pendingCodes.length + unread.length

  return (
    <>
      <AppBar title={<Wordmark />} actions={<IconButton label="Settings" icon={GearSixIcon} onPress={() => push({ name: 'settings' })} tipAlign="end" />} />
      <Body>
        {loading ? (
          <HomeSkeleton />
        ) : (
          <View style={s.stack}>
            <View {...serviceTarget}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Service: ${service.title}, ${service.dateLabel}. Change service`}
                onPress={() => setPicker(true)}
                style={({ pressed }) => [s.service, pressed && { backgroundColor: c.inset }]}
              >
                <View style={{ flex: 1 }}>
                  <T v="sec" tone="fg2" numberOfLines={1}>
                    {service.title}
                  </T>
                  <T w="medium" numberOfLines={1}>
                    {service.dateLabel}
                  </T>
                </View>
                <CaretDownIcon size={20} color={c.fg2} />
              </Pressable>
            </View>

            <BrandGradient rounded style={s.totalCard}>
              <View accessibilityLabel={`Total received ${money(total.total)}, ${plural(total.count, 'payment')}`}>
                <T v="sec" color={BRAND.onBrand80}>
                  Total received
                </T>
                <T v="big" w="semibold" num color={BRAND.onBrand} style={{ marginTop: 4 }}>
                  {money(total.total)}
                </T>
                <View style={s.goldRule} />
                <View style={s.between}>
                  <T v="sec" num color={BRAND.onBrand}>
                    {plural(total.count, 'payment')}
                  </T>
                  <T v="sec" num color={BRAND.onBrand80}>
                    {last ? `Last at ${last}` : 'Nothing received yet'}
                  </T>
                </View>
              </View>
            </BrandGradient>

            {attention > 0 ? (
              <View {...reviewTarget} style={s.decision} accessibilityLabel="Needs attention">
                <T v="section" w="semibold" tone="onDecision">
                  {attention} {attention === 1 ? 'needs' : 'need'} a decision
                </T>
                <View style={{ marginTop: 12, gap: 8 }}>
                  {suggestions.length > 0 && <Reason icon={GitMergeIcon} text={plural(suggestions.length, 'suggested merge')} />}
                  {pendingCodes.length > 0 && <Reason icon={HashIcon} text={`${plural(pendingCodes.length, 'code')} to name`} />}
                  {unread.length > 0 && <Reason icon={ChatSlashIcon} text={`${plural(unread.length, 'message')} not read`} />}
                </View>
                <Button full style={{ marginTop: 16 }} onPress={() => push({ name: 'review' })}>
                  Review now
                </Button>
              </View>
            ) : (
              <Surface>
                <Row
                  leading={<CheckCircleIcon size={20} color={c.gold} />}
                  title="Everything is sorted"
                  sub="No merges, codes or messages to check."
                />
              </Surface>
            )}

            <View>
              <SectionTitle>Top groups</SectionTitle>
              <Surface>
                {top.length === 0 ? (
                  demo === 'empty' ? (
                    <EmptyState
                      icon={ReceiptIcon}
                      title="No payments yet"
                      body="Received MoMo payments show up here, sorted by reference."
                      action="Scan messages again"
                      onAction={() => push({ name: 'rescan' })}
                    />
                  ) : (
                    <EmptyState
                      icon={ReceiptIcon}
                      title="No payments in this service"
                      body="Payments received during this service show up here."
                      action="Choose another service"
                      onAction={() => setPicker(true)}
                    />
                  )
                ) : (
                  <Divided>
                    {top.map(({ g, s: st }) => (
                      <Row key={g.id} title={g.name} sub={plural(st.count, 'payment')} end={money(st.total)} onPress={() => push({ name: 'group', id: g.id })} />
                    ))}
                    <Row
                      title="View all groups"
                      titleTone="accent"
                      titleWeight="medium"
                      trailing={<CaretRightIcon size={20} color={c.accent} />}
                      onPress={() => setTab('groups')}
                    />
                  </Divided>
                )}
              </Surface>
            </View>
          </View>
        )}
      </Body>
      <ServicePickerSheet open={picker} onClose={() => setPicker(false)} />
    </>
  )
}

function Reason({ icon: I, text }: { icon: typeof GitMergeIcon; text: string }) {
  const { c } = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <I size={16} color={c.onDecision2} />
      <T v="sec" tone="onDecision2">
        {text}
      </T>
    </View>
  )
}

function HomeSkeleton() {
  const s = useStyles()
  return (
    <View style={s.stack} accessibilityLabel="Loading home" accessibilityState={{ busy: true }}>
      <View style={{ minHeight: 56, justifyContent: 'center', gap: 8 }}>
        <Skel h={12} w={96} />
        <Skel h={16} w={176} />
      </View>
      <Skel h={150} r={RADIUS.lg} />
      <Skel h={148} r={RADIUS.lg} />
      <View>
        <Skel h={20} w={112} style={{ marginBottom: 12 }} />
        <Surface>
          <SkeletonRows n={5} />
        </Surface>
      </View>
    </View>
  )
}

const useStyles = makeStyles((c) => ({
  stack: { gap: 24 },
  service: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: -8,
    marginBottom: -8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.lg,
  },
  totalCard: { padding: 20 },
  goldRule: { height: 1, width: 48, backgroundColor: BRAND.gold, marginVertical: 12 },
  between: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  decision: { borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.decision, padding: 20 },
}))
