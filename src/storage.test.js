import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cleanInitials, emptySave, loadSave, recordRun, writeSave } from './storage.js'

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null
    },
    setItem(key, value) {
      data.set(key, String(value))
    },
  }
}

describe('board storage', () => {
  it('keeps a top five and a best score in the browser store', () => {
    const storage = memoryStorage()
    let save = emptySave()
    save = recordRun(save, { addMerged: 2, score: 400 })
    save = recordRun(save, { score: 900, initials: 'ab1' })
    save = recordRun(save, { score: 100, initials: 'zzz' })
    const written = writeSave(save, storage)
    assert.equal(written.ok, true)
    const loaded = loadSave(storage)
    assert.equal(loaded.save.merged, 2)
    assert.equal(loaded.save.best, 900)
    assert.deepEqual(
      loaded.save.board.map((row) => row.initials),
      ['AB1', 'ZZZ'],
    )
  })

  it('rejects short names and a blocked store', () => {
    assert.equal(cleanInitials(' a-b! '), 'AB')
    const blocked = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
    }
    assert.equal(loadSave(blocked).ok, false)
    assert.equal(writeSave(emptySave(), blocked).ok, false)
  })
})