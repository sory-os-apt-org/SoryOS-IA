/** POSIX argv quoting for E2B command strings is exact and total. */
import { describe, expect, it } from 'vitest'
import { quoteArgv } from '../src/index.ts'

describe('quoteArgv', () => {
  it('joins argv with single-quote wrapping', () => {
    expect(quoteArgv(['echo', 'hello world'])).toBe(`'echo' 'hello world'`)
  })

  it('escapes embedded single quotes', () => {
    expect(quoteArgv(['printf', `it's`])).toBe(`'printf' 'it'\\''s'`)
  })

  it('leaves flags and paths intact inside quotes', () => {
    expect(quoteArgv(['ls', '-la', '/home/user/workspace'])).toBe(`'ls' '-la' '/home/user/workspace'`)
  })

  it('rejects empty argv before any SDK call', () => {
    expect(() => quoteArgv([])).toThrowError(/non-empty argv/)
  })
})
