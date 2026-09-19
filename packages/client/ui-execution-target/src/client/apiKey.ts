/**
 * Browser-side judgement of a pasted E2B API key. Mirrors the charset rule in
 * `@deepseek-ai/dsh-client-ui-settings-models/apiKey`; keep the two in step.
 * @module @deepseek-ai/dsh-client-ui-execution-target/apiKey
 */

const LEGAL_API_KEY = /^[\x21-\x7E]+$/
const ENV_LINE = /^[A-Z][A-Z0-9_]*=[^=]/

/**
 * Copy key naming why a typed key cannot be saved. An empty field is not a
 * failure: the form opens with it empty even when a key is already stored,
 * where it means keep that one.
 */
export type ApiKeyFailureKey = 'keyBlank' | 'keyIllegalCharacters'

function isQuoted(value: string): boolean {
  const first = value[0]
  if (first !== '"' && first !== '\'' && first !== '`') return false
  return value.length > 1 && value.endsWith(first)
}

/**
 * Judge the key input's current value.
 * @param draft - the key input's current value, untrimmed.
 * @returns the copy key for a field-level failure, or `undefined` to allow submit.
 */
export function apiKeyFailure(draft: string): ApiKeyFailureKey | undefined {
  if (draft.length === 0) return undefined
  const value = draft.trim()
  if (value.length === 0) return 'keyBlank'
  if (ENV_LINE.test(value) || isQuoted(value)) return 'keyIllegalCharacters'
  if (!LEGAL_API_KEY.test(value)) return 'keyIllegalCharacters'
  return undefined
}
