/** Confinement resolves at the sandbox boundary with no invented denials. */
import { Context, Service } from '@deepseek-ai/cordis'
import { SandboxUnavailableError, type SandboxPolicy } from '@deepseek-ai/dsh-sandbox'
import { describe, expect, it, onTestFinished } from 'vitest'
import { E2bSandboxProvider } from '../src/index.ts'

const policy: SandboxPolicy = { mode: 'workspace-write', workspaceRoot: '/ws' }

const state = {
  ready: Promise.resolve({ workspace: '/ws' }) as Promise<{ workspace: string }>,
}

class StubE2b extends Service {
  readonly ready = state.ready
  constructor(ctx: Context) { super(ctx, 'e2b') }
}

async function setup(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(StubE2b)
  const fiber = await ctx.plugin(E2bSandboxProvider)
  onTestFinished(async () => { await fiber.dispose() })
  return ctx
}

describe('E2B sandbox provider', () => {
  it('passes argv through with full boundary enforcement and no dialects', async () => {
    const ctx = await setup()
    const argv = ['bash', '-c', 'echo hello']
    await expect(ctx.sandbox.confine(argv, policy)).resolves.toEqual({
      argv,
      enforcement: 'full',
      denialSignatures: [],
      runnerFailureRules: [],
    })
  })

  it('fails closed when the sandbox never becomes ready', async () => {
    state.ready = Promise.reject(new Error('no sandbox'))
    try {
      const ctx = await setup()
      await expect(ctx.sandbox.confine(['true'], policy)).rejects.toBeInstanceOf(SandboxUnavailableError)
    } finally {
      state.ready = Promise.resolve({ workspace: '/ws' })
    }
  })
})
