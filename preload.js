const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mobdeck", {
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  selectCoverImage: () => ipcRenderer.invoke("select-cover-image"),
  scanAutomatic: () => ipcRenderer.invoke("scan-automatic"),
  scanApps: () => ipcRenderer.invoke("scan-apps"),
  scanFolder: (folder) => ipcRenderer.invoke("scan-folder", folder),
  getAppIcon: (appItem) => ipcRenderer.invoke("get-app-icon", appItem),
  getAppCatalog: () => ipcRenderer.invoke("get-app-catalog"),
  getCompanionStatus: () => ipcRenderer.invoke("get-companion-status"),
  getPairingQr: () => ipcRenderer.invoke("get-pairing-qr"),
  setStartWithWindows: (enabled) => ipcRenderer.invoke("set-start-with-windows", enabled),
  syncCompanionLibrary: (snapshot) => ipcRenderer.invoke("sync-companion-library", snapshot),
  getGameDetails: (game) => ipcRenderer.invoke("get-game-details", game),
  getLaunchProfiles: () => ipcRenderer.invoke("get-launch-profiles"),
  saveLaunchProfile: (profile) => ipcRenderer.invoke("save-launch-profile", profile),
  launchWithProfile: (target, profile) => ipcRenderer.invoke("launch-with-profile", target, profile),
  getDiagnostics: () => ipcRenderer.invoke("get-diagnostics"),
  exportUserData: (payload) => ipcRenderer.invoke("export-user-data", payload),
  importUserData: () => ipcRenderer.invoke("import-user-data"),
  installCatalogApp: (catalogId) => ipcRenderer.invoke("install-catalog-app", catalogId),
  launchGame: (target) => ipcRenderer.invoke("launch-game", target),
  openExternalUrl: (url) => ipcRenderer.invoke("open-external-url", url),
  onCompanionRefreshRequested: (callback) => {
    const listener = () => callback();

    ipcRenderer.on("companion-refresh-requested", listener);

    return () => ipcRenderer.removeListener("companion-refresh-requested", listener);
  },
  onCompanionGameLaunched: (callback) => {
    const listener = (event, payload) => callback(payload);

    ipcRenderer.on("companion-game-launched", listener);

    return () => ipcRenderer.removeListener("companion-game-launched", listener);
  },
  onAppInstallProgress: (callback) => {
    const listener = (event, payload) => callback(payload);

    ipcRenderer.on("app-install-progress", listener);

    return () => ipcRenderer.removeListener("app-install-progress", listener);
  }
});
