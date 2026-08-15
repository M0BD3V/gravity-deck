import { useEffect, useMemo, useState } from 'react'
import type { Game } from '../domain/types'

type GameLibraryState = {
  games: Game[]
  featuredGame: Game | null
  loading: boolean
  error: string
  message: string
  refresh: () => Promise<void>
}

export function useGameLibrary(): GameLibraryState {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadGames() {
      if (!window.mobDeckDesktop?.listGames) {
        setLoading(false)
        return
      }

      try {
        const result = await window.mobDeckDesktop.listGames()

        if (!cancelled) {
          setGames(result.games)
          setError(result.ok ? '' : 'Biblioteca indisponivel no host.')
          setMessage(result.message || '')
          setLoading(false)
        }
      } catch (loadError) {
        if (!cancelled) {
          setGames([])
          setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar a biblioteca.')
          setMessage('')
          setLoading(false)
        }
      }
    }

    loadGames()

    return () => {
      cancelled = true
    }
  }, [])

  async function refresh() {
    if (!window.mobDeckDesktop?.refreshLibrary) {
      setMessage('Reescaneamento real disponivel no app desktop.')
      setError('')
      return
    }

    setLoading(true)
    setMessage('Mapeando biblioteca no PC...')
    setError('')

    try {
      const result = await window.mobDeckDesktop.refreshLibrary()

      setGames(result.games)
      setError(result.ok ? '' : result.message || 'Scanner nao encontrou uma biblioteca valida.')
      setMessage(result.message || 'Biblioteca atualizada.')
    } catch (refreshError) {
      setGames([])
      setError(refreshError instanceof Error ? refreshError.message : 'Nao foi possivel reescanear.')
      setMessage('')
    } finally {
      setLoading(false)
    }
  }

  const featuredGame = useMemo(() => {
    return games[0] || null
  }, [games])

  return {
    games,
    featuredGame,
    loading,
    error,
    message,
    refresh,
  }
}
