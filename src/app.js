const autoScanBtn = document.getElementById("autoScanBtn");
const manualScanBtn = document.getElementById("manualScanBtn");
const mobileQrBtn = document.getElementById("mobileQrBtn");
const statusText = document.getElementById("status");

const storageKeys = {
  favorites: "mobdeck:favorites",
  viewMode: "mobdeck:viewMode",
  gridSize: "mobdeck:gridSize",
  sortMode: "mobdeck:sortMode",
  smartFilter: "mobdeck:smartFilter",
  soundEnabled: "mobdeck:soundEnabled",
  hidden: "mobdeck:hidden",
  showHidden: "mobdeck:showHidden",
  activeLibrary: "mobdeck:activeLibrary",
  library: "mobdeck:lastLibrary",
  minimizeOnLaunch: "mobdeck:minimizeOnLaunch",
  skipAutoOpenOnce: "mobdeck:skipAutoOpenOnce"
};

const librarySchemaVersion = 5;
const imageCacheVersion = 3;
const libraryModes = ["games", "apps", "catalog"];
const appLikeGameRules = [
  {
    appCatalogId: "wallpaper-engine",
    steamAppId: "431960",
    names: ["wallpaper engine", "wallpaper_engine", "wallpaper32"],
    name: "Wallpaper Engine",
    appCategoryId: "gamer-utils",
    appCategoryName: "Utilitarios gamer",
    summary: "Papeis de parede animados, interativos e com suporte a Steam Workshop.",
    website: "https://store.steampowered.com/app/431960/Wallpaper_Engine/"
  }
];
const nonGameSteamAppIds = new Set(["431960"]);
const nonGameGameWords = [
  "cursor",
  "pcsx2",
  "redm",
  "python",
  "python314",
  "samfwtool",
  "sam fw tool",
  "visual studio code",
  "microsoft vs code",
  "vscode",
  "unreal engine",
  "unity hub",
  "blender"
];

let currentGames = [];
let currentApps = [];
let appCatalogItems = [];
let currentFolder = "";
let currentScanConfig = null;
let selectedIndex = 0;
let activeMenuIndex = null;
let detailsState = null;
let detailsRequestId = 0;
let lastWheelAt = 0;
let lastHoverSoundAt = 0;
let viewMode = loadChoice(storageKeys.viewMode, ["carousel", "grid"], "grid");
let gridSize = loadChoice(storageKeys.gridSize, ["small", "medium", "large"], "medium");
let sortMode = loadChoice(storageKeys.sortMode, ["name", "favorite", "recent", "provider", "size"], "name");
let smartFilter = loadChoice(storageKeys.smartFilter, ["all", "favorites", "hidden", "no-cover", "recent", "large", "never", "collections"], "all");
let soundEnabled = loadChoice(storageKeys.soundEnabled, ["on", "off"], "on") === "on";
let showHidden = loadChoice(storageKeys.showHidden, ["on", "off"], "off") === "on";
let minimizeOnLaunch = loadChoice(storageKeys.minimizeOnLaunch, ["on", "off"], "on") === "on";
let activeLibrary = loadChoice(storageKeys.activeLibrary, libraryModes, "games");
let searchQuery = "";
let favoriteKeys = new Set(loadJson(storageKeys.favorites, []));
let hiddenKeys = new Set(loadJson(storageKeys.hidden, []));
let focusSearchAfterRender = false;
let settingsOpen = false;
let helpOpen = false;
let isRescanning = false;
let gamepadMode = false;
let controllerType = "generic";
let lastGamepadMoveAt = 0;
let lastGamepadButtonState = {};
let audioContext = null;
let companionStatus = null;
let companionStatusLoading = false;
let launchProfiles = new Map();
let profileEditorState = null;
let diagnosticsState = null;
const installStates = new Map();
const iconRequests = new Set();
const appBrandIconSlugs = {
  "7zip": "7zip",
  "adobe-illustrator": "adobeillustrator",
  "after-effects": "adobeaftereffects",
  "amazon-games": "amazon",
  "apple-music": "applemusic",
  "apple-tv": "appletv",
  "battle-net": "battledotnet",
  "brave": "brave",
  "canva": "canva",
  "capcut": "capcut",
  "chatgpt": "openai",
  "chrome": "googlechrome",
  "claude": "claude",
  "crunchyroll": "crunchyroll",
  "davinci-resolve": "davinciresolve",
  "deezer": "deezer",
  "discord": "discord",
  "disney-plus": "disneyplus",
  "docker-desktop": "docker",
  "dropbox": "dropbox",
  "ea-app": "ea",
  "edge": "microsoftedge",
  "epic-games": "epicgames",
  "figma": "figma",
  "firefox": "firefoxbrowser",
  "git": "git",
  "github-desktop": "github",
  "gog-galaxy": "gogdotcom",
  "google-drive": "googledrive",
  "heroic": "heroicgameslauncher",
  "imdb": "imdb",
  "jetbrains-toolbox": "jetbrains",
  "kdenlive": "kdenlive",
  "kodi": "kodi",
  "krita": "krita",
  "letterboxd": "letterboxd",
  "lutris": "lutris",
  "max": "max",
  "mega": "mega",
  "minecraft-launcher": "minecraft",
  "mubi": "mubi",
  "myanimelist": "myanimelist",
  "netflix": "netflix",
  "nvidia-broadcast": "nvidia",
  "obs": "obsstudio",
  "onedrive": "microsoftonedrive",
  "opera-gx": "opera",
  "paramount-plus": "paramountplus",
  "perplexity": "perplexity",
  "photoshop": "adobephotoshop",
  "plex": "plex",
  "postman": "postman",
  "prime-video": "primevideo",
  "riot-client": "riotgames",
  "rockstar-games": "rockstargames",
  "sharex": "sharex",
  "skype": "skype",
  "slack": "slack",
  "spotify": "spotify",
  "steam": "steam",
  "steamdb": "steamdb",
  "telegram": "telegram",
  "teams": "microsoftteams",
  "tiktok-studio": "tiktok",
  "tidal": "tidal",
  "twitch": "twitch",
  "ubisoft-connect": "ubisoft",
  "vimeo": "vimeo",
  "vivaldi": "vivaldi",
  "wallpaper-engine": "wallpaperengine",
  "vscode": "visualstudiocode",
  "visual-studio": "visualstudio",
  "whatsapp": "whatsapp",
  "winrar": "winrar",
  "xbox": "xbox",
  "youtube": "youtube",
  "youtube-music": "youtubemusic",
  "zoom": "zoom"
};

window.mobdeck?.onAppInstallProgress?.((progress) => {
  if (!progress?.appId) {
    return;
  }

  installStates.set(progress.appId, progress);

  if (activeLibrary === "catalog") {
    renderLibrary();
  }
});

window.mobdeck?.onCompanionGameLaunched?.((payload) => {
  const game = currentGames.find((item) => getCompanionGameId(item) === payload?.id);

  if (!game) {
    return;
  }

  markGameLaunched(game);

  if (activeLibrary === "games") {
    renderLibrary();
  }
});

loadCompanionStatus();

loadLaunchProfiles();

loadAppCatalog();

window.mobdeck?.onCompanionRefreshRequested?.(() => {
  rescanCurrentLibrary();
});

autoScanBtn?.addEventListener("click", async () => {
  setWelcomeButtonsDisabled(true);
  statusText.textContent = "Mapeando jogos e apps nos discos...";

  try {
    const result = await window.mobdeck.scanAutomatic();
    const roots = Array.isArray(result?.roots) ? result.roots : [];

    applyScanResult(
      Array.isArray(result?.games) ? result.games : [],
      roots.length ? roots.join(", ") : "Todos os discos",
      {
        mode: "automatic",
        roots
      },
      Array.isArray(result?.apps) ? result.apps : []
    );
    renderLibrary();
  } catch (error) {
    console.error(error);
    statusText.textContent = `Erro: ${error.message || error}`;
    setWelcomeButtonsDisabled(false);
  }
});

manualScanBtn?.addEventListener("click", async () => {
  statusText.textContent = "Abrindo seletor de pasta...";

  const folder = await window.mobdeck.selectFolder();

  if (!folder) {
    statusText.textContent = "Nenhuma pasta selecionada.";
    return;
  }

  await scanAndRender(folder);
});

mobileQrBtn?.addEventListener("click", async () => {
  await showMobileQr();
});

async function loadAppCatalog() {
  if (!window.mobdeck?.getAppCatalog) {
    return;
  }

  try {
    appCatalogItems = await window.mobdeck.getAppCatalog();

    if (activeLibrary === "catalog") {
      renderLibrary();
    }
  } catch (error) {
    console.error(error);
  }
}

async function loadLaunchProfiles() {
  if (!window.mobdeck?.getLaunchProfiles) {
    return;
  }

  try {
    const result = await window.mobdeck.getLaunchProfiles();
    launchProfiles = new Map((result?.profiles || []).map((profile) => [profile.itemKey, profile]));
    renderLibrary();
  } catch (error) {
    console.error(error);
  }
}

document.addEventListener("keydown", (event) => {
  if (isTextInputActive(event.target) && event.key !== "Escape") {
    return;
  }

  if (handleGlobalShortcut(event)) {
    return;
  }

  if (helpOpen && event.key === "Escape") {
    event.preventDefault();
    closeHelp();
    return;
  }

  if (settingsOpen && event.key === "Escape") {
    event.preventDefault();
    closeSettings();
    return;
  }

  if (profileEditorState && event.key === "Escape") {
    event.preventDefault();
    closeProfileEditor();
    return;
  }

  if (diagnosticsState && event.key === "Escape") {
    event.preventDefault();
    closeDiagnostics();
    return;
  }

  if (detailsState && event.key === "Escape") {
    event.preventDefault();
    closeDetails();
    return;
  }

  if (!getActiveItems().length || detailsState) {
    return;
  }

  const arrowDirections = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down"
  };

  if (arrowDirections[event.key]) {
    event.preventDefault();
    moveSelection(arrowDirections[event.key]);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    if (activeMenuIndex === selectedIndex) {
      launchSelectedItem();
      return;
    }

    activeMenuIndex = selectedIndex;
    renderLibrary();
    return;
  }

  if (event.key === "Escape" && activeMenuIndex !== null) {
    event.preventDefault();
    activeMenuIndex = null;
    renderLibrary();
  }
});

function isTextInputActive(target) {
  const tagName = String(target?.tagName || "").toLowerCase();

  return tagName === "input" || tagName === "textarea" || tagName === "select" || target?.isContentEditable;
}

function handleGlobalShortcut(event) {
  const key = event.key.toLowerCase();

  if (event.key === "F1" || key === "?") {
    event.preventDefault();
    openHelp();
    return true;
  }

  if (key === "g") {
    event.preventDefault();
    switchLibrary("games");
    return true;
  }

  if (key === "a") {
    event.preventDefault();
    switchLibrary("apps");
    return true;
  }

  if (key === "c") {
    event.preventDefault();
    switchLibrary("catalog");
    return true;
  }

  if (key === "r") {
    event.preventDefault();
    rescanCurrentLibrary();
    return true;
  }

  if (key === " ") {
    event.preventDefault();
    launchSelectedItem();
    return true;
  }

  return false;
}

async function scanAndRender(folder) {
  setWelcomeButtonsDisabled(true);
  statusText.textContent = "Escaneando biblioteca...";

  try {
    const [games, apps] = await Promise.all([
      window.mobdeck.scanFolder(folder),
      window.mobdeck.scanApps()
    ]);

    applyScanResult(games, folder, {
      mode: "manual",
      folders: [folder]
    }, apps);
    renderLibrary();
  } catch (error) {
    console.error(error);
    statusText.textContent = `Erro: ${error.message || error}`;
    setWelcomeButtonsDisabled(false);
  }
}

function applyScanResult(games, folderLabel, scanConfig = {}, apps = currentApps) {
  const sourceGames = Array.isArray(games) ? games : [];
  const movedApps = sourceGames.map(createAppFromGameIfNeeded).filter(Boolean);
  const sourceApps = Array.isArray(apps) ? apps : [];

  currentGames = filterGamesForLibrary(sourceGames);
  currentApps = filterAppsForLibrary([...sourceApps, ...movedApps], currentGames);
  currentFolder = folderLabel || "";
  currentScanConfig = normalizeScanConfig(scanConfig, currentFolder);
  selectedIndex = 0;
  activeMenuIndex = null;
  detailsState = null;
  settingsOpen = false;
  detailsRequestId += 1;
  searchQuery = "";

  saveLibrarySnapshot("scan");
}

function renderLibrary() {
  selectedIndex = wrapIndex(selectedIndex);

  const effectiveViewMode = activeLibrary === "catalog" ? "grid" : viewMode;

  document.body.textContent = "";
  document.body.className = [
    effectiveViewMode === "grid" ? "is-grid-view" : "is-carousel-view",
    `is-${activeLibrary}-library`,
    isRescanning ? "is-rescanning" : "",
    gamepadMode ? `is-gamepad-mode is-${controllerType}-controller` : ""
  ].filter(Boolean).join(" ");

  const page = createElement("main", `deck-page is-${effectiveViewMode}-view is-${activeLibrary}-library`);
  const shell = createElement("section", "deck-shell");

  shell.append(createDeckTopbar(), createBottomNav(), createLibraryContent());
  page.append(createDeckWallpaper(), shell, createSelectedGamePanel());

  page.addEventListener("click", () => {
    if (activeMenuIndex !== null) {
      activeMenuIndex = null;
      renderLibrary();
    }
  });

  if (detailsState) {
    page.append(createDetailsModal());
  }

  if (settingsOpen) {
    page.append(createSettingsModal());
  }

  if (helpOpen) {
    page.append(createHelpModal());
  }

  if (profileEditorState) {
    page.append(createProfileModal());
  }

  if (diagnosticsState) {
    page.append(createDiagnosticsModal());
  }

  if (isRescanning) {
    page.append(createElement("div", "deck-toast", "Atualizando biblioteca..."));
  }

  if (gamepadMode) {
    page.append(createControllerBadge());
  }

  document.body.append(page);

  if (focusSearchAfterRender) {
    focusSearchAfterRender = false;
    requestAnimationFrame(() => {
      const input = document.getElementById("gameSearch");

      if (!input) return;

      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }
}

function createDeckTopbar() {
  const topbar = createElement("header", "deck-topbar");

  topbar.append(createLibraryTitle(), createBrand(), createCornerSettingsButton(), createBackButton());

  return topbar;
}

function createLibraryTitle() {
  const block = createElement("section", "library-title-block");

  const activeItems = getActiveItems();
  const sourceItems = getActiveSourceItems();
  const libraryInfo = getLibraryInfo(activeLibrary);
  const icon = createElement("div", "library-icon", libraryInfo.icon);
  const text = createElement("div", "library-title-text");
  const eyebrow = createElement("span", "library-eyebrow", libraryInfo.eyebrow);
  const title = createElement("h1", "", libraryInfo.title);
  const rule = createElement("div", "library-rule");
  const filteredCount = activeLibrary === "catalog" || viewMode === "grid"
    ? getFilteredItemsWithIndex().length
    : activeItems.length;
  const itemLabel = libraryInfo.itemLabel;
  const metaText = searchQuery
    ? `${filteredCount} de ${activeItems.length} ${itemLabel}`
    : `${activeItems.length} ${itemLabel} encontrado(s)`;
  const meta = createElement("p", "library-meta", metaText);
  const stats = createElement("p", "library-stats", formatLibraryStats(sourceItems));

  text.append(eyebrow, title, rule, meta, stats);
  block.append(icon, text);

  return block;
}

function createBrand() {
  const brand = createElement("div", "deck-brand");

  const logo = new Image();
  logo.className = "brand-logo";
  logo.src = "assets/mobdeck-mark.png";
  logo.alt = "MOB Deck";

  const word = createElement("div", "brand-word");
  const mob = createElement("span", "brand-word-white", "MOB");
  const deck = createElement("span", "brand-word-purple", "DECK");

  word.append(mob, deck);
  brand.append(logo, word);

  return brand;
}

function createCornerSettingsButton() {
  const button = createElement("button", `corner-settings${settingsOpen ? " is-on" : ""}`, "\u2699");

  button.type = "button";
  button.title = "Configuracoes";
  button.setAttribute("aria-label", "Configuracoes");
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    openSettings();
  });

  return button;
}

function createBackButton() {
  const button = createElement("button", "icon-button topbar-button", "\u21A9");

  button.type = "button";
  button.title = "Voltar";
  button.setAttribute("aria-label", "Voltar");
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    playUiSound("back");
    saveChoice(storageKeys.skipAutoOpenOnce, "1");
    location.reload();
  });

  return button;
}

function createLibraryContent() {
  if (activeLibrary === "apps") {
    return createInstalledAppsView();
  }

  if (activeLibrary === "catalog") {
    return createCatalogView();
  }

  if (!getActiveItems().length) {
    return createEmptyState();
  }

  return viewMode === "grid" ? createGridView() : createCarouselView();
}

function createDeckWallpaper() {
  const wallpaper = createElement("div", "deck-wallpaper");
  const selected = getSelectedGame();
  const image = selected && activeLibrary === "games" ? getWallpaperSource(selected) : "";

  if (image) {
    wallpaper.style.setProperty("--deck-wallpaper-image", `url("${image}")`);
    wallpaper.classList.add("has-image");
  }

  return wallpaper;
}

function getWallpaperSource(game) {
  const sources = getCoverSources(game);

  return sources[0] || "";
}

function createCarouselView() {
  const activeItems = getActiveItems();
  const stage = createElement("section", "carousel-stage");
  stage.tabIndex = 0;
  stage.setAttribute("aria-label", `${getActiveLibraryLabel()} em carrossel`);
  stage.addEventListener("wheel", handleCarouselWheel, { passive: false });

  const rail = createElement("div", "carousel-rail");

  activeItems.forEach((game, index) => {
    const positionClass = getPositionClass(index);

    if (positionClass) {
      rail.append(createGameCard(game, index, positionClass, "carousel"));
    }
  });

  stage.append(createCarouselArrow("left"), rail, createCarouselArrow("right"));

  return stage;
}

function createGridView() {
  const shell = createElement("section", `grid-shell grid-${gridSize}`);
  const filteredGames = getFilteredItemsWithIndex();

  if (filteredGames.length && !filteredGames.some((item) => item.index === selectedIndex)) {
    selectedIndex = filteredGames[0].index;
  }

  const grid = createElement("div", "games-grid-library");

  if (!filteredGames.length) {
    grid.append(createElement("p", "grid-empty", getFilteredEmptyText()));
  } else {
    filteredGames.forEach(({ game, index }) => {
      grid.append(createGameCard(game, index, "grid-card", "grid"));
    });
  }

  shell.append(createGridToolbar(), grid);

  return shell;
}

function createInstalledAppsView() {
  const shell = createElement("section", `grid-shell app-tile-shell grid-${gridSize}`);
  const filteredApps = getFilteredItemsWithIndex();
  const grid = createElement("div", "app-tile-grid");

  if (!filteredApps.length) {
    grid.append(createElement("p", "grid-empty", getFilteredEmptyText()));
  } else {
    filteredApps.forEach(({ game, index }) => {
      grid.append(createAppTileCard(game, index, { catalog: false }));
    });
  }

  shell.append(createGridToolbar(), grid);

  return shell;
}

function createCatalogView() {
  const shell = createElement("section", `grid-shell app-tile-shell catalog-shell grid-${gridSize}`);
  const filteredApps = getFilteredItemsWithIndex();
  const grid = createElement("div", "app-tile-grid catalog-grid-library");

  if (!filteredApps.length) {
    grid.append(createElement("p", "grid-empty", getFilteredEmptyText()));
  } else {
    filteredApps.forEach(({ game, index }) => {
      grid.append(createAppTileCard(game, index, { catalog: true }));
    });
  }

  shell.append(createGridToolbar(), grid);

  return shell;
}

function createCatalogCard(appItem, index) {
  return createAppTileCard(appItem, index, { catalog: true });
}

function createAppTileCard(appItem, index, options = {}) {
  const isCatalog = !!options.catalog;
  const installed = isCatalog ? getInstalledCatalogApp(appItem) : appItem;
  const installState = isCatalog ? installStates.get(appItem.id) : null;
  const installing = installState?.status === "running";
  const actionLabel = isCatalog
    ? getCatalogActionLabel(appItem, installed, installState)
    : "Abrir";
  const card = createElement(
    "article",
    [
      "app-tile-card",
      isCatalog ? "is-catalog-tile" : "is-installed-tile",
      index === selectedIndex ? "is-selected" : "",
      installed ? "is-installed" : ""
    ].filter(Boolean).join(" ")
  );
  const artworkButton = createElement("button", "app-artwork-button");
  const text = createElement("div", "app-tile-text");
  const title = createElement("strong", "", appItem.name);
  const meta = createElement("span", "", appItem.appCategoryName || appItem.categoryName || "App");
  const summary = createElement("p", "", appItem.summary || installed?.summary || "");
  const action = createElement("button", "app-tile-action", actionLabel);

  card.tabIndex = 0;
  card.setAttribute("aria-label", `${appItem.name}: ${actionLabel}`);
  card.addEventListener("mouseenter", playHoverSound);
  card.addEventListener("focus", playHoverSound);
  card.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    await handleAppTileAction(appItem, action, isCatalog);
  });

  artworkButton.type = "button";
  artworkButton.title = actionLabel;
  artworkButton.setAttribute("aria-label", actionLabel);
  artworkButton.disabled = installing;
  artworkButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    selectedIndex = index;
    await handleAppTileAction(appItem, action, isCatalog);
  });

  action.type = "button";
  action.disabled = installing;
  action.addEventListener("click", async (event) => {
    event.stopPropagation();
    selectedIndex = index;
    await handleAppTileAction(appItem, action, isCatalog);
  });

  artworkButton.append(renderAppArtwork(appItem, installed));
  text.append(title, meta);

  if (summary.textContent) {
    text.append(summary);
  }

  if (installing) {
    text.append(createCatalogProgress(installState));
  }

  text.append(action);
  card.append(artworkButton, text);

  return card;
}

async function handleAppTileAction(appItem, button, isCatalog) {
  if (isCatalog) {
    await handleCatalogAction(appItem, button);
    return;
  }

  await launchGame(appItem, button);
}

function renderAppArtwork(appItem, installedApp) {
  const artwork = createElement("div", "app-artwork");
  const iconSources = getAppArtworkSources(appItem, installedApp);

  if (!iconSources.length) {
    artwork.style.setProperty("--app-artwork-bg", `url("${createAppArtwork(appItem, installedApp)}")`);
    artwork.classList.add("is-generated-only");
    return artwork;
  }

  const icon = new Image();
  let sourceIndex = 0;

  artwork.classList.add("has-logo");
  icon.className = "app-artwork-logo";
  icon.alt = appItem.name;
  icon.loading = "lazy";
  icon.draggable = false;

  function loadNextIcon() {
    const source = iconSources[sourceIndex];
    sourceIndex += 1;

    if (!source) {
      icon.remove();
      artwork.style.setProperty("--app-artwork-bg", `url("${createAppArtwork(appItem, installedApp)}")`);
      artwork.classList.add("is-generated-only");
      artwork.classList.remove("has-logo");
      return;
    }

    icon.src = source;
  }

  icon.addEventListener("error", loadNextIcon);
  artwork.append(icon);
  loadNextIcon();
  requestNativeAppIcon(appItem, installedApp);

  return artwork;
}

function getAppArtworkSources(appItem, installedApp) {
  const sources = [
    installedApp?.icon,
    appItem?.icon,
    installedApp?.cover,
    appItem?.cover,
    ...(Array.isArray(installedApp?.coverSources) ? installedApp.coverSources : []),
    ...(Array.isArray(appItem?.coverSources) ? appItem.coverSources : []),
    getBrandIconSource(appItem, installedApp),
    getFaviconSource(appItem, installedApp)
  ];

  return [...new Set(sources.map(normalizeImageSource).filter(Boolean))];
}

function getBrandIconSource(appItem, installedApp) {
  const ids = [
    appItem?.id,
    appItem?.appCatalogId,
    installedApp?.id,
    installedApp?.appCatalogId
  ].filter(Boolean);
  const slug = ids.map((id) => appBrandIconSlugs[id]).find(Boolean);

  return slug ? `https://cdn.simpleicons.org/${encodeURIComponent(slug)}/ffffff` : "";
}

function requestNativeAppIcon(appItem, installedApp) {
  const target = installedApp || (!appItem?.isCatalogItem ? appItem : null);

  if (!target || target.icon || !window.mobdeck?.getAppIcon) {
    return;
  }

  requestAppIcon(target);
}

function createAppArtwork(appItem, installedApp) {
  const title = String(appItem?.name || installedApp?.name || "App").trim();
  const category = String(appItem?.categoryName || appItem?.appCategoryName || installedApp?.appCategoryName || "App").trim();
  const theme = getAppArtworkTheme(appItem, installedApp, title);
  const mark = theme.mark || getInitials(title) || "M";
  const markSize = mark.length > 3 ? 74 : mark.length > 2 ? 92 : 122;
  const lines = splitTitle(theme.label || title).slice(0, 2);
  const lineSvg = lines
    .map((line, lineIndex) => `<text x="256" y="${356 + lineIndex * 34}" text-anchor="middle" font-size="29" font-weight="950" fill="#ffffff">${escapeXml(line.toUpperCase())}</text>`)
    .join("");
  const categoryLabel = category.toUpperCase().slice(0, 22);
  const shape = createAppArtworkShape(theme);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#05070a"/>
          <stop offset=".58" stop-color="${theme.dark}"/>
          <stop offset="1" stop-color="#121820"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="38%" r="62%">
          <stop offset="0" stop-color="${theme.accent}" stop-opacity=".42"/>
          <stop offset=".54" stop-color="${theme.mid}" stop-opacity=".18"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="line" x1="0" x2="1">
          <stop offset="0" stop-color="${theme.accent}" stop-opacity="0"/>
          <stop offset=".5" stop-color="${theme.accent}" stop-opacity=".78"/>
          <stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="86" fill="url(#bg)"/>
      <rect width="512" height="512" rx="86" fill="url(#glow)"/>
      <path d="M64 92 H448 M64 420 H448" stroke="url(#line)" stroke-width="4" stroke-linecap="round"/>
      <path d="M52 390 L448 56 M132 474 L506 158" stroke="${theme.mid}" stroke-width="18" stroke-linecap="round" opacity=".12"/>
      ${shape}
      <text x="256" y="271" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${markSize}" font-weight="950" fill="#ffffff">${escapeXml(mark)}</text>
      ${lineSvg}
      <text x="256" y="456" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="950" fill="${theme.accent}" letter-spacing="3">${escapeXml(categoryLabel)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getFaviconSource(appItem, installedApp) {
  const website = appItem?.website || installedApp?.website;

  if (!website) {
    return "";
  }

  try {
    const url = new URL(website);

    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=256`;
  } catch {
    return "";
  }
}

function getAppArtworkTheme(appItem, installedApp, title) {
  const id = appItem?.id || appItem?.appCatalogId || installedApp?.appCatalogId || normalizeSearch(title).replace(/\s+/g, "-");
  const categoryId = appItem?.categoryId || appItem?.appCategoryId || installedApp?.appCategoryId || "apps";
  const byCategory = {
    launchers: { accent: "#ff8a2f", mid: "#22c8e5", dark: "#10141a", mark: "\u25b6", shape: "badge" },
    streaming: { accent: "#ff4f8b", mid: "#8b5cf6", dark: "#130b16", mark: "LIVE", shape: "ring" },
    communication: { accent: "#36a3ff", mid: "#22c8e5", dark: "#08131d", mark: "\u25cf", shape: "bubble" },
    movies: { accent: "#ffd166", mid: "#ff8733", dark: "#17120a", mark: "\u25b6", shape: "play" },
    anime: { accent: "#ff6fcf", mid: "#8b5cf6", dark: "#160b19", mark: "\u2606", shape: "ring" },
    music: { accent: "#1ed760", mid: "#22c8e5", dark: "#07140e", mark: "\u266a", shape: "ring" },
    design: { accent: "#ff5a9e", mid: "#ffd166", dark: "#170c12", mark: "\u25c6", shape: "badge" },
    "video-editing": { accent: "#ff8733", mid: "#8b5cf6", dark: "#140e10", mark: "\u25a3", shape: "play" },
    browsers: { accent: "#ff3d6e", mid: "#22c8e5", dark: "#080a0d", mark: "O", shape: "ring" },
    reading: { accent: "#ffd166", mid: "#36a3ff", dark: "#15110a", mark: "B", shape: "book" },
    videos: { accent: "#ff3434", mid: "#ffd166", dark: "#160808", mark: "\u25b6", shape: "play" },
    ai: { accent: "#9df7ff", mid: "#8b5cf6", dark: "#081216", mark: "AI", shape: "ring" },
    programming: { accent: "#22c8e5", mid: "#8b5cf6", dark: "#081019", mark: "</>", shape: "code" },
    storage: { accent: "#36a3ff", mid: "#22c8e5", dark: "#07111b", mark: "\u2601", shape: "cloud" },
    "gamer-utils": { accent: "#86ef45", mid: "#ff8733", dark: "#0d1308", mark: "\u2699", shape: "gauge" },
    archives: { accent: "#ffd166", mid: "#ff8733", dark: "#171208", mark: "ZIP", shape: "box" },
    capture: { accent: "#22c8e5", mid: "#ffd166", dark: "#081417", mark: "\u25a3", shape: "badge" },
    discovery: { accent: "#ffd166", mid: "#ff6fcf", dark: "#15100b", mark: "\u2605", shape: "ring" },
    apps: { accent: "#ff8733", mid: "#22c8e5", dark: "#10151a", mark: getInitials(title), shape: "badge" }
  };
  const byApp = {
    "opera-gx": { accent: "#ff1f5b", mid: "#ff4d83", dark: "#070708", mark: "O", label: "Opera GX", shape: "ring" },
    "rockstar-games": { accent: "#ffbf24", mid: "#ff8733", dark: "#101010", mark: "R*", label: "Rockstar", shape: "square" },
    steam: { accent: "#66c7ff", mid: "#1b4f8c", dark: "#07111b", mark: "S", label: "Steam", shape: "ring" },
    "epic-games": { accent: "#ffffff", mid: "#ff8733", dark: "#090909", mark: "EPIC", label: "Epic Games", shape: "shield" },
    discord: { accent: "#5865f2", mid: "#22c8e5", dark: "#0b0f24", mark: "D", label: "Discord", shape: "bubble" },
    "minecraft-launcher": { accent: "#68d45b", mid: "#8b5a2b", dark: "#0c1609", mark: "M", label: "Minecraft", shape: "blocks" },
    playnite: { accent: "#ff6b3d", mid: "#66e478", dark: "#10130c", mark: "\u25b6", label: "Playnite", shape: "gamepad" },
    "ubisoft-connect": { accent: "#9ff7ff", mid: "#7657ff", dark: "#080b18", mark: "U", label: "Ubisoft", shape: "spiral" },
    xbox: { accent: "#6ee06e", mid: "#22c8e5", dark: "#071408", mark: "X", label: "Xbox", shape: "ring" },
    "youtube-music": { accent: "#ff3434", mid: "#ff8733", dark: "#160808", mark: "\u25b6", label: "YouTube Music", shape: "play" },
    chrome: { accent: "#ffcf3f", mid: "#35a852", dark: "#0b1016", mark: "C", label: "Chrome", shape: "ring" },
    edge: { accent: "#22c8e5", mid: "#36d57d", dark: "#071418", mark: "E", label: "Edge", shape: "wave" },
    onedrive: { accent: "#36a3ff", mid: "#22c8e5", dark: "#07111b", mark: "\u2601", label: "OneDrive", shape: "cloud" },
    winrar: { accent: "#7a5cff", mid: "#ffd166", dark: "#120c18", mark: "RAR", label: "WinRAR", shape: "box" },
    skype: { accent: "#36a3ff", mid: "#22c8e5", dark: "#07111b", mark: "S", label: "Skype", shape: "bubble" },
    whatsapp: { accent: "#25d366", mid: "#22c8e5", dark: "#06140c", mark: "W", label: "WhatsApp", shape: "bubble" },
    claude: { accent: "#d8a56d", mid: "#ff8733", dark: "#171009", mark: "C", label: "Claude", shape: "ring" },
    vscode: { accent: "#22a8f2", mid: "#22c8e5", dark: "#07111b", mark: "<>", label: "VS Code", shape: "code" },
    "visual-studio": { accent: "#b179ff", mid: "#22c8e5", dark: "#10091c", mark: "VS", label: "Visual Studio", shape: "code" },
    "tiktok-studio": { accent: "#22c8e5", mid: "#ff2d6d", dark: "#08090c", mark: "TT", label: "TikTok Studio", shape: "play" },
    crystaldiskinfo: { accent: "#91d7ff", mid: "#36a3ff", dark: "#07111b", mark: "CD", label: "CrystalDisk", shape: "gauge" },
    "msi-afterburner": { accent: "#86ef45", mid: "#ff3434", dark: "#0b1008", mark: "MSI", label: "Afterburner", shape: "gauge" },
    rivatuner: { accent: "#7aa2ff", mid: "#ff8733", dark: "#0a0e18", mark: "RT", label: "RivaTuner", shape: "gauge" }
  };

  return {
    ...(byCategory[categoryId] || byCategory.apps),
    ...(byApp[id] || {})
  };
}

function createAppArtworkShape(theme) {
  const accent = theme.accent;
  const mid = theme.mid;

  if (theme.shape === "ring") {
    return `<circle cx="256" cy="214" r="92" fill="rgba(255,255,255,.045)" stroke="${accent}" stroke-width="16"/><circle cx="256" cy="214" r="54" fill="none" stroke="${mid}" stroke-width="10" opacity=".58"/>`;
  }

  if (theme.shape === "square") {
    return `<rect x="156" y="116" width="200" height="160" rx="30" fill="${accent}"/><rect x="184" y="144" width="144" height="104" rx="22" fill="#111111" opacity=".18"/>`;
  }

  if (theme.shape === "shield") {
    return `<path d="M170 120h172v92c0 62-34 100-86 124-52-24-86-62-86-124z" fill="${accent}" opacity=".92"/><path d="M196 150h120v54c0 42-24 68-60 86-36-18-60-44-60-86z" fill="#05070a" opacity=".9"/>`;
  }

  if (theme.shape === "play") {
    return `<circle cx="256" cy="214" r="94" fill="${accent}" opacity=".88"/><path d="M232 164l86 50-86 50z" fill="#05070a" opacity=".9"/>`;
  }

  if (theme.shape === "code") {
    return `<path d="M202 168l-56 48 56 48" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/><path d="M310 168l56 48-56 48" fill="none" stroke="${mid}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/><path d="M282 140l-48 148" stroke="#fff" stroke-width="14" stroke-linecap="round" opacity=".76"/>`;
  }

  if (theme.shape === "cloud") {
    return `<path d="M178 254c-34 0-58-22-58-52 0-28 22-50 51-52 15-34 48-54 86-54 50 0 91 39 94 88 28 6 49 28 49 58 0 34-28 60-66 60H178z" fill="${accent}" opacity=".9"/>`;
  }

  if (theme.shape === "box") {
    return `<rect x="150" y="128" width="212" height="172" rx="22" fill="${accent}" opacity=".9"/><path d="M150 184h212M214 128v172" stroke="#05070a" stroke-width="12" opacity=".35"/>`;
  }

  if (theme.shape === "gauge") {
    return `<path d="M156 254a100 100 0 01200 0" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round"/><path d="M256 254l66-66" stroke="#fff" stroke-width="14" stroke-linecap="round"/><circle cx="256" cy="254" r="18" fill="${mid}"/>`;
  }

  if (theme.shape === "blocks") {
    return `<rect x="150" y="126" width="82" height="82" rx="16" fill="${accent}"/><rect x="248" y="106" width="98" height="98" rx="18" fill="#fff" opacity=".9"/><rect x="194" y="224" width="122" height="88" rx="18" fill="${mid}" opacity=".82"/>`;
  }

  if (theme.shape === "wave") {
    return `<path d="M118 242c52-100 168-136 260-74-50-8-96 12-128 54 40-22 92-24 144 14-74 104-222 98-276 6z" fill="${accent}" opacity=".86"/>`;
  }

  if (theme.shape === "bubble") {
    return `<path d="M154 124h204c28 0 50 22 50 50v82c0 28-22 50-50 50H250l-74 56 16-56h-38c-28 0-50-22-50-50v-82c0-28 22-50 50-50z" fill="${accent}" opacity=".84"/>`;
  }

  if (theme.shape === "gamepad") {
    return `<path d="M166 194c-52 0-82 36-82 82 0 36 22 62 50 62 22 0 36-20 54-34h136c18 14 32 34 54 34 28 0 50-26 50-62 0-46-30-82-82-82H166z" fill="${accent}" opacity=".88"/><path d="M162 258h58M191 229v58" stroke="#05070a" stroke-width="14" stroke-linecap="round"/><circle cx="324" cy="254" r="12" fill="#05070a"/><circle cx="366" cy="278" r="12" fill="#05070a"/>`;
  }

  return `<rect x="154" y="118" width="204" height="184" rx="46" fill="${accent}" opacity=".86"/><rect x="192" y="156" width="128" height="108" rx="30" fill="#05070a" opacity=".22"/>`;
}

function getInitials(title) {
  return String(title || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function createCatalogProgress(installState) {
  const wrap = createElement("div", "catalog-progress");
  const bar = createElement("span", "");
  const label = createElement("small", "", `${Math.round(Number(installState?.percent || 0))}%`);

  bar.style.width = `${Math.max(0, Math.min(100, Number(installState?.percent || 0)))}%`;
  wrap.append(bar, label);

  return wrap;
}

async function handleCatalogAction(appItem, button) {
  const installed = getInstalledCatalogApp(appItem);

  if (installed) {
    await launchGame(installed, button);
    return;
  }

  if (!window.mobdeck?.installCatalogApp) {
    await openCatalogSite(appItem);
    return;
  }

  const previousLabel = button?.textContent;

  if (button) {
    button.disabled = true;
    button.textContent = appItem.wingetId ? "Instalando..." : "Abrindo...";
  }

  try {
    const result = await window.mobdeck.installCatalogApp(appItem.id);

    if (result?.mode === "winget") {
      await refreshInstalledApps();
    }
  } catch (error) {
    console.error(error);
    await openCatalogSite(appItem);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousLabel;
    }

    renderLibrary();
  }
}

async function openCatalogSite(appItem) {
  if (!appItem?.website || !window.mobdeck?.openExternalUrl) {
    return;
  }

  await window.mobdeck.openExternalUrl(appItem.website);
}

async function refreshInstalledApps() {
  if (!window.mobdeck?.scanApps) {
    return;
  }

  const apps = await window.mobdeck.scanApps();

  currentApps = filterAppsForLibrary(apps, currentGames);
  saveLibrarySnapshot("refresh-apps");
}

function getCatalogActionLabel(appItem, installed, installState) {
  if (installState?.status === "running") {
    return `${Math.round(Number(installState.percent || 0))}%`;
  }

  if (installed) {
    return "Abrir";
  }

  return appItem.wingetId ? "Instalar" : "Site";
}

function createGridToolbar() {
  const toolbar = createElement("div", "grid-toolbar");
  const searchWrap = createElement("label", "search-box");
  const searchIcon = createElement("span", "search-icon", "\u2315");
  const input = document.createElement("input");
  const toolbarActions = createElement("div", "grid-toolbar-actions");
  const sizeControls = createElement("div", "grid-size-controls");
  const sizes = [
    ["small", "P", "Grade pequena"],
    ["medium", "M", "Grade media"],
    ["large", "G", "Grade grande"]
  ];

  input.id = "gameSearch";
  input.type = "search";
  input.placeholder = activeLibrary === "catalog"
    ? "Pesquisar no catalogo"
    : activeLibrary === "apps"
      ? "Pesquisar app"
      : "Pesquisar jogo";
  input.value = searchQuery;
  input.autocomplete = "off";
  input.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("input", (event) => {
    searchQuery = event.target.value;
    activeMenuIndex = null;
    focusSearchAfterRender = true;
    renderLibrary();
  });

  searchWrap.append(searchIcon, input);

  for (const [size, label, title] of sizes) {
    const button = createElement("button", `grid-size-button${gridSize === size ? " is-active" : ""}`, label);

    button.type = "button";
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      playUiSound("toggle");
      gridSize = size;
      saveChoice(storageKeys.gridSize, gridSize);
      renderLibrary();
    });

    sizeControls.append(button);
  }

  toolbarActions.append(createSmartFilterSelect(), createSortSelect(), sizeControls);

  if (activeLibrary === "catalog") {
    toolbarActions.append(createBatchInstallButton());
  }

  toolbar.append(searchWrap, toolbarActions);

  return toolbar;
}

function createSmartFilterSelect() {
  const wrapper = createElement("label", "sort-control smart-filter-control");
  const label = createElement("span", "", "Filtro");
  const select = document.createElement("select");
  const options = [
    ["all", "Todos"],
    ["favorites", "Favoritos"],
    ["hidden", "Ocultos"],
    ["no-cover", "Sem capa"],
    ["recent", "Recentes"],
    ["large", "Grandes"],
    ["never", "Nunca abertos"],
    ["collections", "Colecoes"]
  ];

  select.title = "Filtrar biblioteca";
  select.setAttribute("aria-label", "Filtrar biblioteca");

  for (const [value, text] of options) {
    const option = document.createElement("option");

    option.value = value;
    option.textContent = text;
    option.selected = smartFilter === value;
    select.append(option);
  }

  select.addEventListener("click", (event) => event.stopPropagation());
  select.addEventListener("change", (event) => {
    smartFilter = event.target.value;
    selectedIndex = 0;
    activeMenuIndex = null;
    saveChoice(storageKeys.smartFilter, smartFilter);
    playUiSound("toggle");
    renderLibrary();
  });

  wrapper.append(label, select);

  return wrapper;
}

function createBatchInstallButton() {
  const installable = getCatalogLibraryItems().filter((item) => item.wingetId && !item.installed);
  const button = createElement("button", "grid-size-button batch-install-button", "Lote");

  button.type = "button";
  button.title = "Instalar apps essenciais em lote";
  button.setAttribute("aria-label", button.title);
  button.disabled = !installable.length;
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    await installCatalogBatch(installable.slice(0, 8), button);
  });

  return button;
}

async function installCatalogBatch(items, button) {
  if (!items.length) {
    return;
  }

  const confirmed = window.confirm(`Instalar ${items.length} app(s) do catalogo em sequencia?`);

  if (!confirmed) {
    return;
  }

  const previousLabel = button.textContent;

  button.disabled = true;

  for (let index = 0; index < items.length; index++) {
    button.textContent = `${index + 1}/${items.length}`;

    try {
      await window.mobdeck.installCatalogApp(items[index].id);
    } catch (error) {
      console.error(error);
    }
  }

  await refreshInstalledApps();
  button.textContent = previousLabel;
  button.disabled = false;
  renderLibrary();
}

function createSortSelect() {
  const wrapper = createElement("label", "sort-control");
  const label = createElement("span", "", "Ordenar");
  const select = document.createElement("select");
  const options = activeLibrary === "catalog"
    ? [
        ["name", "Nome"],
        ["provider", "Categoria"]
      ]
    : [
        ["name", "Nome"],
        ["favorite", "Favoritos"],
        ["recent", "Recentes"],
        ["provider", activeLibrary === "apps" ? "Tipo" : "Plataforma"],
        ["size", "Tamanho"]
      ];

  select.title = "Ordenar biblioteca";
  select.setAttribute("aria-label", "Ordenar biblioteca");

  for (const [value, text] of options) {
    const option = document.createElement("option");

    option.value = value;
    option.textContent = text;
    option.selected = sortMode === value;
    select.append(option);
  }

  select.addEventListener("click", (event) => event.stopPropagation());
  select.addEventListener("change", (event) => {
    sortMode = event.target.value;
    selectedIndex = 0;
    activeMenuIndex = null;
    playUiSound("toggle");
    saveChoice(storageKeys.sortMode, sortMode);
    renderLibrary();
  });

  wrapper.append(label, select);

  return wrapper;
}

function createEmptyState() {
  const empty = createElement("section", "deck-empty");
  const filteringHidden = showHidden && activeLibrary !== "catalog";
  const title = createElement("h2", "", getEmptyStateTitle());
  const message = createElement(
    "p",
    "",
    filteringHidden
      ? "Quando voce ocultar jogos ou apps, eles aparecem aqui para restaurar ou abrir detalhes."
      : currentFolder
      ? `Nao encontrei ${activeLibrary === "apps" ? "apps do catalogo" : "jogos confirmados"} em ${currentFolder}.`
      : activeLibrary === "apps"
        ? "Use a busca automatica para encontrar apps uteis instalados."
        : "Escolha uma pasta para procurar seus jogos."
  );
  const button = createElement("button", "primary-action", filteringHidden ? "Ver biblioteca" : "Escolher pasta");

  button.type = "button";
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    playUiSound("click");

    if (filteringHidden) {
      showHidden = false;
      selectedIndex = 0;
      activeMenuIndex = null;
      saveChoice(storageKeys.showHidden, "off");
      renderLibrary();
      return;
    }

    await chooseFolderFromLibrary();
  });

  empty.append(title, message, button);

  return empty;
}

function getFilteredEmptyText() {
  if (showHidden && activeLibrary !== "catalog") {
    return searchQuery
      ? "Nenhum item oculto encontrado com esse nome."
      : "Nenhum item oculto nesta biblioteca.";
  }

  if (activeLibrary === "catalog") {
    return "Nenhum app encontrado no catalogo.";
  }

  if (activeLibrary === "apps") {
    return searchQuery
      ? "Nenhum app encontrado com esse nome."
      : "Nenhum app util instalado encontrado.";
  }

  return searchQuery
    ? "Nenhum jogo encontrado com esse nome."
    : "Nenhum jogo encontrado.";
}

async function chooseFolderFromLibrary() {
  if (!window.mobdeck?.selectFolder) {
    saveChoice(storageKeys.skipAutoOpenOnce, "1");
    location.reload();
    return;
  }

  const folder = await window.mobdeck.selectFolder();

  if (!folder) {
    return;
  }

  await scanAndRender(folder);
}

function createCarouselArrow(direction) {
  const isLeft = direction === "left";
  const button = createElement(
    "button",
    `carousel-arrow carousel-arrow-${direction}`,
    isLeft ? "Anterior" : "Proximo"
  );

  button.type = "button";
  button.title = isLeft
    ? `${getActiveItemSingular()} anterior`
    : `Proximo ${getActiveItemSingular()}`;
  button.setAttribute("aria-label", button.title);
  button.disabled = getActiveItems().length <= 1;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    isLeft ? selectPreviousGame() : selectNextGame();
  });

  return button;
}

function createGameCard(game, index, positionClass, variant) {
  const classes = [
    "deck-game-card",
    positionClass,
    variant === "grid" ? "grid-game-card" : "",
    index === selectedIndex ? "is-selected" : "",
    isFavorite(game) ? "is-favorite" : "",
    isHidden(game) ? "is-hidden-game" : ""
  ].filter(Boolean);
  const card = createElement("article", classes.join(" "));

  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `${game.name}: abrir opcoes`);
  card.addEventListener("mouseenter", playHoverSound);
  card.addEventListener("focus", playHoverSound);
  card.addEventListener("click", (event) => {
    event.stopPropagation();
    selectedIndex = index;
    activeMenuIndex = activeMenuIndex === index ? null : index;
    playUiSound(activeMenuIndex === index ? "open" : "select");
    renderLibrary();
  });

  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    selectedIndex = index;
    activeMenuIndex = index;
    playUiSound("open");
    renderLibrary();
  });

  const title = createElement("strong", "game-title", game.name);

  card.append(renderCover(game), title);

  if (isFavorite(game)) {
    card.append(createElement("span", "favorite-mark", "\u2665"));
  }

  card.append(createCardActions(game));

  return card;
}

function openActionsForCurrentCarouselCard(index) {
  if (index !== selectedIndex || activeMenuIndex === index) {
    return;
  }

  activeMenuIndex = index;
  playUiSound("focus");
  renderLibrary();
}

function selectItemFromPointer(index, options = {}) {
  const changed = selectedIndex !== index || (options.openActions && activeMenuIndex !== index);

  if (!changed) {
    return;
  }

  selectedIndex = index;

  if (options.openActions) {
    activeMenuIndex = index;
  }

  playUiSound("focus");
  renderLibrary();
}

function playHoverSound() {
  const now = Date.now();

  if (now - lastHoverSoundAt < 85) {
    return;
  }

  lastHoverSoundAt = now;
  playUiSound("focus");
}

function createCardActions(game) {
  const actions = createElement("div", "card-actions");
  const play = createElement("button", "card-action primary", getPrimaryActionLabel(game));

  play.type = "button";
  play.addEventListener("click", async (event) => {
    event.stopPropagation();
    await launchGame(game, play);
  });

  actions.addEventListener("click", (event) => event.stopPropagation());
  actions.append(play);

  return actions;
}

function renderCover(game) {
  const cover = createElement("div", "game-cover");
  const image = new Image();
  const sources = getCoverSources(game);
  let sourceIndex = 0;

  image.className = "cover-img";
  image.alt = game.name;
  image.loading = "lazy";
  image.draggable = false;

  function loadNextSource() {
    const source = sources[sourceIndex];
    sourceIndex += 1;

    if (!source) {
      image.removeEventListener("error", loadNextSource);
      image.classList.add("is-generated-cover");
      image.classList.remove("is-icon-cover");

      if (shouldRequestAppIcon(game)) {
        requestAppIcon(game);
      }

      image.src = createGeneratedCover(game);
      return;
    }

    image.classList.remove("is-generated-cover");
    image.classList.toggle("is-icon-cover", source === normalizeImageSource(game.icon));
    image.src = source;
  }

  image.addEventListener("error", loadNextSource);
  cover.append(image);
  loadNextSource();

  return cover;
}

function getCoverSources(game) {
  const knownCover = createKnownCover(game);
  const sources = [
    knownCover,
    game.icon,
    ...(Array.isArray(game.coverSources) ? game.coverSources : []),
    game.cover,
    game.fallbackCover
  ];
  const normalized = sources.map(normalizeImageSource).filter(Boolean);

  return [...new Set(normalized)];
}

function createKnownCover(game) {
  const normalized = normalizeSearch(game?.name);

  if (!normalized) {
    return "";
  }

  if (normalized.includes("roblox")) {
    return createBrandedCover(game, {
      title: "ROBLOX",
      subtitle: "PLAYER",
      mark: "R",
      accent: "#f6f2ff",
      mid: "#b04cff",
      dark: "#16051f",
      shape: "diamond"
    });
  }

  if (normalized.includes("minecraft") || normalized.includes("mine launcher")) {
    return createBrandedCover(game, {
      title: "MINECRAFT",
      subtitle: "LAUNCHER",
      mark: "M",
      accent: "#d85cff",
      mid: "#7b35ff",
      dark: "#0d0718",
      shape: "blocks"
    });
  }

  return "";
}

function shouldRequestAppIcon(game) {
  return !!(
    game?.exe
    && !game.icon
    && !String(game.exe).startsWith("shell:AppsFolder\\")
    && (
      activeLibrary === "apps"
      || game.provider === "app"
      || game.provider === "launcher"
      || game.source === "lnk"
    )
  );
}

async function requestAppIcon(game) {
  const key = getGameKey(game);

  if (!key || iconRequests.has(key) || !window.mobdeck?.getAppIcon) {
    return;
  }

  iconRequests.add(key);

  try {
    const icon = await window.mobdeck.getAppIcon(game);

    if (!icon) {
      return;
    }

    game.icon = icon;
    game.coverSources = [icon, ...(Array.isArray(game.coverSources) ? game.coverSources : [])];
    saveLibrarySnapshot({ mode: "cached-icons" });
    renderLibrary();
  } catch {
    // Icon extraction is best effort.
  }
}

function createGeneratedCover(game) {
  const isApp = activeLibrary === "apps" || activeLibrary === "catalog" || game?.provider === "app" || game?.provider === "catalog";
  const title = String(game?.name || (isApp ? "App" : "Jogo")).trim() || (isApp ? "App" : "Jogo");
  const lines = splitTitle(title).slice(0, 4);
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  const hue = hashString(title) % 360;
  const iconArt = isApp
    ? `<g transform="translate(300 326)">
        <rect x="-92" y="-92" width="184" height="184" rx="42" fill="none" stroke="#f0c7ff" stroke-width="10" opacity="0.86"/>
        <rect x="-49" y="-49" width="38" height="38" rx="10" fill="#ffffff" opacity="0.95"/>
        <rect x="11" y="-49" width="38" height="38" rx="10" fill="#ffffff" opacity="0.82"/>
        <rect x="-49" y="11" width="38" height="38" rx="10" fill="#ffffff" opacity="0.82"/>
        <rect x="11" y="11" width="38" height="38" rx="10" fill="#ffffff" opacity="0.95"/>
      </g>`
    : `<circle cx="300" cy="330" r="128" fill="none" stroke="#d757ff" stroke-width="10" opacity="0.72"/>
      <text x="300" y="365" text-anchor="middle" font-size="124" font-weight="900" fill="#ffffff" opacity="0.96">${escapeXml(initials || "MD")}</text>`;
  const lineSvg = lines
    .map((line, index) => {
      const y = 545 + index * 58;
      return `<text x="300" y="${y}" text-anchor="middle" font-size="44" font-weight="900" fill="#ffffff">${escapeXml(line)}</text>`;
    })
    .join("");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="hsl(${hue}, 78%, 18%)"/>
          <stop offset="0.55" stop-color="#160728"/>
          <stop offset="1" stop-color="hsl(${(hue + 42) % 360}, 86%, 36%)"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="42%" r="58%">
          <stop offset="0" stop-color="#d94cff" stop-opacity="0.88"/>
          <stop offset="0.5" stop-color="#8d3dff" stop-opacity="0.32"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="600" height="900" rx="38" fill="url(#bg)"/>
      <rect width="600" height="900" rx="38" fill="url(#glow)"/>
      <path d="M75 116 H525 M75 784 H525" stroke="#c04cff" stroke-width="5" stroke-linecap="round" opacity="0.45"/>
      ${iconArt}
      ${lineSvg}
      <text x="300" y="792" text-anchor="middle" font-size="25" font-weight="800" fill="#dcb7ff" letter-spacing="9">${isApp ? "MOB APPS" : "MOB DECK"}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createBrandedCover(game, theme) {
  const title = theme.title || String(game?.name || "MOB");
  const subtitle = theme.subtitle || "DECK";
  const mark = theme.mark || title[0] || "M";
  const accent = theme.accent || "#d85cff";
  const mid = theme.mid || "#7b35ff";
  const dark = theme.dark || "#10051d";
  const shapeArt = theme.shape === "blocks"
    ? `<g transform="translate(300 344)">
        <rect x="-112" y="-92" width="78" height="78" rx="14" fill="${accent}" opacity=".92"/>
        <rect x="-22" y="-126" width="88" height="88" rx="14" fill="#ffffff" opacity=".9"/>
        <rect x="78" y="-74" width="74" height="74" rx="14" fill="${mid}" opacity=".88"/>
        <rect x="-76" y="12" width="92" height="92" rx="15" fill="${mid}" opacity=".74"/>
        <rect x="34" y="22" width="102" height="102" rx="18" fill="${accent}" opacity=".7"/>
      </g>`
    : `<g transform="translate(300 334)">
        <rect x="-88" y="-88" width="176" height="176" rx="32" fill="${accent}" opacity=".92" transform="rotate(11)"/>
        <rect x="-28" y="-28" width="56" height="56" rx="12" fill="${dark}" opacity=".92" transform="rotate(11)"/>
      </g>`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#05020b"/>
          <stop offset=".55" stop-color="${dark}"/>
          <stop offset="1" stop-color="#26073a"/>
        </linearGradient>
        <linearGradient id="line" x1="0" x2="1">
          <stop offset="0" stop-color="${accent}" stop-opacity="0"/>
          <stop offset=".5" stop-color="${accent}" stop-opacity=".82"/>
          <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="600" height="900" rx="38" fill="url(#bg)"/>
      <path d="M64 120 H536 M64 780 H536" stroke="url(#line)" stroke-width="5" stroke-linecap="round"/>
      <path d="M106 190 L494 132 M92 724 L508 664" stroke="${mid}" stroke-width="3" opacity=".32"/>
      ${shapeArt}
      <text x="300" y="545" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="62" font-weight="900" fill="#ffffff">${escapeXml(title)}</text>
      <text x="300" y="602" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="900" fill="${accent}" letter-spacing="8">${escapeXml(subtitle)}</text>
      <text x="300" y="792" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="23" font-weight="900" fill="#d8c7ff" letter-spacing="9">MOB DECK</text>
      <text x="300" y="371" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="126" font-weight="900" fill="#ffffff" opacity=".08">${escapeXml(mark)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function splitTitle(title) {
  const words = title.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;

    if (next.length > 15 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines.length ? lines : [title];
}

function createSelectedGamePanel() {
  const panel = createElement("section", `selected-game-panel ${viewMode === "grid" ? "is-grid-selection" : ""}`);
  const game = getSelectedGame();

  if (!game) {
    panel.classList.add("is-empty");
    return panel;
  }

  const text = createElement("div", "selected-game-text");
  const title = createElement("h2", "", game.name);
  const meta = createElement("div", "selected-game-meta-row");
  const provider = createElement("span", "selected-chip", game.appCategoryName || game.categoryName || formatProvider(game.provider));
  const launchText = activeLibrary === "catalog"
    ? game.installed ? "Instalado" : game.wingetId ? "WinGet" : "Site"
    : game.launchUri || game.steamAppId ? "Launcher correto" : "Exec direto";
  const launch = createElement("span", "selected-chip", launchText);
  const size = game.sizeBytes ? createElement("span", "selected-chip", formatBytes(game.sizeBytes)) : null;
  const recent = game.lastPlayedAt ? createElement("span", "selected-chip", "Recente") : null;
  const favorite = isFavorite(game) ? createElement("span", "selected-chip is-favorite-chip", "Favorito") : null;
  const summary = activeLibrary === "catalog" && game.summary
    ? createElement("p", "selected-game-summary", game.summary)
    : null;

  meta.append(provider, launch);

  if (size) {
    meta.append(size);
  }

  if (recent) {
    meta.append(recent);
  }

  if (favorite) {
    meta.append(favorite);
  }

  text.append(title, meta);

  if (summary) {
    text.append(summary);
  }

  panel.append(text);

  return panel;
}

function createBottomNav() {
  const nav = createElement("nav", "deck-bottom-nav deck-top-actions");
  const game = getSelectedGame();
  const tools = createElement("div", "top-tool-group");

  if (activeLibrary !== "catalog" && !currentGames.length && !currentApps.length) {
    return nav;
  }

  nav.append(createLibraryTabs());

  if (activeLibrary === "catalog") {
    tools.append(createRescanButton(), createSortButton(), createHelpButton());
    nav.append(tools);
    return nav;
  }

  if (game && activeLibrary === "games") {
    tools.append(createFavoriteButton(game));
  }

  tools.append(
    createRescanButton(),
    createViewModeButton(),
    createSortButton(),
    createHiddenToggleButton(),
    createHelpButton(),
    createDetailsButton(game)
  );
  nav.append(tools);

  return nav;
}

function createLibraryTabs() {
  const tabs = createElement("div", "library-tabs");

  libraryModes.forEach((mode) => {
    const info = getLibraryInfo(mode);
    const button = createElement("button", `library-tab${activeLibrary === mode ? " is-active" : ""}`);

    button.type = "button";
    button.title = `Ver ${info.navLabel}`;
    button.setAttribute("aria-label", button.title);
    button.append(
      createElement("span", "library-tab-icon", info.icon),
      createElement("span", "", info.shortLabel)
    );
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      playUiSound("toggle");
      switchLibrary(mode);
    });
    tabs.append(button);
  });

  return tabs;
}

function createFavoriteButton(game) {
  const favorite = isFavorite(game);
  const button = createElement("button", `nav-icon nav-action${favorite ? " is-on" : ""}`, favorite ? "\u2665" : "\u2661");

  button.type = "button";
  button.title = favorite ? "Remover dos favoritos" : "Favoritar";
  button.setAttribute("aria-label", button.title);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    playUiSound(favorite ? "unfavorite" : "favorite");
    toggleFavorite(game);
  });

  setNavButtonLabel(button, "Fav");

  return button;
}

function createRescanButton() {
  const canRescan = !!getCurrentRescanConfig();
  const button = createElement("button", `nav-icon nav-action rescan-nav${isRescanning ? " is-loading" : ""}`, isRescanning ? "..." : "\u21BB");

  button.type = "button";
  button.title = canRescan ? "Reescanear biblioteca" : "Reescanear indisponivel";
  button.setAttribute("aria-label", button.title);
  button.disabled = isRescanning || !canRescan;
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    await rescanCurrentLibrary();
  });

  setNavButtonLabel(button, "Scan");

  return button;
}

function createSettingsButton() {
  const button = createElement("button", `nav-icon nav-action settings-nav${settingsOpen ? " is-on" : ""}`, "\u2699");

  button.type = "button";
  button.title = "Configuracoes";
  button.setAttribute("aria-label", "Configuracoes");
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    openSettings();
  });

  setNavButtonLabel(button, "Config");

  return button;
}

function createHelpButton() {
  const button = createElement("button", `nav-icon nav-action help-nav${helpOpen ? " is-on" : ""}`, "?");

  button.type = "button";
  button.title = "Manual e atalhos";
  button.setAttribute("aria-label", "Manual e atalhos");
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    openHelp();
  });

  setNavButtonLabel(button, "Ajuda");

  return button;
}

function createLibraryModeButton() {
  const currentIndex = libraryModes.indexOf(activeLibrary);
  const nextLibrary = libraryModes[(currentIndex + 1 + libraryModes.length) % libraryModes.length];
  const nextInfo = getLibraryInfo(nextLibrary);
  const button = createElement("button", `nav-icon nav-action library-switch is-on show-${nextLibrary}`, nextLibrary === "catalog" ? "+" : "");

  button.type = "button";
  button.title = `Ver ${nextInfo.navLabel}`;
  button.setAttribute("aria-label", button.title);

  if (nextLibrary !== "catalog") {
    button.append(createLibrarySwitchIcon(nextLibrary));
  }

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    playUiSound("toggle");
    switchLibrary(nextLibrary);
  });

  setNavButtonLabel(button, nextInfo.shortLabel);

  return button;
}

function createLibrarySwitchIcon(target) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const pathA = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const pathB = document.createElementNS("http://www.w3.org/2000/svg", "path");

  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("library-switch-icon");

  if (target === "apps") {
    pathA.setAttribute("d", "M16 14h14v14H16zM34 14h14v14H34zM16 34h14v14H16zM34 34h14v14H34z");
    pathB.setAttribute("d", "M16 14h14v14H16zM34 14h14v14H34zM16 34h14v14H16zM34 34h14v14H34z");
  } else {
    pathA.setAttribute("d", "M18 27c-6 0-10 5-10 12 0 6 4 11 9 11 3 0 5-3 8-3h14c3 0 5 3 8 3 5 0 9-5 9-11 0-7-4-12-10-12H18z");
    pathB.setAttribute("d", "M21 34v-6M18 31h6M43 32h.1M49 38h.1");
  }

  pathA.setAttribute("class", "switch-icon-fill");
  pathB.setAttribute("class", target === "apps" ? "switch-icon-lines" : "switch-icon-lines game-lines");
  svg.append(pathA, pathB);

  return svg;
}

function createViewModeButton() {
  const isGrid = viewMode === "grid";
  const button = createElement("button", `nav-icon nav-action${isGrid ? " is-on" : ""}`, isGrid ? "\u21C4" : "\u25A6");

  button.type = "button";
  button.title = isGrid ? "Ver em carrossel" : "Ver em grade";
  button.setAttribute("aria-label", button.title);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    playUiSound("toggle");
    viewMode = isGrid ? "carousel" : "grid";
    activeMenuIndex = null;
    searchQuery = isGrid ? "" : searchQuery;
    saveChoice(storageKeys.viewMode, viewMode);
    renderLibrary();
  });

  setNavButtonLabel(button, isGrid ? "Carrossel" : "Grade");

  return button;
}

function createSortButton() {
  const button = createElement("button", "nav-icon nav-action sort-nav", getSortIcon(sortMode));

  button.type = "button";
  button.title = `Ordenar por ${getSortLabel(sortMode).toLowerCase()}`;
  button.setAttribute("aria-label", button.title);
  button.addEventListener("click", (event) => {
    const modes = activeLibrary === "catalog" ? ["name", "provider"] : ["name", "favorite", "recent", "provider", "size"];
    const currentIndex = modes.indexOf(sortMode);

    event.stopPropagation();
    sortMode = modes[(currentIndex + 1 + modes.length) % modes.length];
    selectedIndex = 0;
    activeMenuIndex = null;
    playUiSound("toggle");
    saveChoice(storageKeys.sortMode, sortMode);
    renderLibrary();
  });

  setNavButtonLabel(button, "Ordem");

  return button;
}

function createSoundButton() {
  const button = createElement("button", `nav-icon nav-action sound-nav${soundEnabled ? " is-on" : ""}`, soundEnabled ? "\u266B" : "\u266A");

  button.type = "button";
  button.title = soundEnabled ? "Desligar sons" : "Ligar sons";
  button.setAttribute("aria-label", button.title);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    soundEnabled = !soundEnabled;
    saveChoice(storageKeys.soundEnabled, soundEnabled ? "on" : "off");
    playUiSound(soundEnabled ? "enable" : "disable", true);
    renderLibrary();
  });

  setNavButtonLabel(button, "Som");

  return button;
}

function createHiddenToggleButton() {
  const button = createElement("button", `nav-icon nav-action hidden-nav${showHidden ? " is-on" : ""}`, showHidden ? "\u25C9" : "\u25CE");

  button.type = "button";
  button.title = showHidden ? "Voltar para biblioteca" : "Ver somente ocultos";
  button.setAttribute("aria-label", button.title);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    showHidden = !showHidden;
    selectedIndex = 0;
    activeMenuIndex = null;
    playUiSound("toggle");
    saveChoice(storageKeys.showHidden, showHidden ? "on" : "off");
    renderLibrary();
  });

  setNavButtonLabel(button, showHidden ? "Todos" : "Ocultos");

  return button;
}

function getSortLabel(mode) {
  const labels = {
    name: "Nome",
    favorite: "Favoritos",
    recent: "Recentes",
    provider: activeLibrary === "catalog" ? "Categoria" : activeLibrary === "apps" ? "Tipo" : "Plataforma",
    size: "Tamanho"
  };

  return labels[mode] || labels.name;
}

function getSortIcon(mode) {
  const icons = {
    name: "A",
    favorite: "\u2665",
    recent: "\u21BA",
    provider: "\u25C7",
    size: "GB"
  };

  return icons[mode] || icons.name;
}

function createDetailsButton(game) {
  const button = createElement("button", "nav-icon nav-action details-nav", "i");

  button.type = "button";
  button.title = "Detalhes";
  button.setAttribute("aria-label", "Detalhes");
  button.disabled = !game;
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    await openDetails(game);
  });

  setNavButtonLabel(button, "Info");

  return button;
}

function setNavButtonLabel(button, label) {
  if (!button || !label) {
    return button;
  }

  button.append(createElement("span", "nav-label", label));

  return button;
}

function switchLibrary(library) {
  if (!libraryModes.includes(library) || activeLibrary === library) {
    return;
  }

  activeLibrary = library;
  selectedIndex = 0;
  activeMenuIndex = null;
  detailsState = null;
  settingsOpen = false;
  helpOpen = false;
  searchQuery = "";
  saveChoice(storageKeys.activeLibrary, activeLibrary);
  renderLibrary();
}

function launchSelectedItem() {
  const item = getSelectedGame();

  if (!item) {
    return;
  }

  if (activeLibrary === "catalog") {
    handleCatalogAction(item);
    return;
  }

  launchGame(item);
}

function openHelp() {
  helpOpen = true;
  settingsOpen = false;
  detailsState = null;
  activeMenuIndex = null;
  playUiSound("open");
  renderLibrary();
}

function closeHelp() {
  helpOpen = false;
  renderLibrary();
}

function createHelpModal() {
  const overlay = createElement("div", "details-overlay help-overlay");
  const modal = createElement("section", "details-modal help-modal");
  const close = createElement("button", "details-close", "\u00d7");
  const title = createElement("h2", "", "Manual rapido");
  const body = createElement("div", "help-body");
  const keyboard = createHelpSection("Teclado", [
    ["Setas", "Navegar"],
    ["G", "Jogos"],
    ["A", "Apps"],
    ["C", "Catalogo"],
    ["R", "Reescanear"],
    ["Espaco", "Abrir selecionado"],
    ["F1 ou ?", "Manual"],
    ["Esc", "Voltar / fechar"]
  ]);
  const controller = createHelpSection(getControllerHelpTitle(), getControllerShortcuts());

  close.type = "button";
  close.title = "Fechar";
  close.setAttribute("aria-label", "Fechar manual");
  close.addEventListener("click", closeHelp);

  modal.addEventListener("click", (event) => event.stopPropagation());
  overlay.addEventListener("click", closeHelp);
  body.append(keyboard, controller);
  modal.append(close, title, body);
  overlay.append(modal);

  return overlay;
}

function createHelpSection(title, rows) {
  const section = createElement("section", "help-section");
  const heading = createElement("h3", "", title);
  const list = createElement("dl", "help-shortcuts");

  rows.forEach(([key, action]) => {
    list.append(createElement("dt", "", key), createElement("dd", "", action));
  });

  section.append(heading, list);

  return section;
}

function getControllerHelpTitle() {
  if (!gamepadMode) {
    return "Controle";
  }

  return `Controle ${getControllerDisplayName()}`;
}

function getControllerShortcuts() {
  if (isPlayStationController()) {
    return [
      ["X", "Abrir selecionado"],
      ["O", "Voltar / fechar"],
      ["L1 / R1", "Trocar aba"],
      ["Direcional", "Navegar 4 direcoes"],
      ["Options", "Manual"]
    ];
  }

  return [
    ["A", "Abrir selecionado"],
    ["B", "Voltar / fechar"],
    ["LB / RB", "Trocar aba"],
    ["Direcional", "Navegar 4 direcoes"],
    ["Menu", "Manual"]
  ];
}

function createControllerBadge() {
  const badge = createElement("div", "controller-badge");
  const name = getControllerDisplayName();
  const confirm = isPlayStationController() ? "X" : "A";
  const back = isPlayStationController() ? "O" : "B";

  badge.append(
    createElement("strong", "", name),
    createElement("span", "", `${confirm} abrir`),
    createElement("span", "", `${back} voltar`),
    createElement("span", "", "LB/RB abas")
  );

  return badge;
}

function isPlayStationController() {
  return String(controllerType || "").startsWith("playstation");
}

function getControllerDisplayName() {
  if (controllerType === "playstation-5") {
    return "PlayStation 5";
  }

  if (controllerType === "playstation-4") {
    return "PlayStation 4";
  }

  if (controllerType === "xbox") {
    return "Xbox";
  }

  return "Controle";
}

function setupGamepadNavigation() {
  window.addEventListener("gamepadconnected", (event) => {
    gamepadMode = true;
    controllerType = detectControllerType(event.gamepad?.id);
    playUiSound("enable", true);
    renderLibrary();
  });

  window.addEventListener("gamepaddisconnected", () => {
    const hasGamepad = getActiveGamepad();

    gamepadMode = !!hasGamepad;
    controllerType = hasGamepad ? detectControllerType(hasGamepad.id) : "generic";
    renderLibrary();
  });

  requestAnimationFrame(pollGamepads);
}

function pollGamepads() {
  const gamepad = getActiveGamepad();

  if (gamepad) {
    if (!gamepadMode) {
      gamepadMode = true;
      controllerType = detectControllerType(gamepad.id);
      renderLibrary();
    }

    handleGamepadInput(gamepad);
  }

  requestAnimationFrame(pollGamepads);
}

function getActiveGamepad() {
  return Array.from(navigator.getGamepads?.() || []).find(Boolean) || null;
}

function detectControllerType(id = "") {
  const text = String(id).toLowerCase();

  if (
    text.includes("dualsense")
    || text.includes("ps5")
    || text.includes("playstation 5")
    || text.includes("054c:0ce6")
  ) {
    return "playstation-5";
  }

  if (
    text.includes("dualshock")
    || text.includes("dual shock")
    || text.includes("wireless controller")
    || text.includes("playstation")
    || text.includes("ps4")
    || text.includes("sony")
    || text.includes("054c")
  ) {
    return "playstation-4";
  }

  if (text.includes("xbox") || text.includes("xinput")) {
    return "xbox";
  }

  return "generic";
}

function handleGamepadInput(gamepad) {
  const now = Date.now();
  const direction = getGamepadDirection(gamepad);
  const navigation = getGamepadNavigationDirection(direction);

  if (navigation && now - lastGamepadMoveAt > 180) {
    moveSelection(navigation);
    playUiSound("focus");
    lastGamepadMoveAt = now;
  }

  handleGamepadButton(gamepad, 0, () => launchSelectedItem());
  handleGamepadButton(gamepad, 1, () => closeTopLayerOrBack());
  handleGamepadButton(gamepad, 4, () => switchToAdjacentLibrary(-1));
  handleGamepadButton(gamepad, 5, () => switchToAdjacentLibrary(1));
  handleGamepadButton(gamepad, 9, () => openHelp());
}

function getGamepadDirection(gamepad) {
  const direction = {
    left: false,
    right: false,
    up: false,
    down: false
  };

  applyAxisDirection(direction, gamepad.axes?.[0], gamepad.axes?.[1]);
  applyAxisDirection(direction, gamepad.axes?.[6], gamepad.axes?.[7]);
  applyHatAxisDirection(direction, gamepad.axes?.[9]);

  direction.up = direction.up || !!gamepad.buttons?.[12]?.pressed;
  direction.down = direction.down || !!gamepad.buttons?.[13]?.pressed;
  direction.left = direction.left || !!gamepad.buttons?.[14]?.pressed;
  direction.right = direction.right || !!gamepad.buttons?.[15]?.pressed;

  return direction;
}

function applyAxisDirection(direction, xAxis = 0, yAxis = 0) {
  const x = Number(xAxis) || 0;
  const y = Number(yAxis) || 0;
  const deadzone = 0.55;

  direction.left = direction.left || x < -deadzone;
  direction.right = direction.right || x > deadzone;
  direction.up = direction.up || y < -deadzone;
  direction.down = direction.down || y > deadzone;
}

function applyHatAxisDirection(direction, value) {
  const hat = Number(value);

  if (!Number.isFinite(hat) || hat > 1.2) {
    return;
  }

  if (hat <= -0.86) {
    direction.up = true;
    return;
  }

  if (hat <= -0.57) {
    direction.up = true;
    direction.right = true;
    return;
  }

  if (hat <= -0.28) {
    direction.right = true;
    return;
  }

  if (hat <= 0) {
    direction.right = true;
    direction.down = true;
    return;
  }

  if (hat <= 0.28) {
    direction.down = true;
    return;
  }

  if (hat <= 0.57) {
    direction.down = true;
    direction.left = true;
    return;
  }

  if (hat <= 0.86) {
    direction.left = true;
    return;
  }

  direction.left = true;
  direction.up = true;
}

function getGamepadNavigationDirection(direction) {
  if (!direction.left && !direction.right && !direction.up && !direction.down) {
    return null;
  }

  if (isGridNavigationActive() && (direction.up || direction.down)) {
    return direction.up ? "up" : "down";
  }

  if (direction.left || direction.right) {
    return direction.left ? "left" : "right";
  }

  return direction.up ? "up" : "down";
}

function handleGamepadButton(gamepad, index, callback) {
  const pressed = !!gamepad.buttons?.[index]?.pressed;
  const key = `${gamepad.index}:${index}`;
  const wasPressed = !!lastGamepadButtonState[key];

  if (pressed && !wasPressed) {
    callback();
  }

  lastGamepadButtonState[key] = pressed;
}

function switchToAdjacentLibrary(direction) {
  const currentIndex = libraryModes.indexOf(activeLibrary);
  const nextIndex = (currentIndex + direction + libraryModes.length) % libraryModes.length;

  switchLibrary(libraryModes[nextIndex]);
}

function closeTopLayerOrBack() {
  if (helpOpen) {
    closeHelp();
    return;
  }

  if (settingsOpen) {
    closeSettings();
    return;
  }

  if (detailsState) {
    closeDetails();
    return;
  }

  if (profileEditorState) {
    closeProfileEditor();
    return;
  }

  if (diagnosticsState) {
    closeDiagnostics();
    return;
  }

  activeMenuIndex = null;
  renderLibrary();
}

function openSettings() {
  settingsOpen = true;
  detailsState = null;
  activeMenuIndex = null;
  playUiSound("open");
  renderLibrary();
  loadCompanionStatus(true);
}

function closeSettings() {
  settingsOpen = false;
  renderLibrary();
}

async function loadCompanionStatus(force = false) {
  if (!window.mobdeck?.getCompanionStatus || (companionStatusLoading && !force)) {
    return;
  }

  companionStatusLoading = true;

  try {
    companionStatus = await window.mobdeck.getCompanionStatus();
  } catch {
    companionStatus = {
      running: false,
      primaryUrl: "",
      gameCount: 0
    };
  } finally {
    companionStatusLoading = false;

    if (settingsOpen) {
      renderLibrary();
    }
  }
}

function createSettingsModal() {
  const overlay = createElement("div", "details-overlay settings-overlay");
  const modal = createElement("section", "details-modal settings-modal");
  const close = createElement("button", "details-close", "\u00d7");
  const title = createElement("h2", "", "Configuracoes");
  const body = createElement("div", "settings-body");
  const actions = createElement("div", "details-actions settings-actions");
  const rescan = createElement("button", "primary-action", isRescanning ? "Atualizando..." : "Reescanear");
  const done = createElement("button", "card-action secondary", "Fechar");

  close.type = "button";
  close.title = "Fechar";
  close.setAttribute("aria-label", "Fechar configuracoes");
  close.addEventListener("click", closeSettings);

  modal.addEventListener("click", (event) => event.stopPropagation());
  overlay.addEventListener("click", closeSettings);

  body.append(
    createSettingsToggle(
      "Recolher ao abrir jogo/app",
      minimizeOnLaunch,
      "O MOB Deck fica na bandeja depois de abrir um item.",
      (enabled) => {
        minimizeOnLaunch = enabled;
        saveChoice(storageKeys.minimizeOnLaunch, minimizeOnLaunch ? "on" : "off");
      }
    ),
    createSettingsToggle(
      "Sons da interface",
      soundEnabled,
      "Feedback sonoro nos botoes e na navegacao.",
      (enabled) => {
        soundEnabled = enabled;
        saveChoice(storageKeys.soundEnabled, soundEnabled ? "on" : "off");
      },
      true
    ),
    createSettingsToggle(
      "Ver somente ocultos",
      showHidden,
      "Filtra a biblioteca para exibir apenas itens ocultos.",
      (enabled) => {
        showHidden = enabled;
        selectedIndex = 0;
        activeMenuIndex = null;
        saveChoice(storageKeys.showHidden, showHidden ? "on" : "off");
      }
    ),
    createSettingsSegment(
      "Visual da biblioteca",
      viewMode,
      [
        ["carousel", "Carrossel"],
        ["grid", "Grade"]
      ],
      (value) => {
        viewMode = value;
        searchQuery = value === "carousel" ? "" : searchQuery;
        saveChoice(storageKeys.viewMode, viewMode);
      }
    ),
    createSettingsSegment(
      "Ordenacao",
      sortMode,
      getSortSettingsOptions(),
      (value) => {
        sortMode = value;
        selectedIndex = 0;
        activeMenuIndex = null;
        saveChoice(storageKeys.sortMode, sortMode);
      }
    ),
    createSettingsSegment(
      "Tamanho da grade",
      gridSize,
      [
        ["small", "Pequena"],
        ["medium", "Media"],
        ["large", "Grande"]
      ],
      (value) => {
        gridSize = value;
        saveChoice(storageKeys.gridSize, gridSize);
      }
    ),
    createSettingsSegment(
      "Biblioteca inicial",
      activeLibrary,
      [
        ["games", "Jogos"],
        ["apps", "Apps"],
        ["catalog", "Catalogo"]
      ],
      (value) => {
        activeLibrary = value;
        selectedIndex = 0;
        searchQuery = "";
        saveChoice(storageKeys.activeLibrary, activeLibrary);
      }
    ),
    createSettingsActionRow(
      "Manual rapido",
      "Atalhos, controle e navegacao.",
      [
        ["Abrir", () => openHelp()]
      ]
    ),
    createSettingsActionRow(
      "Diagnostico gamer",
      "PC, biblioteca, discos, launchers e servidor mobile.",
      [
        ["Abrir", () => openDiagnostics()]
      ]
    ),
    createSettingsActionRow(
      "Backup e restauracao",
      "Exporta biblioteca, favoritos, ocultos, capas, perfis e preferencias.",
      [
        ["Exportar", () => exportBackup()],
        ["Importar", () => importBackup()]
      ]
    ),
    createCompanionSettingsRow()
  );

  rescan.type = "button";
  rescan.disabled = isRescanning || !getCurrentRescanConfig();
  rescan.addEventListener("click", async (event) => {
    event.stopPropagation();
    await rescanCurrentLibrary();
  });

  done.type = "button";
  done.addEventListener("click", (event) => {
    event.stopPropagation();
    closeSettings();
  });

  actions.append(rescan, done);
  modal.append(close, title, body, actions);
  overlay.append(modal);

  return overlay;
}

function createCompanionSettingsRow() {
  const row = createElement("div", "settings-row companion-settings-row");
  const text = createElement("div", "settings-row-text");
  const title = createElement("span", "settings-row-title", "Companion mobile");
  const detail = createElement("span", "settings-row-value", getCompanionSettingsText());
  const actions = createElement("div", "settings-segment");
  const qr = createElement("button", "", "QR");
  const copy = createElement("button", "", "Copiar");
  const refresh = createElement("button", "", companionStatusLoading ? "..." : "Atualizar");

  qr.type = "button";
  qr.title = "Exibir QR Mobile / Wake-on-LAN";
  qr.setAttribute("aria-label", qr.title);
  qr.addEventListener("click", async (event) => {
    event.stopPropagation();
    playUiSound("toggle");
    await showMobileQr();
  });

  copy.type = "button";
  copy.disabled = !companionStatus?.primaryUrl;
  copy.addEventListener("click", async (event) => {
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(getCompanionShareText());
      playUiSound("enable");
    } catch {
      playUiSound("disable");
    }
  });

  refresh.type = "button";
  refresh.disabled = companionStatusLoading;
  refresh.addEventListener("click", (event) => {
    event.stopPropagation();
    loadCompanionStatus(true);
  });

  text.append(title, detail);
  actions.append(qr, copy, refresh);
  row.append(text, actions);

  return row;
}

function getCompanionSettingsText() {
  if (companionStatusLoading && !companionStatus) {
    return "Carregando servidor local...";
  }

  if (!companionStatus?.running) {
    return "Servidor local indisponivel.";
  }

  return `QR direto | ${companionStatus.primaryUrl || "sem IP"} | ${companionStatus.gameCount || 0} jogo(s)`;
}

function getCompanionShareText() {
  return [
    `MOB Deck Companion: ${companionStatus?.primaryUrl || ""}`,
    "Pareamento: leia o QR pelo app mobile."
  ].join("\n");
}

async function openDiagnostics() {
  diagnosticsState = {
    loading: true,
    diagnostics: null,
    error: null
  };
  settingsOpen = false;
  playUiSound("open");
  renderLibrary();

  try {
    const diagnostics = await window.mobdeck.getDiagnostics();

    diagnosticsState = {
      loading: false,
      diagnostics,
      error: null
    };
  } catch (error) {
    diagnosticsState = {
      loading: false,
      diagnostics: null,
      error: error.message || "Nao foi possivel carregar diagnostico."
    };
  }

  renderLibrary();
}

function closeDiagnostics() {
  diagnosticsState = null;
  renderLibrary();
}

function createDiagnosticsModal() {
  const overlay = createElement("div", "details-overlay diagnostics-overlay");
  const modal = createElement("section", "details-modal diagnostics-modal");
  const close = createElement("button", "details-close", "\u00d7");
  const title = createElement("h2", "", "Diagnostico gamer");
  const body = createElement("div", "details-body");

  close.type = "button";
  close.title = "Fechar";
  close.setAttribute("aria-label", "Fechar diagnostico");
  close.addEventListener("click", closeDiagnostics);
  overlay.addEventListener("click", closeDiagnostics);
  modal.addEventListener("click", (event) => event.stopPropagation());
  modal.append(close, title);

  if (diagnosticsState.loading) {
    modal.append(createElement("p", "details-loading", "Verificando PC..."));
    overlay.append(modal);
    return overlay;
  }

  if (diagnosticsState.error) {
    modal.append(createElement("p", "details-loading", diagnosticsState.error));
    overlay.append(modal);
    return overlay;
  }

  const diagnostics = diagnosticsState.diagnostics || {};
  const list = createElement("dl", "details-list diagnostics-list");
  const driveText = (diagnostics.drives || [])
    .map((drive) => `${drive.name} ${formatBytes(drive.freeBytes)} livres de ${formatBytes(drive.sizeBytes)}`)
    .join(" | ");
  const launcherText = (diagnostics.launchers || [])
    .map((launcher) => `${launcher.name}: ${launcher.installed ? "OK" : "Nao encontrado"}`)
    .join(" | ");

  [
    ["Servidor mobile", diagnostics.companion?.running ? "Online" : "Offline"],
    ["URL", diagnostics.companion?.primaryUrl],
    ["Biblioteca", `${diagnostics.library?.games || 0} jogo(s), ${diagnostics.library?.apps || 0} app(s)`],
    ["PC", diagnostics.system?.computerName],
    ["RAM livre", `${formatBytes(diagnostics.system?.freeMemoryBytes)} de ${formatBytes(diagnostics.system?.totalMemoryBytes)}`],
    ["Plano energia", diagnostics.system?.powerScheme],
    ["Discos", driveText],
    ["Launchers", launcherText]
  ].forEach(([label, value]) => {
    appendDiagnosticsRow(list, label, value || "Nao informado");
  });

  body.append(list);
  modal.append(body);
  overlay.append(modal);

  return overlay;
}

async function exportBackup() {
  if (!window.mobdeck?.exportUserData) {
    return;
  }

  const payload = {
    localStorage: {
      favorites: [...favoriteKeys],
      hidden: [...hiddenKeys],
      showHidden,
      activeLibrary,
      viewMode,
      gridSize,
      sortMode,
      smartFilter,
      minimizeOnLaunch,
      soundEnabled,
      library: createLibrarySnapshot("backup")
    }
  };
  const result = await window.mobdeck.exportUserData(payload);

  if (result?.ok && statusText) {
    statusText.textContent = `Backup exportado: ${result.filePath}`;
  }
}

async function importBackup() {
  if (!window.mobdeck?.importUserData) {
    return;
  }

  const result = await window.mobdeck.importUserData();

  if (!result?.ok) {
    return;
  }

  applyImportedRendererData(result.renderer);
  await loadLaunchProfiles();
  restoreSavedLibrary();

  if (statusText) {
    statusText.textContent = "Backup importado.";
  }
}

function applyImportedRendererData(renderer) {
  const data = renderer?.localStorage || {};

  if (Array.isArray(data.favorites)) {
    favoriteKeys = new Set(data.favorites);
    saveJson(storageKeys.favorites, [...favoriteKeys]);
  }

  if (Array.isArray(data.hidden)) {
    hiddenKeys = new Set(data.hidden);
    saveJson(storageKeys.hidden, [...hiddenKeys]);
  }

  if (data.library) {
    saveJson(storageKeys.library, data.library);
  }

  if (data.viewMode) saveChoice(storageKeys.viewMode, data.viewMode);
  if (data.gridSize) saveChoice(storageKeys.gridSize, data.gridSize);
  if (data.sortMode) saveChoice(storageKeys.sortMode, data.sortMode);
  if (data.smartFilter) saveChoice(storageKeys.smartFilter, data.smartFilter);
  if (data.activeLibrary) saveChoice(storageKeys.activeLibrary, data.activeLibrary);
  saveChoice(storageKeys.showHidden, data.showHidden ? "on" : "off");
  saveChoice(storageKeys.minimizeOnLaunch, data.minimizeOnLaunch === false ? "off" : "on");
  saveChoice(storageKeys.soundEnabled, data.soundEnabled === false ? "off" : "on");

  viewMode = loadChoice(storageKeys.viewMode, ["carousel", "grid"], viewMode);
  gridSize = loadChoice(storageKeys.gridSize, ["small", "medium", "large"], gridSize);
  sortMode = loadChoice(storageKeys.sortMode, ["name", "favorite", "recent", "provider", "size"], sortMode);
  smartFilter = loadChoice(storageKeys.smartFilter, ["all", "favorites", "hidden", "no-cover", "recent", "large", "never", "collections"], smartFilter);
  activeLibrary = loadChoice(storageKeys.activeLibrary, libraryModes, activeLibrary);
  showHidden = loadChoice(storageKeys.showHidden, ["on", "off"], showHidden ? "on" : "off") === "on";
  minimizeOnLaunch = loadChoice(storageKeys.minimizeOnLaunch, ["on", "off"], minimizeOnLaunch ? "on" : "off") === "on";
  soundEnabled = loadChoice(storageKeys.soundEnabled, ["on", "off"], soundEnabled ? "on" : "off") === "on";
}

function createSettingsToggle(label, enabled, description, onChange, forceSound = false) {
  const row = createElement("div", "settings-row");
  const text = createElement("div", "settings-row-text");
  const title = createElement("span", "settings-row-title", label);
  const detail = createElement("span", "settings-row-value", description);
  const button = createElement("button", `settings-toggle${enabled ? " is-on" : ""}`, enabled ? "Ligado" : "Desligado");

  button.type = "button";
  button.setAttribute("aria-pressed", String(enabled));
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onChange(!enabled);
    playUiSound(!enabled ? "enable" : "disable", forceSound);
    renderLibrary();
  });

  text.append(title, detail);
  row.append(text, button);

  return row;
}

function createSettingsSegment(label, value, options, onChange) {
  const row = createElement("div", "settings-row");
  const text = createElement("div", "settings-row-text");
  const title = createElement("span", "settings-row-title", label);
  const selected = options.find(([optionValue]) => optionValue === value);
  const detail = createElement("span", "settings-row-value", selected ? selected[1] : "");
  const segment = createElement("div", "settings-segment");

  for (const [optionValue, optionLabel] of options) {
    const button = createElement("button", optionValue === value ? "is-active" : "", optionLabel);

    button.type = "button";
    button.addEventListener("click", (event) => {
      event.stopPropagation();

      if (optionValue === value) {
        return;
      }

      onChange(optionValue);
      playUiSound("toggle");
      renderLibrary();
    });

    segment.append(button);
  }

  text.append(title, detail);
  row.append(text, segment);

  return row;
}

function createSettingsActionRow(label, description, actionsConfig) {
  const row = createElement("div", "settings-row");
  const text = createElement("div", "settings-row-text");
  const title = createElement("span", "settings-row-title", label);
  const detail = createElement("span", "settings-row-value", description);
  const actions = createElement("div", "settings-segment");

  for (const [buttonLabel, handler] of actionsConfig) {
    const button = createElement("button", "", buttonLabel);

    button.type = "button";
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      await handler();
    });
    actions.append(button);
  }

  text.append(title, detail);
  row.append(text, actions);

  return row;
}

function getSortSettingsOptions() {
  if (activeLibrary === "catalog") {
    return [
      ["name", "Nome"],
      ["provider", "Categoria"]
    ];
  }

  return [
    ["name", "Nome"],
    ["favorite", "Favoritos"],
    ["recent", "Recentes"],
    ["provider", activeLibrary === "apps" ? "Tipo" : "Plataforma"],
    ["size", "Tamanho"]
  ];
}

async function rescanCurrentLibrary() {
  const scanConfig = getCurrentRescanConfig();

  if (!scanConfig || isRescanning) {
    return;
  }

  isRescanning = true;
  settingsOpen = false;
  detailsState = null;
  activeMenuIndex = null;
  playUiSound("toggle");
  renderLibrary();

  try {
    if (scanConfig.mode === "automatic") {
      const result = await window.mobdeck.scanAutomatic();
      const roots = Array.isArray(result?.roots) ? result.roots : [];

      applyScanResult(
        Array.isArray(result?.games) ? result.games : [],
        roots.length ? roots.join(", ") : "Todos os discos",
        {
          mode: "automatic",
          roots
        },
        Array.isArray(result?.apps) ? result.apps : []
      );
    } else {
      const folder = scanConfig.folders[0];
      const [games, apps] = await Promise.all([
        window.mobdeck.scanFolder(folder),
        window.mobdeck.scanApps()
      ]);

      applyScanResult(games, folder, {
        mode: "manual",
        folders: [folder]
      }, apps);
    }
  } catch (error) {
    console.error(error);
    alert("Nao foi possivel reescanear a biblioteca.");
  } finally {
    isRescanning = false;
    renderLibrary();
  }
}

async function openDetails(game = getSelectedGame()) {
  if (!game) {
    return;
  }

  const requestId = detailsRequestId + 1;

  detailsRequestId = requestId;
  detailsState = {
    game,
    details: null,
    error: null,
    loading: true
  };

  renderLibrary();

  try {
    const details = await window.mobdeck.getGameDetails(game);

    if (requestId !== detailsRequestId) {
      return;
    }

    detailsState = {
      game,
      details,
      error: null,
      loading: false
    };
  } catch (error) {
    console.error(error);

    if (requestId !== detailsRequestId) {
      return;
    }

    detailsState = {
      game,
      details: null,
      error: error.message || "Nao foi possivel carregar os detalhes.",
      loading: false
    };
  }

  renderLibrary();
}

function closeDetails() {
  detailsRequestId += 1;
  detailsState = null;
  renderLibrary();
}

function getProfileForItem(item) {
  const itemKey = getGameKey(item);
  const stored = itemKey ? launchProfiles.get(itemKey) : null;

  return stored || createDefaultProfile(item);
}

function createDefaultProfile(item) {
  return {
    itemKey: getGameKey(item),
    enabled: false,
    launchMode: "auto",
    minimizeOnLaunch,
    preActions: [],
    postActions: [],
    collections: []
  };
}

function openProfileEditor(game = getSelectedGame()) {
  if (!game) {
    return;
  }

  profileEditorState = {
    game,
    profile: getProfileForItem(game)
  };
  detailsState = null;
  settingsOpen = false;
  playUiSound("open");
  renderLibrary();
}

function closeProfileEditor() {
  profileEditorState = null;
  renderLibrary();
}

function createProfileModal() {
  const game = profileEditorState.game;
  const profile = profileEditorState.profile;
  const overlay = createElement("div", "details-overlay profile-overlay");
  const modal = createElement("section", "details-modal profile-modal");
  const close = createElement("button", "details-close", "\u00d7");
  const title = createElement("h2", "", `Perfil: ${game.name}`);
  const body = createElement("div", "settings-body profile-body");
  const actions = createElement("div", "details-actions settings-actions");
  const save = createElement("button", "primary-action", "Salvar perfil");
  const cancel = createElement("button", "card-action secondary", "Cancelar");
  const enabled = createProfileCheckbox("profileEnabled", "Ativar Preparar/Jogar", profile.enabled);
  const minimize = createProfileCheckbox("profileMinimize", "Recolher ao abrir", profile.minimizeOnLaunch !== false);
  const launchMode = createProfileSelect("profileLaunchMode", "Modo de abertura", [
    ["auto", "Automatico"],
    ["launcher", "Launcher"],
    ["direct", "Executavel direto"]
  ], profile.launchMode || "auto");
  const collections = createProfileInput("profileCollections", "Colecoes", (profile.collections || []).join(", "), "TV, Co-op, Favoritos");
  const openApp = createProfileSelect("profileOpenApp", "Abrir app antes", getProfileAppOptions(profile), getProfileOpenAppValue(profile));
  const closeProcesses = createProfileInput("profileCloseProcesses", "Fechar processos", getProfileCloseProcesses(profile), "wallpaper32.exe, chrome.exe");
  const powerPlan = createProfileSelect("profilePowerPlan", "Plano de energia", [
    ["", "Nao alterar"],
    ["high", "Alto desempenho"],
    ["balanced", "Equilibrado"],
    ["saver", "Economia"]
  ], getProfilePowerPlan(profile));
  const delaySeconds = createProfileInput("profileDelay", "Aguardar antes de abrir", String(getProfileDelaySeconds(profile)), "0");
  const restorePower = createProfileCheckbox("profileRestorePower", "Restaurar plano depois", hasProfileAction(profile.postActions, "restorePowerPlan"));

  close.type = "button";
  close.title = "Fechar";
  close.setAttribute("aria-label", "Fechar perfil");
  close.addEventListener("click", closeProfileEditor);
  overlay.addEventListener("click", closeProfileEditor);
  modal.addEventListener("click", (event) => event.stopPropagation());

  body.append(
    enabled.row,
    launchMode.row,
    minimize.row,
    collections.row,
    openApp.row,
    closeProcesses.row,
    powerPlan.row,
    delaySeconds.row,
    restorePower.row
  );

  save.type = "button";
  save.addEventListener("click", async (event) => {
    event.stopPropagation();
    await saveProfileFromModal(game, {
      enabled: enabled.input,
      launchMode: launchMode.input,
      minimize: minimize.input,
      collections: collections.input,
      openApp: openApp.input,
      closeProcesses: closeProcesses.input,
      powerPlan: powerPlan.input,
      delaySeconds: delaySeconds.input,
      restorePower: restorePower.input
    }, save);
  });

  cancel.type = "button";
  cancel.addEventListener("click", (event) => {
    event.stopPropagation();
    closeProfileEditor();
  });

  actions.append(save, cancel);
  modal.append(close, title, body, actions);
  overlay.append(modal);

  return overlay;
}

function createProfileCheckbox(id, label, checked) {
  const row = createElement("label", "settings-row profile-control-row");
  const text = createElement("div", "settings-row-text");
  const title = createElement("span", "settings-row-title", label);
  const detail = createElement("span", "settings-row-value", checked ? "Ligado" : "Desligado");
  const input = document.createElement("input");

  input.id = id;
  input.type = "checkbox";
  input.checked = !!checked;
  input.addEventListener("change", () => {
    detail.textContent = input.checked ? "Ligado" : "Desligado";
  });

  text.append(title, detail);
  row.append(text, input);

  return { row, input };
}

function createProfileInput(id, label, value, placeholder = "") {
  const row = createElement("label", "settings-row profile-control-row");
  const text = createElement("div", "settings-row-text");
  const title = createElement("span", "settings-row-title", label);
  const detail = createElement("span", "settings-row-value", placeholder);
  const input = document.createElement("input");

  input.id = id;
  input.value = value || "";
  input.placeholder = placeholder;
  input.autocomplete = "off";

  text.append(title, detail);
  row.append(text, input);

  return { row, input };
}

function createProfileSelect(id, label, options, value) {
  const row = createElement("label", "settings-row profile-control-row");
  const text = createElement("div", "settings-row-text");
  const title = createElement("span", "settings-row-title", label);
  const detail = createElement("span", "settings-row-value", "");
  const input = document.createElement("select");

  input.id = id;

  for (const [optionValue, optionLabel] of options) {
    const option = document.createElement("option");

    option.value = optionValue;
    option.textContent = optionLabel;
    option.selected = optionValue === value;
    input.append(option);
  }

  const updateDetail = () => {
    detail.textContent = input.selectedOptions[0]?.textContent || "";
  };

  input.addEventListener("change", updateDetail);
  updateDetail();
  text.append(title, detail);
  row.append(text, input);

  return { row, input };
}

function getProfileAppOptions(profile) {
  const options = [["", "Nenhum"]];

  for (const app of currentApps) {
    options.push([getGameKey(app), app.name]);
  }

  const current = getProfileOpenAppValue(profile);

  if (current && !options.some(([value]) => value === current)) {
    options.push([current, "App salvo"]);
  }

  return options;
}

function getProfileOpenAppValue(profile) {
  const action = (profile.preActions || []).find((item) => item.type === "openApp");

  return action?.target ? getGameKey(action.target) : "";
}

function getProfileCloseProcesses(profile) {
  return (profile.preActions || [])
    .filter((action) => action.type === "closeProcess")
    .map((action) => action.processName)
    .join(", ");
}

function getProfilePowerPlan(profile) {
  const action = (profile.preActions || []).find((item) => item.type === "powerPlan");
  const plan = action?.plan || "";

  if (plan === "SCHEME_MIN") return "high";
  if (plan === "SCHEME_BALANCED") return "balanced";
  if (plan === "SCHEME_MAX") return "saver";

  return plan;
}

function getProfileDelaySeconds(profile) {
  const action = (profile.preActions || []).find((item) => item.type === "delay");

  return action ? Math.round(Number(action.ms || 0) / 1000) : 0;
}

function hasProfileAction(actions, type) {
  return (actions || []).some((action) => action.type === type);
}

async function saveProfileFromModal(game, controls, button) {
  const appToOpen = currentApps.find((app) => getGameKey(app) === controls.openApp.value);
  const preActions = [];
  const postActions = [];
  const delayMs = Math.max(0, Number(controls.delaySeconds.value || 0)) * 1000;
  const processNames = controls.closeProcesses.value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (appToOpen) {
    preActions.push({ type: "openApp", target: appToOpen });
  }

  for (const processName of processNames) {
    preActions.push({ type: "closeProcess", processName });
  }

  if (controls.powerPlan.value) {
    preActions.push({ type: "powerPlan", plan: controls.powerPlan.value });
  }

  if (delayMs) {
    preActions.push({ type: "delay", ms: delayMs });
  }

  if (controls.restorePower.checked) {
    postActions.push({ type: "restorePowerPlan" });
  }

  const profile = {
    itemKey: getGameKey(game),
    enabled: controls.enabled.checked,
    launchMode: controls.launchMode.value,
    minimizeOnLaunch: controls.minimize.checked,
    collections: controls.collections.value.split(",").map((item) => item.trim()).filter(Boolean),
    preActions,
    postActions
  };
  const previousLabel = button.textContent;

  button.disabled = true;
  button.textContent = "Salvando...";

  try {
    const result = await window.mobdeck.saveLaunchProfile(profile);
    launchProfiles = new Map((result?.profiles || []).map((item) => [item.itemKey, item]));
    playUiSound("enable");
    closeProfileEditor();
  } catch (error) {
    console.error(error);
    alert("Nao foi possivel salvar o perfil.");
  } finally {
    button.disabled = false;
    button.textContent = previousLabel;
  }
}

async function showMobileQr() {
  const existing = document.querySelector(".mobile-pairing-overlay");

  if (existing) {
    existing.remove();
  }

  if (statusText) {
    statusText.textContent = "Gerando QR de pareamento...";
  }

  try {
    const [pairing, status] = await Promise.all([
      window.mobdeck.getPairingQr(),
      window.mobdeck.getCompanionStatus()
    ]);

    document.body.append(createMobilePairingModal(pairing, status));

    if (statusText) {
      statusText.textContent = "QR Mobile pronto.";
    }
  } catch (error) {
    console.error(error);

    if (statusText) {
      statusText.textContent = `Erro ao gerar QR: ${error.message || error}`;
    }

    alert("Nao foi possivel gerar o QR Mobile / Wake-on-LAN.");
  }
}

function createMobilePairingModal(pairing, status) {
  const profile = pairing?.wakeProfile || status?.wakeProfile || {};
  const startup = status?.startup || {};
  const overlay = createElement("div", "details-overlay mobile-pairing-overlay");
  const modal = createElement("section", "details-modal mobile-pairing-modal");
  const close = createElement("button", "details-close", "\u00d7");
  const title = createElement("h2", "", "Mobile / Wake-on-LAN");
  const body = createElement("div", "details-body mobile-pairing-body");
  const qr = createElement("div", "pairing-qr");
  const list = createElement("dl", "details-list mobile-diagnostics");
  const actions = createElement("div", "details-actions");
  const startupButton = createElement("button", "card-action secondary", "");
  const copyIp = createElement("button", "card-action secondary", "Copiar IP");
  const copyMac = createElement("button", "card-action secondary", "Copiar MAC");

  close.type = "button";
  close.title = "Fechar";
  close.setAttribute("aria-label", "Fechar Mobile / Wake-on-LAN");
  close.addEventListener("click", () => overlay.remove());

  overlay.addEventListener("click", () => overlay.remove());
  modal.addEventListener("click", (event) => event.stopPropagation());

  if (pairing?.svg) {
    qr.innerHTML = pairing.svg;
  } else {
    qr.textContent = "QR indisponivel.";
  }

  appendDiagnosticsRow(list, "Status", status?.running ? "Servidor mobile online" : "Servidor mobile offline");
  appendDiagnosticsRow(list, "PC", profile.computerName || "Nao detectado");
  appendDiagnosticsRow(list, "IP", profile.ipAddress || "Nao detectado");
  appendDiagnosticsRow(list, "MAC", profile.macAddress || "Nao detectado");
  appendDiagnosticsRow(list, "Broadcast", profile.broadcastAddress || "255.255.255.255");
  appendDiagnosticsRow(list, "Porta", profile.port || status?.port || "Nao detectada");
  appendDiagnosticsRow(list, "URL", profile.primaryUrl || status?.primaryUrl || "Nao detectada");
  appendDiagnosticsRow(list, "Biblioteca", `${status?.gameCount || currentGames.length} jogo(s), ${status?.appCount || currentApps.length} app(s)`);

  updateStartupButton(startupButton, startup);
  startupButton.type = "button";
  startupButton.addEventListener("click", async () => {
    const enabled = !startupButton.classList.contains("is-on");

    startupButton.disabled = true;

    try {
      const nextStartup = await window.mobdeck.setStartWithWindows(enabled);
      updateStartupButton(startupButton, nextStartup);
    } catch (error) {
      console.error(error);
      alert("Nao foi possivel alterar a inicializacao com o Windows.");
    } finally {
      startupButton.disabled = false;
    }
  });

  copyIp.type = "button";
  copyIp.disabled = !profile.ipAddress;
  copyIp.addEventListener("click", () => copyText(profile.ipAddress, "IP copiado."));

  copyMac.type = "button";
  copyMac.disabled = !profile.macAddress;
  copyMac.addEventListener("click", () => copyText(profile.macAddress, "MAC copiado."));

  actions.append(startupButton, copyIp, copyMac);
  body.append(qr, list, createElement("p", "details-description", "Leia este QR no app mobile para salvar IP, MAC, porta local e dados de Wake-on-LAN sem digitar nada."), actions);
  modal.append(close, title, body);
  overlay.append(modal);

  return overlay;
}

function appendDiagnosticsRow(list, label, value) {
  list.append(createElement("dt", "", label), createElement("dd", "", formatValue(value)));
}

function updateStartupButton(button, startup) {
  const enabled = !!startup?.openAtLogin;

  button.textContent = enabled ? "Iniciar com Windows: Sim" : "Iniciar com Windows: Nao";
  button.classList.toggle("is-on", enabled);
  button.disabled = startup?.supported === false;
}

async function copyText(value, successMessage) {
  const text = String(value || "");

  if (!text) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    window.prompt("Copie o valor abaixo:", text);
  }

  if (statusText) {
    statusText.textContent = successMessage;
  }
}

function createDetailsModal() {
  const overlay = createElement("div", "details-overlay");
  const modal = createElement("section", "details-modal");
  const close = createElement("button", "details-close", "\u00d7");
  const game = detailsState.game;
  const details = detailsState.details || {};
  const title = createElement("h2", "", details.fullName || details.name || game.name);

  close.type = "button";
  close.title = "Fechar";
  close.setAttribute("aria-label", "Fechar detalhes");
  close.addEventListener("click", closeDetails);

  modal.addEventListener("click", (event) => event.stopPropagation());
  overlay.addEventListener("click", closeDetails);
  modal.append(close, title);

  if (detailsState.loading) {
    modal.append(createElement("p", "details-loading", "Buscando informacoes..."));
    overlay.append(modal);
    return overlay;
  }

  if (detailsState.error) {
    modal.append(createElement("p", "details-loading", detailsState.error));
    modal.append(createDetailsActions(game));
    overlay.append(modal);
    return overlay;
  }

  const body = createElement("div", "details-body");
  const list = createElement("dl", "details-list");
  const merged = { ...game, ...details };
  const rows = [
    ["Nome completo", merged.fullName || merged.name],
    ["Empresa", merged.developer],
    ["Publicadora", merged.publisher],
    [activeLibrary === "apps" ? "Tipo" : "Plataforma", formatProvider(merged.provider)],
    ["Horas jogadas", formatPlaytime(merged.playtimeMinutes)],
    ["Tamanho", formatBytes(merged.sizeBytes)],
    ["Ultima abertura", formatDateTime(merged.lastPlayedAt)],
    ["Aberturas no MOB Deck", merged.launchCount],
    ["Genero", formatList(merged.genres)],
    ["Lancamento", merged.releaseDate],
    ["Local", merged.folder],
    ["Launcher", merged.launchUri],
    [activeLibrary === "apps" ? "Atalho" : "Executavel", merged.exe]
  ];

  if (merged.steamAppId) {
    rows.splice(5, 0, ["Steam App ID", merged.steamAppId]);
  }

  rows.forEach(([label, value]) => {
    list.append(createElement("dt", "", label), createElement("dd", "", formatValue(value)));
  });

  body.append(list);

  if (merged.description) {
    body.append(createElement("p", "details-description", merged.description));
  }

  body.append(createDetailsActions(game));
  modal.append(body);
  overlay.append(modal);

  return overlay;
}

function createDetailsActions(game) {
  const actions = createElement("div", "details-actions");
  const play = createElement("button", "primary-action", getPrimaryActionLabel(game));
  const profile = createElement("button", "card-action secondary", "Perfil");
  const cover = createElement("button", "card-action secondary", "Capa");
  const hide = createElement("button", "card-action secondary", isHidden(game) ? "Restaurar" : "Ocultar");
  const close = createElement("button", "card-action secondary", "Fechar");

  play.type = "button";
  profile.type = "button";
  cover.type = "button";
  hide.type = "button";
  close.type = "button";
  play.addEventListener("click", async (event) => {
    event.stopPropagation();
    await launchGame(game, play);
  });
  profile.addEventListener("click", (event) => {
    event.stopPropagation();
    openProfileEditor(game);
  });
  cover.addEventListener("click", async (event) => {
    event.stopPropagation();
    await selectCoverForGame(game);
  });
  hide.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleHidden(game);
    closeDetails();
  });
  close.addEventListener("click", (event) => {
    event.stopPropagation();
    closeDetails();
  });

  actions.append(play, profile, cover, hide, close);

  return actions;
}

async function selectCoverForGame(game) {
  if (!game || !window.mobdeck?.selectCoverImage) {
    return;
  }

  const coverPath = await window.mobdeck.selectCoverImage();

  if (!coverPath) {
    return;
  }

  game.cover = coverPath;
  game.coverSources = [
    coverPath,
    ...(Array.isArray(game.coverSources) ? game.coverSources.filter((source) => source !== coverPath) : [])
  ];
  playUiSound("favorite");
  saveLibrarySnapshot({ mode: "manual-cover" });
  closeDetails();
}

async function launchGame(game, button) {
  if (!game?.exe && !game?.launchUri && !game?.fallbackLaunchUri && !game?.steamAppId && !game?.sourceId && !game?.gogAppId && !game?.appId) {
    alert(`Nao encontrei o ${activeLibrary === "apps" ? "atalho desse app" : "executavel desse jogo"}.`);
    return;
  }

  playUiSound("launch");

  const previousLabel = button?.textContent;

  if (button) {
    button.disabled = true;
    button.textContent = "Abrindo...";
  }

  try {
    const profile = getProfileForItem(game);
    const launchPayload = {
      ...game,
      minimizeOnLaunch
    };

    if (profile.enabled && window.mobdeck?.launchWithProfile) {
      const closeActions = profile.preActions.filter((action) => action.type === "closeProcess");

      if (closeActions.length) {
        const names = closeActions.map((action) => action.processName).join(", ");
        const confirmed = window.confirm(`O perfil de ${game.name} vai tentar fechar: ${names}. Continuar?`);

        if (!confirmed) {
          return;
        }
      }

      await window.mobdeck.launchWithProfile(launchPayload, profile);
    } else {
      await window.mobdeck.launchGame(launchPayload);
    }

    markGameLaunched(game);
  } catch (error) {
    console.error(error);
    alert(`Nao foi possivel abrir ${activeLibrary === "apps" ? "o app" : "o jogo"}.`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousLabel;
    }
  }
}

function markGameLaunched(game) {
  if (!game) {
    return;
  }

  game.lastPlayedAt = new Date().toISOString();
  game.launchCount = Number(game.launchCount || 0) + 1;
  saveLibrarySnapshot({ mode: "launch" });
}

function handleCarouselWheel(event) {
  if (getActiveItems().length <= 1) {
    return;
  }

  event.preventDefault();

  const now = Date.now();

  if (now - lastWheelAt < 150) {
    return;
  }

  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;

  if (delta > 0) {
    selectNextGame();
  } else if (delta < 0) {
    selectPreviousGame();
  }

  lastWheelAt = now;
}

function selectPreviousGame() {
  moveSelection("left");
}

function selectNextGame() {
  moveSelection("right");
}

function moveSelection(direction) {
  const delta = getNavigationDelta(direction);

  if (!delta) {
    return;
  }

  moveSelectionBy(delta);
}

function moveSelectionBy(delta) {
  const items = getNavigationItemsWithIndex();

  if (!items.length) {
    return;
  }

  let currentPosition = items.findIndex((item) => item.index === selectedIndex);

  if (currentPosition === -1) {
    currentPosition = 0;
  }

  const nextPosition = (currentPosition + delta + items.length * Math.ceil(Math.abs(delta) / items.length + 1)) % items.length;
  selectedIndex = items[nextPosition].index;
  activeMenuIndex = null;
  renderLibrary();
}

function getNavigationDelta(direction) {
  if (direction === "left") {
    return -1;
  }

  if (direction === "right") {
    return 1;
  }

  if (direction === "up") {
    return isGridNavigationActive() ? -getGridColumnCount() : -1;
  }

  if (direction === "down") {
    return isGridNavigationActive() ? getGridColumnCount() : 1;
  }

  return 0;
}

function isGridNavigationActive() {
  return activeLibrary === "apps" || activeLibrary === "catalog" || viewMode === "grid";
}

function getNavigationItemsWithIndex() {
  if (isGridNavigationActive()) {
    return getFilteredItemsWithIndex();
  }

  return getActiveItems().map((game, index) => ({ game, index }));
}

function getGridColumnCount() {
  const grid = document.querySelector(".games-grid-library, .app-tile-grid, .catalog-grid-library");

  if (!grid) {
    return 1;
  }

  const columns = window.getComputedStyle(grid).gridTemplateColumns
    .split(" ")
    .filter((value) => value && value !== "none");

  return Math.max(1, columns.length);
}

function getSelectedGame() {
  const activeItems = getActiveItems();

  if (!activeItems.length) {
    return null;
  }

  return activeItems[wrapIndex(selectedIndex)];
}

function getPositionClass(index) {
  const activeItems = getActiveItems();

  if (!activeItems.length) {
    return "";
  }

  if (index === selectedIndex) {
    return "is-active";
  }

  const total = activeItems.length;
  const diff = (index - selectedIndex + total) % total;

  if (diff === 1) {
    return "is-right";
  }

  if (diff === total - 1) {
    return "is-left";
  }

  if (total > 3 && diff === 2) {
    return "is-right-far";
  }

  if (total > 3 && diff === total - 2) {
    return "is-left-far";
  }

  return "";
}

function getFilteredItemsWithIndex() {
  const query = normalizeSearch(searchQuery);

  return getActiveItems()
    .map((game, index) => ({ game, index }))
    .filter(({ game }) => !query || normalizeSearch(game.name).includes(query))
    .filter(({ game }) => matchesSmartFilter(game));
}

function matchesSmartFilter(item) {
  if (smartFilter === "all") {
    return true;
  }

  if (smartFilter === "favorites") {
    return isFavorite(item);
  }

  if (smartFilter === "hidden") {
    return isHidden(item);
  }

  if (smartFilter === "no-cover") {
    return !getCoverSources(item).length;
  }

  if (smartFilter === "recent") {
    return Date.now() - getTimeValue(item.lastPlayedAt) <= 1000 * 60 * 60 * 24 * 14;
  }

  if (smartFilter === "large") {
    return Number(item.sizeBytes || 0) >= 25 * 1024 * 1024 * 1024;
  }

  if (smartFilter === "never") {
    return !item.lastPlayedAt && !Number(item.launchCount || 0);
  }

  if (smartFilter === "collections") {
    return getProfileForItem(item).collections.length > 0;
  }

  return true;
}

function wrapIndex(index) {
  const total = getActiveItems().length;

  if (!total) {
    return 0;
  }

  return (index + total) % total;
}

function getActiveItems() {
  const sourceItems = getActiveSourceItems();
  const items = activeLibrary === "catalog"
    ? sourceItems
    : showHidden
      ? sourceItems.filter((item) => isHidden(item))
      : smartFilter === "hidden"
      ? sourceItems
      : sourceItems.filter((item) => !isHidden(item));

  return sortItems(items);
}

function getActiveSourceItems() {
  if (activeLibrary === "catalog") {
    return getCatalogLibraryItems();
  }

  return activeLibrary === "apps" ? currentApps : currentGames;
}

function getCatalogLibraryItems() {
  return appCatalogItems.map((item) => {
    const installed = getInstalledCatalogApp(item);
    const installState = installStates.get(item.id);

    return {
      ...item,
      provider: "catalog",
      isCatalogItem: true,
      installed: !!installed,
      installedApp: installed || null,
      appCategoryName: item.categoryName,
      lastPlayedAt: installed?.lastPlayedAt || null,
      launchCount: installed?.launchCount || 0,
      icon: installed?.icon || null,
      coverSources: installed?.coverSources || []
    };
  });
}

function getInstalledCatalogApp(catalogItem) {
  if (!catalogItem?.id) {
    return null;
  }

  return currentApps.find((app) => app.appCatalogId === catalogItem.id) || null;
}

function sortItems(items) {
  const sorted = [...(items || [])];

  sorted.sort((a, b) => {
    if (activeLibrary === "catalog" && sortMode === "provider") {
      const categoryDiff = String(a.categoryName || "").localeCompare(String(b.categoryName || ""), "pt-BR");

      if (categoryDiff !== 0) return categoryDiff;
    }

    if (sortMode === "favorite") {
      const favoriteDiff = Number(isFavorite(b)) - Number(isFavorite(a));

      if (favoriteDiff !== 0) return favoriteDiff;
    }

    if (sortMode === "provider") {
      const providerDiff = getProviderSortLabel(a).localeCompare(getProviderSortLabel(b), "pt-BR");

      if (providerDiff !== 0) return providerDiff;
    }

    if (sortMode === "recent") {
      const recentDiff = getTimeValue(b.lastPlayedAt) - getTimeValue(a.lastPlayedAt);

      if (recentDiff !== 0) return recentDiff;
    }

    if (sortMode === "size") {
      const sizeDiff = Number(b.sizeBytes || 0) - Number(a.sizeBytes || 0);

      if (sizeDiff !== 0) return sizeDiff;
    }

    return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
  });

  return sorted;
}

function getTimeValue(value) {
  const time = new Date(value || 0).getTime();

  return Number.isNaN(time) ? 0 : time;
}

function getActiveLibraryLabel() {
  return getLibraryInfo(activeLibrary).ariaLabel;
}

function getActiveItemSingular() {
  return activeLibrary === "games" ? "jogo" : "app";
}

function getPrimaryActionLabel(game) {
  if (game?.isCatalogItem) {
    return getCatalogActionLabel(game, getInstalledCatalogApp(game), installStates.get(game.id));
  }

  if (getProfileForItem(game).enabled) {
    return game?.provider === "app" || activeLibrary === "apps" ? "Preparar/Abrir" : "Preparar/Jogar";
  }

  return game?.provider === "app" || activeLibrary === "apps" ? "Abrir" : "Jogar";
}

function filterAppsForLibrary(apps, games) {
  const gameNames = new Set((games || []).map((game) => normalizeSearch(game.name)).filter(Boolean));
  const filtered = [];
  const seen = new Set();

  for (const app of apps) {
    if (!app.appCatalogId || app.category === "game") {
      continue;
    }

    const normalizedName = normalizeSearch(app.name);

    if (!normalizedName) {
      continue;
    }

    if (gameNames.has(normalizedName)) {
      continue;
    }

    const key = app.appCatalogId || normalizedName;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    filtered.push(app);
  }

  return filtered;
}

function filterGamesForLibrary(games) {
  return (games || []).filter((game) => !isNonGameLibraryItem(game));
}

function isNonGameLibraryItem(game) {
  if (getAppLikeGameRule(game)) {
    return true;
  }

  const steamAppId = String(game?.steamAppId || game?.sourceId || "").trim();

  if (steamAppId && nonGameSteamAppIds.has(steamAppId)) {
    return true;
  }

  const text = normalizeSearch([
    game?.name,
    game?.exe,
    game?.folder,
    game?.launchUri
  ].filter(Boolean).join(" "));

  return nonGameGameWords.some((word) => text.includes(normalizeSearch(word)));
}

function createAppFromGameIfNeeded(game) {
  const rule = getAppLikeGameRule(game);

  if (!rule) {
    return null;
  }

  return {
    ...game,
    name: rule.name,
    provider: "app",
    category: "app",
    appCatalogId: rule.appCatalogId,
    appCategoryId: rule.appCategoryId,
    appCategoryName: rule.appCategoryName,
    categoryName: rule.appCategoryName,
    summary: rule.summary,
    website: rule.website,
    appId: game.launchUri || game.appId || null,
    source: "game-library-app"
  };
}

function getAppLikeGameRule(game) {
  const ids = [
    game?.steamAppId,
    game?.sourceId
  ].map((value) => String(value || "").trim()).filter(Boolean);
  const text = normalizeSearch([
    game?.name,
    game?.exe,
    game?.folder,
    game?.launchUri
  ].filter(Boolean).join(" "));

  return appLikeGameRules.find((rule) => {
    if (rule.steamAppId && ids.includes(rule.steamAppId)) {
      return true;
    }

    return rule.names.some((name) => text.includes(normalizeSearch(name)));
  }) || null;
}

function getLibraryInfo(library) {
  const info = {
    games: {
      icon: "\u25B6",
      eyebrow: "Minha",
      title: "Biblioteca",
      itemLabel: "jogo(s)",
      navLabel: "jogos",
      shortLabel: "Jogos",
      ariaLabel: "Biblioteca de jogos"
    },
    apps: {
      icon: "\u25A6",
      eyebrow: "Apps",
      title: "Instalados",
      itemLabel: "app(s)",
      navLabel: "apps instalados",
      shortLabel: "Apps",
      ariaLabel: "Apps instalados"
    },
    catalog: {
      icon: "+",
      eyebrow: "Instalador",
      title: "Catalogo",
      itemLabel: "app(s)",
      navLabel: "catalogo",
      shortLabel: "Catalogo",
      ariaLabel: "Catalogo de apps"
    }
  };

  return info[library] || info.games;
}

function getEmptyStateTitle() {
  if (showHidden && activeLibrary !== "catalog") {
    return "Nenhum item oculto";
  }

  if (activeLibrary === "apps") {
    return "Nenhum app util encontrado";
  }

  if (activeLibrary === "catalog") {
    return "Catalogo vazio";
  }

  return "Nenhum jogo encontrado";
}

function getProviderSortLabel(item) {
  return item?.appCategoryName || item?.categoryName || formatProvider(item?.provider);
}

function toggleFavorite(game) {
  const key = getGameKey(game);

  if (!key) {
    return;
  }

  if (favoriteKeys.has(key)) {
    favoriteKeys.delete(key);
  } else {
    favoriteKeys.add(key);
  }

  saveJson(storageKeys.favorites, [...favoriteKeys]);
  renderLibrary();
}

function isFavorite(game) {
  const key = getGameKey(game);

  return !!key && favoriteKeys.has(key);
}

function toggleHidden(game) {
  const key = getGameKey(game);

  if (!key) {
    return;
  }

  if (hiddenKeys.has(key)) {
    hiddenKeys.delete(key);
    playUiSound("enable");
  } else {
    hiddenKeys.add(key);
    playUiSound("disable");
  }

  saveJson(storageKeys.hidden, [...hiddenKeys]);
  selectedIndex = wrapIndex(selectedIndex);
  activeMenuIndex = null;
  renderLibrary();
}

function isHidden(game) {
  const key = getGameKey(game);

  return !!key && hiddenKeys.has(key);
}

function getGameKey(game) {
  if (!game) {
    return "";
  }

  const rawKey =
    (game.steamAppId && `steam:${game.steamAppId}`)
    || (game.gogAppId && `gog:${game.gogAppId}`)
    || (game.sourceId && `${game.provider || "source"}:${game.sourceId}`)
    || game.exe
    || game.folder
    || game.name;

  return String(rawKey || "").toLowerCase();
}

function getCompanionGameId(game) {
  const raw = [
    game?.steamAppId && `steam:${game.steamAppId}`,
    game?.gogAppId && `gog:${game.gogAppId}`,
    game?.sourceId && `${game.provider || "source"}:${game.sourceId}`,
    game?.launchUri,
    game?.exe,
    game?.folder,
    game?.name
  ].filter(Boolean).join("|");

  return hashStringBase36(raw || String(game?.name || "game"));
}

function hashStringBase36(value) {
  let hash = 0;
  const text = String(value || "");

  for (let index = 0; index < text.length; index++) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
}

function formatProvider(provider) {
  const providers = {
    steam: "Steam",
    epic: "Epic Games",
    gog: "GOG",
    app: "App",
    launcher: "Launcher",
    detected: "Detectado",
    local: "Local",
    unknown: "Local"
  };

  return providers[String(provider || "unknown").toLowerCase()] || provider || "Local";
}

function formatPlaytime(minutes) {
  if (minutes === null || minutes === undefined || Number.isNaN(Number(minutes))) {
    return null;
  }

  const totalMinutes = Number(minutes);

  if (totalMinutes <= 0) {
    return "0h";
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);

  if (hours === 0) {
    return `${mins}min`;
  }

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}min`;
}

function formatBytes(bytes) {
  const value = Number(bytes);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDateTime(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatLibraryStats(items) {
  const list = Array.isArray(items) ? items : [];

  if (activeLibrary === "catalog") {
    const installedCount = list.filter((item) => item.installed).length;

    return installedCount
      ? `${installedCount} instalado(s) | ${list.length} no catalogo`
      : `${list.length} app(s) no catalogo`;
  }

  const favoriteCount = list.filter((item) => isFavorite(item)).length;
  const hiddenCount = list.filter((item) => isHidden(item)).length;
  const totalSize = list.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0);
  const parts = [];

  if (favoriteCount) {
    parts.push(`${favoriteCount} favorito(s)`);
  }

  if (hiddenCount) {
    parts.push(`${hiddenCount} oculto(s)`);
  }

  if (totalSize > 0) {
    parts.push(formatBytes(totalSize));
  }

  return parts.length ? parts.join(" | ") : "Pronto para jogar";
}

function formatList(value) {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.filter(Boolean).join(", ");
}

function formatValue(value) {
  if (Array.isArray(value)) {
    return formatList(value) || "Nao informado";
  }

  if (value === null || value === undefined || value === "") {
    return "Nao informado";
  }

  return String(value);
}

function normalizeImageSource(source) {
  if (!source) {
    return "";
  }

  const value = String(source);

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  if (/^(https?:|file:|data:)/i.test(value)) {
    return value;
  }

  const normalized = value.replace(/\\/g, "/");

  if (/^[a-z]:\//i.test(normalized)) {
    return `file:///${normalized}`;
  }

  return normalized;
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function playUiSound(kind = "click", force = false) {
  if (!soundEnabled && !force) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  try {
    audioContext = audioContext || new AudioContextClass();

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    const first = audioContext.createOscillator();
    const second = audioContext.createOscillator();
    const presets = {
      click: [155, 220, 0.055],
      focus: [420, 620, 0.045],
      select: [130, 205, 0.07],
      open: [120, 260, 0.11],
      toggle: [190, 135, 0.08],
      favorite: [165, 285, 0.13],
      unfavorite: [155, 105, 0.09],
      launch: [82, 210, 0.18],
      back: [170, 92, 0.09],
      enable: [140, 240, 0.13],
      disable: [135, 78, 0.09]
    };
    const [startFrequency, endFrequency, duration] = presets[kind] || presets.click;

    first.type = "sine";
    second.type = "sine";
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(720, now);
    first.frequency.setValueAtTime(startFrequency, now);
    first.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), now + duration);
    second.frequency.setValueAtTime(startFrequency * 0.5, now);
    second.frequency.exponentialRampToValueAtTime(Math.max(35, endFrequency * 0.5), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.024, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    first.connect(filter);
    second.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    first.start(now);
    second.start(now);
    first.stop(now + duration + 0.02);
    second.stop(now + duration + 0.02);
  } catch {
    // Audio feedback is optional.
  }
}

function hashString(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);

    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore localStorage failures.
  }
}

function loadChoice(key, allowed, fallback) {
  try {
    const value = localStorage.getItem(key);

    return allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function saveChoice(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore localStorage failures.
  }
}

function setWelcomeButtonsDisabled(disabled) {
  if (autoScanBtn) autoScanBtn.disabled = disabled;
  if (manualScanBtn) manualScanBtn.disabled = disabled;
  if (mobileQrBtn) mobileQrBtn.disabled = disabled;
}

function getCurrentRescanConfig() {
  const scanConfig = normalizeScanConfig(currentScanConfig, currentFolder);

  if (scanConfig) {
    currentScanConfig = scanConfig;
  }

  return scanConfig;
}

function normalizeScanConfig(scanConfig, folderLabel = "") {
  const mode = String(scanConfig?.mode || "");

  if (mode === "automatic") {
    return {
      mode: "automatic",
      roots: Array.isArray(scanConfig.roots) ? scanConfig.roots.filter(Boolean) : []
    };
  }

  if (mode === "manual") {
    const folders = Array.isArray(scanConfig.folders) ? scanConfig.folders.filter(Boolean) : [];

    if (folders.length) {
      return {
        mode: "manual",
        folders
      };
    }
  }

  return inferScanConfigFromFolderLabel(folderLabel);
}

function inferScanConfigFromFolderLabel(folderLabel) {
  const label = String(folderLabel || "").trim();

  if (!label) {
    return null;
  }

  if (label === "Todos os discos") {
    return {
      mode: "automatic",
      roots: []
    };
  }

  const roots = label.split(",").map((part) => part.trim()).filter(isDriveRoot);

  if (roots.length > 1) {
    return {
      mode: "automatic",
      roots
    };
  }

  if (/^[a-z]:\\/i.test(label)) {
    return {
      mode: "manual",
      folders: [label]
    };
  }

  return null;
}

function isDriveRoot(value) {
  return /^[a-z]:\\$/i.test(String(value || "").trim());
}

function saveLibrarySnapshot(action = null) {
  if (!currentGames.length && !currentApps.length && !action) {
    return;
  }

  const snapshot = createLibrarySnapshot(action);

  saveJson(storageKeys.library, snapshot);
  syncCompanionLibrary(snapshot);
}

function createLibrarySnapshot(action = null) {
  const actionName = typeof action === "string" ? action : action?.mode || null;

  return {
    schemaVersion: librarySchemaVersion,
    imageCacheVersion,
    games: currentGames,
    apps: currentApps,
    activeLibrary,
    folderLabel: currentFolder,
    scanConfig: getCurrentRescanConfig(),
    lastAction: actionName,
    savedAt: new Date().toISOString()
  };
}

function syncCompanionLibrary(snapshot = null) {
  if (!window.mobdeck?.syncCompanionLibrary) {
    return;
  }

  const payload = snapshot || createLibrarySnapshot("sync");

  window.mobdeck.syncCompanionLibrary(payload)
    .then((status) => {
      companionStatus = status || companionStatus;

      if (settingsOpen) {
        renderLibrary();
      }
    })
    .catch(() => {
      // Companion sync is optional for the desktop UI.
    });
}

function restoreSavedLibrary() {
  try {
    if (localStorage.getItem(storageKeys.skipAutoOpenOnce) === "1") {
      localStorage.removeItem(storageKeys.skipAutoOpenOnce);
      return false;
    }
  } catch {
    // Ignore localStorage failures.
  }

  const snapshot = loadJson(storageKeys.library, null);

  const savedGames = Array.isArray(snapshot?.games) ? snapshot.games : [];
  const savedApps = Array.isArray(snapshot?.apps) ? snapshot.apps : [];

  if (
    !snapshot
    || snapshot.schemaVersion !== librarySchemaVersion
    || snapshot.imageCacheVersion !== imageCacheVersion
    || (!savedGames.length && !savedApps.length)
  ) {
    return false;
  }

  currentGames = filterGamesForLibrary(savedGames);
  currentApps = filterAppsForLibrary([
    ...savedApps,
    ...savedGames.map(createAppFromGameIfNeeded).filter(Boolean)
  ], currentGames);
  currentScanConfig = normalizeScanConfig(snapshot.scanConfig, snapshot.folderLabel);
  activeLibrary = loadChoice(storageKeys.activeLibrary, libraryModes, snapshot.activeLibrary || "games");

  if (activeLibrary === "games" && !currentGames.length && currentApps.length) {
    activeLibrary = "apps";
  }

  currentFolder = snapshot.folderLabel || "";
  resetEmptyHiddenFilter();
  selectedIndex = 0;
  activeMenuIndex = null;
  detailsState = null;
  detailsRequestId += 1;
  searchQuery = "";
  renderLibrary();
  syncCompanionLibrary(snapshot);
  refreshInstalledApps()
    .then(() => {
      if (activeLibrary === "apps" || activeLibrary === "catalog") {
        renderLibrary();
      }
    })
    .catch(() => {
      // Restoring the saved library should not fail because app refresh failed.
    });

  return true;
}

function resetEmptyHiddenFilter() {
  if (!showHidden || activeLibrary === "catalog") {
    return;
  }

  const sourceItems = getActiveSourceItems();

  if (sourceItems.length && !sourceItems.some((item) => isHidden(item))) {
    showHidden = false;
    saveChoice(storageKeys.showHidden, "off");
  }
}

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (textContent !== undefined) {
    element.textContent = textContent;
  }

  return element;
}

restoreSavedLibrary();
setupGamepadNavigation();
