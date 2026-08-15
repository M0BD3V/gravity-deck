export function createLauncherActions({ desktop, getState, wakePc, setMessage, refreshLibrary }) {
  return {
    log(message) {
      console.info("[MobLauncher]", message);
      setMessage(message);
    },

    async wakePc() {
      setMessage("Enviando Wake-on-LAN...");
      await wakePc();
      setMessage("Pacote Wake-on-LAN enviado.");
    },

    async openGame(nameOrId) {
      await ensureLibrary(refreshLibrary);
      const { games } = getState();
      const game = findByNameOrId(games, nameOrId);

      if (!game) {
        throw new Error(nameOrId ? `Jogo nao encontrado: ${nameOrId}` : "Informe o jogo no deep link.");
      }

      setMessage(`Abrindo ${game.name}...`);
      await desktop.launchGame(game.id);
      setMessage(`${game.name} enviado para abrir no PC.`);
    },

    async openApp(nameOrId) {
      await ensureLibrary(refreshLibrary);
      const { apps } = getState();
      const app = findByNameOrId(apps, nameOrId);

      if (!app) {
        throw new Error(nameOrId ? `App nao encontrado: ${nameOrId}` : "Informe o app no deep link.");
      }

      setMessage(`Abrindo ${app.name}...`);
      await desktop.launchApp(app.id);
      setMessage(`${app.name} enviado para abrir no PC.`);
    },

    async startStream() {
      setMessage("Solicitando streaming...");
      await desktop.startStream();
      setMessage("Steam Remote Play/Big Picture solicitado.");
    },

    async steamBigPicture() {
      setMessage("Abrindo Steam Big Picture...");
      await desktop.action("steam-big-picture");
      setMessage("Steam Big Picture solicitado.");
    },

    async refreshDesktopLibrary() {
      setMessage("Pedindo atualizacao da biblioteca...");
      await desktop.action("refresh-library");
      await refreshLibrary();
      setMessage("Biblioteca atualizada.");
    },

    async lockPc() {
      setMessage("Bloqueando PC...");
      await desktop.action("lock-pc");
      setMessage("PC bloqueado.");
    },

    async sleepPc() {
      setMessage("Solicitando suspensao...");
      await desktop.action("sleep-pc");
      setMessage("Suspensao solicitada.");
    },

    async restartPc() {
      setMessage("Solicitando reinicio seguro...");
      await desktop.action("restart-pc");
      setMessage("PC agendado para reiniciar em 30 segundos.");
    },

    async volume(action) {
      await desktop.action(action);
      setMessage("Comando de volume enviado.");
    },

    async shutdownPc() {
      setMessage("Solicitando desligamento seguro...");
      await desktop.shutdownPc();
      setMessage("PC agendado para desligar em 30 segundos.");
    },

    async gameMode(nameOrId) {
      const { wakeConfig } = getState();
      const target = nameOrId || wakeConfig.defaultGame;

      setMessage("Modo jogo: ligando PC...");
      await wakePc();
      await waitForDesktop(desktop, setMessage);
      await refreshLibrary();

      if (target) {
        await this.openGame(target);
      }

      try {
        await this.startStream();
      } catch (error) {
        setMessage(`Modo jogo abriu o PC/jogo. Streaming pendente: ${error.message}`);
      }
    }
  };
}

async function ensureLibrary(refreshLibrary) {
  await refreshLibrary();
}

async function waitForDesktop(desktop, setMessage) {
  const deadline = Date.now() + 90000;
  let attempt = 1;

  while (Date.now() < deadline) {
    try {
      await desktop.status();
      setMessage("PC conectado.");
      return;
    } catch {
      setMessage(`Aguardando PC responder... tentativa ${attempt}`);
      attempt += 1;
      await wait(5000);
    }
  }

  throw new Error("PC nao respondeu. Confirme energia, rede e Wake-on-LAN na BIOS/Windows.");
}

function findByNameOrId(items, value) {
  const query = normalize(value);

  if (!query) {
    return null;
  }

  return items.find((item) => normalize(item.id) === query)
    || items.find((item) => normalize(item.name) === query)
    || items.find((item) => normalize(item.name).includes(query));
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
