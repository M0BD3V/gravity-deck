export function createDesktopClient(getSession) {
  return {
    normalizeServerUrl,

    async status() {
      return requestJson(getSession(), "/api/status", { auth: false });
    },

    async pair(token) {
      return requestJson(getSession(), "/api/pair", {
        method: "POST",
        body: JSON.stringify({ token }),
        auth: false
      });
    },

    async wolProfile() {
      return requestJson(getSession(), "/api/wol-profile");
    },

    async startup() {
      return requestJson(getSession(), "/api/startup");
    },

    async setStartup(enabled) {
      return requestJson(getSession(), "/api/startup", {
        method: "POST",
        body: JSON.stringify({ enabled })
      });
    },

    async games() {
      return requestJson(getSession(), "/api/games");
    },

    async apps() {
      return requestJson(getSession(), "/api/apps");
    },

    async diagnostics() {
      return requestJson(getSession(), "/api/diagnostics");
    },

    async launchGame(id) {
      return requestJson(getSession(), `/api/games/${encodeURIComponent(id)}/launch`, {
        method: "POST"
      });
    },

    async launchApp(id) {
      return requestJson(getSession(), `/api/apps/${encodeURIComponent(id)}/launch`, {
        method: "POST"
      });
    },

    async startStream() {
      return this.action("start-stream");
    },

    async shutdownPc() {
      return this.action("shutdown-pc");
    },

    async action(id) {
      return requestJson(getSession(), `/api/actions/${encodeURIComponent(id)}`, {
        method: "POST"
      });
    }
  };
}

export function normalizeServerUrl(value) {
  const text = String(value || "").trim().replace(/\/+$/, "");

  if (!text) {
    return "";
  }

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  return `http://${text}`;
}

export function resolveMediaUrl(serverUrl, value) {
  const url = String(value || "");

  if (/^(https?:|data:)/i.test(url)) {
    return url;
  }

  return `${serverUrl}${url.startsWith("/") ? url : `/${url}`}`;
}

async function requestJson(session, path, options = {}) {
  const auth = options.auth !== false;
  const serverUrl = normalizeServerUrl(session.serverUrl);
  const timeoutMs = Number(options.timeoutMs || 7000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (!serverUrl) {
    throw new Error("Endereco do PC nao configurado.");
  }

  if (auth && !session.token) {
    throw new Error("Dispositivo nao pareado.");
  }

  let response;

  try {
    response = await fetch(`${serverUrl}${path.startsWith("/") ? path : `/${path}`}`, {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { "X-MobDeck-Token": session.token } : {}),
        ...(options.headers || {})
      }
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("PC offline ou sem resposta na rede.");
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Erro ${response.status}`);
  }

  return payload;
}
