const fs = require('fs/promises')
const fsSync = require('fs')
const path = require('path')

const legacyRoot = path.join(__dirname, '..', '..', '..', '..')
const v2Root = path.join(__dirname, '..', '..', '..')
const legacyScannerRoot = resolveLegacyScannerRoot()
const legacyScannerPath = path.join(legacyScannerRoot, 'scanner.js')
const legacyAppsScannerPath = path.join(legacyScannerRoot, 'apps.js')
const libraryCacheFileName = 'gravity-deck-library-cache.json'
const seedLibraryPath = resolveSeedLibraryPath()

let cachedGames = null
let fullLibrary = new Map()
let libraryDataDirectory = process.env.MOB_DECK_V2_LIBRARY_DATA_DIR || ''
let refreshStatus = createIdleRefreshStatus()

function configureLibraryService(options = {}) {
  const nextDataDirectory = String(options.dataDirectory || libraryDataDirectory || '').trim()

  if (nextDataDirectory !== libraryDataDirectory) {
    cachedGames = null
    fullLibrary = new Map()
  }

  libraryDataDirectory = nextDataDirectory
}

function resolveLegacyScannerRoot() {
  const packagedRoot = process.resourcesPath
    ? path.join(process.resourcesPath, 'legacy-scanner')
    : ''

  if (packagedRoot && fsSync.existsSync(path.join(packagedRoot, 'scanner.js'))) {
    return packagedRoot
  }

  return path.join(legacyRoot, 'src', 'scanner')
}

function resolveSeedLibraryPath() {
  const packagedSeed = process.resourcesPath
    ? path.join(process.resourcesPath, 'shared', 'library.seed.json')
    : ''

  if (packagedSeed && fsSync.existsSync(packagedSeed)) {
    return packagedSeed
  }

  return path.join(v2Root, 'shared', 'library.seed.json')
}

async function listGames() {
  if (cachedGames) {
    return cachedGames
  }

  const loaded = await loadPersistedLibrary()

  cachedGames = loaded.games
  fullLibrary = loaded.fullLibrary

  return cachedGames
}

async function findGameById(id) {
  const games = await listGames()
  const targetId = String(id || '')

  return fullLibrary.get(targetId) || games.find((game) => game.id === targetId) || null
}

async function refreshLibrary(options = {}) {
  if (refreshStatus.state === 'running') {
    return {
      ok: false,
      source: refreshStatus.source,
      games: await listGames(),
      refresh: refreshStatus,
      message: 'Scanner ja esta em execucao no Gravity Deck Host.',
    }
  }

  refreshStatus = createRunningRefreshStatus()

  try {
    const detectedGames = await scanLegacyLibrary(options)

    if (!detectedGames.length) {
      const fallbackGames = await listGames()
      refreshStatus = createCompletedRefreshStatus({
        source: fallbackGames.length ? 'cache-or-seed' : 'empty',
        gamesFound: 0,
        message: fallbackGames.length
          ? 'Scanner nao encontrou jogos reais. Mantendo biblioteca existente.'
          : 'Scanner nao encontrou jogos. Adicione uma pasta ou launcher para preencher a biblioteca.',
      })

      return {
        ok: true,
        source: fallbackGames.length ? 'cache-or-seed' : 'empty',
        games: fallbackGames,
        refresh: refreshStatus,
        message: refreshStatus.message,
      }
    }

    cachedGames = detectedGames.map((game) => toPublicGame(game))
    fullLibrary = new Map(detectedGames.map((game) => [game.id, game]))
    await persistLibrary({
      source: 'legacy-scanner',
      games: cachedGames,
      rawGames: detectedGames,
    })
    refreshStatus = createCompletedRefreshStatus({
      source: 'legacy-scanner',
      gamesFound: cachedGames.length,
      message: `${cachedGames.length} jogo(s) sincronizado(s) pelo scanner antigo.`,
    })

    return {
      ok: true,
      source: 'legacy-scanner',
      games: cachedGames,
      refresh: refreshStatus,
      message: refreshStatus.message,
    }
  } catch (error) {
    const fallbackGames = await listGames()
    refreshStatus = createFailedRefreshStatus(error)

    return {
      ok: false,
      source: fallbackGames.length ? 'cache-or-seed' : 'empty',
      games: fallbackGames,
      refresh: refreshStatus,
      message: refreshStatus.message,
    }
  }
}

async function scanLegacyLibrary(options = {}) {
  const scanner = require(legacyScannerPath)
  const appsScanner = require(legacyAppsScannerPath)
  const roots = options.roots?.length ? options.roots : await getAvailableDriveRoots()
  const byKey = new Map()
  const scanRoots = roots.filter(Boolean)

  refreshStatus = {
    ...refreshStatus,
    totalRoots: scanRoots.length,
  }

  for (const root of scanRoots) {
    refreshStatus = {
      ...refreshStatus,
      scannedRoots: refreshStatus.scannedRoots + 1,
      currentRoot: root,
      message: `Escaneando ${root}`,
    }

    const games = await scanner.scan(root, { log: false, conservative: true })

    for (const game of games) {
      const normalized = normalizeLegacyGame(game)

      if (!normalized) {
        continue
      }

      const existing = byKey.get(normalized.key)

      if (!existing || scoreLegacyGame(normalized.raw) > scoreLegacyGame(existing.raw)) {
        byKey.set(normalized.key, normalized)
      }
    }
  }

  const apps = options.includeApps === false ? [] : await appsScanner.scan()

  for (const app of apps.filter((item) => item.category === 'game')) {
    const normalized = normalizeLegacyGame({
      ...app,
      provider: app.provider === 'app' ? 'launcher' : app.provider,
      reasons: ['app-launcher'],
    })

    if (!normalized || hasGameWithTitle(byKey, normalized.raw.name)) {
      continue
    }

    byKey.set(normalized.key, normalized)
  }

  return [...byKey.values()]
    .map((entry) => entry.raw)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

async function getAvailableDriveRoots() {
  if (process.env.MOB_DECK_V2_SCAN_ROOTS) {
    return process.env.MOB_DECK_V2_SCAN_ROOTS
      .split(/[;,]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  if (process.platform !== 'win32') {
    return [path.parse(process.cwd()).root || '/']
  }

  const roots = []

  for (let code = 65; code <= 90; code += 1) {
    const root = `${String.fromCharCode(code)}:\\`

    try {
      await fs.access(root)
      roots.push(root)
    } catch {
      // Drive letter is not available.
    }
  }

  return roots.length ? roots : [path.parse(process.cwd()).root]
}

function normalizeLegacyGame(game) {
  if (!game?.name) {
    return null
  }

  const id = createGameId(game)
  const source = game.provider || game.source || 'Local'
  const accent = pickAccent(source || game.name)
  const cover = resolveCover(game.cover || game.icon || game.fallbackCover)
    || createGeneratedCoverDataUrl(game.name, source, accent)

  return {
    key: getGameKey(game),
    raw: {
      ...game,
      id,
      title: game.name,
      source,
      platformId: detectProviderId(source),
      status: game.launchUri || game.steamAppId ? 'Launcher correto' : 'Pronto no PC',
      cover,
      accent,
      lastPlayedLabel: game.lastPlayedAt ? 'Recente' : '',
    },
  }
}

function toPublicGame(game) {
  const title = game.title || game.name
  const source = formatProvider(game.source || game.provider)
  const accent = game.accent || pickAccent(game.source || game.provider || game.name)

  return {
    id: game.id,
    title,
    source,
    platformId: game.platformId || detectProviderId(game.source || game.provider),
    status: game.status || 'Pronto no PC',
    cover: game.cover || createGeneratedCoverDataUrl(title, source, accent),
    accent,
    lastPlayedLabel: game.lastPlayedLabel || '',
  }
}

function hasGameWithTitle(byKey, title) {
  const normalizedTitle = normalizeTitle(title)

  for (const entry of byKey.values()) {
    if (normalizeTitle(entry.raw.name) === normalizedTitle) {
      return true
    }
  }

  return false
}

function getGameKey(game) {
  const value = game?.folder || game?.exe || game?.launchUri || game?.name || ''

  return path.resolve(String(value)).toLowerCase()
}

function createGameId(game) {
  const source = String(game.sourceId || game.steamAppId || game.gogAppId || game.exe || game.folder || game.name)

  return normalizeTitle(source).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `game-${hashString(source)}`
}

function resolveCover(value) {
  const cover = String(value || '')

  if (!cover || /^(https?:|data:|file:)/i.test(cover)) {
    return cover
  }

  if (cover.startsWith('/')) {
    return cover
  }

  return `file://${path.join(legacyRoot, cover).replace(/\\/g, '/')}`
}

function createGeneratedCoverDataUrl(title, source, accent) {
  const displayTitle = String(title || 'Jogo').trim() || 'Jogo'
  const safeSource = escapeXml(formatProvider(source || 'Local'))
  const color = normalizeHexColor(accent || pickAccent(source || title))
  const secondary = mixHex(color, '#56d5ec', 0.42)
  const warm = mixHex(color, '#ff8a3d', 0.32)
  const titleLines = splitCoverTitle(displayTitle)
  const lineHeight = 44
  const firstY = 474 - ((titleLines.length - 1) * lineHeight) / 2
  const titleText = titleLines
    .map((line, index) => `<text x="48" y="${firstY + index * lineHeight}" class="title">${line}</text>`)
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
  <defs>
    <radialGradient id="nebula" cx="24%" cy="18%" r="82%">
      <stop offset="0" stop-color="${secondary}" stop-opacity=".74"/>
      <stop offset=".38" stop-color="${color}" stop-opacity=".36"/>
      <stop offset="1" stop-color="#050611"/>
    </radialGradient>
    <linearGradient id="glass" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".18"/>
      <stop offset=".48" stop-color="#ffffff" stop-opacity=".04"/>
      <stop offset="1" stop-color="${warm}" stop-opacity=".18"/>
    </linearGradient>
    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="18" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <style>
      .kicker{fill:#b7c3d7;font:700 24px Arial,sans-serif;letter-spacing:3px;text-transform:uppercase}
      .title{fill:#f6f7ff;font:900 44px Arial,sans-serif;letter-spacing:0}
      .source{fill:#dce5f5;font:800 22px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase}
    </style>
  </defs>
  <rect width="600" height="900" fill="#050611"/>
  <rect width="600" height="900" fill="url(#nebula)"/>
  <circle cx="482" cy="166" r="74" fill="#000" opacity=".76"/>
  <circle cx="482" cy="166" r="112" fill="none" stroke="${secondary}" stroke-opacity=".24" stroke-width="18"/>
  <circle cx="134" cy="720" r="210" fill="${warm}" opacity=".12" filter="url(#softGlow)"/>
  <path d="M-60 254 C116 178 266 206 418 112 C510 55 592 44 682 70" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="2"/>
  <path d="M-40 620 C140 510 290 570 430 450 C510 382 594 374 656 402" fill="none" stroke="${secondary}" stroke-opacity=".22" stroke-width="3"/>
  <g opacity=".7">
    <circle cx="78" cy="90" r="2" fill="#fff"/>
    <circle cx="188" cy="142" r="1.4" fill="#fff"/>
    <circle cx="396" cy="74" r="1.8" fill="#fff"/>
    <circle cx="526" cy="338" r="1.5" fill="#fff"/>
    <circle cx="98" cy="392" r="1.2" fill="#fff"/>
    <circle cx="452" cy="740" r="1.6" fill="#fff"/>
  </g>
  <rect x="30" y="30" width="540" height="840" rx="34" fill="none" stroke="#fff" stroke-opacity=".16"/>
  <rect x="48" y="52" width="176" height="40" rx="20" fill="url(#glass)" stroke="#fff" stroke-opacity=".16"/>
  <text x="68" y="80" class="kicker">GRAVITY</text>
  ${titleText}
  <text x="48" y="806" class="source">${safeSource}</text>
</svg>`

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function splitCoverTitle(value) {
  const words = String(value || 'Jogo').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''

  for (const word of words) {
    const next = line ? `${line} ${word}` : word

    if (next.length > 17 && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }

    if (lines.length === 2) {
      break
    }
  }

  if (line && lines.length < 3) {
    lines.push(line)
  }

  if (!lines.length) {
    lines.push('Jogo')
  }

  return lines.slice(0, 3).map((entry) => escapeXml(entry.length > 19 ? `${entry.slice(0, 18)}...` : entry))
}

function normalizeHexColor(value) {
  const text = String(value || '').trim()

  if (/^#[0-9a-f]{6}$/i.test(text)) {
    return text
  }

  return '#ff8a3d'
}

function mixHex(hex, targetHex, amount) {
  const source = parseHex(hex)
  const target = parseHex(targetHex)
  const mixed = source.map((channel, index) => Math.round(channel + (target[index] - channel) * amount))

  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function parseHex(hex) {
  const value = normalizeHexColor(hex).slice(1)

  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function scoreLegacyGame(game) {
  return Number(game?.confidence || 0)
    + (game?.cover ? 10 : 0)
    + (game?.fallbackCover ? 4 : 0)
    + (Array.isArray(game?.coverSources) ? game.coverSources.length : 0)
}

function normalizeTitle(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatProvider(provider) {
  const providers = {
    steam: 'Steam',
    epic: 'Epic Games',
    gog: 'GOG',
    app: 'App',
    launcher: 'Launcher',
    detected: 'Detectado',
    local: 'Local',
  }

  return providers[String(provider || 'local').toLowerCase()] || provider || 'Local'
}

function detectProviderId(provider) {
  const source = normalizeTitle(provider)

  if (source.includes('steam')) return 'steam'
  if (source.includes('epic')) return 'epic'
  if (source.includes('gog') || source.includes('galaxy')) return 'gog'
  if (source.includes('ea app') || source === 'ea' || source.includes('origin')) return 'ea'
  if (source.includes('ubisoft')) return 'ubisoft'
  if (source.includes('xbox') || source.includes('microsoft') || source.includes('game pass')) return 'xbox'
  if (source.includes('battle net') || source.includes('battlenet') || source.includes('blizzard')) return 'battlenet'
  if (source.includes('itch')) return 'itch'
  if (source.includes('rockstar')) return 'rockstar'

  return 'local'
}

function pickAccent(value) {
  const text = normalizeTitle(value)

  if (text.includes('steam')) return '#48c4d5'
  if (text.includes('epic')) return '#f8fbff'
  if (text.includes('gog')) return '#8b5cf6'
  if (text.includes('rockstar')) return '#d94f30'
  if (text.includes('ubisoft')) return '#21b6d7'

  return '#ff8a3d'
}

function hashString(value) {
  let hash = 0
  const text = String(value || '')

  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0
  }

  return Math.abs(hash).toString(36)
}

async function loadPersistedLibrary() {
  const cache = await readLibraryCache()

  if (cache.games.length) {
    refreshStatus = {
      ...refreshStatus,
      source: cache.source,
      message: `Biblioteca carregada do cache local (${cache.games.length} jogo(s)).`,
    }

    return cache
  }

  const seed = await readSeedLibrary()

  refreshStatus = {
    ...refreshStatus,
    source: seed.games.length ? 'seed' : 'empty',
    message: seed.games.length
      ? `Biblioteca seed carregada (${seed.games.length} jogo(s)).`
      : 'Biblioteca ainda vazia.',
  }

  return seed
}

async function readLibraryCache() {
  const cachePath = getLibraryCachePath()

  if (!cachePath) {
    return createLibraryLoadResult([], [], 'empty')
  }

  try {
    const raw = await fs.readFile(cachePath, 'utf8')
    const parsed = JSON.parse(raw)
    const publicGames = Array.isArray(parsed.games) ? parsed.games.map(toPublicGame).filter(Boolean) : []
    const rawGames = Array.isArray(parsed.rawGames) ? parsed.rawGames : publicGames

    return createLibraryLoadResult(publicGames, rawGames, parsed.source || 'cache')
  } catch {
    return createLibraryLoadResult([], [], 'empty')
  }
}

async function readSeedLibrary() {
  try {
    const raw = await fs.readFile(seedLibraryPath, 'utf8')
    const parsed = JSON.parse(raw)
    const publicGames = Array.isArray(parsed) ? parsed.map(toPublicGame).filter(Boolean) : []

    return createLibraryLoadResult(publicGames, publicGames, publicGames.length ? 'seed' : 'empty')
  } catch {
    return createLibraryLoadResult([], [], 'empty')
  }
}

async function persistLibrary({ source, games, rawGames }) {
  const cachePath = getLibraryCachePath()

  if (!cachePath) {
    return
  }

  await fs.mkdir(path.dirname(cachePath), { recursive: true })
  await fs.writeFile(cachePath, `${JSON.stringify({
    version: 1,
    source,
    updatedAt: new Date().toISOString(),
    games,
    rawGames,
  }, null, 2)}\n`, 'utf8')
}

function createLibraryLoadResult(publicGames, rawGames, source) {
  return {
    source,
    games: publicGames,
    fullLibrary: new Map(rawGames.map((game) => [game.id, game])),
  }
}

function getLibraryCachePath() {
  const baseDirectory = libraryDataDirectory
    || process.env.MOB_DECK_V2_LIBRARY_DATA_DIR
    || ''

  if (!baseDirectory) {
    return ''
  }

  return path.join(baseDirectory, libraryCacheFileName)
}

function getLibraryStatus() {
  return {
    ok: true,
    games: cachedGames || [],
    refresh: refreshStatus,
    message: refreshStatus.message,
  }
}

function createIdleRefreshStatus() {
  return {
    state: 'idle',
    source: 'empty',
    startedAt: '',
    finishedAt: '',
    scannedRoots: 0,
    totalRoots: 0,
    currentRoot: '',
    gamesFound: 0,
    message: 'Biblioteca pronta.',
  }
}

function createRunningRefreshStatus() {
  return {
    state: 'running',
    source: 'legacy-scanner',
    startedAt: new Date().toISOString(),
    finishedAt: '',
    scannedRoots: 0,
    totalRoots: 0,
    currentRoot: '',
    gamesFound: 0,
    message: 'Scanner local iniciado.',
  }
}

function createCompletedRefreshStatus({ source, gamesFound, message }) {
  return {
    ...refreshStatus,
    state: 'completed',
    source,
    finishedAt: new Date().toISOString(),
    currentRoot: '',
    gamesFound,
    message,
  }
}

function createFailedRefreshStatus(error) {
  return {
    ...refreshStatus,
    state: 'failed',
    source: 'empty',
    finishedAt: new Date().toISOString(),
    currentRoot: '',
    message: error?.message || 'Scanner antigo indisponivel.',
  }
}

module.exports = {
  configureLibraryService,
  findGameById,
  getLibraryStatus,
  listGames,
  refreshLibrary,
}
