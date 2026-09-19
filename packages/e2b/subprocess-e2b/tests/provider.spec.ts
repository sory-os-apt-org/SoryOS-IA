/** E2B subprocesses resolve exit facts (never reject on nonzero) with bounded tails. */
import { Context, Service } from '@deepseek-ai/cordis'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { E2bSubprocessRuntime } from '../src/index.ts'

interface Script {
  exitCode: number
  stdout?: string
  stderr?: string
}

const state = {
  scripts: new Map<string, Script>(),
  sentInputs: [] as string[],
  closedInputs: 0,
  killed: [] as number[],
  ptyInputs: [] as string[],
}

function fakeHandle(outcome: Script, pid = 7): Record<string, unknown> {
  return {
    pid,
    wait: async () => {
      if (outcome.exitCode !== 0) {
        throw { exitCode: outcome.exitCode, stdout: outcome.stdout ?? '', stderr: outcome.stderr ?? '' }
      }
      return { exitCode: 0 }
    },
    kill: async () => {
      state.killed.push(pid)
      return true
    },
    sendStdin: async (data: string | Uint8Array) => {
      state.sentInputs.push(typeof data === 'string' ? data : Buffer.from(data).toString('utf-8'))
    },
    closeStdin: async () => {
      state.closedInputs += 1
    },
    disconnect: async () => {},
  }
}

const fakeCommands = {
  run: vi.fn(async (cmd: string, opts?: {
    background?: boolean; onStdout?: (data: string) => void; onStderr?: (data: string) => void;
  }) => {
    const outcome = state.scripts.get(cmd) ?? { exitCode: 0, stdout: '', stderr: '' }
    if (opts?.background === true) return fakeHandle(outcome)
    if (outcome.exitCode !== 0) {
      throw { exitCode: outcome.exitCode, stdout: outcome.stdout ?? '', stderr: outcome.stderr ?? '' }
    }
    return { exitCode: 0, stdout: outcome.stdout ?? '', stderr: outcome.stderr ?? '' }
  }),
}

const fakePty = {
  create: vi.fn(async (opts: { onData?: (data: Uint8Array) => void }) => {
    opts.onData?.(new Uint8Array([104, 105]))
    return fakeHandle({ exitCode: 0 });
  }),
  sendInput: vi.fn(async (_pid: number, _data: Uint8Array) => {
    state.ptyInputs.push(Buffer.from(_data).toString('utf-8'))
  }),
  resize: vi.fn(async () => {}),
  kill: vi.fn(async () => true),
}

class StubE2b extends Service {
  readonly ready = Promise.resolve({ workspace: '/ws' })
  readonly requestTimeoutMs = 1000
  constructor(ctx: Context) { super(ctx, 'e2b') }
  connection(): unknown {
    return {
      getInfo: async () => ({ envdVersion: '0.9.0' }),
      commands: fakeCommands,
      pty: fakePty,
    }
  }
  async bounded<T>(operation: Promise<T>): Promise<T> {
    return operation
  }
}

beforeEach(() => {
  state.scripts.clear()
  state.sentInputs = []
  state.closedInputs = 0
  state.killed = []
  state.ptyInputs = []
  vi.clearAllMocks()
})

async function setup(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(StubE2b)
  const fiber = await ctx.plugin(E2bSubprocessRuntime)
  onTestFinished(async () => { await fiber.dispose() })
  return ctx
}

function collectSpec(argv: readonly string[], maxBytes = 1024): Parameters<Context['subprocess']['spawn']>[0] {
  return {
    argv, cwd: '/ws', graceMs: 50,
    stdio: { stdin: 'ignore', stdout: { maxBytes }, stderr: { maxBytes } },
  }
}

describe('E2B subprocess provider', () => {
  it('resolves exit facts for success and failure alike', async () => {
    const ctx = await setup()
    const ok = ctx.subprocess.spawn(collectSpec(['echo', 'hi']))
    await expect(ok.done).resolves.toMatchObject({ exitCode: 0, signal: null })
    state.scripts.set(`'false'`, { exitCode: 3, stdout: '', stderr: 'nope' })
    const failed = ctx.subprocess.spawn(collectSpec(['false']))
    await expect(failed.done).resolves.toMatchObject({ exitCode: 3, signal: null })
  })

  it('streams background output into bounded collectors and feeds real stdin', async () => {
    const ctx = await setup()
    const piped = ctx.subprocess.spawn({
      argv: ['cat'], cwd: '/ws', graceMs: 50,
      stdio: { stdin: 'pipe', stdout: { maxBytes: 1024 }, stderr: { maxBytes: 1024 } },
    })
    piped.stdin?.write('early\n')
    piped.stdin?.end()
    await expect(piped.done).resolves.toMatchObject({ exitCode: 0 })
    const batched = ctx.subprocess.spawn({
      argv: ['cat'], cwd: '/ws', graceMs: 50,
      stdio: { stdin: { data: 'batch\n' }, stdout: { maxBytes: 1024 }, stderr: { maxBytes: 1024 } },
    })
    await expect(batched.done).resolves.toMatchObject({ exitCode: 0 })
    expect(state.sentInputs.join('')).toContain('batch\n')
    expect(state.closedInputs).toBeGreaterThan(0)
  })

  it('refuses handle-less shapes loudly', async () => {
    const ctx = await setup()
    expect(() => ctx.subprocess.spawn({ ...collectSpec(['true']), stdio: { stdin: 'ignore', stdout: { maxBytes: 8 }, stderr: { maxBytes: 8 }, control: 'pipe' } }))
      .toThrowError(/control channel/)
    expect(() => ctx.subprocess.spawn(collectSpec([]))).toThrowError(/non-empty argv/)
    await expect(ctx.subprocess.resolveExecutable('')).rejects.toThrowError(/non-empty command/)
    await expect(ctx.subprocess.resolveExecutable('rel/tool')).rejects.toThrowError(/Relative|relative/)
  })

  it('allocates terminals behind the shared handle shape', async () => {
    const ctx = await setup()
    const terminal = await ctx.subprocess.spawnTerminal({
      argv: ['bash'], cwd: '/ws', rows: 24, cols: 80, terminalType: 'xterm-256color', graceMs: 50,
    })
    expect(terminal.pid).toBe(7)
    await terminal.write('ls\n')
    expect(state.ptyInputs.join('')).toContain('ls\n')
    await terminal.resize(100, 30)
    expect(fakePty.resize).toHaveBeenCalledWith(7, { cols: 100, rows: 30 })
    await terminal.terminate()
    await expect(terminal.done).resolves.toMatchObject({ exitCode: 0 })
  })
})
