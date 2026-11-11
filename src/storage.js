/** Scores stay in this browser. GitHub Pages never sees them. */

const KEY = 'four-pulls-board'

export function emptySave() {
  return { merged: 0, best: 0, board: [] }
}

function sanitize(data) {
  const board = Array.isArray(data?.board) ? data.board : []
  return {
    merged: Number.isFinite(Number(data?.merged)) ? Number(data.merged) : 0,
    best: Number.isFinite(Number(data?.best)) ? Number(data.best) : 0,
    board: board
      .filter((row) => row && typeof row.initials === 'string' && Number.isFinite(Number(row.score)))
      .slice(0, 5)
      .map((row) => ({
        initials: row.initials.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3),
        score: Number(row.score),
      })),
  }
}

export function loadSave(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return { save: emptySave(), ok: true }
    return { save: sanitize(JSON.parse(raw)), ok: true }
  } catch {
    return { save: emptySave(), ok: false }
  }
}

export function writeSave(save, storage = globalThis.localStorage) {
  const next = sanitize(save)
  try {
    storage.setItem(KEY, JSON.stringify(next))
    return { save: next, ok: true }
  } catch {
    return { save: next, ok: false }
  }
}

export function cleanInitials(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3)
}

export function recordRun(save, { addMerged = 0, score = null, initials = null } = {}) {
  const next = {
    merged: save.merged + addMerged,
    best: score == null ? save.best : Math.max(save.best, score),
    board: save.board.map((row) => ({ ...row })),
  }
  const letters = cleanInitials(initials)
  if (letters.length === 3 && score != null && score > 0) {
    next.board.push({ initials: letters, score })
    next.board.sort((a, b) => b.score - a.score)
    next.board = next.board.slice(0, 5)
  }
  return next
}
