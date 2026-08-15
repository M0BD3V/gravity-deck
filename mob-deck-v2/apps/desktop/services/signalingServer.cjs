const http = require('http')

const defaultPort = 47321
const maxBodyBytes = 64 * 1024

async function startSignalingServer(options = {}) {
  const preferredPort = normalizePort(options.port, defaultPort)
  const host = options.host || '0.0.0.0'
  const services = options.services || {}
  const cors = createCorsOptions(options.cors)
  const server = http.createServer((request, response) => {
    handleRequest(request, response, services, cors)
  })

  const port = await listenWithFallback(server, host, preferredPort)

  return {
    port,
    host,
    close: () => closeServer(server),
    getStatus: () => ({
      ok: true,
      host,
      port,
      protocol: 'http',
      message: `Gravity Sync ouvindo na porta ${port}.`,
    }),
  }
}

async function handleRequest(request, response, services, cors) {
  const url = new URL(request.url || '/', 'http://gravity.local')
  const routeKey = `${request.method || 'GET'} ${url.pathname}`

  setCorsHeaders(request, response, cors)

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  try {
    if (routeKey === 'GET /health') {
      writeJson(response, 200, {
        ok: true,
        name: 'gravity-sync-signaling',
        message: 'Gravity Deck desktop host ativo.',
      })
      return
    }

    const auth = authorizeRequest(request, services)

    if (!auth.ok) {
      response.setHeader('WWW-Authenticate', 'Bearer realm="Gravity Deck"')
      writeJson(response, auth.statusCode || 401, {
        ok: false,
        message: auth.message || 'Sessao mobile nao autorizada.',
      })
      return
    }

    if (routeKey === 'GET /session') {
      const session = services.getActiveStreamSession?.() || null
      writeJson(response, 200, {
        ok: true,
        session,
        telemetry: services.getStreamTelemetry?.() || null,
        message: session ? 'Sessao mobile ativa.' : 'Nenhuma sessao mobile ativa.',
      })
      return
    }

    if (routeKey === 'GET /telemetry') {
      writeJson(response, 200, services.getStreamTelemetry?.() || { state: 'idle' })
      return
    }

    if (routeKey === 'POST /telemetry') {
      const body = await readJsonBody(request)
      const result = services.reportStreamTelemetry
        ? services.reportStreamTelemetry(body)
        : serviceUnavailable()

      writeJson(response, 200, result)
      return
    }

    if (routeKey === 'GET /capture-sources') {
      const result = services.listCaptureSources
        ? await services.listCaptureSources()
        : serviceUnavailable()

      writeJson(response, 200, result)
      return
    }

    if (routeKey === 'GET /games') {
      const result = services.listGames
        ? await services.listGames()
        : serviceUnavailable()

      writeJson(response, 200, result)
      return
    }

    if (routeKey === 'GET /games/status') {
      const result = services.getLibraryStatus
        ? services.getLibraryStatus()
        : serviceUnavailable()

      writeJson(response, 200, result)
      return
    }

    if (routeKey === 'POST /games/refresh') {
      const result = services.refreshLibrary
        ? await services.refreshLibrary()
        : serviceUnavailable()

      writeJson(response, 200, result)
      return
    }

    if (routeKey === 'POST /launch') {
      const body = await readJsonBody(request)
      const result = services.launchGame
        ? await services.launchGame(body)
        : serviceUnavailable()

      writeJson(response, 200, result)
      return
    }

    if (routeKey === 'POST /offer') {
      const body = await readJsonBody(request)
      const result = services.createStreamOffer
        ? await services.createStreamOffer(body)
        : serviceUnavailable()

      writeJson(response, 200, result)
      return
    }

    if (routeKey === 'POST /answer') {
      const body = await readJsonBody(request)
      writeJson(response, 200, services.acceptStreamAnswer?.(body) || serviceUnavailable())
      return
    }

    if (routeKey === 'POST /input') {
      const body = await readJsonBody(request)
      const result = services.recordRemoteInput
        ? await services.recordRemoteInput(body)
        : serviceUnavailable()

      writeJson(response, 200, result)
      return
    }

    if (routeKey === 'POST /stop') {
      writeJson(response, 200, services.stopActiveStreamSession?.() || serviceUnavailable())
      return
    }

    writeJson(response, 404, {
      ok: false,
      message: 'Rota de sinalizacao nao encontrada.',
    })
  } catch (error) {
    writeJson(response, error.statusCode || 500, {
      ok: false,
      message: error.message || 'Erro no servidor de sinalizacao.',
    })
  }
}

function setCorsHeaders(request, response, cors) {
  const origin = String(request.headers.origin || '')

  if (origin && isAllowedOrigin(origin, cors)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
  }

  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Gravity-Deck-Token, X-MobDeck-Token')
  response.setHeader('Access-Control-Allow-Private-Network', 'true')
  response.setHeader('Access-Control-Max-Age', '86400')
}

function authorizeRequest(request, services) {
  const validator = services.validateAuthToken

  if (typeof validator !== 'function') {
    return {
      ok: false,
      statusCode: 503,
      message: 'Autenticacao do Gravity Deck Host indisponivel.',
    }
  }

  return validator(extractBearerToken(request))
}

function extractBearerToken(request) {
  const authorization = String(request.headers.authorization || '')
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i)

  if (bearerMatch) {
    return bearerMatch[1].trim()
  }

  return String(
    request.headers['x-gravity-deck-token']
    || request.headers['x-mobdeck-token']
    || '',
  ).trim()
}

function createCorsOptions(value = {}) {
  const allowedOrigins = new Set([
    'capacitor://localhost',
    'http://localhost',
    'http://127.0.0.1',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://[::1]:5174',
    ...(Array.isArray(value.allowedOrigins) ? value.allowedOrigins : []),
    ...String(process.env.MOB_DECK_V2_ALLOWED_ORIGINS || '')
      .split(/[;,]/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  ])

  return {
    allowedOrigins,
  }
}

function isAllowedOrigin(origin, cors) {
  if (cors.allowedOrigins.has(origin)) {
    return true
  }

  try {
    const parsed = new URL(origin)
    const hostname = parsed.hostname.toLowerCase()

    return (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1')
      && (parsed.protocol === 'http:' || parsed.protocol === 'capacitor:' || parsed.protocol === 'ionic:')
  } catch {
    return false
  }
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(`${JSON.stringify(payload)}\n`)
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []

    request.on('data', (chunk) => {
      size += chunk.length

      if (size > maxBodyBytes) {
        const error = new Error('Payload JSON excede o limite do Gravity Sync.')
        error.statusCode = 413
        reject(error)
        request.destroy()
        return
      }

      chunks.push(chunk)
    })

    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim()

      if (!raw) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(raw))
      } catch {
        const error = new Error('Payload JSON invalido.')
        error.statusCode = 400
        reject(error)
      }
    })

    request.on('error', reject)
  })
}

function listenWithFallback(server, host, preferredPort) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      const onError = (error) => {
        server.off('listening', onListening)

        if (error.code === 'EADDRINUSE' && port < preferredPort + 20) {
          tryPort(port + 1)
          return
        }

        reject(error)
      }

      const onListening = () => {
        server.off('error', onError)
        const address = server.address()
        resolve(typeof address === 'object' && address ? address.port : port)
      }

      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(port, host)
    }

    tryPort(preferredPort)
  })
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function normalizePort(value, fallback) {
  const port = Number(value)

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    return fallback
  }

  return port
}

function serviceUnavailable() {
  return {
    ok: false,
    message: 'Servico de streaming indisponivel.',
  }
}

module.exports = {
  startSignalingServer,
}
