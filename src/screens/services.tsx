import { useState } from 'react'
import { View } from 'react-native'
import { useApp } from '../lib/store'
import { TODAY, addDays, plural } from '../lib/format'
import { Button, Divided, RadioRow, SectionLabel, Surface, T } from '../ui/kit'
import { CalendarBlankIcon, PlusIcon } from '../ui/icons'
import { Sheet } from '../ui/overlays'
import { DateField } from '../ui/pickers'

export function ServicePickerSheet({ open, onClose, allowCreate = true }: { open: boolean; onClose: () => void; allowCreate?: boolean }) {
  const { services, serviceId, setServiceId, txsIn, push } = useApp()
  const [range, setRange] = useState(serviceId.startsWith('range:'))
  const [from, setFrom] = useState(addDays(TODAY, -27))
  const [to, setTo] = useState(TODAY)
  const [error, setError] = useState<string | null>(null)

  const pick = (id: string) => {
    setServiceId(id)
    onClose()
  }
  const applyRange = () => {
    if (!from || !to) return setError('Choose both dates.')
    if (to < from) return setError('The end date must be on or after the start date.')
    pick(`range:${from}:${to}`)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Choose service">
      <SectionLabel>Recent services</SectionLabel>
      <Surface>
        <View accessibilityRole="radiogroup" accessibilityLabel="Recent services">
          <Divided>
            {services.map((s) => (
              <RadioRow
                key={s.id}
                checked={serviceId === s.id}
                onSelect={() => pick(s.id)}
                label={s.title}
                sub={s.kind === 'special' ? `${s.dateLabel}, ${s.start} to ${s.end}` : s.dateLabel}
                end={
                  <T v="sec" tone="fg2" num>
                    {plural(txsIn(s.id).length, 'payment')}
                  </T>
                }
              />
            ))}
          </Divided>
        </View>
      </Surface>

      <View style={{ marginTop: 16, alignItems: 'flex-start' }}>
        {range ? (
          <Surface style={{ padding: 16, alignSelf: 'stretch' }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <DateField label="From" value={from} onChange={(v) => (setFrom(v), setError(null))} />
              </View>
              <View style={{ flex: 1 }}>
                <DateField label="To" value={to} onChange={(v) => (setTo(v), setError(null))} />
              </View>
            </View>
            {error && (
              <T v="sec" tone="error" style={{ marginTop: 8 }} accessibilityRole="alert">
                {error}
              </T>
            )}
            <Button full variant="secondary" style={{ marginTop: 16 }} onPress={applyRange}>
              Show these dates
            </Button>
          </Surface>
        ) : (
          <Button variant="text" icon={CalendarBlankIcon} style={{ marginLeft: -12 }} onPress={() => setRange(true)}>
            Choose dates
          </Button>
        )}
        {allowCreate && (
          <Button
            variant="text"
            icon={PlusIcon}
            style={{ marginLeft: -12 }}
            onPress={() => {
              onClose()
              push({ name: 'special-session' })
            }}
          >
            Create special session
          </Button>
        )}
      </View>
    </Sheet>
  )
}
