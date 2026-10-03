/** Luna reacts to submitted prose only: no code, credentials, paths or drafts. */
export function submittedProse(text) {
  return String(text ?? '')
    .replace(/```[\s\S]*?(?:```|$)/g, '')
    .replace(/~~~[\s\S]*?(?:~~~|$)/g, '')
    .replace(/`[^`]*(?:`|$)/g, '')
    .replace(/^(?: {4}|\t).*$/gm, '')
    .replace(/\b(?:sk-[\w-]+|Bearer\s+\S+)\b/gi, '[credential]')
    .replace(/(?:https?:\/\/|[A-Za-z]:\\|\/)[^\s]+/g, '[reference]')
    .trim().slice(0, 2000)
}

export function userOrigin(origin) {
  return origin?.kind === 'composer' || origin?.kind === 'bridge'
}
