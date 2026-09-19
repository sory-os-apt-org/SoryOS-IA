/**
 * Sandbox-boundary confinement for E2B execution. The E2B sandbox is already
 * isolated from the harness host, so confinement passes argv through unchanged
 * and reports the sandbox itself as the enforced boundary: no file effect can
 * reach the host, and no in-world path fence is applied. Consumers that need
 * in-world path fencing must compose a different backend; this provider never
 * claims denials it cannot produce.
 * @module @deepseek-ai/dsh-sandbox-e2b
 */

import { SandboxProvider, SandboxUnavailableError } from '@deepseek-ai/dsh-sandbox'
import type { ConfinedArgv, SandboxPolicy } from '@deepseek-ai/dsh-sandbox'
import type {} from '@deepseek-ai/dsh-e2b'

/** Confinement resolved at the sandbox boundary, beside its filesystem and subprocess providers. */
export class E2bSandboxProvider extends SandboxProvider {
  static inject = ['e2b']

  override async confine(argv: readonly string[], policy: SandboxPolicy, signal?: AbortSignal): Promise<ConfinedArgv> {
    signal?.throwIfAborted()
    try {
      // The sandbox must exist before it can stand as the boundary.
      await this.ctx.e2b.ready
      signal?.throwIfAborted()
      if (argv.length === 0) throw new Error('E2B confinement requires a non-empty argv')
      return { argv: [...argv], enforcement: 'full', denialSignatures: [], runnerFailureRules: [] }
    } catch (error) {
      signal?.throwIfAborted()
      throw new SandboxUnavailableError(policy.mode, error instanceof Error ? error.message : String(error))
    }
  }
}

export default E2bSandboxProvider
