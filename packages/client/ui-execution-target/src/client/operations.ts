/**
 * The Host reads and writes the Execution section performs, as callbacks built
 * in the plugin body. The section receives these instead of a context: the
 * outcomes name what it renders — a stored view, a stale revision, a refusal
 * message — so the failure codes and Remote namespaces stay in the apply
 * world. Keys travel through the credentials seam, never plain settings.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { CredentialInfo, SettingsNamespaceView, SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import { EXECUTION_SETTINGS_NAMESPACE } from '../execution-settings.ts'

export { EXECUTION_SETTINGS_NAMESPACE }

/** The credential reference the E2B key is stored under (an env-var-style name). */
export const E2B_KEY_REF = 'E2B_API_KEY'

/** What one namespace write answered. */
export type SettingsWriteOutcome =
  /** Committed; the view carries the stored user subtree and the new revision. */
  | { readonly kind: 'written'; readonly view: SettingsNamespaceView }
  /** The stored revision moved after the draft was read. */
  | { readonly kind: 'conflict'; readonly message: string }
  /** Any other refusal, with the Host's own diagnostic. */
  | { readonly kind: 'refused'; readonly message: string }

/** The Host operations the Execution section invokes. */
export interface ExecutionOperations {
  /**
   * Read the E2B key reference's state.
   * @returns the state, or undefined when the reference is unknown or refused.
   */
  describeKey(): Promise<CredentialInfo | undefined>
  /**
   * Store the pasted key literal under its reference.
   * @param value - the literal to store.
   * @returns the refusal message, or undefined once stored.
   */
  storeKey(value: string): Promise<string | undefined>
  /**
   * Remove the key reference (idempotent).
   * @returns the refusal message, or undefined once removed.
   */
  removeKey(): Promise<string | undefined>
  /**
   * Apply path operations to the execution settings namespace.
   * @param ops - ordered path operations against the stored section.
   * @param expectedRevision - revision the draft was opened at, or undefined to write unfenced.
   * @returns the write outcome the section renders from.
   */
  writeDefault(
    ops: SettingsPathOpView[],
    expectedRevision: number | undefined,
  ): Promise<SettingsWriteOutcome>
}

/**
 * Bind the section's Host operations to the plugin's own Remote namespaces.
 * @param ctx - the section plugin's context, which declares
 * `remote.credentials` and `remote.settings` in its own `inject`.
 * @returns the callbacks the section is injected with.
 */
export function createExecutionOperations(ctx: ClientContext): ExecutionOperations {
  return {
    describeKey: async () => {
      const response = await ctx.remote.credentials.describe([E2B_KEY_REF])
      return response.ok ? response.value[E2B_KEY_REF] : undefined
    },
    storeKey: async (value) => {
      const response = await ctx.remote.credentials.set(E2B_KEY_REF, value)
      return response.ok ? undefined : response.error.message
    },
    removeKey: async () => {
      const response = await ctx.remote.credentials.unset(E2B_KEY_REF)
      return response.ok ? undefined : response.error.message
    },
    writeDefault: async (ops, expectedRevision) => {
      const response = await ctx.remote.settings.mutate(EXECUTION_SETTINGS_NAMESPACE, ops, expectedRevision)
      if (response.ok) return { kind: 'written', view: response.value }
      const { code, message } = response.error
      return code === 'settings/conflict' ? { kind: 'conflict', message } : { kind: 'refused', message }
    },
  }
}
