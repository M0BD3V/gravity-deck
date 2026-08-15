const fs = require('fs/promises');
const path = require('path');
const { exec } = require('child_process');

const RELEASES_BASE_DIR = 'E:\\TESTADOR DE VERSOES';

async function getNextVersion(baseDir) {
    try {
        const entries = await fs.readdir(baseDir, { withFileTypes: true });
        const versionFolders = entries
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)
            .filter(name => /\d+\.\d+\.\d+/.test(name))
            .sort((a, b) => {
                const parseVersion = (v) => v.split('.').map(Number);
                const [aMajor, aMinor, aPatch] = parseVersion(a);
                const [bMajor, bMinor, bPatch] = parseVersion(b);

                if (aMajor !== bMajor) return aMajor - bMajor;
                if (aMinor !== bMinor) return aMinor - bMinor;
                return aPatch - bPatch;
            });

        if (versionFolders.length === 0) {
            return '0.0.1';
        }

        const latestVersion = versionFolders[versionFolders.length - 1];
        const [major, minor, patch] = latestVersion.split('.').map(Number);
        return `${major}.${minor}.${patch + 1}`;

    } catch (error) {
        if (error.code === 'ENOENT') {
            return '0.0.1';
        }
        throw error;
    }
}

async function executeCommand(command, cwd = process.cwd()) {
    return new Promise((resolve, reject) => {
        const child = exec(command, { cwd });

        child.stdout.on('data', (data) => {
            console.log(`stdout: ${data.toString()}`);
        });

        child.stderr.on('data', (data) => {
            console.error(`stderr: ${data.toString()}`);
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command exited with code ${code}`));
            }
        });
    });
}

async function findFile(startPath, fileNameRegex, maxDepth = 5) {
    const q = [{ path: startPath, depth: 0 }];
    const visited = new Set();

    while (q.length > 0) {
        const { path: currentPath, depth } = q.shift();

        if (visited.has(currentPath) || depth > maxDepth) {
            continue;
        }
        visited.add(currentPath);

        try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                const entryPath = path.join(currentPath, entry.name);
                if (entry.isFile() && fileNameRegex.test(entry.name)) {
                    return entryPath;
                }
                if (entry.isDirectory()) {
                    q.push({ path: entryPath, depth: depth + 1 });
                }
            }
        } catch (e) {
            // Ignore errors for unreadable directories
        }
    }
    return null;
}

async function buildRelease() {
    let currentVersion = '0.0.1-alpha'; // Default from package.json
    try {
        const packageJson = JSON.parse(await fs.readFile(path.join(__dirname, 'package.json'), 'utf8'));
        currentVersion = packageJson.version;
    } catch (error) {
        console.warn('Could not read package.json version, using default.', error.message);
    }

    console.log(`Iniciando build para a versão base: ${currentVersion}`);

    const nextVersion = await getNextVersion(RELEASES_BASE_DIR);
    const releasePath = path.join(RELEASES_BASE_DIR, nextVersion);

    console.log(`Próxima versão detectada: ${nextVersion}`);
    console.log(`Criando diretório de release: ${releasePath}`);
    await fs.mkdir(releasePath, { recursive: true });

    console.log('Iniciando build do instalador Windows (.exe)...');
    await executeCommand('npm run build:win');
    console.log('Build do instalador Windows concluído.');

    console.log('Iniciando build do APK mobile...');
    await executeCommand('npm run build:apk');
    console.log('Build do APK mobile concluído.');

    // Find and copy Windows installer
    const winInstallerPath = await findFile(path.join(__dirname, 'dist'), /Mob Deck Setup \d+\.\d+\.\d+\.exe/);
    if (winInstallerPath) {
        const destPath = path.join(releasePath, path.basename(winInstallerPath));
        await fs.copyFile(winInstallerPath, destPath);
        console.log(`Instalador Windows copiado para: ${destPath}`);
    } else {
        console.error('Instalador Windows não encontrado.');
    }

    // Find and copy Android APK
    const apkPath = await findFile(path.join(__dirname, 'mobile-app', 'android', 'app', 'build', 'outputs', 'apk'), /app-debug.apk/);
    if (apkPath) {
        const destPath = path.join(releasePath, path.basename(apkPath));
        await fs.copyFile(apkPath, destPath);
        console.log(`APK mobile copiado para: ${destPath}`);
    } else {
        console.error('APK mobile não encontrado.');
    }

    console.log(`\n--- Build da versão ${nextVersion} concluído! ---`);
    console.log(`Arquivos disponíveis em: ${releasePath}`);
}

buildRelease().catch(error => {
    console.error('Erro durante o processo de build:', error);
    process.exit(1);
});