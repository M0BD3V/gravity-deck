import { secureStorage, sendNativeWakePacket } from "./nativeBridge.js";

const keys = {
  mac: "wolMac",
  broadcast: "wolBroadcast",
  port: "wolPort",
  defaultGame: "defaultGame",
  computerName: "wolComputerName",
  ipAddress: "wolIpAddress",
  serverPort: "wolServerPort",
  lastConnectedAt: "wolLastConnectedAt",
  lastWakePacketAt: "wolLastWakePacketAt"
};

export async function loadWakeConfig() {
  return {
    mac: await secureStorage.get(keys.mac),
    broadcast: await secureStorage.get(keys.broadcast) || "255.255.255.255",
    port: await secureStorage.get(keys.port) || "9",
    defaultGame: await secureStorage.get(keys.defaultGame),
    computerName: await secureStorage.get(keys.computerName),
    ipAddress: await secureStorage.get(keys.ipAddress),
    serverPort: await secureStorage.get(keys.serverPort),
    lastConnectedAt: await secureStorage.get(keys.lastConnectedAt),
    lastWakePacketAt: await secureStorage.get(keys.lastWakePacketAt)
  };
}

export async function saveWakeConfig(config) {
  await secureStorage.set(keys.mac, cleanMac(config.mac));
  await secureStorage.set(keys.broadcast, config.broadcast || "255.255.255.255");
  await secureStorage.set(keys.port, String(Number(config.port || 9)));
  await secureStorage.set(keys.defaultGame, config.defaultGame || "");
  await secureStorage.set(keys.computerName, config.computerName || "");
  await secureStorage.set(keys.ipAddress, config.ipAddress || "");
  await secureStorage.set(keys.serverPort, config.serverPort || "");
  await secureStorage.set(keys.lastConnectedAt, config.lastConnectedAt || "");
  await secureStorage.set(keys.lastWakePacketAt, config.lastWakePacketAt || "");
}

export async function saveWakeProfile(profile = {}) {
  const current = await loadWakeConfig();
  const next = mergeWakeProfile(current, profile);

  await saveWakeConfig(next);

  return next;
}

export async function wakePc(config) {
  const mac = cleanMac(config.mac);

  if (!mac) {
    throw new Error("Configure o MAC do PC antes de usar Wake-on-LAN.");
  }

  const result = await sendNativeWakePacket({
    mac,
    broadcast: config.broadcast || "255.255.255.255",
    port: Number(config.port || 9)
  });

  await secureStorage.set(keys.lastWakePacketAt, new Date().toISOString());

  return result;
}

export function mergeWakeProfile(current = {}, profile = {}) {
  return {
    ...current,
    mac: profile.macAddress || profile.mac || current.mac || "",
    broadcast: profile.broadcastAddress || profile.broadcast || current.broadcast || "255.255.255.255",
    port: String(profile.wolPort || current.port || 9),
    defaultGame: current.defaultGame || "",
    computerName: profile.computerName || current.computerName || "",
    ipAddress: profile.ipAddress || profile.ip || current.ipAddress || "",
    serverPort: String(profile.port || current.serverPort || ""),
    lastConnectedAt: current.lastConnectedAt || "",
    lastWakePacketAt: current.lastWakePacketAt || ""
  };
}

export async function markConnectedNow(config) {
  const next = {
    ...config,
    lastConnectedAt: new Date().toISOString()
  };

  await saveWakeConfig(next);

  return next;
}

function cleanMac(value) {
  return String(value || "").trim();
}
