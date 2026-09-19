/** Pure SDK-shape helpers: exit mapping and envd feature gates. */
import { describe, expect, it } from 'vitest'
import { commandExitCode, supportsEnvd, supportsStdinClose } from '../src/index.ts'

describe('commandExitCode', () => {
  it('reads the exit code off a CommandExitError-shaped rejection', () => {
    expect(commandExitCode({ exitCode: 1, stdout: '', stderr: 'boom' })).toBe(1)
    expect(commandExitCode({ exitCode: 0 })).toBe(0)
  })

  it('returns undefined for foreign failures', () => {
    expect(commandExitCode(new Error('transport down'))).toBeUndefined()
    expect(commandExitCode(null)).toBeUndefined()
    expect(commandExitCode({ exitCode: '1' })).toBeUndefined()
  })
})

describe('supportsEnvd', () => {
  it('gates stdin plumbing at 0.3.0 and close at 0.5.2', () => {
    expect(supportsEnvd('0.2.9', 0, 3)).toBe(false)
    expect(supportsEnvd('0.3.0', 0, 3)).toBe(true)
    expect(supportsStdinClose('0.5.1')).toBe(false)
    expect(supportsStdinClose('0.5.2')).toBe(true)
    expect(supportsStdinClose('1.0.0')).toBe(true)
  })

  it('refuses unknown or malformed versions', () => {
    expect(supportsStdinClose(undefined)).toBe(false)
    expect(supportsEnvd('not-a-version', 0, 3)).toBe(false)
  })
})
