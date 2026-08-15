const { app, BrowserWindow, desktopCapturer, ipcMain, shell } = require('electron')
const os = require('os')
const path = require('path')
const { getGameCaptureSource, listCaptureSources, waitForGameCaptureSource } = require('./services/captureService.cjs')
const {
  configureLibraryService,
  findGameById,
  getLibraryStatus,
  listGames,
  refreshLibrary,
} = require('./services/libraryService.cjs')
const { launchGameTarget } = require('./services/launchService.cjs')
const {
  createPairingPayload,
  getActiveMobileSession,
  getActivePairingPayload,
  validateSessionToken,
} = require('./services/pairingService.cjs')
const {
  acceptStreamAnswer,
  getActiveStreamSession,
  getStreamTelemetry,
  prepareStreamSession,
  reportStreamTelemetry,
  recordRemoteInput,
  stopActiveStreamSession,
  updateStreamConnectionState,
} = require('./services/streamingService.cjs')
const { startSignalingServer } = require('./services/signalingServer.cjs')

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged
const devServerUrl = process.env.MOB_DECK_V2_DEV_SERVER || 'http://127.0.0.1:5173'

let mainWindow = null
let signalingServer = null
const pendingOfferRequests = new Map()

if (process.platform === 'win32') {
  app.setAppUserModelId('com.mobstudios.gravitydeck.v2')
}

app.commandLine.appendSwitch('enable-gpu')
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-zero-copy')

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })
}

app.whenReady().then(async () => {
  configureLibraryService({
    dataDirectory: app.getPath('userData'),
  })
  await startMobileSignalingServer()
  registerIpcHandlers()
  await createWindow()

  if (process.env.MOB_DECK_V2_SMOKE === '1') {
    process.env.MOB_DECK_V2_LAUNCH_DRY_RUN = '1'
    setTimeout(() => {
      app.quit()
    }, 1200)
  }
})

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow()
    return
  }

  showMainWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  for (const pending of pendingOfferRequests.values()) {
    clearTimeout(pending.timeoutId)
    pending.resolve(createOfferFailure('Gravity Deck foi encerrado antes do offer.'))
  }
  pendingOfferRequests.clear()

  if (signalingServer) {
    signalingServer.close().catch(() => {})
    signalingServer = null
  }
})

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#090c10',
    title: 'Gravity Deck',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    showMainWindow()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url)
    }

    return { action: 'deny' }
  })

  if (isDev) {
    await mainWindow.loadURL(devServerUrl)
    return
  }

  await mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'))
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.show()
  mainWindow.focus()
}

function registerIpcHandlers() {
  ipcMain.handle('desktop:get-host-status', () => getHostStatus())

  ipcMain.handle('desktop:list-games', async () => {
    const games = await listGames()

    return { ok: true, games }
  })

  ipcMain.handle('desktop:refresh-library', async () => {
    return await refreshLibrary()
  })

  ipcMain.handle('desktop:create-pairing-payload', () => {
    return createPairingPayload({
      serverUrl: getSignalingUrl(),
      computerName: os.hostname(),
    })
  })

  ipcMain.handle('desktop:list-capture-sources', async () => {
    return await listCaptureSources(desktopCapturer)
  })

  ipcMain.handle('desktop:launch-game', async (event, request = {}) => {
    return await launchGameFromRequest(request)
  })

  ipcMain.handle('desktop:prepare-stream', async (event, request = {}) => {
    const gameId = String(request.gameId || '').trim()
    const game = await findGameById(gameId)

    if (!game) {
      return {
        ok: false,
        session: null,
        telemetry: getStreamTelemetry(),
        message: 'Jogo nao encontrado para streaming.',
      }
    }

    const capture = await getGameCaptureSource(desktopCapturer, game)

    if (!capture) {
      return {
        ok: false,
        session: null,
        telemetry: getStreamTelemetry(),
        message: 'Janela do jogo nao encontrada. Inicie o jogo antes de transmitir.',
      }
    }

    return prepareStreamSession(game, {
      preset: request.preset,
      hostAddress: getLocalAddress(),
      signalingUrl: getSignalingUrl(),
      capture,
    })
  })

  ipcMain.handle('desktop:create-stream-offer', async (event, request = {}) => {
    return await requestStreamOfferFromRenderer(request)
  })

  ipcMain.handle('desktop:get-stream-session', () => ({
    ok: true,
    session: getActiveStreamSession(),
    telemetry: getStreamTelemetry(),
    message: getActiveStreamSession() ? 'Sessao mobile ativa.' : 'Nenhuma sessao mobile ativa.',
  }))

  ipcMain.handle('desktop:get-stream-telemetry', () => getStreamTelemetry())

  ipcMain.handle('desktop:report-stream-telemetry', (event, telemetry = {}) => {
    return reportStreamTelemetry(telemetry)
  })

  ipcMain.handle('desktop:accept-stream-answer', (event, answer = {}) => {
    return acceptStreamAnswerAndNotify(answer)
  })

  ipcMain.handle('desktop:update-stream-connection-state', (event, update = {}) => {
    return updateStreamConnectionState(update)
  })

  ipcMain.handle('desktop:send-remote-input', (event, input = {}) => {
    return recordRemoteInput(input)
  })

  ipcMain.handle('desktop:stop-stream-session', () => {
    return stopActiveStreamSession()
  })

  ipcMain.on('desktop:stream-offer-result', (event, result = {}) => {
    const requestId = String(result.requestId || '')
    const pending = pendingOfferRequests.get(requestId)

    if (!pending) {
      return
    }

    clearTimeout(pending.timeoutId)
    pendingOfferRequests.delete(requestId)
    pending.resolve(result)
  })
}

function getHostStatus() {
  return {
    id: 'local-host',
    name: os.hostname(),
    online: true,
    localAddress: getLocalAddress(),
    streamingSignalUrl: getSignalingUrl(),
    activePairing: getActivePairingPayload(),
    mobileSession: getActiveMobileSession(),
    version: app.getVersion(),
    capabilities: [
      'library-scan',
      'wake-on-lan',
      'game-launch',
      'screen-capture',
      'audio-capture',
      'input-injection',
    ],
  }
}

function getLocalAddress() {
  const interfaces = os.networkInterfaces()

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address
      }
    }
  }

  return '127.0.0.1'
}

async function startMobileSignalingServer() {
  try {
    signalingServer = await startSignalingServer({
      port: process.env.MOB_DECK_V2_SIGNALING_PORT,
      host: '0.0.0.0',
      services: {
        acceptStreamAnswer: acceptStreamAnswerAndNotify,
        createStreamOffer: requestStreamOfferFromRenderer,
        launchGame: launchGameFromRequest,
        listGames: async () => ({
          ok: true,
          games: await listGames(),
        }),
        getLibraryStatus,
        refreshLibrary: async () => await refreshLibrary(),
        listCaptureSources: () => listCaptureSources(desktopCapturer, { includeThumbnails: false }),
        getActiveStreamSession,
        getStreamTelemetry,
        reportStreamTelemetry,
        recordRemoteInput,
        stopActiveStreamSession,
        validateAuthToken: validateSessionToken,
      },
    })
  } catch (error) {
    console.warn('Gravity Deck signaling unavailable:', error.message || error)
  }
}

async function launchGameFromRequest(request = {}) {
  const gameId = String(request.gameId || '').trim()
  const mode = request.mode === 'mobile-stream' ? 'mobile-stream' : 'desktop'
  const game = await findGameById(gameId)

  if (!gameId) {
    return {
      ok: false,
      gameId,
      message: 'Jogo invalido.',
    }
  }

  if (!game) {
    return {
      ok: false,
      gameId,
      message: 'Jogo nao encontrado na biblioteca Gravity Deck.',
    }
  }

  const result = await launchGameTarget(game, {
    dryRun: process.env.MOB_DECK_V2_LAUNCH_DRY_RUN === '1',
  })
  let streamSession = null
  let message = result.message

  if (result.ok && mode === 'mobile-stream') {
    const capture = await waitForGameCaptureSource(desktopCapturer, game)

    if (!capture) {
      return {
        ok: false,
        gameId,
        mode,
        streamSession: null,
        message: `${game.title || game.name || 'Jogo'} foi enviado para abrir, mas a janela do jogo nao foi encontrada para captura. Abra o jogo e tente transmitir novamente.`,
      }
    }

    const preparedStream = prepareStreamSession(game, {
      preset: request.streamPreset || 'performance',
      hostAddress: getLocalAddress(),
      signalingUrl: getSignalingUrl(),
      capture,
    })

    streamSession = preparedStream.session
    message = preparedStream.message
  }

  if (result.ok && request.minimizeLauncher && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide()
  }

  return {
    ok: result.ok,
    gameId,
    mode,
    streamSession,
    message,
  }
}

function requestStreamOfferFromRenderer(request = {}) {
  const session = getActiveStreamSession()
  const requestId = createRequestId()
  const requestedSessionId = String(request.sessionId || '').trim()

  if (!session) {
    return Promise.resolve(createOfferFailure('Nenhuma sessao Gravity Stream ativa.'))
  }

  if (requestedSessionId && requestedSessionId !== session.sessionId) {
    return Promise.resolve(createOfferFailure('Pedido de offer para uma sessao diferente.'))
  }

  if (!session.capture?.id) {
    return Promise.resolve(createOfferFailure('Fonte de captura ainda nao selecionada.'))
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    return Promise.resolve(createOfferFailure('Janela Gravity Deck indisponivel para criar offer.'))
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      pendingOfferRequests.delete(requestId)
      resolve(createOfferFailure('Tempo esgotado ao criar offer Gravity Stream.'))
    }, 15000)

    pendingOfferRequests.set(requestId, { resolve, timeoutId })
    mainWindow.webContents.send('gravity-stream:create-offer', {
      requestId,
      session,
      iceServers: [],
    })
  })
}

function acceptStreamAnswerAndNotify(answer = {}) {
  const result = acceptStreamAnswer(answer)

  if (result.ok && answer.sdp && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('gravity-stream:answer', answer)
  }

  return result
}

function createOfferFailure(message) {
  return {
    ok: false,
    offer: null,
    session: getActiveStreamSession(),
    telemetry: getStreamTelemetry(),
    message,
  }
}

function createRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function getSignalingUrl() {
  if (!signalingServer) {
    return ''
  }

  return `http://${getLocalAddress()}:${signalingServer.port}`
}
