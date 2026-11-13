import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useApp } from '../../lib/store'
import { totalsOf } from '../../lib/personal'
import { money, plural } from '../../lib/format'
import { makeStyles, useTheme } from '../../theme'
import { AppBar, Button, Divided, EmptyState, IconButton, Row, SectionLabel, SkeletonRows, Surface, T, TextField } from '../../ui/kit'
import { CaretDownIcon, CaretUpIcon, EyeIcon, EyeSlashIcon, GearSixIcon, PencilSimpleIcon, PlusIcon, TagIcon, TrashIcon } from '../../ui/icons'
import { Body } from '../../ui/layout'
import { Sheet } from '../../ui/overlays'
import { PDayHeader, PTxRow, PeriodSheet, pByDay } from './shared'

/** Categories tab: each category with its total in the period. */
export function Categories() {
  const s = useStyles()
  const { c } = useTheme()
  const { demo, period, periodId, pTxsIn, categories, push, setTab, setPFilters } = useApp()
  const [picker, setPicker] = useState(false)
  const list = pTxsIn(periodId)
  const uncategorised = list.filter((t) => !t.categoryId)
  const rows = categories
    .map((cat) => ({ cat, tot: totalsOf(list.filter((t) => t.categoryId === cat.id)) }))
    .sort((a, b) => (b.tot.count > 0 ? 1 : 0) - (a.tot.count > 0 ? 1 : 0) || b.tot.moneyOut - a.tot.moneyOut || b.tot.moneyIn - a.tot.moneyIn)

  return (
    <>
      <AppBar title="Categories" actions={<IconButton label="Manage categories" icon={GearSixIcon} onPress={() => push({ name: 'manage-categories' })} tipAlign="end" />} />
      <Body>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Period: ${period.title}, ${period.label}. Change period`}
          onPress={() => setPicker(true)}
          style={({ pressed }) => [s.period, pressed && { backgroundColor: c.inset }]}
        >
          <T v="sec" tone="fg2" style={{ flex: 1 }} numberOfLines={1}>
            {period.title}, {period.label}
          </T>
          <CaretDownIcon size={20} color={c.fg2} />
        </Pressable>

        {demo === 'loading' ? (
          <Surface>
            <SkeletonRows n={8} />
          </Surface>
        ) : (
          <View style={{ gap: 24 }}>
            {uncategorised.length > 0 && (
              <Surface>
                <Row
                  leading={<TagIcon size={20} color={c.accent} />}
                  title="Uncategorised"
                  titleWeight="medium"
                  sub={`${plural(uncategorised.length, 'payment')} need a category`}
                  end={money(totalsOf(uncategorised).moneyOut)}
                  onPress={() => {
                    setPFilters({ inPeriod: true, dir: null, categoryId: 'none', personKey: null, query: '' })
                    setTab('transactions')
                  }}
                />
              </Surface>
            )}
            <Surface>
              <Divided>
                {rows.map(({ cat, tot }) => (
                  <Row
                    key={cat.id}
                    title={cat.name}
                    sub={tot.count ? plural(tot.count, 'payment') : 'Nothing in this period'}
                    end={tot.moneyOut > 0 || tot.moneyIn === 0 ? money(tot.moneyOut) : `+${money(tot.moneyIn)}`}
                    endTone={tot.count ? (tot.moneyOut > 0 || tot.moneyIn === 0 ? 'fg' : 'accent') : 'fg3'}
                    onPress={() => push({ name: 'category', id: cat.id })}
                  />
                ))}
              </Divided>
            </Surface>
          </View>
        )}
      </Body>
      <PeriodSheet open={picker} onClose={() => setPicker(false)} />
    </>
  )
}

/** One category's payments in the period. */
export function CategoryDetail({ id }: { id: string }) {
  const { allCategories, period, periodId, pTxsIn, back, push } = useApp()
  const cat = allCategories.find((c) => c.id === id)
  const [picker, setPicker] = useState(false)
  if (!cat) {
    return (
      <>
        <AppBar title="Category" onBack={back} />
        <EmptyState icon={TagIcon} title="Category not found" body="It may have been removed." action="Go back" onAction={back} />
      </>
    )
  }
  const list = pTxsIn(periodId).filter((t) => t.categoryId === id)
  const tot = totalsOf(list)
  return (
    <>
      <AppBar title={cat.name} onBack={back} />
      <Body>
        <Pressable accessibilityRole="button" onPress={() => setPicker(true)} style={{ paddingVertical: 8 }}>
          <T v="sec" tone="fg2">
            {period.title}, {period.label} · Change
          </T>
        </Pressable>
        <T v="big" w="semibold" num>
          {money(tot.moneyOut || tot.moneyIn)}
        </T>
        <T v="sec" tone="fg2" num>
          {tot.moneyOut ? 'Money out' : 'Money in'} · {plural(tot.count, 'payment')}
          {tot.moneyOut && tot.moneyIn ? ` · +${money(tot.moneyIn)} in` : ''}
        </T>
        {list.length === 0 ? (
          <Surface style={{ marginTop: 16 }}>
            <EmptyState icon={TagIcon} title={`Nothing in ${cat.name}`} body="Payments in this category for the period show up here." action="Choose another period" onAction={() => setPicker(true)} />
          </Surface>
        ) : (
          pByDay(list).map((d) => (
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
          ))
        )}
      </Body>
      <PeriodSheet open={picker} onClose={() => setPicker(false)} />
    </>
  )
}

/** Add, rename, hide and order categories. See and remove the rules the user confirmed. */
export function ManageCategories() {
  const s = useStyles()
  const { allCategories, rules, categoryName, back, moveCategory, setCategoryHidden, deleteRule, addCategory, renameCategory, findCategoryByName } = useApp()
  const [editing, setEditing] = useState<string | 'new' | null>(null)

  return (
    <>
      <AppBar title="Manage categories" onBack={back} />
      <Body padBottom={32}>
        <View style={{ gap: 24 }}>
          <View>
            <SectionLabel>Categories</SectionLabel>
            <Surface>
              <Divided>
                {allCategories.map((cat, i) => (
                  <View key={cat.id} style={s.manageRow}>
                    <View style={{ flex: 1 }}>
                      <T numberOfLines={1} tone={cat.hidden ? 'fg3' : 'fg'}>
                        {cat.name}
                      </T>
                      {cat.hidden && (
                        <T v="meta" tone="fg3">
                          Hidden
                        </T>
                      )}
                    </View>
                    <IconButton label={`Rename ${cat.name}`} icon={PencilSimpleIcon} size={20} onPress={() => setEditing(cat.id)} />
                    <IconButton
                      label={cat.hidden ? `Show ${cat.name}` : `Hide ${cat.name}`}
                      icon={cat.hidden ? EyeIcon : EyeSlashIcon}
                      size={20}
                      onPress={() => setCategoryHidden(cat.id, !cat.hidden)}
                    />
                    <IconButton label={`Move ${cat.name} up`} icon={CaretUpIcon} size={20} disabled={i === 0} onPress={() => moveCategory(cat.id, -1)} />
                    <IconButton
                      label={`Move ${cat.name} down`}
                      icon={CaretDownIcon}
                      size={20}
                      disabled={i === allCategories.length - 1}
                      onPress={() => moveCategory(cat.id, 1)}
                      tipAlign="end"
                    />
                  </View>
                ))}
              </Divided>
            </Surface>
            <Button variant="text" icon={PlusIcon} style={{ marginTop: 8, marginLeft: -12, alignSelf: 'flex-start' }} onPress={() => setEditing('new')}>
              Add category
            </Button>
          </View>

          <View>
            <SectionLabel>Rules</SectionLabel>
            <T v="sec" tone="fg2" style={{ marginBottom: 12 }}>
              A rule is made only when you tap Move them after choosing a category. New payments that match go straight to that category.
            </T>
            <Surface>
              {rules.length === 0 ? (
                <Row title="No rules yet" sub="Put a payment in a category to start one." />
              ) : (
                <Divided>
                  {rules.map((r) => (
                    <Row
                      key={r.id}
                      title={r.kind === 'person' ? r.label : `Note or shop has “${r.label}”`}
                      sub={`Goes to ${categoryName(r.categoryId)}`}
                      trailing={<IconButton label={`Remove rule for ${r.label}`} icon={TrashIcon} size={20} onPress={() => deleteRule(r.id)} tipAlign="end" />}
                    />
                  ))}
                </Divided>
              )}
            </Surface>
            <T v="meta" tone="fg2" style={{ marginTop: 8 }}>
              Built in: airtime and data go to Airtime and data, bills to Bills, cash out to Cash withdrawals.
            </T>
          </View>
        </View>
      </Body>
      <NameSheet
        open={editing !== null}
        initial={editing && editing !== 'new' ? (allCategories.find((x) => x.id === editing)?.name ?? '') : ''}
        title={editing === 'new' ? 'Add category' : 'Rename category'}
        onClose={() => setEditing(null)}
        onSave={(name) => {
          const clash = findCategoryByName(name)
          if (clash && clash.id !== editing) return `${clash.name} already exists.`
          if (editing === 'new') addCategory(name)
          else if (editing) renameCategory(editing, name)
          setEditing(null)
          return null
        }}
      />
    </>
  )
}

function NameSheet({
  open,
  initial,
  title,
  onClose,
  onSave,
}: {
  open: boolean
  initial: string
  title: string
  onClose: () => void
  onSave: (name: string) => string | null
}) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setValue(initial)
      setError(null)
    }
  }, [open, initial])
  const save = () => {
    if (!value.trim()) return setError('Enter a category name.')
    setError(onSave(value.trim()))
  }
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <TextField label="Category name" value={value} onChange={setValue} error={error} onFocus={() => setError(null)} onSubmitEditing={save} returnKeyType="done" autoComplete="off" />
      <Button full style={{ marginTop: 16 }} onPress={save}>
        Save
      </Button>
    </Sheet>
  )
}

const useStyles = makeStyles(() => ({
  period: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  manageRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 16, paddingRight: 4 },
}))
