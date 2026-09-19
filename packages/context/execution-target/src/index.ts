/**
 * Model-visible execution-world context. The agent learns where its shell
 * commands, file tools, and terminals run — the local machine or the E2B
 * cloud sandbox — from a durable plugin message, so the fact is reconstructable
 * from the session log like every other model input. The message is injected
 * once per world per turn: a session resumed under the other composition
 * re-declares its new world on the next admitted step.
 *
 * @module @deepseek-ai/dsh-execution-target
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionSeq } from '@deepseek-ai/dsh-session'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'execution-target'

/** The agent registry that owns pre-step processing. */
export const inject = ['agents', 'sessionProjections']

/** No deployment configuration: the world is read from the mounted providers. */
export interface Config {}

/** Schemastery validation for {@link Config}. */
export const Config: z<Config> = z.object({})

/** Where one session's tools execute. */
export type ExecutionWorld = 'local' | 'e2b-cloud'

/**
 * Render the model-facing declaration for one world. Model vocabulary only:
 * no UI, transport, or implementation terms.
 * @param world - the active execution world.
 * @param directory - the working directory in that world's spelling.
 * @param canAsk - whether `ask_user_question` is mounted for this agent; the
 * ask policy is stated only then, never as a hallucinated tool.
 * @returns the message text, whose first line carries the machine-readable world marker.
 */
export function renderWorldText(world: ExecutionWorld, directory: string, canAsk: boolean): string {
  const base = world === 'e2b-cloud'
    ? `Execution world: e2b-cloud\n`
      + `Working directory: ${directory}.\n`
      + `Shell commands, file tools, and terminals run inside an isolated cloud sandbox that persists for this session. `
      + `The sandbox filesystem holds only what earlier steps created there; nothing from the operator's machine is visible unless a step put it there.`
    : `Execution world: local\n`
      + `Working directory: ${directory}.\n`
      + `Shell commands, file tools, and terminals run on the operator's own machine.`
  if (!canAsk) return base
  return `${base}\n`
    + `If the task involves long tests or heavy commands and no world was chosen for it, ask the user with ask_user_question `
    + `(options: Local, E2B Cloud) before running. If the user picks the world you are not running in, do not switch silently: `
    + `stop and report how to relaunch instead (local runs by default; cloud runs add the E2B overlay patch to the launch command).`
}

/**
 * Whether the open turn already declares this world. The scan stops at the
 * turn boundary, so a resumed session under the other composition re-declares.
 * @param agent - the live agent owning the session log.
 * @param turn - the open turn number.
 * @param world - the currently mounted world.
 * @param proposed - messages the pre-step chain already admitted.
 * @returns true when the declaration is already present.
 */
export function turnDeclaresWorld(
  agent: Agent,
  turn: number,
  world: ExecutionWorld,
  proposed: readonly { source?: unknown }[],
): boolean {
  const marker = `Execution world: ${world === 'e2b-cloud' ? 'e2b-cloud' : 'local'}`
  const entered = (source: unknown): boolean =>
    typeof source === 'object' && source !== null
    && (source as { kind?: unknown }).kind === 'plugin'
    && (source as { plugin?: unknown }).plugin === name
  for (const message of proposed) {
    const data = message as { content?: readonly { type?: unknown; text?: unknown }[]; source?: unknown }
    if (!entered(data.source)) continue
    for (const block of data.content ?? []) {
      if (block.type === 'text' && typeof block.text === 'string' && block.text.startsWith(marker)) return true
    }
  }
  for (let seq = agent.session.seq - 1; seq >= 0; seq -= 1) {
    // oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read; migration deferred.
    const event = agent.session.eventAt(SessionSeq(seq))
    if (event?.type === 'turn/start' && event.data.turn === turn) return false
    if (event?.type !== 'user/message' || !entered(event.data.source)) continue
    for (const block of event.data.content) {
      if (block.type === 'text' && block.text.startsWith(marker)) return true
    }
  }
  return false
}

/**
 * Resolve the mounted world and its working directory. The E2B connection is
 * optional: its absence means local. An unready E2B connection yields no
 * world so the step proceeds undecorated rather than failing the turn.
 * @param ctx - plugin context for optional service reads.
 * @returns the world and directory, or undefined while E2B is unready.
 */
async function resolveWorld(ctx: Context): Promise<{ world: ExecutionWorld; directory: string } | undefined> {
  const e2b = ctx.get('e2b') as { ready: Promise<{ workspace: string }> } | undefined
  if (e2b === undefined) {
    const fs = ctx.get('fs') as { resolve(path: string): Promise<{ displayPath: string }> } | undefined
    if (fs === undefined) return { world: 'local', directory: process.cwd() }
    try {
      return { world: 'local', directory: (await fs.resolve('.')).displayPath }
    } catch {
      return { world: 'local', directory: process.cwd() }
    }
  }
  const ready = await e2b.ready.catch(() => undefined)
  if (ready === undefined) return undefined
  return { world: 'e2b-cloud', directory: ready.workspace }
}

/**
 * Register a prepended pre-step listener for the lifetime of `ctx`.
 * @param ctx - plugin context; the listener is disposed with it.
 */
export function apply(ctx: Context): void {
  ctx.on('agent/pre-step', async (
    { agent, turn, signal },
    next,
  ): Promise<PreStepDecision> => {
    const decision = await next()
    if (decision.kind === 'reject' || signal.aborted) return decision
    const resolved = await resolveWorld(ctx)
    if (resolved === undefined) return decision
    if (turnDeclaresWorld(agent, turn, resolved.world, decision.messages)) return decision
    const tools = ctx.get('tools') as { get(name: string): unknown } | undefined
    const text = renderWorldText(resolved.world, resolved.directory, tools?.get('ask_user_question') !== undefined)
    return {
      ...decision,
      messages: [
        ...decision.messages,
        createUserMessage({
          content: [{ type: 'text', text }],
          source: { kind: 'plugin', plugin: name, form: 'snapshot', sections: [{ name, text }] },
        }),
      ],
    }
  }, { prepend: true })
}
