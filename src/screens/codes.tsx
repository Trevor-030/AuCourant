import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useApp } from '../lib/store'
import { money, normalize, plural } from '../lib/format'
import { useTheme } from '../theme'
import { AppBar, Button, Divided, EmptyState, RadioRow, Row, SectionLabel, Surface, T, TextField } from '../ui/kit'
import { CaretRightIcon, HashIcon, PlusIcon } from '../ui/icons'
import { Body } from '../ui/layout'
import { Sheet } from '../ui/overlays'

export type CodeSheetState = { mode: 'name' | 'edit'; code: string } | { mode: 'add' } | null

/** Name, edit or add a number code. Field plus a short list of existing groups. */
export function CodeSheet({ state, onClose, onSaved }: { state: CodeSheetState; onClose: () => void; onSaved?: (groupId: string) => void }) {
  const { groups, codes, pendingCodes, groupName, assignCode, useType } = useApp()
  const [kept, setKept] = useState<Exclude<CodeSheetState, null>>({ mode: 'add' })
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [codeErr, setCodeErr] = useState<string | null>(null)
  const [nameErr, setNameErr] = useState<string | null>(null)

  useEffect(() => {
    if (!state) return
    setKept(state)
    setCode(state.mode === 'add' ? '' : state.code)
    setName(state.mode === 'edit' && codes[state.code] ? groupName(codes[state.code]) : '')
    setCodeErr(null)
    setNameErr(null)
    // Only reset when a new sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const s = state ?? kept
  const choices = groups.filter((g) => !g.system && !g.code).sort((a, b) => a.name.localeCompare(b.name))
  const listed = (c: string) => !!codes[c] || pendingCodes.some((p) => p.code === c)

  const checkCode = (v: string) =>
    !v.trim()
      ? 'Enter the number givers type, like 4.'
      : !/^\d{1,3}$/.test(v.trim())
        ? 'Use numbers only, like 4.'
        : listed(v.trim())
          ? 'This number already has a group. Edit it from the list.'
          : null
  const checkName = (v: string) => (!v.trim() ? 'Enter a group name or pick one from the list.' : /^code \d+$/i.test(v.trim()) ? 'Choose a real group name, like Welfare.' : null)

  const save = () => {
    const ce = s.mode === 'add' ? checkCode(code) : null
    const ne = checkName(name)
    setCodeErr(ce)
    setNameErr(ne)
    if (ce || ne) return
    const to = assignCode(code.trim(), name)
    onClose()
    if (to) onSaved?.(to)
  }

  const title = s.mode === 'add' ? 'Add a code' : s.mode === 'name' ? `Name code ${s.code}` : `Code ${s.code}`
  const pending = s.mode === 'name' ? pendingCodes.find((p) => p.code === s.code) : null
  const org = useType === 'organisation' ? 'group' : 'church'

  return (
    <Sheet
      open={!!state}
      onClose={onClose}
      title={title}
      footer={
        <Button full onPress={save}>
          {s.mode === 'add' ? 'Save code' : 'Save name'}
        </Button>
      }
    >
      <T v="sec" tone="fg2">
        {pending
          ? `${plural(pending.count, 'payment')} (${money(pending.total)}) have ${pending.code} as the reference. Name it once and it counts the same way every week.`
          : s.mode === 'edit'
            ? 'Changing the group moves every payment with this code.'
            : `Say what this number means for your ${org}.`}
      </T>
      <View style={{ marginTop: 16, gap: 16 }}>
        <TextField
          label="Code"
          value={code}
          onChange={setCode}
          readOnly={s.mode !== 'add'}
          keyboardType="number-pad"
          maxLength={3}
          placeholder={s.mode === 'add' ? '4' : undefined}
          error={codeErr}
          onFocus={() => setCodeErr(null)}
          onBlur={() => s.mode === 'add' && code && setCodeErr(checkCode(code))}
          autoComplete="off"
        />
        <TextField
          label="Group name"
          value={name}
          onChange={setName}
          error={nameErr}
          onFocus={() => setNameErr(null)}
          onBlur={() => name && setNameErr(checkName(name))}
          onSubmitEditing={save}
          returnKeyType="done"
          helper="Type a new name, or pick a group below."
          autoComplete="off"
        />
      </View>
      <View style={{ marginTop: 24 }}>
        <SectionLabel>Existing groups</SectionLabel>
        <Surface>
          <View accessibilityRole="radiogroup" accessibilityLabel="Existing groups">
            <Divided>
              {choices.map((g) => (
                <RadioRow
                  key={g.id}
                  label={g.name}
                  checked={normalize(name) === normalize(g.name)}
                  onSelect={() => {
                    setName(g.name)
                    setNameErr(null)
                  }}
                />
              ))}
            </Divided>
          </View>
        </Surface>
      </View>
    </Sheet>
  )
}

export function ReferenceCodes() {
  const { c } = useTheme()
  const { back, codes, pendingCodes, groupName, txs, useType } = useApp()
  const [sheet, setSheet] = useState<CodeSheetState>(null)
  const rows = [
    ...Object.entries(codes).map(([code, gid]) => ({ code, group: groupName(gid) as string | null, named: true })),
    ...pendingCodes.filter((p) => !codes[p.code]).map((p) => ({ code: p.code, group: null, named: false })),
  ].sort((a, b) => Number(a.code) - Number(b.code))
  const unit = useType === 'organisation' ? 'period' : 'service'

  return (
    <>
      <AppBar title="Reference codes" onBack={back} />
      <Body padBottom={32}>
        <T v="sec" tone="fg2" style={{ marginBottom: 16 }}>
          Some givers type a number as the reference. Say what each number means for your {useType === 'organisation' ? 'group' : 'church'}.
        </T>
        <Surface>
          {rows.length === 0 ? (
            <EmptyState icon={HashIcon} title="No codes yet" body="Add a number here, or name it when it first shows up." action="Add a code" onAction={() => setSheet({ mode: 'add' })} />
          ) : (
            <Divided>
              {rows.map((r) => {
                const n = txs.filter((t) => t.reference?.trim() === r.code).length
                return (
                  <Row
                    key={r.code}
                    title={r.code}
                    sub={plural(n, 'payment')}
                    end={r.group ?? 'Not named yet'}
                    endTone={r.group ? 'fg' : 'fg3'}
                    trailing={<CaretRightIcon size={20} color={c.fg2} />}
                    onPress={() => setSheet({ mode: r.named ? 'edit' : 'name', code: r.code })}
                  />
                )
              })}
            </Divided>
          )}
        </Surface>
        {rows.length > 0 && (
          <Button variant="secondary" full icon={PlusIcon} style={{ marginTop: 16 }} onPress={() => setSheet({ mode: 'add' })}>
            Add a code
          </Button>
        )}
        <T v="meta" tone="fg3" style={{ marginTop: 12 }}>
          Codes mean the same thing in every {unit}.
        </T>
      </Body>
      <CodeSheet state={sheet} onClose={() => setSheet(null)} />
    </>
  )
}
