export function parseDeepLink(url) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "moblauncher:") {
      return null;
    }

    const action = parsed.hostname || parsed.pathname.replace(/^\/+/, "");
    const params = Object.fromEntries(parsed.searchParams.entries());

    return {
      action,
      params,
      raw: url
    };
  } catch {
    return null;
  }
}

export async function handleDeepLink(url, actions) {
  const deepLink = parseDeepLink(url);

  if (!deepLink) {
    return false;
  }

  console.info("[MobLauncher] Deep link", deepLink);

  if (deepLink.action === "wake-pc") {
    await actions.wakePc();
    return true;
  }

  if (deepLink.action === "pair") {
    await actions.pairFromQr(deepLink.params);
    return true;
  }

  if (deepLink.action === "open-game") {
    await actions.openGame(deepLink.params.id || deepLink.params.name || "");
    return true;
  }

  if (deepLink.action === "open-app") {
    await actions.openApp(deepLink.params.id || deepLink.params.name || "");
    return true;
  }

  if (deepLink.action === "start-stream") {
    await actions.startStream();
    return true;
  }

  if (deepLink.action === "shutdown-pc") {
    await actions.shutdownPc();
    return true;
  }

  if (deepLink.action === "game-mode") {
    await actions.gameMode(deepLink.params.id || deepLink.params.name || "");
    return true;
  }

  actions.log(`Deep link sem acao: ${deepLink.raw}`);
  return false;
}
