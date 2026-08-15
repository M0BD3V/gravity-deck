const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray, nativeImage } = require("electron");
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs/promises");
const http = require("http");
const os = require("os");
const path = require("path");
const QRCode = require("qrcode");
const { fileURLToPath } = require("url");
const { findCatalogItem, getCatalogItems } = require("./src/catalog/appCatalog");
const { getNetworkProfile } = require("./src/companion/networkProfile");

let mainWindow;
let tray = null;
let isQuitting = false;
let companionServer = null;
let companionPin = null;
let companionPort = null;
let companionLibrary = {
  games: [],
  apps: [],
  savedAt: null
};
const companionMediaSources = new Map();
const companionDefaultPort = Number(process.env.MOBDECK_COMPANION_PORT || 8123);
const companionBrandIconSlugs = {
  "7zip": "7zip",
  "adobe-illustrator": "adobeillustrator",
  "after-effects": "adobeaftereffects",
  "amazon-games": "amazon",
  "apple-music": "applemusic",
  "apple-tv": "appletv",
  "battle-net": "battledotnet",
  "brave": "brave",
  "canva": "canva",
  "capcut": "capcut",
  "chatgpt": "openai",
  "chrome": "googlechrome",
  "claude": "claude",
  "crunchyroll": "crunchyroll",
  "davinci-resolve": "davinciresolve",
  "deezer": "deezer",
  "discord": "discord",
  "disney-plus": "disneyplus",
  "docker-desktop": "docker",
  "dropbox": "dropbox",
  "ea-app": "ea",
  "edge": "microsoftedge",
  "epic-games": "epicgames",
  "figma": "figma",
  "firefox": "firefoxbrowser",
  "git": "git",
  "github-desktop": "github",
  "gog-galaxy": "gogdotcom",
  "google-drive": "googledrive",
  "heroic": "heroicgameslauncher",
  "jetbrains-toolbox": "jetbrains",
  "kdenlive": "kdenlive",
  "kodi": "kodi",
  "krita": "krita",
  "max": "max",
  "mega": "mega",
  "minecraft-launcher": "minecraft",
  "mubi": "mubi",
  "netflix": "netflix",
  "obs": "obsstudio",
  "onedrive": "microsoftonedrive",
  "opera-gx": "opera",
  "paramount-plus": "paramountplus",
  "perplexity": "perplexity",
  "photoshop": "adobephotoshop",
  "plex": "plex",
  "postman": "postman",
  "prime-video": "primevideo",
  "riot-client": "riotgames",
  "rockstar-games": "rockstargames",
  "sharex": "sharex",
  "skype": "skype",
  "slack": "slack",
  "spotify": "spotify",
  "steam": "steam",
  "telegram": "telegram",
  "teams": "microsoftteams",
  "twitch": "twitch",
  "ubisoft-connect": "ubisoft",
  "vimeo": "vimeo",
  "vivaldi": "vivaldi",
  "wallpaper-engine": "wallpaperengine",
  "vscode": "visualstudiocode",
  "visual-studio": "visualstudio",
  "whatsapp": "whatsapp",
  "winrar": "winrar",
  "xbox": "xbox",
  "youtube": "youtube",
  "youtube-music": "youtubemusic",
  "zoom": "zoom"
};
const appLikeGameRules = [
  {
    appCatalogId: "wallpaper-engine",
    steamAppId: "431960",
    names: ["wallpaper engine", "wallpaper_engine", "wallpaper32"],
    name: "Wallpaper Engine",
    appCategoryId: "gamer-utils",
    appCategoryName: "Utilitarios gamer",
    summary: "Papeis de parede animados, interativos e com suporte a Steam Workshop.",
    website: "https://store.steampowered.com/app/431960/Wallpaper_Engine/"
  }
];
const nonGameSteamAppIds = new Set(["431960"]);
const nonGameGameWords = [
  "cursor",
  "pcsx2",
  "redm",
  "python",
  "python314",
  "samfwtool",
  "sam fw tool",
  "visual studio code",
  "microsoft vs code",
  "vscode",
  "unreal engine",
  "unity hub",
  "blender"
];

if (process.platform === "win32") {
  app.setAppUserModelId("com.mob.mobdeck");
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showMainWindow();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 850,
    minWidth: 520,
    minHeight: 520,
    show: false,
    icon: getAppIconPath(),
    autoHideMenuBar: true,
    title: "MOB Deck",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  let windowRevealed = false;
  const revealWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed() || windowRevealed) {
      return;
    }

    windowRevealed = true;
    mainWindow.maximize();
    mainWindow.show();
    mainWindow.focus();
    updateTrayMenu();
  };

  mainWindow.loadFile("index.html").catch((error) => {
    console.error("[MOB Deck] Falha ao carregar a janela principal:");
    console.error(error);
    revealWindow();
  });
  mainWindow.once("ready-to-show", revealWindow);
  setTimeout(revealWindow, 2500);

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error(`[MOB Deck] Renderer falhou ao carregar (${errorCode}): ${errorDescription}`);
    revealWindow();
  });

  mainWindow.webContents.on("render-process-gone", (event, details) => {
    console.error("[MOB Deck] Renderer encerrou inesperadamente:");
    console.error(details);
  });

  mainWindow.on("close", (event) => {
    if (isQuitting || process.platform === "darwin") {
      return;
    }

    event.preventDefault();
    hideMainWindowToTray();
  });
}

app.whenReady().then(async () => {
  await loadCompanionState();
  await startCompanionServer();
  createWindow();
  createTray();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    showMainWindow();
  }
});

app.on("before-quit", () => {
  isQuitting = true;

  if (companionServer) {
    companionServer.close();
    companionServer = null;
  }
});

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Escolha onde procurar seus jogos",
    properties: ["openDirectory"]
  });

  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("select-cover-image", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Escolha uma capa",
    properties: ["openFile"],
    filters: [
      { name: "Imagens", extensions: ["jpg", "jpeg", "png", "webp", "gif", "ico"] }
    ]
  });

  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("scan-folder", async (event, folder) => {
  try {
    const games = await scanFolders([folder]);
    const apps = await scanApps();

    return mergeGamesWithAppLaunchers(games, apps);
  } catch (error) {
    console.error("Erro no scanner:");
    console.error(error);
    throw error;
  }
});

ipcMain.handle("scan-automatic", async () => {
  try {
    const roots = await getAvailableDriveRoots();
    const games = await scanFolders(roots);
    const apps = await scanApps();

    return {
      roots,
      games: mergeGamesWithAppLaunchers(games, apps),
      apps
    };
  } catch (error) {
    console.error("Erro no scanner automatico:");
    console.error(error);
    throw error;
  }
});

ipcMain.handle("scan-apps", async () => {
  try {
    return await scanApps();
  } catch (error) {
    console.error("Erro no scanner de apps:");
    console.error(error);
    throw error;
  }
});

ipcMain.handle("get-app-icon", async (event, appItem) => {
  try {
    return await getAppIcon(appItem);
  } catch {
    return null;
  }
});

ipcMain.handle("get-app-catalog", () => getCatalogItems());

ipcMain.handle("get-companion-status", () => getCompanionStatus());

ipcMain.handle("get-pairing-qr", async () => {
  return await getPairingQr();
});

ipcMain.handle("set-start-with-windows", (event, enabled) => {
  return setStartWithWindows(!!enabled);
});

ipcMain.handle("sync-companion-library", async (event, snapshot) => {
  companionLibrary = sanitizeCompanionLibrary(snapshot);
  await saveCompanionLibrary();

  return getCompanionStatus();
});

ipcMain.handle("get-launch-profiles", async () => {
  return await loadLaunchProfiles();
});

ipcMain.handle("save-launch-profile", async (event, profile) => {
  return await saveLaunchProfile(profile);
});

ipcMain.handle("launch-with-profile", async (event, target, profile) => {
  return await launchWithProfile(target, profile);
});

ipcMain.handle("get-diagnostics", async () => {
  return await getDiagnostics();
});

ipcMain.handle("export-user-data", async (event, payload) => {
  return await exportUserData(payload);
});

ipcMain.handle("import-user-data", async () => {
  return await importUserData();
});

ipcMain.handle("install-catalog-app", async (event, catalogId) => {
  return await installCatalogApp(event, catalogId);
});

ipcMain.handle("open-external-url", async (event, url) => {
  await openTrustedExternalUrl(url);
  return true;
});

ipcMain.handle("get-game-details", async (event, game) => {
  try {
    const scanner = require("./src/scanner/scanner");

    return await scanner.getDetails(game);
  } catch (error) {
    console.error("Erro ao buscar detalhes do jogo:");
    console.error(error);
    throw error;
  }
});

ipcMain.handle("launch-game", async (event, target) => {
  try {
    return await launchTarget(target);
  } catch (error) {
    console.error("Erro ao abrir jogo:");
    console.error(error);
    throw error;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function createTray() {
  if (tray) {
    return tray;
  }

  tray = new Tray(getTrayIcon());
  tray.setToolTip("MOB Deck");
  tray.on("click", showMainWindow);
  tray.on("double-click", showMainWindow);
  updateTrayMenu();

  return tray;
}

function getTrayIcon() {
  const candidates = [
    getAppIconPath(),
    path.join(__dirname, "assets", "mobdeck-mark.png")
  ];

  for (const candidate of candidates) {
    const image = nativeImage.createFromPath(candidate);

    if (!image.isEmpty()) {
      return process.platform === "win32" && path.extname(candidate).toLowerCase() !== ".ico"
        ? image.resize({ width: 16, height: 16, quality: "best" })
        : image;
    }
  }

  return nativeImage.createFromDataURL(
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect width='32' height='32' rx='8' fill='%236d35ff'/><text x='16' y='22' text-anchor='middle' font-size='14' font-family='Arial' font-weight='700' fill='white'>M</text></svg>"
  );
}

function getAppIconPath() {
  return path.join(__dirname, "build", "icon.ico");
}

function updateTrayMenu() {
  if (!tray) {
    return;
  }

  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: "Abrir MOB Deck",
      click: showMainWindow
    },
    {
      label: "Recolher para bandeja",
      enabled: !!mainWindow && mainWindow.isVisible(),
      click: hideMainWindowToTray
    },
    { type: "separator" },
    {
      label: "Sair",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
  updateTrayMenu();
}

function hideMainWindowToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  createTray();
  mainWindow.hide();
  updateTrayMenu();
}

async function loadCompanionState() {
  await loadCompanionSettings();

  try {
    const raw = await fs.readFile(getCompanionLibraryPath(), "utf8");
    companionLibrary = sanitizeCompanionLibrary(JSON.parse(raw));
  } catch {
    companionLibrary = sanitizeCompanionLibrary(null);
  }
}

async function loadCompanionSettings() {
  const settingsPath = getCompanionSettingsPath();
  let settings = null;

  try {
    settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
  } catch {
    settings = null;
  }

  companionPin = isValidStoredCompanionToken(settings?.token)
    ? String(settings.token)
    : crypto.randomBytes(24).toString("base64url");

  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify({ token: companionPin }, null, 2));
}

function isValidStoredCompanionToken(value) {
  return /^[a-zA-Z0-9_-]{24,128}$/.test(String(value || ""));
}

async function saveCompanionLibrary() {
  const libraryPath = getCompanionLibraryPath();

  await fs.mkdir(path.dirname(libraryPath), { recursive: true });
  await fs.writeFile(libraryPath, JSON.stringify(companionLibrary, null, 2));
}

function getCompanionSettingsPath() {
  return path.join(app.getPath("userData"), "companion.json");
}

function getCompanionLibraryPath() {
  return path.join(app.getPath("userData"), "companion-library.json");
}

function getLaunchProfilesPath() {
  return path.join(app.getPath("userData"), "launch-profiles.json");
}

async function startCompanionServer() {
  if (companionServer) {
    return;
  }

  let lastError = null;

  for (let port = companionDefaultPort; port < companionDefaultPort + 20; port++) {
    try {
      companionServer = await listenCompanionServer(port);
      companionPort = port;
      console.log(`[MOB Deck] Companion mobile em http://localhost:${port}`);
      return;
    } catch (error) {
      lastError = error;
      if (error.code !== "EADDRINUSE" && error.code !== "EACCES") {
        const errorMessage = `Nao foi possivel iniciar o servidor do companion mobile: ${error.message}`;
        console.error(`[MOB Deck] ${errorMessage}`);
        console.error(error);
        dialog.showErrorBox("Erro de Rede", errorMessage);
        return;
      }
    }
  }

  const errorMessage = `Nenhuma porta livre entre ${companionDefaultPort} e ${companionDefaultPort + 19} para o companion mobile. Outro programa pode estar usando a porta.`;
  console.error(`[MOB Deck] ${errorMessage}`);
  console.error(lastError);
  dialog.showErrorBox("Erro de Rede", errorMessage);
}

function listenCompanionServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      handleCompanionRequest(request, response).catch((error) => {
        console.error("[MOB Deck] Erro no companion mobile:");
        console.error(error);
        sendJson(response, 500, { ok: false, error: "Erro interno do companion." });
      });
    });

    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}

async function handleCompanionRequest(request, response) {
  const parsedUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && await serveCompanionStatic(parsedUrl.pathname, response)) {
    return;
  }

  if (parsedUrl.pathname === "/api/status" && request.method === "GET") {
    sendJson(response, 200, getCompanionStatus({ includePin: false, includeWakeProfile: false }));
    return;
  }

  if (parsedUrl.pathname === "/api/pair" && request.method === "POST") {
    const body = await readJsonBody(request);
    const pairingToken = String(body?.token || body?.pin || "");

    if (!isValidCompanionPin(pairingToken)) {
      sendJson(response, 401, { ok: false, error: "QR de pareamento invalido." });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      token: companionPin,
      status: getCompanionStatus({ includePin: false, includeWakeProfile: true }),
      wakeProfile: getWakeProfile()
    });
    return;
  }

  if (parsedUrl.pathname === "/api/wol-profile" && request.method === "GET") {
    if (!isCompanionRequestAuthorized(request, parsedUrl)) {
      sendJson(response, 401, { ok: false, error: "Pareamento necessario." });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      wakeProfile: getWakeProfile(),
      startup: getStartupSettings()
    });
    return;
  }

  if (parsedUrl.pathname === "/api/startup" && request.method === "GET") {
    if (!isCompanionRequestAuthorized(request, parsedUrl)) {
      sendJson(response, 401, { ok: false, error: "Pareamento necessario." });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      startup: getStartupSettings()
    });
    return;
  }

  if (parsedUrl.pathname === "/api/startup" && request.method === "POST") {
    if (!isCompanionRequestAuthorized(request, parsedUrl)) {
      sendJson(response, 401, { ok: false, error: "Pareamento necessario." });
      return;
    }

    const body = await readJsonBody(request);
    const startup = setStartWithWindows(!!body?.enabled);

    sendJson(response, 200, {
      ok: true,
      startup
    });
    return;
  }

  if (parsedUrl.pathname === "/api/diagnostics" && request.method === "GET") {
    if (!isCompanionRequestAuthorized(request, parsedUrl)) {
      sendJson(response, 401, { ok: false, error: "Pareamento necessario." });
      return;
    }

    sendJson(response, 200, await getDiagnostics({ includeSensitivePaths: false }));
    return;
  }

  if (parsedUrl.pathname === "/api/games" && request.method === "GET") {
    if (!isCompanionRequestAuthorized(request, parsedUrl)) {
      sendJson(response, 401, { ok: false, error: "Pareamento necessario." });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      games: getCompanionGamesForResponse(getRequestPin(request, parsedUrl)),
      savedAt: companionLibrary.savedAt || null
    });
    return;
  }

  if (parsedUrl.pathname === "/api/apps" && request.method === "GET") {
    if (!isCompanionRequestAuthorized(request, parsedUrl)) {
      sendJson(response, 401, { ok: false, error: "Pareamento necessario." });
      return;
    }

    if (!companionLibrary.apps.length) {
      companionLibrary.apps = (await scanApps()).map(sanitizeCompanionGame).filter(Boolean);
      companionLibrary.savedAt = new Date().toISOString();
      await saveCompanionLibrary();
    }

    sendJson(response, 200, {
      ok: true,
      apps: getCompanionAppsForResponse(getRequestPin(request, parsedUrl)),
      savedAt: companionLibrary.savedAt || null
    });
    return;
  }

  const launchMatch = parsedUrl.pathname.match(/^\/api\/games\/([^/]+)\/launch$/);

  if (launchMatch && request.method === "POST") {
    if (!isCompanionRequestAuthorized(request, parsedUrl)) {
      sendJson(response, 401, { ok: false, error: "Pareamento necessario." });
      return;
    }

    const game = companionLibrary.games.find((item) => item.id === decodeURIComponent(launchMatch[1]));

    if (!game) {
      sendJson(response, 404, { ok: false, error: "Jogo nao encontrado." });
      return;
    }

    await launchCompanionItem(game, "game");

    sendJson(response, 200, { ok: true, launched: game.name });
    return;
  }

  const appLaunchMatch = parsedUrl.pathname.match(/^\/api\/apps\/([^/]+)\/launch$/);

  if (appLaunchMatch && request.method === "POST") {
    if (!isCompanionRequestAuthorized(request, parsedUrl)) {
      sendJson(response, 401, { ok: false, error: "Pareamento necessario." });
      return;
    }

    const appItem = companionLibrary.apps.find((item) => item.id === decodeURIComponent(appLaunchMatch[1]));

    if (!appItem) {
      sendJson(response, 404, { ok: false, error: "App nao encontrado." });
      return;
    }

    await launchCompanionItem(appItem, "app");

    sendJson(response, 200, { ok: true, launched: appItem.name });
    return;
  }

  const actionMatch = parsedUrl.pathname.match(/^\/api\/actions\/([^/]+)$/);

  if (actionMatch && request.method === "POST") {
    if (!isCompanionRequestAuthorized(request, parsedUrl)) {
      sendJson(response, 401, { ok: false, error: "Pareamento necessario." });
      return;
    }

    await handleCompanionAction(actionMatch[1], response);
    return;
  }

  const mediaMatch = parsedUrl.pathname.match(/^\/api\/media\/([^/]+)$/);

  if (mediaMatch && request.method === "GET") {
    if (!isCompanionRequestAuthorized(request, parsedUrl)) {
      sendJson(response, 401, { ok: false, error: "Pareamento necessario." });
      return;
    }

    await serveCompanionMedia(decodeURIComponent(mediaMatch[1]), response);
    return;
  }

  sendJson(response, 404, { ok: false, error: "Rota nao encontrada." });
}

async function serveCompanionStatic(pathname, response) {
  const staticRoots = [
    path.join(__dirname, "mobile-app", "www"),
    path.join(__dirname, "mobile")
  ];
  const requestedPath = pathname === "/"
    ? "index.html"
    : decodeURIComponent(String(pathname || "").replace(/^\/+/, ""));

  if (!isCompanionStaticAsset(requestedPath)) {
    return false;
  }

  for (const root of staticRoots) {
    const filePath = path.resolve(root, requestedPath);

    if (!isPathInsideDirectory(filePath, root)) {
      continue;
    }

    try {
      const stats = await fs.stat(filePath);

      if (!stats.isFile()) {
        continue;
      }

      const data = await fs.readFile(filePath);
      response.writeHead(200, {
        "Content-Type": getContentType(filePath),
        "Cache-Control": requestedPath.startsWith("assets/") ? "public, max-age=86400" : "no-store"
      });
      response.end(data);
      return true;
    } catch {
      // Try the legacy mobile folder.
    }
  }

  sendJson(response, 404, { ok: false, error: "Arquivo mobile nao encontrado." });
  return true;
}

function isCompanionStaticAsset(requestedPath) {
  if (!requestedPath || requestedPath.includes("\0")) {
    return false;
  }

  const normalized = requestedPath.replace(/\\/g, "/");

  if (normalized.includes("../") || normalized.startsWith("/")) {
    return false;
  }

  return [".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico"]
    .includes(path.extname(normalized).toLowerCase());
}

function isPathInsideDirectory(childPath, parentPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));

  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

async function serveCompanionMedia(token, response) {
  const source = companionMediaSources.get(token);
  const mediaPath = source ? resolveCompanionMediaPath(source) : "";

  if (!mediaPath) {
    sendJson(response, 404, { ok: false, error: "Midia nao encontrada." });
    return;
  }

  try {
    const stats = await fs.stat(mediaPath);

    if (!stats.isFile()) {
      sendJson(response, 404, { ok: false, error: "Midia invalida." });
      return;
    }

    const data = await fs.readFile(mediaPath);
    response.writeHead(200, {
      "Content-Type": getContentType(mediaPath),
      "Content-Length": data.length,
      "Cache-Control": "private, max-age=3600"
    });
    response.end(data);
  } catch {
    sendJson(response, 404, { ok: false, error: "Midia nao encontrada." });
  }
}

function getCompanionStatus(options = {}) {
  const includePin = options.includePin !== false;
  const includeWakeProfile = options.includeWakeProfile !== false;
  const urls = getCompanionUrls();
  const wakeProfile = includeWakeProfile ? getWakeProfile() : null;

  return {
    ok: true,
    running: !!companionServer,
    app: "MOB Deck",
    port: companionPort || companionDefaultPort,
    pinRequired: false,
    pairingRequired: true,
    pin: undefined,
    pairingToken: options.includePairingToken ? companionPin : undefined,
    primaryUrl: urls[0] || `http://localhost:${companionPort || companionDefaultPort}`,
    localhostUrl: `http://localhost:${companionPort || companionDefaultPort}`,
    urls,
    gameCount: companionLibrary.games.length,
    appCount: companionLibrary.apps.length,
    wakeProfile: wakeProfile || undefined,
    startup: getStartupSettings(),
    savedAt: companionLibrary.savedAt || null
  };
}

function getWakeProfile() {
  const profile = getNetworkProfile({
    port: companionPort || companionDefaultPort,
    serverRunning: !!companionServer
  });

  console.log(`[MOB Deck] Perfil WoL: ${profile.computerName} ${profile.ipAddress || "sem-ip"} ${profile.macAddress || "sem-mac"}`);

  return profile;
}

async function getPairingQr() {
  const deepLink = getPairingDeepLink();
  const svg = await QRCode.toString(deepLink, {
    type: "svg",
    margin: 1,
    width: 340,
    color: {
      dark: "#10151A",
      light: "#FFFFFF"
    }
  });

  return {
    ok: true,
    deepLink,
    svg,
    wakeProfile: getWakeProfile()
  };
}

function getPairingDeepLink() {
  const profile = getWakeProfile();
  const params = new URLSearchParams();
  const serverUrl = profile.primaryUrl || getCompanionStatus({ includePin: false, includeWakeProfile: false }).primaryUrl;

  params.set("server", serverUrl || "");
  params.set("token", companionPin || "");
  params.set("computer", profile.computerName || "");
  params.set("ip", profile.ipAddress || "");
  params.set("mac", profile.macAddress || "");
  params.set("broadcast", profile.broadcastAddress || "255.255.255.255");
  params.set("port", String(profile.port || companionDefaultPort));

  return `moblauncher://pair?${params.toString()}`;
}

function getStartupSettings() {
  try {
    const settings = app.getLoginItemSettings();

    return {
      supported: process.platform === "win32" || process.platform === "darwin",
      openAtLogin: !!settings.openAtLogin,
      openAsHidden: !!settings.openAsHidden
    };
  } catch (error) {
    return {
      supported: false,
      openAtLogin: false,
      openAsHidden: false,
      error: error.message || String(error)
    };
  }
}

function setStartWithWindows(enabled) {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: enabled
    });

    console.log(`[MOB Deck] Inicializacao com Windows ${enabled ? "ativada" : "desativada"}.`);

    return getStartupSettings();
  } catch (error) {
    console.error("[MOB Deck] Nao foi possivel alterar inicializacao com Windows:");
    console.error(error);

    return {
      ...getStartupSettings(),
      error: error.message || String(error)
    };
  }
}

async function loadLaunchProfiles() {
  try {
    const raw = await fs.readFile(getLaunchProfilesPath(), "utf8");
    const parsed = JSON.parse(raw);
    const profiles = Array.isArray(parsed?.profiles) ? parsed.profiles : Array.isArray(parsed) ? parsed : [];

    return {
      ok: true,
      profiles: profiles.map(sanitizeLaunchProfile).filter(Boolean)
    };
  } catch {
    return {
      ok: true,
      profiles: []
    };
  }
}

async function saveLaunchProfile(profile) {
  const cleanProfile = sanitizeLaunchProfile(profile);

  if (!cleanProfile) {
    throw new Error("Perfil invalido.");
  }

  const current = await loadLaunchProfiles();
  const profiles = (current.profiles || []).filter((item) => item.itemKey !== cleanProfile.itemKey);

  if (cleanProfile.enabled || hasProfileContent(cleanProfile)) {
    profiles.push(cleanProfile);
  }

  await fs.mkdir(path.dirname(getLaunchProfilesPath()), { recursive: true });
  await fs.writeFile(getLaunchProfilesPath(), JSON.stringify({
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    profiles
  }, null, 2));

  return {
    ok: true,
    profile: cleanProfile,
    profiles
  };
}

function sanitizeLaunchProfile(profile) {
  const itemKey = optionalString(profile?.itemKey);

  if (!itemKey) {
    return null;
  }

  const launchMode = ["auto", "launcher", "direct"].includes(profile?.launchMode)
    ? profile.launchMode
    : "auto";

  return {
    itemKey,
    enabled: !!profile?.enabled,
    launchMode,
    minimizeOnLaunch: profile?.minimizeOnLaunch !== false,
    preActions: sanitizeProfileActions(profile?.preActions),
    postActions: sanitizeProfileActions(profile?.postActions),
    collections: Array.isArray(profile?.collections)
      ? profile.collections.map(optionalString).filter(Boolean).slice(0, 12)
      : []
  };
}

function sanitizeProfileActions(actions) {
  return (Array.isArray(actions) ? actions : [])
    .map((action) => {
      const type = optionalString(action?.type);

      if (!type) {
        return null;
      }

      if (type === "openApp") {
        const target = sanitizeProfileLaunchTarget(action.target);

        return target ? { type, target } : null;
      }

      if (type === "closeProcess") {
        const processName = sanitizeProcessName(action.processName);

        return processName ? { type, processName } : null;
      }

      if (type === "powerPlan") {
        const plan = sanitizePowerPlan(action.plan);

        return plan ? { type, plan } : null;
      }

      if (type === "delay") {
        const ms = Math.max(0, Math.min(Number(action.ms || 0), 60000));

        return ms ? { type, ms } : null;
      }

      if (type === "restorePowerPlan") {
        return { type };
      }

      return null;
    })
    .filter(Boolean)
    .slice(0, 20);
}

function sanitizeProfileLaunchTarget(target) {
  if (!target || typeof target !== "object") {
    return null;
  }

  const name = optionalString(target.name) || "App";
  const exe = optionalString(target.exe);
  const launchUri = optionalString(target.launchUri);
  const appId = optionalString(target.appId);

  if (!exe && !launchUri && !appId && !target.steamAppId) {
    return null;
  }

  return {
    name,
    exe,
    launchUri,
    appId,
    fallbackLaunchUri: optionalString(target.fallbackLaunchUri),
    provider: optionalString(target.provider),
    sourceId: optionalString(target.sourceId),
    steamAppId: optionalString(target.steamAppId),
    gogAppId: optionalString(target.gogAppId),
    epicNamespace: optionalString(target.epicNamespace),
    epicCatalogItemId: optionalString(target.epicCatalogItemId)
  };
}

function hasProfileContent(profile) {
  return !!(
    profile.preActions.length
    || profile.postActions.length
    || profile.collections.length
    || profile.launchMode !== "auto"
    || profile.minimizeOnLaunch === false
  );
}

async function launchWithProfile(target, profile) {
  const cleanProfile = sanitizeLaunchProfile(profile) || {
    itemKey: "temporary",
    enabled: false,
    launchMode: "auto",
    minimizeOnLaunch: target?.minimizeOnLaunch !== false,
    preActions: [],
    postActions: [],
    collections: []
  };
  const launchTargetWithMode = applyLaunchModeToTarget(target, cleanProfile);
  let originalPowerScheme = null;

  if (cleanProfile.enabled) {
    for (const action of cleanProfile.preActions) {
      if (action.type === "powerPlan" && !originalPowerScheme) {
        originalPowerScheme = await getActivePowerScheme();
      }

      await runLaunchProfileAction(action);
    }
  }

  const launched = await launchTarget({
    ...launchTargetWithMode,
    minimizeOnLaunch: cleanProfile.minimizeOnLaunch
  });

  if (cleanProfile.enabled) {
    for (const action of cleanProfile.postActions) {
      await runLaunchProfileAction(action, { originalPowerScheme });
    }
  }

  return {
    ok: true,
    launched
  };
}

function applyLaunchModeToTarget(target, profile) {
  const next = normalizeLaunchTarget(target);

  if (profile.launchMode === "direct") {
    return {
      ...next,
      launchUri: null,
      fallbackLaunchUri: null,
      appId: isProtocolUri(next.appId) ? null : next.appId,
      steamAppId: null,
      sourceId: next.provider === "steam" || next.provider === "epic" || next.provider === "gog" ? null : next.sourceId
    };
  }

  return next;
}

async function runLaunchProfileAction(action, context = {}) {
  if (!action?.type) {
    return;
  }

  if (action.type === "openApp") {
    await launchTarget({ ...action.target, minimizeOnLaunch: false });
    return;
  }

  if (action.type === "closeProcess") {
    await closeProcessSoftly(action.processName);
    return;
  }

  if (action.type === "powerPlan") {
    await setPowerPlan(action.plan);
    return;
  }

  if (action.type === "delay") {
    await delay(action.ms);
    return;
  }

  if (action.type === "restorePowerPlan" && context.originalPowerScheme) {
    await delay(3000);
    await setPowerPlan(context.originalPowerScheme);
  }
}

function sanitizeProcessName(value) {
  const text = path.basename(String(value || "").trim().replace(/^"|"$/g, ""));

  if (!/^[\w .-]+(?:\.exe)?$/i.test(text)) {
    return "";
  }

  const name = text.toLowerCase().endsWith(".exe") ? text : `${text}.exe`;
  const blocked = new Set([
    "csrss.exe", "dwm.exe", "lsass.exe", "services.exe", "smss.exe",
    "svchost.exe", "system.exe", "taskhostw.exe", "wininit.exe",
    "winlogon.exe", "registry.exe"
  ]);

  return blocked.has(name.toLowerCase()) ? "" : name;
}

async function closeProcessSoftly(processName) {
  if (process.platform !== "win32") {
    throw new Error("Fechar processo automaticamente esta disponivel apenas no Windows.");
  }

  const safeName = sanitizeProcessName(processName);

  if (!safeName) {
    throw new Error("Nome de processo invalido ou protegido.");
  }

  await runCommand("taskkill.exe", ["/IM", safeName, "/T"], { ignoreExitCode: true });
}

function sanitizePowerPlan(value) {
  const aliases = {
    balanced: "SCHEME_BALANCED",
    high: "SCHEME_MIN",
    "high-performance": "SCHEME_MIN",
    saver: "SCHEME_MAX",
    "power-saver": "SCHEME_MAX"
  };
  const text = optionalString(value);

  if (!text) {
    return "";
  }

  return aliases[text] || text;
}

async function getActivePowerScheme() {
  if (process.platform !== "win32") {
    return null;
  }

  try {
    const result = await runCommand("powercfg.exe", ["/GETACTIVESCHEME"], { ignoreExitCode: true });
    const match = result.stdout.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);

    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function setPowerPlan(plan) {
  if (process.platform !== "win32") {
    throw new Error("Plano de energia esta disponivel apenas no Windows.");
  }

  const scheme = sanitizePowerPlan(plan);

  if (!scheme) {
    return;
  }

  await runCommand("powercfg.exe", ["/S", scheme]);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms || 0))));
}

async function getDiagnostics(options = {}) {
  const includeSensitivePaths = options.includeSensitivePaths !== false;
  const status = getCompanionStatus({ includePin: false, includeWakeProfile: true });
  const [drives, launchers, powerScheme] = await Promise.all([
    getDriveDiagnostics(),
    getLauncherDiagnostics(),
    getActivePowerScheme()
  ]);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    companion: status,
    library: {
      games: companionLibrary.games.length,
      apps: companionLibrary.apps.length,
      savedAt: companionLibrary.savedAt || null
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      computerName: os.hostname(),
      uptimeSeconds: Math.round(os.uptime()),
      totalMemoryBytes: os.totalmem(),
      freeMemoryBytes: os.freemem(),
      powerScheme
    },
    drives,
    launchers,
    paths: includeSensitivePaths ? {
      userData: app.getPath("userData"),
      profiles: getLaunchProfilesPath(),
      companionLibrary: getCompanionLibraryPath()
    } : undefined
  };
}

async function getDriveDiagnostics() {
  if (process.platform !== "win32") {
    return [];
  }

  try {
    const result = await runCommand("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-Command",
      "Get-CimInstance Win32_LogicalDisk -Filter \"DriveType=3\" | Select-Object DeviceID,FreeSpace,Size | ConvertTo-Json -Compress"
    ], { ignoreExitCode: true });
    const parsed = JSON.parse(result.stdout || "[]");

    return (Array.isArray(parsed) ? parsed : [parsed]).map((drive) => ({
      name: drive.DeviceID,
      freeBytes: Number(drive.FreeSpace || 0),
      sizeBytes: Number(drive.Size || 0)
    }));
  } catch {
    return [];
  }
}

async function getLauncherDiagnostics() {
  const checks = [
    ["Steam", path.join(process.env.ProgramFiles || "C:\\Program Files", "Steam", "steam.exe")],
    ["Epic Games", path.join(process.env.ProgramFiles || "C:\\Program Files", "Epic Games", "Launcher", "Portal", "Binaries", "Win64", "EpicGamesLauncher.exe")],
    ["GOG Galaxy", path.join(process.env.ProgramFilesX86 || "C:\\Program Files (x86)", "GOG Galaxy", "GalaxyClient.exe")]
  ];

  const launchers = [];

  for (const [name, targetPath] of checks) {
    launchers.push({
      name,
      installed: await fileExists(targetPath)
    });
  }

  return launchers;
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function exportUserData(payload = {}) {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Exportar backup do MOB Deck",
    defaultPath: `mob-deck-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: "Backup MOB Deck", extensions: ["json"] }]
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }

  const profiles = await loadLaunchProfiles();
  const backup = {
    schemaVersion: 1,
    app: "MOB Deck",
    exportedAt: new Date().toISOString(),
    renderer: payload || {},
    companionLibrary,
    launchProfiles: profiles.profiles || []
  };

  await fs.writeFile(result.filePath, JSON.stringify(backup, null, 2), "utf8");

  return {
    ok: true,
    filePath: result.filePath
  };
}

async function importUserData() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Importar backup do MOB Deck",
    properties: ["openFile"],
    filters: [{ name: "Backup MOB Deck", extensions: ["json"] }]
  });

  if (result.canceled || !result.filePaths?.[0]) {
    return { ok: false, canceled: true };
  }

  const raw = await fs.readFile(result.filePaths[0], "utf8");
  const backup = JSON.parse(raw);
  const profiles = Array.isArray(backup?.launchProfiles) ? backup.launchProfiles.map(sanitizeLaunchProfile).filter(Boolean) : [];

  if (profiles.length) {
    await fs.mkdir(path.dirname(getLaunchProfilesPath()), { recursive: true });
    await fs.writeFile(getLaunchProfilesPath(), JSON.stringify({
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      profiles
    }, null, 2));
  }

  if (backup?.companionLibrary) {
    companionLibrary = sanitizeCompanionLibrary(backup.companionLibrary);
    await saveCompanionLibrary();
  }

  return {
    ok: true,
    filePath: result.filePaths[0],
    renderer: backup?.renderer || {},
    launchProfiles: profiles,
    companionLibrary
  };
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code && !options.ignoreExitCode) {
        reject(new Error(stderr.trim() || `${command} saiu com codigo ${code}.`));
        return;
      }

      resolve({ code, stdout, stderr });
    });
  });
}

function getCompanionUrls() {
  const port = companionPort || companionDefaultPort;
  const addresses = [];
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }

  const uniqueAddresses = [...new Set(addresses)].sort((a, b) => {
    const aPrivate = isPrivateNetworkAddress(a);
    const bPrivate = isPrivateNetworkAddress(b);

    return Number(bPrivate) - Number(aPrivate);
  });

  return uniqueAddresses.length
    ? uniqueAddresses.map((address) => `http://${address}:${port}`)
    : [`http://127.0.0.1:${port}`];
}

function isPrivateNetworkAddress(address) {
  return /^10\./.test(address)
    || /^192\.168\./.test(address)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(address);
}

function sanitizeCompanionLibrary(snapshot) {
  const games = Array.isArray(snapshot?.games) ? snapshot.games : [];
  const apps = Array.isArray(snapshot?.apps) ? snapshot.apps : [];
  const sanitizedGames = games.map(sanitizeCompanionGame).filter(Boolean);
  const movedApps = sanitizedGames.map(createCompanionAppFromGameIfNeeded).filter(Boolean);
  const sanitizedApps = [
    ...apps.map(sanitizeCompanionGame).filter(Boolean),
    ...movedApps
  ];

  return {
    games: sanitizedGames.filter((game) => !isNonGameLibraryItem(game)),
    apps: dedupeCompanionApps(sanitizedApps),
    savedAt: snapshot?.savedAt || null,
    source: snapshot?.lastAction || null
  };
}

function sanitizeCompanionGame(game) {
  const name = String(game?.name || "").trim();

  if (!name) {
    return null;
  }

  return {
    id: createCompanionGameId(game),
    name,
    exe: optionalString(game.exe),
    target: optionalString(game.target),
    iconTarget: optionalString(game.iconTarget),
    folder: optionalString(game.folder),
    provider: optionalString(game.provider) || "local",
    sourceId: optionalString(game.sourceId),
    steamAppId: optionalString(game.steamAppId),
    gogAppId: optionalString(game.gogAppId),
    launchUri: optionalString(game.launchUri),
    fallbackLaunchUri: optionalString(game.fallbackLaunchUri),
    epicNamespace: optionalString(game.epicNamespace),
    epicCatalogItemId: optionalString(game.epicCatalogItemId),
    cover: optionalString(game.cover),
    fallbackCover: optionalString(game.fallbackCover),
    icon: optionalString(game.icon),
    coverSources: Array.isArray(game.coverSources) ? game.coverSources.map(optionalString).filter(Boolean) : [],
    categoryName: optionalString(game.categoryName),
    appCategoryName: optionalString(game.appCategoryName),
    summary: optionalString(game.summary),
    website: optionalString(game.website),
    appId: optionalString(game.appId),
    appCatalogId: optionalString(game.appCatalogId),
    appCategoryId: optionalString(game.appCategoryId),
    sizeBytes: Number(game.sizeBytes || 0) || null,
    lastPlayedAt: optionalString(game.lastPlayedAt),
    launchCount: Number(game.launchCount || 0) || 0
  };
}

function dedupeCompanionApps(apps) {
  const byKey = new Map();

  for (const appItem of apps) {
    const key = appItem.appCatalogId || normalizeTitle(appItem.name) || appItem.id;

    if (!key) {
      continue;
    }

    if (!byKey.has(key)) {
      byKey.set(key, appItem);
    }
  }

  return [...byKey.values()];
}

function isNonGameLibraryItem(game) {
  if (getAppLikeGameRule(game)) {
    return true;
  }

  const steamAppId = String(game?.steamAppId || game?.sourceId || "").trim();

  if (steamAppId && nonGameSteamAppIds.has(steamAppId)) {
    return true;
  }

  const text = normalizeTitle([
    game?.name,
    game?.exe,
    game?.folder,
    game?.launchUri
  ].filter(Boolean).join(" "));

  return nonGameGameWords.some((word) => text.includes(normalizeTitle(word)));
}

function createCompanionAppFromGameIfNeeded(game) {
  const rule = getAppLikeGameRule(game);

  if (!rule) {
    return null;
  }

  return sanitizeCompanionGame({
    ...game,
    name: rule.name,
    provider: "app",
    category: "app",
    appCatalogId: rule.appCatalogId,
    appCategoryId: rule.appCategoryId,
    appCategoryName: rule.appCategoryName,
    categoryName: rule.appCategoryName,
    summary: rule.summary,
    website: rule.website,
    appId: game.launchUri || game.appId || null
  });
}

function getAppLikeGameRule(game) {
  const ids = [
    game?.steamAppId,
    game?.sourceId
  ].map((value) => String(value || "").trim()).filter(Boolean);
  const text = normalizeTitle([
    game?.name,
    game?.exe,
    game?.folder,
    game?.launchUri
  ].filter(Boolean).join(" "));

  return appLikeGameRules.find((rule) => {
    if (rule.steamAppId && ids.includes(rule.steamAppId)) {
      return true;
    }

    return rule.names.some((name) => text.includes(normalizeTitle(name)));
  }) || null;
}

function optionalString(value) {
  const text = String(value || "").trim();

  return text || null;
}

function createCompanionGameId(game) {
  const raw = [
    game?.steamAppId && `steam:${game.steamAppId}`,
    game?.gogAppId && `gog:${game.gogAppId}`,
    game?.sourceId && `${game.provider || "source"}:${game.sourceId}`,
    game?.launchUri,
    game?.exe,
    game?.folder,
    game?.name
  ].filter(Boolean).join("|");

  return hashString(raw || String(game?.name || "game"));
}

function getCompanionGamesForResponse(pin) {
  return companionLibrary.games.map((game) => ({
    id: game.id,
    name: game.name,
    provider: formatProviderName(game.provider),
    coverUrl: getCompanionCoverUrl(game, pin),
    sizeBytes: game.sizeBytes,
    lastPlayedAt: game.lastPlayedAt,
    launchCount: game.launchCount,
    canLaunch: !!(game.exe || game.launchUri || game.steamAppId)
  }));
}

function getCompanionAppsForResponse(pin) {
  return companionLibrary.apps.map((appItem) => ({
    id: appItem.id,
    name: appItem.name,
    provider: formatProviderName(appItem.provider),
    categoryName: appItem.appCategoryName || appItem.categoryName || "App",
    summary: appItem.summary,
    iconUrl: getCompanionAppIconUrl(appItem, pin),
    lastPlayedAt: appItem.lastPlayedAt,
    launchCount: appItem.launchCount,
    canLaunch: !!(appItem.exe || appItem.launchUri || appItem.appId)
  }));
}

async function launchCompanionItem(item, kind) {
  await launchTarget({
    ...item,
    minimizeOnLaunch: true
  });

  item.lastPlayedAt = new Date().toISOString();
  item.launchCount = Number(item.launchCount || 0) + 1;
  companionLibrary.savedAt = new Date().toISOString();
  await saveCompanionLibrary();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("companion-game-launched", {
      id: item.id,
      kind,
      name: item.name
    });
  }
}

async function handleCompanionAction(action, response) {
  if (action === "lock-pc") {
    await lockPc();
    sendJson(response, 200, { ok: true, action, message: "PC bloqueado." });
    return;
  }

  if (action === "sleep-pc") {
    await sleepPc();
    sendJson(response, 200, { ok: true, action, message: "Suspensao solicitada." });
    return;
  }

  if (action === "restart-pc") {
    await restartPcSafely();
    sendJson(response, 200, {
      ok: true,
      action,
      message: "Reinicio agendado com 30 segundos de seguranca.",
      delaySeconds: 30
    });
    return;
  }

  if (action === "shutdown-pc") {
    await shutdownPcSafely();
    sendJson(response, 200, {
      ok: true,
      action,
      message: "Desligamento agendado com 30 segundos de seguranca.",
      delaySeconds: 30
    });
    return;
  }

  if (action === "volume-up" || action === "volume-down" || action === "volume-mute") {
    await sendMediaKey(action);
    sendJson(response, 200, { ok: true, action, message: "Comando de volume enviado." });
    return;
  }

  if (action === "refresh-library") {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("companion-refresh-requested");
    }

    sendJson(response, 200, { ok: true, action, message: "Atualizacao solicitada no desktop." });
    return;
  }

  if (action === "steam-big-picture") {
    await shell.openExternal("steam://open/bigpicture");
    sendJson(response, 200, { ok: true, action, message: "Steam Big Picture solicitado." });
    return;
  }

  if (action === "start-stream") {
    await shell.openExternal("steam://open/remoteplay");
    sendJson(response, 200, { ok: true, action, message: "Steam Remote Play solicitado." });
    return;
  }

  if (action === "game-mode") {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("companion-refresh-requested");
    }

    sendJson(response, 200, {
      ok: true,
      action,
      message: "Modo jogo solicitado. Use o jogo padrao salvo no mobile para abrir em seguida."
    });
    return;
  }

  sendJson(response, 404, {
    ok: false,
    action,
    error: "Acao nao encontrada."
  });
}

async function lockPc() {
  if (process.platform !== "win32") {
    throw new Error("Bloqueio remoto esta disponivel apenas no Windows.");
  }

  const child = spawn("rundll32.exe", ["user32.dll,LockWorkStation"], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });

  child.unref();
}

async function sleepPc() {
  if (process.platform !== "win32") {
    throw new Error("Suspensao remota esta disponivel apenas no Windows.");
  }

  const child = spawn("rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });

  child.unref();
}

async function restartPcSafely() {
  if (process.platform !== "win32") {
    throw new Error("Reinicio remoto seguro esta disponivel apenas no Windows.");
  }

  const child = spawn("shutdown.exe", [
    "/r",
    "/t",
    "30",
    "/c",
    "MOB Deck Mobile solicitou reinicio seguro."
  ], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });

  child.unref();
}

async function shutdownPcSafely() {
  if (process.platform !== "win32") {
    throw new Error("Desligamento remoto seguro esta disponivel apenas no Windows.");
  }

  const child = spawn("shutdown.exe", [
    "/s",
    "/t",
    "30",
    "/c",
    "MOB Deck Mobile solicitou desligamento seguro."
  ], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });

  child.unref();
}

async function sendMediaKey(action) {
  if (process.platform !== "win32") {
    throw new Error("Controle de volume esta disponivel apenas no Windows.");
  }

  const keys = {
    "volume-up": "{VOLUME_UP}",
    "volume-down": "{VOLUME_DOWN}",
    "volume-mute": "{VOLUME_MUTE}"
  };

  await runCommand("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-Command",
    `$shell = New-Object -ComObject WScript.Shell; $shell.SendKeys('${keys[action]}')`
  ]);
}

function getCompanionCoverUrl(game, pin) {
  const sources = [
    game.icon,
    ...(Array.isArray(game.coverSources) ? game.coverSources : []),
    game.cover,
    game.fallbackCover
  ].filter(Boolean);

  for (const source of [...new Set(sources)]) {
    const url = getCompanionImageUrl(source, pin);

    if (url) {
      return url;
    }
  }

  return null;
}

function getCompanionAppIconUrl(appItem, pin) {
  return getCompanionCoverUrl(appItem, pin)
    || getCompanionBrandIconUrl(appItem)
    || getCompanionFaviconUrl(appItem);
}

function getCompanionBrandIconUrl(appItem) {
  const ids = [
    appItem?.appCatalogId,
    appItem?.id
  ].filter(Boolean);
  const slug = ids.map((id) => companionBrandIconSlugs[id]).find(Boolean);

  return slug ? `https://cdn.simpleicons.org/${encodeURIComponent(slug)}/ffffff` : null;
}

function getCompanionFaviconUrl(appItem) {
  const catalogItem = appItem?.appCatalogId ? findCatalogItem(appItem.appCatalogId) : null;
  const website = appItem?.website || catalogItem?.website;

  if (!website) {
    return null;
  }

  try {
    const url = new URL(website);

    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=256`;
  } catch {
    return null;
  }
}

function getCompanionImageUrl(source, pin) {
  const value = String(source || "").trim();

  if (!value) {
    return null;
  }

  if (/^(https?:|data:)/i.test(value)) {
    return value;
  }

  const mediaPath = resolveCompanionMediaPath(value);

  if (!mediaPath) {
    return null;
  }

  const token = crypto.createHash("sha1").update(mediaPath).digest("base64url");
  companionMediaSources.set(token, mediaPath);

  return `/api/media/${encodeURIComponent(token)}?token=${encodeURIComponent(pin || companionPin || "")}`;
}

function resolveCompanionMediaPath(source) {
  const value = String(source || "").trim();

  if (!value) {
    return "";
  }

  try {
    if (/^file:/i.test(value)) {
      return fileURLToPath(value);
    }
  } catch {
    return "";
  }

  const normalized = value.replace(/\//g, path.sep);

  if (/^[a-z]:\\/i.test(normalized) || path.isAbsolute(normalized)) {
    return normalized;
  }

  return path.join(__dirname, normalized);
}

function formatProviderName(provider) {
  const providers = {
    steam: "Steam",
    epic: "Epic Games",
    gog: "GOG",
    app: "App",
    launcher: "Launcher",
    detected: "Detectado",
    local: "Local",
    unknown: "Local"
  };

  return providers[String(provider || "unknown").toLowerCase()] || provider || "Local";
}

function isCompanionRequestAuthorized(request, parsedUrl) {
  return isValidCompanionPin(getRequestPin(request, parsedUrl));
}

function getRequestPin(request, parsedUrl) {
  const auth = String(request.headers.authorization || "");
  const bearer = auth.match(/^Bearer\s+(.+)$/i);

  return String(
    request.headers["x-mobdeck-token"]
    || request.headers["x-mobdeck-pin"]
    || (bearer ? bearer[1] : "")
    || parsedUrl.searchParams.get("token")
    || parsedUrl.searchParams.get("pin")
    || ""
  ).trim();
}

function isValidCompanionPin(pin) {
  const expected = String(companionPin || "");
  const received = String(pin || "");

  return !!expected && received === expected;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;

      if (size > 1024 * 1024) {
        reject(new Error("Corpo da requisicao muito grande."));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve({});
      }
    });

    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);

  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-MobDeck-Token, X-MobDeck-PIN");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
  };

  return types[ext] || "application/octet-stream";
}

async function getAvailableDriveRoots() {
  if (process.platform !== "win32") {
    return [path.parse(process.cwd()).root || "/"];
  }

  const roots = [];

  for (let code = 65; code <= 90; code++) {
    const root = `${String.fromCharCode(code)}:\\`;

    try {
      await fs.access(root);
      roots.push(root);
    } catch {
      // Drive letter is not available.
    }
  }

  return roots.length ? roots : [path.parse(process.cwd()).root];
}

async function scanFolders(folders) {
  const scanner = require("./src/scanner/scanner");
  const byGame = new Map();

  for (const folder of folders.filter(Boolean)) {
    const games = await scanner.scan(folder);

    for (const game of games) {
      const key = getGameKey(game);
      const existing = byGame.get(key);

      if (!existing || scoreGame(game) > scoreGame(existing)) {
        byGame.set(key, game);
      }
    }
  }

  const games = [...byGame.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  logGames(games);

  return games;
}

async function scanApps() {
  const appsScanner = require("./src/scanner/apps");

  return await appsScanner.scan();
}

async function getAppIcon(appItem) {
  if (!appItem?.exe || process.platform !== "win32") {
    return null;
  }

  const iconTargets = getIconTargets(appItem);

  if (!iconTargets.length) {
    return null;
  }

  const iconCacheFolder = path.join(app.getPath("userData"), "icon-cache");
  const cacheName = `${hashString([appItem.exe, ...iconTargets, "v3"].join("|"))}.png`;
  const cachePath = path.join(iconCacheFolder, cacheName);

  try {
    await fs.access(cachePath);
    return cachePath;
  } catch {
    // Icon is not cached yet.
  }

  await fs.mkdir(iconCacheFolder, { recursive: true });

  for (const iconTarget of iconTargets) {
    try {
      const image = await app.getFileIcon(iconTarget, { size: "large" });

      if (!image || image.isEmpty()) {
        continue;
      }

      const png = image.resize({ width: 256, height: 256, quality: "best" }).toPNG();
      await fs.writeFile(cachePath, png);

      return cachePath;
    } catch {
      // Try the next possible icon target.
    }
  }

  return null;
}

async function installCatalogApp(event, catalogId) {
  const item = findCatalogItem(catalogId);

  if (!item) {
    throw new Error("App nao encontrado no catalogo.");
  }

  if (process.platform !== "win32" || !item.wingetId) {
    await openTrustedExternalUrl(item.website);
    return {
      ok: true,
      mode: "website",
      appId: item.id
    };
  }

  return await runWingetInstall(event, item);
}

function runWingetInstall(event, item) {
  return new Promise((resolve) => {
    let lastPercent = 0;
    let finished = false;
    const args = [
      "install",
      "--id",
      item.wingetId,
      "--exact",
      "--accept-package-agreements",
      "--accept-source-agreements",
      "--disable-interactivity"
    ];

    emitInstallProgress(event, item.id, {
      percent: 0,
      status: "running",
      message: "Preparando instalacao..."
    });

    const child = spawn("winget", args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    const handleOutput = (chunk) => {
      const message = String(chunk || "").replace(/\u001b\[[0-9;]*m/g, "").trim();
      const percent = getProgressPercent(message);

      if (percent !== null) {
        lastPercent = Math.max(lastPercent, percent);
      }

      emitInstallProgress(event, item.id, {
        percent: lastPercent,
        status: "running",
        message: message || "Baixando e instalando..."
      });
    };

    child.stdout.on("data", handleOutput);
    child.stderr.on("data", handleOutput);

    child.on("error", async (error) => {
      if (finished) {
        return;
      }

      finished = true;
      emitInstallProgress(event, item.id, {
        percent: lastPercent,
        status: "failed",
        message: error.message || "WinGet nao conseguiu iniciar."
      });
      await openTrustedExternalUrl(item.website);
      resolve({
        ok: false,
        mode: "website",
        appId: item.id,
        error: error.message || String(error)
      });
    });

    child.on("close", async (code) => {
      if (finished) {
        return;
      }

      finished = true;

      if (code === 0) {
        emitInstallProgress(event, item.id, {
          percent: 100,
          status: "complete",
          message: "Instalado."
        });
        resolve({
          ok: true,
          mode: "winget",
          appId: item.id
        });
        return;
      }

      emitInstallProgress(event, item.id, {
        percent: lastPercent,
        status: "failed",
        message: "Nao foi possivel instalar pelo WinGet. Abrindo site..."
      });
      await openTrustedExternalUrl(item.website);
      resolve({
        ok: false,
        mode: "website",
        appId: item.id,
        error: `winget saiu com codigo ${code}`
      });
    });
  });
}

function emitInstallProgress(event, appId, payload) {
  const webContents = event?.sender;

  if (!webContents || webContents.isDestroyed()) {
    return;
  }

  webContents.send("app-install-progress", {
    appId,
    ...payload
  });
}

function getProgressPercent(message) {
  const match = String(message || "").match(/(\d{1,3})\s*%/);

  if (!match) {
    return null;
  }

  return Math.max(0, Math.min(100, Number(match[1])));
}

async function openTrustedExternalUrl(url) {
  const value = String(url || "");

  if (!/^https?:\/\//i.test(value)) {
    throw new Error("Link externo invalido.");
  }

  await shell.openExternal(value);
}

async function launchTarget(launchTarget) {
  const target = normalizeLaunchTarget(launchTarget);
  const shouldHideAfterLaunch = target.minimizeOnLaunch !== false;
  const launcherUris = getLauncherUris(target);
  const errors = [];

  for (const uri of launcherUris) {
    try {
      await shell.openExternal(uri);
      if (shouldHideAfterLaunch) {
        hideMainWindowToTray();
      }
      return true;
    } catch (error) {
      errors.push(error.message || String(error));
    }
  }

  if (!target.exe) {
    throw new Error(errors[0] || "Caminho do executavel nao informado.");
  }

  const opened = await openExecutableTarget(target.exe);

  if (opened && shouldHideAfterLaunch) {
    hideMainWindowToTray();
  }

  return opened;
}

function normalizeLaunchTarget(target) {
  if (typeof target === "string") {
    return { exe: target };
  }

  return target && typeof target === "object" ? target : {};
}

function getLauncherUris(target) {
  const uris = [];
  const provider = String(target.provider || "").toLowerCase();

  if (target.steamAppId) {
    uris.push(`steam://rungameid/${target.steamAppId}`);
  }

  if (isProtocolUri(target.launchUri)) {
    uris.push(target.launchUri);
  }

  if (isProtocolUri(target.fallbackLaunchUri)) {
    uris.push(target.fallbackLaunchUri);
  }

  if (provider === "steam" && target.sourceId) {
    uris.push(`steam://rungameid/${target.sourceId}`);
  }

  if (provider === "epic" && target.sourceId) {
    if (target.epicNamespace && target.epicCatalogItemId) {
      uris.push(
        `com.epicgames.launcher://apps/${encodeURIComponent(target.epicNamespace)}%3A${encodeURIComponent(target.epicCatalogItemId)}%3A${encodeURIComponent(target.sourceId)}?action=launch&silent=true`
      );
    }

    uris.push(`com.epicgames.launcher://apps/${encodeURIComponent(target.sourceId)}?action=launch&silent=true`);
  }

  if (provider === "gog" && (target.gogAppId || target.sourceId)) {
    uris.push(`goggalaxy://launchGame/${encodeURIComponent(target.gogAppId || target.sourceId)}`);
  }

  if (isProtocolUri(target.appId)) {
    uris.push(target.appId);
  }

  if (isProtocolUri(target.exe)) {
    uris.push(target.exe);
  }

  return [...new Set(uris.filter(Boolean))];
}

async function openExecutableTarget(exePath) {
  const value = String(exePath || "");

  if (!value) {
    throw new Error("Caminho do executavel nao informado.");
  }

  if (value.startsWith("shell:AppsFolder\\")) {
    const child = spawn("explorer.exe", [value], {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });

    child.unref();
    return true;
  }

  if (isProtocolUri(value)) {
    await shell.openExternal(value);
    return true;
  }

  const result = await shell.openPath(value);

  if (result !== "") {
    throw new Error(result);
  }

  return true;
}

function isProtocolUri(value) {
  const text = String(value || "");

  if (text.startsWith("shell:AppsFolder\\")) {
    return false;
  }

  return /^[a-z][a-z0-9+.-]*:/i.test(text) && !/^[a-z]:\\/i.test(text);
}

function getIconTargets(appItem) {
  const targets = [];
  const exe = String(appItem?.exe || "");

  addIconTarget(targets, appItem?.iconTarget);
  addIconTarget(targets, appItem?.target);

  if (!exe || exe.startsWith("shell:AppsFolder\\") || isProtocolUri(exe)) {
    return [...new Set(targets)];
  }

  if (path.extname(exe).toLowerCase() !== ".lnk") {
    addIconTarget(targets, exe);
    return [...new Set(targets)];
  }

  try {
    const shortcut = shell.readShortcutLink(exe);

    addIconTarget(targets, shortcut.icon);
    addIconTarget(targets, shortcut.target);
  } catch {
    // Fall through to the shortcut itself.
  }

  addIconTarget(targets, exe);

  return [...new Set(targets)];
}

function addIconTarget(targets, value) {
  const target = cleanIconTarget(value);

  if (target && !isProtocolUri(target) && !target.startsWith("shell:AppsFolder\\")) {
    targets.push(target);
  }
}

function cleanIconTarget(value) {
  const text = String(value || "").trim().replace(/^"|"$/g, "");
  const iconIndexMatch = text.match(/^(.+?\.(?:exe|ico|dll)),\d+$/i);

  return iconIndexMatch ? iconIndexMatch[1] : text;
}

function mergeGamesWithAppLaunchers(games, apps) {
  const byKey = new Map();
  const gameNames = new Set();

  for (const game of games) {
    byKey.set(getGameKey(game), game);
    gameNames.add(normalizeTitle(game.name));
  }

  for (const appItem of apps.filter((app) => app.category === "game")) {
    if (gameNames.has(normalizeTitle(appItem.name))) {
      continue;
    }

    const game = {
      ...appItem,
      provider: appItem.provider === "app" ? "launcher" : appItem.provider,
      reasons: ["app-launcher"]
    };
    const key = getGameKey(game);

    if (!byKey.has(key)) {
      byKey.set(key, game);
    }
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function normalizeTitle(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getGameKey(game) {
  const value = game?.folder || game?.exe || game?.name || "";

  return path.resolve(String(value)).toLowerCase();
}

function scoreGame(game) {
  return Number(game?.confidence || 0)
    + (game?.cover ? 10 : 0)
    + (game?.fallbackCover ? 4 : 0)
    + (Array.isArray(game?.coverSources) ? game.coverSources.length : 0);
}

function logGames(games) {
  console.log("\n===== JOGOS ENCONTRADOS =====");

  for (const game of games) {
    console.log({
      name: game.name,
      exe: game.exe,
      cover: game.cover,
      provider: game.provider,
      confidence: game.confidence
    });
  }

  console.log("=============================\n");
}

function hashString(value) {
  let hash = 0;
  const text = String(value || "");

  for (let index = 0; index < text.length; index++) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
}
