import { Home, Library, MonitorPlay, SlidersHorizontal, Smartphone } from 'lucide-react'
import type { DesktopHostStatus } from '../contracts/desktopHost'
import { BrandLockup } from './BrandLockup'

export type DesktopView = 'home' | 'library' | 'streaming' | 'mobile' | 'center'

const navigation = [
  { id: 'home', label: 'Home', hint: 'Visao geral', icon: Home },
  { id: 'library', label: 'Biblioteca', hint: 'Seus jogos', icon: Library },
  { id: 'center', label: 'Gravity Center', hint: 'Scanner e diagnostico', icon: SlidersHorizontal },
  { id: 'mobile', label: 'Gravity Mobile', hint: 'Pareamento e Sync', icon: Smartphone },
  { id: 'streaming', label: 'Gravity Stream', hint: 'Sessao de streaming', icon: MonitorPlay },
] satisfies Array<{ id: DesktopView; label: string; hint: string; icon: typeof Home }>

type SidebarProps = {
  activeView: DesktopView
  hostStatus?: DesktopHostStatus | null
  onSelectView: (view: DesktopView) => void
}

export function Sidebar({
  activeView,
  hostStatus = null,
  onSelectView,
}: SidebarProps) {
  const hostLabel = hostStatus?.online ? 'Ativo' : 'Off'
  const mobileActive = Boolean(hostStatus?.mobileSession || hostStatus?.activePairing)
  const mobileLabel = hostStatus?.mobileSession ? 'Pareado' : hostStatus?.activePairing ? 'QR pronto' : 'Ausente'

  return (
    <aside className="sidebar" aria-label="Navegacao principal">
      <BrandLockup />

      <nav className="side-nav">
        {navigation.map((item) => {
          const Icon = item.icon

          return (
            <button
              aria-current={activeView === item.id ? 'page' : undefined}
              className={`side-item${activeView === item.id ? ' is-active' : ''}`}
              type="button"
              key={item.id}
              onClick={() => onSelectView(item.id)}
            >
              <Icon size={18} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
            </button>
          )
        })}
      </nav>

      <div className="host-status">
        <StatusMiniRow label="Servidor local" value={hostLabel} tone={hostStatus?.online ? 'ok' : 'idle'} />
        <StatusMiniRow label="Mobile" value={mobileLabel} tone={mobileActive ? 'info' : 'idle'} />
        <StatusMiniRow label="Stream" value="Em espera" tone="idle" />
      </div>
    </aside>
  )
}

function StatusMiniRow({
  label,
  tone,
  value,
}: {
  label: string
  tone: 'ok' | 'info' | 'idle'
  value: string
}) {
  return (
    <div className="status-mini-row" data-tone={tone}>
      <span>{label}</span>
      <strong>
        <i />
        {value}
      </strong>
    </div>
  )
}
