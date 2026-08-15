import { useCallback, useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'

type SoundIntent = 'primary-hover' | 'card-hover' | 'click' | 'open' | 'close' | 'success' | 'error'

const storageKey = 'gravity-interface-sounds'
const interactiveSelector = [
  '.primary-action:not(:disabled)',
  '.play-action:not(:disabled)',
  '.stream-action:not(:disabled)',
  '.side-item:not(:disabled)',
  '.icon-action:not(:disabled)',
  '.text-action:not(:disabled)',
  '.game-actions button:not(:disabled)',
  '.quick-controls button:not(:disabled)',
  '.pairing-header button:not(:disabled)',
  '.category-tabs button:not(:disabled)',
  '.management-card button:not(:disabled)',
  '.modal-close',
  '.game-card',
  '.mobile-tabs button:not(:disabled)',
  '.mobile-game-card:not(:disabled)',
  '.qr-panel button:not(:disabled)',
  '.control-bar button:not(:disabled)',
  '.gamepad-panel button:not(:disabled)',
].join(',')
const confirmSelector = [
  '.primary-action',
  '.play-action',
  '.stream-action',
  '.game-actions button',
  '.mobile-game-card',
  '.qr-panel button',
  '.host-form button',
  '.pair-form button',
  '.control-bar button',
  '.gamepad-panel button',
  '.pairing-header button',
].join(',')
const cardSelector = '.game-card, .mobile-game-card'
const closeSelector = '.modal-close'
const openSelector = '.side-item, .category-tabs button, .management-card button'
const feedbackSelector = [
  '.action-feedback',
  '.library-feedback',
  '.pairing-feedback',
].join(',')

export function useInterfaceSounds() {
  const [enabled, setEnabled] = useState(() => window.localStorage.getItem(storageKey) !== 'off')
  const audioContextRef = useRef<AudioContext | null>(null)
  const lastHoverTargetRef = useRef<Element | null>(null)
  const lastFeedbackRef = useRef('')

  const play = useCallback((intent: SoundIntent) => {
    if (!enabled) {
      return
    }

    const context = getAudioContext(audioContextRef)

    if (!context || context.state === 'suspended') {
      return
    }

    playCrystalTone(context, intent)
  }, [enabled])

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current
      window.localStorage.setItem(storageKey, next ? 'on' : 'off')

      return next
    })
  }, [])

  useEffect(() => {
    window.localStorage.setItem(storageKey, enabled ? 'on' : 'off')
  }, [enabled])

  useEffect(() => {
    function unlockAudio() {
      const context = getAudioContext(audioContextRef)

      context?.resume().catch(() => {})
    }

    function handlePointerOver(event: PointerEvent) {
      const target = getInteractiveTarget(event.target)

      if (!target || target === lastHoverTargetRef.current) {
        return
      }

      lastHoverTargetRef.current = target
      play(target.matches(cardSelector) ? 'card-hover' : 'primary-hover')
    }

    function handleClick(event: MouseEvent) {
      const target = getInteractiveTarget(event.target)

      if (!target) {
        return
      }

      if (target.matches(closeSelector)) {
        play('close')
        return
      }

      if (target.matches(openSelector)) {
        play('open')
        return
      }

      play(target.matches(confirmSelector) ? 'success' : 'click')
    }

    window.addEventListener('pointerdown', unlockAudio, { once: true })
    window.addEventListener('keydown', unlockAudio, { once: true })
    document.addEventListener('pointerover', handlePointerOver)
    document.addEventListener('click', handleClick)

    const observer = new MutationObserver(() => {
      const feedback = getLatestFeedback()

      if (!feedback || feedback === lastFeedbackRef.current) {
        return
      }

      lastFeedbackRef.current = feedback
      play(feedback.includes('|error|') ? 'error' : 'success')
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
      document.removeEventListener('pointerover', handlePointerOver)
      document.removeEventListener('click', handleClick)
      observer.disconnect()
    }
  }, [play])

  return {
    enabled,
    toggle,
  }
}

function getAudioContext(audioContextRef: MutableRefObject<AudioContext | null>) {
  if (audioContextRef.current) {
    return audioContextRef.current
  }

  const AudioContextConstructor = window.AudioContext
    || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextConstructor) {
    return null
  }

  audioContextRef.current = new AudioContextConstructor()

  return audioContextRef.current
}

function getInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null
  }

  return target.closest(interactiveSelector)
}

function playCrystalTone(context: AudioContext, intent: SoundIntent) {
  const now = context.currentTime
  const gain = context.createGain()
  const main = context.createOscillator()
  const shimmer = context.createOscillator()
  const filter = context.createBiquadFilter()
  const tone = getTone(intent)

  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(tone.filter, now)

  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(tone.volume, now + 0.018)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration)

  main.type = 'sine'
  main.frequency.setValueAtTime(tone.frequency, now)
  main.frequency.exponentialRampToValueAtTime(tone.frequency * tone.glide, now + tone.duration)

  shimmer.type = 'sine'
  shimmer.frequency.setValueAtTime(tone.frequency * tone.shimmer, now)
  shimmer.detune.setValueAtTime(5, now)

  main.connect(filter)
  shimmer.connect(filter)
  filter.connect(gain)
  gain.connect(context.destination)

  main.start(now)
  shimmer.start(now + 0.006)
  main.stop(now + tone.duration + 0.02)
  shimmer.stop(now + tone.duration + 0.02)
}

function getTone(intent: SoundIntent) {
  if (intent === 'success') {
    return { duration: 0.2, filter: 1180, frequency: 260, glide: 1.28, shimmer: 2.4, volume: 0.026 }
  }

  if (intent === 'click') {
    return { duration: 0.11, filter: 940, frequency: 210, glide: 1.08, shimmer: 2.12, volume: 0.018 }
  }

  if (intent === 'card-hover') {
    return { duration: 0.15, filter: 980, frequency: 185, glide: 1.16, shimmer: 2.32, volume: 0.016 }
  }

  if (intent === 'close') {
    return { duration: 0.14, filter: 840, frequency: 240, glide: 0.78, shimmer: 1.82, volume: 0.018 }
  }

  if (intent === 'open') {
    return { duration: 0.16, filter: 1060, frequency: 190, glide: 1.34, shimmer: 2.18, volume: 0.02 }
  }

  if (intent === 'error') {
    return { duration: 0.22, filter: 760, frequency: 170, glide: 0.66, shimmer: 1.52, volume: 0.023 }
  }

  return { duration: 0.09, filter: 900, frequency: 175, glide: 1.06, shimmer: 2.05, volume: 0.012 }
}

function getLatestFeedback() {
  const feedbacks = [...document.querySelectorAll(feedbackSelector)]
    .filter((node) => node.textContent?.trim())
  const latest = feedbacks[feedbacks.length - 1]

  if (!latest) {
    return ''
  }

  const state = latest.classList.contains('is-error') ? 'error' : 'ok'

  return `${latest.textContent?.trim()}|${state}|`
}
