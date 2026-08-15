import { useEffect, useState } from 'react'
import type { StreamCaptureSource } from '../contracts/streaming'

type CaptureSourcesState = {
  sources: StreamCaptureSource[]
  selectedSource: StreamCaptureSource | null
  loading: boolean
  message: string
  error: string
  refresh: () => Promise<void>
}

export function useCaptureSources(): CaptureSourcesState {
  const [state, setState] = useState<CaptureSourcesState>({
    sources: [],
    selectedSource: null,
    loading: true,
    message: '',
    error: '',
    refresh,
  })

  async function refresh() {
    setState((current) => ({
      ...current,
      loading: true,
      message: 'Atualizando janelas de captura...',
      error: '',
    }))

    if (!window.mobDeckDesktop?.listCaptureSources) {
      setState({
        sources: [],
        selectedSource: null,
        loading: false,
        message: 'Captura disponivel no app Gravity Deck.',
        error: '',
        refresh,
      })
      return
    }

    try {
      const result = await window.mobDeckDesktop.listCaptureSources()

      setState({
        sources: result.sources,
        selectedSource: result.selectedSource,
        loading: false,
        message: result.message,
        error: result.ok ? '' : result.message,
        refresh,
      })
    } catch (error) {
      setState({
        sources: [],
        selectedSource: null,
        loading: false,
        message: '',
        error: error instanceof Error ? error.message : 'Nao foi possivel listar fontes de captura.',
        refresh,
      })
    }
  }

  useEffect(() => {
    refresh().catch(() => {})
  }, [])

  return state
}
