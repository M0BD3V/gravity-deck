const defaultThumbnailSize = {
  width: 320,
  height: 180,
}

async function listCaptureSources(desktopCapturer, options = {}) {
  if (!desktopCapturer?.getSources) {
    return {
      ok: false,
      sources: [],
      selectedSource: null,
      message: 'Captura de tela indisponivel neste ambiente.',
    }
  }

  try {
    const includeThumbnails = options.includeThumbnails !== false
    const sources = await desktopCapturer.getSources({
      types: options.types || ['window'],
      thumbnailSize: includeThumbnails ? defaultThumbnailSize : { width: 0, height: 0 },
      fetchWindowIcons: false,
    })
    const normalizedSources = sources
      .map((source) => normalizeCaptureSource(source, includeThumbnails))
      .filter((source) => !isIgnoredWindow(source))
    const selectedSource = pickDefaultSource(normalizedSources)

    return {
      ok: true,
      sources: normalizedSources,
      selectedSource,
      message: selectedSource
        ? `${selectedSource.name} pronta para o Gravity Stream.`
        : 'Nenhuma fonte de captura encontrada.',
    }
  } catch (error) {
    return {
      ok: false,
      sources: [],
      selectedSource: null,
      message: error?.message || 'Nao foi possivel listar fontes de captura.',
    }
  }
}

async function getDefaultCaptureSource(desktopCapturer) {
  const result = await listCaptureSources(desktopCapturer, {
    includeThumbnails: false,
    types: ['window'],
  })

  return result.selectedSource
}

async function getGameCaptureSource(desktopCapturer, game, options = {}) {
  const result = await listCaptureSources(desktopCapturer, {
    includeThumbnails: options.includeThumbnails === true,
    types: ['window'],
  })
  const match = pickGameWindow(result.sources, game)

  return match || null
}

async function waitForGameCaptureSource(desktopCapturer, game, options = {}) {
  const attempts = Number.isInteger(options.attempts) ? options.attempts : 20
  const intervalMs = Number.isFinite(Number(options.intervalMs)) ? Number(options.intervalMs) : 750

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const source = await getGameCaptureSource(desktopCapturer, game, options)

    if (source) {
      return source
    }

    if (attempt < attempts - 1) {
      await delay(intervalMs)
    }
  }

  return null
}

function normalizeCaptureSource(source, includeThumbnail) {
  const sourceId = String(source.id || '')
  const type = sourceId.startsWith('screen:') ? 'screen' : 'window'

  return {
    id: sourceId,
    name: String(source.name || (type === 'screen' ? 'Tela' : 'Janela')),
    type,
    thumbnailDataUrl: includeThumbnail && source.thumbnail ? source.thumbnail.toDataURL() : '',
  }
}

function pickDefaultSource(sources) {
  return sources.find((source) => source.type === 'window') || sources[0] || null
}

function pickGameWindow(sources, game) {
  const terms = getGameSearchTerms(game)
  let best = null

  for (const source of sources.filter((item) => item.type === 'window')) {
    const score = scoreGameWindow(source, terms)

    if (score > 0 && (!best || score > best.score)) {
      best = { source, score }
    }
  }

  return best?.score >= 32 ? best.source : null
}

function scoreGameWindow(source, terms) {
  const sourceName = normalizeText(source.name)
  let score = 0

  for (const term of terms.full) {
    if (sourceName === term) {
      score = Math.max(score, 100)
    } else if (sourceName.includes(term) || term.includes(sourceName)) {
      score = Math.max(score, 82)
    }
  }

  const matchedWords = terms.words.filter((word) => sourceName.includes(word))

  if (terms.words.length >= 2 && matchedWords.length === terms.words.length) {
    score = Math.max(score, 68)
  } else if (matchedWords.length >= 2) {
    score = Math.max(score, 48)
  } else if (matchedWords.length === 1) {
    score = Math.max(score, 22)
  }

  return score
}

function getGameSearchTerms(game) {
  const full = [
    game?.title,
    game?.name,
    game?.displayName,
    basenameWithoutExtension(game?.exe),
    basenameWithoutExtension(game?.folder),
  ]
    .map(normalizeText)
    .filter((term) => term.length >= 3)

  const words = [...new Set(full.flatMap((term) => term.split(' ')))]
    .filter((word) => word.length >= 3 && !isWeakSearchWord(word))

  return {
    full: [...new Set(full)],
    words,
  }
}

function basenameWithoutExtension(value) {
  const text = String(value || '').trim()

  if (!text) {
    return ''
  }

  const normalized = text.replace(/\\/g, '/')
  const basename = normalized.split('/').filter(Boolean).pop() || normalized

  return basename.replace(/\.[a-z0-9]+$/i, '')
}

function isIgnoredWindow(source) {
  const name = normalizeText(source.name)

  return !name
    || name.includes('gravity deck')
    || name.includes('mob launcher')
    || name.includes('codex')
    || name.includes('electron')
    || name.includes('task switching')
    || name.includes('entire screen')
    || name.includes('tela inteira')
}

function isWeakSearchWord(word) {
  return [
    'the',
    'and',
    'game',
    'launcher',
    'edition',
    'definitive',
    'standard',
    'deluxe',
    'ultimate',
  ].includes(word)
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

module.exports = {
  getDefaultCaptureSource,
  getGameCaptureSource,
  waitForGameCaptureSource,
  listCaptureSources,
}
