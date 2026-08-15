const assert = require("assert");
const fs = require("fs/promises");
const path = require("path");
const scanner = require("../src/scanner/scanner");

const createdRoots = [];

async function touch(filePath, content = "") {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

async function mkRoot() {
  const root = await fs.mkdtemp(path.join(path.parse(process.cwd()).root, "game-scan-fixture-"));
  createdRoots.push(root);
  return root;
}

function createServices(options = {}) {
  const counters = {
    steamAssets: 0,
    steamSearch: 0,
    gogSearch: 0
  };
  const gogInfoByFolder = options.gogInfoByFolder || new Map();

  return {
    counters,
    services: {
      steam: {
        readSteamLibraryGames: async () => options.steamGames || [],
        getSteamAppAssets: async (appId) => {
          counters.steamAssets += 1;
          return {
            appId: String(appId),
            cover: `https://steam.test/${appId}/cover.jpg`,
            fallbackCover: `https://steam.test/${appId}/fallback.jpg`
          };
        },
        findSteamAppByName: async (name) => {
          counters.steamSearch += 1;
          return typeof options.steamMatch === "function"
            ? options.steamMatch(name)
            : options.steamMatch || null;
        }
      },
      epic: {
        readInstalledGames: async () => options.epicGames || []
      },
      gog: {
        readGogGameInfo: async (folder) => gogInfoByFolder.get(path.resolve(folder)) || null,
        findGogGameByName: async (name) => {
          counters.gogSearch += 1;
          return typeof options.gogMatch === "function"
            ? options.gogMatch(name)
            : options.gogMatch || null;
        }
      }
    }
  };
}

async function scan(root, services, options = {}) {
  return scanner.scan(root, {
    services,
    log: false,
    ...options
  });
}

async function classify(folder, services) {
  return scanner._internals.classifyLocalCandidate(
    { folder, source: null, name: null, exe: null, confidence: 40 },
    { services }
  );
}

function names(games) {
  return games.map((game) => game.name).sort((a, b) => a.localeCompare(b));
}

async function run() {
  {
    const root = await mkRoot();
    const postmanFolder = path.join(root, "Postman");
    await touch(path.join(postmanFolder, "update.exe"));
    const { counters, services } = createServices({
      steamMatch: { appId: "123", name: "Postman", cover: "bad" },
      gogMatch: { appId: "gog-postman", name: "Postman", cover: "bad" }
    });

    const result = await classify(postmanFolder, services);

    assert.equal(result.status, "rejected");
    assert.equal(result.reason, "ignored-folder");
    assert.equal(counters.steamSearch, 0);
    assert.equal(counters.gogSearch, 0);
  }

  {
    const root = await mkRoot();
    const helperFolder = path.join(root, "node_modules", "electron");
    await touch(path.join(helperFolder, "helper.exe"));
    const { counters, services } = createServices({
      steamMatch: { appId: "999", name: "Electron Helper", cover: "bad" }
    });

    const result = await classify(helperFolder, services);

    assert.equal(result.status, "rejected");
    assert.equal(result.reason, "ignored-folder");
    assert.equal(counters.steamSearch, 0);
    assert.equal(counters.gogSearch, 0);
  }

  {
    const root = await mkRoot();
    await touch(path.join(root, "SuperHexagon", "superhexagon.exe"));
    const { counters, services } = createServices({
      steamMatch: { appId: "221640", name: "Super Hexagon", cover: "https://steam.test/superhexagon.jpg" }
    });

    const games = await scan(root, services);

    assert.deepEqual(names(games), ["SuperHexagon"]);
    assert.equal(games[0].provider, "local");
    assert.equal(games[0].finalScore >= 60, true);
    assert.equal(counters.steamSearch > 0, true);
  }

  {
    const root = await mkRoot();
    await touch(path.join(root, "IndieGem", "IndieGem.exe"));
    const { services } = createServices();

    const games = await scan(root, services);

    assert.deepEqual(names(games), ["IndieGem"]);
    assert.equal(games[0].reasons.includes("exe:90"), true);
  }

  {
    const root = await mkRoot();
    await touch(path.join(root, "UnityGame", "UnityGame.exe"));
    await touch(path.join(root, "UnityGame", "UnityPlayer.dll"));
    await touch(path.join(root, "UnrealGame", "DifferentBinary.exe"));
    await touch(path.join(root, "UnrealGame", "Content", "Paks", "game.pak"));
    await touch(path.join(root, "GodotGame", "DifferentBinary.exe"));
    await touch(path.join(root, "GodotGame", "DifferentBinary.pck"));
    const { services } = createServices();

    const games = await scan(root, services);

    assert.deepEqual(names(games), ["GodotGame", "UnityGame", "UnrealGame"]);
    for (const game of games) {
      assert.equal(game.reasons.some((reason) => reason.startsWith("engine:")), true);
    }
  }

  {
    const root = await mkRoot();
    const steamFolder = path.join(root, "SteamLibrary", "steamapps", "common", "Steam Official");
    const epicFolder = path.join(root, "EpicLibrary", "Epic Official");
    const gogFolder = path.join(root, "GOG Games", "GOG Official");
    await touch(path.join(steamFolder, "SteamOfficial.exe"));
    await touch(path.join(epicFolder, "EpicOfficial.exe"));
    await touch(path.join(gogFolder, "GOGOfficial.exe"));

    const gogInfoByFolder = new Map([
      [path.resolve(gogFolder), {
        appId: "gog-1",
        name: "GOG Official",
        exe: path.join(gogFolder, "GOGOfficial.exe"),
        launchUri: "goggalaxy://launchGame/gog-1"
      }]
    ]);
    const { counters, services } = createServices({
      steamGames: [{
        appId: "111",
        name: "Steam Official",
        folder: steamFolder,
        cover: "https://steam.test/111/cover.jpg",
        launchUri: "steam://rungameid/111"
      }],
      epicGames: [{
        appId: "epic-1",
        name: "Epic Official",
        folder: epicFolder,
        exe: path.join(epicFolder, "EpicOfficial.exe"),
        launchUri: "com.epicgames.launcher://apps/epic-1?action=launch",
        source: "epic"
      }],
      gogInfoByFolder
    });

    const games = await scan(root, services);
    const byName = new Map(games.map((game) => [game.name, game]));

    assert.equal(byName.get("Steam Official")?.provider, "steam");
    assert.equal(byName.get("Epic Official")?.provider, "epic");
    assert.equal(byName.get("GOG Official")?.provider, "gog");
    assert.equal(counters.steamSearch, 0);
    assert.equal(counters.gogSearch, 0);
    assert.equal(counters.steamAssets, 1);
  }

  {
    const root = await mkRoot();
    await touch(path.join(root, "UpdaterTool", "update.exe"));
    const { counters, services } = createServices({
      steamMatch: { appId: "555", name: "Updater Tool", cover: "bad" },
      gogMatch: { appId: "gog-555", name: "Updater Tool", cover: "bad" }
    });

    const games = await scan(root, services);

    assert.deepEqual(games, []);
    assert.equal(counters.steamSearch, 0);
    assert.equal(counters.gogSearch, 0);
  }
}

run()
  .then(async () => {
    await Promise.all(createdRoots.map((root) => fs.rm(root, { recursive: true, force: true })));
    console.log("scanner tests passed");
  })
  .catch(async (error) => {
    await Promise.all(createdRoots.map((root) => fs.rm(root, { recursive: true, force: true })));
    console.error(error);
    process.exitCode = 1;
  });
