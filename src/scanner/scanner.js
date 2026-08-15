const fs = require("fs/promises");
const path = require("path");
const epic = require("./epic");
const gog = require("./gog");
const steam = require("./steam");

const minGameConfidence = 60;
const defaultFinalScoreThreshold = 60;
const maxDiscoveredCandidatesPerRoot = 700;
const officialSources = new Set(["steam", "epic", "gog"]);
const onlineSourceScores = {
  steam: 40,
  gog: 30
};

const ignoredFolderNames = [
  "$recycle.bin", "system volume information", "windows", "users",
  "programdata", "downloads", "documents", "documentos", "pictures",
  "imagens", "videos", "music", "musicas", "musicas", "steamapps",
  "data", "x64", "x86", "bin", "redist", "redistributables",
  "commonredist", "vcredist", "directx", "capas", "assets",
  "node_modules", ".git", ".codex", ".agents", ".vscode", ".idea",
  "src", "resources", "logs", "temp", "tmp", "dist", "release",
  "build", "android", "sdk", "gradle", "npm", "yarn", "jetbrains",
  "vscode", "visual studio", "drivers", "driver", "nvidia", "amd",
  "intel", "realtek", "microsoft office", "office", "adobe",
  "postman", "docker", "git", "github", "python", "java", "jdk",
  "jre", "runtime", "amd privacy view", "microsoft vs code",
  "wiztree", "performance profile client", "mob deck", "moblauncher",
  "mob launcher", "mobdeck"
];

const ignoredPathSegmentNames = [
  "node_modules", ".git", ".codex", ".agents", ".vscode", ".idea",
  "android", "sdk", "gradle", "npm", "yarn", "jetbrains", "vscode",
  "visual studio", "system32", "syswow64", "programdata", "appdata",
  "drivers", "driver", "nvidia", "amd", "intel", "realtek",
  "microsoft office", "office", "adobe", "postman", "docker", "git",
  "github", "python", "java", "jdk", "jre", "mob deck", "moblauncher",
  "mob launcher", "mobdeck"
];

const ignoredExeWords = [
  "setup", "install", "installer", "unins", "uninstall", "uninstaller",
  "crash", "crashhandler", "crash handler", "report", "redist",
  "redistributable", "vcredist", "dxsetup", "launcherhelper",
  "launcher helper", "helper", "service", "agent", "daemon",
  "telemetry", "eac", "easyanticheat", "anticheat", "privacy",
  "code", "wiztree", "profile", "updater", "update", "repair",
  "bootstrap", "downloader", "runtime", "mob deck", "mobdeck",
  "moblauncher", "mob launcher"
];

const nonGameNameWords = [
  "bandicam", "obs studio", "obs64", "obs32", "streamlabs",
  "tiktok live studio", "tiktok studio", "medal", "iriun",
  "discord", "spotify", "chrome", "firefox", "edge", "opera",
  "brave", "vlc", "winrar", "7 zip", "7zip", "notepad",
  "visual studio code", "microsoft vs code", "vscode", "wiztree",
  "steam client", "steamworks", "epic games launcher", "ubisoft connect",
  "ea app", "origin", "battle net", "battlenet", "rockstar games launcher",
  "cursor", "pcsx2", "redm", "python", "python314", "samfwtool",
  "sam fw tool", "realityscan", "reality capture", "twinmotion",
  "unreal engine", "unity hub", "blender", "adobe", "postman",
  "wallpaper engine",
  "docker", "github", "git", "java", "jdk", "jre", "mob deck",
  "moblauncher", "mob launcher"
];

const likelyGameLibraryFolderWords = [
  "battle.net", "blizzard", "ea games", "epic games", "game", "games",
  "gog games", "jogo", "jogos", "origin games", "riot games",
  "rockstar games", "steam", "steamlibrary", "ubisoft", "xboxgames",
  "xbox games"
];

const genericSystemLibraryFolders = [
  "program files", "program files x86", "arquivos de programas",
  "arquivos de programas x86"
];

function createScanContext(options = {}) {
  return {
    conservative: !!options.conservative,
    threshold: Number(options.threshold || defaultFinalScoreThreshold),
    detailed: !!options.detailed,
    log: options.log !== false,
    logger: options.logger === false ? null : options.logger || console,
    services: {
      steam: options.services?.steam || steam,
      epic: options.services?.epic || epic,
      gog: options.services?.gog || gog
    },
    diagnostics: [],
    counts: {
      accepted: 0,
      rejected: 0,
      pending: 0,
      onlineEnriched: 0
    }
  };
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactName(value) {
  return normalizeName(value).replace(/[^a-z0-9]+/g, "");
}

function cleanGameName(name) {
  return String(name || "").replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

function shouldIgnoreFolder(folderPath) {
  const folderName = normalizeName(path.basename(folderPath));

  if (ignoredFolderNames.some((word) => folderName === normalizeName(word))) {
    return true;
  }

  if (
    folderName.startsWith("scoped_dir")
    || folderName.startsWith("release ")
    || folderName.startsWith("release-")
    || folderName.startsWith("build ")
    || folderName.startsWith("build-")
    || folderName.startsWith("dist ")
    || folderName.startsWith("dist-")
    || folderName.startsWith("_extract")
  ) {
    return true;
  }

  const ignoredSegments = new Set(ignoredPathSegmentNames.map(normalizeName));
  const segments = String(folderPath || "")
    .split(/[\\/]+/)
    .map(normalizeName)
    .filter(Boolean);

  return segments.some((segment) => ignoredSegments.has(segment));
}

function shouldIgnoreExe(fileName) {
  const lower = String(fileName || "").toLowerCase();
  const normalized = normalizeName(path.basename(lower, ".exe"));
  const compact = compactName(path.basename(lower, ".exe"));

  return ignoredExeWords.some((word) => {
    const normalizedWord = normalizeName(word);
    const compactWord = compactName(word);

    return normalized.includes(normalizedWord) || (!!compactWord && compact.includes(compactWord));
  });
}

function hasNonGameName(...values) {
  const text = normalizeName(values.filter(Boolean).join(" "));
  const compact = compactName(values.filter(Boolean).join(" "));

  return nonGameNameWords.some((word) => {
    const normalizedWord = normalizeName(word);
    const compactWord = compactName(word);

    return text.includes(normalizedWord) || (!!compactWord && compact.includes(compactWord));
  });
}

function isKnownNonGameCandidate(candidate, name, exePath) {
  return hasNonGameName(name, candidate?.folder, exePath);
}

function isPathInsideOrSame(childPath, parentPath) {
  const child = path.resolve(childPath).toLowerCase();
  const parent = path.resolve(parentPath).toLowerCase();
  const relative = path.relative(parent, child);

  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function createCandidate(folder, metadata = {}) {
  return {
    folder,
    source: metadata.source || null,
    sourceId: metadata.sourceId || metadata.appId || null,
    name: metadata.name || null,
    exe: metadata.exe || null,
    cover: metadata.cover || null,
    fallbackCover: metadata.fallbackCover || null,
    launchUri: metadata.launchUri || null,
    fallbackLaunchUri: metadata.fallbackLaunchUri || null,
    epicNamespace: metadata.epicNamespace || null,
    epicCatalogItemId: metadata.epicCatalogItemId || null,
    developer: metadata.developer || null,
    publisher: metadata.publisher || null,
    sizeBytes: metadata.sizeBytes || null,
    confidence: metadata.confidence || 0
  };
}

function uniqueCandidates(candidates) {
  const byFolder = new Map();

  for (const candidate of candidates) {
    if (!candidate.folder || shouldIgnoreFolder(candidate.folder)) continue;

    const key = path.resolve(candidate.folder).toLowerCase();
    const existing = byFolder.get(key);

    if (!existing || candidate.confidence > existing.confidence || (candidate.cover && !existing.cover)) {
      byFolder.set(key, candidate);
    }
  }

  return [...byFolder.values()];
}

async function listDirectories(folder) {
  try {
    const entries = await fs.readdir(folder, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(folder, entry.name))
      .filter((folderPath) => !shouldIgnoreFolder(folderPath));
  } catch {
    return [];
  }
}

async function listExecutables(folder) {
  try {
    const entries = await fs.readdir(folder, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile())
      .filter((entry) => entry.name.toLowerCase().endsWith(".exe"))
      .filter((entry) => !shouldIgnoreExe(entry.name))
      .map((entry) => path.join(folder, entry.name));
  } catch {
    return [];
  }
}

function scoreExecutable(exePath, gameFolder) {
  const exeName = path.basename(exePath).toLowerCase();
  const folderName = compactName(path.basename(gameFolder));
  const exeBase = compactName(path.basename(exePath, ".exe"));

  let score = 0;

  if (exeBase === folderName) score += 320;
  if (exeBase.includes(folderName) && folderName.length >= 4) score += 170;
  if (folderName.includes(exeBase) && exeBase.length >= 4) score += 120;

  if (exeName.includes("rdr2")) score += 500;
  if (exeName.includes("gta5")) score += 500;
  if (exeName.includes("cyberpunk")) score += 500;

  if (exeName.includes("play")) score -= 80;
  if (exeName.includes("launcher")) score -= 120;
  if (exeName.includes("eac")) score -= 300;

  return score;
}

async function findExecutable(gameFolder, preferredExe = null) {
  if (preferredExe && preferredExe.toLowerCase().endsWith(".exe") && await exists(preferredExe)) {
    return preferredExe;
  }

  const searchFolders = [
    gameFolder,
    path.join(gameFolder, "bin"),
    path.join(gameFolder, "bin", "x64"),
    path.join(gameFolder, "x64"),
    path.join(gameFolder, "Binaries"),
    path.join(gameFolder, "Binaries", "Win64"),
    path.join(gameFolder, "Win64"),
    path.join(gameFolder, "Game")
  ];

  let exes = [];

  for (const folder of searchFolders) {
    if (!(await exists(folder))) continue;
    exes.push(...await listExecutables(folder));
  }

  exes = [...new Set(exes)];

  if (exes.length === 0) return null;

  exes.sort((a, b) => scoreExecutable(b, gameFolder) - scoreExecutable(a, gameFolder));

  return exes[0];
}

async function findCover(gameName) {
  const extensions = [".jpg", ".jpeg", ".png", ".webp"];
  const coversFolder = path.join(__dirname, "..", "..", "capas");

  for (const ext of extensions) {
    const relativePath = `capas/${gameName}${ext}`;
    const absolutePath = path.join(__dirname, "..", "..", relativePath);

    if (await exists(absolutePath)) {
      return relativePath.replace(/\\/g, "/");
    }
  }

  try {
    const normalizedTarget = normalizeName(gameName);
    const entries = await fs.readdir(coversFolder, { withFileTypes: true });
    const match = entries
      .filter((entry) => entry.isFile())
      .find((entry) => {
        const ext = path.extname(entry.name).toLowerCase();
        const baseName = path.basename(entry.name, ext);

        return extensions.includes(ext) && normalizeName(baseName) === normalizedTarget;
      });

    if (match) {
      return `capas/${match.name}`.replace(/\\/g, "/");
    }
  } catch {
    // Local covers are optional.
  }

  return null;
}

async function detectGameSignals(gameFolder, exePath) {
  const exeDir = exePath ? path.dirname(exePath) : gameFolder;
  const exeBase = exePath ? path.basename(exePath, ".exe") : "";
  const roots = [...new Set([gameFolder, exeDir])];
  const reasons = [];

  for (const root of roots) {
    if (await exists(path.join(root, "UnityPlayer.dll"))) reasons.push("unity-player");
    if (await exists(path.join(root, "GameAssembly.dll"))) reasons.push("unity-il2cpp");
    if (exeBase && await exists(path.join(root, `${exeBase}_Data`))) reasons.push("unity-data");
    if (await exists(path.join(root, "Content", "Paks"))) reasons.push("unreal-paks");
    if (await exists(path.join(root, "Engine", "Binaries"))) reasons.push("unreal-engine");
    if (await exists(path.join(root, "Binaries", "Win64"))) reasons.push("unreal-binaries");
    if (exeBase && await exists(path.join(root, `${exeBase}.pck`))) reasons.push("godot-pck");
    if (await exists(path.join(root, "renpy"))) reasons.push("renpy");
    if (await exists(path.join(root, "www", "js", "rpg_core.js"))) reasons.push("rpg-maker");
  }

  const uniqueReasons = [...new Set(reasons)];

  return {
    score: Math.min(70, uniqueReasons.length * 25),
    reasons: uniqueReasons
  };
}

async function getSteamAppsFolders(rootFolder) {
  const steamAppsFolders = [];
  const root = path.resolve(rootFolder);
  const rootName = path.basename(root).toLowerCase();
  const parent = path.dirname(root);
  const parentName = path.basename(parent).toLowerCase();

  if (rootName === "steamapps" && await exists(path.join(root, "common"))) {
    steamAppsFolders.push(root);
  }

  if (rootName === "common" && parentName === "steamapps") {
    steamAppsFolders.push(parent);
  }

  const directSteamApps = path.join(root, "steamapps");

  if (await exists(path.join(directSteamApps, "common"))) {
    steamAppsFolders.push(directSteamApps);
  }

  const firstLevel = await listDirectories(root);

  for (const folder of firstLevel) {
    const steamApps = path.join(folder, "steamapps");

    if (await exists(path.join(steamApps, "common"))) {
      steamAppsFolders.push(steamApps);
    }
  }

  return [...new Set(steamAppsFolders.map((folder) => path.resolve(folder)))];
}

async function addSteamCandidates(rootFolder, candidates, steamService) {
  const steamAppsFolders = await getSteamAppsFolders(rootFolder);

  for (const steamAppsFolder of steamAppsFolders) {
    const commonFolder = path.join(steamAppsFolder, "common");
    const steamGames = await safeServiceCall(() => steamService.readSteamLibraryGames(steamAppsFolder), []);

    for (const steamGame of steamGames) {
      candidates.push(createCandidate(steamGame.folder, {
        source: "steam",
        sourceId: steamGame.appId,
        name: steamGame.name,
        cover: steamGame.cover,
        fallbackCover: steamGame.fallbackCover,
        launchUri: steamGame.launchUri,
        sizeBytes: steamGame.sizeBytes,
        confidence: 100
      }));
    }

    const commonFolders = await listDirectories(commonFolder);

    for (const folder of commonFolders) {
      candidates.push(createCandidate(folder));
    }
  }
}

async function addEpicCandidates(rootFolder, candidates, epicService) {
  const epicGames = await safeServiceCall(() => epicService.readInstalledGames(), []);

  for (const epicGame of epicGames) {
    if (!isPathInsideOrSame(epicGame.folder, rootFolder)) continue;

    candidates.push(createCandidate(epicGame.folder, {
      source: "epic",
      sourceId: epicGame.appId,
      name: epicGame.name,
      exe: epicGame.exe,
      launchUri: epicGame.launchUri,
      fallbackLaunchUri: epicGame.fallbackLaunchUri,
      epicNamespace: epicGame.epicNamespace,
      epicCatalogItemId: epicGame.catalogItemId || epicGame.epicCatalogItemId,
      cover: epicGame.cover,
      developer: epicGame.developer,
      publisher: epicGame.publisher,
      sizeBytes: epicGame.sizeBytes,
      confidence: 100
    }));
  }
}

function isDriveRoot(folderPath) {
  const resolved = path.resolve(folderPath);
  const parsedRoot = path.parse(resolved).root;

  return resolved.toLowerCase() === parsedRoot.toLowerCase();
}

function isSystemDriveRoot(folderPath) {
  if (process.platform !== "win32" || !isDriveRoot(folderPath)) {
    return false;
  }

  const systemDrive = String(process.env.SystemDrive || "C:").toLowerCase();
  const rootDrive = path.parse(path.resolve(folderPath)).root.slice(0, 2).toLowerCase();

  return rootDrive === systemDrive;
}

function isGenericSystemLibraryFolder(folderPath) {
  const normalized = normalizeName(path.basename(folderPath));

  return genericSystemLibraryFolders.some((word) => normalized === normalizeName(word));
}

function isLikelyGameLibraryFolder(folderPath) {
  const normalized = normalizeName(path.basename(folderPath));

  return likelyGameLibraryFolderWords.some((word) => normalized.includes(normalizeName(word)));
}

function shouldDiscoverChildren(folderPath, rootFolder) {
  if (shouldIgnoreFolder(folderPath)) {
    return false;
  }

  if (isLikelyGameLibraryFolder(folderPath)) {
    return true;
  }

  if (isGenericSystemLibraryFolder(folderPath)) {
    return false;
  }

  return isDriveRoot(rootFolder) && !isSystemDriveRoot(rootFolder);
}

async function addDiscoveredFolderCandidates(rootFolder, candidates) {
  const root = path.resolve(rootFolder);

  if (!isDriveRoot(root)) {
    candidates.push(createCandidate(root, { confidence: 40 }));
  }

  const firstLevel = await listDirectories(root);

  for (const folder of firstLevel) {
    candidates.push(createCandidate(folder));

    if (!shouldDiscoverChildren(folder, root)) {
      continue;
    }

    const children = await listDirectories(folder);

    for (const child of children) {
      candidates.push(createCandidate(child, {
        confidence: isLikelyGameLibraryFolder(folder) ? 25 : 0
      }));

      if (candidates.length >= maxDiscoveredCandidatesPerRoot) {
        return;
      }
    }
  }

  if (!isDriveRoot(root) && isLikelyGameLibraryFolder(root)) {
    const children = await listDirectories(root);

    for (const child of children) {
      candidates.push(createCandidate(child, { confidence: 25 }));

      if (candidates.length >= maxDiscoveredCandidatesPerRoot) {
        return;
      }
    }
  }
}

async function collectCandidates(rootFolder, context) {
  const candidates = [];

  await addSteamCandidates(rootFolder, candidates, context.services.steam);
  await addEpicCandidates(rootFolder, candidates, context.services.epic);
  await addDiscoveredFolderCandidates(rootFolder, candidates);

  return uniqueCandidates(candidates);
}

function getExecutableConfidence(exePath, gameFolder, candidate) {
  const score = scoreExecutable(exePath, gameFolder);
  const exeFolder = path.resolve(path.dirname(exePath)).toLowerCase();
  const folder = path.resolve(gameFolder).toLowerCase();

  if (score >= 320) return 90;
  if (score >= 170) return 78;
  if (score >= 120) return 68;
  if (candidate.confidence >= 40 && exeFolder === folder) return 62;
  if (candidate.confidence >= 25 && exeFolder === folder) return 60;

  return 0;
}

function scoreExecutableConfidence(executableConfidence) {
  if (executableConfidence < minGameConfidence) {
    return 0;
  }

  return Math.max(60, Math.min(90, executableConfidence));
}

function scoreEngineSignals(engineSignals) {
  if (!engineSignals?.score) {
    return 0;
  }

  return Math.max(20, Math.min(60, engineSignals.score));
}

function getOfficialSourceScore(local) {
  return local.isOfficialSource ? 100 : 0;
}

function scoreCandidate(local, online = {}) {
  const sourceScore = getOfficialSourceScore(local);
  const executableScore = scoreExecutableConfidence(local.executableConfidence);
  const engineScore = scoreEngineSignals(local.engineSignals);
  const localCoverScore = local.localCover ? 15 : 0;
  const onlineScore = local.hasLocalEvidence
    ? (online.steamMatch ? onlineSourceScores.steam : 0) + (online.gogMatch ? onlineSourceScores.gog : 0)
    : 0;
  const localScore = sourceScore + executableScore + engineScore + localCoverScore;
  const finalScore = localScore + onlineScore;
  const reasons = [];

  if (sourceScore) reasons.push(`source:${local.source}`);
  if (executableScore) reasons.push(`exe:${local.executableConfidence}`);
  if (engineScore) reasons.push(`engine:${local.engineSignals.reasons.join(",")}`);
  if (localCoverScore) reasons.push("local-cover");
  if (online.steamMatch) reasons.push("steam-match");
  if (online.gogMatch) reasons.push("gog-match");

  return {
    localScore,
    finalScore,
    reasons,
    sourceScore,
    executableScore,
    engineScore,
    localCoverScore,
    onlineScore
  };
}

async function classifyLocalCandidate(candidate, context) {
  const gameFolder = candidate.folder;

  if (!gameFolder || shouldIgnoreFolder(gameFolder)) {
    return rejectLocal(candidate, "ignored-folder");
  }

  const gogInfo = candidate.source === "gog"
    ? null
    : await safeServiceCall(() => context.services.gog.readGogGameInfo(gameFolder), null);
  const exe = await findExecutable(gameFolder, candidate.exe || gogInfo?.exe);

  if (!exe) {
    return rejectLocal(candidate, "no-playable-executable");
  }

  if (shouldIgnoreExe(path.basename(exe))) {
    return rejectLocal(candidate, "ignored-executable", { exe });
  }

  const name = cleanGameName(candidate.name || gogInfo?.name || path.basename(gameFolder));

  if (isKnownNonGameCandidate(candidate, name, exe)) {
    return rejectLocal(candidate, "known-non-game", { exe, name });
  }

  const localCover = await findCover(name);
  const engineSignals = await detectGameSignals(gameFolder, exe);
  const executableConfidence = getExecutableConfidence(exe, gameFolder, candidate);
  const source = candidate.source || (gogInfo ? "gog" : null);
  const isOfficialSource = officialSources.has(source);
  const hasHighExecutableConfidence = executableConfidence >= minGameConfidence;
  const hasEngineEvidence = engineSignals.score > 0;
  const hasLocalEvidence = !!(isOfficialSource || localCover || hasEngineEvidence || hasHighExecutableConfidence);
  const local = {
    candidate,
    gameFolder,
    gogInfo,
    exe,
    name,
    source,
    isOfficialSource,
    localCover,
    engineSignals,
    executableConfidence,
    hasHighExecutableConfidence,
    hasEngineEvidence,
    hasLocalEvidence
  };

  if (!hasLocalEvidence) {
    return {
      status: "rejected",
      reason: "no-local-evidence",
      local,
      score: scoreCandidate(local)
    };
  }

  return {
    status: "plausible",
    reason: "local-evidence",
    local,
    score: scoreCandidate(local)
  };
}

function rejectLocal(candidate, reason, extras = {}) {
  return {
    status: "rejected",
    reason,
    local: {
      candidate,
      gameFolder: candidate.folder,
      name: candidate.name || path.basename(candidate.folder || ""),
      exe: extras.exe || null,
      source: candidate.source || null,
      isOfficialSource: officialSources.has(candidate.source),
      localCover: null,
      engineSignals: { score: 0, reasons: [] },
      executableConfidence: 0,
      hasHighExecutableConfidence: false,
      hasEngineEvidence: false,
      hasLocalEvidence: false
    },
    score: {
      localScore: 0,
      finalScore: 0,
      reasons: []
    }
  };
}

function shouldSearchOnline(local) {
  return !!(
    local.hasLocalEvidence
    && !local.isOfficialSource
  );
}

async function enrichOnlineMetadata(classification, context) {
  const local = classification.local;
  const candidate = local.candidate;
  const online = {
    steamAssets: null,
    steamMatch: null,
    gogMatch: null,
    onlineSearched: false,
    coverSource: null
  };

  if (candidate.source === "steam" && candidate.sourceId) {
    online.steamAssets = await safeServiceCall(
      () => context.services.steam.getSteamAppAssets(candidate.sourceId),
      null
    );
    online.coverSource = online.steamAssets?.cover ? "steam-assets" : null;
  }

  if (!shouldSearchOnline(local)) {
    return online;
  }

  online.onlineSearched = true;

  const [steamMatch, gogMatch] = await Promise.all([
    context.services.steam.findSteamAppByName
      ? safeServiceCall(() => context.services.steam.findSteamAppByName(local.name), null)
      : null,
    context.services.gog.findGogGameByName
      ? safeServiceCall(() => context.services.gog.findGogGameByName(local.name), null)
      : null
  ]);

  online.steamMatch = steamMatch;
  online.gogMatch = gogMatch;

  if (steamMatch?.cover) {
    online.coverSource = "steam-search";
  } else if (gogMatch?.cover) {
    online.coverSource = "gog-search";
  }

  return online;
}

function pickCover(entries) {
  const unique = [];
  const seen = new Set();

  for (const entry of entries) {
    const value = typeof entry === "string" ? entry : entry?.value;
    const source = typeof entry === "string" ? "unknown" : entry?.source;

    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    unique.push({ value, source: source || "unknown" });
  }

  return {
    cover: unique[0]?.value || null,
    fallbackCover: unique[1]?.value || null,
    coverSources: unique.map((entry) => entry.value),
    coverSource: unique[0]?.source || "none"
  };
}

function getProvider(local, online) {
  return local.source
    || (local.engineSignals.score > 0 ? "detected" : null)
    || (local.executableConfidence >= minGameConfidence ? "local" : null)
    || (online.steamMatch ? "steam" : null)
    || (online.gogMatch ? "gog" : null)
    || "local";
}

function buildGame(local, online, score) {
  const candidate = local.candidate;
  const { cover, fallbackCover, coverSources, coverSource } = pickCover([
    { value: candidate.cover, source: `${candidate.source || "candidate"}-cover` },
    { value: online.steamAssets?.cover, source: "steam-assets" },
    { value: candidate.fallbackCover, source: `${candidate.source || "candidate"}-fallback` },
    { value: online.steamAssets?.fallbackCover, source: "steam-assets-fallback" },
    { value: online.steamMatch?.cover, source: "steam-search" },
    { value: online.steamMatch?.fallbackCover, source: "steam-search-fallback" },
    { value: online.gogMatch?.cover, source: "gog-search" },
    { value: local.localCover, source: "local-cover" }
  ]);
  const provider = getProvider(local, online);

  return {
    name: local.name,
    exe: local.exe,
    folder: local.gameFolder,
    cover,
    fallbackCover,
    coverSources,
    coverSource,
    launchUri: candidate.launchUri
      || local.gogInfo?.launchUri
      || (candidate.source === "steam" && candidate.sourceId ? steam.getSteamLaunchUri(candidate.sourceId) : null)
      || (online.steamMatch?.appId ? steam.getSteamLaunchUri(online.steamMatch.appId) : null),
    fallbackLaunchUri: candidate.fallbackLaunchUri || null,
    epicNamespace: candidate.epicNamespace || null,
    epicCatalogItemId: candidate.epicCatalogItemId || null,
    sourceId: candidate.sourceId || online.steamMatch?.appId || local.gogInfo?.appId || online.gogMatch?.appId || null,
    steamAppId: candidate.source === "steam" ? candidate.sourceId : online.steamMatch?.appId || null,
    gogAppId: local.gogInfo?.appId || online.gogMatch?.appId || null,
    provider,
    developer: candidate.developer || null,
    publisher: candidate.publisher || null,
    sizeBytes: candidate.sizeBytes || null,
    confidence: score.finalScore,
    localScore: score.localScore,
    finalScore: score.finalScore,
    reasons: score.reasons
  };
}

function shouldPendingConservative(local, score, context) {
  if (!context.conservative || local.isOfficialSource) {
    return false;
  }

  if (!local.hasHighExecutableConfidence && !local.hasEngineEvidence) {
    return true;
  }

  return score.finalScore < context.threshold;
}

function createPendingCandidate(local, score, reason) {
  return {
    name: local.name,
    exe: local.exe,
    folder: local.gameFolder,
    provider: local.source || "local",
    localScore: score.localScore,
    finalScore: score.finalScore,
    executableConfidence: local.executableConfidence,
    engineSignals: local.engineSignals,
    reason
  };
}

function logDecision(context, status, local, score, details = {}) {
  const onlineText = details.onlineSearched ? "online=yes" : "online=no";
  const coverText = `cover=${details.coverSource || "none"}`;
  const exeText = local.exe ? path.basename(local.exe) : "none";
  const name = local.name || local.candidate?.name || path.basename(local.gameFolder || "");
  const reason = details.reason || score.reasons?.join(",") || "none";
  const line = `[MOB Deck][scanner] ${status} "${name}" exe=${exeText} local=${score.localScore || 0} final=${score.finalScore || 0} ${onlineText} ${coverText} reason=${reason}`;

  context.diagnostics.push({
    status,
    name,
    exe: local.exe || null,
    folder: local.gameFolder || null,
    localScore: score.localScore || 0,
    finalScore: score.finalScore || 0,
    onlineSearched: !!details.onlineSearched,
    coverSource: details.coverSource || "none",
    reason
  });

  if (context.log && context.logger?.log) {
    context.logger.log(line);
  }
}

function logSummary(context, candidateCount) {
  if (!context.log || !context.logger?.log) {
    return;
  }

  context.logger.log(
    `[MOB Deck][scanner] resumo candidates=${candidateCount} accepted=${context.counts.accepted} rejected=${context.counts.rejected} pending=${context.counts.pending} online=${context.counts.onlineEnriched}`
  );
}

async function safeServiceCall(fn, fallback) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function scanDetailed(rootFolder, options = {}) {
  const context = createScanContext({ ...options, detailed: true });
  const candidates = await collectCandidates(rootFolder, context);
  const games = [];
  const pendingCandidates = [];

  for (const candidate of candidates) {
    const classification = await classifyLocalCandidate(candidate, context);

    if (classification.status === "rejected") {
      context.counts.rejected += 1;
      logDecision(context, "reject", classification.local, classification.score, {
        reason: classification.reason,
        onlineSearched: false
      });
      continue;
    }

    const online = await enrichOnlineMetadata(classification, context);
    const score = scoreCandidate(classification.local, online);
    const coverSource = online.coverSource
      || (classification.local.localCover ? "local-cover" : null)
      || (classification.local.candidate.cover ? "candidate-cover" : null);

    if (online.onlineSearched && (online.steamMatch || online.gogMatch)) {
      context.counts.onlineEnriched += 1;
    }

    if (shouldPendingConservative(classification.local, score, context)) {
      context.counts.pending += 1;
      pendingCandidates.push(createPendingCandidate(classification.local, score, "conservative-review"));
      logDecision(context, "pending", classification.local, score, {
        reason: "conservative-review",
        onlineSearched: online.onlineSearched,
        coverSource
      });
      continue;
    }

    if (score.finalScore < context.threshold) {
      context.counts.rejected += 1;
      logDecision(context, "reject", classification.local, score, {
        reason: "score-below-threshold",
        onlineSearched: online.onlineSearched,
        coverSource
      });
      continue;
    }

    const game = buildGame(classification.local, online, score);

    context.counts.accepted += 1;
    games.push(game);
    logDecision(context, "accept", classification.local, score, {
      reason: score.reasons.join(",") || "score",
      onlineSearched: online.onlineSearched,
      coverSource: game.coverSource || coverSource
    });
  }

  games.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  logSummary(context, candidates.length);

  return {
    games,
    pendingCandidates,
    diagnostics: context.diagnostics,
    summary: {
      candidates: candidates.length,
      ...context.counts
    }
  };
}

async function scan(rootFolder, options = {}) {
  const result = await scanDetailed(rootFolder, {
    ...options,
    detailed: !!options.detailed
  });

  return options.detailed ? result : result.games;
}

async function getFolderSize(folder) {
  if (!folder || !(await exists(folder))) return null;

  const stack = [folder];
  let total = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];

    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);

      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }

      if (!entry.isFile()) continue;

      try {
        const stats = await fs.stat(entryPath);
        total += stats.size;
      } catch {
        // Ignore files that disappear or cannot be read.
      }
    }
  }

  return total;
}

async function getDetails(game) {
  const details = {
    name: game?.name || "Jogo",
    fullName: game?.name || "Jogo",
    exe: game?.exe || null,
    folder: game?.folder || null,
    provider: game?.provider || "detected",
    developer: game?.developer || null,
    publisher: game?.publisher || null,
    genres: [],
    releaseDate: null,
    description: null,
    website: null,
    sizeBytes: game?.sizeBytes || null,
    playtimeMinutes: null,
    lastPlayed: null
  };

  if (game?.steamAppId) {
    const [steamDetails, playtime] = await Promise.all([
      steam.getSteamAppDetails(game.steamAppId),
      steam.getSteamPlaytime(game.steamAppId)
    ]);

    if (steamDetails) {
      details.fullName = steamDetails.fullName || details.fullName;
      details.developer = steamDetails.developer || details.developer;
      details.publisher = steamDetails.publisher || details.publisher;
      details.genres = steamDetails.genres || details.genres;
      details.releaseDate = steamDetails.releaseDate || details.releaseDate;
      details.description = steamDetails.description || details.description;
      details.website = steamDetails.website || details.website;
    }

    if (playtime) {
      details.playtimeMinutes = playtime.minutes;
      details.lastPlayed = playtime.lastPlayed;
    }
  }

  if (!details.sizeBytes && details.folder) {
    details.sizeBytes = await getFolderSize(details.folder);
  }

  return details;
}

module.exports = {
  getDetails,
  scan,
  scanDetailed,
  _internals: {
    classifyLocalCandidate,
    collectCandidates,
    detectGameSignals,
    enrichOnlineMetadata,
    getExecutableConfidence,
    scoreCandidate,
    shouldIgnoreExe,
    shouldIgnoreFolder
  }
};
