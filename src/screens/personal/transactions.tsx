import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { useApp } from '../../lib/store'
import { CLEAR_PFILTERS, type PFilters } from '../../lib/personal'
import { KIND_LABEL } from '../../lib/personal-data'
import { longDate, money, plural } from '../../lib/format'
import { RADIUS, makeStyles, useTheme } from '../../theme'
import { AppBar, Button, Chip, Divided, EmptyState, Expandable, Field, RadioRow, SearchField, SectionLabel, Skel, SkeletonRows, Surface, T } from '../../ui/kit'
import { CaretRightIcon, FunnelIcon, ReceiptIcon, UsersIcon } from '../../ui/icons'
import { Body } from '../../ui/layout'
import { Sheet } from '../../ui/overlays'
import { matches } from '../shared'
import { CategorySheet, PDayHeader, PTxRow, PeriodSheet, pByDay, signed } from './shared'

const PAGE = 50

/** The searchable list: search, In / Out, category, person, Uncategorised. */
export function PersonalTransactions() {
  const s = useStyles()
  const { demo, pTxs, pTxsIn, periodId, period, pFilters: f, setPFilters, categories, categoryName, personName, people, push } = useApp()
  const [limit, setLimit] = useState(PAGE)
  const [catSheet, setCatSheet] = useState(false)
  const [periodSheet, setPeriodSheet] = useState(false)
  const loading = demo === 'loading'

  const base = f.inPeriod ? pTxsIn(periodId) : pTxs
  const filtered = base.filter(
    (t) =>
      (!f.dir || t.direction === f.dir) &&
      (!f.categoryId || (f.categoryId === 'none' ? !t.categoryId : t.categoryId === f.categoryId)) &&
      (!f.personKey || t.personKey === f.personKey) &&
      matches(f.query, t.name, people.get(t.personKey)?.nickname, t.phone, t.reference, money(t.amount), t.amount.toFixed(2), categoryName(t.categoryId), t.raw),
  )

  let left = limit
  const days = pByDay(filtered).flatMap((d) => {
    if (left <= 0) return []
    const items = d.items.slice(0, left)
    left -= items.length
    return [{ ...d, items }]
  })

  const set = (patch: Partial<PFilters>) => {
    setPFilters({ ...f, ...patch })
    setLimit(PAGE)
  }
  const catChip = f.categoryId && f.categoryId !== 'none'

  return (
    <>
      <AppBar title="Transactions" />
      <Body>
        <SearchField label="Search name, amount or note" value={f.query} onChange={(q) => set({ query: q })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={s.chipsInner} accessibilityLabel="Filters">
          <Chip selected={f.inPeriod} caret onPress={() => setPeriodSheet(true)}>
            {period.title}
          </Chip>
          <Chip selected={!f.inPeriod} onPress={() => set({ inPeriod: !f.inPeriod })}>
            All dates
          </Chip>
          <Chip selected={f.dir === 'in'} onPress={() => set({ dir: f.dir === 'in' ? null : 'in' })}>
            Money in
          </Chip>
          <Chip selected={f.dir === 'out'} onPress={() => set({ dir: f.dir === 'out' ? null : 'out' })}>
            Money out
          </Chip>
          <Chip selected={!!catChip} caret onPress={() => setCatSheet(true)}>
            {catChip ? categoryName(f.categoryId) : 'All categories'}
          </Chip>
          <Chip selected={f.categoryId === 'none'} onPress={() => set({ categoryId: f.categoryId === 'none' ? null : 'none' })}>
            Uncategorised
          </Chip>
          {f.personKey && (
            <Chip selected onPress={() => set({ personKey: null })}>
              {personName(f.personKey)} ✕
            </Chip>
          )}
        </ScrollView>
        <View style={s.meta}>
          <T v="sec" tone="fg2" numberOfLines={1} style={{ flex: 1 }}>
            {f.inPeriod ? `${period.title}, ${period.label}` : 'All dates'}
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
            {pTxs.length === 0 ? (
              <EmptyState icon={ReceiptIcon} title="No payments yet" body="Money you send, spend and receive with MoMo shows up here." action="Scan messages again" onAction={() => push({ name: 'rescan' })} />
            ) : (
              <EmptyState icon={FunnelIcon} title="No payments match your filters" body="Try a wider period or clear filters." action="Clear all filters" onAction={() => set({ ...CLEAR_PFILTERS, inPeriod: false })} />
            )}
          </Surface>
        ) : (
          <>
            {days.map((d) => (
              <View key={d.date}>
                <PDayHeader day={d} />
                <Surface>
                  <Divided>
                    {d.items.map((t) => (
                      <PTxRow key={t.id} t={t} onPress={() => push({ name: 'tx', id: t.id })} />
                    ))}
                  </Divided>
                </Surface>
              </View>
            ))}
            <View style={[s.meta, { marginTop: 16 }]}>
              <T v="sec" tone="fg2" num>
                Showing {Math.min(limit, filtered.length)} of {filtered.length}
              </T>
            </View>
            {filtered.length > limit && (
              <Button variant="secondary" full style={{ marginTop: 12 }} onPress={() => setLimit(limit + PAGE)}>
                Show more payments
              </Button>
            )}
          </>
        )}
      </Body>

      <PeriodSheet
        open={periodSheet}
        onClose={() => {
          setPeriodSheet(false)
          if (!f.inPeriod) set({ inPeriod: true })
        }}
      />
      <Sheet open={catSheet} onClose={() => setCatSheet(false)} title="Filter by category">
        <Surface>
          <View accessibilityRole="radiogroup" accessibilityLabel="Category">
            <Divided>
              <RadioRow label="All categories" checked={!f.categoryId} onSelect={() => (set({ categoryId: null }), setCatSheet(false))} />
              {categories.map((c) => (
                <RadioRow key={c.id} label={c.name} checked={f.categoryId === c.id} onSelect={() => (set({ categoryId: c.id }), setCatSheet(false))} />
              ))}
              <RadioRow label="Uncategorised" checked={f.categoryId === 'none'} onSelect={() => (set({ categoryId: 'none' }), setCatSheet(false))} />
            </Divided>
          </View>
        </Surface>
      </Sheet>
    </>
  )
}

/** Payment detail: amount, person, category, fee, note; balance and original message under More details. */
export function PersonalTxDetail({ id }: { id: string }) {
  const s = useStyles()
  const { c } = useTheme()
  const { allPTxs, back, push, personName, categoryName } = useApp()
  const [change, setChange] = useState(false)
  const t = allPTxs.find((x) => x.id === id)
  if (!t) {
    return (
      <>
        <AppBar title="Payment" onBack={back} />
        <EmptyState icon={ReceiptIcon} title="Payment not found" body="It may have been removed when data was erased." action="Go back" onAction={back} />
      </>
    )
  }
  const who = personName(t.personKey)
  const cat = categoryName(t.categoryId)
  const how =
    t.catSource === 'person' ? `Set by your rule for ${who}.` : t.catSource === 'word' ? 'Set by a word rule.' : t.catSource === 'type' ? `Set from the payment type.` : t.catSource === 'manual' ? 'You chose this.' : 'Choose one so this payment counts in your totals.'

  return (
    <>
      <AppBar title="Payment" onBack={back} />
      <Body>
        <View style={{ paddingTop: 8 }}>
          <T v="big" w="semibold" num tone={t.direction === 'in' ? 'accent' : 'fg'}>
            {signed(t)}
          </T>
          <T w="medium" style={{ marginTop: 4 }}>
            {KIND_LABEL[t.kind]} {t.direction === 'in' ? 'from' : 'to'} {who}
          </T>
          <T v="sec" tone="fg2">
            {longDate(t.date)} at {t.time}
          </T>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Category: ${cat}. Change category`}
          onPress={() => setChange(true)}
          style={({ pressed }) => [s.pick, !t.categoryId && { borderColor: c.accent }, pressed && { backgroundColor: c.inset }]}
        >
          <View style={{ flex: 1 }}>
            <T v="sec" tone="fg2">
              Category
            </T>
            <T numberOfLines={1} tone={t.categoryId ? 'fg' : 'accent'} w={t.categoryId ? 'regular' : 'medium'}>
              {t.categoryId ? cat : 'Choose a category'}
            </T>
            <T v="meta" tone="fg2">
              {how}
            </T>
          </View>
          <CaretRightIcon size={20} color={c.fg2} />
        </Pressable>

        <View style={{ marginTop: 24 }}>
          <SectionLabel>Payment</SectionLabel>
          <Surface style={s.card}>
            <Field label="Fee">
              <T num>{money(t.fee)}</T>
            </Field>
            <Field label="Note" helper={t.reference ? 'The reference typed with the payment.' : undefined}>
              {t.reference ?? 'No note'}
            </Field>
          </Surface>
        </View>

        <View style={{ marginTop: 24 }}>
          <SectionLabel>{t.phone && t.kind !== 'airtime' ? 'Person' : 'Paid to'}</SectionLabel>
          <Surface divided>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`See all with ${who}`}
              onPress={() => push({ name: 'person', id: t.personKey })}
              style={({ pressed }) => [s.personRow, pressed && { backgroundColor: c.inset }]}
            >
              <UsersIcon size={20} color={c.fg2} />
              <View style={{ flex: 1 }}>
                <T numberOfLines={1}>{who}</T>
                {t.phone && (
                  <T v="sec" tone="fg2" num>
                    {t.phone}
                  </T>
                )}
              </View>
              <T v="sec" w="medium" tone="accent">
                See all
              </T>
            </Pressable>
          </Surface>
        </View>

        <View style={{ marginTop: 24 }}>
          <Expandable title="More details" sub="Balance after this payment, transaction ID and original message">
            <View style={{ gap: 16, paddingTop: 4 }}>
              <Field label="Balance after this payment" helper="As written in the message. The app never works out a balance itself.">
                <T num>{t.balance == null ? 'Not in the message' : money(t.balance)}</T>
              </Field>
              <Field label="Transaction ID">
                <T num selectable>
                  {t.txId}
                </T>
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
      <CategorySheet txId={change ? id : null} onClose={() => setChange(false)} />
    </>
  )
}

const useStyles = makeStyles((c) => ({
  chips: { marginHorizontal: -16, marginTop: 4 },
  chipsInner: { paddingHorizontal: 16, gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  pick: {
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
  personRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  card: { padding: 16, gap: 16 },
  raw: { marginTop: 4, borderRadius: RADIUS.lg, backgroundColor: c.inset, padding: 12 },
}))
