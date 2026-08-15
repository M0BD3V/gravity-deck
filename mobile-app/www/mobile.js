import { createDesktopClient, normalizeServerUrl, resolveMediaUrl } from "./js/desktopClient.js";
import { consumeDeepLink, onNativeDeepLink, scanQrCode, secureStorage } from "./js/nativeBridge.js";
import { handleDeepLink } from "./js/deepLinks.js";
import { createLauncherActions } from "./js/launcherActions.js";
import { loadWakeConfig, markConnectedNow, saveWakeConfig, saveWakeProfile, wakePc } from "./js/wakeLan.js";

const storageKeys = {
  serverUrl: "serverUrl",
  token: "token",
  cachedLibrary: "mobdeck:cachedLibrary"
};

const state = {
  serverUrl: "",
  token: "",
  activeTab: "games",
  connectionStatus: "offline",
  startup: null,
  diagnostics: null,
  games: [],
  apps: [],
  wakeConfig: {
    mac: "",
    broadcast: "255.255.255.255",
    port: "9",
    defaultGame: ""
  }
};

const elements = {
  connectionState: document.getElementById("connectionState"),
  pairPanel: document.getElementById("pairPanel"),
  pairForm: document.getElementById("pairForm"),
  serverInput: document.getElementById("serverInput"),
  pinInput: document.getElementById("pinInput"),
  pairMessage: document.getElementById("pairMessage"),
  scanQrButton: document.getElementById("scanQrButton"),
  libraryPanel: document.getElementById("libraryPanel"),
  libraryTitle: document.getElementById("libraryTitle"),
  gamesList: document.getElementById("gamesList"),
  appsList: document.getElementById("appsList"),
  actionsPanel: document.getElementById("actionsPanel"),
  diagnosticsPanel: document.getElementById("diagnosticsPanel"),
  offlineWakeButton: document.getElementById("offlineWakeButton"),
  emptyState: document.getElementById("emptyState"),
  actionMessage: document.getElementById("actionMessage"),
  refreshButton: document.getElementById("refreshButton"),
  changePcButton: document.getElementById("changePcButton"),
  settingsButton: document.getElementById("settingsButton"),
  startupToggle: document.getElementById("startupToggle"),
  wakeForm: document.getElementById("wakeForm"),
  macInput: document.getElementById("macInput"),
  broadcastInput: document.getElementById("broadcastInput"),
  wolPortInput: document.getElementById("wolPortInput"),
  defaultGameSelect: document.getElementById("defaultGameSelect"),
  diagStatus: document.getElementById("diagStatus"),
  diagComputer: document.getElementById("diagComputer"),
  diagIp: document.getElementById("diagIp"),
  diagMac: document.getElementById("diagMac"),
  diagLastConnected: document.getElementById("diagLastConnected"),
  diagLastWake: document.getElementById("diagLastWake"),
  diagLibrary: document.getElementById("diagLibrary"),
  diagMemory: document.getElementById("diagMemory"),
  diagDrives: document.getElementById("diagDrives"),
  diagLaunchers: document.getElementById("diagLaunchers")
};

const desktop = createDesktopClient(() => ({
  serverUrl: state.serverUrl,
  token: state.token
}));

const actions = createLauncherActions({
  desktop,
  getState: () => state,
  wakePc: () => wakePc(state.wakeConfig),
  setMessage,
  refreshLibrary
});

actions.pairFromQr = pairFromQr;

bindEvents();
init();

async function init() {
  await loadStoredSession();
  loadCachedLibrary();
  state.wakeConfig = await loadWakeConfig();
  fillForms();

  if (state.serverUrl) {
    await refreshStatus();
  }

  if (state.serverUrl && state.token) {
    await refreshLibrary();
  } else {
    renderLibrary();
  }

  const pendingDeepLink = await consumeDeepLink();

  if (pendingDeepLink) {
    await runDeepLink(pendingDeepLink);
  }
}

function bindEvents() {
  elements.pairForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await pairWithPc();
  });

  elements.refreshButton?.addEventListener("click", () => {
    refreshLibrary();
  });

  elements.scanQrButton?.addEventListener("click", async () => {
    try {
      setPairMessage("Abrindo leitor QR...");
      const text = await scanQrCode();
      await runDeepLink(text);
    } catch (error) {
      setPairMessage(error.message || "Nao foi possivel ler o QR.");
    }
  });

  elements.offlineWakeButton?.addEventListener("click", async () => {
    await wakeAndReconnect();
  });

  elements.changePcButton?.addEventListener("click", async () => {
    state.token = "";
    state.serverUrl = "";
    await clearStoredSession();
    showPairing();
    setConnectionState("Offline", "error");
    setMessage("Pareamento removido. Leia o QR do Desktop para conectar novamente.");
  });

  elements.settingsButton?.addEventListener("click", () => {
    setActiveTab(state.activeTab === "settings" ? "games" : "settings");
  });

  elements.wakeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveCurrentWakeConfig();
  });

  elements.defaultGameSelect?.addEventListener("change", () => {
    state.wakeConfig.defaultGame = elements.defaultGameSelect.value.trim();
  });

  elements.startupToggle?.addEventListener("change", async () => {
    try {
      const result = await desktop.setStartup(elements.startupToggle.checked);
      state.startup = result.startup;
      setMessage(elements.startupToggle.checked
        ? "Mob Launcher configurado para iniciar com o Windows."
        : "Inicializacao com Windows desativada.");
    } catch (error) {
      elements.startupToggle.checked = !!state.startup?.openAtLogin;
      setMessage(error.message || "Nao foi possivel alterar inicializacao.");
    }
  });

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.tab);
    });
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => runAction(button.dataset.action));
  });

  onNativeDeepLink((url) => {
    runDeepLink(url);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.serverUrl && state.token) {
      refreshLibrary();
    }
  });

  window.addEventListener("focus", () => {
    if (state.serverUrl && state.token) {
      refreshStatus();
    }
  });
}

async function loadStoredSession() {
  state.serverUrl = await secureStorage.get(storageKeys.serverUrl);
  state.token = await secureStorage.get(storageKeys.token);

  if (!state.serverUrl) {
    state.serverUrl = localStorage.getItem("mobdeck:companionServerUrl") || "";
  }

  if (!state.token) {
    state.token = localStorage.getItem("mobdeck:companionToken") || "";
  }

  if (state.serverUrl) {
    await secureStorage.set(storageKeys.serverUrl, state.serverUrl);
  }

  if (state.token) {
    await secureStorage.set(storageKeys.token, state.token);
  }
}

function fillForms() {
  elements.serverInput.value = state.serverUrl || "";
  if (elements.pinInput) {
    elements.pinInput.value = "";
  }
  if (elements.macInput) elements.macInput.value = state.wakeConfig.mac || "";
  if (elements.broadcastInput) elements.broadcastInput.value = state.wakeConfig.broadcast || "255.255.255.255";
  if (elements.wolPortInput) elements.wolPortInput.value = state.wakeConfig.port || "9";
  renderDefaultGameOptions();
}

async function refreshStatus() {
  try {
    const status = await desktop.status();

    setConnectionState(status.running ? "Online" : "Offline", status.running ? "online" : "error");
    state.connectionStatus = status.running ? "online" : "offline";
  } catch {
    setConnectionState("Offline", "error");
    state.connectionStatus = "offline";
  }

  renderDiagnostics();
}

async function pairWithPc() {
  const serverUrl = normalizeServerUrl(elements.serverInput.value);

  if (!serverUrl) {
    setPairMessage("Digite o endereco do PC.");
    return;
  }

  if (!state.token) {
    setPairMessage("Leia o QR do Desktop para parear sem senha.");
    return;
  }

  state.serverUrl = serverUrl;
  setPairMessage("Conectando...");
  elements.pairForm.querySelector("button").disabled = true;

  try {
    await storeSession();
    setPairMessage("");
    await refreshLibrary();
  } catch (error) {
    setPairMessage(error.message || "Nao foi possivel parear.");
    setConnectionState("Erro", "error");
  } finally {
    elements.pairForm.querySelector("button").disabled = false;
  }
}

async function pairFromQr(params = {}) {
  const serverUrl = normalizeServerUrl(params.server || "");
  const pairingToken = String(params.token || params.pin || "").trim();
  const deviceName = String(params.computer || params.device || "este PC").trim();

  if (!serverUrl) {
    throw new Error("QR sem endereco do Desktop.");
  }

  if (!pairingToken) {
    throw new Error("QR sem token de pareamento.");
  }

  if (!window.confirm(`Parear com ${deviceName}?`)) {
    setPairMessage("Pareamento cancelado.");
    return;
  }

  state.serverUrl = serverUrl;
  state.token = pairingToken;
  elements.serverInput.value = serverUrl;

  state.wakeConfig = await saveWakeProfile({
    computerName: deviceName,
    ipAddress: params.ip,
    macAddress: params.mac,
    broadcastAddress: params.broadcast,
    port: params.port
  });
  fillForms();

  await storeSession();

  setPairMessage("Pareando via QR...");

  try {
    const result = await desktop.pair(pairingToken);

    state.token = result.token;
    await storeSession();

    if (result.wakeProfile) {
      state.wakeConfig = await saveWakeProfile(result.wakeProfile);
      fillForms();
    }

    setPairMessage("");
    await refreshLibrary();
    setMessage(`${deviceName} pareado com sucesso.`);
  } catch (error) {
    state.token = "";
    await secureStorage.remove(storageKeys.token);
    localStorage.removeItem("mobdeck:companionToken");
    setPairMessage(error.message || "Nao foi possivel parear via QR.");
    throw error;
  }
}

async function refreshLibrary() {
  if (!state.serverUrl || !state.token) {
    showPairing();
    return;
  }

  elements.refreshButton.disabled = true;
  setConnectionState("Sincronizando", "online");

  try {
    const [gamesResult, appsResult, wolResult, startupResult, diagnosticsResult] = await Promise.all([
      desktop.games(),
      desktop.apps().catch((error) => {
        console.warn("[MobLauncher] Apps indisponiveis.", error);
        return { apps: [] };
      }),
      desktop.wolProfile().catch((error) => {
        console.warn("[MobLauncher] Perfil WoL indisponivel.", error);
        return null;
      }),
      desktop.startup().catch((error) => {
        console.warn("[MobLauncher] Startup indisponivel.", error);
        return null;
      }),
      desktop.diagnostics().catch((error) => {
        console.warn("[MobLauncher] Diagnostico indisponivel.", error);
        return null;
      })
    ]);

    state.games = Array.isArray(gamesResult.games) ? gamesResult.games : [];
    state.apps = Array.isArray(appsResult.apps) ? appsResult.apps : [];
    saveCachedLibrary();

    if (wolResult?.wakeProfile) {
      state.wakeConfig = await saveWakeProfile(wolResult.wakeProfile);
      state.wakeConfig = await markConnectedNow(state.wakeConfig);
      fillForms();
    }

    if (startupResult?.startup) {
      state.startup = startupResult.startup;
      elements.startupToggle.checked = !!state.startup.openAtLogin;
    }

    if (diagnosticsResult?.ok) {
      state.diagnostics = diagnosticsResult;
    }

    showLibrary();
    renderLibrary();
    setConnectionState("Online", "online");
    state.connectionStatus = "online";
    return true;
  } catch (error) {
    showLibrary();
    setActiveTab("settings");
    setPairMessage(error.message || "Nao foi possivel carregar a biblioteca.");
    setMessage(state.wakeConfig.mac
      ? "PC offline. O pareamento continua salvo; use Ligar PC ou confira o diagnostico."
      : "PC offline. O pareamento continua salvo, mas o MAC ainda nao foi salvo para Wake-on-LAN.");
    setConnectionState("Erro", "error");
    state.connectionStatus = "offline";
    renderLibrary();
    return false;
  } finally {
    elements.refreshButton.disabled = false;
    renderDiagnostics();
  }
}

function renderLibrary() {
  renderGames();
  renderApps();
  renderTabState();
  renderDefaultGameOptions();
}

function renderGames() {
  elements.gamesList.textContent = "";

  for (const game of state.games) {
    elements.gamesList.append(createItemRow({
      item: game,
      type: "game",
      titleFallback: "Jogo",
      imageUrl: game.coverUrl,
      actionLabel: "Jogar",
      onAction: (button) => launchGame(game, button)
    }));
  }
}

function renderApps() {
  elements.appsList.textContent = "";

  for (const app of state.apps) {
    elements.appsList.append(createItemRow({
      item: app,
      type: "app",
      titleFallback: "App",
      imageUrl: app.iconUrl || app.coverUrl || app.artworkUrl,
      actionLabel: "Abrir",
      onAction: (button) => launchApp(app, button)
    }));
  }
}

function createItemRow({ item, type, titleFallback, imageUrl, actionLabel, onAction }) {
  const row = document.createElement("article");
  const cover = document.createElement("div");
  const info = document.createElement("div");
  const actions = document.createElement("div");
  const title = document.createElement("strong");
  const provider = document.createElement("span");
  const meta = document.createElement("small");
  const infoButton = document.createElement("button");
  const button = document.createElement("button");
  const fallbackSrc = createGeneratedArtwork(item, type);

  row.className = `library-card ${type === "app" ? "app-card" : "game-card"}`;
  cover.className = type === "app" ? "app-cover" : "game-cover";
  info.className = "game-info";
  actions.className = "card-action-row";
  infoButton.className = "info-action";
  infoButton.type = "button";
  infoButton.textContent = "Info";
  button.className = "game-action";
  button.type = "button";
  button.textContent = actionLabel;
  button.disabled = !item.canLaunch;

  const image = new Image();

  image.alt = item.name || titleFallback;
  image.loading = "lazy";
  image.draggable = false;

  if (imageUrl) {
    image.src = resolveMediaUrl(state.serverUrl, imageUrl);
    image.addEventListener("error", () => {
      image.classList.add("is-generated-cover");
      image.src = fallbackSrc;
    }, { once: true });
  } else {
    image.classList.add("is-generated-cover");
    image.src = fallbackSrc;
  }

  cover.append(image);

  title.textContent = item.name || titleFallback;
  provider.textContent = item.categoryName || item.provider || "Local";
  meta.textContent = getItemMeta(item, type);
  infoButton.addEventListener("click", () => showItemInfo(item, type));
  button.addEventListener("click", () => onAction(button));

  info.append(title, provider, meta);
  actions.append(infoButton, button);
  row.append(cover, info, actions);

  return row;
}

function createInitials(name) {
  const span = document.createElement("span");
  const initials = String(name || "MD")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  span.textContent = initials || "MD";

  return span;
}

function createGeneratedArtwork(item, type) {
  const isApp = type === "app";
  const height = isApp ? 512 : 768;
  const radius = isApp ? 90 : 34;
  const title = String(item?.name || (isApp ? "App" : "Jogo")).trim() || (isApp ? "App" : "Jogo");
  const initials = createInitials(title).textContent || "MD";
  const subtitle = String(item?.categoryName || item?.provider || (isApp ? "App" : "Jogo")).toUpperCase().slice(0, 22);
  const accent = isApp ? "#22c8e5" : "#ff8733";
  const mid = isApp ? "#7cf0ff" : "#ffd166";
  const markY = isApp ? 266 : 372;
  const lineY = isApp ? 416 : 672;
  const subtitleY = isApp ? 452 : 714;
  const circleY = isApp ? 236 : 330;
  const circleRadius = isApp ? 118 : 138;
  const markSize = initials.length > 2 ? 72 : 112;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="${height}" viewBox="0 0 512 ${height}">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#07090c"/>
          <stop offset=".58" stop-color="#16202a"/>
          <stop offset="1" stop-color="#101318"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="34%" r="62%">
          <stop offset="0" stop-color="${accent}" stop-opacity=".42"/>
          <stop offset=".62" stop-color="${mid}" stop-opacity=".12"/>
          <stop offset="1" stop-color="#000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="512" height="${height}" rx="${radius}" fill="url(#bg)"/>
      <rect width="512" height="${height}" rx="${radius}" fill="url(#glow)"/>
      <path d="M64 96 H448 M64 ${lineY} H448" stroke="${accent}" stroke-width="5" stroke-linecap="round" opacity=".72"/>
      <circle cx="256" cy="${circleY}" r="${circleRadius}" fill="#ffffff" fill-opacity=".08" stroke="${accent}" stroke-width="4"/>
      <text x="256" y="${markY}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${markSize}" font-weight="950" fill="#ffffff">${escapeXml(initials)}</text>
      <text x="256" y="${subtitleY}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="950" fill="${mid}">${escapeXml(subtitle)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function launchGame(game, button) {
  await runButtonAction(button, "Abrindo", "Jogar", async () => {
    await desktop.launchGame(game.id);
    setMessage(`${game.name} enviado para abrir no PC.`);
  });
}

async function launchApp(app, button) {
  await runButtonAction(button, "Abrindo", "Abrir", async () => {
    await desktop.launchApp(app.id);
    setMessage(`${app.name} enviado para abrir no PC.`);
  });
}

async function runButtonAction(button, busyLabel, defaultLabel, task) {
  button.disabled = true;
  button.textContent = busyLabel;

  try {
    await task();
    button.textContent = "OK";
  } catch (error) {
    button.textContent = "Erro";
    setMessage(error.message || "Nao foi possivel executar.");
  } finally {
    setTimeout(() => {
      button.textContent = defaultLabel;
      button.disabled = false;
    }, 1500);
  }
}

async function saveCurrentWakeConfig() {
  state.wakeConfig = {
    mac: elements.macInput.value.trim(),
    broadcast: elements.broadcastInput.value.trim() || "255.255.255.255",
    port: elements.wolPortInput.value.trim() || "9",
    defaultGame: elements.defaultGameSelect.value.trim(),
    computerName: state.wakeConfig.computerName,
    ipAddress: state.wakeConfig.ipAddress,
    serverPort: state.wakeConfig.serverPort,
    lastConnectedAt: state.wakeConfig.lastConnectedAt,
    lastWakePacketAt: state.wakeConfig.lastWakePacketAt
  };

  try {
    await saveWakeConfig(state.wakeConfig);
    setMessage("Configuracao de Wake-on-LAN salva no armazenamento seguro.");
    renderDiagnostics();
  } catch (error) {
    setMessage(error.message || "Nao foi possivel salvar Wake-on-LAN.");
  }
}

async function runAction(action) {
  try {
    if (action === "wake-pc") {
      await wakeAndReconnect();
    }

    if (action === "test-wol") {
      await wakeAndReconnect();
    }

    if (action === "game-mode") {
      if (!state.wakeConfig.defaultGame) {
        setActiveTab("settings");
        setMessage("Escolha um jogo padrao antes de iniciar o modo jogo.");
        return;
      }

      await actions.gameMode(state.wakeConfig.defaultGame);
    }

    if (action === "start-stream") {
      await actions.startStream();
    }

    if (action === "steam-big-picture") {
      await actions.steamBigPicture();
    }

    if (action === "refresh-library") {
      await actions.refreshDesktopLibrary();
    }

    if (action === "lock-pc") {
      await actions.lockPc();
    }

    if (action === "sleep-pc") {
      if (!confirm("Suspender o PC agora?")) return;
      await actions.sleepPc();
    }

    if (action === "restart-pc") {
      if (!confirm("Reiniciar o PC em 30 segundos?")) return;
      await actions.restartPc();
    }

    if (action === "shutdown-pc") {
      if (!confirm("Desligar o PC em 30 segundos?")) return;
      await actions.shutdownPc();
    }

    if (action === "volume-up" || action === "volume-down" || action === "volume-mute") {
      await actions.volume(action);
    }

    if (action === "copy-ip") {
      await copyText(state.wakeConfig.ipAddress || "");
    }

    if (action === "copy-mac") {
      await copyText(state.wakeConfig.mac || "");
    }
  } catch (error) {
    setMessage(error.message || "Acao nao concluida.");
  }
}

async function wakeAndReconnect() {
  setMessage("Enviando pacote Wake-on-LAN...");
  await wakePc(state.wakeConfig);
  state.wakeConfig = await loadWakeConfig();
  fillForms();
  renderDiagnostics();
  setMessage("WoL enviado. Aguardando o Mob Launcher Desktop ficar online...");
  await waitForReconnect();
}

async function waitForReconnect() {
  const deadline = Date.now() + 90000;
  let attempt = 1;

  while (Date.now() < deadline) {
    const online = await refreshLibrary();

    if (online) {
      setMessage("PC online. Mob Launcher reconectado.");
      return;
    }

    setMessage(`Aguardando PC responder... tentativa ${attempt}`);
    attempt += 1;
    await wait(5000);
  }

  setMessage("WoL enviado, mas o PC ainda nao respondeu. Verifique BIOS, Windows e firewall.");
}

async function copyText(value) {
  if (!value) {
    setMessage("Nada para copiar.");
    return;
  }

  await navigator.clipboard.writeText(value);
  setMessage("Copiado.");
}

async function runDeepLink(url) {
  try {
    setActiveTab("settings");
    await handleDeepLink(url, actions);
  } catch (error) {
    setMessage(error.message || "Deep link nao concluido.");
  }
}

function setActiveTab(tab) {
  state.activeTab = tab;
  renderTabState();
}

function renderTabState() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === state.activeTab);
  });

  elements.libraryTitle.textContent = state.activeTab === "apps"
    ? "Apps"
    : state.activeTab === "settings"
      ? "Config"
      : "Jogos";

  elements.gamesList.classList.toggle("is-hidden", state.activeTab !== "games");
  elements.appsList.classList.toggle("is-hidden", state.activeTab !== "apps");
  elements.actionsPanel.classList.toggle("is-hidden", state.activeTab !== "settings");
  elements.diagnosticsPanel.classList.toggle("is-hidden", state.activeTab !== "settings");
  elements.offlineWakeButton.classList.toggle("is-hidden", !(state.connectionStatus !== "online" && state.wakeConfig.mac));
  elements.settingsButton?.classList.toggle("is-active", state.activeTab === "settings");

  const empty = state.activeTab === "games"
    ? state.games.length === 0
    : state.activeTab === "apps"
      ? state.apps.length === 0
      : false;

  elements.emptyState.classList.toggle("is-hidden", !empty);
  elements.emptyState.textContent = state.activeTab === "apps"
    ? "Nenhum app sincronizado ainda."
    : "Nenhum jogo sincronizado ainda.";

  renderDiagnostics();
}

function getItemMeta(item, type) {
  const parts = [];

  if (item.launchCount) {
    parts.push(`${item.launchCount} abertura(s)`);
  }

  if (item.lastPlayedAt) {
    const date = new Date(item.lastPlayedAt);

    if (!Number.isNaN(date.getTime())) {
      parts.push(date.toLocaleDateString("pt-BR"));
    }
  }

  if (item.summary && type === "app") {
    parts.push(item.summary);
  }

  return parts.length ? parts.join(" | ") : "Pronto para abrir no PC";
}

function showItemInfo(item, type) {
  const lines = [
    item.name || (type === "app" ? "App" : "Jogo"),
    item.provider ? `Origem: ${item.provider}` : "",
    item.categoryName ? `Tipo: ${item.categoryName}` : "",
    item.summary || "",
    item.lastPlayedAt ? `Ultima abertura: ${formatDateTime(item.lastPlayedAt)}` : "",
    item.launchCount ? `Aberturas: ${item.launchCount}` : ""
  ].filter(Boolean);

  window.alert(lines.join("\n"));
}

function renderDefaultGameOptions() {
  if (!elements.defaultGameSelect) {
    return;
  }

  const currentValue = state.wakeConfig.defaultGame || elements.defaultGameSelect.value || "";

  elements.defaultGameSelect.textContent = "";
  elements.defaultGameSelect.append(new Option("Escolha um jogo", ""));

  for (const game of state.games) {
    elements.defaultGameSelect.append(new Option(game.name || "Jogo", game.id || game.name || ""));
  }

  const hasCurrentOption = [...elements.defaultGameSelect.options].some((option) => option.value === currentValue);

  if (currentValue && !hasCurrentOption) {
    elements.defaultGameSelect.append(new Option(currentValue, currentValue));
  }

  elements.defaultGameSelect.value = currentValue;
}

function renderDiagnostics() {
  if (!elements.diagStatus) return;

  elements.diagStatus.textContent = state.connectionStatus === "online" ? "Online" : "Offline";
  elements.diagComputer.textContent = state.wakeConfig.computerName || "Nao detectado";
  elements.diagIp.textContent = state.wakeConfig.ipAddress || "Nao salvo";
  elements.diagMac.textContent = state.wakeConfig.mac || "Nao salvo";
  elements.diagLastConnected.textContent = formatDateTime(state.wakeConfig.lastConnectedAt);
  elements.diagLastWake.textContent = formatDateTime(state.wakeConfig.lastWakePacketAt);

  if (elements.diagLibrary) {
    elements.diagLibrary.textContent = state.diagnostics?.library
      ? `${state.diagnostics.library.games || 0} jogo(s), ${state.diagnostics.library.apps || 0} app(s)`
      : `${state.games.length} jogo(s), ${state.apps.length} app(s)`;
  }

  if (elements.diagMemory) {
    elements.diagMemory.textContent = state.diagnostics?.system
      ? `${formatBytes(state.diagnostics.system.freeMemoryBytes)} de ${formatBytes(state.diagnostics.system.totalMemoryBytes)}`
      : "Nao detectado";
  }

  if (elements.diagDrives) {
    elements.diagDrives.textContent = (state.diagnostics?.drives || [])
      .map((drive) => `${drive.name} ${formatBytes(drive.freeBytes)} livres`)
      .join(" | ") || "Nao detectado";
  }

  if (elements.diagLaunchers) {
    elements.diagLaunchers.textContent = (state.diagnostics?.launchers || [])
      .map((launcher) => `${launcher.name}: ${launcher.installed ? "OK" : "Nao"}`)
      .join(" | ") || "Nao detectado";
  }
}

function formatBytes(bytes) {
  const value = Number(bytes);

  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function showPairing() {
  elements.pairPanel.classList.remove("is-hidden");
  elements.libraryPanel.classList.add("is-hidden");
}

function showLibrary() {
  elements.pairPanel.classList.add("is-hidden");
  elements.libraryPanel.classList.remove("is-hidden");
}

function setPairMessage(message) {
  elements.pairMessage.textContent = message || "";
}

function setMessage(message) {
  elements.actionMessage.textContent = message || "";
}

function setConnectionState(label, mode) {
  elements.connectionState.textContent = label;
  elements.connectionState.classList.toggle("is-online", mode === "online");
  elements.connectionState.classList.toggle("is-error", mode === "error");
}

function formatDateTime(value) {
  if (!value) {
    return "Nunca";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function storeSession() {
  await secureStorage.set(storageKeys.serverUrl, state.serverUrl);
  await secureStorage.set(storageKeys.token, state.token);
  localStorage.setItem("mobdeck:companionServerUrl", state.serverUrl);
  localStorage.setItem("mobdeck:companionToken", state.token);
}

async function clearStoredSession() {
  await secureStorage.remove(storageKeys.serverUrl);
  await secureStorage.remove(storageKeys.token);
  localStorage.removeItem("mobdeck:companionServerUrl");
  localStorage.removeItem("mobdeck:companionToken");
}

function loadCachedLibrary() {
  try {
    const cached = JSON.parse(localStorage.getItem(storageKeys.cachedLibrary) || "{}");

    state.games = Array.isArray(cached.games) ? cached.games : [];
    state.apps = Array.isArray(cached.apps) ? cached.apps : [];
  } catch {
    state.games = [];
    state.apps = [];
  }
}

function saveCachedLibrary() {
  try {
    localStorage.setItem(storageKeys.cachedLibrary, JSON.stringify({
      games: state.games,
      apps: state.apps,
      savedAt: new Date().toISOString()
    }));
  } catch {
    // Cache is optional.
  }
}
