/** Execution store folds the bound scope and reports saveDefault/saveKey outcomes. */
import { describe, expect, it, vi } from 'vitest'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import type { CredentialInfo } from '@deepseek-ai/dsh-api-remotes/client'
import type { ExecutionOperations } from '../src/client/operations.ts'
import {
  decodeExecutionSection, ExecutionSettingsStore, type ExecutionSectionValue,
} from '../src/client/store.ts'

function operations(overrides: Partial<ExecutionOperations> = {}): ExecutionOperations {
  return {
    describeKey: async () => undefined,
    storeKey: async () => undefined,
    removeKey: async () => undefined,
    writeDefault: async () => { throw new Error('unused') },
    ...overrides,
  }
}

function keyed(configured: boolean): CredentialInfo {
  return { configured, writable: true }
}

function ready(host: ReturnType<typeof stubSettingsScope<ExecutionSectionValue>>, value: ExecutionSectionValue): void {
  host.publish({ status: 'ready', value, writable: true, revision: 0 })
}

describe('decodeExecutionSection', () => {
  it('accepts a local or cloud default', () => {
    expect(decodeExecutionSection({ default: 'local' })).toEqual({ default: 'local' })
    expect(decodeExecutionSection({ default: 'e2b-cloud' })).toEqual({ default: 'e2b-cloud' })
  })

  it('refuses malformed sections', () => {
    expect(decodeExecutionSection(undefined)).toBeUndefined()
    expect(decodeExecutionSection({ default: 'mars' })).toBeUndefined()
    expect(decodeExecutionSection({ defTarget: 'local' })).toBeUndefined()
  })
})

describe('ExecutionSettingsStore', () => {
  it('folds the bound scope into the snapshot on load', async () => {
    const host = stubSettingsScope<ExecutionSectionValue>()
    const controller = new ExecutionSettingsStore(host.scope, operations({
      describeKey: async () => keyed(true),
    }))
    ready(host, { default: 'e2b-cloud' })
    await controller.load()
    const snapshot = controller.store.getSnapshot()
    expect(snapshot.status).toBe('ready')
    expect(snapshot.defaultTarget).toBe('e2b-cloud')
    expect(snapshot.keyStored).toBe(true)
    expect(snapshot.writable).toBe(true)
    controller.dispose()
  })

  it('saves the default through the scope default field and confirms the mirror', async () => {
    const host = stubSettingsScope<ExecutionSectionValue>()
    const controller = new ExecutionSettingsStore(host.scope, operations())
    ready(host, { default: 'local' })
    // The Host acceptance is already folded when the write settles, as a
    // committed mutate would leave it.
    host.publish({ value: { default: 'e2b-cloud' }, revision: 1 })
    await controller.saveDefault('e2b-cloud')
    expect(host.set).toHaveBeenCalledWith('default', 'e2b-cloud')
    const snapshot = controller.store.getSnapshot()
    expect(snapshot.busy).toBe(false)
    expect(snapshot.notice).toBe('saved')
    controller.dispose()
  })

  it('reports refused when the mirror does not carry the requested default', async () => {
    const host = stubSettingsScope<ExecutionSectionValue>()
    const controller = new ExecutionSettingsStore(host.scope, operations())
    ready(host, { default: 'local' })
    await controller.saveDefault('e2b-cloud')
    const snapshot = controller.store.getSnapshot()
    expect(snapshot.busy).toBe(false)
    expect(snapshot.error).toBe('refused')
    controller.dispose()
  })

  it('stores the key and reports its configured state', async () => {
    const host = stubSettingsScope<ExecutionSectionValue>()
    const controller = new ExecutionSettingsStore(host.scope, operations({
      describeKey: async () => keyed(true),
    }))
    await controller.saveKey('e2b_abc')
    const snapshot = controller.store.getSnapshot()
    expect(snapshot.keyStored).toBe(true)
    expect(snapshot.notice).toBe('saved')
    controller.dispose()
  })

  it('surfaces a key refusal without touching the stored state', async () => {
    const storeKey = vi.fn(async () => 'denied')
    const host = stubSettingsScope<ExecutionSectionValue>()
    const controller = new ExecutionSettingsStore(host.scope, operations({ storeKey }))
    await controller.saveKey('e2b_abc')
    const snapshot = controller.store.getSnapshot()
    expect(snapshot.error).toBe('denied')
    expect(snapshot.keyStored).toBe(false)
    controller.dispose()
  })

  it('clears the key and confirms the removal', async () => {
    const host = stubSettingsScope<ExecutionSectionValue>()
    const controller = new ExecutionSettingsStore(host.scope, operations())
    await controller.removeKey()
    const snapshot = controller.store.getSnapshot()
    expect(snapshot.keyStored).toBe(false)
    expect(snapshot.notice).toBe('saved')
    controller.dispose()
  })
})
