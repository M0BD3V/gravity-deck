const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const STORE_SEARCH_URL = "https://store.steampowered.com/api/storesearch/";
const STEAM_COVER_BASE_URL = "https://cdn.cloudflare.steamstatic.com/steam/apps";
const FETCH_TIMEOUT_MS = 8000;

const storeSearchCache = new Map();
const appAssetsCache = new Map();
const appDetailsCache = new Map();
const playtimeCache = new Map();

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|edition|deluxe|definitive|ultimate|complete|goty)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactName(value) {
  return normalizeName(value).replace(/\s+/g, "");
}

function getSteamCoverUrl(appId) {
  return `${STEAM_COVER_BASE_URL}/${appId}/library_600x900_2x.jpg`;
}

function getSteamLaunchUri(appId) {
  return `steam://rungameid/${appId}`;
}

async function getSteamAppAssets(appId) {
  const cacheKey = String(appId || "");

  if (!cacheKey) return null;

  if (!appAssetsCache.has(cacheKey)) {
    const url = new URL("https://store.steampowered.com/api/appdetails");
    url.searchParams.set("appids", cacheKey);
    url.searchParams.set("filters", "basic");

    const assetsPromise = fetchJson(url.toString())
      .then((data) => {
        const details = data?.[cacheKey]?.data;

        return {
          appId: cacheKey,
          name: details?.name || null,
          cover: getSteamCoverUrl(cacheKey),
          fallbackCover: details?.header_image || details?.capsule_image || details?.capsule_imagev5 || null
        };
      })
      .catch(() => ({
        appId: cacheKey,
        name: null,
        cover: getSteamCoverUrl(cacheKey),
        fallbackCover: null
      }));

    appAssetsCache.set(cacheKey, assetsPromise);
  }

  return appAssetsCache.get(cacheKey);
}

function parseSteamManifest(content) {
  const values = {};
  const pattern = /"([^"]+)"\s+"([^"]*)"/g;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    values[match[1].toLowerCase()] = match[2];
  }

  if (!values.appid || !values.installdir) return null;

  return {
    appId: values.appid,
    name: values.name || values.installdir,
    installDir: values.installdir,
    sizeBytes: Number(values.sizeondisk) || null
  };
}

async function readSteamLibraryGames(steamAppsFolder) {
  try {
    const entries = await fs.readdir(steamAppsFolder, { withFileTypes: true });
    const manifests = entries
      .filter((entry) => entry.isFile())
      .filter((entry) => /^appmanifest_\d+\.acf$/i.test(entry.name));

    const games = [];

    for (const manifest of manifests) {
      const manifestPath = path.join(steamAppsFolder, manifest.name);
      const content = await fs.readFile(manifestPath, "utf8");
      const game = parseSteamManifest(content);

      if (!game) continue;

      games.push({
        appId: game.appId,
        name: game.name,
        folder: path.join(steamAppsFolder, "common", game.installDir),
        cover: getSteamCoverUrl(game.appId),
        fallbackCover: null,
        launchUri: getSteamLaunchUri(game.appId),
        sizeBytes: game.sizeBytes
      });
    }

    return games;
  } catch {
    return [];
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Steam API respondeu ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function searchSteamStore(gameName) {
  const cacheKey = normalizeName(gameName);

  if (!cacheKey) return [];

  if (!storeSearchCache.has(cacheKey)) {
    const url = new URL(STORE_SEARCH_URL);
    url.searchParams.set("term", gameName);
    url.searchParams.set("l", "english");
    url.searchParams.set("cc", "US");

    const searchPromise = fetchJson(url.toString())
      .then((data) => {
        const items = data?.items;

        if (!Array.isArray(items)) return [];

        return items
          .filter((item) => item?.type === "app" && item?.id && item?.name)
          .map((item) => ({
            appId: String(item.id),
            name: item.name,
            tinyImage: item.tiny_image || null,
            normalizedName: normalizeName(item.name),
            compactName: compactName(item.name)
          }));
      })
      .catch(() => []);

    storeSearchCache.set(cacheKey, searchPromise);
  }

  return storeSearchCache.get(cacheKey);
}

function scoreAppNameMatch(gameName, steamApp) {
  const normalizedGame = normalizeName(gameName);
  const compactGame = compactName(gameName);

  if (!normalizedGame) return 0;
  if (steamApp.normalizedName === normalizedGame) return 1000;
  if (steamApp.compactName === compactGame) return 980;

  if (compactGame.length >= 6 && steamApp.compactName.includes(compactGame)) {
    return 760 - Math.abs(steamApp.compactName.length - compactGame.length);
  }

  if (steamApp.compactName.length >= 6 && compactGame.includes(steamApp.compactName)) {
    return 730 - Math.abs(steamApp.compactName.length - compactGame.length);
  }

  if (compactGame.length >= 8 && steamApp.compactName.length >= 8) {
    const distance = levenshteinDistance(compactGame, steamApp.compactName);

    if (distance <= 2) {
      return 940 - distance * 25;
    }
  }

  const gameTokens = normalizedGame.split(" ").filter((token) => token.length > 2);
  const steamTokens = steamApp.normalizedName.split(" ").filter((token) => token.length > 2);
  const matchingTokens = gameTokens.filter((token) => steamTokens.includes(token)).length;

  if (gameTokens.length >= 2 && matchingTokens >= gameTokens.length - 1) {
    return 900 - Math.abs(steamTokens.length - gameTokens.length) * 18;
  }

  return 0;
}

async function findSteamAppByName(gameName) {
  const apps = await searchSteamStore(gameName);
  let bestMatch = null;
  let bestScore = 0;

  for (const app of apps) {
    const score = scoreAppNameMatch(gameName, app);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = app;
    }
  }

  if (!bestMatch || bestScore < 900) return null;

  const [assets, details] = await Promise.all([
    getSteamAppAssets(bestMatch.appId),
    getSteamAppDetails(bestMatch.appId)
  ]);

  if (details?.type && details.type !== "game") {
    return null;
  }

  return {
    appId: bestMatch.appId,
    name: bestMatch.name,
    cover: assets?.cover || getSteamCoverUrl(bestMatch.appId),
    fallbackCover: assets?.fallbackCover || bestMatch.tinyImage || null
  };
}

async function getSteamAppDetails(appId) {
  const cacheKey = String(appId || "");

  if (!cacheKey) return null;

  if (!appDetailsCache.has(cacheKey)) {
    const url = new URL("https://store.steampowered.com/api/appdetails");
    url.searchParams.set("appids", cacheKey);
    url.searchParams.set("l", "brazilian");
    url.searchParams.set("cc", "BR");

    const detailsPromise = fetchJson(url.toString())
      .then((data) => {
        const details = data?.[cacheKey]?.data;

        if (!details) return null;

        return {
          appId: cacheKey,
          type: details.type || null,
          fullName: details.name || null,
          developer: Array.isArray(details.developers) ? details.developers.join(", ") : null,
          publisher: Array.isArray(details.publishers) ? details.publishers.join(", ") : null,
          genres: Array.isArray(details.genres) ? details.genres.map((genre) => genre.description).filter(Boolean) : [],
          releaseDate: details.release_date?.date || null,
          description: details.short_description || null,
          website: details.website || null,
          headerImage: details.header_image || null
        };
      })
      .catch(() => null);

    appDetailsCache.set(cacheKey, detailsPromise);
  }

  return appDetailsCache.get(cacheKey);
}

function levenshteinDistance(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }

    for (let j = 0; j <= b.length; j++) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function getSteamUserdataFolders() {
  const roots = [
    process.env["ProgramFiles(x86)"] ? path.join(process.env["ProgramFiles(x86)"], "Steam", "userdata") : null,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "Steam", "userdata") : null,
    path.join(os.homedir(), "AppData", "Local", "Steam", "userdata")
  ].filter(Boolean);

  return [...new Set(roots)];
}

function readVdfNumber(block, key) {
  const match = block.match(new RegExp(`"${key}"\\s+"(\\d+)"`, "i"));
  return match ? Number(match[1]) : null;
}

function extractAppBlock(content, appId) {
  const marker = `"${appId}"`;
  const start = content.indexOf(marker);

  if (start === -1) return null;

  const open = content.indexOf("{", start + marker.length);

  if (open === -1) return null;

  let depth = 0;

  for (let index = open; index < content.length; index++) {
    const char = content[index];

    if (char === "{") depth++;
    if (char === "}") depth--;
    if (depth === 0) return content.slice(open, index + 1);
  }

  return null;
}

async function getSteamPlaytime(appId) {
  const cacheKey = String(appId || "");

  if (!cacheKey) return null;

  if (!playtimeCache.has(cacheKey)) {
    const playtimePromise = (async () => {
      let best = null;

      for (const userdataFolder of getSteamUserdataFolders()) {
        let users = [];

        try {
          users = await fs.readdir(userdataFolder, { withFileTypes: true });
        } catch {
          continue;
        }

        for (const user of users) {
          if (!user.isDirectory()) continue;

          const configPath = path.join(userdataFolder, user.name, "config", "localconfig.vdf");

          try {
            const content = await fs.readFile(configPath, "utf8");
            const appBlock = extractAppBlock(content, cacheKey);

            if (!appBlock) continue;

            const minutes = readVdfNumber(appBlock, "PlaytimeForever")
              ?? readVdfNumber(appBlock, "Playtime")
              ?? readVdfNumber(appBlock, "playtime_forever");

            const lastPlayed = readVdfNumber(appBlock, "LastPlayed");

            if (minutes !== null && (best === null || minutes > best.minutes)) {
              best = { minutes, lastPlayed };
            }
          } catch {
            // Ignore unreadable local Steam profiles.
          }
        }
      }

      return best;
    })();

    playtimeCache.set(cacheKey, playtimePromise);
  }

  return playtimeCache.get(cacheKey);
}

module.exports = {
  findSteamAppByName,
  getSteamAppAssets,
  getSteamAppDetails,
  getSteamPlaytime,
  getSteamCoverUrl,
  getSteamLaunchUri,
  readSteamLibraryGames
};
