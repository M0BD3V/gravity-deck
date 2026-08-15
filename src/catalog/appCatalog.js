const catalogCategories = [
  { id: "launchers", name: "Launchers" },
  { id: "streaming", name: "Streaming ao vivo" },
  { id: "communication", name: "Comunicacao" },
  { id: "movies", name: "Filmes e series" },
  { id: "anime", name: "Animes" },
  { id: "music", name: "Musica" },
  { id: "design", name: "Design" },
  { id: "video-editing", name: "Edicao de video" },
  { id: "browsers", name: "Navegadores" },
  { id: "reading", name: "Leitura" },
  { id: "videos", name: "Videos" },
  { id: "ai", name: "Inteligencia artificial" },
  { id: "programming", name: "Programacao" },
  { id: "storage", name: "Armazenamento" },
  { id: "gamer-utils", name: "Utilitarios gamer" },
  { id: "archives", name: "Compactadores" },
  { id: "capture", name: "Captura de tela" },
  { id: "discovery", name: "Descobrir conteudo" }
];

const appCatalog = [
  app("steam", "Steam", "launchers", "Loja, biblioteca e comunidade para jogos de PC.", "Valve.Steam", "https://store.steampowered.com/about/", ["steam client"]),
  app("epic-games", "Epic Games Store", "launchers", "Loja e launcher para jogos da Epic, Unreal Engine e jogos gratuitos.", "EpicGames.EpicGamesLauncher", "https://store.epicgames.com/download", ["epic games launcher", "epic games"]),
  app("ea-app", "EA App", "launchers", "Launcher oficial da EA para Battlefield, EA Sports e outros jogos.", "ElectronicArts.EADesktop", "https://www.ea.com/ea-app", ["ea desktop", "electronic arts"]),
  app("ubisoft-connect", "Ubisoft Connect", "launchers", "Launcher e rede da Ubisoft para Assassin's Creed, Far Cry e Rainbow Six.", "Ubisoft.Connect", "https://ubisoftconnect.com/", ["uplay", "ubisoft"]),
  app("battle-net", "Battle.net", "launchers", "Launcher da Blizzard para Diablo, Overwatch, WoW e Call of Duty.", "Blizzard.BattleNet", "https://download.battle.net/", ["battle net", "blizzard"]),
  app("rockstar-games", "Rockstar Games Launcher", "launchers", "Launcher da Rockstar para GTA, Red Dead Redemption e jogos relacionados.", "RockstarGames.RockstarGamesLauncher", "https://www.rockstargames.com/rockstar-games-launcher", ["rockstar launcher", "rockstar"]),
  app("xbox", "Xbox App", "launchers", "Biblioteca do Game Pass, jogos Xbox no PC e recursos sociais.", "Microsoft.GamingApp", "https://www.xbox.com/apps/xbox-app-for-pc", ["xbox", "xbox app"]),
  app("gog-galaxy", "GOG Galaxy", "launchers", "Launcher da GOG para jogos sem DRM e biblioteca unificada.", "GOG.Galaxy", "https://www.gog.com/galaxy", ["gog galaxy", "gog"]),
  app("amazon-games", "Amazon Games", "launchers", "Launcher para jogos e beneficios Prime Gaming.", "Amazon.Games", "https://gaming.amazon.com/amazon-games-app", ["amazon games app"]),
  app("riot-client", "Riot Client", "launchers", "Cliente da Riot para League of Legends, Valorant e jogos do estudio.", null, "https://www.riotgames.com/", ["riot client", "riot games", "league of legends", "valorant"]),
  app("minecraft-launcher", "Minecraft Launcher", "launchers", "Launcher oficial para Minecraft Java, Bedrock e Dungeons.", "Mojang.MinecraftLauncher", "https://www.minecraft.net/download", ["minecraft", "minecraft launcher", "mine launcher"]),
  app("roblox", "Roblox", "launchers", "Cliente para jogar experiencias Roblox instaladas no PC.", "Roblox.Roblox", "https://www.roblox.com/download", ["roblox", "roblox player", "robloxplayerlauncher", "roblox corporation"]),
  app("hytale-launcher", "Hytale Launcher", "launchers", "Launcher dedicado ao Hytale quando instalado no PC.", null, "https://www.hytale.com/", ["hytale", "hytale launcher", "hypixel hytale"]),
  app("lunar-client", "Lunar Client", "launchers", "Cliente dedicado para Minecraft com mods e otimizacoes.", null, "https://www.lunarclient.com/download", ["lunar client", "lunarclient"]),
  app("badlion-client", "Badlion Client", "launchers", "Cliente dedicado para Minecraft com mods e recursos competitivos.", null, "https://client.badlion.net/", ["badlion", "badlion client"]),
  app("modrinth-app", "Modrinth App", "launchers", "Gerenciador de modpacks e instancias de Minecraft.", "Modrinth.ModrinthApp", "https://modrinth.com/app", ["modrinth", "modrinth app"]),
  app("prism-launcher", "Prism Launcher", "launchers", "Launcher de instancias para Minecraft e modpacks.", "PrismLauncher.PrismLauncher", "https://prismlauncher.org/", ["prism launcher", "prismlauncher", "multi mc", "multimc"]),
  app("playnite", "Playnite", "launchers", "Gerenciador open-source para juntar varias bibliotecas de jogos.", "Playnite.Playnite", "https://playnite.link/", ["playnite desktop app"]),
  app("heroic", "Heroic Games Launcher", "launchers", "Launcher open-source para Epic, GOG e Amazon Games.", "HeroicGamesLauncher.HeroicGamesLauncher", "https://heroicgameslauncher.com/", ["heroic", "heroic games"]),
  app("lutris", "Lutris", "launchers", "Gerenciador de jogos focado em Linux e compatibilidade por runners.", null, "https://lutris.net/", ["lutris"]),

  app("obs", "OBS Studio", "streaming", "Gravacao e transmissao ao vivo com cenas, fontes e plugins.", "OBSProject.OBSStudio", "https://obsproject.com/", ["obs", "obs studio"]),
  app("streamlabs", "Streamlabs Desktop", "streaming", "App de live com overlays, alertas e ferramentas para streamers.", "Streamlabs.StreamlabsDesktop", "https://streamlabs.com/streamlabs-desktop", ["streamlabs", "streamlabs obs"]),
  app("tiktok-studio", "TikTok Studio", "streaming", "Ferramenta do TikTok para lives, chat e criacao ao vivo.", null, "https://www.tiktok.com/studio/download", ["tiktok live studio", "tiktok studio"]),
  app("prism-live", "Prism Live Studio", "streaming", "Studio para lives e gravacoes com layouts e recursos visuais.", null, "https://prismlive.com/", ["prism live", "prism live studio"]),
  app("xsplit", "XSplit Broadcaster", "streaming", "Software de transmissao com cenas, fontes e integracao para lives.", null, "https://www.xsplit.com/broadcaster", ["xsplit", "xsplit broadcaster"]),
  app("restream", "Restream", "streaming", "Plataforma para transmitir em varios canais ao mesmo tempo.", null, "https://restream.io/", ["restream studio", "restream"]),
  app("nvidia-broadcast", "NVIDIA Broadcast", "streaming", "Recursos de camera, voz e fundo com IA para placas NVIDIA.", "Nvidia.Broadcast", "https://www.nvidia.com/geforce/broadcasting/broadcast-app/", ["nvidia broadcast"]),

  app("discord", "Discord", "communication", "Voz, chat, comunidades e chamadas para jogar com amigos.", "Discord.Discord", "https://discord.com/download", ["discord"]),
  app("telegram", "Telegram", "communication", "Mensagens, grupos e canais com cliente desktop rapido.", "Telegram.TelegramDesktop", "https://desktop.telegram.org/", ["telegram desktop", "telegram"]),
  app("whatsapp", "WhatsApp Desktop", "communication", "Mensagens e chamadas do WhatsApp no computador.", "WhatsApp.WhatsApp", "https://www.whatsapp.com/download", ["whatsapp", "whatsapp desktop"]),
  app("skype", "Skype", "communication", "Chamadas de video, voz e mensagens.", "Microsoft.Skype", "https://www.skype.com/get-skype/", ["skype"]),
  app("zoom", "Zoom", "communication", "Reunioes, chamadas e video conferencia.", "Zoom.Zoom", "https://zoom.us/download", ["zoom", "zoom workplace"]),
  app("teams", "Microsoft Teams", "communication", "Chamadas, reunioes e colaboracao para equipes.", "Microsoft.Teams", "https://www.microsoft.com/microsoft-teams/download-app", ["teams", "microsoft teams"]),
  app("slack", "Slack", "communication", "Mensagens e canais para times e comunidades.", "SlackTechnologies.Slack", "https://slack.com/downloads/windows", ["slack"]),
  app("guilded", "Guilded", "communication", "Comunidades gamer com chat, voz e organizacao de grupos.", null, "https://www.guilded.gg/download", ["guilded"]),

  app("netflix", "Netflix", "movies", "Streaming de filmes, series e animes por assinatura.", null, "https://www.netflix.com/", ["netflix"]),
  app("disney-plus", "Disney+", "movies", "Filmes e series da Disney, Pixar, Marvel, Star Wars e National Geographic.", null, "https://www.disneyplus.com/", ["disney plus", "disney+"]),
  app("max", "Max", "movies", "Streaming da Warner Bros., HBO, DC e Discovery.", null, "https://www.max.com/", ["max", "hbo max"]),
  app("prime-video", "Prime Video", "movies", "Filmes, series e canais dentro do ecossistema Amazon.", null, "https://www.primevideo.com/", ["prime video", "amazon prime video"]),
  app("paramount-plus", "Paramount+", "movies", "Filmes, series e esportes da Paramount.", null, "https://www.paramountplus.com/", ["paramount plus", "paramount+"]),
  app("apple-tv", "Apple TV+", "movies", "Series e filmes originais da Apple.", null, "https://tv.apple.com/", ["apple tv", "apple tv plus", "apple tv+"]),
  app("globoplay", "Globoplay", "movies", "Streaming brasileiro com novelas, series, filmes e canais.", null, "https://globoplay.globo.com/", ["globoplay"]),
  app("mubi", "MUBI", "movies", "Cinema autoral, curadoria e filmes independentes.", null, "https://mubi.com/", ["mubi"]),
  app("plex", "Plex", "movies", "Biblioteca pessoal de midia, streaming e servidor domestico.", null, "https://www.plex.tv/media-server-downloads/", ["plex", "plex media server"]),
  app("kodi", "Kodi", "movies", "Media center open-source para videos, musica e bibliotecas locais.", "XBMCFoundation.Kodi", "https://kodi.tv/download/", ["kodi", "xbmc"]),

  app("crunchyroll", "Crunchyroll", "anime", "Streaming focado em animes, simulcasts e catalogo japones.", null, "https://www.crunchyroll.com/", ["crunchyroll"]),
  app("anime-planet", "Anime Planet", "anime", "Catalogo e listas para descobrir, acompanhar e avaliar animes.", null, "https://www.anime-planet.com/", ["anime planet"]),
  app("myanimelist", "MyAnimeList", "anime", "Listas, notas e comunidade para animes e mangas.", null, "https://myanimelist.net/", ["myanimelist", "mal"]),
  app("anilist", "AniList", "anime", "Rastreamento e recomendacoes para animes e mangas.", null, "https://anilist.co/", ["anilist"]),

  app("spotify", "Spotify", "music", "Musica, podcasts e playlists para jogar ou trabalhar.", "Spotify.Spotify", "https://www.spotify.com/download/windows/", ["spotify"]),
  app("youtube-music", "YouTube Music", "music", "Musica e playlists integradas ao YouTube.", null, "https://music.youtube.com/", ["youtube music"]),
  app("deezer", "Deezer", "music", "Streaming de musica com playlists, Flow e podcasts.", "Deezer.Deezer", "https://www.deezer.com/download", ["deezer"]),
  app("apple-music", "Apple Music", "music", "Streaming de musica da Apple com biblioteca e radios.", null, "https://music.apple.com/", ["apple music"]),
  app("tidal", "Tidal", "music", "Streaming de musica com foco em qualidade de audio.", "TIDALMusicAS.TIDAL", "https://tidal.com/download", ["tidal"]),
  app("soundcloud", "SoundCloud", "music", "Musicas independentes, remixes e descobertas de artistas.", null, "https://soundcloud.com/", ["soundcloud"]),

  app("photoshop", "Adobe Photoshop", "design", "Edicao e composicao profissional de imagens.", null, "https://www.adobe.com/products/photoshop.html", ["photoshop", "adobe photoshop"]),
  app("illustrator", "Adobe Illustrator", "design", "Criacao vetorial, logos, icones e artes escalaveis.", null, "https://www.adobe.com/products/illustrator.html", ["illustrator", "adobe illustrator"]),
  app("premiere", "Adobe Premiere Pro", "design", "Edicao profissional de video para criadores e producao.", null, "https://www.adobe.com/products/premiere.html", ["premiere pro", "adobe premiere"]),
  app("after-effects", "Adobe After Effects", "design", "Motion graphics, composicao e efeitos visuais.", null, "https://www.adobe.com/products/aftereffects.html", ["after effects", "adobe after effects"]),
  app("canva", "Canva", "design", "Design rapido para posts, thumbnails, apresentacoes e marcas.", "Canva.Canva", "https://www.canva.com/download/windows/", ["canva"]),
  app("figma", "Figma", "design", "Design colaborativo de interfaces, prototipos e componentes.", "Figma.Figma", "https://www.figma.com/downloads/", ["figma"]),
  app("photopea", "Photopea", "design", "Editor de imagem no navegador compativel com PSD e formatos populares.", null, "https://www.photopea.com/", ["photopea"]),
  app("gimp", "GIMP", "design", "Editor de imagem open-source para retoque e composicao.", "GIMP.GIMP", "https://www.gimp.org/downloads/", ["gimp"]),
  app("krita", "Krita", "design", "Pintura digital e ilustracao open-source.", "KDE.Krita", "https://krita.org/download/", ["krita"]),
  app("paint-dot-net", "Paint.NET", "design", "Editor de imagens leve para Windows.", "dotPDNLLC.paintdotnet", "https://www.getpaint.net/download.html", ["paint.net", "paint net"]),

  app("davinci-resolve", "DaVinci Resolve", "video-editing", "Edicao, cor, audio e composicao em uma suite profissional.", "BlackmagicDesign.DaVinciResolve", "https://www.blackmagicdesign.com/products/davinciresolve", ["davinci resolve", "resolve"]),
  app("capcut", "CapCut", "video-editing", "Edicao rapida de video para redes sociais e clipes.", "ByteDance.CapCut", "https://www.capcut.com/tools/desktop-video-editor", ["capcut"]),
  app("vegas-pro", "Vegas Pro", "video-editing", "Editor de video profissional com timeline e efeitos.", null, "https://www.vegascreativesoftware.com/products/vegas-pro/", ["vegas pro", "sony vegas"]),
  app("shotcut", "Shotcut", "video-editing", "Editor de video open-source e multiplataforma.", "Meltytech.Shotcut", "https://shotcut.org/download/", ["shotcut"]),
  app("kdenlive", "Kdenlive", "video-editing", "Editor de video open-source com fluxo de trabalho completo.", "KDE.Kdenlive", "https://kdenlive.org/download/", ["kdenlive"]),

  app("chrome", "Google Chrome", "browsers", "Navegador rapido e amplamente compativel.", "Google.Chrome", "https://www.google.com/chrome/", ["chrome", "google chrome"]),
  app("edge", "Microsoft Edge", "browsers", "Navegador da Microsoft com integracao ao Windows e Copilot.", "Microsoft.Edge", "https://www.microsoft.com/edge/download", ["edge", "microsoft edge"]),
  app("firefox", "Mozilla Firefox", "browsers", "Navegador independente com foco em privacidade e extensoes.", "Mozilla.Firefox", "https://www.mozilla.org/firefox/new/", ["firefox", "mozilla firefox"]),
  app("opera-gx", "Opera GX", "browsers", "Navegador gamer com limitadores e integracoes de streaming.", "Opera.OperaGX", "https://www.opera.com/gx", ["opera gx"]),
  app("brave", "Brave", "browsers", "Navegador com bloqueio de rastreadores e foco em privacidade.", "Brave.Brave", "https://brave.com/download/", ["brave", "brave browser"]),
  app("vivaldi", "Vivaldi", "browsers", "Navegador altamente personalizavel para usuarios avancados.", "Vivaldi.Vivaldi", "https://vivaldi.com/download/", ["vivaldi"]),

  app("kindle", "Kindle", "reading", "Leitor de livros digitais da Amazon.", null, "https://www.amazon.com/kindle-dbs/fd/kcp", ["kindle"]),
  app("google-play-books", "Google Play Livros", "reading", "Biblioteca e leitura de ebooks pelo Google.", null, "https://play.google.com/books", ["google play books", "google play livros"]),
  app("kobo", "Kobo", "reading", "Leitura e loja de ebooks da Rakuten Kobo.", null, "https://www.kobo.com/desktop", ["kobo"]),

  app("youtube", "YouTube", "videos", "Videos, lives, clipes, tutoriais e canais.", null, "https://www.youtube.com/", ["youtube"]),
  app("vimeo", "Vimeo", "videos", "Hospedagem e descoberta de videos criativos.", null, "https://vimeo.com/", ["vimeo"]),
  app("dailymotion", "Dailymotion", "videos", "Plataforma de videos e canais.", null, "https://www.dailymotion.com/", ["dailymotion"]),
  app("twitch", "Twitch", "videos", "Lives, streamers, jogos e comunidades ao vivo.", null, "https://www.twitch.tv/", ["twitch"]),
  app("kick", "Kick", "videos", "Plataforma de lives e comunidades ao vivo.", null, "https://kick.com/", ["kick"]),

  app("chatgpt", "ChatGPT", "ai", "Assistente de IA para escrita, estudo, codigo e ideias.", "OpenAI.ChatGPT", "https://chatgpt.com/download", ["chatgpt", "openai chatgpt"]),
  app("gemini", "Google Gemini", "ai", "Assistente de IA do Google para pesquisa e criacao.", null, "https://gemini.google.com/", ["gemini", "google gemini"]),
  app("copilot", "Microsoft Copilot", "ai", "Assistente de IA da Microsoft integrado ao ecossistema Windows.", null, "https://copilot.microsoft.com/", ["copilot", "microsoft copilot"]),
  app("claude", "Claude", "ai", "Assistente de IA da Anthropic para escrita, raciocinio e codigo.", null, "https://claude.ai/download", ["claude", "anthropic claude"]),
  app("perplexity", "Perplexity", "ai", "Busca com IA para respostas com fontes e pesquisa rapida.", null, "https://www.perplexity.ai/", ["perplexity"]),
  app("grok", "Grok", "ai", "Assistente de IA da xAI integrado ao X.", null, "https://grok.com/", ["grok"]),

  app("vscode", "Visual Studio Code", "programming", "Editor leve para codigo, extensoes e projetos.", "Microsoft.VisualStudioCode", "https://code.visualstudio.com/", ["visual studio code", "vs code", "vscode"]),
  app("visual-studio", "Visual Studio", "programming", "IDE completa da Microsoft para .NET, C++, desktop e web.", "Microsoft.VisualStudio.2022.Community", "https://visualstudio.microsoft.com/downloads/", ["visual studio"]),
  app("jetbrains-toolbox", "JetBrains Toolbox", "programming", "Gerenciador dos IDEs JetBrains como IntelliJ, Rider e WebStorm.", "JetBrains.Toolbox", "https://www.jetbrains.com/toolbox-app/", ["jetbrains toolbox", "toolbox"]),
  app("github-desktop", "GitHub Desktop", "programming", "Cliente Git visual para repositorios GitHub.", "GitHub.GitHubDesktop", "https://desktop.github.com/", ["github desktop"]),
  app("git", "Git", "programming", "Controle de versao essencial para desenvolvimento.", "Git.Git", "https://git-scm.com/download/win", ["git"]),
  app("postman", "Postman", "programming", "Cliente para testar APIs, colecoes e ambientes.", "Postman.Postman", "https://www.postman.com/downloads/", ["postman"]),
  app("docker-desktop", "Docker Desktop", "programming", "Containers locais para desenvolvimento e testes.", "Docker.DockerDesktop", "https://www.docker.com/products/docker-desktop/", ["docker desktop", "docker"]),

  app("google-drive", "Google Drive", "storage", "Sincronizacao de arquivos e Drive no Windows.", "Google.Drive", "https://www.google.com/drive/download/", ["google drive", "drive for desktop"]),
  app("dropbox", "Dropbox", "storage", "Sincronizacao e compartilhamento de arquivos.", "Dropbox.Dropbox", "https://www.dropbox.com/install", ["dropbox"]),
  app("onedrive", "OneDrive", "storage", "Armazenamento em nuvem integrado ao Windows e Microsoft 365.", "Microsoft.OneDrive", "https://www.microsoft.com/microsoft-365/onedrive/download", ["onedrive", "one drive"]),
  app("mega", "MEGA", "storage", "Armazenamento em nuvem com sincronizacao e criptografia.", "Mega.MEGASync", "https://mega.io/desktop", ["mega", "megasync"]),
  app("pcloud", "pCloud", "storage", "Drive em nuvem com sincronizacao e arquivos sob demanda.", "pCloudAG.pCloudDrive", "https://www.pcloud.com/download-free-online-cloud-file-storage.html", ["pcloud", "pcloud drive"]),

  app("msi-afterburner", "MSI Afterburner", "gamer-utils", "Monitoramento, overclock e controle de GPU.", null, "https://www.msi.com/Landing/afterburner/graphics-cards", ["msi afterburner", "afterburner"]),
  app("rivatuner", "RivaTuner Statistics Server", "gamer-utils", "Overlay e limitador de FPS usado junto ao Afterburner.", null, "https://www.guru3d.com/download/rtss-rivatuner-statistics-server-download/", ["rivatuner", "riva tuner", "rtss"]),
  app("hwinfo", "HWiNFO", "gamer-utils", "Monitoramento detalhado de sensores e hardware.", "REALiX.HWiNFO", "https://www.hwinfo.com/download/", ["hwinfo", "hwinfo64"]),
  app("cpu-z", "CPU-Z", "gamer-utils", "Informacoes tecnicas de CPU, placa-mae e memoria.", "CPUID.CPU-Z", "https://www.cpuid.com/softwares/cpu-z.html", ["cpu z", "cpu-z"]),
  app("gpu-z", "GPU-Z", "gamer-utils", "Informacoes e sensores da placa de video.", "TechPowerUp.GPU-Z", "https://www.techpowerup.com/gpuz/", ["gpu z", "gpu-z"]),
  app("crystaldiskinfo", "CrystalDiskInfo", "gamer-utils", "Saude, temperatura e S.M.A.R.T. dos discos.", "CrystalDewWorld.CrystalDiskInfo", "https://crystalmark.info/en/software/crystaldiskinfo/", ["crystaldiskinfo", "crystal disk info"]),
  app("crystaldiskmark", "CrystalDiskMark", "gamer-utils", "Benchmark de velocidade para SSDs e HDs.", "CrystalDewWorld.CrystalDiskMark", "https://crystalmark.info/en/software/crystaldiskmark/", ["crystaldiskmark", "crystal disk mark"]),
  app("wallpaper-engine", "Wallpaper Engine", "gamer-utils", "Papeis de parede animados, interativos e com suporte a Steam Workshop.", null, "https://store.steampowered.com/app/431960/Wallpaper_Engine/", ["wallpaper engine", "wallpaper_engine", "wallpaper32"]),
  app("memtest86", "MemTest86", "gamer-utils", "Teste de memoria RAM fora do sistema operacional.", null, "https://www.memtest86.com/download.htm", ["memtest86", "memtest"]),

  app("7zip", "7-Zip", "archives", "Compactador leve para 7z, zip, rar e outros formatos.", "7zip.7zip", "https://www.7-zip.org/", ["7zip", "7 zip", "7-zip"]),
  app("winrar", "WinRAR", "archives", "Compactador classico para RAR, ZIP e arquivos divididos.", "RARLab.WinRAR", "https://www.win-rar.com/download.html", ["winrar", "win rar"]),
  app("peazip", "PeaZip", "archives", "Compactador open-source com suporte a muitos formatos.", "Giorgiotani.Peazip", "https://peazip.github.io/", ["peazip", "pea zip"]),

  app("sharex", "ShareX", "capture", "Captura de tela, gravacao, OCR e automacoes.", "ShareX.ShareX", "https://getsharex.com/", ["sharex", "share x"]),
  app("greenshot", "Greenshot", "capture", "Captura de tela leve com anotacoes rapidas.", "Greenshot.Greenshot", "https://getgreenshot.org/downloads/", ["greenshot", "green shot"]),
  app("lightshot", "Lightshot", "capture", "Captura de tela simples com compartilhamento rapido.", "Skillbrains.Lightshot", "https://app.prntscr.com/", ["lightshot"]),

  app("imdb", "IMDb", "discovery", "Banco de filmes, series, elenco, notas e curiosidades.", null, "https://www.imdb.com/", ["imdb"]),
  app("letterboxd", "Letterboxd", "discovery", "Diario social para filmes, listas e resenhas.", null, "https://letterboxd.com/", ["letterboxd"]),
  app("rotten-tomatoes", "Rotten Tomatoes", "discovery", "Agregador de criticas e notas de filmes e series.", null, "https://www.rottentomatoes.com/", ["rotten tomatoes"]),
  app("metacritic", "Metacritic", "discovery", "Agregador de notas para jogos, filmes, TV e musica.", null, "https://www.metacritic.com/", ["metacritic"]),
  app("rawg", "RAWG", "discovery", "Banco de dados e descoberta de jogos.", null, "https://rawg.io/", ["rawg"]),
  app("howlongtobeat", "HowLongToBeat", "discovery", "Estimativas de duracao de jogos.", null, "https://howlongtobeat.com/", ["howlongtobeat", "how long to beat"]),
  app("steamdb", "SteamDB", "discovery", "Dados, precos, charts e historico de jogos na Steam.", null, "https://steamdb.info/", ["steamdb", "steam db"]),
  app("pcgamingwiki", "PCGamingWiki", "discovery", "Wiki de ajustes, compatibilidade e fixes para jogos de PC.", null, "https://www.pcgamingwiki.com/", ["pcgamingwiki", "pc gaming wiki"])
];

function app(id, name, categoryId, summary, wingetId, website, aliases = []) {
  const category = catalogCategories.find((item) => item.id === categoryId);

  return {
    id,
    name,
    categoryId,
    categoryName: category?.name || "Apps",
    summary,
    wingetId,
    website,
    aliases: [...new Set([name, ...aliases].filter(Boolean))]
  };
}

function getCatalogItems() {
  return appCatalog.map((item) => ({ ...item }));
}

function findCatalogItem(id) {
  return appCatalog.find((item) => item.id === id) || null;
}

function decorateCatalogApp(appItem, catalogItem) {
  return {
    ...appItem,
    name: catalogItem.name,
    provider: "app",
    category: "app",
    appCatalogId: catalogItem.id,
    appCategoryId: catalogItem.categoryId,
    appCategoryName: catalogItem.categoryName,
    summary: catalogItem.summary,
    wingetId: catalogItem.wingetId,
    website: catalogItem.website,
    confidence: Number(appItem.confidence || 0) + 60
  };
}

function matchCatalogItem(candidate) {
  const fields = getCandidateFields(candidate);

  for (const item of appCatalog) {
    const aliases = item.aliases.map(normalizeName).filter(Boolean);

    if (aliases.some((alias) => fields.some((field) => fieldMatchesAlias(field, alias)))) {
      return item;
    }
  }

  return null;
}

function getCandidateFields(candidate) {
  const values = [
    candidate?.name,
    candidate?.appId,
    candidate?.target,
    candidate?.iconTarget,
    candidate?.exe
  ];

  return values
    .flatMap((value) => getValueFields(value))
    .map(normalizeName)
    .filter(Boolean);
}

function getValueFields(value) {
  const text = String(value || "");

  if (!text) {
    return [];
  }

  const fields = [text];
  const normalizedPath = text.replace(/"/g, "");
  const basename = normalizedPath.split(/[\\/]/).pop();

  if (basename && basename !== text) {
    fields.push(basename.replace(/\.(exe|lnk|appref-ms)$/i, ""));
  }

  return fields;
}

function fieldMatchesAlias(field, alias) {
  if (!field || !alias) {
    return false;
  }

  if (field === alias) {
    return true;
  }

  if (alias.length <= 4) {
    return false;
  }

  return field.includes(alias);
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  appCatalog,
  catalogCategories,
  decorateCatalogApp,
  findCatalogItem,
  getCatalogItems,
  matchCatalogItem,
  normalizeName
};
