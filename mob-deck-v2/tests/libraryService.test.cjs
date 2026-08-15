const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  configureLibraryService,
  getLibraryStatus,
  listGames,
  refreshLibrary,
} = require('../apps/desktop/services/libraryService.cjs')

test('library service boots from the shared seed instead of an empty list', async (t) => {
  const dataDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'gravity-deck-library-'))
  t.after(() => fs.rm(dataDirectory, { recursive: true, force: true }))

  configureLibraryService({ dataDirectory })
  const games = await listGames()
  const status = getLibraryStatus()

  assert.ok(games.length > 0)
  assert.equal(status.ok, true)
  assert.equal(status.refresh.source, 'seed')
})

test('library refresh preserves the current seed when a scan finds no games', async (t) => {
  const dataDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'gravity-deck-library-'))
  t.after(() => fs.rm(dataDirectory, { recursive: true, force: true }))

  configureLibraryService({ dataDirectory })
  const before = await listGames()
  const emptyRoot = path.join(dataDirectory, 'empty-root')
  await fs.mkdir(emptyRoot)
  const result = await refreshLibrary({
    roots: [emptyRoot],
    includeApps: false,
  })

  assert.equal(result.ok, true)
  assert.equal(result.games.length, before.length)
  assert.equal(result.refresh.gamesFound, 0)
})
