import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { apply } from '../src/index.ts'
import {
  DEFAULT_EXECUTION_TARGET, EXECUTION_SETTINGS_NAMESPACE,
} from '../src/execution-settings.ts'

class MemorySettings extends SettingsProvider {
  readonly writable = true
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

describe('ui-execution-target host', () => {
  it('registers, validates, and disposes the durable namespace with its fiber', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    const ns = EXECUTION_SETTINGS_NAMESPACE
    expect(ctx.settings.get(ns)).toEqual({ default: DEFAULT_EXECUTION_TARGET })
    await ctx.settings.mutate(ns, [{ op: 'set', path: ['default'], value: 'e2b-cloud' }])
    expect(ctx.settings.get(ns)).toEqual({ default: 'e2b-cloud' })
    await expect(ctx.settings.mutate(ns, [{ op: 'set', path: ['default'], value: 'mars' }])).rejects.toThrow()
    await fiber.dispose()
    expect(ctx.settings.describe().map(row => row.ns)).not.toContain(ns)
  })
})
