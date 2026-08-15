const assert = require('node:assert/strict')
const test = require('node:test')

const { createPairingPayload, validateSessionToken } = require('../apps/desktop/services/pairingService.cjs')
const { startSignalingServer } = require('../apps/desktop/services/signalingServer.cjs')

test('Gravity Deck Host rejects sensitive LAN routes without a bearer token', async (t) => {
  const server = await startTestServer()
  t.after(() => server.close())

  const response = await fetch(`${server.url}/games`)
  const payload = await response.json()

  assert.equal(response.status, 401)
  assert.equal(payload.ok, false)
})

test('Gravity Deck Host accepts QR session tokens through Authorization bearer', async (t) => {
  const server = await startTestServer()
  t.after(() => server.close())

  const pairing = createPairingPayload({
    serverUrl: server.url,
    computerName: 'Gravity Deck Test',
  })
  const response = await fetch(`${server.url}/games`, {
    headers: {
      authorization: `Bearer ${pairing.payload.token}`,
    },
  })
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.ok, true)
  assert.deepEqual(payload.games, [])
})

test('Gravity Deck Host rejects launch requests without a paired session', async (t) => {
  const server = await startTestServer()
  t.after(() => server.close())

  const response = await fetch(`${server.url}/launch`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ gameId: 'test', mode: 'mobile-stream' }),
  })
  const payload = await response.json()

  assert.equal(response.status, 401)
  assert.equal(payload.ok, false)
})

async function startTestServer() {
  const server = await startSignalingServer({
    host: '127.0.0.1',
    port: 0,
    services: {
      listGames: async () => ({ ok: true, games: [] }),
      launchGame: async () => ({ ok: true, message: 'dry-run' }),
      validateAuthToken: validateSessionToken,
    },
  })

  return {
    ...server,
    url: `http://127.0.0.1:${server.port}`,
  }
}
