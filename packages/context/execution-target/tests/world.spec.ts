/** Rendering and declaration-scan for the execution-world context. */
import { describe, expect, it } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { renderWorldText, turnDeclaresWorld } from '../src/index.ts'

const agent = { session: { seq: 0 } } as unknown as Agent

describe('renderWorldText', () => {
  it('declares the local machine with its directory', () => {
    const text = renderWorldText('local', '/home/op/work', false)
    expect(text.startsWith('Execution world: local\n')).toBe(true)
    expect(text).toContain('/home/op/work')
  })

  it('declares the cloud sandbox with its workspace', () => {
    const text = renderWorldText('e2b-cloud', '/home/user/workspace', false)
    expect(text.startsWith('Execution world: e2b-cloud\n')).toBe(true)
    expect(text).toContain('/home/user/workspace')
  })

  it('states the ask policy only when the ask tool is mounted', () => {
    expect(renderWorldText('local', '/w', false)).not.toContain('ask_user_question')
    const asking = renderWorldText('local', '/w', true)
    expect(asking).toContain('ask_user_question')
    expect(asking).toContain('E2B Cloud')
  })

  it('uses model vocabulary only', () => {
    for (const world of ['local', 'e2b-cloud'] as const) {
      const text = renderWorldText(world, '/w', true).toLowerCase()
      expect(text).not.toContain('ctx.')
      expect(text).not.toContain('cordis')
    }
  })
})

describe('turnDeclaresWorld', () => {
  it('finds its own declaration among proposed messages', () => {
    const text = renderWorldText('e2b-cloud', '/home/user/workspace', false)
    const proposed = [{
      content: [{ type: 'text', text }],
      source: { kind: 'plugin', plugin: 'execution-target' },
    }]
    expect(turnDeclaresWorld(agent, 1, 'e2b-cloud', proposed)).toBe(true)
  })

  it('ignores other plugins and other worlds', () => {
    const other = [{
      content: [{ type: 'text', text: renderWorldText('local', '/w', false) }],
      source: { kind: 'plugin', plugin: 'time-context' },
    }]
    expect(turnDeclaresWorld(agent, 1, 'e2b-cloud', other)).toBe(false)
    const stale = [{
      content: [{ type: 'text', text: renderWorldText('local', '/w', false) }],
      source: { kind: 'plugin', plugin: 'execution-target' },
    }]
    expect(turnDeclaresWorld(agent, 1, 'e2b-cloud', stale)).toBe(false)
  })

  it('reports missing declarations on an empty log', () => {
    expect(turnDeclaresWorld(agent, 1, 'local', [])).toBe(false)
  })
})
