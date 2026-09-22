/**
 * Session-header world badge: one read-only tag naming where this session's
 * tools run. The world is a composition fact carried on the Host ready frame,
 * so the badge never fetches and updates with the connection generation.
 */

import type { ReactNode } from 'react'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { RemoteHostFacts } from '@deepseek-ai/dsh-api-remotes/client'
import type { HostObservable, InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ExecutionKey } from './locales.ts'

/** Injected Host facts for the world badge. */
export interface WorldBadgeInjected {
  hooks: {
    /**
     * Fixed Host facts, reached through a hook rather than injected as values:
     * the renderer memoizes an entry's inject result for the registration's
     * lifetime, so facts read there would freeze at whatever the first render
     * saw. Select the field the badge needs (`info => info.executionWorld`).
     */
    hostInfo: HostObservable<RemoteHostFacts>
  }
}

/** Full props of the world badge registered in the header utilities row. */
export type WorldBadgeProps =
  PropsRuntime<'conversation.session.header.utilities'>
  & InjectFace<WorldBadgeInjected>
  & {
    /** Bound copy for this badge's dictionary namespace. */
    t: (key: ExecutionKey) => string
  }

/**
 * Render the world badge, or nothing while the ready frame has not arrived.
 * @param props - framework runtime shares, the bound Host-facts hook, and copy.
 * @returns the Local (neutral) or E2B Cloud (info) tag.
 */
export function WorldBadge({ useHostInfo, t }: WorldBadgeProps): ReactNode {
  const world = useHostInfo(info => info.executionWorld)
  if (world === undefined) return null
  const cloud = world === 'e2b-cloud'
  return <Tag tone={cloud ? 'info' : 'neutral'}>{cloud ? t('worldCloud') : t('worldLocal')}</Tag>
}
