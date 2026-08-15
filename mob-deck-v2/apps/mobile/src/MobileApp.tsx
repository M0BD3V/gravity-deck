import { useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject, PointerEvent, ReactNode } from 'react'
import {
  CircleDot,
  Gamepad2,
  House,
  Library,
  Loader2,
  Maximize2,
  Minimize2,
  MonitorSmartphone,
  Play,
  Power,
  QrCode,
  RefreshCw,
  Send,
  Settings,
  Signal,
  Square,
  Wifi,
} from 'lucide-react'
import {
  acceptStreamAnswer,
  getHealth,
  getSession,
  launchGame,
  listGames,
  normalizeSignalUrl,
  reportTelemetry,
  requestStreamOffer,
  sendRemoteInput,
  stopStreamSession,
} from './services/signalingClient'
import type { MobileGame } from './services/signalingClient'
import { parsePairingInput } from './services/pairingPayload'
import {
  clearStoredConnection,
  getSavedServerUrlSync,
  loadStoredConnection,
  saveConnection,
} from './services/connectionStorage'
import { detectPlatformFromSource, getPlatformBadgeLabel, libraryPlatformFilters } from '@contracts/platformAccounts'
import type { LibraryPlatformFilter } from '@contracts/platformAccounts'
import type {
  RemoteInputChannelAck,
  RemoteInputChannelRequest,
  RemoteInputEvent,
  RemoteInputResult,
  StreamSessionSummary,
  StreamTelemetry,
} from '@contracts/streaming'

type ConnectionState = 'idle' | 'checking' | 'online' | 'offline'
type BusyAction = 'scan' | 'refresh' | 'games' | 'offer' | 'launch' | 'input' | 'stop' | ''
type MobilePanel = 'connect' | 'home' | 'library' | 'streaming' | 'settings'
type PendingInputAck = {
  resolve: (result: RemoteInputResult) => void
  reject: (error: Error) => void
  timeoutId: number
}
type PeerStatsSample = {
  bytesReceived: number
  framesDecoded: number
  timestamp: number
}

const inputAckTimeoutMs = 1200
const initialSignalUrl = getSavedServerUrlSync()
const faceButtons = [
  { code: 'button:a', label: 'A' },
  { code: 'button:b', label: 'B' },
  { code: 'button:x', label: 'X' },
  { code: 'button:y', label: 'Y' },
]
const gamepadButtonMappings = [
  { index: 0, code: 'button:a' },
  { index: 1, code: 'button:b' },
  { index: 2, code: 'button:x' },
  { index: 3, code: 'button:y' },
]
const emptyTelemetry: StreamTelemetry = {
  state: 'idle',
  roundTripMs: 0,
  bitrateKbps: 0,
  framesPerSecond: 0,
  captureFramesPerSecond: 0,
  transmitFramesPerSecond: 0,
  packetLossPercent: 0,
  framesDropped: 0,
  resolution: '0x0',
  codec: 'N/D',
  encoder: 'N/D',
  captureSource: '',
  captureType: 'none',
  cpuUsagePercent: null,
  gpuUsagePercent: null,
  networkKbps: 0,
}

export function MobileApp() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamStageRef = useRef<HTMLElement | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const inputChannelRef = useRef<RTCDataChannel | null>(null)
  const pendingInputAcksRef = useRef(new Map<string, PendingInputAck>())
  const gamepadPressedRef = useRef(new Set<string>())
  const statsSampleRef = useRef<PeerStatsSample | null>(null)
  const sessionRef = useRef<StreamSessionSummary | null>(null)
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)
  const sendButtonInputRef = useRef<(code: string, pressed: boolean) => Promise<void>>(async () => {})
  const [signalUrl, setSignalUrl] = useState(initialSignalUrl)
  const [authToken, setAuthToken] = useState('')
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [busyAction, setBusyAction] = useState<BusyAction>('')
  const [session, setSession] = useState<StreamSessionSummary | null>(null)
  const [telemetry, setTelemetry] = useState<StreamTelemetry>(emptyTelemetry)
  const [games, setGames] = useState<MobileGame[]>([])
  const [remoteVideoReady, setRemoteVideoReady] = useState(false)
  const [inputChannelReady, setInputChannelReady] = useState(false)
  const [gameMode, setGameMode] = useState(false)
  const [gamepadConnected, setGamepadConnected] = useState(false)
  const [gamepadName, setGamepadName] = useState('')
  const [touchControlsVisible, setTouchControlsVisible] = useState(true)
  const [activePanel, setActivePanel] = useState<MobilePanel>(initialSignalUrl ? 'home' : 'connect')
  const [libraryFilter, setLibraryFilter] = useState<LibraryPlatformFilter>('all')
  const [message, setMessage] = useState(initialSignalUrl ? 'Reconectando ao Gravity Deck.' : 'Escaneie o QR do Gravity Deck.')
  const [error, setError] = useState('')

  const normalizedUrl = useMemo(() => {
    try {
      return normalizeSignalUrl(signalUrl)
    } catch {
      return ''
    }
  }, [signalUrl])
  const isBusy = Boolean(busyAction)
  const connectionLabel = connectionState === 'online' ? 'Online' : connectionState === 'checking' ? 'Conectando' : 'Offline'
  const filteredGames = useMemo(() => filterMobileGamesByPlatform(games, libraryFilter), [games, libraryFilter])
  const appUnlocked = connectionState === 'online' && Boolean(normalizedUrl && authToken)

  useEffect(() => {
    const trackedGamepadButtons = gamepadPressedRef.current

    return () => {
      void exitFullscreenSafely()
      void releaseWakeLockSafely(wakeLockRef)
      unlockOrientationSafely()
      trackedGamepadButtons.clear()
      rejectPendingInputAcks(pendingInputAcksRef)
      closePeer(peerRef, inputChannelRef)
      clearRemoteVideo(videoRef)
    }
  }, [])

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    sendButtonInputRef.current = sendButtonInput
  })

  useEffect(() => {
    let frameId = 0
    let currentGamepadConnected = false
    let currentGamepadName = ''

    function releaseTrackedButtons(sendRelease: boolean) {
      for (const code of gamepadPressedRef.current) {
        if (sendRelease) {
          void sendButtonInputRef.current(code, false)
        }
      }

      gamepadPressedRef.current.clear()
    }

    function setGamepadStatus(gamepad: Gamepad | null) {
      const nextConnected = Boolean(gamepad)
      const nextName = formatGamepadName(gamepad?.id || '')

      if (nextConnected !== currentGamepadConnected) {
        currentGamepadConnected = nextConnected
        setGamepadConnected(nextConnected)
        setTouchControlsVisible(!nextConnected)

        if (!nextConnected) {
          releaseTrackedButtons(Boolean(normalizedUrl && sessionRef.current))
        }
      }

      if (nextName !== currentGamepadName) {
        currentGamepadName = nextName
        setGamepadName(nextName)
      }
    }

    function pollGamepad() {
      const gamepad = getPrimaryGamepad()

      setGamepadStatus(gamepad)

      if (gamepad && normalizedUrl && sessionRef.current) {
        for (const mapping of gamepadButtonMappings) {
          const pressed = Boolean(gamepad.buttons[mapping.index]?.pressed)
          const wasPressed = gamepadPressedRef.current.has(mapping.code)

          if (pressed === wasPressed) {
            continue
          }

          if (pressed) {
            gamepadPressedRef.current.add(mapping.code)
          } else {
            gamepadPressedRef.current.delete(mapping.code)
          }

          void sendButtonInputRef.current(mapping.code, pressed)
        }
      } else {
        releaseTrackedButtons(Boolean(normalizedUrl && sessionRef.current))
      }

      frameId = window.requestAnimationFrame(pollGamepad)
    }

    function handleGamepadChange() {
      setGamepadStatus(getPrimaryGamepad())
    }

    window.addEventListener('gamepadconnected', handleGamepadChange)
    window.addEventListener('gamepaddisconnected', handleGamepadChange)
    frameId = window.requestAnimationFrame(pollGamepad)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('gamepadconnected', handleGamepadChange)
      window.removeEventListener('gamepaddisconnected', handleGamepadChange)
      releaseTrackedButtons(false)
    }
  }, [normalizedUrl])

  useEffect(() => {
    document.body.dataset.gameMode = gameMode ? 'true' : 'false'

    if (!gameMode) {
      void releaseWakeLockSafely(wakeLockRef)
      unlockOrientationSafely()
    }

    return () => {
      delete document.body.dataset.gameMode
    }
  }, [gameMode])

  useEffect(() => {
    function handleVisibilityChange() {
      if (gameMode && document.visibilityState === 'visible') {
        void requestWakeLockSafely(wakeLockRef)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [gameMode])

  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement) {
        setGameMode(false)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    if (!initialSignalUrl) {
      return undefined
    }
    let isActive = true

    setBusyAction('refresh')
    setError('')
    setConnectionState('checking')
    loadStoredConnection()
      .then(async (stored) => {
        if (!stored.token) {
          const url = normalizeSignalUrl(stored.serverUrl || initialSignalUrl)
          const health = await getHealth(url)

          if (!isActive) {
            return
          }

          setSignalUrl(url)
          setConnectionState('offline')
          setMessage(health.ok ? 'Escaneie o QR novamente para renovar a sessao segura.' : health.message)
          setActivePanel('connect')
          return
        }

        const { health, result, url } = await readHostState(stored.serverUrl, stored.token)
        const library = health.ok ? await readMobileLibrary(url, stored.token).catch(() => []) : []

        if (!isActive) {
          return
        }

        setSignalUrl(url)
        setAuthToken(stored.token)
        setConnectionState(health.ok ? 'online' : 'offline')
        setSession(result.session)
        setTelemetry(result.telemetry || emptyTelemetry)
        setGames(library)
        setMessage(result.message || health.message)
        setActivePanel(health.ok ? 'home' : 'connect')
      })
      .catch((autoConnectError) => {
        if (!isActive) {
          return
        }

        setConnectionState('offline')
        setError(autoConnectError instanceof Error ? autoConnectError.message : 'Acao nao concluida.')
      })
      .finally(() => {
        if (isActive) {
          setBusyAction('')
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!normalizedUrl || !authToken || connectionState !== 'online') {
      return undefined
    }

    const intervalMs = gameMode ? 1500 : 5000
    const intervalId = window.setInterval(() => {
      getSession(normalizedUrl, authToken)
        .then((result) => {
          setSession(result.session)
          setTelemetry(result.telemetry || emptyTelemetry)

          if (!result.session && remoteVideoReady) {
            rejectPendingInputAcks(pendingInputAcksRef)
            closePeer(peerRef, inputChannelRef)
            clearRemoteVideo(videoRef)
            setRemoteVideoReady(false)
            setInputChannelReady(false)
          }
        })
        .catch(() => {})
    }, intervalMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [authToken, connectionState, gameMode, normalizedUrl, remoteVideoReady])

  useEffect(() => {
    if (!normalizedUrl || !authToken || !session) {
      statsSampleRef.current = null
      return undefined
    }

    const intervalId = window.setInterval(() => {
      const peer = peerRef.current

      if (!peer) {
        return
      }

      readPeerTelemetry(peer, session, statsSampleRef.current)
        .then((result) => {
          statsSampleRef.current = result.sample
          setTelemetry((current) => ({
            ...current,
            ...result.telemetry,
            state: current.state,
          }))

          return reportTelemetry(normalizedUrl, {
            ...result.telemetry,
            state: telemetryStateForReport(session),
          }, authToken)
        })
        .catch(() => {})
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [authToken, normalizedUrl, session])

  async function scanPairingQr() {
    await runAction('scan', async () => {
      const {
        CapacitorBarcodeScanner,
        CapacitorBarcodeScannerAndroidScanningLibrary,
        CapacitorBarcodeScannerCameraDirection,
        CapacitorBarcodeScannerScanOrientation,
        CapacitorBarcodeScannerTypeHint,
      } = await import('@capacitor/barcode-scanner')
      const result = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        scanInstructions: 'Aponte para o QR do Gravity Deck.',
        scanButton: false,
        cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
        scanOrientation: CapacitorBarcodeScannerScanOrientation.PORTRAIT,
        android: {
          scanningLibrary: CapacitorBarcodeScannerAndroidScanningLibrary.ZXING,
        },
      })
      const rawPayload = result.ScanResult.trim()

      if (!rawPayload) {
        throw new Error('Nenhum QR de pareamento lido.')
      }

      await pairFromRawPayload(rawPayload)
    })
  }

  async function pairFromRawPayload(rawPayload: string) {
    const payload = parsePairingInput(rawPayload)

    if (!payload.token) {
      throw new Error('QR sem token de sessao. Gere um novo pareamento no Gravity Deck.')
    }

    setSignalUrl(payload.serverUrl)
    setAuthToken(payload.token)
    await saveConnection({
      serverUrl: payload.serverUrl,
      token: payload.token,
    })
    setMessage(`${payload.computerName}: codigo ${payload.pairingCode}.`)
    await loadHost(payload.serverUrl, payload.token)
  }

  async function loadHost(targetUrl: string, token = authToken) {
    const nextUrl = normalizeSignalUrl(targetUrl)

    if (!token) {
      throw new Error('Sessao segura ausente. Escaneie o QR do Gravity Deck novamente.')
    }

    setSignalUrl(nextUrl)
    setAuthToken(token)
    setConnectionState('checking')
    await saveConnection({
      serverUrl: nextUrl,
      token,
    })

    const [{ health, result }, library] = await Promise.all([
      readHostState(nextUrl, token),
      readMobileLibrary(nextUrl, token).catch(() => []),
    ])

    setConnectionState(health.ok ? 'online' : 'offline')
    setSession(result.session)
    setTelemetry(result.telemetry || emptyTelemetry)
    setGames(library)
    setMessage(result.message || health.message)
    setActivePanel(health.ok ? 'home' : 'connect')
  }

  async function refreshSession() {
    await runAction('refresh', async () => {
      const targetUrl = normalizedUrl || signalUrl
      const [result, library] = await Promise.all([
        getSession(targetUrl, authToken),
        readMobileLibrary(targetUrl, authToken).catch(() => games),
      ])

      setConnectionState('online')
      setSession(result.session)
      setTelemetry(result.telemetry || emptyTelemetry)
      setGames(library)
      setMessage(result.message)
    })
  }

  async function refreshGameLibrary() {
    await runAction('games', async () => {
      const library = await readMobileLibrary(normalizedUrl || signalUrl, authToken)

      setGames(library)
      setConnectionState('online')
      setMessage('Biblioteca Gravity Deck sincronizada.')
      setActivePanel('library')
    })
  }

  async function negotiateStream() {
    if (!session) {
      setError('Nenhuma sessao ativa no PC.')
      return
    }

    await runAction('offer', async () => {
      await enterGameMode()
      await negotiateStreamSession(session)
    })
  }

  async function startMobileGame(game: MobileGame) {
    await runAction('launch', async () => {
      await enterGameMode()
      const targetUrl = normalizedUrl || signalUrl
      const result = await launchGame(targetUrl, {
        gameId: game.id,
        mode: 'mobile-stream',
        minimizeLauncher: false,
        streamPreset: 'performance',
      }, authToken)

      if (!result.ok || !result.streamSession) {
        throw new Error(result.message || 'Sessao Gravity Stream indisponivel.')
      }

      setConnectionState('online')
      setSession(result.streamSession)
      setTelemetry((current) => ({
        ...current,
        state: result.streamSession?.state || current.state,
      }))
      setMessage(result.message)
      setActivePanel('streaming')
      await negotiateStreamSession(result.streamSession)
    })
  }

  async function negotiateStreamSession(targetSession: StreamSessionSummary) {
    const offerResult = await requestStreamOffer(normalizedUrl || signalUrl, {
      sessionId: targetSession.sessionId,
    }, authToken)

    if (!offerResult.ok || !offerResult.offer) {
      throw new Error(offerResult.message || 'Offer Gravity Stream indisponivel.')
    }

    rejectPendingInputAcks(pendingInputAcksRef)
    closePeer(peerRef, inputChannelRef)
    clearRemoteVideo(videoRef)
    statsSampleRef.current = null
    setRemoteVideoReady(false)
    setInputChannelReady(false)

    const peer = new RTCPeerConnection({
      iceServers: offerResult.offer.iceServers,
    })
    peerRef.current = peer
    peer.ondatachannel = (event) => {
      if (event.channel.label === 'gravity-input') {
        bindInputChannel(event.channel)
      }
    }
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        setMessage('Gravity Stream conectado.')
        return
      }

      if (peer.connectionState === 'disconnected') {
        setInputChannelReady(false)
        setMessage('Gravity Stream tentando reconectar.')
        return
      }

      if (peer.connectionState === 'failed') {
        setInputChannelReady(false)
        setRemoteVideoReady(false)
        setError('Gravity Stream falhou.')
        void exitGameMode()
      }
    }
    peer.ontrack = (event) => {
      const [stream] = event.streams

        if (stream && videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play().catch(() => {})
          setRemoteVideoReady(true)
        }
      }

    await peer.setRemoteDescription({
      type: offerResult.offer.type,
      sdp: offerResult.offer.sdp,
    })

    const answer = await peer.createAnswer()
    await peer.setLocalDescription(answer)
    await waitForIceGathering(peer)

    const result = await acceptStreamAnswer(normalizedUrl || signalUrl, {
      sessionId: targetSession.sessionId,
      type: 'answer',
      sdp: peer.localDescription?.sdp || answer.sdp || '',
    }, authToken)

    if (!result.ok) {
      throw new Error(result.message || 'Resposta Gravity Stream recusada.')
    }

    setSession(result.session)
    setTelemetry(result.telemetry || emptyTelemetry)
    setMessage(result.message)
  }

  async function sendButtonInput(code: string, pressed: boolean) {
    const event: RemoteInputEvent = {
      type: 'button',
      code,
      pressed,
      at: Date.now(),
    }

    setError('')

    try {
      const result = await sendRemoteInputWithBestTransport(event)

      if (!result.ok) {
        throw new Error(result.message || 'Input Gravity Stream recusado.')
      }

      if (result.session !== undefined) {
        setSession(result.session || null)
      }

      if (pressed) {
        setMessage(result.message)
      }
    } catch (inputError) {
      setError(inputError instanceof Error ? inputError.message : 'Input Gravity Stream recusado.')
    }
  }

  async function stopSession() {
    await runAction('stop', async () => {
      const result = await stopStreamSession(normalizedUrl || signalUrl, authToken)

      rejectPendingInputAcks(pendingInputAcksRef)
      closePeer(peerRef, inputChannelRef)
      clearRemoteVideo(videoRef)
      statsSampleRef.current = null
      setRemoteVideoReady(false)
      setInputChannelReady(false)
      setSession(result.session)
      setTelemetry(result.telemetry || emptyTelemetry)
      setMessage(result.message)
      await exitGameMode()
    })
  }

  async function enterGameMode() {
    setGameMode(true)
    await requestFullscreenSafely(document.documentElement)
    await lockLandscapeSafely()
    await requestWakeLockSafely(wakeLockRef)
  }

  async function exitGameMode() {
    setGameMode(false)
    await exitFullscreenSafely()
    await releaseWakeLockSafely(wakeLockRef)
    unlockOrientationSafely()
  }

  function toggleTouchControls() {
    setTouchControlsVisible((visible) => !visible)
  }

  async function clearSavedConnection() {
    await clearStoredConnection()
    setSignalUrl('')
    setAuthToken('')
    setConnectionState('offline')
    setSession(null)
    setTelemetry(emptyTelemetry)
    setGames([])
    setMessage('Conexao salva removida. Escaneie o QR novamente.')
    setActivePanel('connect')
  }

  async function runAction(action: BusyAction, work: () => Promise<void>) {
    setBusyAction(action)
    setError('')

    try {
      await work()
    } catch (actionError) {
      setConnectionState(action === 'scan' || action === 'refresh' ? 'offline' : connectionState)
      if ((action === 'offer' || action === 'launch') && !remoteVideoReady) {
        void exitGameMode()
      }
      setError(actionError instanceof Error ? actionError.message : 'Acao nao concluida.')
    } finally {
      setBusyAction('')
    }
  }

  function bindInputChannel(channel: RTCDataChannel) {
    inputChannelRef.current?.close()
    inputChannelRef.current = channel
    setInputChannelReady(channel.readyState === 'open')

    channel.onopen = () => {
      setInputChannelReady(true)
      setMessage('Canal de input Gravity Stream ativo.')
    }
    channel.onclose = () => {
      if (inputChannelRef.current === channel) {
        inputChannelRef.current = null
      }
      setInputChannelReady(false)
      rejectPendingInputAcks(pendingInputAcksRef)
    }
    channel.onerror = () => {
      setInputChannelReady(false)
      rejectPendingInputAcks(pendingInputAcksRef)
    }
    channel.onmessage = (event) => {
      handleInputChannelMessage(event.data)
    }
  }

  async function sendRemoteInputWithBestTransport(event: RemoteInputEvent) {
    if (isInputChannelOpen(inputChannelRef.current)) {
      return await sendRemoteInputOverChannel(event)
    }

    return await sendRemoteInput(normalizedUrl || signalUrl, event, authToken)
  }

  function sendRemoteInputOverChannel(event: RemoteInputEvent) {
    const channel = inputChannelRef.current

    if (!isInputChannelOpen(channel)) {
      throw new Error('Canal de input Gravity Stream indisponivel.')
    }

    const id = createInputMessageId()
    const message: RemoteInputChannelRequest = {
      kind: 'remote-input',
      id,
      event,
    }

    return new Promise<RemoteInputResult>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        pendingInputAcksRef.current.delete(id)
        reject(new Error('Tempo esgotado no input Gravity Stream.'))
      }, inputAckTimeoutMs)

      pendingInputAcksRef.current.set(id, {
        resolve,
        reject,
        timeoutId,
      })

      try {
        channel.send(JSON.stringify(message))
      } catch (sendError) {
        window.clearTimeout(timeoutId)
        pendingInputAcksRef.current.delete(id)
        reject(sendError instanceof Error ? sendError : new Error('Falha ao enviar input Gravity Stream.'))
      }
    })
  }

  function handleInputChannelMessage(data: unknown) {
    const ack = parseInputAck(data)

    if (!ack) {
      return
    }

    const pending = pendingInputAcksRef.current.get(ack.id)

    if (!pending) {
      return
    }

    window.clearTimeout(pending.timeoutId)
    pendingInputAcksRef.current.delete(ack.id)

    if (!ack.ok) {
      pending.reject(new Error(ack.message || 'Input Gravity Stream recusado.'))
      return
    }

    pending.resolve({
      ok: ack.ok,
      session: ack.session,
      message: ack.message,
    })
  }

  if (!gameMode && !appUnlocked) {
    return (
      <main className="mobile-shell mobile-pairing-gate" data-game-mode={gameMode}>
        <section className="pairing-gate-card" aria-live="polite">
          <img src="/brand/mobdeck-mark.png" alt="" />
          <div>
            <span>Gravity</span>
            <strong>Mobile</strong>
          </div>
          <button type="button" aria-label="Escanear QR do Gravity Deck" disabled={isBusy} onClick={scanPairingQr}>
            {busyAction === 'scan' || busyAction === 'refresh' ? <Loader2 className="is-spinning" size={24} /> : <QrCode size={24} />}
            <span>{connectionState === 'checking' ? 'Conectando' : 'Escanear QR'}</span>
          </button>
          {(message || error) && (
            <p className={`mobile-feedback${error ? ' is-error' : ''}`}>
              {error || message}
            </p>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="mobile-shell" data-game-mode={gameMode}>
      {!gameMode && <header className="mobile-topbar">
        <div className="brand-row">
          <img src="/brand/mobdeck-mark.png" alt="" />
          <div>
            <span>Gravity</span>
            <strong>Mobile</strong>
          </div>
        </div>
        <div className="connection-pill" data-state={connectionState}>
          {connectionState === 'checking' ? <Loader2 size={15} /> : <CircleDot size={15} />}
          {connectionLabel}
        </div>
      </header>}

      <section className="mobile-panel" aria-live="polite">
        {activePanel === 'home' && (
          <section className="mobile-home-grid" aria-label="Inicio">
            <article className="mobile-card mobile-hero-card">
              <span>Home</span>
              <strong>{connectionState === 'online' ? 'Gravity Deck conectado' : 'Conecte seu PC'}</strong>
              <p>{connectionState === 'online' ? 'Use a Biblioteca para iniciar jogos ou Stream para acompanhar a sessao ativa.' : 'A conexao por QR fica na tela Conexao.'}</p>
              <div className="mobile-action-row">
                <button type="button" onClick={() => setActivePanel('connect')}>
                  <QrCode size={18} />
                  Conexao
                </button>
                <button type="button" onClick={() => setActivePanel('library')}>
                  <Library size={18} />
                  Biblioteca
                </button>
              </div>
            </article>

            <section className="telemetry-grid" aria-label="Resumo">
              <TelemetryTile icon={<Signal size={18} />} label="Rede" value={connectionLabel} />
              <TelemetryTile icon={<Library size={18} />} label="Jogos" value={formatGameCount(games.length)} />
              <TelemetryTile icon={<Square size={18} />} label="Video" value={formatVideo(session)} />
              <TelemetryTile icon={<Gamepad2 size={18} />} label="Input" value={formatInput(session, inputChannelReady, gamepadConnected, gamepadName)} />
            </section>

            <article className="mobile-card">
              <span>Sessao</span>
              <strong>{session ? session.gameTitle : 'Sem stream ativo'}</strong>
              <p>{session ? 'Abra a tela Stream para ver video, controles e diagnostico.' : 'Inicie um jogo pela Biblioteca quando o PC estiver conectado.'}</p>
            </article>
          </section>
        )}

        {activePanel === 'connect' && (
          <section className="pair-panel qr-panel" aria-label="Pareamento">
            <label>Conexao com PC</label>
            <button type="button" aria-label="Escanear QR do Gravity Deck" disabled={isBusy} onClick={scanPairingQr}>
              {busyAction === 'scan' ? <Loader2 className="is-spinning" size={22} /> : <QrCode size={22} />}
              <span>{connectionState === 'online' ? 'Conectado' : 'Escanear QR'}</span>
            </button>
            <div className="connection-summary">
              <TelemetryTile icon={<Wifi size={18} />} label="Host" value={normalizedUrl || 'Aguardando QR'} />
              <TelemetryTile icon={<CircleDot size={18} />} label="Estado" value={connectionLabel} />
            </div>
          </section>
        )}

        {activePanel === 'library' && (
          <section className="library-panel library-panel-tall" aria-label="Biblioteca mobile">
            <div className="library-heading">
              <div>
                <label>Biblioteca</label>
                <small>{formatGameCount(filteredGames.length)} / {formatGameCount(games.length)}</small>
              </div>
              <button
                type="button"
                aria-label="Sincronizar biblioteca"
                disabled={isBusy || connectionState !== 'online' || !authToken}
                onClick={refreshGameLibrary}
              >
                {busyAction === 'games' ? <Loader2 className="is-spinning" size={16} /> : <RefreshCw size={16} />}
              </button>
            </div>
            <div className="mobile-platform-filter" aria-label="Filtros por plataforma">
              {libraryPlatformFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  data-active={libraryFilter === filter.id}
                  onClick={() => setLibraryFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="mobile-game-grid">
              {connectionState !== 'online' ? (
                <MobileEmpty title="PC nao conectado" description="Escaneie o QR do Gravity Deck para carregar os jogos." />
              ) : games.length && filteredGames.length ? filteredGames.map((game) => (
                <MobileGameCard key={game.id} busy={isBusy} game={game} launching={busyAction === 'launch'} onStart={startMobileGame} />
              )) : games.length ? (
                <MobileEmpty title="Filtro vazio" description="Nenhum jogo real desta plataforma foi sincronizado ainda." />
              ) : (
                <MobileEmpty title="Biblioteca vazia" description="Nenhum jogo real foi sincronizado pelo Gravity Deck ainda." />
              )}
            </div>
          </section>
        )}

        {activePanel === 'streaming' && (
          <>
            <section ref={streamStageRef} className="stream-stage" aria-label="Sessao de streaming">
              <div className="video-surface" data-state={telemetry.state}>
                <video
                  ref={videoRef}
                  className="remote-video"
                  data-ready={remoteVideoReady}
                  autoPlay
                  playsInline
                />
                {!remoteVideoReady && (
                  <>
                    <MonitorSmartphone size={42} />
                    <span>{session ? session.gameTitle : 'Sem sessao ativa'}</span>
                    <strong>{formatState(telemetry.state)}</strong>
                  </>
                )}
              </div>

              <div className="session-strip">
                <div>
                  <span>Codigo</span>
                  <strong>{session?.joinCode || '------'}</strong>
                </div>
                <div>
                  <span>Preset</span>
                  <strong>{session?.preset || 'performance'}</strong>
                </div>
                <div>
                  <span>Host</span>
                  <strong>{session?.hostAddress || '0.0.0.0'}</strong>
                </div>
              </div>

              {gameMode && (
                <div className="game-mode-overlay" aria-label="Modo jogo">
                  <div className="game-mode-topbar">
                    <div>
                      <span>{session?.gameTitle || 'Gravity Stream'}</span>
                      <strong>{`${formatVideo(session)} / ${formatInput(session, inputChannelReady, gamepadConnected, gamepadName)}`}</strong>
                    </div>
                    <div className="game-mode-actions">
                      <button
                        type="button"
                        aria-label={touchControlsVisible ? 'Ocultar controles touch' : 'Mostrar controles touch'}
                        data-active={gamepadConnected}
                        onClick={toggleTouchControls}
                      >
                        <Gamepad2 size={18} />
                      </button>
                      <button type="button" aria-label="Sair do modo jogo" onClick={exitGameMode}>
                        <Minimize2 size={18} />
                      </button>
                    </div>
                  </div>

                  {touchControlsVisible && (
                    <div className="game-mode-pad" aria-label="Botoes do controle">
                      {faceButtons.map((button) => (
                        <RemoteButton
                          key={button.code}
                          code={button.code}
                          disabled={isBusy || !normalizedUrl || !authToken}
                          label={button.label}
                          onRemoteInput={sendButtonInput}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {!gameMode && (
              <section className="control-bar" aria-label="Acoes da sessao">
                <button type="button" aria-label="Atualizar sessao" disabled={isBusy || !normalizedUrl || !authToken} onClick={refreshSession}>
                  {busyAction === 'refresh' ? <Loader2 className="is-spinning" size={19} /> : <RefreshCw size={19} />}
                </button>
                <button type="button" aria-label="Negociar Gravity Stream" disabled={isBusy || !session} onClick={negotiateStream}>
                  {busyAction === 'offer' ? <Loader2 className="is-spinning" size={19} /> : <Send size={19} />}
                </button>
                <button type="button" aria-label={gameMode ? 'Sair do modo jogo' : 'Entrar no modo jogo'} disabled={!session} onClick={gameMode ? exitGameMode : enterGameMode}>
                  {gameMode ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
                </button>
                <button type="button" aria-label="Encerrar sessao" disabled={isBusy || !normalizedUrl || !authToken} onClick={stopSession}>
                  {busyAction === 'stop' ? <Loader2 className="is-spinning" size={19} /> : <Power size={19} />}
                </button>
              </section>
            )}

            <section className="telemetry-grid" aria-label="Telemetria">
              <TelemetryTile icon={<Signal size={18} />} label="Rede" value={connectionLabel} />
              <TelemetryTile icon={<Wifi size={18} />} label="Latencia" value={`${telemetry.roundTripMs} ms`} />
              <TelemetryTile icon={<Square size={18} />} label="FPS" value={`${telemetry.transmitFramesPerSecond || telemetry.framesPerSecond}`} />
              <TelemetryTile icon={<Signal size={18} />} label="Bitrate" value={`${telemetry.bitrateKbps} kbps`} />
              <TelemetryTile icon={<Square size={18} />} label="Resolucao" value={telemetry.resolution || formatVideo(session)} />
              <TelemetryTile icon={<MonitorSmartphone size={18} />} label="Codec" value={telemetry.codec} />
              <TelemetryTile icon={<RefreshCw size={18} />} label="Drops" value={`${telemetry.framesDropped}`} />
              <TelemetryTile icon={<Gamepad2 size={18} />} label="Input" value={formatInput(session, inputChannelReady, gamepadConnected, gamepadName)} />
            </section>
          </>
        )}

        {activePanel === 'settings' && (
          <>
            <section className="mobile-card">
              <span>Ajustes</span>
              <strong>Aplicativo e conexao</strong>
              <p>{gamepadConnected ? `Controle detectado: ${gamepadName || 'Bluetooth'}.` : 'O controle Bluetooth e detectado automaticamente durante o Stream.'}</p>
              <div className="mobile-action-row">
                <button type="button" disabled={!normalizedUrl || !authToken} onClick={refreshSession}>
                  <RefreshCw size={18} />
                  Atualizar
                </button>
                <button type="button" onClick={clearSavedConnection}>
                  <QrCode size={18} />
                  Limpar QR
                </button>
              </div>
            </section>
            <section className="mobile-card">
              <span>Contas conectadas</span>
              <strong>Opcional e seguro</strong>
              <p>O Gravity Mobile nao coleta senha. Contas de plataformas serao gerenciadas no Gravity Center com OAuth oficial quando disponivel. O scanner local continua funcionando offline.</p>
            </section>
          </>
        )}
      </section>

      {!gameMode && (
        <nav className="mobile-tabs" aria-label="Secoes do Gravity Mobile">
          <button type="button" data-active={activePanel === 'home'} onClick={() => setActivePanel('home')}>
            <House size={17} />
            <span>Home</span>
          </button>
          <button type="button" data-active={activePanel === 'library'} onClick={() => setActivePanel('library')}>
            <Library size={17} />
            <span>Jogos</span>
          </button>
          <button type="button" data-active={activePanel === 'streaming'} onClick={() => setActivePanel('streaming')}>
            <Play size={17} />
            <span>Stream</span>
          </button>
          <button type="button" data-active={activePanel === 'connect'} onClick={() => setActivePanel('connect')}>
            <QrCode size={17} />
            <span>Conexao</span>
          </button>
          <button type="button" data-active={activePanel === 'settings'} onClick={() => setActivePanel('settings')}>
            <Settings size={17} />
            <span>Ajustes</span>
          </button>
        </nav>
      )}

      {!gameMode && (message || error) && (
        <p className={`mobile-feedback${error ? ' is-error' : ''}`}>
          {error || message}
        </p>
      )}
    </main>
  )
}

async function readHostState(targetUrl: string, token: string) {
  const url = normalizeSignalUrl(targetUrl)
  const health = await getHealth(url)
  const result = await getSession(url, token)

  return {
    health,
    result,
    url,
  }
}

async function readMobileLibrary(targetUrl: string, token: string) {
  const result = await listGames(targetUrl, token)

  if (!result.ok) {
    throw new Error(result.message || 'Biblioteca Gravity Deck indisponivel.')
  }

  return result.games
}

function filterMobileGamesByPlatform(games: MobileGame[], platformFilter: LibraryPlatformFilter) {
  if (platformFilter === 'all') {
    return games
  }

  return games.filter((game) => {
    const platform = game.platformId && game.platformId !== 'all'
      ? game.platformId
      : detectPlatformFromSource(`${game.source} ${game.status}`)

    return platform === platformFilter
  })
}

type RemoteButtonProps = {
  code: string
  disabled: boolean
  label: string
  onRemoteInput: (code: string, pressed: boolean) => Promise<void>
}

function MobileGameCard({
  busy,
  game,
  launching,
  onStart,
}: {
  busy: boolean
  game: MobileGame
  launching: boolean
  onStart: (game: MobileGame) => Promise<void>
}) {
  const platformBadge = getPlatformBadgeLabel(game.source)
  const [coverFailed, setCoverFailed] = useState(false)

  return (
    <button type="button" className="mobile-game-card" disabled={busy} onClick={() => onStart(game)}>
      {game.cover && !coverFailed ? (
        <img src={game.cover} alt={game.title} onError={() => setCoverFailed(true)} />
      ) : (
        <span className="mobile-cover-placeholder mobile-generated-cover" aria-label={`Capa gerada para ${game.title}`}>
          <strong>{game.title}</strong>
        </span>
      )}
      <span>
        <strong>{game.title}</strong>
        <small>{game.source}</small>
        <span className="mobile-source-badge">{platformBadge}</span>
      </span>
      {launching ? <Loader2 className="is-spinning" size={17} /> : <Play size={17} />}
    </button>
  )
}

function MobileEmpty({ description, title }: { description: string; title: string }) {
  return (
    <div className="mobile-empty-state">
      <Library size={28} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  )
}

function RemoteButton({ code, disabled, label, onRemoteInput }: RemoteButtonProps) {
  const pressedRef = useRef(false)

  function press(event: PointerEvent<HTMLButtonElement>) {
    if (disabled || pressedRef.current) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pressedRef.current = true
    void onRemoteInput(code, true)
  }

  function release(event: PointerEvent<HTMLButtonElement>) {
    if (!pressedRef.current) {
      return
    }

    event.preventDefault()
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
    pressedRef.current = false
    void onRemoteInput(code, false)
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerCancel={release}
      onPointerDown={press}
      onPointerLeave={release}
      onPointerUp={release}
    >
      {label}
    </button>
  )
}

function TelemetryTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <article>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function formatState(state: StreamTelemetry['state']) {
  const states: Record<StreamTelemetry['state'], string> = {
    idle: 'Aguardando',
    negotiating: 'Negociando',
    connecting: 'Conectando',
    streaming: 'Transmitindo',
    reconnecting: 'Reconectando',
    ended: 'Encerrada',
    failed: 'Falhou',
  }

  return states[state]
}

function formatVideo(session: StreamSessionSummary | null) {
  if (!session) {
    return '0p'
  }

  return `${session.video.height}p`
}

function formatInput(
  session: StreamSessionSummary | null,
  inputChannelReady: boolean,
  gamepadConnected: boolean,
  gamepadName = '',
) {
  const count = session?.input.eventCount || 0
  const transport = inputChannelReady ? 'WebRTC' : 'HTTP'
  const source = gamepadConnected ? (gamepadName || 'Controle') : 'Touch'

  return `${count} ${transport} ${source}`
}

async function readPeerTelemetry(
  peer: RTCPeerConnection,
  session: StreamSessionSummary,
  previousSample: PeerStatsSample | null,
) {
  const report = await peer.getStats()
  const inboundVideo = findStats(report, 'inbound-rtp', 'video')
  const candidatePair = findSelectedCandidatePair(report)
  const codec = getCodecName(report, inboundVideo)
  const bytesReceived = getNumber(inboundVideo, 'bytesReceived')
  const framesDecoded = getNumber(inboundVideo, 'framesDecoded')
  const timestamp = getNumber(inboundVideo, 'timestamp') || Date.now()
  const elapsedSeconds = previousSample ? Math.max(0.001, (timestamp - previousSample.timestamp) / 1000) : 1
  const bitrateKbps = previousSample
    ? Math.max(0, Math.round(((bytesReceived - previousSample.bytesReceived) * 8) / elapsedSeconds / 1000))
    : 0
  const decodedFps = previousSample
    ? Math.max(0, Math.round((framesDecoded - previousSample.framesDecoded) / elapsedSeconds))
    : getNumber(inboundVideo, 'framesPerSecond')
  const packetsLost = getNumber(inboundVideo, 'packetsLost')
  const packetsReceived = getNumber(inboundVideo, 'packetsReceived')
  const totalPackets = packetsLost + packetsReceived
  const telemetry: StreamTelemetry = {
    state: session.state,
    roundTripMs: Math.round(getNumber(candidatePair, 'currentRoundTripTime') * 1000),
    bitrateKbps,
    framesPerSecond: decodedFps,
    captureFramesPerSecond: session.video.framesPerSecond,
    transmitFramesPerSecond: decodedFps,
    packetLossPercent: totalPackets ? Math.round((packetsLost / totalPackets) * 1000) / 10 : 0,
    framesDropped: getNumber(inboundVideo, 'framesDropped'),
    resolution: formatStatsResolution(inboundVideo, session),
    codec: codec || session.video.codec.toUpperCase(),
    encoder: 'WebRTC/Chromium auto',
    captureSource: session.capture?.name || '',
    captureType: session.capture?.type || 'none',
    cpuUsagePercent: null,
    gpuUsagePercent: null,
    networkKbps: bitrateKbps,
  }

  return {
    telemetry,
    sample: {
      bytesReceived,
      framesDecoded,
      timestamp,
    },
  }
}

function findStats(report: RTCStatsReport, type: string, kind?: string) {
  for (const stats of report.values()) {
    const record = stats as RTCStats & Record<string, unknown>

    if (record.type === type && (!kind || record.kind === kind || record.mediaType === kind)) {
      return record
    }
  }

  return null
}

function findSelectedCandidatePair(report: RTCStatsReport) {
  for (const stats of report.values()) {
    const record = stats as RTCStats & Record<string, unknown>

    if (record.type === 'candidate-pair' && (record.selected || record.nominated)) {
      return record
    }
  }

  return null
}

function getCodecName(report: RTCStatsReport, inboundVideo: (RTCStats & Record<string, unknown>) | null) {
  const codecId = typeof inboundVideo?.codecId === 'string' ? inboundVideo.codecId : ''
  const codec = codecId ? report.get(codecId) as (RTCStats & Record<string, unknown>) | undefined : undefined
  const mimeType = typeof codec?.mimeType === 'string' ? codec.mimeType : ''

  return mimeType ? mimeType.replace(/^video\//i, '').toUpperCase() : ''
}

function getNumber(record: (RTCStats & Record<string, unknown>) | null, key: string) {
  const value = record?.[key]
  const number = Number(value)

  return Number.isFinite(number) ? number : 0
}

function formatStatsResolution(
  inboundVideo: (RTCStats & Record<string, unknown>) | null,
  session: StreamSessionSummary,
) {
  const width = getNumber(inboundVideo, 'frameWidth') || session.video.width
  const height = getNumber(inboundVideo, 'frameHeight') || session.video.height

  return `${width}x${height}`
}

function telemetryStateForReport(session: StreamSessionSummary): StreamTelemetry['state'] {
  return session.state === 'streaming' ? 'streaming' : session.state
}

function formatGameCount(count: number) {
  return count === 1 ? '1 jogo' : `${count} jogos`
}

function waitForIceGathering(peer: RTCPeerConnection) {
  if (peer.iceGatheringState === 'complete') {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(done, 1800)

    function done() {
      window.clearTimeout(timeoutId)
      peer.removeEventListener('icegatheringstatechange', handleStateChange)
      resolve()
    }

    function handleStateChange() {
      if (peer.iceGatheringState === 'complete') {
        done()
      }
    }

    peer.addEventListener('icegatheringstatechange', handleStateChange)
  })
}

function parseInputAck(data: unknown): RemoteInputChannelAck | null {
  if (typeof data !== 'string') {
    return null
  }

  try {
    const message = JSON.parse(data) as Partial<RemoteInputChannelAck>

    if (message.kind !== 'remote-input-ack' || typeof message.id !== 'string') {
      return null
    }

    return {
      kind: 'remote-input-ack',
      id: message.id,
      ok: Boolean(message.ok),
      session: message.session,
      message: String(message.message || ''),
    }
  } catch {
    return null
  }
}

function createInputMessageId() {
  return `input-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function isInputChannelOpen(channel: RTCDataChannel | null): channel is RTCDataChannel {
  return channel?.readyState === 'open'
}

function rejectPendingInputAcks(pendingRef: MutableRefObject<Map<string, PendingInputAck>>) {
  for (const pending of pendingRef.current.values()) {
    window.clearTimeout(pending.timeoutId)
    pending.reject(new Error('Canal de input Gravity Stream encerrado.'))
  }

  pendingRef.current.clear()
}

function clearRemoteVideo(videoRef: MutableRefObject<HTMLVideoElement | null>) {
  if (videoRef.current) {
    videoRef.current.srcObject = null
  }
}

function closePeer(
  peerRef: MutableRefObject<RTCPeerConnection | null>,
  inputChannelRef: MutableRefObject<RTCDataChannel | null>,
) {
  if (inputChannelRef.current) {
    inputChannelRef.current.onopen = null
    inputChannelRef.current.onclose = null
    inputChannelRef.current.onerror = null
    inputChannelRef.current.onmessage = null
    inputChannelRef.current.close()
    inputChannelRef.current = null
  }

  peerRef.current?.getReceivers().forEach((receiver) => receiver.track?.stop())
  peerRef.current?.close()
  peerRef.current = null
}

async function requestFullscreenSafely(target: HTMLElement | null) {
  if (!target || document.fullscreenElement || typeof target.requestFullscreen !== 'function') {
    return
  }

  try {
    await target.requestFullscreen()
  } catch {
    // Android WebView can deny fullscreen unless the call is tied to a user gesture.
  }
}

async function exitFullscreenSafely() {
  if (!document.fullscreenElement || typeof document.exitFullscreen !== 'function') {
    return
  }

  try {
    await document.exitFullscreen()
  } catch {
    // Leaving game mode should still work even when the browser refuses the fullscreen API.
  }
}

async function lockLandscapeSafely() {
  const orientation = getLockableOrientation()

  if (!orientation?.lock) {
    return
  }

  try {
    await orientation.lock('landscape')
  } catch {
    // CSS keeps a rotated fullscreen fallback when the native lock is unavailable.
  }
}

function unlockOrientationSafely() {
  const orientation = getLockableOrientation()

  try {
    orientation?.unlock?.()
  } catch {
    // Ignore orientation unlock failures on older Android WebView builds.
  }
}

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>
  unlock?: () => void
}

type WakeLockSentinelLike = {
  release: () => Promise<void>
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>
  }
}

function getLockableOrientation() {
  if (!('orientation' in screen)) {
    return null
  }

  return screen.orientation as LockableScreenOrientation
}

async function requestWakeLockSafely(wakeLockRef: MutableRefObject<WakeLockSentinelLike | null>) {
  const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock

  if (!wakeLock || wakeLockRef.current) {
    return
  }

  try {
    wakeLockRef.current = await wakeLock.request('screen')
  } catch {
    // Some Android WebView builds do not expose screen wake lock.
  }
}

async function releaseWakeLockSafely(wakeLockRef: MutableRefObject<WakeLockSentinelLike | null>) {
  const wakeLock = wakeLockRef.current

  wakeLockRef.current = null

  if (!wakeLock) {
    return
  }

  try {
    await wakeLock.release()
  } catch {
    // Wake lock may already have been released by the OS.
  }
}

function getPrimaryGamepad() {
  if (typeof navigator.getGamepads !== 'function') {
    return null
  }

  const gamepads = navigator.getGamepads()

  for (const gamepad of gamepads) {
    if (gamepad?.connected) {
      return gamepad
    }
  }

  return null
}

function formatGamepadName(value: string) {
  const name = value
    .replace(/\s*\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!name) {
    return ''
  }

  return name.length > 18 ? `${name.slice(0, 18).trim()}...` : name
}
