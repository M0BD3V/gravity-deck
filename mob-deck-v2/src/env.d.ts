import type {
  DesktopHostStatus,
  GamesResult,
  LaunchRequest,
  LaunchResult,
} from './contracts/desktopHost'
import type { PairingPayloadResult } from './contracts/mobileCompanion'
import type {
  CaptureSourcesResult,
  PrepareStreamRequest,
  RemoteInputEvent,
  RemoteInputResult,
  StreamAnswer,
  StreamConnectionStateUpdate,
  StreamOfferBridgeRequest,
  StreamOfferBridgeResult,
  StreamOfferRequest,
  StreamOfferResult,
  StreamSessionResult,
  StreamTelemetry,
} from './contracts/streaming'

declare global {
  interface Window {
    mobDeckDesktop?: {
      getHostStatus: () => Promise<DesktopHostStatus>
      listGames: () => Promise<GamesResult>
      refreshLibrary: () => Promise<GamesResult>
      createPairingPayload: () => Promise<PairingPayloadResult>
      listCaptureSources: () => Promise<CaptureSourcesResult>
      launchGame: (request: LaunchRequest) => Promise<LaunchResult>
      prepareStream: (request: PrepareStreamRequest) => Promise<StreamSessionResult>
      createStreamOffer: (request: StreamOfferRequest) => Promise<StreamOfferResult>
      getStreamSession: () => Promise<StreamSessionResult>
      getStreamTelemetry: () => Promise<StreamTelemetry>
      reportStreamTelemetry: (telemetry: StreamTelemetry) => Promise<{ ok: boolean; telemetry: StreamTelemetry; message: string }>
      acceptStreamAnswer: (answer: StreamAnswer) => Promise<StreamSessionResult>
      updateStreamConnectionState: (update: StreamConnectionStateUpdate) => Promise<StreamSessionResult>
      sendRemoteInput: (event: RemoteInputEvent) => Promise<RemoteInputResult>
      stopStreamSession: () => Promise<StreamSessionResult>
      onStreamOfferRequest: (handler: (request: StreamOfferBridgeRequest) => void) => () => void
      sendStreamOfferResult: (result: StreamOfferBridgeResult) => void
      onStreamAnswer: (handler: (answer: StreamAnswer) => void) => () => void
    }
  }
}

export {}
