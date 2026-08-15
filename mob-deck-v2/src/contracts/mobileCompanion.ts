export type CompanionPairingState = 'unpaired' | 'pairing' | 'paired' | 'blocked'

export type CompanionDevice = {
  id: string
  name: string
  model: string
  pairingState: CompanionPairingState
  supportsHaptics: boolean
  supportsBluetoothController: boolean
}

export type PairingPayload = {
  protocol: 'gravity-v2'
  serverUrl: string
  token: string
  pairingCode: string
  computerName: string
  issuedAt: string
  expiresAt: string
  sessionExpiresAt?: string
}

export type PairingPayloadResult = {
  ok: boolean
  payload: PairingPayload | null
  qrText: string
  message: string
}

export interface MobileCompanionApi {
  getDevice(): Promise<CompanionDevice>
  consumePairingPayload(payload: PairingPayload): Promise<CompanionDevice>
  forgetPairing(): Promise<void>
}
