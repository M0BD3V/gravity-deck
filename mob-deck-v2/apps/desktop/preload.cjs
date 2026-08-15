const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('mobDeckDesktop', {
  getHostStatus: () => ipcRenderer.invoke('desktop:get-host-status'),
  listGames: () => ipcRenderer.invoke('desktop:list-games'),
  refreshLibrary: () => ipcRenderer.invoke('desktop:refresh-library'),
  createPairingPayload: () => ipcRenderer.invoke('desktop:create-pairing-payload'),
  listCaptureSources: () => ipcRenderer.invoke('desktop:list-capture-sources'),
  launchGame: (request) => ipcRenderer.invoke('desktop:launch-game', request),
  prepareStream: (request) => ipcRenderer.invoke('desktop:prepare-stream', request),
  createStreamOffer: (request) => ipcRenderer.invoke('desktop:create-stream-offer', request),
  getStreamSession: () => ipcRenderer.invoke('desktop:get-stream-session'),
  getStreamTelemetry: () => ipcRenderer.invoke('desktop:get-stream-telemetry'),
  reportStreamTelemetry: (telemetry) => ipcRenderer.invoke('desktop:report-stream-telemetry', telemetry),
  acceptStreamAnswer: (answer) => ipcRenderer.invoke('desktop:accept-stream-answer', answer),
  updateStreamConnectionState: (update) => ipcRenderer.invoke('desktop:update-stream-connection-state', update),
  sendRemoteInput: (event) => ipcRenderer.invoke('desktop:send-remote-input', event),
  stopStreamSession: () => ipcRenderer.invoke('desktop:stop-stream-session'),
  onStreamOfferRequest: (handler) => {
    const listener = (event, request) => handler(request)

    ipcRenderer.on('gravity-stream:create-offer', listener)

    return () => ipcRenderer.removeListener('gravity-stream:create-offer', listener)
  },
  sendStreamOfferResult: (result) => ipcRenderer.send('desktop:stream-offer-result', result),
  onStreamAnswer: (handler) => {
    const listener = (event, answer) => handler(answer)

    ipcRenderer.on('gravity-stream:answer', listener)

    return () => ipcRenderer.removeListener('gravity-stream:answer', listener)
  },
})
