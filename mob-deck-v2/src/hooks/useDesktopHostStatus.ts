import { useEffect, useState } from 'react'
import type { DesktopHostStatus } from '../contracts/desktopHost'

type HostStatusState = {
  status: DesktopHostStatus | null
  loading: boolean
  error: string
}

export function useDesktopHostStatus(): HostStatusState {
  const [state, setState] = useState<HostStatusState>({
    status: null,
    loading: true,
    error: '',
  })

  useEffect(() => {
    let cancelled = false

    async function loadHostStatus() {
      if (!window.mobDeckDesktop?.getHostStatus) {
        setState({ status: null, loading: false, error: '' })
        return
      }

      try {
        const status = await window.mobDeckDesktop.getHostStatus()

        if (!cancelled) {
          setState({ status, loading: false, error: '' })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Host indisponivel',
          })
        }
      }
    }

    loadHostStatus()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
