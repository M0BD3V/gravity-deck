const os = require("os");

function getNetworkProfile(options = {}) {
  const port = Number(options.port || 0) || null;
  const network = getPrimaryNetworkInterface();
  const warnings = [];

  if (!network) {
    warnings.push("Nenhuma interface IPv4 local foi detectada automaticamente.");
  }

  if (network && !network.macAddress) {
    warnings.push("Interface detectada, mas sem MAC valido para Wake-on-LAN.");
  }

  return {
    computerName: os.hostname(),
    status: options.serverRunning ? "online" : "offline",
    ipAddress: network?.address || null,
    macAddress: network?.macAddress || null,
    interfaceName: network?.name || null,
    netmask: network?.netmask || null,
    broadcastAddress: network ? getBroadcastAddress(network.address, network.netmask) : "255.255.255.255",
    port,
    primaryUrl: network?.address && port ? `http://${network.address}:${port}` : null,
    detectedAt: new Date().toISOString(),
    warnings
  };
}

function getPrimaryNetworkInterface() {
  const candidates = [];
  const interfaces = os.networkInterfaces();

  for (const [name, entries] of Object.entries(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" || entry.internal || !entry.address) {
        continue;
      }

      candidates.push({
        name,
        address: entry.address,
        netmask: entry.netmask,
        macAddress: normalizeMac(entry.mac),
        score: scoreInterface(name, entry)
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score)[0] || null;
}

function scoreInterface(name, entry) {
  const label = String(name || "").toLowerCase();
  let score = 0;

  if (isPrivateAddress(entry.address)) score += 80;
  if (normalizeMac(entry.mac)) score += 40;
  if (/ethernet|wi-?fi|wireless|wlan|lan/i.test(label)) score += 20;
  if (/virtual|vmware|virtualbox|hyper-v|bluetooth|loopback|tap|tunnel|vpn/i.test(label)) score -= 60;

  return score;
}

function isPrivateAddress(address) {
  return /^10\./.test(address)
    || /^192\.168\./.test(address)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(address);
}

function normalizeMac(value) {
  const raw = String(value || "").replace(/[^a-fA-F0-9]/g, "");

  if (raw.length !== 12 || /^0{12}$/.test(raw)) {
    return null;
  }

  return raw.match(/.{1,2}/g).join(":").toUpperCase();
}

function getBroadcastAddress(address, netmask) {
  const ip = parseIPv4(address);
  const mask = parseIPv4(netmask);

  if (!ip || !mask) {
    return "255.255.255.255";
  }

  return ip.map((part, index) => (part & mask[index]) | (255 ^ mask[index])).join(".");
}

function parseIPv4(value) {
  const parts = String(value || "").split(".").map(Number);

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }

  return parts;
}

module.exports = {
  getNetworkProfile
};
