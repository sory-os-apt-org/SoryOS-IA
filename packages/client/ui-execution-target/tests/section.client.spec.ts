/** Pasted-key judgement and dictionary completeness for the Execution section. */
import { describe, expect, it } from 'vitest'
import { apiKeyFailure } from '../src/client/apiKey.ts'
import { en, fr, zh, type ExecutionKey } from '../src/client/locales.ts'

const keys: ExecutionKey[] = [
  'nav', 'title', 'blurb', 'localName', 'localBlurb', 'cloudName', 'cloudBlurb',
  'keyLabel', 'keyPlaceholder', 'keyStored', 'keyMissing', 'keyBlank', 'keyIllegalCharacters',
  'saveKey', 'removeKey', 'saveDefault', 'saved', 'conflict', 'refused', 'saving',
  'worldLocal', 'worldCloud',
]

describe('apiKeyFailure', () => {
  it('allows an empty field (keep the stored key)', () => {
    expect(apiKeyFailure('')).toBeUndefined()
  })

  it('rejects whitespace-only input', () => {
    expect(apiKeyFailure('   ')).toBe('keyBlank')
  })

  it('rejects NAME=value pastes and quoted wraps', () => {
    expect(apiKeyFailure('E2B_API_KEY=e2b_123')).toBe('keyIllegalCharacters')
    expect(apiKeyFailure('"e2b_123"')).toBe('keyIllegalCharacters')
  })

  it('rejects keys with illegal characters', () => {
    expect(apiKeyFailure('e2b key with spaces')).toBe('keyIllegalCharacters')
  })

  it('accepts a bare key value', () => {
    expect(apiKeyFailure('e2b_abc123XYZ')).toBeUndefined()
  })
})

describe('locales', () => {
  it('covers every key in all dictionaries with non-empty copy', () => {
    for (const key of keys) {
      expect(en[key].length).toBeGreaterThan(0)
      expect(zh[key].length).toBeGreaterThan(0)
      expect(fr[key].length).toBeGreaterThan(0)
    }
    expect(Object.keys(en).sort()).toEqual(keys.sort())
    expect(Object.keys(zh).sort()).toEqual(keys.sort())
    expect(Object.keys(fr).sort()).toEqual(keys.sort())
  })
})
