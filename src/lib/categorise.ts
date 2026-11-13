import { normalize } from './format'
import { TYPE_CATEGORY, type CatSource, type CategoryRule, type PTx } from './personal-data'

/**
 * The categoriser (architecture-personal.md). First match wins:
 *   1. person rule, 2. word rule (reference or shop name), 3. built-in type rule, 4. Uncategorised.
 * Explainable and offline. Rules only exist after the user confirms them.
 */
export function categorise(t: PTx, rules: CategoryRule[]): { categoryId: string | null; source: CatSource | null } {
  const person = rules.find((r) => r.kind === 'person' && r.value === t.personKey)
  if (person) return { categoryId: person.categoryId, source: 'person' }
  const text = normalize(`${t.reference ?? ''} ${t.name}`)
  const word = rules.find((r) => r.kind === 'word' && text.includes(normalize(r.value)))
  if (word) return { categoryId: word.categoryId, source: 'word' }
  const typed = TYPE_CATEGORY[t.kind]
  if (typed) return { categoryId: typed, source: 'type' }
  return { categoryId: null, source: null }
}

/** Re-runs the rules over every payment the user has not placed by hand. */
export function categoriseAll(list: PTx[], rules: CategoryRule[]): PTx[] {
  return list.map((t) => {
    if (t.catSource === 'manual') return t
    const r = categorise(t, rules)
    return r.categoryId === t.categoryId && r.source === t.catSource ? t : { ...t, categoryId: r.categoryId, catSource: r.source }
  })
}
