import { useState } from 'react'
import { Search, Wifi, WifiOff } from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import type { DesktopView } from './components/Sidebar'
import { Dashboard } from './features/dashboard/Dashboard'
import { useDesktopHostStatus } from './hooks/useDesktopHostStatus'
import { useInterfaceSounds } from './hooks/useInterfaceSounds'
import { useStreamOfferBridge } from './hooks/useStreamOfferBridge'
import './App.css'

function App() {
  const [activeView, setActiveView] = useState<DesktopView>('home')
  const [librarySearch, setLibrarySearch] = useState('')
  const host = useDesktopHostStatus()
  const interfaceSounds = useInterfaceSounds()
  useStreamOfferBridge()

  function updateLibrarySearch(value: string) {
    setLibrarySearch(value)

    if (value.trim()) {
      setActiveView('library')
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeView={activeView}
        hostStatus={host.status}
        onSelectView={setActiveView}
      />
      <div className="app-main">
        <header className="app-topbar">
          <label className="global-search" aria-label="Buscar jogos na Biblioteca">
            <Search size={17} />
            <input
              type="search"
              value={librarySearch}
              onChange={(event) => updateLibrarySearch(event.target.value)}
              onFocus={() => setActiveView('library')}
              placeholder="Buscar jogos, plataformas ou acoes..."
            />
          </label>

          <div className="top-status-stack">
            <span className="top-status-chip">
              {host.status?.online ? <Wifi size={15} /> : <WifiOff size={15} />}
              {host.status?.localAddress || 'Aguardando host'}
            </span>
            <span className="top-status-chip" data-tone="ready">
              Pronto
            </span>
          </div>
        </header>

        <Dashboard
          activeView={activeView}
          hostStatus={host.status}
          hostError={host.error}
          interfaceSoundsEnabled={interfaceSounds.enabled}
          librarySearch={librarySearch}
          onLibrarySearchChange={setLibrarySearch}
          onSelectView={setActiveView}
          onToggleInterfaceSounds={interfaceSounds.toggle}
        />
      </div>
    </div>
  )
}

export default App
