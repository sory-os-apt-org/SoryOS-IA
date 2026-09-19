/**
 * Execution-target settings plugin, browser half. It registers the Execution
 * section — a Local / E2B Cloud default plus the E2B API key form — beside,
 * never inside, the Models page. The Host settings and credential contracts
 * stay behind their existing wire APIs.
 * Export discipline:
 * packages/client/AGENTS.md.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the ctx.remote merge and the forwarded-event key face
// (settings/credentials invalidations ride the allowlist) into this program.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { ExecutionSection } from './ExecutionSection.tsx'
import type { ExecutionSectionInjected } from './ExecutionSection.tsx'
import { decodeExecutionSection, ExecutionSettingsStore } from './store.ts'
import { createExecutionOperations, EXECUTION_SETTINGS_NAMESPACE } from './operations.ts'
import { en, fr, zh, type ExecutionKey } from './locales.ts'

export type { ExecutionSectionInjected, ExecutionSectionProps } from './ExecutionSection.tsx'
export type { ExecutionKey } from './locales.ts'
export type { ExecutionOperations } from './operations.ts'
export type { ExecutionSectionState, ExecutionTarget } from './store.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Execution section copy. */
    'settings.execution': ExecutionKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.execution'

/**
 * Refetch the section snapshot only after its first load: an unopened
 * Execution page must not fetch on background invalidations.
 * @param controller - the section store.
 */
export function refreshIfLoaded(controller: ExecutionSettingsStore): void {
  if (controller.store.getSnapshot().status === 'idle') return
  void controller.load()
}

/**
 * Required services (cordis fiber inject). The target slot is declared by
 * ui-settings' apply, whose activation order relative to this one is NOT
 * constrained; registration depends on each slot through `slots.inject()`.
 */
export const inject = [
  'slots', 'locale', 'remote', 'remote.credentials', 'remote.settings', 'settingsScope',
]

/**
 * Register the Execution section once the `settings.section` declaration is
 * on the ledger, wire its store to the connection, and keep it fresh on every
 * pushed invalidation (settings or credentials).
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, fr }), 'ui-execution-target: copy dictionaries')

  // Bound once here, where the Remote namespaces are declared in this plugin's
  // own `inject`; the section receives callbacks and never a context.
  const operations = createExecutionOperations(ctx)
  const scope = ctx.settingsScope.bind({ namespace: EXECUTION_SETTINGS_NAMESPACE, decode: decodeExecutionSection })
  const controller = new ExecutionSettingsStore(ctx, scope, operations)
  // Registration-time text (the nav label thunk) and the inject face share
  // one bound translate; copy freshness rides the locale revision.
  const t = ctx.locale.bind(NS) as ExecutionSectionInjected['t']
  const injected = (): ExecutionSectionInjected => ({
    controller,
    hooks: { execution: controller.store },
    operations,
    t,
  })

  ctx.effect(() => {
    const refresh = (): void => { refreshIfLoaded(controller) }
    const disposers = [
      ctx.remote.$on('settings/document-updated', () => { refresh() }),
      ctx.remote.$on('credentials/reference-updated', refresh),
      ctx.on('connection/reset', refresh),
    ]
    return () => {
      controller.dispose()
      void scope.dispose()
      for (const dispose of disposers) dispose()
    }
  }, 'ui-execution-target: pushed invalidations')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'execution',
    order: 20,
    label: () => t('nav'),
    inject: injected,
  }, ExecutionSection))
}
