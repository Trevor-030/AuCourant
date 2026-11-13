import { useRef, useState } from 'react'
import { View, type TextInputInstance } from 'react-native'
import { useApp } from '../lib/store'
import { AppBar, Button, IconButton, InlineError, T, TextField } from '../ui/kit'
import { PlusIcon, XIcon } from '../ui/icons'
import { Body, Footer } from '../ui/layout'

type R = { id: number; code: string; name: string; codeErr: string | null; nameErr: string | null }

const BAD_CODE = 'Use a number with 1 to 3 digits.'
const DUP_CODE = 'This number is already on the list.'
const NO_NAME = 'Enter a group name for this number.'
const NOTHING = 'Add a number and a group name, or skip for now.'

let nextId = 1
const blank = (): R => ({ id: nextId++, code: '', name: '', codeErr: null, nameErr: null })

function codeError(rows: R[], r: R) {
  const c = r.code.trim()
  if (!c) return r.name.trim() ? BAD_CODE : null
  if (!/^\d{1,3}$/.test(c)) return BAD_CODE
  const first = rows.find((x) => x.code.trim() === c)
  return first && first.id !== r.id ? DUP_CODE : null
}
const nameError = (r: R) => (r.code.trim() && !r.name.trim() ? NO_NAME : null)

/** A1c Reference numbers. Optional step between Use type and Message access. */
export function RefNumbersStep({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { useType, setupCodes } = useApp()
  const [rows, setRows] = useState<R[]>(() => [blank()])
  const [formErr, setFormErr] = useState<string | null>(null)
  const inputs = useRef(new Map<string, TextInputInstance | null>())

  const patch = (id: number, p: Partial<R>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)))

  const save = () => {
    const filled = rows.filter((r) => r.code.trim() || r.name.trim())
    if (filled.length === 0) return setFormErr(NOTHING)
    const checked = rows.map((r) => ({ ...r, codeErr: codeError(rows, r), nameErr: nameError(r) }))
    setRows(checked)
    const bad = checked.find((r) => r.codeErr || r.nameErr)
    if (bad) {
      inputs.current.get(`${bad.codeErr ? 'code' : 'name'}-${bad.id}`)?.focus()
      return
    }
    setupCodes(filled.map((r) => ({ code: r.code.trim(), name: r.name.trim() })))
    onDone()
  }

  return (
    <>
      <AppBar onBack={onBack} />
      <Body padX={24}>
        <T v="hero" w="display" accessibilityRole="header">
          {useType === 'organisation' ? 'Does your group use numbers?' : 'Does your church use numbers?'}
        </T>
        <T tone="fg2" style={{ marginTop: 8 }}>
          Some givers type 1 or 2 instead of a word. Tell AuCourant what each number means. You can skip this and do it later.
        </T>

        <View style={{ marginTop: 24, gap: 16 }}>
          {rows.map((r, i) => (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <TextField
                inputRef={(el) => {
                  inputs.current.set(`code-${r.id}`, el)
                }}
                style={{ width: 96 }}
                label="Number"
                placeholder="1"
                keyboardType="number-pad"
                maxLength={3}
                autoComplete="off"
                value={r.code}
                error={r.codeErr}
                onChange={(v) => {
                  patch(r.id, { code: v })
                  setFormErr(null)
                }}
                onFocus={() => patch(r.id, { codeErr: null })}
                onBlur={() => patch(r.id, { codeErr: codeError(rows, r) })}
                inputStyle={{ fontVariant: ['tabular-nums'] }}
                accessibilityLabel={`Number ${i + 1}`}
              />
              <TextField
                inputRef={(el) => {
                  inputs.current.set(`name-${r.id}`, el)
                }}
                style={{ flex: 1, minWidth: 0 }}
                label="Group name"
                placeholder="Offering"
                autoComplete="off"
                autoCapitalize="words"
                value={r.name}
                error={r.nameErr}
                onChange={(v) => {
                  patch(r.id, { name: v })
                  setFormErr(null)
                }}
                onFocus={() => patch(r.id, { nameErr: null })}
                onBlur={() => patch(r.id, { nameErr: nameError(r) })}
                onSubmitEditing={save}
                returnKeyType="done"
                accessibilityLabel={`Group name for number ${i + 1}`}
              />
              {rows.length > 1 && (
                <View style={{ marginTop: 28, marginRight: -12 }}>
                  <IconButton label="Remove this number" icon={XIcon} size={20} tipAlign="end" onPress={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} />
                </View>
              )}
            </View>
          ))}
        </View>
        <View style={{ alignItems: 'flex-start' }}>
          <Button variant="text" icon={PlusIcon} style={{ marginTop: 8, marginLeft: -12 }} onPress={() => setRows((rs) => [...rs, blank()])}>
            Add another number
          </Button>
        </View>
        <T v="meta" tone="fg3" style={{ marginTop: 4 }}>
          For example, 1 is Offering and 2 is Tithe.
        </T>
      </Body>
      <Footer style={{ paddingTop: 12 }}>
        {formErr && (
          <View style={{ marginTop: -8, marginBottom: 12 }}>
            <InlineError>{formErr}</InlineError>
          </View>
        )}
        <Button full onPress={save}>
          Save numbers
        </Button>
        <Button full variant="text" style={{ marginTop: 4 }} onPress={onDone}>
          Skip for now
        </Button>
      </Footer>
    </>
  )
}
