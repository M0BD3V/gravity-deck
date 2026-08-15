const fs = require("fs/promises");
const { execFile } = require("child_process");
const electron = require("electron");
const os = require("os");
const path = require("path");
const { promisify } = require("util");
const { decorateCatalogApp, matchCatalogItem } = require("../catalog/appCatalog");

const execFileAsync = promisify(execFile);
const electronShell = electron?.shell || null;

const shortcutExtensions = new Set([".lnk"]);

const ignoredNameWords = [
  "uninstall", "unins", "readme", "license", "help", "documentation",
  "manual", "website", "support", "update", "crash reporter",
  "ajuda", "desinstalar", "faq", "frequently asked questions",
  "release notes", "reference", "samples", "safe mode", "bug report",
  "install manager", "developer command prompt", "developer powershell",
  "module docs", "pydoc", "idle", "skin format", "localization reference",
  "o que ha de novo", "what s new", "more", "additional tools", "mob deck"
];

const noisyMicrosoftApps = [
  "accessibility insights", "app installer", "calculator", "calendar",
  "clipchamp", "clock", "copilot", "dev home", "family", "feedback",
  "filmes e tv", "films and tv", "maps", "mail", "notepad", "office",
  "one drive", "onedrive", "people", "photos", "solitaire", "teams",
  "to do", "weather", "whiteboard", "windows backup", "xbox game bar"
];

const nativeWindowsNames = new Set([
  "administrative tools",
  "access",
  "character map",
  "command prompt",
  "component services",
  "computer management",
  "control panel",
  "defragment and optimize drives",
  "disk cleanup",
  "event viewer",
  "file explorer",
  "get help",
  "internet explorer",
  "magnifier",
  "microsoft edge",
  "microsoft store",
  "narrator",
  "notepad",
  "odbc data sources",
  "on screen keyboard",
  "paint",
  "paint 3d",
  "power automate",
  "powershell",
  "quick assist",
  "recovery drive",
  "remote desktop connection",
  "resource monitor",
  "run",
  "services",
  "settings",
  "skype",
  "snipping tool",
  "steps recorder",
  "system configuration",
  "system information",
  "task manager",
  "task scheduler",
  "windows defender firewall",
  "windows memory diagnostic",
  "windows powershell",
  "windows security",
  "windows tools",
  "wordpad"
]);

const nativeWindowsNamePhrases = [
  "acao com um clique",
  "acesso de voz",
  "accessibility",
  "agendador de tarefas",
  "administrative tool",
  "app installer",
  "assistencia rapida",
  "backup do windows",
  "bluetooth file transfer",
  "calendario",
  "clipchamp",
  "copilot",
  "configuracao do sistema",
  "configuracoes",
  "dev home",
  "desfragmentar",
  "diagnostico de memoria",
  "editor do registro",
  "email",
  "feedback hub",
  "firewall",
  "fontes de dados odbc",
  "fotos",
  "gerenciador de tarefas",
  "gerenciamento de impressao",
  "gerenciamento do computador",
  "gravador de passos",
  "media player",
  "microsoft news",
  "microsoft photos",
  "microsoft teams",
  "nvidia control panel",
  "one note",
  "onenote",
  "outlook",
  "paint 3d",
  "magnify",
  "mixed reality",
  "noticias",
  "painel de controle",
  "phone link",
  "power automate",
  "print management",
  "problem steps recorder",
  "remote assistance",
  "seguranca do windows",
  "terminal",
  "tempo",
  "windows backup",
  "windows fax",
  "windows media",
  "windows speech",
  "windows terminal",
  "voiceaccess",
  "visualizador 3d",
  "xbox",
  "your phone"
];

const nativeWindowsFolderPhrases = [
  "administrative tools",
  "windows accessories",
  "windows administrative tools",
  "windows ease of access",
  "windows powershell",
  "windows system",
  "system tools"
];

const nativeStartAppIdPrefixes = [
  "MicrosoftWindows.",
  "Microsoft.Bing",
  "Microsoft.DesktopAppInstaller",
  "Microsoft.GetHelp",
  "Microsoft.Getstarted",
  "Microsoft.MicrosoftEdge",
  "Microsoft.MicrosoftOfficeHub",
  "Microsoft.Microsoft3DViewer",
  "Microsoft.MicrosoftSolitaireCollection",
  "Microsoft.MicrosoftStickyNotes",
  "Microsoft.MSPaint",
  "Microsoft.Office.OneNote",
  "Microsoft.OutlookForWindows",
  "Microsoft.Paint",
  "Microsoft.PowerAutomateDesktop",
  "Microsoft.ScreenSketch",
  "Microsoft.SecHealthUI",
  "Microsoft.SkypeApp",
  "Microsoft.StorePurchaseApp",
  "Microsoft.Todos",
  "Microsoft.Windows.",
  "Microsoft.WindowsAlarms",
  "Microsoft.WindowsCalculator",
  "Microsoft.WindowsCamera",
  "Microsoft.WindowsFeedbackHub",
  "Microsoft.WindowsMaps",
  "Microsoft.WindowsNotepad",
  "Microsoft.WindowsSoundRecorder",
  "Microsoft.WindowsStore",
  "Microsoft.Xbox",
  "Microsoft.YourPhone",
  "Microsoft.Zune"
];

const steamCoverBaseUrl = "https://cdn.cloudflare.steamstatic.com/steam/apps";

const gameLauncherWords = [
  "minecraft launcher", "minecraft for windows", "minecraft", "mine launcher",
  "roblox player", "roblox", "lunar client",
  "badlion client", "modrinth", "technic launcher",
  "prismlauncher", "multi mc", "multimc", "atlauncher",
  "hytale", "hytale launcher"
];

const appToolWords = [
  "roblox studio"
];

const gameAppIdWords = [
  "minecraft", "mojang", "4297127d64ec6", "roblox", "robloxcorporation",
  "hytale", "hypixel"
];

const userInstalledTargetFolders = [
  "program files",
  "program files x86",
  "appdata local programs",
  "appdata local",
  "appdata roaming",
  "users public desktop"
];

const blockedTargetFolders = [
  "windows system32",
  "windows syswow64",
  "windows servicing",
  "windows winsxs",
  "microsoft windows start menu programs administrative tools"
];

function getStartMenuRoots() {
  return [
    process.env.ProgramData
      ? path.join(process.env.ProgramData, "Microsoft", "Windows", "Start Menu", "Programs")
      : null,
    process.env.APPDATA
      ? path.join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs")
      : null,
    path.join(os.homedir(), "Desktop"),
    process.env.PUBLIC ? path.join(process.env.PUBLIC, "Desktop") : null
  ].filter(Boolean);
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanName(fileName) {
  return path.basename(fileName, path.extname(fileName))
    .replace(/\s*-\s*shortcut$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldIgnoreName(name) {
  const normalized = normalizeName(name);

  return ignoredNameWords.some((word) => normalized.includes(normalizeName(word)));
}

function classifyApp(name, appId = "", launchUri = "") {
  if (
    String(appId).toLowerCase().startsWith("steam://rungameid/")
    || String(launchUri).toLowerCase().startsWith("steam://rungameid/")
  ) {
    return "game";
  }

  const normalized = normalizeName(name);
  const normalizedAppId = normalizeName(appId);
  const isAppTool = appToolWords.some((word) => normalized.includes(normalizeName(word)));
  const isGameLauncher = gameLauncherWords.some((word) => normalized.includes(normalizeName(word)));
  const isGameAppId = gameAppIdWords.some((word) => normalizedAppId.includes(normalizeName(word)));

  return !isAppTool && (isGameLauncher || isGameAppId) ? "game" : "app";
}

function getSteamAppId(appId) {
  const match = String(appId || "").match(/steam:\/\/rungameid\/(\d+)/i);

  return match ? match[1] : null;
}

function readShortcut(shortcutPath) {
  if (!electronShell?.readShortcutLink || path.extname(shortcutPath).toLowerCase() !== ".lnk") {
    return null;
  }

  try {
    return electronShell.readShortcutLink(shortcutPath);
  } catch {
    return null;
  }
}

function findLaunchUri(...values) {
  const text = values
    .filter(Boolean)
    .map((value) => String(value))
    .join(" ");
  const match = text.match(/(steam:\/\/rungameid\/\d+|com\.epicgames\.launcher:\/\/[^\s"']+|goggalaxy:\/\/[^\s"']+)/i);

  return match ? match[1] : null;
}

function cleanIconTarget(value) {
  const text = String(value || "").trim().replace(/^"|"$/g, "");
  const iconIndexMatch = text.match(/^(.+?\.(?:exe|ico|dll)),\d+$/i);

  return iconIndexMatch ? iconIndexMatch[1] : text;
}

function resolveExecutableAppId(appId) {
  const value = String(appId || "");

  if (/^[a-z]:\\/i.test(value)) {
    return value;
  }

  return value
    .replace(/^\{6D809377-6AF0-444B-8957-A3773F02200E\}/i, process.env.ProgramFiles || "C:\\Program Files")
    .replace(/^\{7C5A40EF-A0FB-4BFC-874A-C0F2E0B9FA8E\}/i, process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)");
}

function isNativeWindowsApp(app) {
  if (app.category === "game") {
    return false;
  }

  const normalized = normalizeName(app.name);
  const folder = normalizeName(app.folder);
  const appId = String(app.appId || "");

  if (nativeWindowsNames.has(normalized)) {
    return true;
  }

  if (nativeWindowsNamePhrases.some((phrase) => normalized.includes(normalizeName(phrase)))) {
    return true;
  }

  if (noisyMicrosoftApps.some((phrase) => normalized.includes(normalizeName(phrase)))) {
    return true;
  }

  if (nativeWindowsFolderPhrases.some((phrase) => folder.includes(normalizeName(phrase)))) {
    return true;
  }

  if (app.source === "start-app" && nativeStartAppIdPrefixes.some((prefix) => appId.startsWith(prefix))) {
    return true;
  }

  if (app.source === "start-app" && (appId.startsWith("{") || appId.startsWith("Microsoft.AutoGenerated."))) {
    return true;
  }

  return false;
}

function shouldKeepApp(app) {
  if (isNativeWindowsApp(app)) {
    return false;
  }

  if (app.category === "game") {
    return true;
  }

  if (app.source === "start-app") {
    return isLikelyUserStoreApp(app);
  }

  if (app.source === "lnk") {
    return isLikelyUserInstalledShortcut(app);
  }

  return false;
}

function isLikelyUserStoreApp(app) {
  const appId = String(app.appId || "");

  if (!appId || appId.startsWith("Microsoft.AutoGenerated.")) {
    return false;
  }

  if (/^https?:/i.test(appId)) {
    return false;
  }

  if (isLikelyExecutableAppId(appId)) {
    return true;
  }

  if (appId.startsWith("{")) {
    return false;
  }

  if (nativeStartAppIdPrefixes.some((prefix) => appId.startsWith(prefix))) {
    return false;
  }

  return true;
}

function isLikelyExecutableAppId(appId) {
  const text = normalizePath(appId);

  if (!/\.exe/i.test(appId)) {
    return false;
  }

  if (text.includes(" windows ") || text.includes("windows system32") || text.includes("windows syswow64")) {
    return false;
  }

  if (/^\{6d809377-6af0-444b-8957-a3773f02200e\}/i.test(appId)
    || /^\{7c5a40ef-a0fb-4bfc-874a-c0f2e0b9fa8e\}/i.test(appId)) {
    return true;
  }

  return userInstalledTargetFolders.some((folder) => text.includes(normalizeName(folder)))
    || text.includes("appdata local")
    || text.includes("program files");
}

function isLikelyUserInstalledShortcut(app) {
  const targetText = normalizePath([
    app.target,
    app.iconTarget
  ].filter(Boolean).join(" "));
  const shortcutText = normalizePath([app.exe, app.folder].filter(Boolean).join(" "));
  const text = `${targetText} ${shortcutText}`.trim();

  if (!text) {
    return false;
  }

  if (blockedTargetFolders.some((folder) => targetText.includes(normalizeName(folder)))) {
    return false;
  }

  if (targetText.includes(" windows ") || targetText.includes(" windowsapps microsoft windows")) {
    return false;
  }

  if (userInstalledTargetFolders.some((folder) => text.includes(normalizeName(folder)))) {
    return true;
  }

  return app.folder && normalizePath(app.folder).includes("start menu programs");
}

function normalizePath(value) {
  return normalizeName(String(value || "").replace(/[\\/]+/g, " "));
}

async function walkShortcuts(root) {
  const shortcuts = [];
  const stack = [root];

  while (stack.length) {
    const current = stack.pop();
    let entries = [];

    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();

      if (!shortcutExtensions.has(extension)) {
        continue;
      }

      const name = cleanName(entry.name);
      const shortcut = readShortcut(entryPath);
      const launchUri = findLaunchUri(shortcut?.target, shortcut?.args);
      const steamAppId = getSteamAppId(launchUri);
      const iconTarget = cleanIconTarget(shortcut?.icon || shortcut?.target);

      if (!name || shouldIgnoreName(name)) {
        continue;
      }

      shortcuts.push({
        name,
        exe: entryPath,
        target: shortcut?.target || null,
        arguments: shortcut?.args || null,
        iconTarget: iconTarget || null,
        folder: path.dirname(entryPath),
        provider: steamAppId ? "steam" : "app",
        source: extension.slice(1),
        category: classifyApp(name, "", launchUri),
        launchUri,
        cover: steamAppId ? `${steamCoverBaseUrl}/${steamAppId}/library_600x900_2x.jpg` : null,
        fallbackCover: steamAppId ? `${steamCoverBaseUrl}/${steamAppId}/header.jpg` : null,
        steamAppId,
        sourceId: steamAppId || null,
        confidence: 100
      });
    }
  }

  return shortcuts;
}

async function scan() {
  const byName = new Map();

  for (const root of getStartMenuRoots()) {
    const shortcuts = await walkShortcuts(root);

    for (const app of shortcuts) {
      const catalogItem = matchCatalogItem(app);

      if (!catalogItem) {
        continue;
      }

      const catalogApp = decorateScannedApp(app, catalogItem);
      const key = catalogApp.appCatalogId;
      const existing = byName.get(key);

      if (!existing || scoreApp(catalogApp) > scoreApp(existing)) {
        byName.set(key, catalogApp);
      }
    }
  }

  for (const app of await readStartApps()) {
    const catalogItem = matchCatalogItem(app);

    if (!catalogItem) {
      continue;
    }

    const catalogApp = decorateScannedApp(app, catalogItem);
    const key = catalogApp.appCatalogId;
    const existing = byName.get(key);

    if (!existing || scoreApp(catalogApp) > scoreApp(existing)) {
      byName.set(key, catalogApp);
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function readStartApps() {
  if (process.platform !== "win32") {
    return [];
  }

  try {
    const encodingSetup = [
      "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()",
      "$OutputEncoding = [Console]::OutputEncoding"
    ].join("; ");
    const command = [
      encodingSetup,
      ";",
      "Get-StartApps",
      "|",
      "Select-Object",
      "Name,AppID",
      "|",
      "ConvertTo-Json",
      "-Compress"
    ].join(" ");
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      {
        timeout: 12000,
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 4
      }
    );
    const parsed = JSON.parse(stdout || "[]");
    const items = Array.isArray(parsed) ? parsed : [parsed];

    return items
      .filter((item) => item?.Name && item?.AppID)
      .map((item) => {
        const name = String(item.Name).trim();
        const appId = String(item.AppID);
        const steamAppId = getSteamAppId(appId);
        const category = classifyApp(name, appId);
        const iconTarget = /\.exe/i.test(appId) ? resolveExecutableAppId(appId) : null;

        return {
          name,
          exe: `shell:AppsFolder\\${appId}`,
          target: iconTarget,
          iconTarget,
          folder: "shell:AppsFolder",
          provider: category === "game" && steamAppId ? "steam" : "app",
          appId,
          sourceId: steamAppId || appId,
          source: "start-app",
          category,
          launchUri: steamAppId ? appId : null,
          cover: steamAppId ? `${steamCoverBaseUrl}/${steamAppId}/library_600x900_2x.jpg` : null,
          fallbackCover: steamAppId ? `${steamCoverBaseUrl}/${steamAppId}/header.jpg` : null,
          steamAppId,
          confidence: 100
        };
      })
      .filter((item) => !shouldIgnoreName(item.name));
  } catch {
    return [];
  }
}

function scoreApp(app) {
  let score = 0;

  if (app.category === "game") score += 20;
  if (app.source === "lnk") score += 10;
  if (app.source === "start-app") score += 8;
  if (app.folder.toLowerCase().includes("start menu")) score += 5;

  return score;
}

function decorateScannedApp(appItem, catalogItem) {
  const catalogApp = decorateCatalogApp(appItem, catalogItem);

  if (appItem.category !== "game") {
    return catalogApp;
  }

  return {
    ...catalogApp,
    category: "game",
    provider: "app",
    sourceId: appItem.sourceId || appItem.appId || catalogItem.id,
    launchUri: appItem.launchUri || catalogApp.launchUri || null,
    fallbackLaunchUri: appItem.fallbackLaunchUri || catalogApp.fallbackLaunchUri || null,
    cover: appItem.cover || catalogApp.cover || null,
    fallbackCover: appItem.fallbackCover || catalogApp.fallbackCover || null
  };
}

module.exports = {
  scan
};
