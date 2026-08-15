import type { ComponentType } from 'react'
import type { LibraryPlatformFilter } from '../contracts/platformAccounts'

export type GameLaunchMode = 'desktop' | 'mobile-stream'

export type Game = {
  id: string
  title: string
  source: string
  status: string
  cover: string
  accent: string
  platformId?: LibraryPlatformFilter
  lastPlayedLabel?: string
}

export type DeviceStatus = 'online' | 'paired' | 'connected' | 'offline'

export type Device = {
  name: string
  role: string
  status: string
  state: DeviceStatus
  icon: ComponentType<{ size?: number }>
}

export type SessionStat = {
  label: string
  value: string
  tone: 'network' | 'latency' | 'video' | 'audio'
  icon: ComponentType<{ size?: number }>
}

export type QuickAction = {
  id: string
  label: string
  icon: ComponentType<{ size?: number }>
}

export type StreamingStep = {
  id: string
  label: string
  status: 'ready' | 'next' | 'planned'
}
