export type ConnectedPlatformId =
  | 'steam'
  | 'epic'
  | 'gog'
  | 'ea'
  | 'ubisoft'
  | 'xbox'
  | 'battlenet'
  | 'itch'
  | 'rockstar'

export type LibraryPlatformFilter = ConnectedPlatformId | 'all' | 'local'

export type ConnectedAccountStatus = 'connected' | 'disconnected' | 'syncing' | 'error' | 'experimental'

export type GamePlatformDefinition = {
  id: ConnectedPlatformId
  label: string
  shortLabel: string
  badgeLabel: string
  accent: string
  state: 'oauth-planned' | 'experimental'
  limitation: string
}

export const connectedGamePlatforms: GamePlatformDefinition[] = [
  {
    id: 'steam',
    label: 'Steam',
    shortLabel: 'ST',
    badgeLabel: 'Steam',
    accent: '#48c4d5',
    state: 'oauth-planned',
    limitation: 'Integracao futura deve usar recursos oficiais da Steam. Nenhuma senha sera solicitada pelo Gravity.',
  },
  {
    id: 'epic',
    label: 'Epic Games',
    shortLabel: 'EP',
    badgeLabel: 'Epic',
    accent: '#f8fbff',
    state: 'experimental',
    limitation: 'API publica limitada para biblioteca completa. Fluxo real precisa de planejamento seguro.',
  },
  {
    id: 'gog',
    label: 'GOG',
    shortLabel: 'GG',
    badgeLabel: 'GOG',
    accent: '#8b5cf6',
    state: 'oauth-planned',
    limitation: 'Integracao futura deve priorizar GOG Galaxy e OAuth oficial quando disponivel.',
  },
  {
    id: 'ea',
    label: 'EA App',
    shortLabel: 'EA',
    badgeLabel: 'EA',
    accent: '#ff6f61',
    state: 'experimental',
    limitation: 'Acesso a biblioteca pode depender do launcher local e de APIs nao publicas.',
  },
  {
    id: 'ubisoft',
    label: 'Ubisoft Connect',
    shortLabel: 'UB',
    badgeLabel: 'Ubisoft',
    accent: '#21b6d7',
    state: 'experimental',
    limitation: 'Integracao completa depende de suporte oficial e validacao de seguranca.',
  },
  {
    id: 'xbox',
    label: 'Xbox / Microsoft Store',
    shortLabel: 'XB',
    badgeLabel: 'Xbox',
    accent: '#5ada88',
    state: 'experimental',
    limitation: 'Jogos da Microsoft Store exigem tratamento especial de permissoes e instalacao.',
  },
  {
    id: 'battlenet',
    label: 'Battle.net',
    shortLabel: 'BN',
    badgeLabel: 'Battle.net',
    accent: '#2bb4ff',
    state: 'experimental',
    limitation: 'A biblioteca completa pode nao estar disponivel por API publica simples.',
  },
  {
    id: 'itch',
    label: 'Itch.io',
    shortLabel: 'IT',
    badgeLabel: 'Itch.io',
    accent: '#fa5c5c',
    state: 'oauth-planned',
    limitation: 'Integracao futura deve usar OAuth/API oficial e respeitar bibliotecas locais.',
  },
  {
    id: 'rockstar',
    label: 'Rockstar Games Launcher',
    shortLabel: 'RS',
    badgeLabel: 'Rockstar',
    accent: '#ffb13b',
    state: 'experimental',
    limitation: 'Deteccao confiavel pode depender do launcher local e metadados instalados.',
  },
]

export const libraryPlatformFilters: { id: LibraryPlatformFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'steam', label: 'Steam' },
  { id: 'epic', label: 'Epic' },
  { id: 'gog', label: 'GOG' },
  { id: 'ea', label: 'EA' },
  { id: 'ubisoft', label: 'Ubisoft' },
  { id: 'xbox', label: 'Xbox' },
  { id: 'battlenet', label: 'Battle.net' },
  { id: 'itch', label: 'Itch.io' },
  { id: 'rockstar', label: 'Rockstar' },
  { id: 'local', label: 'Jogos locais' },
]

export function getPlatformDefinition(platformId: ConnectedPlatformId) {
  return connectedGamePlatforms.find((platform) => platform.id === platformId)
}

export function detectPlatformFromSource(source: string): ConnectedPlatformId | 'local' {
  const normalized = normalizePlatformText(source)

  if (normalized.includes('steam')) return 'steam'
  if (normalized.includes('epic')) return 'epic'
  if (normalized.includes('gog') || normalized.includes('galaxy')) return 'gog'
  if (normalized.includes('ea app') || normalized === 'ea' || normalized.includes('origin')) return 'ea'
  if (normalized.includes('ubisoft')) return 'ubisoft'
  if (normalized.includes('xbox') || normalized.includes('microsoft') || normalized.includes('game pass')) return 'xbox'
  if (normalized.includes('battle net') || normalized.includes('battlenet') || normalized.includes('blizzard')) return 'battlenet'
  if (normalized.includes('itch')) return 'itch'
  if (normalized.includes('rockstar')) return 'rockstar'

  return 'local'
}

export function getPlatformBadgeLabel(source: string) {
  const platformId = detectPlatformFromSource(source)

  if (platformId === 'local') {
    return 'Local'
  }

  return getPlatformDefinition(platformId)?.badgeLabel || 'Local'
}

function normalizePlatformText(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
