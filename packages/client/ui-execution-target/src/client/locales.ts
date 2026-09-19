/**
 * Typed copy for the Execution settings section. Every product-visible string
 * lives here and reaches components through the `t` seat; no hardcoded copy
 * in components.
 * @module @deepseek-ai/dsh-client-ui-execution-target/locales
 */

/** Copy keys owned by the Execution section. */
export type ExecutionKey =
  | 'nav'
  | 'title'
  | 'blurb'
  | 'localName'
  | 'localBlurb'
  | 'cloudName'
  | 'cloudBlurb'
  | 'keyLabel'
  | 'keyPlaceholder'
  | 'keyStored'
  | 'keyMissing'
  | 'keyBlank'
  | 'keyIllegalCharacters'
  | 'saveKey'
  | 'removeKey'
  | 'saveDefault'
  | 'saved'
  | 'conflict'
  | 'refused'
  | 'saving'

/** English copy. */
export const en: Record<ExecutionKey, string> = {
  nav: 'Execution',
  title: 'Execution target',
  blurb: 'Choose where scripts, tests, and commands run. Local uses this machine; E2B Cloud runs them in a managed sandbox. Applies to later sessions.',
  localName: 'Local',
  localBlurb: 'Run on this machine. No key needed.',
  cloudName: 'E2B Cloud',
  cloudBlurb: 'Run in a managed E2B sandbox. Needs an API key below.',
  keyLabel: 'E2B API key',
  keyPlaceholder: 'Paste key to replace the stored one',
  keyStored: 'A key is stored.',
  keyMissing: 'No key stored. Cloud runs will fail until one is saved.',
  keyBlank: 'The key is blank. Paste it again.',
  keyIllegalCharacters: 'That paste is not a key. Paste the bare key value.',
  saveKey: 'Save key',
  removeKey: 'Remove key',
  saveDefault: 'Save default',
  saved: 'Saved.',
  conflict: 'Settings changed elsewhere. Reload and try again.',
  refused: 'The host refused the write.',
  saving: 'Saving…',
}

/** French copy. Missing keys in other packages fall back per-key to English. */
export const fr: Record<ExecutionKey, string> = {
  nav: 'Exécution',
  title: 'Cible d’exécution',
  blurb: 'Choisissez où tournent scripts, tests et commandes. Local utilise cette machine ; E2B Cloud les exécute dans un sandbox géré. S’applique aux sessions suivantes.',
  localName: 'Local',
  localBlurb: 'Exécuter sur cette machine, sans clé.',
  cloudName: 'E2B Cloud',
  cloudBlurb: 'Exécuter dans un sandbox E2B géré, avec la clé API ci-dessous.',
  keyLabel: 'Clé API E2B',
  keyPlaceholder: 'Coller une clé pour remplacer celle stockée',
  keyStored: 'Une clé est stockée.',
  keyMissing: 'Aucune clé stockée. Les exécutions cloud échoueront tant qu’aucune n’est enregistrée.',
  keyBlank: 'La clé est vide, collez-la à nouveau.',
  keyIllegalCharacters: 'Ce collage n’est pas une clé, collez la valeur brute.',
  saveKey: 'Enregistrer la clé',
  removeKey: 'Supprimer la clé',
  saveDefault: 'Enregistrer le défaut',
  saved: 'Enregistré.',
  conflict: 'Réglages modifiés ailleurs, rechargez puis réessayez.',
  refused: 'L’hôte a refusé l’écriture.',
  saving: 'Enregistrement…',
}

/** Chinese copy. */
export const zh: Record<ExecutionKey, string> = {
  nav: '执行',
  title: '执行目标',
  blurb: '选择脚本、测试与命令的运行位置。本地使用本机；E2B 云端在托管沙箱中运行。仅对之后的会话生效。',
  localName: '本地',
  localBlurb: '在本机运行，无需密钥。',
  cloudName: 'E2B 云端',
  cloudBlurb: '在托管 E2B 沙箱中运行，需要在下方保存 API 密钥。',
  keyLabel: 'E2B API 密钥',
  keyPlaceholder: '粘贴密钥以替换已存密钥',
  keyStored: '已存有密钥。',
  keyMissing: '尚未保存密钥，保存前云端运行将失败。',
  keyBlank: '密钥为空，请重新粘贴。',
  keyIllegalCharacters: '粘贴内容不是密钥，请粘贴裸密钥值。',
  saveKey: '保存密钥',
  removeKey: '删除密钥',
  saveDefault: '保存默认',
  saved: '已保存。',
  conflict: '设置已在别处更改，请重载后重试。',
  refused: '主机拒绝了写入。',
  saving: '保存中…',
}
