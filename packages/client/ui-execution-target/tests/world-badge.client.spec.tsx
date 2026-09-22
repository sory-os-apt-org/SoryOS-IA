// @vitest-environment jsdom
/** Session-header world badge renders the live Host world as a read-only tag. */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { RemoteHostFacts } from '@deepseek-ai/dsh-api-remotes/client'
import { WorldBadge, type WorldBadgeProps } from '../src/client/WorldBadge.tsx'
import { en } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
})

const t: WorldBadgeProps['t'] = makeTranslate(en)

function facts(executionWorld: RemoteHostFacts['executionWorld']): RemoteHostFacts {
  return { home: undefined, executionWorld, isLoopback: true }
}

function props(world: RemoteHostFacts['executionWorld']): WorldBadgeProps {
  function useHostInfo<T>(select: (snapshot: RemoteHostFacts) => T): T {
    return select(facts(world))
  }
  return { useHostInfo, t } as unknown as WorldBadgeProps
}

describe('WorldBadge', () => {
  it('renders the neutral Local tag for the local world', () => {
    render(<WorldBadge {...props('local')} />)
    const tag = screen.getByText('Local')
    expect(tag.getAttribute('data-tone')).toBe('neutral')
  })

  it('renders the info E2B Cloud tag for the cloud world', () => {
    render(<WorldBadge {...props('e2b-cloud')} />)
    const tag = screen.getByText('E2B Cloud')
    expect(tag.getAttribute('data-tone')).toBe('info')
  })

  it('renders nothing before the ready frame arrives', () => {
    const { container } = render(<WorldBadge {...props(undefined)} />)
    expect(container.innerHTML).toBe('')
  })
})
