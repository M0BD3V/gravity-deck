import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  Bell,
  Cast,
  ChevronRight,
  Clipboard,
  Cloud,
  Cpu,
  Gamepad2,
  HardDrive,
  History,
  Info,
  Library,
  Link2,
  Loader2,
  Monitor,
  QrCode,
  RefreshCw,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Signal,
  Smartphone,
  Sparkles,
  Volume2,
  Wrench,
  X,
} from 'lucide-react'
import type { DesktopView } from '../../components/Sidebar'
import { SectionHeading } from '../../components/SectionHeading'
import type { DesktopHostStatus } from '../../contracts/desktopHost'
import {
  connectedGamePlatforms,
  detectPlatformFromSource,
  getPlatformBadgeLabel,
  libraryPlatformFilters,
} from '../../contracts/platformAccounts'
import type { ConnectedAccountStatus, ConnectedPlatformId, LibraryPlatformFilter } from '../../contracts/platformAccounts'
import type { StreamSessionSummary, StreamTelemetry } from '../../contracts/streaming'
import type { Game, GameLaunchMode } from '../../domain/types'
import { useCaptureSources } from '../../hooks/useCaptureSources'
import { useDesktopActions } from '../../hooks/useDesktopActions'
import { useGameLibrary } from '../../hooks/useGameLibrary'
import { usePairingPayload } from '../../hooks/usePairingPayload'

type DashboardProps = {
  activeView: DesktopView
  hostStatus?: DesktopHostStatus | null
  hostError?: string
  interfaceSoundsEnabled: boolean
  librarySearch: string
  onLibrarySearchChange: (value: string) => void
  onSelectView: (view: DesktopView) => void
  onToggleInterfaceSounds: () => void
}

type ComingSoonState = {
  title: string
  description: string
}

type LibraryCategory = LibraryPlatformFilter
type ConnectedAccountState = {
  gamesFound: number
  lastSyncLabel: string
  platformId: ConnectedPlatformId
  status: ConnectedAccountStatus
}
type LibraryState = ReturnType<typeof useGameLibrary>
type DesktopActionsState = ReturnType<typeof useDesktopActions>
type PairingState = ReturnType<typeof usePairingPayload>
type CaptureSourcesState = ReturnType<typeof useCaptureSources>
type StreamStatusState = ReturnType<typeof useStreamStatus>
type ConnectedAccountsState = ReturnType<typeof useConnectedAccounts>

export function Dashboard({
  activeView,
  hostStatus = null,
  hostError = '',
  interfaceSoundsEnabled,
  librarySearch,
  onLibrarySearchChange,
  onSelectView,
  onToggleInterfaceSounds,
}: DashboardProps) {
  const desktopActions = useDesktopActions()
  const library = useGameLibrary()
  const pairing = usePairingPayload()
  const captureSources = useCaptureSources()
  const streamStatus = useStreamStatus()
  const [comingSoon, setComingSoon] = useState<ComingSoonState | null>(null)
  const hostName = hostStatus?.name || 'Gravity Deck'
  const hostAddress = hostStatus?.localAddress || 'Aguardando host'

  function openComingSoon(title: string, description?: string) {
    setComingSoon({
      title,
      description: description || 'Este modulo esta reservado para uma etapa futura do prototipo.',
    })
  }

  const connectedAccounts = useConnectedAccounts(openComingSoon)

  return (
    <main className="workspace">
      {activeView === 'home' && (
        <HomeView
          hostAddress={hostAddress}
          hostOnline={Boolean(hostStatus?.online)}
          library={library}
          onSelectView={onSelectView}
          streamStatus={streamStatus}
        />
      )}

      {activeView === 'library' && (
        <LibraryView
          desktopActions={desktopActions}
          library={library}
          searchQuery={librarySearch}
          onSearchChange={onLibrarySearchChange}
          onSelectView={onSelectView}
        />
      )}

      {activeView === 'mobile' && (
        <MobileView
          hostAddress={hostAddress}
          hostError={hostError}
          hostName={hostName}
          hostOnline={Boolean(hostStatus?.online)}
          pairing={pairing}
        />
      )}

      {activeView === 'streaming' && (
        <StreamView
          captureSources={captureSources}
          library={library}
          onSelectView={onSelectView}
          streamStatus={streamStatus}
        />
      )}

      {activeView === 'center' && (
        <CenterView
          connectedAccounts={connectedAccounts}
          captureSources={captureSources}
          interfaceSoundsEnabled={interfaceSoundsEnabled}
          library={library}
          onOpenComingSoon={openComingSoon}
          onSelectView={onSelectView}
          onToggleInterfaceSounds={onToggleInterfaceSounds}
          streamStatus={streamStatus}
        />
      )}

      {comingSoon && (
        <ComingSoonModal
          description={comingSoon.description}
          title={comingSoon.title}
          onClose={() => setComingSoon(null)}
        />
      )}
    </main>
  )
}

function HomeView({
  hostAddress,
  hostOnline,
  library,
  onSelectView,
  streamStatus,
}: {
  hostAddress: string
  hostOnline: boolean
  library: LibraryState
  onSelectView: (view: DesktopView) => void
  streamStatus: StreamStatusState
}) {
  const streamLabel = streamStatus.session ? formatStateLabel(streamStatus.session.state) : 'Em espera'

  return (
    <div className="v0-page home-page">
      <section className="hero-band home-hero grid-tech" aria-label="Resumo principal">
        <div className="session-copy">
          <StatusPill tone={hostOnline ? 'success' : 'idle'} label={hostOnline ? 'Ecossistema operacional' : 'Aguardando host'} pulse={hostOnline} />
          <h2>
            Bem-vindo ao <span className="text-gradient">Gravity Deck</span>
          </h2>
          <p>
            Sua central de jogos, streaming e conexao com o celular. Sincronize a biblioteca, prepare transmissoes WebRTC de baixa latencia e controle tudo em um so lugar.
          </p>
          <div className="command-row">
            <button className="primary-action" type="button" onClick={() => onSelectView('library')}>
              <Library size={18} />
              Abrir biblioteca
            </button>
            <button className="stream-action" type="button" onClick={() => onSelectView('streaming')}>
              <Cast size={18} />
              Preparar stream
            </button>
          </div>
        </div>

        <div className="gravity-orb" aria-hidden="true">
          <span />
          <div>
            <Cpu size={38} />
          </div>
        </div>
      </section>

      <section className="status-stat-grid" aria-label="Metricas de estado">
        <HomeStatCard
          hint={library.games.length ? 'Sincronizados' : 'Rode o scanner no Center'}
          icon={<Gamepad2 size={18} />}
          label="Jogos detectados"
          tone={library.games.length ? 'success' : 'idle'}
          value={`${library.games.length}`}
        />
        <HomeStatCard
          hint={hostAddress}
          icon={<Smartphone size={18} />}
          label="Conexao mobile"
          tone={hostOnline ? 'info' : 'idle'}
          value={hostStatusLabel(hostOnline)}
        />
        <HomeStatCard
          hint={streamStatus.session ? 'Sessao em andamento' : 'Pronto para iniciar'}
          icon={<Signal size={18} />}
          label="Gravity Stream"
          tone={streamStatus.session ? 'success' : 'idle'}
          value={streamLabel}
        />
        <HomeStatCard
          hint={hostAddress}
          icon={<ShieldCheck size={18} />}
          label="Servidor local"
          tone={hostOnline ? 'success' : 'error'}
          value={hostOnline ? 'Online' : 'Offline'}
        />
      </section>

      <section>
        <SectionHeader title="Acesso rapido" subtitle="Va direto ao que importa" />
        <div className="home-shortcuts">
          <HomeShortcut icon={<Library size={22} />} label="Biblioteca" value="Jogos sincronizados" onClick={() => onSelectView('library')} />
          <HomeShortcut icon={<Cast size={22} />} label="Gravity Stream" value="Preparar sessao" onClick={() => onSelectView('streaming')} />
          <HomeShortcut icon={<Smartphone size={22} />} label="Gravity Mobile" value="Parear celular" onClick={() => onSelectView('mobile')} />
          <HomeShortcut icon={<Settings size={22} />} label="Gravity Center" value="Scanner e diagnostico" onClick={() => onSelectView('center')} />
        </div>
      </section>

      <section className="library-methods" aria-label="Metodos da biblioteca">
        <SectionHeader title="Como o Gravity monta sua biblioteca" subtitle="Dois metodos independentes e complementares" />
        <div className="library-method-grid">
        <article className="library-method-card">
          <StatusPill tone="success" label="Offline - sempre disponivel" />
          <strong>1 - Scanner local do PC</strong>
          <span>Encontra jogos instalados nesta maquina. Funciona sem login e sem internet. Fica no Gravity Center.</span>
          <button className="text-action" type="button" onClick={() => onSelectView('center')}>
            Ir para o scanner
            <ChevronRight size={16} />
          </button>
        </article>
        <article className="library-method-card">
          <StatusPill tone="info" label="Online - opcional" />
          <strong>2 - Sincronizacao por contas</strong>
          <span>Prepara Steam, Epic, GOG e outras plataformas para uma biblioteca unificada. Login real fica para OAuth oficial futuro.</span>
          <button className="text-action" type="button" onClick={() => onSelectView('center')}>
            Gerenciar contas
            <ChevronRight size={16} />
          </button>
        </article>
        </div>
      </section>
    </div>
  )
}

function LibraryView({
  desktopActions,
  library,
  searchQuery,
  onSearchChange,
  onSelectView,
}: {
  desktopActions: DesktopActionsState
  library: LibraryState
  searchQuery: string
  onSearchChange: (value: string) => void
  onSelectView: (view: DesktopView) => void
}) {
  const [category, setCategory] = useState<LibraryCategory>('all')
  const filteredGames = useMemo(
    () => filterGamesBySearch(filterGamesByCategory(library.games, category), searchQuery),
    [category, library.games, searchQuery],
  )

  return (
    <div className="v0-page library-page">
      <SectionHeader
        icon={<Library size={20} />}
        title="Biblioteca"
        subtitle="O unico lugar completo onde seus jogos aparecem"
        action={(
          <div className="library-header-actions">
            <label className="library-search" aria-label="Buscar jogo">
              <Search size={16} />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Buscar jogo..."
              />
            </label>
          </div>
        )}
      />

      <section className="library-surface library-screen">
        <div className="category-tabs" aria-label="Filtros por plataforma">
          {libraryPlatformFilters.map((item) => (
            <button
              key={item.id}
              type="button"
              data-active={category === item.id}
              onClick={() => setCategory(item.id)}
            >
              <span>{item.label}</span>
              <strong>{countGamesByCategory(library.games, item.id)}</strong>
            </button>
          ))}
        </div>

        {library.games.length ? (
          filteredGames.length ? (
            <div className="game-grid game-grid-wide">
              {filteredGames.map((game) => (
                <GameCard
                  key={game.id}
                  busyGameId={desktopActions.busyGameId}
                  game={game}
                  onLaunch={desktopActions.launchGame}
                  onSelectView={onSelectView}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Info size={36} />}
              title="Categoria vazia"
              description={searchQuery.trim() ? 'Nenhum jogo real corresponde aos filtros e busca atuais.' : 'Nenhum jogo real foi classificado aqui ainda.'}
            />
          )
        ) : (
          <EmptyState
            icon={<Library size={38} />}
            title="Biblioteca vazia"
            description="Use o scanner no Gravity Center para localizar jogos reais neste PC."
            action={(
              <button className="primary-action" type="button" onClick={() => onSelectView('center')}>
                <ScanLine size={18} />
                Abrir Gravity Center
              </button>
            )}
          />
        )}

        <ActionFeedback error={library.error} message={library.message} variant="library" />
        <ActionFeedback error={desktopActions.error} message={desktopActions.message} />
      </section>
    </div>
  )
}

function MobileView({
  hostAddress,
  hostError,
  hostName,
  hostOnline,
  pairing,
}: {
  hostAddress: string
  hostError: string
  hostName: string
  hostOnline: boolean
  pairing: PairingState
}) {
  return (
    <div className="v0-page mobile-page">
      <WorkspaceHeader
        eyebrow="Pareamento por QR Code e status do Gravity Sync"
        title="Gravity Mobile"
        icon={<Smartphone size={18} />}
        actions={<StatusPill tone={pairing.payload ? 'info' : 'idle'} label={pairing.payload ? 'QR pronto' : 'Nao pareado'} pulse={Boolean(pairing.payload)} />}
      />

      <section className="pairing-layout">
        <div className="library-surface mobile-connect-panel pairing-primary-card">
          {pairing.payload ? (
            <PairingCard pairing={pairing} />
          ) : (
            <EmptyState
              icon={<Smartphone size={40} />}
              title="Nenhum dispositivo conectado"
              description="Abra o Gravity Mobile e escaneie o QR para parear com este PC."
              action={(
                <button className="primary-action" type="button" disabled={pairing.loading} onClick={pairing.createPairing}>
                  {pairing.loading ? <Loader2 className="is-spinning" size={18} /> : <QrCode size={18} />}
                  Criar pareamento
                </button>
              )}
            />
          )}
          <ActionFeedback error={pairing.error} message={pairing.message} variant="pairing" />
        </div>

        <aside className="side-panel sync-side-card">
          <SectionHeader
            icon={<Signal size={18} />}
            subtitle="Comunicacao local PC e celular"
            title="Gravity Sync"
          />
          <div className="device-list">
            <StatusRow
              detail={hostError || hostAddress}
              icon={<Monitor size={20} />}
              label={hostName}
              status={hostOnline ? 'Online' : 'Offline'}
              tone={hostOnline ? 'ok' : 'muted'}
            />
            <StatusRow
              detail={pairing.payload ? 'QR emitido para pareamento' : 'Aguardando leitura do QR'}
              icon={<Smartphone size={20} />}
              label="Gravity Mobile"
              status={pairing.payload ? 'Pronto' : 'Vazio'}
              tone={pairing.payload ? 'ok' : 'muted'}
            />
          </div>
          <p className="sync-note">
            O pareamento e baseado em QR Code e o transporte usa servidor HTTP local para signaling.
          </p>
        </aside>
      </section>
    </div>
  )
}

function StreamView({
  captureSources,
  library,
  onSelectView,
  streamStatus,
}: {
  captureSources: CaptureSourcesState
  library: LibraryState
  onSelectView: (view: DesktopView) => void
  streamStatus: StreamStatusState
}) {
  const telemetry = streamStatus.telemetry

  return (
    <div className="v0-page stream-page">
      <WorkspaceHeader
        eyebrow="Sessao WebRTC de baixa latencia para o jogo selecionado"
        title="Gravity Stream"
        icon={<Cast size={18} />}
        actions={<StatusPill tone={streamStatus.session ? 'success' : 'idle'} label={streamStatus.session ? formatStateLabel(streamStatus.session.state) : 'Em espera'} pulse={streamStatus.session?.state === 'streaming'} />}
      />

      <section className="stream-layout">
        <div className="stream-stage-card">
          <div className="stream-stage-surface grid-tech">
            <div className="stage-content">
              <span className="stage-icon">
                <Cast size={36} />
              </span>
              <strong>{streamStatus.session ? streamStatus.session.gameTitle : 'Nenhuma sessao ativa'}</strong>
              <p>{streamStatus.session?.capture?.name || 'Captura focada - aguardando janela do jogo'}</p>
              {streamStatus.session?.state === 'streaming' && <StatusPill tone="success" label="AO VIVO" pulse />}
            </div>
            {streamStatus.session && (
              <div className="stage-latency">
                <Signal size={14} />
                <span>{telemetry.roundTripMs} ms</span>
              </div>
            )}
          </div>

          <div className="stream-stage-footer">
            <div>
              <span>Jogo selecionado</span>
              <strong>{streamStatus.session?.gameTitle || 'Nenhum jogo selecionado'}</strong>
            </div>
            <div className="command-row">
              <button className="primary-action" type="button" onClick={() => onSelectView('library')}>
                <Library size={18} />
                Abrir Biblioteca
              </button>
              <button className="stream-action" type="button" disabled={streamStatus.loading} onClick={streamStatus.refresh}>
                {streamStatus.loading ? <Loader2 className="is-spinning" size={18} /> : <RefreshCw size={18} />}
                Atualizar
              </button>
              <button className="stream-action" type="button" disabled={captureSources.loading} onClick={captureSources.refresh}>
                {captureSources.loading ? <Loader2 className="is-spinning" size={18} /> : <Monitor size={18} />}
                Janelas
              </button>
            </div>
          </div>
          <ActionFeedback error={streamStatus.error} message={streamStatus.message} />
        </div>

        <aside className="stream-state-stack">
          <div className="pipeline">
            <h3>Estado da sessao</h3>
            <StatusMiniCard icon={<Monitor size={16} />} label="Captura focada" value={telemetry.captureType === 'window' ? 'Janela' : 'Em espera'} tone={telemetry.captureType === 'window' ? 'success' : 'idle'} />
            <StatusMiniCard icon={<Signal size={16} />} label="WebRTC" value={streamStatus.session ? formatStateLabel(streamStatus.session.state) : 'Offer nao criada'} tone={streamStatus.session ? 'success' : 'idle'} />
            <StatusMiniCard icon={<Gamepad2 size={16} />} label="Input remoto" value={streamStatus.session ? 'Canal WebRTC ativo' : 'Fallback HTTP'} tone={streamStatus.session ? 'success' : 'idle'} />
          </div>
          <div className="pipeline">
          <SectionHeader title="Janelas detectadas" subtitle="Captura focada" icon={<Cast size={18} />} />
          {captureSources.sources.length ? (
            <div className="roadmap-list">
              {captureSources.sources.map((source) => (
                <div className="roadmap-row" data-status="ready" key={source.id}>
                  <Monitor size={18} />
                  <span>APP</span>
                  <strong>{source.name}</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              icon={<Cast size={30} />}
              title="Nenhuma janela de jogo"
              description={captureSources.loading ? 'Lendo janelas do PC...' : 'Inicie um jogo pela Biblioteca antes de transmitir.'}
            />
          )}
          </div>
        </aside>
      </section>

      <section className="stream-diagnostics-section">
        <SectionHeader title="Diagnostico do stream" subtitle="Telemetria WebRTC em tempo real" icon={<Signal size={18} />} />
        <div className="stream-telemetry diagnostic-grid">
          <MetricTile icon={<Signal size={18} />} label="Latencia" value={`${telemetry.roundTripMs} ms`} />
          <MetricTile icon={<Signal size={18} />} label="Bitrate" value={`${telemetry.bitrateKbps} kbps`} />
          <MetricTile icon={<Monitor size={18} />} label="FPS captura" value={`${telemetry.captureFramesPerSecond}`} />
          <MetricTile icon={<Cast size={18} />} label="FPS stream" value={`${telemetry.transmitFramesPerSecond || telemetry.framesPerSecond}`} />
          <MetricTile icon={<Monitor size={18} />} label="Resolucao" value={telemetry.resolution} />
          <MetricTile icon={<HardDrive size={18} />} label="Codec" value={telemetry.codec} />
          <MetricTile icon={<RefreshCw size={18} />} label="Frames perdidos" value={`${telemetry.framesDropped}`} />
          <MetricTile icon={<Gamepad2 size={18} />} label="Input" value={streamStatus.session ? `${streamStatus.session.input.eventCount}` : '0'} />
          <MetricTile icon={<Signal size={18} />} label="Rede" value={`${telemetry.networkKbps} kbps`} />
          <MetricTile icon={<HardDrive size={18} />} label="CPU" value={formatNullablePercent(telemetry.cpuUsagePercent)} />
          <MetricTile icon={<HardDrive size={18} />} label="GPU" value={formatNullablePercent(telemetry.gpuUsagePercent)} />
          <MetricTile icon={<Cast size={18} />} label="Captura" value={telemetry.captureType === 'window' ? 'Janela' : 'Nenhuma'} />
        </div>
        <p className="library-feedback">
          {library.games.length} jogo(s) na biblioteca. O stream so inicia quando a janela do jogo selecionado for encontrada.
        </p>
      </section>
    </div>
  )
}

function CenterView({
  connectedAccounts,
  captureSources,
  interfaceSoundsEnabled,
  library,
  onOpenComingSoon,
  onSelectView,
  onToggleInterfaceSounds,
  streamStatus,
}: {
  connectedAccounts: ConnectedAccountsState
  captureSources: CaptureSourcesState
  interfaceSoundsEnabled: boolean
  library: LibraryState
  onOpenComingSoon: (title: string, description?: string) => void
  onSelectView: (view: DesktopView) => void
  onToggleInterfaceSounds: () => void
  streamStatus: StreamStatusState
}) {
  const [centerTab, setCenterTab] = useState<'scanner' | 'accounts' | 'sounds'>('scanner')

  return (
    <>
      <WorkspaceHeader
        eyebrow="Controle, diagnostico e conexoes - o scanner mora aqui"
        title="Gravity Center"
        icon={<Settings size={18} />}
      />

      <div className="center-tablist" aria-label="Areas do Gravity Center">
        <button type="button" data-active={centerTab === 'scanner'} onClick={() => setCenterTab('scanner')}>
          <ScanLine size={16} />
          Scanner & Diagnostico
        </button>
        <button type="button" data-active={centerTab === 'accounts'} onClick={() => setCenterTab('accounts')}>
          <Link2 size={16} />
          Contas conectadas
        </button>
        <button type="button" data-active={centerTab === 'sounds'} onClick={() => setCenterTab('sounds')}>
          <Volume2 size={16} />
          Sons de interface
        </button>
      </div>

      {centerTab === 'scanner' && (
        <>
          <section className="center-hero grid-tech">
            <div>
              <StatusPill tone="success" label="Scanner local offline" />
              <h2>Biblioteca real, sem login obrigatorio.</h2>
              <p>
                O scanner fica centralizado aqui no Gravity Center. Ele localiza jogos instalados neste PC e alimenta a Biblioteca sem depender de contas online.
              </p>
              <div className="command-row">
                <button className="primary-action" type="button" disabled={library.loading} onClick={library.refresh}>
                  {library.loading ? <Loader2 className="is-spinning" size={18} /> : <ScanLine size={18} />}
                  Reescanear PC
                </button>
                <button className="stream-action" type="button" onClick={() => onSelectView('library')}>
                  <Library size={18} />
                  Ver Biblioteca
                </button>
              </div>
            </div>

            <div className="scanner-orbit" aria-hidden="true">
              <ScanLine size={46} />
              <span />
            </div>
          </section>

          <section className="center-grid">
            <ManagementCard
              actionLabel="Reescanear"
              busy={library.loading}
              description={`${library.games.length} jogo(s) reais na biblioteca atual.`}
              icon={<ScanLine size={22} />}
              onAction={library.refresh}
              title="Scanner local"
            />
            <ManagementCard
              actionLabel="Abrir"
              description={streamStatus.session ? `${streamStatus.session.gameTitle}: ${formatStateLabel(streamStatus.session.state)}` : 'Sem sessao ativa.'}
              icon={<Cast size={22} />}
              onAction={() => onSelectView('streaming')}
              title="Diagnostico Stream"
            />
            <ManagementCard
              actionLabel="Atualizar"
              description={captureSources.selectedSource?.name || captureSources.message || 'Aguardando janela de jogo.'}
              icon={<Monitor size={22} />}
              busy={captureSources.loading}
              onAction={captureSources.refresh}
              title="Captura focada"
            />
            <ManagementCard
              actionLabel="Ver detalhes"
              description="Backup futuro reservado para o ecossistema Gravity."
              icon={<Cloud size={22} />}
              onAction={() => onOpenComingSoon('Gravity Cloud')}
              title="Gravity Cloud"
            />
            <ManagementCard
              actionLabel="Abrir"
              description="Historico tecnico ficara centralizado aqui."
              icon={<History size={22} />}
              onAction={() => onOpenComingSoon('Logs e atualizacoes')}
              title="Logs e atualizacoes"
            />
            <ManagementCard
              actionLabel="Abrir"
              description="Preferencias avancadas do launcher."
              icon={<Settings size={22} />}
              onAction={() => setCenterTab('sounds')}
              title="Configuracoes"
            />
            <ManagementCard
              actionLabel="Executar"
              description="Ferramentas de reparo e diagnostico."
              icon={<Wrench size={22} />}
              onAction={async () => {
                await Promise.all([
                  library.refresh(),
                  captureSources.refresh(),
                  streamStatus.refresh(),
                ])
              }}
              title="Manutencao"
            />
            <ManagementCard
              actionLabel={interfaceSoundsEnabled ? 'Desativar' : 'Ativar'}
              description={interfaceSoundsEnabled ? 'Sons espaciais discretos ativados.' : 'Interface silenciosa.'}
              icon={<Bell size={22} />}
              onAction={onToggleInterfaceSounds}
              title="Sons da interface"
            />
          </section>

          <ActionFeedback error={library.error} message={library.message} variant="library" />
        </>
      )}

      {centerTab === 'accounts' && (
        <section className="accounts-workbench" aria-label="Contas conectadas">
          <div className="accounts-onboarding">
            <div>
              <StatusPill tone="info" label="Experimental - OAuth futuro" />
              <h2>Conecte suas contas para montar sua biblioteca Gravity.</h2>
              <span>
                O Gravity continua funcionando offline. O scanner local do PC permanece como metodo principal, e contas online entram como sincronizacao opcional via OAuth oficial quando disponivel.
              </span>
            </div>
            <div className="sync-method-grid">
              <button className="sync-method-card" type="button" disabled={library.loading} onClick={library.refresh}>
                {library.loading ? <Loader2 className="is-spinning" size={18} /> : <ScanLine size={18} />}
                <strong>Scanner local do PC</strong>
                <span>Funciona offline e encontra jogos instalados neste computador.</span>
              </button>
              <button
                className="sync-method-card"
                type="button"
                onClick={() => onOpenComingSoon('Sincronizacao por contas', 'Login real sera planejado com OAuth oficial quando disponivel. O Gravity nunca deve pedir senha diretamente.')}
              >
                <ShieldCheck size={18} />
                <strong>Contas conectadas</strong>
                <span>Estrutura futura para Steam, Epic, GOG, EA, Ubisoft, Xbox e outras plataformas.</span>
              </button>
            </div>
          </div>

          <div className="connected-accounts-panel">
            <SectionHeading eyebrow="Contas conectadas" title="Plataformas" compact action={<ShieldCheck size={20} />} />
            <div className="account-grid">
              {connectedAccounts.accounts.map((account) => (
                <ConnectedAccountCard
                  account={account}
                  key={account.platformId}
                  onConnect={connectedAccounts.connect}
                  onDisconnect={connectedAccounts.disconnect}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {centerTab === 'sounds' && (
        <section className="sounds-workbench">
          <div className="sounds-panel">
            <div>
              <StatusPill tone={interfaceSoundsEnabled ? 'success' : 'idle'} label={interfaceSoundsEnabled ? 'Sons ativados' : 'Interface silenciosa'} />
              <h2>Sons espaciais discretos</h2>
              <p>
                Os sons da interface ficam limitados a elementos interativos reais: botoes, cards, menus, confirmacoes e erros.
              </p>
            </div>
            <button className="primary-action" type="button" onClick={onToggleInterfaceSounds}>
              <Volume2 size={18} />
              {interfaceSoundsEnabled ? 'Desativar sons' : 'Ativar sons'}
            </button>
          </div>

          <div className="sound-token-grid">
            <SoundToken icon={<Sparkles size={18} />} label="Hover principal" description="Grave suave, curto e com brilho cristalino." />
            <SoundToken icon={<Gamepad2 size={18} />} label="Hover card" description="Pulso leve para cards de jogos e plataformas." />
            <SoundToken icon={<ChevronRight size={18} />} label="Clique" description="Ataque rapido, sem agudo irritante." />
            <SoundToken icon={<Link2 size={18} />} label="Abrir menu" description="Subida espacial discreta." />
            <SoundToken icon={<X size={18} />} label="Fechar menu" description="Descida curta e macia." />
            <SoundToken icon={<ShieldCheck size={18} />} label="Sucesso" description="Confirmacao limpa com final quente." />
            <SoundToken icon={<Info size={18} />} label="Erro" description="Aviso grave, curto e controlado." />
          </div>
        </section>
      )}
    </>
  )
}

function WorkspaceHeader({
  actions,
  eyebrow,
  icon,
  title,
}: {
  actions?: ReactNode
  eyebrow: string
  icon?: ReactNode
  title: string
}) {
  return (
    <header className="topbar">
      <div className="workspace-title">
        {icon && <span>{icon}</span>}
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
      </div>
      {actions && <div className="top-actions">{actions}</div>}
    </header>
  )
}

function HomeShortcut({
  icon,
  label,
  onClick,
  value,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  value: string
}) {
  return (
    <button className="home-shortcut" type="button" onClick={onClick}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
      <ChevronRight size={17} />
    </button>
  )
}

function GameCard({
  busyGameId,
  game,
  onLaunch,
  onSelectView,
}: {
  busyGameId: string
  game: Game
  onLaunch: (game: Game, mode: GameLaunchMode) => Promise<void>
  onSelectView: (view: DesktopView) => void
}) {
  const platformBadge = getPlatformBadgeLabel(game.source)

  return (
    <article className="game-card" key={game.id} style={{ '--accent': game.accent } as CSSProperties}>
      <div className="game-cover-wrap">
        <GameCover game={game} />
        <span className="source-badge game-cover-badge">{platformBadge}</span>
        <div className="game-hover-actions">
          <button
            className="primary-action game-hover-button"
            type="button"
            disabled={busyGameId === game.id}
            onClick={() => onLaunch(game, 'desktop')}
          >
            <Monitor size={15} />
            Abrir no PC
          </button>
          <button
            className="stream-action game-hover-button"
            type="button"
            disabled={busyGameId === game.id}
            onClick={() => {
              onSelectView('streaming')
              void onLaunch(game, 'mobile-stream')
            }}
          >
            <Smartphone size={15} />
            Preparar stream
          </button>
        </div>
      </div>
      <div className="game-details">
        <strong>{game.title}</strong>
        <small>{game.status || game.source}</small>
      </div>
    </article>
  )
}

function ConnectedAccountCard({
  account,
  onConnect,
  onDisconnect,
}: {
  account: ConnectedAccountState
  onConnect: (platformId: ConnectedPlatformId) => void
  onDisconnect: (platformId: ConnectedPlatformId) => void
}) {
  const platform = connectedGamePlatforms.find((item) => item.id === account.platformId)

  if (!platform) {
    return null
  }

  const status = formatAccountStatus(account.status)

  return (
    <article className="connected-account-card" data-status={account.status} style={{ '--accent': platform.accent } as CSSProperties}>
      <div className="account-card-topline">
        <span className="platform-mark">{platform.shortLabel}</span>
        <div>
          <strong>{platform.label}</strong>
          <small>{status}</small>
        </div>
      </div>
      <p>{platform.limitation}</p>
      <div className="account-stats">
        <span>
          Ultima sincronizacao
          <strong>{account.lastSyncLabel}</strong>
        </span>
        <span>
          Jogos encontrados
          <strong>{account.gamesFound}</strong>
        </span>
      </div>
      <div className="account-actions">
        <button type="button" disabled={account.status === 'connected' || account.status === 'syncing'} onClick={() => onConnect(account.platformId)}>
          {account.status === 'syncing' ? <Loader2 className="is-spinning" size={15} /> : <ShieldCheck size={15} />}
          Conectar
        </button>
        <button type="button" disabled={account.status === 'syncing'} onClick={() => onDisconnect(account.platformId)}>
          <X size={15} />
          Desconectar
        </button>
      </div>
    </article>
  )
}

function GameCover({ game }: { game: Game }) {
  const [failed, setFailed] = useState(false)

  if (game.cover && !failed) {
    return <img src={game.cover} alt={game.title} onError={() => setFailed(true)} />
  }

  return (
    <div className="cover-placeholder generated-cover" aria-label={`Capa gerada para ${game.title}`}>
      <span className="generated-cover-kicker">Gravity</span>
      <strong>{game.title}</strong>
      <small>{game.source}</small>
    </div>
  )
}

function PairingCard({ pairing }: { pairing: PairingState }) {
  if (!pairing.payload) {
    return null
  }

  return (
    <div className="pairing-block pairing-block-large" aria-label="Pareamento mobile">
      <div className="pairing-header">
        <QrCode size={19} />
        <div>
          <span>Gravity Sync</span>
          <strong>{pairing.payload.computerName}</strong>
        </div>
        <button type="button" aria-label="Copiar pareamento" onClick={pairing.copyPairingText}>
          <Clipboard size={16} />
        </button>
      </div>

      {pairing.qrDataUrl && <img className="pairing-qr" src={pairing.qrDataUrl} alt="QR de pareamento" />}

      <div className="pairing-code">
        <span>Codigo</span>
        <strong>{pairing.payload.pairingCode}</strong>
      </div>

      <div className="pairing-meta">
        <span>{pairing.payload.serverUrl}</span>
        <span>{formatPairingExpiry(pairing.payload.expiresAt)}</span>
      </div>
    </div>
  )
}

function EmptyState({
  action,
  compact = false,
  description,
  icon,
  title,
}: {
  action?: ReactNode
  compact?: boolean
  description: string
  icon: ReactNode
  title: string
}) {
  return (
    <div className={`empty-state${compact ? ' is-compact' : ''}`}>
      {icon}
      <strong>{title}</strong>
      <span>{description}</span>
      {action}
    </div>
  )
}

function StatusRow({
  detail,
  icon,
  label,
  status,
  tone,
}: {
  detail: string
  icon: ReactNode
  label: string
  status: string
  tone: 'ok' | 'muted'
}) {
  return (
    <article className="device-row" data-state={tone}>
      {icon}
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <small>{status}</small>
    </article>
  )
}

function StatusMiniCard({
  icon,
  label,
  tone,
  value,
}: {
  icon: ReactNode
  label: string
  tone: 'success' | 'idle' | 'info' | 'error'
  value: string
}) {
  return (
    <div className="status-mini-card" data-tone={tone}>
      <span>
        {icon}
        {label}
      </span>
      <StatusPill tone={tone === 'success' ? 'success' : tone === 'info' ? 'info' : tone === 'error' ? 'idle' : 'idle'} label={value} />
    </div>
  )
}

function MetricTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <article>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function HomeStatCard({
  hint,
  icon,
  label,
  tone,
  value,
}: {
  hint: string
  icon: ReactNode
  label: string
  tone: 'success' | 'info' | 'idle' | 'error'
  value: string
}) {
  return (
    <article className="home-stat-card" data-tone={tone}>
      <div>
        <span>{icon}</span>
        <i />
      </div>
      <strong>{value}</strong>
      <small>{label}</small>
      <em>{hint}</em>
    </article>
  )
}

function StatusPill({
  label,
  pulse = false,
  tone,
}: {
  label: string
  pulse?: boolean
  tone: 'success' | 'info' | 'idle'
}) {
  return (
    <span className={`status-pill status-pill-${tone}${pulse ? ' is-pulsing' : ''}`}>
      <i />
      {label}
    </span>
  )
}

function SectionHeader({
  action,
  icon,
  subtitle,
  title,
}: {
  action?: ReactNode
  icon?: ReactNode
  subtitle?: string
  title: string
}) {
  return (
    <div className="section-header-v0">
      <div className="section-title-v0">
        {icon && <span>{icon}</span>}
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {action && <div className="section-actions-v0">{action}</div>}
    </div>
  )
}

function SoundToken({
  description,
  icon,
  label,
}: {
  description: string
  icon: ReactNode
  label: string
}) {
  return (
    <article className="sound-token">
      {icon}
      <strong>{label}</strong>
      <span>{description}</span>
    </article>
  )
}

function ManagementCard({
  actionLabel,
  busy = false,
  description,
  icon,
  onAction,
  title,
}: {
  actionLabel: string
  busy?: boolean
  description: string
  icon: ReactNode
  onAction: () => void | Promise<void>
  title: string
}) {
  return (
    <article className="management-card">
      <div>
        {icon}
        <strong>{title}</strong>
      </div>
      <p>{description}</p>
      <button type="button" disabled={busy} onClick={onAction}>
        {busy ? <Loader2 className="is-spinning" size={16} /> : <ChevronRight size={16} />}
        {actionLabel}
      </button>
    </article>
  )
}

function ComingSoonModal({
  description,
  onClose,
  title,
}: {
  description: string
  onClose: () => void
  title: string
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="coming-soon-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </button>
        <Sparkles size={30} />
        <p className="eyebrow">Em desenvolvimento</p>
        <h2 id="coming-soon-title">{title}</h2>
        <span>{description}</span>
        <button className="primary-action" type="button" onClick={onClose}>
          Entendi
        </button>
      </section>
    </div>
  )
}

function ActionFeedback({
  error,
  message,
  variant = 'action',
}: {
  error: string
  message: string
  variant?: 'action' | 'library' | 'pairing'
}) {
  if (!error && !message) {
    return null
  }

  return (
    <p className={`${variant}-feedback${error ? ' is-error' : ''}`}>
      {error || message}
    </p>
  )
}

function useStreamStatus() {
  const [session, setSession] = useState<StreamSessionSummary | null>(null)
  const [telemetry, setTelemetry] = useState<StreamTelemetry>(createIdleTelemetry())
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function refresh() {
    if (!window.mobDeckDesktop?.getStreamSession) {
      setMessage('Diagnostico disponivel no app desktop.')
      setError('')
      return
    }

    setLoading(true)

    try {
      const result = await window.mobDeckDesktop.getStreamSession()

      setSession(result.session)
      setTelemetry(result.telemetry || createIdleTelemetry())
      setMessage(result.message || '')
      setError(result.ok ? '' : result.message || 'Diagnostico indisponivel.')
    } catch (streamError) {
      setError(streamError instanceof Error ? streamError.message : 'Nao foi possivel ler o diagnostico.')
      setMessage('')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh().catch(() => {})
    const intervalId = window.setInterval(() => {
      refresh().catch(() => {})
    }, 2500)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  return {
    error,
    loading,
    message,
    refresh,
    session,
    telemetry,
  }
}

function useConnectedAccounts(onNotice: (title: string, description?: string) => void) {
  const [accounts, setAccounts] = useState<ConnectedAccountState[]>(() => createInitialConnectedAccounts())
  const timersRef = useRef<Partial<Record<ConnectedPlatformId, number>>>({})

  useEffect(() => {
    const timers = timersRef.current

    return () => {
      Object.values(timers).forEach((timerId) => {
        if (timerId) {
          window.clearTimeout(timerId)
        }
      })
    }
  }, [])

  function clearPending(platformId: ConnectedPlatformId) {
    const timerId = timersRef.current[platformId]

    if (timerId) {
      window.clearTimeout(timerId)
      delete timersRef.current[platformId]
    }
  }

  function connect(platformId: ConnectedPlatformId) {
    const platform = connectedGamePlatforms.find((item) => item.id === platformId)

    if (!platform) {
      return
    }

    clearPending(platformId)

    setAccounts((current) => current.map((account) => (
      account.platformId === platformId
        ? { ...account, status: 'syncing', lastSyncLabel: 'Preparando OAuth seguro' }
        : account
    )))

    timersRef.current[platformId] = window.setTimeout(() => {
      setAccounts((current) => current.map((account) => (
        account.platformId === platformId
          ? { ...account, status: 'experimental', lastSyncLabel: 'OAuth futuro', gamesFound: 0 }
          : account
      )))
      onNotice(`${platform.label} experimental`, `${platform.limitation} Login real so deve entrar com OAuth oficial ou integracao segura, nunca com senha digitada no Gravity.`)
      delete timersRef.current[platformId]
    }, 700)
  }

  function disconnect(platformId: ConnectedPlatformId) {
    const platform = connectedGamePlatforms.find((item) => item.id === platformId)

    clearPending(platformId)
    setAccounts((current) => current.map((account) => (
      account.platformId === platformId
        ? { ...account, status: 'disconnected', lastSyncLabel: 'Nunca', gamesFound: 0 }
        : account
    )))

    if (platform) {
      onNotice(`${platform.label} desconectado`, 'Estado local limpo. O scanner local do PC continua funcionando offline.')
    }
  }

  return {
    accounts,
    connect,
    disconnect,
  }
}

function createIdleTelemetry(): StreamTelemetry {
  return {
    state: 'idle',
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
  }
}

function filterGamesByCategory(games: Game[], category: LibraryCategory) {
  if (category === 'all') {
    return games
  }

  return games.filter((game) => getGameCategory(game) === category)
}

function filterGamesBySearch(games: Game[], query: string) {
  const normalizedQuery = normalizeSearchText(query)

  if (!normalizedQuery) {
    return games
  }

  return games.filter((game) => (
    normalizeSearchText(`${game.title} ${game.source} ${game.status}`).includes(normalizedQuery)
  ))
}

function countGamesByCategory(games: Game[], category: LibraryCategory) {
  return filterGamesByCategory(games, category).length
}

function getGameCategory(game: Game): LibraryCategory {
  if (game.platformId && game.platformId !== 'all') {
    return game.platformId
  }

  return detectPlatformFromSource(`${game.source} ${game.status}`)
}

function hostStatusLabel(hostOnline: boolean) {
  return hostOnline ? 'Online' : 'Aguardando'
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR')
}

function createInitialConnectedAccounts(): ConnectedAccountState[] {
  return connectedGamePlatforms.map((platform) => ({
    gamesFound: 0,
    lastSyncLabel: 'Nunca',
    platformId: platform.id,
    status: platform.state === 'experimental' ? 'experimental' : 'disconnected',
  }))
}

function formatAccountStatus(status: ConnectedAccountStatus) {
  const labels: Record<ConnectedAccountStatus, string> = {
    connected: 'Conectado',
    disconnected: 'Desconectado',
    syncing: 'Sincronizando',
    error: 'Erro',
    experimental: 'Experimental',
  }

  return labels[status]
}

function formatStateLabel(state: StreamSessionSummary['state']) {
  const labels: Record<StreamSessionSummary['state'], string> = {
    idle: 'Inativo',
    negotiating: 'Negociando',
    connecting: 'Conectando',
    streaming: 'Transmitindo',
    reconnecting: 'Reconectando',
    ended: 'Encerrado',
    failed: 'Falhou',
  }

  return labels[state]
}

function formatNullablePercent(value: number | null) {
  return typeof value === 'number' ? `${Math.round(value)}%` : 'N/D'
}

function formatPairingExpiry(value: string) {
  const expiresAt = Date.parse(value)

  if (!Number.isFinite(expiresAt)) {
    return 'Expira em instantes'
  }

  const minutes = Math.max(1, Math.ceil((expiresAt - Date.now()) / 60000))

  return `Expira em ${minutes} min`
}
