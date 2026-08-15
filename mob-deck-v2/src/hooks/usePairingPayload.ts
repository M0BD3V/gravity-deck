import { useState } from 'react'
import QRCode from 'qrcode'
import type { PairingPayload, PairingPayloadResult } from '../contracts/mobileCompanion'

type PairingState = {
  payload: PairingPayload | null
  qrDataUrl: string
  qrText: string
  loading: boolean
  message: string
  error: string
  createPairing: () => Promise<void>
  copyPairingText: () => Promise<void>
}

export function usePairingPayload(): PairingState {
  const [payload, setPayload] = useState<PairingPayload | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrText, setQrText] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function createPairing() {
    setLoading(true)
    setError('')

    try {
      const result = window.mobDeckDesktop?.createPairingPayload
        ? await window.mobDeckDesktop.createPairingPayload()
        : createBrowserPairingPayload()

      if (!result.ok || !result.payload || !result.qrText) {
        throw new Error(result.message || 'Pareamento indisponivel.')
      }

      const dataUrl = await QRCode.toDataURL(result.qrText, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 180,
        color: {
          dark: '#090c10',
          light: '#ffffff',
        },
      })

      setPayload(result.payload)
      setQrText(result.qrText)
      setQrDataUrl(dataUrl)
      setMessage(result.message)
    } catch (pairingError) {
      setError(pairingError instanceof Error ? pairingError.message : 'Pareamento nao concluido.')
    } finally {
      setLoading(false)
    }
  }

  async function copyPairingText() {
    if (!qrText) {
      return
    }

    try {
      await navigator.clipboard.writeText(qrText)
      setMessage('Pareamento copiado.')
    } catch {
      setError('Nao foi possivel copiar o pareamento.')
    }
  }

  return {
    payload,
    qrDataUrl,
    qrText,
    loading,
    message,
    error,
    createPairing,
    copyPairingText,
  }
}

function createBrowserPairingPayload(): PairingPayloadResult {
  const issuedAt = new Date()
  const payload: PairingPayload = {
    protocol: 'gravity-v2',
    serverUrl: `http://${window.location.hostname || '127.0.0.1'}:47321`,
    token: crypto.randomUUID(),
    pairingCode: '000000',
    computerName: 'Gravity Deck Browser',
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + 5 * 60 * 1000).toISOString(),
    sessionExpiresAt: new Date(issuedAt.getTime() + 12 * 60 * 60 * 1000).toISOString(),
  }
  const qrText = `gravity://pair?payload=${encodeURIComponent(JSON.stringify(payload))}`

  return {
    ok: true,
    payload,
    qrText,
    message: `${payload.computerName}: codigo ${payload.pairingCode} ativo.`,
  }
}
