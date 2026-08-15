const state = {
  token: localStorage.getItem("mobdeck:companionToken") || "",
  games: []
};
const pairingParams = new URLSearchParams(location.search);

const elements = {
  connectionState: document.getElementById("connectionState"),
  pairPanel: document.getElementById("pairPanel"),
  pairForm: document.getElementById("pairForm"),
  pairMessage: document.getElementById("pairMessage"),
  libraryPanel: document.getElementById("libraryPanel"),
  gamesList: document.getElementById("gamesList"),
  emptyState: document.getElementById("emptyState"),
  refreshButton: document.getElementById("refreshButton")
};

elements.pairForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await pairWithPc();
});

elements.refreshButton?.addEventListener("click", () => {
  loadGames();
});

init();

async function init() {
  await refreshStatus();

  await consumePairingTokenFromUrl();

  if (state.token) {
    await loadGames();
  }
}

async function consumePairingTokenFromUrl() {
  const token = String(pairingParams.get("token") || pairingParams.get("pin") || "").trim();
  const deviceName = String(pairingParams.get("computer") || pairingParams.get("device") || "este PC").trim();

  if (!token) {
    return;
  }

  if (!window.confirm(`Parear com ${deviceName}?`)) {
    setPairMessage("Pareamento cancelado.");
    return;
  }

  setPairMessage("Pareando via QR...");

  try {
    const result = await requestJson("/api/pair", {
      method: "POST",
      body: JSON.stringify({ token })
    });

    state.token = result.token;
    localStorage.setItem("mobdeck:companionToken", state.token);
    history.replaceState(null, "", location.pathname);
    setPairMessage("");
  } catch (error) {
    state.token = "";
    localStorage.removeItem("mobdeck:companionToken");
    setPairMessage(error.message || "Nao foi possivel parear.");
  }
}

async function refreshStatus() {
  try {
    const status = await requestJson("/api/status");

    setConnectionState(status.running ? "Online" : "Offline", status.running ? "online" : "error");
  } catch {
    setConnectionState("Offline", "error");
  }
}

async function pairWithPc() {
  if (!state.token) {
    setPairMessage("Leia o QR no app mobile para parear sem senha.");
    return;
  }

  setPairMessage("");
  await loadGames();
}

async function loadGames() {
  if (!state.token) {
    showPairing();
    return;
  }

  elements.refreshButton.disabled = true;
  setConnectionState("Sincronizando", "online");

  try {
    const result = await requestJson("/api/games", {
      headers: {
        "X-MobDeck-Token": state.token
      }
    });

    state.games = Array.isArray(result.games) ? result.games : [];
    showLibrary();
    renderGames();
    setConnectionState("Online", "online");
  } catch (error) {
    state.token = "";
    localStorage.removeItem("mobdeck:companionToken");
    showPairing();
    setPairMessage(error.message || "Pareamento expirado.");
    setConnectionState("Parear", "error");
  } finally {
    elements.refreshButton.disabled = false;
  }
}

function renderGames() {
  elements.gamesList.textContent = "";
  elements.emptyState.classList.toggle("is-hidden", state.games.length > 0);

  for (const game of state.games) {
    elements.gamesList.append(createGameRow(game));
  }
}

function createGameRow(game) {
  const row = document.createElement("article");
  const cover = document.createElement("div");
  const info = document.createElement("div");
  const title = document.createElement("strong");
  const provider = document.createElement("span");
  const meta = document.createElement("small");
  const button = document.createElement("button");

  row.className = "game-row";
  cover.className = "game-cover";
  info.className = "game-info";
  button.className = "game-action";
  button.type = "button";
  button.textContent = "Jogar";
  button.disabled = !game.canLaunch;

  if (game.coverUrl) {
    const image = new Image();

    image.alt = game.name;
    image.loading = "lazy";
    image.src = game.coverUrl;
    image.addEventListener("error", () => {
      image.remove();
      cover.append(createInitials(game.name));
    }, { once: true });
    cover.append(image);
  } else {
    cover.append(createInitials(game.name));
  }

  title.textContent = game.name || "Jogo";
  provider.textContent = game.provider || "Local";
  meta.textContent = getGameMeta(game);
  button.addEventListener("click", () => launchGame(game, button));

  info.append(title, provider, meta);
  row.append(cover, info, button);

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

async function launchGame(game, button) {
  const previousLabel = button.textContent;

  button.disabled = true;
  button.textContent = "Abrindo";

  try {
    await requestJson(`/api/games/${encodeURIComponent(game.id)}/launch`, {
      method: "POST",
      headers: {
        "X-MobDeck-Token": state.token
      }
    });
    button.textContent = "Aberto";
    setTimeout(() => {
      button.textContent = previousLabel;
      button.disabled = !game.canLaunch;
    }, 1400);
  } catch (error) {
    button.textContent = "Erro";
    setPairMessage(error.message || "Nao foi possivel abrir.");
    setTimeout(() => {
      button.textContent = previousLabel;
      button.disabled = !game.canLaunch;
    }, 1600);
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Erro ${response.status}`);
  }

  return payload;
}

function getGameMeta(game) {
  const parts = [];

  if (game.launchCount) {
    parts.push(`${game.launchCount} abertura(s)`);
  }

  if (game.lastPlayedAt) {
    const date = new Date(game.lastPlayedAt);

    if (!Number.isNaN(date.getTime())) {
      parts.push(date.toLocaleDateString("pt-BR"));
    }
  }

  return parts.length ? parts.join(" | ") : "Pronto para abrir no PC";
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

function setConnectionState(label, mode) {
  elements.connectionState.textContent = label;
  elements.connectionState.classList.toggle("is-online", mode === "online");
  elements.connectionState.classList.toggle("is-error", mode === "error");
}
