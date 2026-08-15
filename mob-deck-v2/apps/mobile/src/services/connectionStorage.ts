import { Capacitor } from '@capacitor/core'
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin'

const legacyServerUrlKey = 'mob-deck-v2-signal-url'
const serverUrlKey = 'gravity-v2-signal-url'
const sessionTokenKey = 'gravity-v2-session-token'

export type StoredConnection = {
  serverUrl: string
  token: string
}

export function getSavedServerUrlSync() {
  return readLocalValue(serverUrlKey) || readLocalValue(legacyServerUrlKey)
}

export async function loadStoredConnection(): Promise<StoredConnection> {
  return {
    serverUrl: getSavedServerUrlSync(),
    token: await readSessionToken(),
  }
}

export async function saveConnection(connection: StoredConnection) {
  writeLocalValue(serverUrlKey, connection.serverUrl)
  writeLocalValue(legacyServerUrlKey, '')

  if (Capacitor.isNativePlatform()) {
    await SecureStoragePlugin.set({
      key: sessionTokenKey,
      value: connection.token,
    })
    return
  }

  writeSessionValue(sessionTokenKey, connection.token)
}

export async function clearStoredConnection() {
  writeLocalValue(serverUrlKey, '')
  writeLocalValue(legacyServerUrlKey, '')
  writeSessionValue(sessionTokenKey, '')

  if (!Capacitor.isNativePlatform()) {
    return
  }

  try {
    await SecureStoragePlugin.remove({ key: sessionTokenKey })
  } catch {
    // Missing secure-storage keys are safe to ignore.
  }
}

async function readSessionToken() {
  if (!Capacitor.isNativePlatform()) {
    return readSessionValue(sessionTokenKey)
  }

  try {
    const result = await SecureStoragePlugin.get({ key: sessionTokenKey })

    return result.value || ''
  } catch {
    return ''
  }
}

function readLocalValue(key: string) {
  try {
    return window.localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function writeLocalValue(key: string, value: string) {
  try {
    if (value) {
      window.localStorage.setItem(key, value)
      return
    }

    window.localStorage.removeItem(key)
  } catch {
    // Browser storage can be unavailable in restricted WebViews.
  }
}

function readSessionValue(key: string) {
  try {
    return window.sessionStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function writeSessionValue(key: string, value: string) {
  try {
    if (value) {
      window.sessionStorage.setItem(key, value)
      return
    }

    window.sessionStorage.removeItem(key)
  } catch {
    // Session storage is only a development fallback for web previews.
  }
}
