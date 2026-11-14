import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useApp } from '../../lib/store'
import { totalsOf } from '../../lib/personal'
import { money, plural } from '../../lib/format'
import { BRAND, RADIUS, makeStyles, useTheme } from '../../theme'
import { AppBar, Button, EmptyState, ErrorBox, IconButton, Row, SectionTitle, Skel, SkeletonRows, Surface, T, Lockup } from '../../ui/kit'
import { CaretDownIcon, CaretRightIcon, ChatSlashIcon, CheckCircleIcon, GearSixIcon, ReceiptIcon, TagIcon, type Icon } from '../../ui/icons'
import { Body, BrandGradient } from '../../ui/layout'
import { useCoachTarget } from '../../ui/overlays'
import { PeriodSheet } from './shared'

const MAX_BARS = 6

/** Personal Home: period, money in and out with fees (no balance), spending by category, needs attention. */
export function PersonalHome() {
  const s = useStyles()
  const { c } = useTheme()
  const { demo, period, pTxsIn, periodId, unread, push, setTab, setPFilters, categoryName, pTxs } = useApp()
  const [picker, setPicker] = useState(false)
  const periodTarget = useCoachTarget('service')
  const reviewTarget = useCoachTarget('review')
  const list = pTxsIn(periodId)
  const tot = totalsOf(list)
  const uncategorised = list.filter((t) => !t.categoryId).length
  const attention = uncategorised + unread.length

  // Spending by category: money out only, biggest first.
  const byCat = new Map<string | null, number>()
  for (const t of list) if (t.direction === 'out') byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount)
  const bars = [...byCat.entries()].sort((a, b) => b[1] - a[1])
  const shown = bars.slice(0, MAX_BARS)
  const max = shown[0]?.[1] ?? 0

  const openCategory = (id: string | null) => {
    if (id) push({ name: 'category', id })
    else {
      setPFilters({ inPeriod: true, dir: null, categoryId: 'none', personKey: null, query: '' })
      setTab('transactions')
    }
  }

  return (
    <>
      <AppBar title={<Lockup />} actions={<IconButton label="Settings" icon={GearSixIcon} onPress={() => push({ name: 'settings' })} tipAlign="end" />} />
      <Body>
        {demo === 'loading' ? (
          <HomeSkeleton />
        ) : (
          <View style={s.stack}>
            <View {...periodTarget}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Period: ${period.title}, ${period.label}. Change period`}
              onPress={() => setPicker(true)}
              style={({ pressed }) => [s.period, pressed && { backgroundColor: c.inset }]}
            >
              <View style={{ flex: 1 }}>
                <T v="sec" tone="fg2" numberOfLines={1}>
                  {period.title}
                </T>
                <T w="medium" numberOfLines={1}>
                  {period.label}
                </T>
              </View>
              <CaretDownIcon size={20} color={c.fg2} />
            </Pressable>
            </View>

            {demo === 'error' && <ErrorBox>We couldn't read new messages. Your saved payments are all here.</ErrorBox>}

            <BrandGradient rounded style={s.totalCard}>
              <View accessibilityLabel={`Money in ${money(tot.moneyIn)}. Money out ${money(tot.moneyOut)}. Fees paid ${money(tot.fees)}. ${plural(tot.count, 'payment')}`}>
                <View style={s.inOut}>
                  <View style={{ flex: 1 }}>
                    <T v="sec" color={BRAND.onBrand80}>
                      Money in
                    </T>
                    <T v="title" w="semibold" num color={BRAND.onBrand} style={{ marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
                      {money(tot.moneyIn)}
                    </T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="sec" color={BRAND.onBrand80}>
                      Money out
                    </T>
                    <T v="title" w="semibold" num color={BRAND.onBrand} style={{ marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
                      {money(tot.moneyOut)}
                    </T>
                  </View>
                </View>
                <View style={s.goldRule} />
                <View style={s.between}>
                  <T v="sec" num color={BRAND.onBrand}>
                    Fees paid {money(tot.fees)}
                  </T>
                  <T v="sec" num color={BRAND.onBrand80}>
                    {plural(tot.count, 'payment')}
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
                  {uncategorised > 0 && <Reason icon={TagIcon} text={`${plural(uncategorised, 'payment')} to categorise`} />}
                  {unread.length > 0 && <Reason icon={ChatSlashIcon} text={`${plural(unread.length, 'message')} not read`} />}
                </View>
                <Button
                  full
                  style={{ marginTop: 16 }}
                  onPress={() => (uncategorised > 0 ? openCategory(null) : push({ name: 'review', tab: 'unread' }))}
                >
                  {uncategorised > 0 ? 'Categorise now' : 'Check messages'}
                </Button>
              </View>
            ) : (
              <Surface>
                <Row leading={<CheckCircleIcon size={20} color={c.gold} />} title="Everything is sorted" sub="Every payment in this period has a category." />
              </Surface>
            )}

            <View>
              <SectionTitle>Spending by category</SectionTitle>
              <Surface>
                {shown.length === 0 ? (
                  pTxs.length === 0 ? (
                    <EmptyState
                      icon={ReceiptIcon}
                      title="No payments yet"
                      body="Money you send, spend and receive with MoMo shows up here."
                      action="Scan messages again"
                      onAction={() => push({ name: 'rescan' })}
                    />
                  ) : (
                    <EmptyState icon={ReceiptIcon} title="No spending in this period" body="Money you send or spend shows up here." action="Choose another period" onAction={() => setPicker(true)} />
                  )
                ) : (
                  <View style={{ paddingVertical: 8 }}>
                    {shown.map(([id, amount]) => (
                      <Pressable
                        key={id ?? 'none'}
                        accessibilityRole="button"
                        accessibilityLabel={`${categoryName(id)}, ${money(amount)}`}
                        onPress={() => openCategory(id)}
                        style={({ pressed }) => [s.bar, pressed && { backgroundColor: c.inset }]}
                      >
                        <View style={s.between}>
                          <T numberOfLines={1} style={{ flex: 1 }} tone={id ? 'fg' : 'fg2'}>
                            {categoryName(id)}
                          </T>
                          <T num>{money(amount)}</T>
                        </View>
                        <View style={s.track}>
                          <View style={[s.fill, { width: `${Math.max(2, (amount / max) * 100)}%`, backgroundColor: id ? c.accent : c.fg3 }]} />
                        </View>
                      </Pressable>
                    ))}
                    <Row
                      title={bars.length > MAX_BARS ? `All ${bars.length} categories` : 'View categories'}
                      titleTone="accent"
                      titleWeight="medium"
                      trailing={<CaretRightIcon size={20} color={c.accent} />}
                      onPress={() => setTab('categories')}
                    />
                  </View>
                )}
              </Surface>
            </View>
          </View>
        )}
      </Body>
      <PeriodSheet open={picker} onClose={() => setPicker(false)} />
    </>
  )
}

function Reason({ icon: I, text }: { icon: Icon; text: string }) {
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
      <Surface>
        <SkeletonRows n={5} />
      </Surface>
    </View>
  )
}

const useStyles = makeStyles((c) => ({
  stack: { gap: 24 },
  period: {
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
  inOut: { flexDirection: 'row', gap: 16 },
  goldRule: { height: 1, width: 48, backgroundColor: BRAND.gold, marginVertical: 12 },
  between: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  decision: { borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.decision, padding: 20 },
  bar: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  track: { height: 8, borderRadius: RADIUS.full, backgroundColor: c.inset, overflow: 'hidden' },
  fill: { height: 8, borderRadius: RADIUS.full },
}))
