import { CapacitorHttp } from '@capacitor/core'
import type { GamesResult, LaunchRequest, LaunchResult } from '@contracts/desktopHost'
import type {
  CaptureSourcesResult,
  RemoteInputEvent,
  RemoteInputResult,
  StreamAnswer,
  StreamOfferRequest,
  StreamOfferResult,
  StreamSessionResult,
  StreamTelemetry,
} from '@contracts/streaming'

export type SignalHealth = {
  ok: boolean
  name: string
  message: string
}
export type MobileGame = GamesResult['games'][number]

type RequestOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
  token?: string
}

const requestTimeoutMs = 5000

export function normalizeSignalUrl(value: string) {
  const trimmed = value.trim()
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
  const parsed = new URL(withProtocol)

  parsed.protocol = 'http:'

  return parsed.origin
}

export async function getHealth(baseUrl: string) {
  return requestJson<SignalHealth>(baseUrl, '/health')
}

export async function getSession(baseUrl: string, token?: string) {
  return requestJson<StreamSessionResult>(baseUrl, '/session', { token })
}

export async function getTelemetry(baseUrl: string, token?: string) {
  return requestJson<StreamTelemetry>(baseUrl, '/telemetry', { token })
}

export async function reportTelemetry(baseUrl: string, telemetry: StreamTelemetry, token?: string) {
  return requestJson<{ ok: boolean; telemetry: StreamTelemetry; message: string }>(baseUrl, '/telemetry', {
    method: 'POST',
    body: telemetry,
    token,
  })
}

export async function getCaptureSources(baseUrl: string, token?: string) {
  return requestJson<CaptureSourcesResult>(baseUrl, '/capture-sources', { token })
}

export async function listGames(baseUrl: string, token?: string) {
  return requestJson<GamesResult>(baseUrl, '/games', { token })
}

export async function refreshGames(baseUrl: string, token?: string) {
  return requestJson<GamesResult>(baseUrl, '/games/refresh', {
    method: 'POST',
    token,
  })
}

export async function launchGame(baseUrl: string, request: LaunchRequest, token?: string) {
  return requestJson<LaunchResult>(baseUrl, '/launch', {
    method: 'POST',
    body: request,
    token,
  })
}

export async function requestStreamOffer(baseUrl: string, request: StreamOfferRequest, token?: string) {
  return requestJson<StreamOfferResult>(baseUrl, '/offer', {
    method: 'POST',
    body: request,
    token,
  })
}

export async function acceptStreamAnswer(baseUrl: string, answer: StreamAnswer, token?: string) {
  return requestJson<StreamSessionResult>(baseUrl, '/answer', {
    method: 'POST',
    body: answer,
    token,
  })
}

export async function sendRemoteInput(baseUrl: string, event: RemoteInputEvent, token?: string) {
  return requestJson<RemoteInputResult>(baseUrl, '/input', {
    method: 'POST',
    body: event,
    token,
  })
}

export async function stopStreamSession(baseUrl: string, token?: string) {
  return requestJson<StreamSessionResult>(baseUrl, '/stop', {
    method: 'POST',
    token,
  })
}

async function requestJson<T>(baseUrl: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    accept: 'application/json',
  }
  const body = options.body === undefined ? undefined : JSON.stringify(options.body)

  if (body) {
    headers['content-type'] = 'application/json'
  }

  if (options.token) {
    headers.authorization = `Bearer ${options.token}`
  }

  try {
    const response = await CapacitorHttp.request({
      url: `${normalizeSignalUrl(baseUrl)}${path}`,
      method: options.method || 'GET',
      headers,
      data: body,
      responseType: 'json',
      connectTimeout: requestTimeoutMs,
      readTimeout: requestTimeoutMs,
    })
    const payload = getResponseData(response.data)

    if (response.status < 200 || response.status >= 300) {
      throw new Error(getPayloadMessage(payload) || `HTTP ${response.status}`)
    }

    return payload as T
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Nao conectou. Use http://IP_DO_PC:47321 e confirme que PC e celular estao na mesma rede.')
    }

    if (error instanceof Error && error.message.toLowerCase().includes('timeout')) {
      throw new Error('Tempo de conexao esgotado.')
    }

    throw error
  }
}

function getResponseData(data: unknown) {
  if (typeof data !== 'string') {
    return data || {}
  }

  try {
    return JSON.parse(data)
  } catch {
    return {}
  }
}

function getPayloadMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    return String(payload.message)
  }

  return ''
}
