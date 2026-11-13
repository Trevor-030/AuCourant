import { Pressable, View } from 'react-native'
import { useApp, type UseType } from '../lib/store'
import { RADIUS, makeStyles, useTheme } from '../theme'
import { AppBar, Button, Radio, T } from '../ui/kit'
import { BuildingsIcon, ChurchIcon, UserIcon, type Icon } from '../ui/icons'
import { Body } from '../ui/layout'
import { Sheet } from '../ui/overlays'

const OPTIONS: { id: UseType; icon: Icon; title: string; sub: string; soon?: boolean }[] = [
  { id: 'church', icon: ChurchIcon, title: 'Church', sub: 'Sort offerings, tithes and special services.' },
  { id: 'organisation', icon: BuildingsIcon, title: 'Organisation', sub: 'Sort payments by reference for your team or group.' },
  { id: 'personal', icon: UserIcon, title: 'Personal or business', sub: "Understand your own MoMo money, or your shop's sales." },
]

export const useTypeLabel = (t: UseType) => OPTIONS.find((o) => o.id === t)!.title

/** Single-select list on one bordered surface. */
export function UseTypeList({ value, onChange }: { value: UseType; onChange: (v: UseType) => void }) {
  const s = useStyles()
  const { c } = useTheme()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="How you will use AuCourant" style={s.list}>
      {OPTIONS.map(({ id, icon: I, title, sub, soon }) => {
        const on = value === id
        return (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: !!soon }}
            disabled={soon}
            onPress={() => onChange(id)}
            style={({ pressed }) => [s.item, on ? s.itemOn : pressed && { backgroundColor: c.inset }]}
          >
            <I size={24} color={on ? c.accent : soon ? c.fg3 : c.fg2} />
            <View style={{ flex: 1 }}>
              <View style={s.titleRow}>
                <T w="medium" tone={soon ? 'fg3' : 'fg'} style={{ flexShrink: 1 }}>
                  {title}
                </T>
                {soon && (
                  <T v="meta" tone="fg3">
                    Coming soon
                  </T>
                )}
              </View>
              <T v="sec" tone={soon ? 'fg3' : 'fg2'}>
                {sub}
              </T>
            </View>
            <Radio checked={on} disabled={soon} />
          </Pressable>
        )
      })}
    </View>
  )
}

/** A1b Use type. Sits between Welcome and Reference numbers. */
export function UseTypeStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { useType, setUseType } = useApp()
  return (
    <>
      <AppBar onBack={onBack} />
      <Body padX={24} padBottom={16}>
        <T v="hero" w="display" accessibilityRole="header">
          How will you use AuCourant?
        </T>
        <T tone="fg2" style={{ marginTop: 8 }}>
          This sets up the right defaults. You can change it later in Settings.
        </T>
        <View style={{ marginTop: 24 }}>
          <UseTypeList value={useType} onChange={setUseType} />
        </View>
      </Body>
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Button full onPress={onNext}>
          Get started
        </Button>
      </View>
    </>
  )
}

export function UseTypeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { useType, setUseType, notify } = useApp()
  return (
    <Sheet open={open} onClose={onClose} title="Used for">
      <T v="sec" tone="fg2" style={{ marginBottom: 16 }}>
        This sets up the right defaults for how you use AuCourant.
      </T>
      <UseTypeList
        value={useType}
        onChange={(v) => {
          setUseType(v)
          onClose()
          notify(`Now set up for ${useTypeLabel(v)}.`)
        }}
      />
    </Sheet>
  )
}

const useStyles = makeStyles((c) => ({
  list: { gap: 4, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.surface, padding: 4 },
  item: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  itemOn: { borderColor: c.accent, backgroundColor: c.selected },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
}))
