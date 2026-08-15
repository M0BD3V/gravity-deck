import { useEffect, useRef } from 'react'
import type {
  RemoteInputChannelAck,
  RemoteInputChannelRequest,
  StreamAnswer,
  StreamConnectionStateUpdate,
  StreamOfferBridgeRequest,
  StreamOfferBridgeResult,
} from '../contracts/streaming'

type DesktopMediaConstraints = MediaStreamConstraints & {
  audio?: false | {
    mandatory: {
      chromeMediaSource: 'desktop'
    }
  }
  video: {
    mandatory: {
      chromeMediaSource: 'desktop'
      chromeMediaSourceId: string
      minWidth: number
      maxWidth: number
      minHeight: number
      maxHeight: number
      minFrameRate: number
      maxFrameRate: number
    }
  }
}

const iceGatheringTimeoutMs = 1800

export function useStreamOfferBridge() {
  const peersRef = useRef(new Map<string, RTCPeerConnection>())
  const streamsRef = useRef(new Map<string, MediaStream>())

  useEffect(() => {
    if (!window.mobDeckDesktop?.onStreamOfferRequest || !window.mobDeckDesktop?.sendStreamOfferResult) {
      return undefined
    }
    const peers = peersRef.current
    const streams = streamsRef.current

    const removeOfferListener = window.mobDeckDesktop.onStreamOfferRequest((request) => {
      createOffer(request, peers, streams)
        .then((result) => window.mobDeckDesktop?.sendStreamOfferResult(result))
        .catch((error) => {
          window.mobDeckDesktop?.sendStreamOfferResult({
            requestId: request.requestId,
            ok: false,
            offer: null,
            session: request.session,
            telemetry: {
              state: 'failed',
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
            },
            message: error instanceof Error ? error.message : 'Nao foi possivel criar o offer Gravity Stream.',
          })
        })
    })

    const removeAnswerListener = window.mobDeckDesktop.onStreamAnswer?.((answer) => {
      applyAnswer(answer, peers).catch(() => {})
    })

    return () => {
      removeOfferListener()
      removeAnswerListener?.()
      closeAllPeers(peers, streams)
    }
  }, [])
}

async function createOffer(
  request: StreamOfferBridgeRequest,
  peers: Map<string, RTCPeerConnection>,
  streams: Map<string, MediaStream>,
): Promise<StreamOfferBridgeResult> {
  const { session } = request

  if (!session.capture?.id) {
    return createFailure(request, 'Fonte de captura nao informada.')
  }

  closePeer(session.sessionId, peers, streams)

  const peer = new RTCPeerConnection({
    iceServers: request.iceServers,
    bundlePolicy: 'max-bundle',
  })
  const stream = await getDesktopStream(request)

  stream.getTracks().forEach((track) => {
    if (track.kind === 'video') {
      track.contentHint = 'motion'
    }

    const sender = peer.addTrack(track, stream)

    if (track.kind === 'video') {
      applyLowLatencySenderParameters(sender, session.video).catch(() => {})
    }
  })
  const inputChannel = peer.createDataChannel('gravity-input', {
    ordered: false,
    maxRetransmits: 0,
  })
  bindPeerState(peer, session.sessionId)
  bindInputChannel(inputChannel, session.sessionId)

  peers.set(session.sessionId, peer)
  streams.set(session.sessionId, stream)

  const offer = await peer.createOffer()
  await peer.setLocalDescription(offer)
  await waitForIceGathering(peer)

  return {
    requestId: request.requestId,
    ok: true,
    offer: {
      sessionId: session.sessionId,
      type: 'offer',
      sdp: peer.localDescription?.sdp || offer.sdp || '',
      iceServers: request.iceServers,
      capture: session.capture,
      video: session.video,
      createdAt: new Date().toISOString(),
    },
    session,
    telemetry: {
      state: 'negotiating',
      roundTripMs: 0,
      bitrateKbps: 0,
      framesPerSecond: 0,
      captureFramesPerSecond: 0,
      transmitFramesPerSecond: 0,
      packetLossPercent: 0,
      framesDropped: 0,
      resolution: `${session.video.width}x${session.video.height}`,
      codec: session.video.codec.toUpperCase(),
      encoder: 'WebRTC/Chromium auto',
      captureSource: session.capture.name,
      captureType: session.capture.type,
      cpuUsagePercent: null,
      gpuUsagePercent: null,
      networkKbps: 0,
    },
    message: `${session.capture.name}: offer Gravity Stream criado.`,
  }
}

async function applyLowLatencySenderParameters(sender: RTCRtpSender, video: StreamOfferBridgeRequest['session']['video']) {
  const parameters = sender.getParameters()
  const encoding = parameters.encodings?.[0] || {}

  parameters.degradationPreference = 'maintain-framerate'
  parameters.encodings = [{
    ...encoding,
    active: true,
    maxBitrate: video.bitrateKbps * 1000,
    maxFramerate: video.framesPerSecond,
    scaleResolutionDownBy: 1,
  }]

  await sender.setParameters(parameters)
}

function bindPeerState(peer: RTCPeerConnection, sessionId: string) {
  peer.addEventListener('connectionstatechange', () => {
    const state = mapPeerState(peer.connectionState)

    if (state) {
      notifyStreamState(sessionId, state).catch(() => {})
    }
  })
}

function bindInputChannel(channel: RTCDataChannel, sessionId: string) {
  channel.addEventListener('open', () => {
    notifyStreamState(sessionId, 'streaming').catch(() => {})
  })

  channel.addEventListener('message', (event) => {
    handleInputChannelMessage(channel, event.data).catch(() => {
      sendInputAck(channel, {
        kind: 'remote-input-ack',
        id: '',
        ok: false,
        message: 'Entrada remota invalida no canal Gravity Stream.',
      })
    })
  })
}

async function handleInputChannelMessage(channel: RTCDataChannel, data: unknown) {
  const request = parseInputRequest(data)

  if (!request) {
    return
  }

  if (!window.mobDeckDesktop?.sendRemoteInput) {
    sendInputAck(channel, {
      kind: 'remote-input-ack',
      id: request.id,
      ok: false,
      message: 'Host de input Gravity Stream indisponivel.',
    })
    return
  }

  const result = await window.mobDeckDesktop.sendRemoteInput(request.event)

  sendInputAck(channel, {
    kind: 'remote-input-ack',
    id: request.id,
    ok: result.ok,
    session: result.session,
    message: result.message,
  })
}

function parseInputRequest(data: unknown): RemoteInputChannelRequest | null {
  if (typeof data !== 'string') {
    return null
  }

  try {
    const message = JSON.parse(data) as Partial<RemoteInputChannelRequest>

    if (message.kind !== 'remote-input' || typeof message.id !== 'string' || !message.event) {
      return null
    }

    return message as RemoteInputChannelRequest
  } catch {
    return null
  }
}

function sendInputAck(channel: RTCDataChannel, message: RemoteInputChannelAck) {
  if (channel.readyState !== 'open') {
    return
  }

  channel.send(JSON.stringify(message))
}

function notifyStreamState(sessionId: string, state: StreamConnectionStateUpdate['state']) {
  return window.mobDeckDesktop?.updateStreamConnectionState?.({
    sessionId,
    state,
  }) || Promise.resolve()
}

function mapPeerState(state: RTCPeerConnectionState): StreamConnectionStateUpdate['state'] | null {
  if (state === 'connected') {
    return 'streaming'
  }

  if (state === 'connecting') {
    return 'connecting'
  }

  if (state === 'disconnected') {
    return 'reconnecting'
  }

  if (state === 'failed') {
    return 'failed'
  }

  return null
}

async function getDesktopStream(request: StreamOfferBridgeRequest) {
  try {
    return await navigator.mediaDevices.getUserMedia(createDesktopMediaConstraints(request, true))
  } catch {
    return await navigator.mediaDevices.getUserMedia(createDesktopMediaConstraints(request, false))
  }
}

function createDesktopMediaConstraints(request: StreamOfferBridgeRequest, includeAudio: boolean): DesktopMediaConstraints {
  return {
    audio: includeAudio ? {
      mandatory: {
        chromeMediaSource: 'desktop',
      },
    } : false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: request.session.capture?.id || '',
        minWidth: request.session.video.width,
        maxWidth: request.session.video.width,
        minHeight: request.session.video.height,
        maxHeight: request.session.video.height,
        minFrameRate: request.session.video.framesPerSecond,
        maxFrameRate: request.session.video.framesPerSecond,
      },
    },
  }
}

async function applyAnswer(answer: StreamAnswer, peers: Map<string, RTCPeerConnection>) {
  const peer = peers.get(answer.sessionId)

  if (!peer || !answer.sdp) {
    return
  }

  await peer.setRemoteDescription({
    type: 'answer',
    sdp: answer.sdp,
  })
}

function waitForIceGathering(peer: RTCPeerConnection) {
  if (peer.iceGatheringState === 'complete') {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(done, iceGatheringTimeoutMs)

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

function closeAllPeers(peers: Map<string, RTCPeerConnection>, streams: Map<string, MediaStream>) {
  for (const sessionId of peers.keys()) {
    closePeer(sessionId, peers, streams)
  }
}

function closePeer(
  sessionId: string,
  peers: Map<string, RTCPeerConnection>,
  streams: Map<string, MediaStream>,
) {
  const peer = peers.get(sessionId)
  const stream = streams.get(sessionId)

  stream?.getTracks().forEach((track) => track.stop())
  peer?.close()
  peers.delete(sessionId)
  streams.delete(sessionId)
}

function createFailure(request: StreamOfferBridgeRequest, message: string): StreamOfferBridgeResult {
  return {
    requestId: request.requestId,
    ok: false,
    offer: null,
    session: request.session,
    telemetry: {
      state: 'failed',
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
    },
    message,
  }
}
