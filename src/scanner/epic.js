const fs = require("fs/promises");
const path = require("path");

let catalogCachePromise = null;

function getEpicDataFolder() {
  return path.join(process.env.ProgramData || "C:\\ProgramData", "Epic", "EpicGamesLauncher", "Data");
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

function getCategoryPaths(item) {
  return Array.isArray(item?.categories)
    ? item.categories.map((category) => String(category.path || "").toLowerCase())
    : [];
}

function hasGameCategory(item) {
  return getCategoryPaths(item).includes("games");
}

function getCustomAttribute(item, key) {
  return item?.customAttributes?.[key]?.value || null;
}

function pickCover(item) {
  const images = Array.isArray(item?.keyImages) ? item.keyImages : [];

  const preferred = images.find((image) => image.type === "DieselGameBoxTall")
    || images.find((image) => image.type === "OfferImageTall")
    || images.find((image) => Number(image.height) > Number(image.width))
    || images.find((image) => image.url);

  return preferred?.url || null;
}

function parseManifest(content) {
  const data = JSON.parse(content);
  const categories = Array.isArray(data.AppCategories)
    ? data.AppCategories.map((category) => String(category).toLowerCase())
    : [];

  const appId = data.AppName || data.CatalogItemId || "";
  const catalogItemId = data.CatalogItemId || "";
  const namespace = data.CatalogNamespace || "";
  const launchKey = namespace && catalogItemId && appId
    ? `${encodeURIComponent(namespace)}%3A${encodeURIComponent(catalogItemId)}%3A${encodeURIComponent(appId)}`
    : encodeURIComponent(appId);

  return {
    appId,
    catalogItemId,
    namespace,
    name: data.DisplayName || data.AppName || "",
    folder: data.InstallLocation || "",
    exe: data.LaunchExecutable && data.InstallLocation
      ? path.join(data.InstallLocation, data.LaunchExecutable)
      : null,
    launchUri: appId ? `com.epicgames.launcher://apps/${launchKey}?action=launch&silent=true` : null,
    fallbackLaunchUri: appId ? `com.epicgames.launcher://apps/${encodeURIComponent(appId)}?action=launch&silent=true` : null,
    sizeBytes: Number(data.InstallSize || data.MainGameCatalogItem?.InstallSize || data.DownloadSize) || null,
    categories
  };
}

async function readCatalogCache() {
  if (!catalogCachePromise) {
    catalogCachePromise = (async () => {
      try {
        const cachePath = path.join(getEpicDataFolder(), "Catalog", "catcache.bin");
        const encoded = await fs.readFile(cachePath, "utf8");
        const decoded = Buffer.from(encoded.trim(), "base64").toString("utf8");
        const items = JSON.parse(decoded);

        return Array.isArray(items) ? items : [];
      } catch {
        return [];
      }
    })();
  }

  return catalogCachePromise;
}

function findCatalogItem(manifest, catalogItems) {
  const exact = catalogItems.find((item) => item.id === manifest.catalogItemId);

  if (exact) return exact;

  const installFolderName = normalizeName(path.basename(manifest.folder));
  const manifestName = normalizeName(manifest.name);
  const manifestExe = normalizeName(path.basename(manifest.exe || "", ".exe"));

  return catalogItems.find((item) => {
    const folderName = normalizeName(getCustomAttribute(item, "FolderName"));
    const processNames = normalizeName(getCustomAttribute(item, "ProcessNames"));
    const title = normalizeName(item.title);
    const appIds = Array.isArray(item.releaseInfo)
      ? item.releaseInfo.map((release) => normalizeName(release.appId))
      : [];

    return (folderName && folderName === installFolderName)
      || (title && title === manifestName)
      || (processNames && manifestExe && processNames.includes(manifestExe))
      || appIds.includes(normalizeName(manifest.appId));
  });
}

async function readInstalledGames() {
  try {
    const manifestsFolder = path.join(getEpicDataFolder(), "Manifests");
    const entries = await fs.readdir(manifestsFolder, { withFileTypes: true });
    const manifests = entries
      .filter((entry) => entry.isFile())
      .filter((entry) => entry.name.toLowerCase().endsWith(".item"));

    const catalogItems = await readCatalogCache();
    const games = [];

    for (const manifest of manifests) {
      try {
        const content = await fs.readFile(path.join(manifestsFolder, manifest.name), "utf8");
        const game = parseManifest(content);

        if (!game.folder || !game.name) continue;

        const catalogItem = findCatalogItem(game, catalogItems);
        const isGame = game.categories.includes("games") || hasGameCategory(catalogItem);

        if (!isGame) continue;

        games.push({
          appId: game.appId,
          name: catalogItem?.title && !catalogItem.title.includes("?") ? catalogItem.title : game.name,
          folder: game.folder,
          exe: game.exe,
          launchUri: game.launchUri,
          fallbackLaunchUri: game.fallbackLaunchUri,
          epicNamespace: game.namespace,
          epicCatalogItemId: game.catalogItemId,
          cover: pickCover(catalogItem),
          developer: catalogItem?.developer || null,
          publisher: catalogItem?.publisher || null,
          sizeBytes: game.sizeBytes,
          source: "epic"
        });
      } catch {
        // Ignore malformed manifests and keep scanning the rest.
      }
    }

    return games;
  } catch {
    return [];
  }
}

module.exports = {
  readInstalledGames
};
