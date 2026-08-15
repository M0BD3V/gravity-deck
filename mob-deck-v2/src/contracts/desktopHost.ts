import type { Game, GameLaunchMode } from '../domain/types'
import type { PairingPayload, PairingPayloadResult } from './mobileCompanion'
import type {
  PrepareStreamRequest,
  CaptureSourcesResult,
  RemoteInputEvent,
  RemoteInputResult,
  StreamAnswer,
  StreamConnectionStateUpdate,
  StreamOfferRequest,
  StreamOfferResult,
  StreamQualityPreset,
  StreamSessionResult,
  StreamSessionSummary,
  StreamTelemetry,
} from './streaming'

export type DesktopHostStatus = {
  id: string
  name: string
  online: boolean
  localAddress: string
  streamingSignalUrl: string
  activePairing: PairingPayload | null
  mobileSession?: {
    paired: boolean
    pairedAt: string
    lastSeenAt: string
    expiresAt: string
  } | null
  version: string
  capabilities: DesktopHostCapability[]
}

export type DesktopHostCapability =
  | 'library-scan'
  | 'wake-on-lan'
  | 'game-launch'
  | 'screen-capture'
  | 'audio-capture'
  | 'input-injection'

export type LaunchRequest = {
  gameId: Game['id']
  mode: GameLaunchMode
  minimizeLauncher: boolean
  streamPreset?: StreamQualityPreset
}

export type LaunchResult = {
  ok: boolean
  gameId: Game['id']
  mode?: GameLaunchMode
  processId?: number
  target?: string
  streamSession?: StreamSessionSummary | null
  message: string
}

export type GamesResult = {
  ok: boolean
  games: Game[]
  source?: 'empty' | 'seed' | 'cache' | 'cache-or-seed' | 'legacy-scanner'
  refresh?: LibraryRefreshStatus
  message?: string
}

export type LibraryRefreshStatus = {
  state: 'idle' | 'running' | 'completed' | 'failed'
  source: 'empty' | 'seed' | 'cache' | 'cache-or-seed' | 'legacy-scanner'
  startedAt: string
  finishedAt: string
  scannedRoots: number
  totalRoots: number
  currentRoot: string
  gamesFound: number
  message: string
}

export interface DesktopHostApi {
  getStatus(): Promise<DesktopHostStatus>
  listGames(): Promise<GamesResult>
  refreshLibrary(): Promise<GamesResult>
  createPairingPayload(): Promise<PairingPayloadResult>
  listCaptureSources(): Promise<CaptureSourcesResult>
  launchGame(request: LaunchRequest): Promise<LaunchResult>
  prepareStream(request: PrepareStreamRequest): Promise<StreamSessionResult>
  createStreamOffer(request: StreamOfferRequest): Promise<StreamOfferResult>
  getStreamSession(): Promise<StreamSessionResult>
  getStreamTelemetry(): Promise<StreamTelemetry>
  acceptStreamAnswer(answer: StreamAnswer): Promise<StreamSessionResult>
  updateStreamConnectionState(update: StreamConnectionStateUpdate): Promise<StreamSessionResult>
  sendRemoteInput(event: RemoteInputEvent): Promise<RemoteInputResult>
  stopStreamSession(): Promise<StreamSessionResult>
}
