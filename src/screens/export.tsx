import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { EXPORT_FIELDS, type ExportField } from '../lib/data'
import { statsOf, useApp } from '../lib/store'
import { money, plural } from '../lib/format'
import { buildCsv, buildPdf, fileBase } from '../lib/report'
import { ExportNative, NativeMissingError, type ReportFile } from '../native'
import { RADIUS, makeStyles, useTheme } from '../theme'
import { AppBar, Button, CheckRow, Divided, ErrorBox, InlineError, RadioRow, Surface, SwitchRow, T } from '../ui/kit'
import { CaretDownIcon, CheckCircleIcon, ShareNetworkIcon } from '../ui/icons'
import { Body, Fill, Footer } from '../ui/layout'
import { ServicePickerSheet } from './services'

const MEMBER_FIELDS: ExportField[] = ['Sender name', 'Sender number']

export function Export() {
  const s = useStyles()
  const { c } = useTheme()
  const { service, txsIn, exportPrefs: p, setExportPrefs, demo, notify, groupName, useType } = useApp()
  const [picker, setPicker] = useState(false)
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [errorText, setErrorText] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [file, setFile] = useState<ReportFile | null>(null)
  const unit = useType === 'organisation' ? 'period' : 'service'

  const list = [...txsIn(service.id)].sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)))
  const st = statsOf(list)
  const fields = EXPORT_FIELDS.filter((f) => p.fields.includes(f) && !(p.hideMembers && MEMBER_FIELDS.includes(f)))
  const set = (patch: Partial<typeof p>) => {
    setExportPrefs({ ...p, ...patch })
    setFormError(null)
    if (status === 'error') setStatus('idle')
  }
  const toggleField = (f: ExportField, on: boolean) => set({ fields: on ? [...p.fields, f] : p.fields.filter((x) => x !== f) })

  const run = async () => {
    if (status === 'working') return
    if (list.length === 0) return setFormError(`This ${unit} has no payments yet. Choose another ${unit}.`)
    if (fields.length === 0) {
      setFieldsOpen(true)
      return setFormError('Choose at least one field for the report.')
    }
    setStatus('working')
    try {
      if (demo === 'error') throw new Error('demo')
      const ctx = { title: service.title, dateLabel: service.dateLabel, txs: list, fields, groupName }
      const name = `${fileBase(ctx)}.${p.format}`
      const content = p.format === 'pdf' ? buildPdf(ctx) : buildCsv(ctx)
      setFile(await ExportNative.write(name, content, p.format))
      setStatus('done')
    } catch (e) {
      setErrorText(
        e instanceof NativeMissingError
          ? 'Export needs the full app build. Run it with "npx expo run:android", not Expo Go.'
          : "We couldn't create the report. Check that the phone has free storage and try again.",
      )
      setStatus('error')
    }
  }

  const share = async () => {
    if (!file) return
    try {
      await ExportNative.share(file)
    } catch {
      notify("Couldn't open the share sheet. Try Open file instead.")
    }
  }
  const open = async () => {
    if (!file) return
    try {
      await ExportNative.open(file)
    } catch (e) {
      notify(e instanceof Error && e.message.includes('No app') ? e.message : "Couldn't open the file.")
    }
  }

  if (status === 'done' && file) {
    return (
      <>
        <AppBar title="Export" />
        <Fill style={s.done}>
          <View style={s.doneTitle}>
            <CheckCircleIcon size={28} weight="fill" color={c.gold} />
            <T v="title" w="display">
              Report is ready
            </T>
          </View>
          <T v="sec" tone="fg2" style={{ marginTop: 12, textAlign: 'center' }}>
            {file.name}
          </T>
          <T v="sec" tone="fg2" num style={{ marginTop: 4 }}>
            {plural(st.count, 'payment')}, {money(st.total)}
          </T>
          <Button variant="text" style={{ marginTop: 16 }} onPress={() => setStatus('idle')}>
            Export another report
          </Button>
        </Fill>
        <Footer style={{ flexDirection: 'row', gap: 8 }}>
          <Button variant="secondary" style={{ flex: 1 }} onPress={open}>
            Open file
          </Button>
          <Button style={{ flex: 1 }} icon={ShareNetworkIcon} onPress={share}>
            Share file
          </Button>
        </Footer>
      </>
    )
  }

  return (
    <>
      <AppBar title="Export" />
      <Body>
        <View style={{ gap: 24 }}>
          <View>
            <T v="sec" w="medium" style={{ marginBottom: 8 }}>
              {unit === 'period' ? 'Period' : 'Service'}
            </T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${unit}: ${service.title}, ${service.dateLabel}. Change`}
              onPress={() => setPicker(true)}
              style={({ pressed }) => [s.select, pressed && { backgroundColor: c.inset }]}
            >
              <T numberOfLines={1} style={{ flex: 1 }}>
                {service.title}, {service.dateLabel}
              </T>
              <CaretDownIcon size={20} color={c.fg2} />
            </Pressable>
          </View>

          <View>
            <T v="sec" w="medium" style={{ marginBottom: 8 }}>
              Format
            </T>
            <Surface>
              <View accessibilityRole="radiogroup" accessibilityLabel="Format">
                <Divided>
                  <RadioRow checked={p.format === 'pdf'} onSelect={() => set({ format: 'pdf' })} label="PDF" sub="Ready to print or share" />
                  <RadioRow checked={p.format === 'csv'} onSelect={() => set({ format: 'csv' })} label="Excel (CSV)" sub="Opens in Excel or Google Sheets" />
                </Divided>
              </View>
            </Surface>
          </View>

          <Surface>
            <SwitchRow label="Hide member names and numbers" sub="Senders are left out of the report." checked={p.hideMembers} onChange={(v) => set({ hideMembers: v })} />
          </Surface>

          <Surface>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: fieldsOpen }}
              onPress={() => setFieldsOpen(!fieldsOpen)}
              style={({ pressed }) => [s.expand, pressed && { backgroundColor: c.inset }]}
            >
              <View style={{ flex: 1 }}>
                <T>Customize fields</T>
                <T v="sec" tone="fg2" num>
                  {fields.length} of {EXPORT_FIELDS.length} fields
                </T>
              </View>
              <CaretDownIcon size={20} color={c.fg2} style={{ transform: [{ rotate: fieldsOpen ? '180deg' : '0deg' }] }} />
            </Pressable>
            {fieldsOpen && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                {EXPORT_FIELDS.map((f) => {
                  const hidden = p.hideMembers && MEMBER_FIELDS.includes(f)
                  return <CheckRow key={f} label={f} checked={p.fields.includes(f)} disabled={hidden} sub={hidden ? 'Hidden' : undefined} onChange={(on) => toggleField(f, on)} />
                })}
              </View>
            )}
          </Surface>

          <View>
            <View style={s.between}>
              <T v="sec" tone="fg2">
                Report covers
              </T>
              <T v="sec" w="medium" num>
                {plural(st.count, 'payment')}, {money(st.total)}
              </T>
            </View>
            {formError && <InlineError>{formError}</InlineError>}
          </View>

          {status === 'error' && <ErrorBox>{errorText}</ErrorBox>}
        </View>
      </Body>
      <Footer>
        <Button full loading={status === 'working'} onPress={run}>
          {status === 'working' ? 'Exporting…' : status === 'error' ? 'Try again' : 'Export report'}
        </Button>
      </Footer>
      <ServicePickerSheet open={picker} onClose={() => setPicker(false)} />
    </>
  )
}

const useStyles = makeStyles((c) => ({
  done: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  doneTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  select: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: c.strokeStrong,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
  },
  expand: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  between: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
}))
