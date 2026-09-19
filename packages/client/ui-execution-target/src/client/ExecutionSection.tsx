/**
 * Execution settings section: the Local / E2B Cloud default plus the E2B API
 * key form. Drafts (picked world, key input) are component-local state; the
 * stored default, key presence, and busy/error/notice facts arrive through the
 * injected snapshot. Nothing model-facing is registered here.
 */

import { useState, type ReactNode } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import { apiKeyFailure } from './apiKey.ts'
import type { ExecutionKey } from './locales.ts'
import type { ExecutionOperations } from './operations.ts'
import type { ExecutionSectionState, ExecutionTarget } from './store.ts'
import classes from './ExecutionSection.module.css'

/** Injected business face: controller, operations, bound snapshot hook, and copy. */
export interface ExecutionSectionInjected {
  /** Section controller owning the stored snapshot. */
  controller: { load(): Promise<void>; saveDefault(target: ExecutionTarget): Promise<void>; saveKey(value: string): Promise<void>; removeKey(): Promise<void> }
  /** Host operations bound in the apply world. */
  operations: ExecutionOperations
  /** Bound snapshot source; the renderer supplies the `useExecution` seat. */
  hooks: { execution: SnapshotStore<ExecutionSectionState> }
  /** Bound copy for this section's dictionary namespace. */
  t: (key: ExecutionKey) => string
}

/** Props delivered by the slot outlet: the inject face spread flat. */
export type ExecutionSectionProps = Partial<InjectFace<ExecutionSectionInjected>>

type ExecutionSectionFace = InjectFace<ExecutionSectionInjected>

/**
 * Render the Execution section.
 * @param props - the injected face (null when the outlet has not bound it yet).
 * @returns the section, or null before binding.
 */
export function ExecutionSection(props: ExecutionSectionProps): ReactNode {
  const { controller, useExecution, t } = props
  if (controller === undefined || useExecution === undefined || t === undefined) return null
  return <Loaded injected={{ controller, useExecution, t }} />
}

function Loaded({ injected }: { injected: Pick<ExecutionSectionFace, 'controller' | 'useExecution' | 't'> }): ReactNode {
  const { controller, useExecution, t } = injected
  const state = useExecution(snapshot => snapshot)
  const [world, setWorld] = useState<ExecutionTarget | undefined>(undefined)
  const [keyDraft, setKeyDraft] = useState('')
  const picked = world ?? state.defaultTarget
  const fieldFailure = apiKeyFailure(keyDraft)

  const saveDefault = (): void => {
    if (state.busy || !state.writable) return
    void controller.saveDefault(picked)
  }
  const saveKey = (): void => {
    if (state.busy || fieldFailure !== undefined) return
    const value = keyDraft.trim()
    setKeyDraft('')
    void controller.saveKey(value)
  }
  const removeKey = (): void => {
    if (state.busy) return
    void controller.removeKey()
  }

  return (
    <section className={classes.section} aria-label={t('title')}>
      <h2 className={classes.title}>{t('title')}</h2>
      <p className={classes.blurb}>{t('blurb')}</p>
      <fieldset className={classes.choices}>
        <label className={`${classes.card} ${picked === 'local' ? classes.cardPicked : ''}`}>
          <input
            type="radio"
            name="execution-target"
            checked={picked === 'local'}
            disabled={state.busy}
            onChange={() => { setWorld('local') }}
          />
          <span>
            <span className={classes.cardName}>{t('localName')}</span>
            <span className={classes.cardBlurb}>{t('localBlurb')}</span>
          </span>
        </label>
        <label className={`${classes.card} ${picked === 'e2b-cloud' ? classes.cardPicked : ''}`}>
          <input
            type="radio"
            name="execution-target"
            checked={picked === 'e2b-cloud'}
            disabled={state.busy}
            onChange={() => { setWorld('e2b-cloud') }}
          />
          <span>
            <span className={classes.cardName}>{t('cloudName')}</span>
            <span className={classes.cardBlurb}>{t('cloudBlurb')}</span>
          </span>
        </label>
      </fieldset>
      {picked === 'e2b-cloud' ? (
        <div className={classes.keyForm}>
          <label className={classes.keyLabel} htmlFor="e2b-api-key">{t('keyLabel')}</label>
          <div className={classes.keyRow}>
            <input
              id="e2b-api-key"
              className={classes.keyInput}
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={t('keyPlaceholder')}
              value={keyDraft}
              disabled={state.busy}
              onChange={(event) => { setKeyDraft(event.target.value) }}
            />
            <button type="button" className={classes.primary} disabled={state.busy || fieldFailure !== undefined || keyDraft.length === 0} onClick={saveKey}>
              {t('saveKey')}
            </button>
            <button type="button" className={classes.ghost} disabled={state.busy || !state.keyStored} onClick={removeKey}>
              {t('removeKey')}
            </button>
          </div>
          {fieldFailure !== undefined && keyDraft.length > 0 ? <p className={classes.error}>{t(fieldFailure)}</p> : null}
          <p className={classes.keyStatus}>{state.keyStored ? t('keyStored') : t('keyMissing')}</p>
        </div>
      ) : null}
      <div className={classes.actions}>
        <button
          type="button"
          className={classes.primary}
          disabled={state.busy || !state.writable || picked === state.defaultTarget}
          onClick={saveDefault}
        >
          {state.busy ? t('saving') : t('saveDefault')}
        </button>
      </div>
      {state.error !== null ? <p className={classes.error}>{state.error === 'refused' || state.error === 'conflict' ? t(state.error) : state.error}</p> : null}
      {state.notice !== null ? <p className={classes.notice}>{t(state.notice)}</p> : null}
    </section>
  )
}
