const fs = require("fs/promises");
const path = require("path");

const CATALOG_SEARCH_URL = "https://catalog.gog.com/v1/catalog";
const FETCH_TIMEOUT_MS = 8000;

const searchCache = new Map();

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

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`GOG API respondeu ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function searchGogCatalog(gameName) {
  const cacheKey = normalizeName(gameName);

  if (!cacheKey) return [];

  if (!searchCache.has(cacheKey)) {
    const url = new URL(CATALOG_SEARCH_URL);
    url.searchParams.set("limit", "8");
    url.searchParams.set("query", gameName);
    url.searchParams.set("locale", "en-US");
    url.searchParams.set("countryCode", "US");

    const searchPromise = fetchJson(url.toString())
      .then((data) => {
        const products = data?.products;

        if (!Array.isArray(products)) return [];

        return products
          .filter((product) => product?.title)
          .map((product) => ({
            appId: String(product.id || product.slug || product.title),
            name: product.title,
            cover: product.coverVertical || product.coverHorizontal || null,
            normalizedName: normalizeName(product.title),
            compactName: compactName(product.title)
          }));
      })
      .catch(() => []);

    searchCache.set(cacheKey, searchPromise);
  }

  return searchCache.get(cacheKey);
}

function scoreNameMatch(gameName, product) {
  const normalizedGame = normalizeName(gameName);
  const compactGame = compactName(gameName);

  if (!normalizedGame) return 0;
  if (product.normalizedName === normalizedGame) return 1000;
  if (product.compactName === compactGame) return 980;

  if (compactGame.length >= 6 && product.compactName.includes(compactGame)) {
    return 760 - Math.abs(product.compactName.length - compactGame.length);
  }

  if (product.compactName.length >= 6 && compactGame.includes(product.compactName)) {
    return 730 - Math.abs(product.compactName.length - compactGame.length);
  }

  return 0;
}

async function findGogGameByName(gameName) {
  const products = await searchGogCatalog(gameName);
  let bestMatch = null;
  let bestScore = 0;

  for (const product of products) {
    const score = scoreNameMatch(gameName, product);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = product;
    }
  }

  if (!bestMatch || bestScore < 950) return null;

  return {
    appId: bestMatch.appId,
    name: bestMatch.name,
    cover: bestMatch.cover
  };
}

async function readGogGameInfo(gameFolder) {
  try {
    const entries = await fs.readdir(gameFolder, { withFileTypes: true });
    const infoFile = entries.find((entry) => entry.isFile() && /^goggame-\d+\.info$/i.test(entry.name));

    if (!infoFile) return null;

    const content = await fs.readFile(path.join(gameFolder, infoFile.name), "utf8");
    const data = JSON.parse(content);
    const playTask = Array.isArray(data.playTasks)
      ? data.playTasks.find((task) => task?.isPrimary && task?.path) || data.playTasks.find((task) => task?.path)
      : null;

    const appId = String(data.gameId || data.rootGameId || "");

    return {
      appId,
      name: data.name || data.title || path.basename(gameFolder),
      exe: playTask?.path
        ? path.resolve(gameFolder, playTask.path)
        : null,
      launchUri: appId ? `goggalaxy://launchGame/${encodeURIComponent(appId)}` : null
    };
  } catch {
    return null;
  }
}

module.exports = {
  findGogGameByName,
  readGogGameInfo
};
