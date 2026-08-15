const crypto = require('crypto')

const pairingTtlMs = 5 * 60 * 1000
const sessionTtlMs = 12 * 60 * 60 * 1000
let activePairing = null
let activeSession = null

function createPairingPayload(options = {}) {
  const serverUrl = String(options.serverUrl || '').trim()

  if (!serverUrl) {
    return {
      ok: false,
      payload: null,
      qrText: '',
      message: 'Gravity Sync indisponivel.',
    }
  }

  const issuedAt = new Date()
  const token = createToken()
  const payload = {
    protocol: 'gravity-v2',
    serverUrl,
    token,
    pairingCode: createPairingCode(),
    computerName: String(options.computerName || 'Gravity Deck PC'),
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + pairingTtlMs).toISOString(),
    sessionExpiresAt: new Date(issuedAt.getTime() + sessionTtlMs).toISOString(),
  }

  activePairing = {
    payload,
    tokenHash: hashToken(token),
    expiresAtMs: issuedAt.getTime() + pairingTtlMs,
  }
  activeSession = null

  return {
    ok: true,
    payload,
    qrText: encodePairingPayload(payload),
    message: `${payload.computerName}: codigo ${payload.pairingCode} ativo.`,
  }
}

function getActivePairingPayload(options = {}) {
  pruneExpiredPairing()

  if (!activePairing) {
    return null
  }

  return createPublicPayload(activePairing.payload, {
    includeToken: Boolean(options.includeToken),
  })
}

function getActiveMobileSession() {
  pruneExpiredSession()

  if (!activeSession) {
    return null
  }

  return {
    paired: true,
    pairedAt: activeSession.pairedAt,
    lastSeenAt: activeSession.lastSeenAt,
    expiresAt: activeSession.expiresAt,
  }
}

function validateSessionToken(rawToken) {
  const token = String(rawToken || '').trim()

  if (!token) {
    return {
      ok: false,
      statusCode: 401,
      message: 'Pareamento obrigatorio. Escaneie o QR do Gravity Deck novamente.',
    }
  }

  pruneExpiredPairing()
  pruneExpiredSession()

  const tokenHash = hashToken(token)

  if (activeSession?.tokenHash && secureEqual(activeSession.tokenHash, tokenHash)) {
    touchActiveSession()
    return {
      ok: true,
      session: getActiveMobileSession(),
    }
  }

  if (activePairing?.tokenHash && secureEqual(activePairing.tokenHash, tokenHash)) {
    const now = Date.now()

    activeSession = {
      tokenHash,
      pairedAt: new Date(now).toISOString(),
      lastSeenAt: new Date(now).toISOString(),
      expiresAt: new Date(now + sessionTtlMs).toISOString(),
    }

    return {
      ok: true,
      session: getActiveMobileSession(),
    }
  }

  return {
    ok: false,
    statusCode: 401,
    message: 'Sessao mobile expirada ou invalida. Gere um novo QR no Gravity Deck.',
  }
}

function encodePairingPayload(payload) {
  return `gravity://pair?payload=${encodeURIComponent(JSON.stringify(payload))}`
}

function createToken() {
  return crypto.randomBytes(32).toString('base64url')
}

function createPairingCode() {
  const value = crypto.randomInt(0, 1000000)

  return value.toString().padStart(6, '0')
}

function createPublicPayload(payload, options = {}) {
  return {
    ...payload,
    token: options.includeToken ? payload.token : '',
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left), 'hex')
  const rightBuffer = Buffer.from(String(right), 'hex')

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function touchActiveSession() {
  if (!activeSession) {
    return
  }

  const now = Date.now()

  activeSession.lastSeenAt = new Date(now).toISOString()
  activeSession.expiresAt = new Date(now + sessionTtlMs).toISOString()
}

function pruneExpiredPairing() {
  if (activePairing && activePairing.expiresAtMs <= Date.now()) {
    activePairing = null
  }
}

function pruneExpiredSession() {
  if (activeSession && Date.parse(activeSession.expiresAt) <= Date.now()) {
    activeSession = null
  }
}

module.exports = {
  createPairingPayload,
  encodePairingPayload,
  getActiveMobileSession,
  getActivePairingPayload,
  validateSessionToken,
}
