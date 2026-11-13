import { Pressable, View } from 'react-native'
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { parseDate, shortDate, toIso } from '../lib/format'
import { RADIUS, makeStyles, useTheme } from '../theme'
import { CalendarBlankIcon, CaretDownIcon } from './icons'
import { InlineError, T } from './kit'

/**
 * A field that looks like TextField but opens a native picker.
 * Values stay in the prototype's formats: dates "YYYY-MM-DD", times "HH:MM".
 */
export function PickerField({
  label,
  value,
  placeholder,
  display,
  onPress,
  error,
  icon = 'caret',
}: {
  label: string
  value: string
  placeholder?: string
  display?: string
  onPress: () => void
  error?: string | null
  icon?: 'caret' | 'calendar'
}) {
  const s = useStyles()
  const { c } = useTheme()
  const Icon = icon === 'calendar' ? CalendarBlankIcon : CaretDownIcon
  return (
    <View>
      <T v="sec" w="medium" style={{ marginBottom: 8 }}>
        {label}
      </T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? (display ?? value) : 'not set'}`}
        onPress={onPress}
        style={({ pressed }) => [s.box, { borderColor: error ? c.error : c.strokeStrong }, pressed && { backgroundColor: c.inset }]}
      >
        <T num tone={value ? 'fg' : 'fg3'} style={{ flex: 1 }} numberOfLines={1}>
          {value ? (display ?? value) : (placeholder ?? 'Choose')}
        </T>
        <Icon size={20} color={c.fg2} />
      </Pressable>
      {error && <InlineError>{error}</InlineError>}
    </View>
  )
}

export function DateField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string | null }) {
  return (
    <PickerField
      label={label}
      value={value}
      display={value ? shortDate(value) : undefined}
      icon="calendar"
      error={error}
      onPress={() =>
        DateTimePickerAndroid.open({
          value: value ? parseDate(value) : new Date(),
          mode: 'date',
          onChange: (e, d) => e.type === 'set' && d && onChange(toIso(d)),
        })
      }
    />
  )
}

export function TimeField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string | null }) {
  const base = new Date()
  if (value) {
    const [h, m] = value.split(':').map(Number)
    base.setHours(h, m, 0, 0)
  }
  return (
    <PickerField
      label={label}
      value={value}
      placeholder="--:--"
      error={error}
      onPress={() =>
        DateTimePickerAndroid.open({
          value: base,
          mode: 'time',
          is24Hour: true,
          onChange: (e, d) => e.type === 'set' && d && onChange(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`),
        })
      }
    />
  )
}

const useStyles = makeStyles((c) => ({
  box: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
  },
}))
