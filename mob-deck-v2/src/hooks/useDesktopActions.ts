import { useState } from 'react'
import type { Game, GameLaunchMode } from '../domain/types'

type ActionState = {
  busyGameId: string
  message: string
  error: string
}

export function useDesktopActions() {
  const [state, setState] = useState<ActionState>({
    busyGameId: '',
    message: '',
    error: '',
  })

  async function launchGame(game: Game, mode: GameLaunchMode) {
    const modeLabel = mode === 'mobile-stream' ? 'celular' : 'PC'

    setState({
      busyGameId: game.id,
      message: `Enviando ${game.title} para jogar no ${modeLabel}...`,
      error: '',
    })

    try {
      if (!window.mobDeckDesktop?.launchGame) {
        setState({
          busyGameId: '',
          message: `${game.title}: acao simulada no navegador.`,
          error: '',
        })
        return
      }

      const result = await window.mobDeckDesktop.launchGame({
        gameId: game.id,
        mode,
        minimizeLauncher: mode === 'desktop',
        streamPreset: mode === 'mobile-stream' ? 'performance' : 'balanced',
      })

      setState({
        busyGameId: '',
        message: result.message,
        error: result.ok ? '' : result.message,
      })
    } catch (error) {
      setState({
        busyGameId: '',
        message: '',
        error: error instanceof Error ? error.message : 'Acao nao concluida.',
      })
    }
  }

  return {
    ...state,
    launchGame,
  }
}
