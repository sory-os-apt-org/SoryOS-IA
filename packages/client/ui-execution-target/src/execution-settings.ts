/** Shared execution-target settings contract: one namespace, one default field. */

/** The settings namespace carrying the execution default. */
export const EXECUTION_SETTINGS_NAMESPACE = 'execution-target'

/** Field carrying the default world for later sessions. */
export const EXECUTION_DEFAULT_FIELD = 'default'

/** Worlds later sessions may run in. */
export const EXECUTION_TARGETS = ['local', 'e2b-cloud'] as const

/** Where later sessions run their scripts, tests, and commands. */
export type ExecutionTarget = typeof EXECUTION_TARGETS[number]

/** Default world when the user-settings document has no override. */
export const DEFAULT_EXECUTION_TARGET: ExecutionTarget = 'local'

/** Durable execution section shared by the Host schema and the browser scope. */
export interface ExecutionTargetSettings {
  /** Default world for later sessions. */
  readonly default: ExecutionTarget
}
