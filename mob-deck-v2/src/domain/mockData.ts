import {
  Activity,
  Bluetooth,
  Cast,
  Gamepad2,
  Monitor,
  Power,
  Router,
  Smartphone,
  Volume2,
  Wifi,
  Zap,
} from 'lucide-react'
import type { Device, Game, QuickAction, SessionStat, StreamingStep } from './types'

export const featuredGame: Game = {
  id: 'watchdogs2',
  title: 'Watch Dogs 2',
  source: 'Ubisoft Connect',
  status: 'Gravity Stream testavel',
  cover: '/covers/watchdogs2.png',
  accent: '#21b6d7',
  lastPlayedLabel: 'Ultima sessao hoje',
}

export const games: Game[] = [
  {
    id: 'rdr2',
    title: 'Red Dead Redemption 2',
    source: 'Rockstar',
    status: 'Pronto no PC',
    cover: '/covers/Red Dead Redemption 2.png',
    accent: '#d94f30',
    lastPlayedLabel: 'Recente',
  },
  featuredGame,
  {
    id: 'start',
    title: 'START',
    source: 'Local',
    status: 'Atalho local',
    cover: '/covers/START.png',
    accent: '#68d391',
    lastPlayedLabel: 'Novo',
  },
]

export const devices: Device[] = [
  { name: 'PC Amauri', role: 'Host Windows', status: 'Online', state: 'online', icon: Monitor },
  { name: 'Galaxy Android', role: 'Gravity Mobile', status: 'Pareado', state: 'paired', icon: Smartphone },
  { name: 'Controle Bluetooth', role: 'Entrada', status: 'Conectado', state: 'connected', icon: Gamepad2 },
]

export const sessionStats: SessionStat[] = [
  { label: 'Rede', value: '5 GHz', tone: 'network', icon: Wifi },
  { label: 'Latencia', value: '18 ms', tone: 'latency', icon: Activity },
  { label: 'Video', value: '1080p', tone: 'video', icon: Cast },
  { label: 'Audio', value: 'Ativo', tone: 'audio', icon: Volume2 },
]

export const quickActions: QuickAction[] = [
  { id: 'power', label: 'Ligar PC', icon: Power },
  { id: 'wake', label: 'Wake on LAN', icon: Zap },
  { id: 'network', label: 'Rede', icon: Router },
  { id: 'bluetooth', label: 'Bluetooth', icon: Bluetooth },
]

export const streamingSteps: StreamingStep[] = [
  { id: 'pair', label: 'Gravity Sync por QR', status: 'ready' },
  { id: 'launch', label: 'Abrir jogo no PC', status: 'ready' },
  { id: 'stream', label: 'Entrar no Gravity Stream', status: 'next' },
  { id: 'input', label: 'Enviar controle Bluetooth', status: 'planned' },
]
