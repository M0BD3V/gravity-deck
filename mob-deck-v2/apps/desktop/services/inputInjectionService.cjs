const { spawn } = require('child_process')

const defaultTimeoutMs = 900
const buttonMappings = {
  'button:a': {
    label: 'A',
    key: 'Space',
    sendKeys: ' ',
  },
  'button:b': {
    label: 'B',
    key: 'Escape',
    sendKeys: '{ESC}',
  },
  'button:x': {
    label: 'X',
    key: 'Enter',
    sendKeys: '{ENTER}',
  },
  'button:y': {
    label: 'Y',
    key: 'Tab',
    sendKeys: '{TAB}',
  },
}

async function injectRemoteInput(event = {}, options = {}) {
  const normalized = normalizeRemoteInputEvent(event)

  if (!normalized.ok) {
    return createDelivery({
      ok: false,
      delivered: false,
      transport: 'invalid',
      message: normalized.message,
    })
  }

  if (normalized.event.type === 'button') {
    return await injectButton(normalized.event, options)
  }

  return createDelivery({
    ok: true,
    delivered: false,
    transport: 'planned',
    message: 'Entrada analogica registrada; injecao nativa fica para a proxima camada.',
  })
}

async function injectButton(event, options) {
  const mapping = buttonMappings[event.code]

  if (!mapping) {
    return createDelivery({
      ok: false,
      delivered: false,
      transport: 'unsupported',
      message: `Botao remoto sem mapeamento nativo: ${event.code}.`,
    })
  }

  if (!event.pressed) {
    return createDelivery({
      ok: true,
      delivered: false,
      transport: 'ignored-release',
      target: mapping.key,
      message: `${mapping.label}: soltura registrada.`,
    })
  }

  if (shouldDryRun(options)) {
    return createDelivery({
      ok: true,
      delivered: false,
      dryRun: true,
      transport: 'dry-run',
      target: mapping.key,
      message: `${mapping.label}: input nativo simulado (${mapping.key}).`,
    })
  }

  if (process.platform !== 'win32') {
    return createDelivery({
      ok: true,
      delivered: false,
      transport: 'unsupported-os',
      target: mapping.key,
      message: `${mapping.label}: injecao nativa disponivel primeiro no Windows.`,
    })
  }

  await sendWindowsKey(mapping.sendKeys, options)

  return createDelivery({
    ok: true,
    delivered: true,
    transport: 'windows-sendkeys',
    target: mapping.key,
    message: `${mapping.label}: input enviado para o Windows (${mapping.key}).`,
  })
}

function normalizeRemoteInputEvent(event) {
  if (!event || typeof event !== 'object') {
    return {
      ok: false,
      message: 'Entrada remota invalida.',
    }
  }

  if (event.type === 'button') {
    const code = String(event.code || '').trim()

    if (!code) {
      return {
        ok: false,
        message: 'Botao remoto sem codigo.',
      }
    }

    return {
      ok: true,
      event: {
        type: 'button',
        code,
        pressed: Boolean(event.pressed),
        at: normalizeTimestamp(event.at),
      },
    }
  }

  if (event.type === 'axis') {
    return {
      ok: true,
      event: {
        type: 'axis',
        code: String(event.code || '').trim(),
        value: clamp(Number(event.value), -1, 1),
        at: normalizeTimestamp(event.at),
      },
    }
  }

  if (event.type === 'pointer') {
    return {
      ok: true,
      event: {
        type: 'pointer',
        x: Number(event.x) || 0,
        y: Number(event.y) || 0,
        pressed: Boolean(event.pressed),
        at: normalizeTimestamp(event.at),
      },
    }
  }

  return {
    ok: false,
    message: 'Tipo de entrada remota nao suportado.',
  }
}

function shouldDryRun(options = {}) {
  if (typeof options.dryRun === 'boolean') {
    return options.dryRun
  }

  if (process.env.MOB_DECK_V2_INPUT_DRY_RUN === '1' || process.env.MOB_DECK_V2_SMOKE === '1') {
    return true
  }

  return process.env.MOB_DECK_V2_INPUT_NATIVE === '0'
}

function sendWindowsKey(sendKeys, options = {}) {
  return new Promise((resolve, reject) => {
    const timeoutMs = Number(options.timeoutMs) || defaultTimeoutMs
    const script = [
      '$shell = New-Object -ComObject WScript.Shell',
      `Start-Sleep -Milliseconds ${Number(options.delayMs) || 15}`,
      `$shell.SendKeys('${escapePowerShellSingleQuoted(sendKeys)}')`,
    ].join('; ')
    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script,
    ], {
      windowsHide: true,
    })
    let stderr = ''
    const timeoutId = setTimeout(() => {
      child.kill()
      reject(new Error('Tempo esgotado ao enviar input nativo.'))
    }, timeoutMs)

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', (error) => {
      clearTimeout(timeoutId)
      reject(error)
    })

    child.on('close', (code) => {
      clearTimeout(timeoutId)

      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(stderr.trim() || `PowerShell encerrou com codigo ${code}.`))
    })
  })
}

function createDelivery(payload) {
  return {
    ok: Boolean(payload.ok),
    delivered: Boolean(payload.delivered),
    dryRun: Boolean(payload.dryRun),
    transport: payload.transport || 'none',
    target: payload.target || '',
    message: payload.message || '',
  }
}

function normalizeTimestamp(value) {
  const timestamp = Number(value)

  return Number.isFinite(timestamp) ? timestamp : Date.now()
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(Math.max(value, min), max)
}

function escapePowerShellSingleQuoted(value) {
  return String(value).replaceAll("'", "''")
}

module.exports = {
  injectRemoteInput,
  normalizeRemoteInputEvent,
}
