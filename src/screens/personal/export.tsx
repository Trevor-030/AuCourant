import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useApp } from '../../lib/store'
import { P_EXPORT_FIELDS, P_NAME_FIELDS, totalsOf, type PExportField } from '../../lib/personal'
import { money, plural } from '../../lib/format'
import { fileBase, tableCsv, tablePdf } from '../../lib/report'
import { personalTable } from '../../lib/report-personal'
import { ExportNative, NativeMissingError, type ReportFile } from '../../native'
import { RADIUS, makeStyles, useTheme } from '../../theme'
import { AppBar, Button, CheckRow, Divided, ErrorBox, InlineError, RadioRow, Surface, SwitchRow, T } from '../../ui/kit'
import { CaretDownIcon, CheckCircleIcon, ShareNetworkIcon } from '../../ui/icons'
import { Body, Fill, Footer } from '../../ui/layout'
import { PeriodSheet } from './shared'

/** Same screen as church export, with the period instead of the service. */
export function PersonalExport() {
  const s = useStyles()
  const { c } = useTheme()
  const { period, periodId, pTxsIn, pExportPrefs: p, setPExportPrefs, demo, notify, categoryName, personName } = useApp()
  const [picker, setPicker] = useState(false)
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [errorText, setErrorText] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [file, setFile] = useState<ReportFile | null>(null)

  const list = [...pTxsIn(periodId)].sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)))
  const tot = totalsOf(list)
  const fields = P_EXPORT_FIELDS.filter((f) => p.fields.includes(f) && !(p.hideNames && P_NAME_FIELDS.includes(f)))
  const set = (patch: Partial<typeof p>) => {
    setPExportPrefs({ ...p, ...patch })
    setFormError(null)
    if (status === 'error') setStatus('idle')
  }
  const toggleField = (f: PExportField, on: boolean) => set({ fields: on ? [...p.fields, f] : p.fields.filter((x) => x !== f) })
  const summary = `${plural(tot.count, 'payment')}, ${money(tot.moneyIn)} in, ${money(tot.moneyOut)} out`

  const run = async () => {
    if (status === 'working') return
    if (list.length === 0) return setFormError('This period has no payments. Choose another period.')
    if (fields.length === 0) {
      setFieldsOpen(true)
      return setFormError('Choose at least one field for the report.')
    }
    setStatus('working')
    try {
      if (demo === 'error') throw new Error('demo')
      const ctx = { title: period.title, dateLabel: period.label, txs: list, fields, categoryName, personName }
      const table = personalTable(ctx)
      const name = `${fileBase(ctx)}.${p.format}`
      setFile(await ExportNative.write(name, p.format === 'pdf' ? tablePdf(table) : tableCsv(table), p.format))
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
          <T v="sec" tone="fg2" num style={{ marginTop: 4, textAlign: 'center' }}>
            {summary}
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
              Period
            </T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Period: ${period.title}, ${period.label}. Change`}
              onPress={() => setPicker(true)}
              style={({ pressed }) => [s.select, pressed && { backgroundColor: c.inset }]}
            >
              <T numberOfLines={1} style={{ flex: 1 }}>
                {period.title}, {period.label}
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
            <SwitchRow label="Hide names and numbers" sub="People and their numbers are left out of the report." checked={p.hideNames} onChange={(v) => set({ hideNames: v })} />
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
                  {fields.length} of {P_EXPORT_FIELDS.length} fields
                </T>
              </View>
              <CaretDownIcon size={20} color={c.fg2} style={{ transform: [{ rotate: fieldsOpen ? '180deg' : '0deg' }] }} />
            </Pressable>
            {fieldsOpen && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                {P_EXPORT_FIELDS.map((f) => {
                  const hidden = p.hideNames && P_NAME_FIELDS.includes(f)
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
              <T v="sec" w="medium" num style={{ flexShrink: 1, textAlign: 'right' }}>
                {summary}
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
      <PeriodSheet open={picker} onClose={() => setPicker(false)} />
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
