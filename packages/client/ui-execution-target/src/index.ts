/** Host registration for the durable execution-target settings section. */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-settings'
import {
  DEFAULT_EXECUTION_TARGET, EXECUTION_SETTINGS_NAMESPACE, EXECUTION_TARGETS,
} from './execution-settings.ts'

/** Durable execution section; also the wire envelope the browser scope validates against. */
const ExecutionTargetSettingsSchema = z.object({
  default: z.union([...EXECUTION_TARGETS]).default(DEFAULT_EXECUTION_TARGET),
})

/**
 * Register the durable execution-target section when the optional settings
 * service is composed. Without this registration every Host write to the
 * namespace is refused (`not registered`) and the section stays unwritable.
 * @param ctx - Host context that may acquire the settings service.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(EXECUTION_SETTINGS_NAMESPACE, ExecutionTargetSettingsSchema)
  })
}
