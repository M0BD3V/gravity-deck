const crypto = require('crypto')
const { injectRemoteInput } = require('./inputInjectionService.cjs')

const presets = {
  performance: {
    width: 1280,
    height: 720,
    framesPerSecond: 60,
    bitrateKbps: 6500,
    codec: 'h264',
  },
  balanced: {
    width: 1920,
    height: 1080,
    framesPerSecond: 60,
    bitrateKbps: 10000,
    codec: 'h264',
  },
  quality: {
    width: 2560,
    height: 1440,
    framesPerSecond: 60,
    bitrateKbps: 18000,
    codec: 'h264',
  },
}
const connectionStates = new Set(['connecting', 'streaming', 'reconnecting', 'failed', 'ended'])

let activeSession = null
let inputEventCount = 0
let lastTelemetryReport = null

function prepareStreamSession(game, options = {}) {
  const preset = normalizePreset(options.preset)
  const video = presets[preset]
  const now = new Date().toISOString()
  const sessionId = createSessionId()

  activeSession = {
    sessionId,
    gameId: String(game?.id || ''),
    gameTitle: String(game?.title || game?.name || 'Jogo'),
    state: 'negotiating',
    preset,
    joinCode: createJoinCode(),
    hostAddress: String(options.hostAddress || '127.0.0.1'),
    signalingUrl: String(options.signalingUrl || ''),
    createdAt: now,
    updatedAt: now,
    video,
    capture: options.capture || null,
    input: {
      gamepad: 'planned',
      keyboardMouse: 'planned',
      lastInputAt: '',
      eventCount: 0,
    },
  }
  inputEventCount = 0
  lastTelemetryReport = null

  return {
    ok: true,
    session: activeSession,
    telemetry: getStreamTelemetry(),
    message: `${activeSession.gameTitle}: sessao mobile criada com codigo ${activeSession.joinCode}.`,
  }
}

function getActiveStreamSession() {
  return activeSession
}

function getStreamTelemetry() {
  if (!activeSession) {
    return createTelemetry({
      state: 'idle',
    })
  }

  const reportIsFresh = lastTelemetryReport
    && Date.now() - lastTelemetryReport.reportedAt < 3500
  const reported = reportIsFresh ? lastTelemetryReport.telemetry : {}

  return createTelemetry({
    state: activeSession.state,
    roundTripMs: Number(reported.roundTripMs || 0),
    bitrateKbps: Number(reported.bitrateKbps || (activeSession.state === 'streaming' ? activeSession.video.bitrateKbps : 0)),
    framesPerSecond: Number(reported.framesPerSecond || 0),
    captureFramesPerSecond: Number(reported.captureFramesPerSecond || activeSession.video.framesPerSecond),
    transmitFramesPerSecond: Number(reported.transmitFramesPerSecond || reported.framesPerSecond || 0),
    packetLossPercent: Number(reported.packetLossPercent || 0),
    framesDropped: Number(reported.framesDropped || 0),
    resolution: String(reported.resolution || `${activeSession.video.width}x${activeSession.video.height}`),
    codec: String(reported.codec || activeSession.video.codec).toUpperCase(),
    encoder: String(reported.encoder || 'WebRTC/Chromium auto'),
    captureSource: String(activeSession.capture?.name || ''),
    captureType: activeSession.capture?.type || 'none',
    cpuUsagePercent: normalizeNullableNumber(reported.cpuUsagePercent),
    gpuUsagePercent: normalizeNullableNumber(reported.gpuUsagePercent),
    networkKbps: Number(reported.networkKbps || reported.bitrateKbps || 0),
  })
}

function reportStreamTelemetry(telemetry = {}) {
  lastTelemetryReport = {
    reportedAt: Date.now(),
    telemetry: {
      ...telemetry,
      state: activeSession?.state || telemetry.state || 'idle',
    },
  }

  return {
    ok: true,
    telemetry: getStreamTelemetry(),
    message: 'Diagnostico Gravity Stream atualizado.',
  }
}

function acceptStreamAnswer(answer = {}) {
  if (!activeSession) {
    return {
      ok: false,
      message: 'Nenhuma sessao de streaming ativa.',
    }
  }

  if (answer.sessionId && answer.sessionId !== activeSession.sessionId) {
    return {
      ok: false,
      message: 'Resposta recebida para uma sessao diferente.',
    }
  }

  activeSession = {
    ...activeSession,
    state: 'connecting',
    updatedAt: new Date().toISOString(),
  }

  return {
    ok: true,
    session: activeSession,
    telemetry: getStreamTelemetry(),
    message: 'Resposta mobile recebida; aguardando conexao WebRTC.',
  }
}

function updateStreamConnectionState(update = {}) {
  if (!activeSession) {
    return {
      ok: false,
      session: null,
      telemetry: getStreamTelemetry(),
      message: 'Estado ignorado: nenhuma sessao de streaming ativa.',
    }
  }

  if (update.sessionId && update.sessionId !== activeSession.sessionId) {
    return {
      ok: false,
      session: activeSession,
      telemetry: getStreamTelemetry(),
      message: 'Estado recebido para uma sessao diferente.',
    }
  }

  const nextState = String(update.state || '')

  if (!connectionStates.has(nextState)) {
    return {
      ok: false,
      session: activeSession,
      telemetry: getStreamTelemetry(),
      message: 'Estado de conexao Gravity Stream invalido.',
    }
  }

  activeSession = {
    ...activeSession,
    state: nextState,
    updatedAt: new Date().toISOString(),
  }

  return {
    ok: true,
    session: activeSession,
    telemetry: getStreamTelemetry(),
    message: getConnectionStateMessage(nextState),
  }
}

async function recordRemoteInput(event = {}, options = {}) {
  if (!activeSession) {
    return {
      ok: false,
      delivery: null,
      message: 'Entrada remota ignorada: nenhuma sessao ativa.',
    }
  }

  const delivery = await injectRemoteInput(event, options)

  if (!delivery.ok) {
    return {
      ok: false,
      session: activeSession,
      delivery,
      message: delivery.message || 'Entrada remota recusada.',
    }
  }

  inputEventCount += 1
  const eventTime = normalizeEventTime(event.at)
  const isGamepadEvent = event.type === 'button' || event.type === 'axis'
  const isPointerEvent = event.type === 'pointer'

  activeSession = {
    ...activeSession,
    updatedAt: new Date().toISOString(),
    input: {
      ...activeSession.input,
      gamepad: isGamepadEvent ? 'ready' : activeSession.input.gamepad,
      keyboardMouse: isPointerEvent ? 'ready' : activeSession.input.keyboardMouse,
      lastInputAt: eventTime,
      eventCount: inputEventCount,
    },
  }

  return {
    ok: true,
    session: activeSession,
    delivery,
    message: delivery.message || 'Entrada remota registrada.',
  }
}

function stopActiveStreamSession() {
  if (!activeSession) {
    return {
      ok: true,
      session: null,
      telemetry: getStreamTelemetry(),
      message: 'Nenhuma sessao ativa para encerrar.',
    }
  }

  const endedSession = {
    ...activeSession,
    state: 'ended',
    updatedAt: new Date().toISOString(),
  }
  activeSession = null
  inputEventCount = 0
  lastTelemetryReport = null

  return {
    ok: true,
    session: endedSession,
    telemetry: getStreamTelemetry(),
    message: 'Sessao mobile encerrada.',
  }
}

function createTelemetry(values = {}) {
  return {
    state: values.state || 'idle',
    roundTripMs: Number(values.roundTripMs || 0),
    bitrateKbps: Number(values.bitrateKbps || 0),
    framesPerSecond: Number(values.framesPerSecond || 0),
    captureFramesPerSecond: Number(values.captureFramesPerSecond || 0),
    transmitFramesPerSecond: Number(values.transmitFramesPerSecond || values.framesPerSecond || 0),
    packetLossPercent: Number(values.packetLossPercent || 0),
    framesDropped: Number(values.framesDropped || 0),
    resolution: String(values.resolution || '0x0'),
    codec: String(values.codec || 'N/D'),
    encoder: String(values.encoder || 'N/D'),
    captureSource: String(values.captureSource || ''),
    captureType: values.captureType || 'none',
    cpuUsagePercent: normalizeNullableNumber(values.cpuUsagePercent),
    gpuUsagePercent: normalizeNullableNumber(values.gpuUsagePercent),
    networkKbps: Number(values.networkKbps || values.bitrateKbps || 0),
  }
}

function normalizeNullableNumber(value) {
  const number = Number(value)

  return Number.isFinite(number) ? number : null
}

function normalizePreset(value) {
  return Object.hasOwn(presets, value) ? value : 'performance'
}

function createSessionId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return crypto.randomBytes(16).toString('hex')
}

function createJoinCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase()
}

function normalizeEventTime(value) {
  const date = Number.isFinite(Number(value)) ? new Date(Number(value)) : new Date()

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString()
  }

  return date.toISOString()
}

function getConnectionStateMessage(state) {
  const messages = {
    connecting: 'Gravity Stream conectando.',
    streaming: 'Gravity Stream transmitindo.',
    reconnecting: 'Gravity Stream tentando reconectar.',
    failed: 'Gravity Stream falhou.',
    ended: 'Gravity Stream encerrado.',
  }

  return messages[state] || 'Estado Gravity Stream atualizado.'
}

module.exports = {
  acceptStreamAnswer,
  getActiveStreamSession,
  getStreamTelemetry,
  prepareStreamSession,
  reportStreamTelemetry,
  recordRemoteInput,
  stopActiveStreamSession,
  updateStreamConnectionState,
}
