import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PULLS,
  REVIEWS,
  SCORE,
  CELL_COUNT,
  clickCell,
  idleState,
  kindSignature,
  openBugs,
  start,
  tick,
} from './game.js'

function countKind(state, kind) {
  return state.cells.filter((cell) => cell.kind === kind).length
}

function clearBugs(state, now) {
  let next = state
  let guard = 0
  while (next.status === 'playing' && openBugs(next) > 0 && guard < 30) {
    const index = next.cells.findIndex((cell) => cell.kind === 'bug' && !cell.cleared)
    assert.ok(index >= 0)
    next = clickCell(next, index, now)
    guard += 1
  }
  return next
}

function playUntilPull(target, seed = 1) {
  let state = start({ now: 0, seed })
  let guard = 0
  while (guard < 80) {
    guard += 1
    if (state.status === 'ceremony' || state.status === 'over') return state
    if (state.status === 'playing' && state.pull === target) return state
    if (state.status === 'stamp') {
      state = tick(state, state.stampUntil)
      continue
    }
    state = clearBugs(state, state.startedAt)
  }
  throw new Error(`did not reach pull ${target}`)
}

describe('start', () => {
  it('opens pull 1 with only bugs and three reviews', () => {
    const state = start({ now: 100, seed: 1 })
    assert.equal(state.status, 'playing')
    assert.equal(state.pull, 1)
    assert.equal(state.round, 1)
    assert.equal(state.reviews, REVIEWS)
    assert.equal(state.score, 0)
    assert.equal(state.combo, 1)
    assert.equal(state.cells.length, CELL_COUNT)
    assert.equal(countKind(state, 'bug'), PULLS[0].bugs)
    assert.equal(countKind(state, 'decoy'), 0)
    assert.equal(state.reviewLine, 'Only the red bugs.')
    assert.equal(state.durationMs, 8000)
  })

  it('ignores clicks while idle', () => {
    const idle = idleState()
    assert.equal(clickCell(idle, 0, 0), idle)
  })
})

describe('rounds and scoring', () => {
  it('scores a combo and advances the round when every bug is marked', () => {
    let state = start({ now: 0, seed: 2 })
    const openingRound = state.round
    let guard = 0
    while (state.round === openingRound && openBugs(state) > 0 && guard < 20) {
      const index = state.cells.findIndex((cell) => cell.kind === 'bug' && !cell.cleared)
      state = clickCell(state, index, 0)
      guard += 1
    }
    assert.equal(state.status, 'playing')
    assert.equal(state.round, 2)
    assert.equal(state.pull, 1)
    assert.equal(state.score, 100 + 200 + 300 + SCORE.round)
    assert.equal(state.combo, 4)
  })

  it('does not score a bug twice', () => {
    const state = start({ now: 0, seed: 2 })
    const index = state.cells.findIndex((cell) => cell.kind === 'bug')
    const once = clickCell(state, index, 0)
    const twice = clickCell(once, index, 0)
    assert.equal(twice, once)
    assert.equal(once.score, SCORE.bug)
  })

  it('spends a review on a clean file and ignores the second press', () => {
    const state = start({ now: 0, seed: 3 })
    const index = state.cells.findIndex((cell) => cell.kind === 'empty')
    const once = clickCell(state, index, 0)
    assert.equal(once.reviews, 2)
    assert.equal(once.combo, 1)
    assert.equal(once.score, 0)
    assert.equal(once.notice, 'That file was clean.')
    assert.equal(clickCell(once, index, 0), once)
  })

  it('resets the combo after a mistake', () => {
    const state = start({ now: 0, seed: 3 })
    const bug = state.cells.findIndex((cell) => cell.kind === 'bug')
    const empty = state.cells.findIndex((cell) => cell.kind === 'empty')
    const marked = clickCell(state, bug, 0)
    const missed = clickCell(marked, empty, 0)
    const bugAgain = missed.cells.findIndex((cell) => cell.kind === 'bug' && !cell.cleared)
    const next = clickCell(missed, bugAgain, 0)
    assert.equal(next.score, SCORE.bug + SCORE.bug)
  })

  it('ends the run when the third review is spent', () => {
    let state = start({ now: 0, seed: 4 })
    for (let i = 0; i < 3; i += 1) {
      const index = state.cells.findIndex((cell) => cell.kind === 'empty' && !cell.struck)
      state = clickCell(state, index, 0)
    }
    assert.equal(state.status, 'over')
    assert.equal(state.reviews, 0)
    assert.equal(clickCell(state, 0, 0), state)
  })
})

describe('pulls', () => {
  it('stamps a pull after three rounds and deals decoys on pull 2', () => {
    let state = start({ now: 0, seed: 7 })
    state = clearBugs(state, state.startedAt)
    assert.equal(state.status, 'stamp')
    assert.equal(state.pullsCleared, 1)
    assert.equal(state.reviewLine, 'Merged.')
    const early = tick(state, state.stampUntil - 1)
    assert.equal(early.status, 'stamp')
    state = tick(state, state.stampUntil)
    assert.equal(state.status, 'playing')
    assert.equal(state.pull, 2)
    assert.equal(state.round, 1)
    assert.equal(countKind(state, 'decoy'), PULLS[1].decoys)
  })

  it('spends a review on a yellow note and only once per note', () => {
    const state = playUntilPull(2, 8)
    const index = state.cells.findIndex((cell) => cell.kind === 'decoy')
    assert.ok(index >= 0)
    const once = clickCell(state, index, state.startedAt)
    assert.equal(once.reviews, state.reviews - 1)
    assert.equal(once.notice, 'That note stays.')
    assert.equal(once.score, state.score)
    assert.equal(clickCell(once, index, once.startedAt), once)
  })

  it('shuffles pull 3 once, at half time', () => {
    const state = playUntilPull(3, 9)
    assert.equal(state.pull, 3)
    assert.equal(state.shuffled, false)
    const before = kindSignature(state.cells)
    const mid = tick(state, state.shuffleAt)
    assert.equal(mid.shuffled, true)
    assert.notEqual(kindSignature(mid.cells), before)
    assert.equal(mid.notice, 'Files swapped.')
    const later = tick(mid, state.shuffleAt + 20)
    assert.equal(kindSignature(later.cells), kindSignature(mid.cells))
  })

  it('moves marks on pull 4', () => {
    const state = playUntilPull(4, 11)
    assert.equal(state.pull, 4)
    assert.ok(state.nextMoveAt > state.startedAt)
    const moved = tick(state, state.nextMoveAt)
    assert.notEqual(kindSignature(moved.cells), kindSignature(state.cells))
    assert.equal(moved.notice, 'The marks moved.')
  })

  it('reaches the ceremony with a perfect score', () => {
    let state = start({ now: 0, seed: 21 })
    let guard = 0
    while (state.status !== 'ceremony' && guard < 40) {
      guard += 1
      if (state.status === 'stamp') state = tick(state, state.stampUntil)
      else state = clearBugs(state, state.startedAt)
    }
    const bugs = PULLS.reduce((sum, pull) => sum + pull.bugs * 3, 0)
    const comboScore = (bugs * (bugs + 1) * SCORE.bug) / 2
    const expected =
      comboScore + 12 * SCORE.round + PULLS.length * SCORE.pull + SCORE.ceremony
    assert.equal(state.status, 'ceremony')
    assert.equal(state.pullsCleared, 4)
    assert.equal(state.reviews, REVIEWS)
    assert.equal(state.score, expected)
    assert.equal(bugs, 39)
    assert.equal(expected, 79900)
  })
})

describe('timer', () => {
  it('spends one review and redeals when the clock runs out', () => {
    const state = start({ now: 5000, seed: 6 })
    const before = kindSignature(state.cells)
    const next = tick(state, 5000 + state.durationMs)
    assert.equal(next.status, 'playing')
    assert.equal(next.reviews, 2)
    assert.equal(next.round, 1)
    assert.equal(next.pull, 1)
    assert.equal(next.notice, 'Time is up. New files.')
    assert.equal(next.startedAt, 5000 + state.durationMs)
    assert.notEqual(kindSignature(next.cells), before)
  })

  it('closes the desk after three expired rounds', () => {
    let state = start({ now: 0, seed: 6 })
    for (let i = 0; i < 3; i += 1) {
      state = tick(state, state.startedAt + state.durationMs)
    }
    assert.equal(state.status, 'over')
    assert.equal(state.reviews, 0)
  })
})
