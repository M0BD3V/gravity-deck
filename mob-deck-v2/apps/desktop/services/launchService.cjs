const { shell } = require('electron')
const { spawn } = require('child_process')

async function launchGameTarget(game, options = {}) {
  const target = normalizeLaunchTarget(game)
  const dryRun = options.dryRun || process.env.MOB_DECK_V2_LAUNCH_DRY_RUN === '1'
  const launcherUris = getLauncherUris(target)
  const errors = []

  if (dryRun) {
    const candidate = launcherUris[0] || target.exe || ''

    if (!candidate) {
      return {
        ok: false,
        message: `${target.title || target.name || 'Jogo'} nao tem executavel ou URI configurado.`,
      }
    }

    return {
      ok: true,
      target: candidate,
      message: `${target.title || target.name || 'Jogo'} validado em modo teste.`,
    }
  }

  for (const uri of launcherUris) {
    try {
      await shell.openExternal(uri)
      return {
        ok: true,
        target: uri,
        message: `${target.title || target.name || 'Jogo'} enviado para o launcher.`,
      }
    } catch (error) {
      errors.push(error.message || String(error))
    }
  }

  if (!target.exe) {
    return {
      ok: false,
      message: errors[0] || 'Caminho do executavel nao informado.',
    }
  }

  try {
    await openExecutableTarget(target.exe)

    return {
      ok: true,
      target: target.exe,
      message: `${target.title || target.name || 'Jogo'} aberto no PC.`,
    }
  } catch (error) {
    return {
      ok: false,
      message: error.message || String(error),
    }
  }
}

function normalizeLaunchTarget(target) {
  if (typeof target === 'string') {
    return { exe: target }
  }

  return target && typeof target === 'object' ? target : {}
}

function getLauncherUris(target) {
  const uris = []
  const provider = String(target.provider || target.source || '').toLowerCase()

  if (target.steamAppId) {
    uris.push(`steam://rungameid/${target.steamAppId}`)
  }

  if (isProtocolUri(target.launchUri)) {
    uris.push(target.launchUri)
  }

  if (isProtocolUri(target.fallbackLaunchUri)) {
    uris.push(target.fallbackLaunchUri)
  }

  if (provider === 'steam' && target.sourceId) {
    uris.push(`steam://rungameid/${target.sourceId}`)
  }

  if (provider === 'epic' && target.sourceId) {
    if (target.epicNamespace && target.epicCatalogItemId) {
      uris.push(
        `com.epicgames.launcher://apps/${encodeURIComponent(target.epicNamespace)}%3A${encodeURIComponent(target.epicCatalogItemId)}%3A${encodeURIComponent(target.sourceId)}?action=launch&silent=true`,
      )
    }

    uris.push(`com.epicgames.launcher://apps/${encodeURIComponent(target.sourceId)}?action=launch&silent=true`)
  }

  if (provider === 'gog' && (target.gogAppId || target.sourceId)) {
    uris.push(`goggalaxy://launchGame/${encodeURIComponent(target.gogAppId || target.sourceId)}`)
  }

  if (isProtocolUri(target.appId)) {
    uris.push(target.appId)
  }

  if (isProtocolUri(target.exe)) {
    uris.push(target.exe)
  }

  return [...new Set(uris.filter(Boolean))]
}

async function openExecutableTarget(exePath) {
  const value = String(exePath || '')

  if (!value) {
    throw new Error('Caminho do executavel nao informado.')
  }

  if (value.startsWith('shell:AppsFolder\\')) {
    const child = spawn('explorer.exe', [value], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })

    child.unref()
    return true
  }

  if (isProtocolUri(value)) {
    await shell.openExternal(value)
    return true
  }

  const result = await shell.openPath(value)

  if (result !== '') {
    throw new Error(result)
  }

  return true
}

function isProtocolUri(value) {
  const text = String(value || '')

  if (text.startsWith('shell:AppsFolder\\')) {
    return false
  }

  return /^[a-z][a-z0-9+.-]*:/i.test(text) && !/^[a-z]:\\/i.test(text)
}

module.exports = {
  getLauncherUris,
  isProtocolUri,
  launchGameTarget,
}
