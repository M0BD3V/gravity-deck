import type { PairingPayload } from '@contracts/mobileCompanion'
import { normalizeSignalUrl } from './signalingClient'

export function parsePairingInput(value: string): PairingPayload {
  const trimmed = value.trim()

  if (!trimmed) {
    throw new Error('Payload de pareamento vazio.')
  }

  if (trimmed.startsWith('{')) {
    return normalizePayload(JSON.parse(trimmed))
  }

  if (trimmed.startsWith('gravity://pair') || trimmed.startsWith('gravity-sync://pair') || trimmed.startsWith('mobdeck://pair')) {
    return parsePairingUrl(trimmed)
  }

  return createManualPayload(trimmed)
}

function parsePairingUrl(value: string) {
  const url = new URL(value)
  const encodedPayload = url.searchParams.get('payload')

  if (!encodedPayload) {
    throw new Error('QR de pareamento sem payload.')
  }

  return normalizePayload(JSON.parse(encodedPayload))
}

function normalizePayload(value: unknown): PairingPayload {
  if (!value || typeof value !== 'object') {
    throw new Error('Payload de pareamento invalido.')
  }

  const source = value as Partial<PairingPayload>
  const serverUrl = normalizeSignalUrl(String(source.serverUrl || ''))
  const issuedAt = String(source.issuedAt || new Date().toISOString())
  const expiresAt = String(source.expiresAt || new Date(Date.now() + 5 * 60 * 1000).toISOString())

  if (Date.parse(expiresAt) <= Date.now()) {
    throw new Error('Pareamento expirado.')
  }

  return {
    protocol: 'gravity-v2',
    serverUrl,
    token: String(source.token || ''),
    pairingCode: String(source.pairingCode || '------'),
    computerName: String(source.computerName || 'Gravity Deck PC'),
    issuedAt,
    expiresAt,
    sessionExpiresAt: source.sessionExpiresAt ? String(source.sessionExpiresAt) : undefined,
  }
}

function createManualPayload(value: string): PairingPayload {
  const issuedAt = new Date()

  return {
    protocol: 'gravity-v2',
    serverUrl: normalizeSignalUrl(value),
    token: '',
    pairingCode: 'manual',
    computerName: 'Gravity Deck PC',
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + 5 * 60 * 1000).toISOString(),
  }
}
