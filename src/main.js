import { clickCell, idleState, REVIEWS, start, tick, timeLeftMs } from './game.js'
import { cleanInitials, emptySave, loadSave, recordRun, writeSave } from './storage.js'

const els = {
  merged: document.querySelector('#stat-merged'),
  best: document.querySelector('#stat-best'),
  reviews: document.querySelector('#stat-reviews'),
  screen: document.querySelector('#screen'),
  still: document.querySelector('#still'),
  play: document.querySelector('#play'),
  live: document.querySelector('#live'),
  list: document.querySelector('#score-list'),
  empty: document.querySelector('#score-empty'),
  storageNote: document.querySelector('#storage-note'),
  nav: document.querySelector('#site-nav'),
  navToggle: document.querySelector('#nav-toggle'),
}

const loaded = loadSave()
let save = loaded.save
let storageOk = loaded.ok
let state = idleState()
let credited = 0
let recorded = false
let savedInitials = false
let deskKey = ''
let focusIndex = 0

const numberFormat = new Intl.NumberFormat('en-US')

function formatScore(value) {
  return numberFormat.format(value)
}

function persist(next) {
  const written = writeSave(next)
  save = written.save
  storageOk = written.ok
  renderBoard()
  renderStats()
}

function renderStats() {
  const liveScore = state.status === 'idle' ? 0 : state.score
  els.merged.textContent = formatScore(save.merged)
  els.best.textContent = formatScore(Math.max(save.best, liveScore))
  els.reviews.textContent = String(state.reviews)
}

function renderBoard() {
  els.storageNote.hidden = storageOk
  els.list.replaceChildren()
  const rows = save.board.filter((row) => row.initials)
  els.empty.hidden = rows.length > 0
  for (const row of rows) {
    const item = document.createElement('li')
    const name = document.createElement('span')
    const score = document.createElement('span')
    name.textContent = row.initials
    score.textContent = formatScore(row.score)
    item.append(name, score)
    els.list.append(item)
  }
}

function watchProgress() {
  if (state.pullsCleared > credited) {
    const delta = state.pullsCleared - credited
    credited = state.pullsCleared
    persist(recordRun(save, { addMerged: delta }))
  }
  if ((state.status === 'ceremony' || state.status === 'over') && !recorded) {
    recorded = true
    persist(recordRun(save, { score: state.score }))
  }
}

function cellLabel(cell) {
  if (cell.cleared) return `${cell.file}, bug, marked`
  if (cell.struck && cell.kind === 'decoy') return `${cell.file}, note, skipped`
  if (cell.struck) return `${cell.file}, clean file, skipped`
  if (cell.kind === 'bug') return `${cell.file}, bug`
  if (cell.kind === 'decoy') return `${cell.file}, note`
  return `${cell.file}, clean file`
}

function tagFor(cell) {
  if (cell.cleared) return 'Done'
  if (cell.struck) return 'Skip'
  if (cell.kind === 'bug') return 'Bug'
  if (cell.kind === 'decoy') return 'Note'
  return 'File'
}

function onCellClick(index) {
  focusIndex = index
  state = clickCell(state, index, performance.now())
  watchProgress()
  renderStats()
  renderDesk(performance.now())
}

function renderTimer(now) {
  const fill = document.querySelector('#timer-fill')
  const bar = document.querySelector('#timer')
  const readout = document.querySelector('#timer-readout')
  if (!fill || !bar || !readout) return
  if (state.status === 'stamp') {
    fill.style.width = '100%'
    readout.textContent = ''
    bar.setAttribute('aria-valuenow', bar.getAttribute('aria-valuemax') || '0')
    return
  }
  const left = timeLeftMs(state, now)
  const total = state.durationMs || 1
  const pct = state.status === 'playing' ? (left / total) * 100 : 0
  fill.style.width = `${pct}%`
  const seconds = Math.ceil(left / 1000)
  bar.setAttribute('aria-valuenow', String(seconds))
  bar.setAttribute('aria-valuemax', String(Math.round(total / 1000)))
  readout.textContent = `${seconds}s`
}

function resultCopy() {
  if (state.status === 'ceremony') {
    return {
      kicker: 'Merged.',
      title: 'The month is ',
      em: 'closed.',
      detail: 'Four pulls merged. Leave three letters, or play again and the board stays unsigned.',
    }
  }
  const words = ['No pulls', 'One pull', 'Two pulls', 'Three pulls', 'Four pulls']
  return {
    kicker: 'Closed.',
    title: 'The reviews ',
    em: 'ran out.',
    detail: `${words[state.pullsCleared] ?? 'Pulls'} merged before the desk closed.`,
  }
}

function renderResult(parent) {
  const copy = resultCopy()
  const card = document.createElement('div')
  card.className = 'result'
  const kicker = document.createElement('p')
  kicker.className = 'eyebrow'
  kicker.textContent = copy.kicker
  const title = document.createElement('h3')
  title.append(copy.title)
  const em = document.createElement('em')
  em.textContent = copy.em
  title.append(em)
  const score = document.createElement('p')
  score.className = 'result-score'
  score.textContent = formatScore(state.score)
  const detail = document.createElement('p')
  detail.textContent = copy.detail
  card.append(kicker, title, score, detail)

  if (state.score > 0 && !savedInitials) {
    const form = document.createElement('form')
    form.className = 'score-form'
    const label = document.createElement('label')
    label.htmlFor = 'initials'
    label.textContent = 'Three letters for the board.'
    const input = document.createElement('input')
    input.id = 'initials'
    input.name = 'initials'
    input.maxLength = 3
    input.minLength = 3
    input.required = true
    input.autocomplete = 'off'
    input.spellcheck = false
    input.setAttribute('aria-describedby', 'initials-hint')
    label.append(input)
    const hint = document.createElement('span')
    hint.id = 'initials-hint'
    hint.className = 'visually-hidden'
    hint.textContent = 'Letters A to Z or digits. Saved only in this browser.'
    const submit = document.createElement('button')
    submit.className = 'hf-button'
    submit.type = 'submit'
    submit.textContent = 'Save the score'
    form.append(label, hint, submit)
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const letters = cleanInitials(input.value)
      if (letters.length !== 3) {
        input.setCustomValidity('Use three letters or digits.')
        input.reportValidity()
        return
      }
      input.setCustomValidity('')
      savedInitials = true
      persist(recordRun(save, { score: state.score, initials: letters }))
      renderDesk(performance.now())
    })
    card.append(form)
  } else if (savedInitials) {
    const saved = document.createElement('p')
    saved.className = 'saved-line'
    saved.textContent = 'The board has your name.'
    card.append(saved)
  }

  const again = document.createElement('button')
  again.className = 'hf-button'
  again.type = 'button'
  again.textContent = state.status === 'ceremony' ? 'Play the next month' : 'Try the desk again'
  again.addEventListener('click', onPlay)
  card.append(again)
  parent.append(card)
}

function renderPlaying(now) {
  const hud = document.createElement('div')
  hud.className = 'hud'
  const eyebrow = document.createElement('p')
  eyebrow.className = 'eyebrow'
  eyebrow.textContent = `Pull ${String(state.pull).padStart(2, '0')} · Round ${String(state.round).padStart(2, '0')}`
  const score = document.createElement('p')
  score.className = 'hud-score'
  score.textContent = formatScore(state.score)
  hud.append(eyebrow, score)

  const review = document.createElement('p')
  review.className = 'review-line'
  review.setAttribute('aria-live', 'polite')
  review.textContent = state.reviewLine

  const notice = document.createElement('p')
  notice.className = 'notice'
  notice.setAttribute('aria-live', 'polite')
  notice.textContent = state.notice

  const timerRow = document.createElement('div')
  timerRow.className = 'timer-row'
  const bar = document.createElement('div')
  bar.className = 'timer'
  bar.id = 'timer'
  bar.setAttribute('role', 'progressbar')
  bar.setAttribute('aria-label', 'Time left in this round')
  bar.setAttribute('aria-valuemin', '0')
  const fill = document.createElement('span')
  fill.id = 'timer-fill'
  bar.append(fill)
  const readout = document.createElement('p')
  readout.className = 'timer-readout'
  readout.id = 'timer-readout'
  timerRow.append(bar, readout)

  const hexes = document.createElement('ul')
  hexes.className = 'hexes'
  hexes.setAttribute('aria-label', `${state.reviews} of ${REVIEWS} reviews left`)
  for (let i = 0; i < REVIEWS; i += 1) {
    const item = document.createElement('li')
    item.className = i < state.reviews ? 'hex' : 'hex is-spent'
    const mark = document.createElement('i')
    item.append(mark)
    hexes.append(item)
  }

  const grid = document.createElement('div')
  grid.className = 'file-grid'
  grid.id = 'file-grid'
  grid.setAttribute('role', 'group')
  grid.setAttribute('aria-label', 'Files in this pull request')
  if (state.notice === 'Files swapped.') grid.classList.add('is-pop')

  state.cells.forEach((cell, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cell'
    if (cell.cleared) button.classList.add('is-cleared')
    if (cell.struck) button.classList.add('is-struck')
    button.dataset.kind = cell.cleared || cell.struck ? 'done' : cell.kind
    button.dataset.index = String(index)
    button.tabIndex = index === focusIndex ? 0 : -1
    button.setAttribute('aria-label', cellLabel(cell))
    const tag = document.createElement('span')
    tag.className = 'cell-tag'
    tag.textContent = tagFor(cell)
    const file = document.createElement('span')
    file.className = 'cell-file'
    file.textContent = cell.file
    button.append(tag, file)
    button.addEventListener('click', () => onCellClick(index))
    button.addEventListener('focus', () => {
      focusIndex = index
    })
    grid.append(button)
  })

  grid.addEventListener('keydown', (event) => {
    const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
    if (!arrows.includes(event.key)) return
    const buttons = [...grid.querySelectorAll('button')]
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
    let next = focusIndex
    if (event.key === 'ArrowLeft') next -= 1
    if (event.key === 'ArrowRight') next += 1
    if (event.key === 'ArrowUp') next -= cols
    if (event.key === 'ArrowDown') next += cols
    if (next < 0 || next >= buttons.length) return
    event.preventDefault()
    focusIndex = next
    buttons.forEach((button, index) => {
      button.tabIndex = index === next ? 0 : -1
    })
    buttons[next].focus()
  })

  els.live.replaceChildren(hud, review, notice, timerRow, hexes, grid)
  renderTimer(now)
}

function renderDesk(now) {
  const finished = state.status === 'ceremony' || state.status === 'over'
  const live = state.status !== 'idle'
  els.screen.classList.toggle('is-live', live)
  els.still.hidden = live
  els.play.hidden = live
  els.live.hidden = !live
  if (!live) {
    deskKey = 'idle'
    return
  }

  const key = [
    state.status,
    state.pull,
    state.round,
    state.reviews,
    state.score,
    state.combo,
    state.notice,
    state.reviewLine,
    state.pullsCleared,
    savedInitials ? '1' : '0',
    state.cells.map((cell) => `${cell.file}:${cell.kind}:${cell.cleared ? 1 : 0}:${cell.struck ? 1 : 0}`).join('|'),
  ].join('~')

  if (key === deskKey && !finished) {
    renderTimer(now)
    return
  }
  deskKey = key

  if (state.status === 'stamp') {
    renderPlaying(now)
    const stamp = document.createElement('div')
    stamp.className = 'stamp'
    stamp.setAttribute('role', 'status')
    const word = document.createElement('strong')
    word.textContent = 'Merged.'
    stamp.append(word)
    els.live.append(stamp)
    return
  }

  if (finished) {
    els.live.replaceChildren()
    renderResult(els.live)
    if (!savedInitials && state.score > 0) {
      document.querySelector('#initials')?.focus()
    }
    return
  }

  renderPlaying(now)
  const buttons = [...els.live.querySelectorAll('.cell')]
  const target = buttons[focusIndex] ?? buttons[0]
  if (target && document.activeElement === document.body) target.focus()
}

function onPlay() {
  state = start({ now: performance.now() })
  credited = 0
  recorded = false
  savedInitials = false
  focusIndex = state.cells.findIndex((cell) => cell.kind === 'bug')
  if (focusIndex < 0) focusIndex = 0
  deskKey = ''
  watchProgress()
  renderStats()
  renderDesk(performance.now())
  document.querySelector('#file-grid button')?.focus()
}

function setNav(open) {
  els.nav.classList.toggle('is-open', open)
  els.navToggle.setAttribute('aria-expanded', open ? 'true' : 'false')
  els.navToggle.textContent = open ? 'Close' : 'Menu'
}

function bindChrome() {
  els.play.addEventListener('click', onPlay)

  els.navToggle.addEventListener('click', () => {
    setNav(!els.nav.classList.contains('is-open'))
  })

  els.nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setNav(false))
  })

  document.addEventListener('click', (event) => {
    if (!els.nav.classList.contains('is-open')) return
    if (els.nav.contains(event.target) || els.navToggle.contains(event.target)) return
    setNav(false)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setNav(false)
  })

  document.querySelectorAll('[data-open-pr]').forEach((link) => {
    link.addEventListener('click', () => {
      window.setTimeout(() => {
        const target = document.querySelector('#play:not([hidden]), #file-grid button, #initials')
        target?.focus()
      }, 0)
    })
  })
}

function loop(now) {
  const next = tick(state, now)
  if (next !== state) {
    state = next
    watchProgress()
    renderStats()
    renderDesk(now)
  } else if (state.status === 'playing') {
    renderTimer(now)
  }
  requestAnimationFrame(loop)
}

bindChrome()
renderBoard()
renderStats()
requestAnimationFrame(loop)
