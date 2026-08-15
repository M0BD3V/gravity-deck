const nativePlugin = getNativePlugin();

export const hasNativeBridge = !!nativePlugin;

export const secureStorage = {
  async get(key) {
    if (nativePlugin?.secureGet) {
      const result = await nativePlugin.secureGet({ key });
      return result?.value || "";
    }

    return localStorage.getItem(`moblauncher:${key}`) || "";
  },

  async set(key, value) {
    if (nativePlugin?.secureSet) {
      await nativePlugin.secureSet({ key, value: String(value || "") });
      return;
    }

    localStorage.setItem(`moblauncher:${key}`, String(value || ""));
  },

  async remove(key) {
    if (nativePlugin?.secureRemove) {
      await nativePlugin.secureRemove({ key });
      return;
    }

    localStorage.removeItem(`moblauncher:${key}`);
  }
};

export async function sendNativeWakePacket(config) {
  if (!nativePlugin?.sendWakePacket) {
    throw new Error("Wake-on-LAN nativo disponivel apenas no app Android.");
  }

  return nativePlugin.sendWakePacket({
    mac: config.mac,
    broadcast: config.broadcast || "255.255.255.255",
    port: Number(config.port || 9)
  });
}

export async function scanQrCode() {
  if (!nativePlugin?.scanQr) {
    throw new Error("Leitor QR disponivel apenas no app Android.");
  }

  const result = await nativePlugin.scanQr();

  return result?.text || "";
}

export async function consumeDeepLink() {
  if (!nativePlugin?.consumeDeepLink) {
    return "";
  }

  const result = await nativePlugin.consumeDeepLink();

  return result?.url || "";
}

export function onNativeDeepLink(callback) {
  if (!nativePlugin?.addListener) {
    return () => {};
  }

  let listenerHandle = null;
  nativePlugin.addListener("deepLink", (payload) => {
    callback(payload?.url || "");
  }).then((handle) => {
    listenerHandle = handle;
  }).catch((error) => {
    console.warn("[MobLauncherNative] Nao foi possivel observar deep links.", error);
  });

  return () => listenerHandle?.remove?.();
}

function getNativePlugin() {
  const capacitor = window.Capacitor;

  if (capacitor?.registerPlugin) {
    return capacitor.registerPlugin("MobLauncherNative");
  }

  return capacitor?.Plugins?.MobLauncherNative || null;
}
