export type StreamQualityPreset = 'balanced' | 'performance' | 'quality'

export type StreamSessionState =
  | 'idle'
  | 'negotiating'
  | 'connecting'
  | 'streaming'
  | 'reconnecting'
  | 'ended'
  | 'failed'

export type StreamOffer = {
  sessionId: string
  type: 'offer'
  sdp: string
  iceServers: RTCIceServer[]
  capture: StreamCaptureSource | null
  video: StreamVideoPlan
  createdAt: string
}

export type StreamAnswer = {
  sessionId: string
  type?: 'answer'
  sdp: string
}

export type StreamTelemetry = {
  state: StreamSessionState
  roundTripMs: number
  bitrateKbps: number
  framesPerSecond: number
  captureFramesPerSecond: number
  transmitFramesPerSecond: number
  packetLossPercent: number
  framesDropped: number
  resolution: string
  codec: string
  encoder: string
  captureSource: string
  captureType: 'window' | 'screen' | 'none'
  cpuUsagePercent: number | null
  gpuUsagePercent: number | null
  networkKbps: number
}

export type StreamVideoPlan = {
  width: number
  height: number
  framesPerSecond: number
  bitrateKbps: number
  codec: 'h264' | 'vp8' | 'vp9' | 'av1'
}

export type StreamCaptureSource = {
  id: string
  name: string
  type: 'screen' | 'window'
  thumbnailDataUrl: string
}

export type StreamInputPlan = {
  gamepad: 'planned' | 'ready'
  keyboardMouse: 'planned' | 'ready'
  lastInputAt: string
  eventCount: number
}

export type StreamSessionSummary = {
  sessionId: string
  gameId: string
  gameTitle: string
  state: StreamSessionState
  preset: StreamQualityPreset
  joinCode: string
  hostAddress: string
  signalingUrl: string
  createdAt: string
  updatedAt: string
  video: StreamVideoPlan
  capture: StreamCaptureSource | null
  input: StreamInputPlan
}

export type CaptureSourcesResult = {
  ok: boolean
  sources: StreamCaptureSource[]
  selectedSource: StreamCaptureSource | null
  message: string
}

export type PrepareStreamRequest = {
  gameId: string
  preset: StreamQualityPreset
}

export type StreamSessionResult = {
  ok: boolean
  session: StreamSessionSummary | null
  telemetry: StreamTelemetry
  message: string
}

export type StreamOfferRequest = {
  sessionId: string
}

export type StreamOfferResult = {
  ok: boolean
  offer: StreamOffer | null
  session: StreamSessionSummary | null
  telemetry: StreamTelemetry
  message: string
}

export type StreamOfferBridgeRequest = {
  requestId: string
  session: StreamSessionSummary
  iceServers: RTCIceServer[]
}

export type StreamOfferBridgeResult = StreamOfferResult & {
  requestId: string
}

export type RemoteInputResult = {
  ok: boolean
  session?: StreamSessionSummary | null
  delivery?: RemoteInputDelivery
  message: string
}

export type RemoteInputDelivery = {
  ok: boolean
  delivered: boolean
  dryRun: boolean
  transport: 'dry-run' | 'invalid' | 'ignored-release' | 'planned' | 'unsupported' | 'unsupported-os' | 'windows-sendkeys' | 'none'
  target: string
  message: string
}

export type RemoteInputEvent =
  | { type: 'button'; code: string; pressed: boolean; at: number }
  | { type: 'axis'; code: string; value: number; at: number }
  | { type: 'pointer'; x: number; y: number; pressed: boolean; at: number }

export type RemoteInputChannelRequest = {
  kind: 'remote-input'
  id: string
  event: RemoteInputEvent
}

export type RemoteInputChannelAck = {
  kind: 'remote-input-ack'
  id: string
  ok: boolean
  session?: StreamSessionSummary | null
  message: string
}

export type RemoteInputChannelMessage = RemoteInputChannelRequest | RemoteInputChannelAck

export type StreamConnectionStateUpdate = {
  sessionId: string
  state: Extract<StreamSessionState, 'connecting' | 'streaming' | 'reconnecting' | 'failed' | 'ended'>
}

export interface StreamingSessionApi {
  createOffer(preset: StreamQualityPreset): Promise<StreamOffer>
  acceptAnswer(answer: StreamAnswer): Promise<void>
  sendInput(event: RemoteInputEvent): Promise<void>
  getTelemetry(): Promise<StreamTelemetry>
  stop(): Promise<void>
}
