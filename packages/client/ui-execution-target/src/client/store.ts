/**
 * Execution settings section controller: the `execution-target` default plus
 * the E2B credential state. The Host stays the single fact source — the
 * default rides the bound settings scope (revision fencing and recovery
 * included), the key rides the credentials seam, and every mutation refreshes
 * the snapshot it renders from.
 */

import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ExecutionTarget, ExecutionTargetSettings } from '../execution-settings.ts'
import type { ExecutionOperations } from './operations.ts'

export type { ExecutionTarget }

/** Decoded `execution-target` section value. */
export type ExecutionSectionValue = ExecutionTargetSettings

/**
 * Decode the bound section without the schema service: the shape is one
 * scalar, so a structural check keeps the page independent of host schemas.
 * @param value - the resolved section value from the mirror.
 * @returns the typed value, or undefined when the section is absent or malformed.
 */
export function decodeExecutionSection(value: unknown): ExecutionSectionValue | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const def = (value as { default?: unknown }).default
  if (def !== 'local' && def !== 'e2b-cloud') return undefined
  return { default: def }
}

/** What the Execution section renders. */
export interface ExecutionSectionState {
  /** Page lifecycle: before first load, loading, or live. */
  status: 'idle' | 'loading' | 'ready'
  /** Effective default world (deployment default until the Host answers). */
  defaultTarget: ExecutionTarget
  /** Whether the Host can persist the default right now. */
  writable: boolean
  /** Whether the E2B key reference currently resolves to a value. */
  keyStored: boolean
  /** One in-flight mutation at a time; the section disables its controls meanwhile. */
  busy: boolean
  /** Last failure copy, cleared by the next attempt. */
  error: string | null
  /** Last success copy (`saved`), cleared by the next attempt. */
  notice: 'saved' | null
}

/** The Execution settings section controller (one per settings surface). */
export class ExecutionSettingsStore {
  /** The snapshot the section renders from (uSES-safe store). */
  readonly store: SnapshotStore<ExecutionSectionState> = createSnapshotStore<ExecutionSectionState>({
    status: 'idle', defaultTarget: 'local', writable: false, keyStored: false, busy: false, error: null, notice: null,
  })

  /** Latest load wins; an older response never overwrites a newer one. */
  private generation = 0
  private readonly disposeScope: () => void
  private disposed = false

  /** Current liveness read fresh at each guard (a getter defeats stale narrowing). */
  private get alive(): boolean {
    return !this.disposed
  }

  /**
   * @param scope - the bound `execution-target` settings scope.
   * @param operations - key credential callbacks built in the apply world.
   */
  constructor(
    private readonly scope: SettingsScope<ExecutionSectionValue>,
    private readonly operations: ExecutionOperations,
  ) {
    this.disposeScope = scope.subscribe(() => { this.foldScope() })
    this.foldScope()
  }

  /** Release the scope subscription. */
  dispose(): void {
    this.disposed = true
    this.disposeScope()
  }

  /**
   * Refresh the snapshot: the scope is already live from its own mirror, so
   * only the credential state needs a wire read.
   * @returns nothing; the snapshot carries the outcome.
   */
  async load(): Promise<void> {
    const generation = ++this.generation
    this.store.update((s) => { s.status = 'loading'; s.error = null })
    this.foldScope()
    const info = await this.operations.describeKey()
    if (this.disposed || generation !== this.generation) return
    this.store.update((s) => {
      s.status = 'ready'
      s.keyStored = info?.configured === true
    })
  }

  /**
   * Persist the default world through the scope's revision fencing, then
   * confirm the mirror actually carries it.
   * @param target - the world later sessions use.
   * @returns nothing; the snapshot carries the outcome.
   */
  async saveDefault(target: ExecutionTarget): Promise<void> {
    this.store.update((s) => { s.busy = true; s.error = null; s.notice = null })
    try {
      await this.scope.set('default', target)
    } catch {
      // A transport failure leaves the mirror behind; the check below reports it.
    }
    if (this.disposed) return
    this.foldScope()
    this.store.update((s) => {
      s.busy = false
      if (s.defaultTarget === target) s.notice = 'saved'
      else s.error = 'refused'
    })
  }

  /**
   * Store the pasted key literal, then re-read its configured state.
   * @param value - the trimmed key literal.
   * @returns nothing; the snapshot carries the outcome.
   */
  async saveKey(value: string): Promise<void> {
    this.store.update((s) => { s.busy = true; s.error = null; s.notice = null })
    const refusal = await this.operations.storeKey(value)
    if (this.disposed) return
    if (refusal !== undefined) {
      this.store.update((s) => { s.busy = false; s.error = refusal })
      return
    }
    const info = await this.operations.describeKey()
    if (!this.alive) return
    this.store.update((s) => {
      s.busy = false
      s.keyStored = info?.configured === true
      if (s.keyStored) s.notice = 'saved'
      else s.error = 'refused'
    })
  }

  /**
   * Remove the key reference, then re-read its configured state.
   * @returns nothing; the snapshot carries the outcome.
   */
  async removeKey(): Promise<void> {
    this.store.update((s) => { s.busy = true; s.error = null; s.notice = null })
    const refusal = await this.operations.removeKey()
    if (this.disposed) return
    if (refusal !== undefined) {
      this.store.update((s) => { s.busy = false; s.error = refusal })
      return
    }
    const info = await this.operations.describeKey()
    if (!this.alive) return
    this.store.update((s) => {
      s.busy = false
      s.keyStored = info?.configured === true
      if (!s.keyStored) s.notice = 'saved'
      else s.error = 'refused'
    })
  }

  private foldScope(): void {
    const snapshot = this.scope.getSnapshot()
    if (this.disposed) return
    this.store.update((s) => {
      if (s.status === 'idle') s.status = snapshot.status === 'ready' ? 'ready' : 'loading'
      if (snapshot.value !== undefined) s.defaultTarget = snapshot.value.default
      s.writable = snapshot.writable
    })
  }
}
