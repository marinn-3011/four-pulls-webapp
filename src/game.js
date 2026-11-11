/** Pure rules for the Four Pulls review desk. No DOM. */

export const COLS = 4
export const CELL_COUNT = 12
export const REVIEWS = 3
export const ROUNDS_PER_PULL = 3
export const STAMP_MS = 900

export const FILES = [
  'auth.js',
  'readme.md',
  'ci.yml',
  'button.css',
  'nav.js',
  'form.html',
  'theme.css',
  'store.js',
  'api.js',
  'card.css',
  'lint.yml',
  'hero.js',
]

export const PULLS = [
  {
    id: 1,
    bugs: 3,
    decoys: 0,
    seconds: 8,
    shuffle: false,
    moveEveryMs: 0,
    review: 'Only the red bugs.',
  },
  {
    id: 2,
    bugs: 3,
    decoys: 2,
    seconds: 7,
    shuffle: false,
    moveEveryMs: 0,
    review: 'Red bugs only. Leave the yellow notes.',
  },
  {
    id: 3,
    bugs: 4,
    decoys: 2,
    seconds: 7,
    shuffle: true,
    moveEveryMs: 0,
    review: 'The files will swap once. Stay with the red bugs.',
  },
  {
    id: 4,
    bugs: 3,
    decoys: 2,
    seconds: 8,
    shuffle: false,
    moveEveryMs: 800,
    review: 'The marks move. Follow the red bugs.',
  },
]

export const SCORE = {
  bug: 100,
  round: 50,
  pull: 200,
  ceremony: 500,
}

export function mulberry32(seed) {
  let a = seed >>> 0
  return function rng() {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(list, rng) {
  const next = [...list]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = next[i]
    next[i] = next[j]
    next[j] = tmp
  }
  return next
}

export function kindSignature(cells) {
  return cells.map((cell) => cell.kind).join('')
}

export function dealCells(config, rng) {
  const cells = FILES.map((file) => ({
    file,
    kind: 'empty',
    cleared: false,
    struck: false,
  }))
  const order = shuffle([...Array(CELL_COUNT).keys()], rng)
  let cursor = 0
  for (let i = 0; i < config.bugs; i += 1) cells[order[cursor++]].kind = 'bug'
  for (let i = 0; i < config.decoys; i += 1) cells[order[cursor++]].kind = 'decoy'
  return cells
}

function forcedOrder(cells, sources) {
  const order = [...sources]
  const bugAt = sources.findIndex((index) => cells[index].kind === 'bug')
  const decoyAt = sources.findIndex((index) => cells[index].kind === 'decoy')
  if (bugAt >= 0 && decoyAt >= 0) {
    const tmp = order[bugAt]
    order[bugAt] = order[decoyAt]
    order[decoyAt] = tmp
    return order
  }
  const markAt = sources.findIndex((index) => cells[index].kind !== 'empty')
  const emptyAt = sources.findIndex((index) => cells[index].kind === 'empty')
  if (markAt >= 0 && emptyAt >= 0) {
    const tmp = order[markAt]
    order[markAt] = order[emptyAt]
    order[emptyAt] = tmp
    return order
  }
  return null
}

/**
 * Rearrange live files. Pull 3 trades marks with each other.
 * Pull 4 can also trade a mark with a clean file, so the bug hops.
 * The whole cell travels, name included. Cleared files stay put.
 */
export function relocateMarks(cells, rng, allowEmpty) {
  const sources = []
  cells.forEach((cell, index) => {
    if (cell.cleared) return
    if (allowEmpty || cell.kind !== 'empty') sources.push(index)
  })
  const markCount = sources.filter((index) => cells[index].kind !== 'empty').length
  if (markCount < 1) return cells.map((cell) => ({ ...cell }))
  if (!allowEmpty && markCount < 2) return cells.map((cell) => ({ ...cell }))
  if (allowEmpty && sources.length < 2) return cells.map((cell) => ({ ...cell }))

  const original = kindSignature(cells)
  const objects = sources.map((index) => ({ ...cells[index] }))
  let order = null
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = shuffle(sources, rng)
    if (candidate.every((index, i) => index === sources[i])) continue
    const preview = cells.map((cell) => ({ ...cell }))
    sources.forEach((index, i) => {
      preview[candidate[i]] = { ...objects[i] }
    })
    if (kindSignature(preview) !== original) {
      order = candidate
      break
    }
  }
  if (!order) order = forcedOrder(cells, sources)
  if (!order) return cells.map((cell) => ({ ...cell }))

  const next = cells.map((cell) => ({ ...cell }))
  sources.forEach((index, i) => {
    next[order[i]] = { ...objects[i] }
  })
  return next
}

function resolveRng(options) {
  if (typeof options.rng === 'function') return options.rng
  const seed = Number.isFinite(options.seed) ? options.seed : Math.floor(Math.random() * 0xffffffff)
  return mulberry32(seed)
}

export function idleState() {
  return {
    status: 'idle',
    pull: 1,
    round: 1,
    reviews: REVIEWS,
    score: 0,
    combo: 1,
    cells: [],
    reviewLine: 'Press play. The review will tell you which files to mark.',
    notice: '',
    startedAt: 0,
    durationMs: PULLS[0].seconds * 1000,
    shuffleAt: null,
    shuffled: false,
    moveEveryMs: 0,
    nextMoveAt: null,
    stampUntil: 0,
    pendingPull: null,
    pullsCleared: 0,
    rng: null,
  }
}

function beginRound(state, now, pull, round, notice = '') {
  const config = PULLS[pull - 1]
  const durationMs = config.seconds * 1000
  return {
    ...state,
    status: 'playing',
    pull,
    round,
    cells: dealCells(config, state.rng),
    reviewLine: config.review,
    notice,
    startedAt: now,
    durationMs,
    shuffleAt: config.shuffle ? now + durationMs / 2 : null,
    shuffled: false,
    moveEveryMs: config.moveEveryMs,
    nextMoveAt: config.moveEveryMs ? now + config.moveEveryMs : null,
    stampUntil: 0,
    pendingPull: null,
  }
}

export function start(options = {}) {
  const now = options.now ?? 0
  const base = idleState()
  base.rng = resolveRng(options)
  base.reviews = REVIEWS
  base.score = 0
  base.combo = 1
  base.pullsCleared = 0
  return beginRound(base, now, 1, 1, '')
}

function spendReview(state, notice) {
  const reviews = state.reviews - 1
  if (reviews <= 0) {
    return {
      ...state,
      reviews: 0,
      combo: 1,
      status: 'over',
      notice,
      reviewLine: 'The reviews ran out.',
    }
  }
  return { ...state, reviews, combo: 1, notice }
}

function clearRound(state, now) {
  const score = state.score + SCORE.round
  if (state.round < ROUNDS_PER_PULL) {
    return beginRound({ ...state, score }, now, state.pull, state.round + 1, '')
  }
  const pullsCleared = state.pullsCleared + 1
  const withPull = { ...state, score: score + SCORE.pull, pullsCleared }
  if (state.pull >= PULLS.length) {
    return {
      ...withPull,
      status: 'ceremony',
      score: withPull.score + SCORE.ceremony,
      reviewLine: 'Four pulls merged. The month is closed.',
      notice: '',
      stampUntil: 0,
      pendingPull: null,
    }
  }
  return {
    ...withPull,
    status: 'stamp',
    stampUntil: now + STAMP_MS,
    reviewLine: 'Merged.',
    notice: '',
    pendingPull: state.pull + 1,
  }
}

export function openBugs(state) {
  return state.cells.reduce(
    (count, cell) => count + (cell.kind === 'bug' && !cell.cleared ? 1 : 0),
    0,
  )
}

export function clickCell(state, index, now = state.startedAt) {
  if (state.status !== 'playing') return state
  if (!Number.isInteger(index) || index < 0 || index >= state.cells.length) return state
  const cell = state.cells[index]
  if (cell.cleared || cell.struck) return state

  if (cell.kind === 'bug') {
    const cells = state.cells.map((item, i) =>
      i === index ? { ...item, cleared: true } : item,
    )
    const next = {
      ...state,
      cells,
      score: state.score + SCORE.bug * state.combo,
      combo: state.combo + 1,
      notice: '',
    }
    if (cells.some((item) => item.kind === 'bug' && !item.cleared)) return next
    return clearRound(next, now)
  }

  const struck = {
    ...state,
    cells: state.cells.map((item, i) => (i === index ? { ...item, struck: true } : item)),
  }
  const notice = cell.kind === 'decoy' ? 'That note stays.' : 'That file was clean.'
  return spendReview(struck, notice)
}

export function tick(state, now) {
  if (state.status === 'stamp') {
    if (now < state.stampUntil) return state
    return beginRound(state, now, state.pendingPull, 1, '')
  }
  if (state.status !== 'playing') return state

  let next = state
  const deadline = next.startedAt + next.durationMs

  if (next.shuffleAt != null && !next.shuffled && now >= next.shuffleAt && now < deadline) {
    const cells = relocateMarks(next.cells, next.rng, false)
    const changed = kindSignature(cells) !== kindSignature(next.cells)
    next = {
      ...next,
      cells,
      shuffled: true,
      notice: changed ? 'Files swapped.' : next.notice,
    }
  }

  if (next.moveEveryMs && next.nextMoveAt != null && now < deadline) {
    let guard = 0
    while (now >= next.nextMoveAt && guard < 20) {
      const cells = relocateMarks(next.cells, next.rng, true)
      next = {
        ...next,
        cells,
        nextMoveAt: next.nextMoveAt + next.moveEveryMs,
        notice: 'The marks moved.',
      }
      guard += 1
    }
  }

  if (now >= next.startedAt + next.durationMs) {
    const bugsLeft = next.cells.some((cell) => cell.kind === 'bug' && !cell.cleared)
    if (!bugsLeft) return next
    const spent = spendReview(next, 'Time is up.')
    if (spent.status === 'over') return spent
    return beginRound(spent, now, next.pull, next.round, 'Time is up. New files.')
  }

  return next
}

export function timeLeftMs(state, now) {
  if (state.status !== 'playing') return 0
  return Math.max(0, state.startedAt + state.durationMs - now)
}
