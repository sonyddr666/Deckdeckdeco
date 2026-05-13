import fs from 'fs';
import http from 'http';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

import UlanziApi, { Utils, RandomPort } from './ulanzi-api/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginRoot = findPluginRoot(__dirname);
const runtimeDir = path.join(pluginRoot, '.deckdeckdeco');
const configPath = path.join(pluginRoot, 'config', 'deckdeckdeco.config.json');
const exampleConfigPath = path.join(pluginRoot, 'config', 'deckdeckdeco.config.example.json');
const panelDir = path.join(pluginRoot, 'panel');
const defaultGlitchDir = path.join(pluginRoot, 'resources', 'glitch');
const deckDataDir = path.join(pluginRoot, 'deck-data');
const smartButtonsPath = path.join(deckDataDir, 'buttons.json');
const smartPagesPath = path.join(deckDataDir, 'pages.json');
const smartAssetsDir = path.join(deckDataDir, 'assets');
const smartScriptsDir = path.join(deckDataDir, 'scripts');

fs.mkdirSync(runtimeDir, { recursive: true });
ensureConfigFile();
ensureGlitchFolder();
ensureSmartData();

const $UD = new UlanziApi();
const randomPort = new RandomPort();
randomPort.getPort();

const actionSettings = new Map();
const snippetLoops = new Map();
const keyDownState = new Map();
const knownContexts = new Map();
let panelServer = null;
let panelUrl = '';
let currentSmartPage = 'main';
let smartPageStack = [];
let smartContextCounter = 0;

startPanelServer();
$UD.connect('com.ulanzi.ulanzistudio.deckdeckdeco');

$UD.onConnected(() => {
  $UD.logMessage('DeckDeckDeco connected', 'info');
});

$UD.onAdd((message) => {
  rememberSettings(message);
  rememberActionContext(message);
  setReadyCard(message);
});

$UD.onParamFromApp((message) => {
  rememberSettings(message);
  rememberActionContext(message);
  flashSavedThenReady(message);
});

if (typeof $UD.onSendToPlugin === 'function') {
  $UD.onSendToPlugin(async (message) => {
    const payload = message?.payload || message?.param || {};
    if (payload.type === 'getSmartProfiles') {
      sendSmartProfilesToInspector(message.context);
      return;
    }
    if (payload.type === 'smartSelectProfile') {
      applySmartProfileSelection(message, payload.profileId);
      return;
    }
    if (payload.type === 'openPanel') {
      openPanel(message.context);
      return;
    }
    if (payload.type === 'openIconFolder') {
      await openIconFolderAction(message);
      return;
    }
    if (payload.type === 'testCommand') {
      const command = applyTokens(payload.command || '', payload);
      const cwd = applyTokens(payload.cwd || '{pluginRoot}', payload);
      const result = await runShell(command, { cwd });
      if (result.code === 0) {
        $UD.toast('Command OK');
      } else {
        $UD.toast('Command FAIL: exit ' + result.code);
      }
    }
  });
}

$UD.onKeyDown(async (message) => {
  rememberSettings(message);
  rememberActionContext(message);
  const action = actionKey(message);
  if (action === 'voiceAI') {
    keyDownState.set(message.context, { startedAt: Date.now() });
    await safeRunOptionalCommand(settingsFor(message, action).recordStartCommand, message.context, 'REC START');
    setCard(message.context, { title: 'VOICE', lines: ['REC', 'hold'], theme: 'running' });
  }
});

$UD.onKeyUp(async (message) => {
  rememberSettings(message);
  rememberActionContext(message);
  const action = actionKey(message);
  if (action === 'voiceAI' && keyDownState.has(message.context)) {
    keyDownState.delete(message.context);
    await runVoiceAI(message);
  }
});

$UD.onRun(async (message) => {
  rememberSettings(message);
  rememberActionContext(message);
  const action = actionKey(message);

  if (action === 'controlPanel') return openPanel(message.context);
  if (action === 'smartButton') return runSmartButton(message);
  if (action === 'openIconFolder') return openIconFolderAction(message);
  if (action === 'glitchFx') return runGlitchFx(message);

  if (action === 'voiceAI') {
    if (keyDownState.has(message.context)) return;
    await runVoiceAI(message);
    return;
  }

  if (action === 'runCommand') return runCommandAction(message);
  if (action === 'snippetCard') return toggleSnippetCard(message);
  if (action === 'translator') return runTranslator(message);
  if (action === 'youtubeControl') return runYouTubeControl(message);

  setCard(message.context, { title: 'DECK', lines: ['NO', 'ACTION'], theme: 'fail' });
});

$UD.onClear((message) => {
  if (!Array.isArray(message.param)) return;
  for (const item of message.param) {
    stopSnippetLoop(item.context);
    actionSettings.delete(item.context);
    keyDownState.delete(item.context);
    knownContexts.delete(item.context);
  }
});

async function runCommandAction(message) {
  const context = message.context;
  const cfg = settingsFor(message, 'runCommand');
  const command = applyTokens(cfg.command || 'node scripts/examples/fake-test.mjs');
  const cwd = applyTokens(cfg.cwd || '{pluginRoot}');
  const started = Date.now();

  setCard(context, {
    title: cfg.title || 'CMD',
    lines: [cfg.runningLabel || 'RUN', shortCommand(command)],
    theme: 'running'
  });

  const result = await runShell(command, { cwd, timeout: Number(cfg.timeoutMs || 120000) });
  const seconds = ((Date.now() - started) / 1000).toFixed(1) + 's';
  const output = compactOutput(result.stdout || result.stderr || '').slice(0, 2);

  if (result.code === 0) {
    await safeRunOptionalCommand(cfg.successSoundCommand, context, 'SUCCESS SOUND');
    setCard(context, {
      title: cfg.title || 'CMD',
      lines: [cfg.successLabel || 'OK', seconds, ...output],
      theme: 'success'
    });
  } else {
    await safeRunOptionalCommand(cfg.failSoundCommand, context, 'FAIL SOUND');
    setCard(context, {
      title: cfg.title || 'CMD',
      lines: [cfg.failLabel || 'FAIL', 'exit ' + result.code, ...output],
      theme: 'fail'
    });
  }
}

async function toggleSnippetCard(message) {
  const context = message.context;
  if (snippetLoops.has(context)) {
    stopSnippetLoop(context);
    setCard(context, { title: 'LIVE', lines: ['OFF'], theme: 'idle' });
    return;
  }

  const cfg = settingsFor(message, 'snippetCard');
  const intervalMs = Math.max(500, Number(cfg.intervalMs || 1000));

  const tick = async () => {
    try {
      const lines = await readSnippetLines(cfg);
      setCard(context, { title: cfg.title || 'LIVE', lines, theme: 'info' });
    } catch (error) {
      setCard(context, {
        title: cfg.title || 'LIVE',
        lines: ['ERR', String(error.message || error).slice(0, 18)],
        theme: 'fail'
      });
    }
  };

  await tick();
  snippetLoops.set(context, setInterval(tick, intervalMs));
}

async function runVoiceAI(message) {
  const context = message.context;
  const cfg = settingsFor(message, 'voiceAI');
  const transcriptFile = path.join(runtimeDir, 'transcript.txt');
  const responseFile = path.join(runtimeDir, 'response.txt');

  setCard(context, { title: cfg.title || 'VOICE', lines: ['STOP', 'audio'], theme: 'running' });
  await safeRunOptionalCommand(cfg.recordStopCommand, context, 'REC STOP');

  setCard(context, { title: cfg.title || 'VOICE', lines: ['STT', '...'], theme: 'running' });
  let result = await runPipelineCommand(cfg.sttCommand, { transcriptFile, responseFile });
  if (result.code !== 0) return pipelineFail(context, 'STT', result);

  const transcript = readTextIfExists(transcriptFile);
  setCard(context, { title: cfg.title || 'VOICE', lines: ['YOU', ...toCardLines(transcript, 2, 16)], theme: 'info' });

  setCard(context, { title: cfg.title || 'VOICE', lines: ['LLM', 'THINK'], theme: 'running' });
  result = await runPipelineCommand(cfg.llmCommand, { transcriptFile, responseFile });
  if (result.code !== 0) return pipelineFail(context, 'LLM', result);

  const response = readTextIfExists(responseFile);
  setCard(context, { title: cfg.title || 'VOICE', lines: ['AI', ...toCardLines(response, 3, 16)], theme: 'success' });

  setCard(context, { title: cfg.title || 'VOICE', lines: ['TTS', 'PLAY'], theme: 'running' });
  result = await runPipelineCommand(cfg.ttsCommand, { transcriptFile, responseFile });
  if (result.code !== 0) return pipelineFail(context, 'TTS', result);

  setCard(context, { title: cfg.title || 'VOICE', lines: ['DONE', ...toCardLines(response, 2, 16)], theme: 'success' });
}

async function runTranslator(message) {
  const context = message.context;
  const cfg = settingsFor(message, 'translator');
  const transcriptFile = path.join(runtimeDir, 'translate-transcript.txt');
  const responseFile = path.join(runtimeDir, 'translate-response.txt');

  setCard(context, { title: cfg.title || 'TRAD', lines: ['STT', '...'], theme: 'running' });
  let result = await runPipelineCommand(cfg.sttCommand, { transcriptFile, responseFile });
  if (result.code !== 0) return pipelineFail(context, 'STT', result);

  setCard(context, { title: cfg.title || 'TRAD', lines: ['TRANS', '...'], theme: 'running' });
  result = await runPipelineCommand(cfg.translateCommand, { transcriptFile, responseFile });
  if (result.code !== 0) return pipelineFail(context, 'TRANS', result);

  const translated = readTextIfExists(responseFile);
  setCard(context, { title: cfg.title || 'TRAD', lines: ['OK', ...toCardLines(translated, 3, 16)], theme: 'success' });

  result = await runPipelineCommand(cfg.ttsCommand, { transcriptFile, responseFile });
  if (result.code !== 0) return pipelineFail(context, 'TTS', result);
}

async function runYouTubeControl(message) {
  const context = message.context;
  const cfg = settingsFor(message, 'youtubeControl');
  setCard(context, { title: cfg.title || 'YT', lines: ['OPEN'], theme: 'running' });

  if (cfg.url) $UD.openUrl(cfg.url, false, {});
  if (cfg.hotkey) $UD.hotkey(cfg.hotkey);

  setCard(context, { title: cfg.title || 'YT', lines: ['DONE'], theme: 'success' });
}

function openPanel(context) {
  if (!panelUrl) startPanelServer();
  const url = panelUrl || 'http://127.0.0.1:39177/';

  // Do not redraw the key here. Opening the panel must not replace the user's chosen icon.
  $UD.openUrl(url, false, {});
  openExternalUrl(url);
}

function openExternalUrl(url) {
  const quoted = JSON.stringify(url);
  const command = process.platform === 'win32'
    ? `cmd /c start "" ${quoted}`
    : process.platform === 'darwin'
      ? `open ${quoted}`
      : `xdg-open ${quoted}`;
  exec(command, { windowsHide: true }, () => {});
}


async function openIconFolderAction(message) {
  const context = message?.context;
  const cfg = settingsFor(message, 'openIconFolder');
  const folder = safeGlitchFolder(cfg.folder || 'resources/glitch');
  ensureGlitchFolder(folder);
  if (context) setCard(context, { title: cfg.title || 'ICONS', lines: ['OPEN', 'FOLDER'], theme: 'info' });
  openExternalUrl(pathToFileUrl(folder));
  setTimeout(() => {
    if (context) setReadyCard(message);
  }, 1200);
}

async function runGlitchFx(message) {
  const context = message?.context;
  const cfg = settingsFor(message, 'glitchFx');
  const folder = safeGlitchFolder(cfg.folder || 'resources/glitch');
  ensureGlitchFolder(folder);
  const files = listGlitchFiles(folder);

  if (!files.length) {
    if (context) setCard(context, { title: cfg.title || 'BUG', lines: ['NO', 'ICONS'], theme: 'fail' });
    return;
  }

  const durationMs = clampNumber(cfg.durationMs, 3000, 250, 30000);
  const frameMs = clampNumber(cfg.frameMs, 120, 50, 2000);
  const restore = cfg.restore !== false && String(cfg.restore).toLowerCase() !== 'false';
  const targets = getGlitchTargets(message, cfg);

  if (context) setCard(context, { title: cfg.title || 'BUG', lines: ['GLITCH', String(targets.length) + ' KEYS'], theme: 'running' });

  const startedAt = Date.now();
  const loop = setInterval(() => {
    for (const target of targets) {
      const file = files[Math.floor(Math.random() * files.length)];
      setImageFile(target.context, file);
    }
    if (Date.now() - startedAt >= durationMs) {
      clearInterval(loop);
      if (restore) {
        for (const target of targets) setReadyCard(makeMessageForContext(target));
      }
      if (context) setCard(context, { title: cfg.title || 'BUG', lines: ['DONE'], theme: 'success' });
      setTimeout(() => { if (context) setReadyCard(message); }, 900);
    }
  }, frameMs);
}

function getGlitchTargets(message, cfg) {
  const mode = cfg.target || 'deckdeckdecoOnly';
  const items = [...knownContexts.values()]
    .filter(item => item.context && item.action !== 'unknown');

  if (mode === 'self') return [{ context: message.context, action: actionKey(message), settings: actionSettings.get(message.context) || {} }];
  if (mode === 'excludeSelf') return items.filter(item => item.context !== message.context);
  return items.length ? items : [{ context: message.context, action: actionKey(message), settings: actionSettings.get(message.context) || {} }];
}

function makeMessageForContext(target) {
  return {
    context: target.context,
    action: 'com.ulanzi.ulanzistudio.deckdeckdeco.' + target.action,
    param: target.settings || {}
  };
}

function setImageFile(context, file) {
  if (!context || !file || !fs.existsSync(file)) return;
  const ext = path.extname(file).toLowerCase();
  const relative = path.relative(pluginRoot, file).replaceAll('\\', '/');

  // GIFs are better as plugin-relative paths when the host supports them.
  if (ext === '.gif' && typeof $UD.setGifPathIcon === 'function') {
    return $UD.setGifPathIcon(context, relative, '');
  }

  // Static assets are sent as base64 so uploaded/edited images show immediately.
  const base64 = fs.readFileSync(file).toString('base64');
  if (ext === '.gif' && typeof $UD.setGifDataIcon === 'function') return $UD.setGifDataIcon(context, base64, '');
  return $UD.setBaseDataIcon(context, base64, '');
}

function safeGlitchFolder(folderValue) {
  let raw = String(folderValue || 'resources/glitch').trim().replaceAll('\\', '/');
  if (!raw || raw === 'glitch') raw = 'resources/glitch';
  raw = raw.replace(/^\/+/, '');
  const base = path.resolve(defaultGlitchDir);
  const target = path.resolve(pluginRoot, raw);
  if (target !== base && !target.startsWith(base + path.sep)) return base;
  return target;
}

function ensureGlitchFolder(folder = defaultGlitchDir) {
  fs.mkdirSync(folder, { recursive: true });
}

function listGlitchFiles(folder = defaultGlitchDir) {
  const allowed = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif']);
  try {
    return fs.readdirSync(folder)
      .filter(file => allowed.has(path.extname(file).toLowerCase()))
      .map(file => path.join(folder, file));
  } catch {
    return [];
  }
}

function clampNumber(value, fallback, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function startPanelServer() {
  if (panelServer) return;

  panelServer = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/') return serveFile(res, path.join(panelDir, 'index.html'), 'text/html; charset=utf-8');
      if (req.method === 'GET' && url.pathname === '/panel.js') return serveFile(res, path.join(panelDir, 'panel.js'), 'text/javascript; charset=utf-8');
      if (req.method === 'GET' && url.pathname === '/style.css') return serveFile(res, path.join(panelDir, 'style.css'), 'text/css; charset=utf-8');
      if (req.method === 'GET' && url.pathname === '/api/info') return json(res, { pluginRoot, runtimeDir, configPath, panelUrl, glitchDir: defaultGlitchDir, platform: process.platform });
      if (req.method === 'GET' && url.pathname.startsWith('/assets/')) return serveSmartAsset(res, decodeURIComponent(url.pathname.slice('/assets/'.length)));
      if (req.method === 'GET' && url.pathname === '/api/smart-data') return json(res, readSmartData());
      if (req.method === 'POST' && url.pathname === '/api/smart-data') {
        const body = await readJsonBody(req);
        writeSmartData(body);
        refreshSmartButtons();
        broadcastSmartProfiles();
        return json(res, { ok: true, buttonsPath: smartButtonsPath, pagesPath: smartPagesPath, assetsPath: smartAssetsDir });
      }
      if (req.method === 'POST' && url.pathname === '/api/smart-asset') {
        const body = await readJsonBody(req);
        const saved = saveSmartAsset(body);
        return json(res, { ok: true, file: saved.file, relative: saved.relative });
      }
      if (req.method === 'GET' && url.pathname === '/api/glitch-files') return json(res, { folder: defaultGlitchDir, files: listGlitchFiles(defaultGlitchDir).map(file => path.basename(file)) });
      if (req.method === 'GET' && url.pathname === '/api/config') return json(res, readGlobalConfig());
      if (req.method === 'POST' && url.pathname === '/api/config') {
        const body = await readJsonBody(req);
        writeConfig(body);
        return json(res, { ok: true, configPath });
      }
      if (req.method === 'POST' && url.pathname === '/api/test-command') {
        const body = await readJsonBody(req);
        const command = applyTokens(body.command || '');
        const cwd = applyTokens(body.cwd || '{pluginRoot}');
        const result = await runShell(command, { cwd, timeout: Number(body.timeoutMs || 120000) });
        return json(res, result);
      }
      if (req.method === 'POST' && url.pathname === '/api/create-python-example') {
        const file = path.join(pluginRoot, 'scripts', 'examples', 'teste.py');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, 'print("Python rodou pelo botao do D200H")\n', 'utf8');
        return json(res, { ok: true, file });
      }
      if (req.method === 'POST' && url.pathname === '/api/open-folder') {
        const body = await readJsonBody(req);
        const target = body.target === 'runtime' ? runtimeDir : body.target === 'icons' ? defaultGlitchDir : pluginRoot;
        openExternalUrl(pathToFileUrl(target));
        return json(res, { ok: true, target });
      }
      return notFound(res);
    } catch (error) {
      errorJson(res, error);
    }
  });

  panelServer.listen(0, '127.0.0.1', () => {
    const address = panelServer.address();
    panelUrl = `http://127.0.0.1:${address.port}/`;
    $UD.logMessage('DeckDeckDeco panel: ' + panelUrl, 'info');
  });
}

function serveFile(res, file, type) {
  if (!fs.existsSync(file)) return notFound(res);
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(file));
}

function json(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'not found' }));
}

function errorJson(res, error) {
  res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: String(error?.message || error) }));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

async function readSnippetLines(cfg) {
  if (cfg.sourceCommand) {
    const result = await runShell(applyTokens(cfg.sourceCommand), { cwd: pluginRoot });
    const text = result.stdout || result.stderr || '';
    return toCardLines(text, Number(cfg.maxLines || 4), Number(cfg.maxCharsPerLine || 18));
  }
  if (cfg.sourceFile) {
    const file = applyTokens(cfg.sourceFile);
    return toCardLines(readTextIfExists(file), Number(cfg.maxLines || 4), Number(cfg.maxCharsPerLine || 18));
  }
  return ['NO', 'SOURCE'];
}

function pipelineFail(context, stage, result) {
  const lines = compactOutput(result.stderr || result.stdout || '').slice(0, 2);
  setCard(context, { title: stage, lines: ['FAIL', 'exit ' + result.code, ...lines], theme: 'fail' });
}

async function runPipelineCommand(command, files) {
  if (!command) return { code: 0, stdout: '', stderr: '' };
  return runShell(applyTokens(command, files), { cwd: pluginRoot });
}

async function safeRunOptionalCommand(command, context, label) {
  if (!command) return;
  const result = await runShell(applyTokens(command), { cwd: pluginRoot });
  if (result.code !== 0) {
    $UD.logMessage(`${label} failed: ${result.stderr || result.stdout}`, 'warn');
    if (context) $UD.showAlert(context);
  }
}

function runShell(command, options = {}) {
  return new Promise((resolve) => {
    if (!command) return resolve({ code: 0, stdout: '', stderr: '', signal: null, timedOut: false });
    exec(command, {
      cwd: options.cwd || pluginRoot,
      windowsHide: true,
      timeout: options.timeout || 120000,
      maxBuffer: 1024 * 1024 * 8
    }, (error, stdout, stderr) => {
      resolve({
        code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        stdout: stdout || '',
        stderr: stderr || '',
        signal: error?.signal || null,
        timedOut: Boolean(error?.killed),
        command,
        cwd: options.cwd || pluginRoot
      });
    });
  });
}


function ensureSmartData() {
  fs.mkdirSync(smartAssetsDir, { recursive: true });
  fs.mkdirSync(smartScriptsDir, { recursive: true });
  if (!fs.existsSync(smartButtonsPath)) {
    writeJsonFile(smartButtonsPath, { buttons: [
      { id: 'A', title: 'A', image: 'deck-data/assets/a.svg', action: 'none' },
      { id: 'B', title: 'PY', image: 'deck-data/assets/b.svg', action: 'command', command: 'py -3 deck-data/scripts/hello.py', cwd: '{pluginRoot}', showStatus: false },
      { id: 'TOOLS', title: 'TOOLS', image: 'deck-data/assets/folder.svg', action: 'page', targetPage: 'tools' },
      { id: 'BACK', title: 'BACK', image: 'deck-data/assets/back.svg', action: 'back' },
      { id: 'GLITCH', title: 'BUG', image: 'resources/icons/glitch.svg', action: 'glitch', folder: 'resources/glitch', durationMs: 1600, frameMs: 110, showStatus: false }
    ]});
  }
  if (!fs.existsSync(smartPagesPath)) {
    writeJsonFile(smartPagesPath, { defaultPage: 'main', pages: { main: ['A', 'B', 'TOOLS', 'GLITCH'], tools: ['BACK', 'A', 'B', 'GLITCH'] }});
  }
  const hello = path.join(smartScriptsDir, 'hello.py');
  if (!fs.existsSync(hello)) fs.writeFileSync(hello, 'print("Smart Button Python rodou no PC")\n', 'utf8');
}

function readSmartData() {
  ensureSmartData();
  const buttons = readJsonFile(smartButtonsPath, { buttons: [] });
  const pages = readJsonFile(smartPagesPath, { defaultPage: 'main', pages: { main: [] } });
  if (!pages.pages || typeof pages.pages !== 'object') pages.pages = { main: [] };
  if (!pages.defaultPage) pages.defaultPage = Object.keys(pages.pages)[0] || 'main';
  if (!currentSmartPage || !pages.pages[currentSmartPage]) currentSmartPage = pages.defaultPage;
  return { buttons: Array.isArray(buttons.buttons) ? buttons.buttons : [], pages, activePage: currentSmartPage };
}

function writeSmartData(data) {
  const buttons = Array.isArray(data?.buttons) ? data.buttons : [];
  const pages = data?.pages && typeof data.pages === 'object' ? data.pages : { defaultPage: 'main', pages: { main: [] } };
  if (!pages.defaultPage) pages.defaultPage = Object.keys(pages.pages || {})[0] || 'main';
  writeJsonFile(smartButtonsPath, { buttons });
  writeJsonFile(smartPagesPath, pages);
  if (!pages.pages?.[currentSmartPage]) currentSmartPage = pages.defaultPage;
}

function readJsonFile(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJsonFile(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + os.EOL, 'utf8');
}

function sendSmartProfilesToInspector(context) {
  const data = readSmartData();
  const profiles = data.buttons.map(button => ({
    id: String(button.id || ''),
    title: String(button.title || button.id || ''),
    image: String(button.image || button.gif || '')
  })).filter(item => item.id);
  const selected = cleanSettings(actionSettings.get(context) || {}).profileId || profiles[0]?.id || 'A';
  if (typeof $UD.sendToPropertyInspector === 'function') {
    $UD.sendToPropertyInspector({ type: 'smartProfiles', profiles, selected }, context);
  }
}

function applySmartProfileSelection(message, profileId) {
  if (!message?.context) return;
  const id = String(profileId || '').trim() || 'A';
  const settings = cleanSettings({
    ...(actionSettings.get(message.context) || {}),
    actionType: 'smartButton',
    smartMode: 'manual',
    profileId: id
  });
  actionSettings.set(message.context, settings);
  rememberActionContext({
    ...message,
    action: 'com.ulanzi.ulanzistudio.deckdeckdeco.smartButton',
    param: settings
  });
  if (typeof $UD.sendParamFromPlugin === 'function') {
    $UD.sendParamFromPlugin(settings, message.context);
  }
  setSmartButtonVisual({
    ...message,
    action: 'com.ulanzi.ulanzistudio.deckdeckdeco.smartButton',
    param: settings
  });
  sendSmartProfilesToInspector(message.context);
}

function getSmartButtonById(id) {
  const data = readSmartData();
  return data.buttons.find(button => String(button.id) === String(id));
}

function getSmartButtonForMessage(message) {
  const cfg = settingsFor(message, 'smartButton');
  const mode = cfg.smartMode || cfg.mode || 'manual';
  if (mode === 'page') {
    const slot = Math.max(1, Number(cfg.slotIndex || getSmartAutoSlot(message.context) || 1));
    const data = readSmartData();
    const list = data.pages.pages[currentSmartPage] || data.pages.pages[data.pages.defaultPage] || [];
    const id = list[slot - 1];
    return getSmartButtonById(id) || null;
  }
  return getSmartButtonById(cfg.profileId || cfg.buttonId || 'A') || getSmartButtonById('A') || null;
}

function getSmartAutoSlot(context) {
  const item = knownContexts.get(context);
  if (item?.smartSlot) return item.smartSlot;
  return 1;
}

function setSmartButtonVisual(message) {
  const button = getSmartButtonForMessage(message);
  if (!button) return setCard(message.context, { title: 'SMART', lines: ['NO', 'PROFILE'], theme: 'fail' });
  const img = resolveSafePluginPath(button.image || button.gif || '');
  if (img && fs.existsSync(img)) return setImageFile(message.context, img);
  return setCard(message.context, { title: button.title || button.id || 'SMART', lines: [button.id || 'READY'], theme: 'idle' });
}

async function runSmartButton(message) {
  rememberSettings(message);
  rememberActionContext(message);
  const button = getSmartButtonForMessage(message);
  if (!button) return setCard(message.context, { title: 'SMART', lines: ['NO', 'PROFILE'], theme: 'fail' });

  const action = String(button.action || 'none').toLowerCase();
  if (action === 'none') return setSmartButtonVisual(message);
  if (action === 'url') {
    if (button.url) {
      $UD.openUrl(button.url, false, {});
      openExternalUrl(button.url);
    }
    return maybeRestoreSmart(message, button);
  }
  if (action === 'page' || action === 'folder') {
    const data = readSmartData();
    const target = String(button.targetPage || button.page || '').trim();
    if (target && data.pages.pages[target]) {
      smartPageStack.push(currentSmartPage);
      currentSmartPage = target;
      refreshSmartButtons();
    }
    return;
  }
  if (action === 'back') {
    const data = readSmartData();
    currentSmartPage = smartPageStack.pop() || data.pages.defaultPage || 'main';
    refreshSmartButtons();
    return;
  }
  if (action === 'glitch') {
    await runSmartGlitch(button, message);
    return maybeRestoreSmart(message, button);
  }
  if (action === 'command' || action === 'script') {
    const command = applyTokens(button.command || button.script || '');
    const cwd = applyTokens(button.cwd || '{pluginRoot}');
    if (button.showStatus === true || String(button.showStatus).toLowerCase() === 'true') {
      setCard(message.context, { title: button.title || button.id || 'RUN', lines: ['RUN'], theme: 'running' });
    }
    const result = await runShell(command, { cwd, timeout: Number(button.timeoutMs || 120000) });
    if (button.showStatus === true || String(button.showStatus).toLowerCase() === 'true') {
      setCard(message.context, { title: button.title || button.id || 'RUN', lines: [result.code === 0 ? 'OK' : 'FAIL'], theme: result.code === 0 ? 'success' : 'fail' });
      setTimeout(() => setSmartButtonVisual(message), Number(button.restoreAfterMs || 900));
    } else {
      setSmartButtonVisual(message);
    }
    return;
  }
  setSmartButtonVisual(message);
}

function maybeRestoreSmart(message, button) {
  if (button.changeOnPress === true || String(button.changeOnPress).toLowerCase() === 'true') {
    setTimeout(() => setSmartButtonVisual(message), Number(button.restoreAfterMs || 900));
  } else {
    setSmartButtonVisual(message);
  }
}

function refreshSmartButtons() {
  for (const item of [...knownContexts.values()]) {
    if (item.action === 'smartButton') setSmartButtonVisual(makeMessageForContext(item));
  }
}

function broadcastSmartProfiles() {
  for (const item of [...knownContexts.values()]) {
    if (item.action === 'smartButton') sendSmartProfilesToInspector(item.context);
  }
}

async function runSmartGlitch(button, message) {
  const folder = safeGlitchFolder(button.folder || 'resources/glitch');
  const files = listGlitchFiles(folder);
  if (!files.length) return;
  const targets = [...knownContexts.values()].filter(item => item.action === 'smartButton');
  const durationMs = clampNumber(button.durationMs, 1600, 250, 30000);
  const frameMs = clampNumber(button.frameMs, 110, 50, 2000);
  const startedAt = Date.now();
  await new Promise(resolve => {
    const loop = setInterval(() => {
      for (const target of targets) {
        const file = files[Math.floor(Math.random() * files.length)];
        setImageFile(target.context, file);
      }
      if (Date.now() - startedAt >= durationMs) {
        clearInterval(loop);
        refreshSmartButtons();
        resolve();
      }
    }, frameMs);
  });
}

function resolveSafePluginPath(value) {
  if (!value) return '';
  const raw = String(value).trim().replaceAll('\\', '/').replace(/^\/+/, '');
  if (!raw || raw.includes('..')) return '';
  const target = path.resolve(pluginRoot, raw);
  if (target !== pluginRoot && !target.startsWith(pluginRoot + path.sep)) return '';
  return target;
}

function saveSmartAsset(body) {
  const name = safeFileName(body?.name || 'asset.png');
  const dataUrl = String(body?.data || '');
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('asset precisa vir como data URL base64');
  const ext = path.extname(name) || mimeToExt(match[1]);
  const baseName = safeFileName(path.basename(name, path.extname(name))) || 'asset';
  let finalName = `${baseName}_${Date.now()}${ext}`;
  let file = path.join(smartAssetsDir, finalName);
  let counter = 1;
  while (fs.existsSync(file)) {
    finalName = `${baseName}_${Date.now()}_${counter++}${ext}`;
    file = path.join(smartAssetsDir, finalName);
  }
  fs.writeFileSync(file, Buffer.from(match[2], 'base64'));
  return { file, relative: 'deck-data/assets/' + finalName, assetsDir: smartAssetsDir };
}

function safeFileName(name) {
  return String(name || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'asset';
}

function mimeToExt(mime) {
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('svg')) return '.svg';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  return '.png';
}

function serveSmartAsset(res, relative) {
  const target = resolveSafePluginPath(relative);
  if (!target || !fs.existsSync(target)) return notFound(res);
  const ext = path.extname(target).toLowerCase();
  const types = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
  return serveFile(res, target, types[ext] || 'application/octet-stream');
}

function setReadyCard(message) {
  const action = actionKey(message);
  if (action === 'smartButton') return setSmartButtonVisual(message);
  return restoreManifestIcon(message.context);
}

function flashSavedThenReady(message) {
  const action = actionKey(message);
  if (action === 'smartButton') return setSmartButtonVisual(message);
  return restoreManifestIcon(message.context);
}

function restoreManifestIcon(context) {
  if (!context) return;
  if (typeof $UD.setStateIcon === 'function') return $UD.setStateIcon(context, 0, '');
}

function setCard(context, card) {
  if (!context) return;
  const svg = renderCardSvg(card);
  const base64 = Buffer.from(svg, 'utf8').toString('base64');
  $UD.setBaseDataIcon(context, base64, '');
}

function renderCardSvg({ title = 'DECK', lines = [], theme = 'idle' }) {
  const palette = {
    idle: ['#15151d', '#8b8ba7', '#ffffff'],
    running: ['#321338', '#ff4fd8', '#ffffff'],
    success: ['#0d2c19', '#20d66b', '#ffffff'],
    fail: ['#351015', '#ff3b4f', '#ffffff'],
    info: ['#0f2038', '#4fa3ff', '#ffffff']
  }[theme] || ['#15151d', '#8b8ba7', '#ffffff'];

  const safeTitle = escapeXml(String(title).slice(0, 12).toUpperCase());
  const safeLines = lines.flatMap((line) => String(line).split('\n'))
    .filter(Boolean)
    .slice(0, 5)
    .map((line) => escapeXml(line.slice(0, 18)));

  const renderedLines = safeLines.map((line, index) => {
    const y = 82 + index * 27;
    const size = index === 0 ? 28 : 20;
    const weight = index === 0 ? 800 : 600;
    return `<text x="98" y="${y}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${palette[2]}" font-family="Arial, sans-serif">${line}</text>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="196" height="196" viewBox="0 0 196 196">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette[0]}"/>
      <stop offset="1" stop-color="#050507"/>
    </linearGradient>
  </defs>
  <rect width="196" height="196" rx="26" fill="url(#g)"/>
  <rect x="10" y="10" width="176" height="176" rx="22" fill="none" stroke="${palette[1]}" stroke-width="5"/>
  <circle cx="168" cy="28" r="8" fill="${palette[1]}"/>
  <text x="18" y="35" font-size="17" font-weight="800" fill="${palette[1]}" font-family="Arial, sans-serif">${safeTitle}</text>
  ${renderedLines}
</svg>`;
}

function rememberSettings(message) {
  if (message?.context && message?.param && typeof message.param === 'object') {
    actionSettings.set(message.context, cleanSettings(message.param));
  }
}

function rememberActionContext(message) {
  if (!message?.context) return;
  const action = actionKey(message);
  const old = knownContexts.get(message.context) || {};
  const settings = actionSettings.get(message.context) || cleanSettings(message.param || {});
  const smartSlot = old.smartSlot || (action === 'smartButton' ? Number(settings.slotIndex || ++smartContextCounter) : undefined);
  knownContexts.set(message.context, {
    context: message.context,
    action,
    smartSlot,
    settings
  });
}

function settingsFor(message, key) {
  const globalConfig = readGlobalConfig();
  const saved = cleanSettings(actionSettings.get(message.context) || message.param || {});
  return { ...(globalConfig[key] || {}), ...saved };
}

function cleanSettings(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (value === '' || value === null || typeof value === 'undefined') continue;
    out[key] = value;
  }
  return out;
}

function readGlobalConfig() {
  const target = fs.existsSync(configPath) ? configPath : exampleConfigPath;
  try { return JSON.parse(fs.readFileSync(target, 'utf8')); } catch { return {}; }
}

function writeConfig(config) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + os.EOL, 'utf8');
}

function ensureConfigFile() {
  if (!fs.existsSync(configPath) && fs.existsSync(exampleConfigPath)) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.copyFileSync(exampleConfigPath, configPath);
  }
}

function actionKey(message) {
  const uuid = message?.action || message?.uuid || '';
  const context = message?.context || '';
  const source = uuid || context;
  if (source.includes('.controlPanel')) return 'controlPanel';
  if (source.includes('.smartButton')) return 'smartButton';
  if (source.includes('.runCommand')) return 'runCommand';
  if (source.includes('.snippetCard')) return 'snippetCard';
  if (source.includes('.voiceAI')) return 'voiceAI';
  if (source.includes('.translator')) return 'translator';
  if (source.includes('.youtubeControl')) return 'youtubeControl';
  if (source.includes('.openIconFolder')) return 'openIconFolder';
  if (source.includes('.glitchFx')) return 'glitchFx';
  return 'unknown';
}

function actionName(message) {
  return actionKey(message).replace(/([A-Z])/g, ' $1').trim().toUpperCase() || 'DECK';
}

function applyTokens(text, extra = {}) {
  return String(text || '')
    .replaceAll('{pluginRoot}', pluginRoot)
    .replaceAll('{runtimeDir}', runtimeDir)
    .replaceAll('{glitchDir}', defaultGlitchDir)
    .replaceAll('{transcriptFile}', extra.transcriptFile || path.join(runtimeDir, 'transcript.txt'))
    .replaceAll('{responseFile}', extra.responseFile || path.join(runtimeDir, 'response.txt'));
}

function toCardLines(text, maxLines = 4, maxCharsPerLine = 18) {
  const raw = String(text || '').replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  const lines = raw.length ? raw : ['EMPTY'];
  return lines.slice(0, maxLines).map((line) => line.slice(0, maxCharsPerLine));
}

function compactOutput(text) { return toCardLines(text, 5, 18); }
function shortCommand(command) { return String(command).split(/[\\/]/).pop().slice(0, 18); }
function readTextIfExists(file) { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } }
function stopSnippetLoop(context) { const loop = snippetLoops.get(context); if (loop) clearInterval(loop); snippetLoops.delete(context); }
function pathToFileUrl(filePath) { return 'file:///' + filePath.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1:'); }

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function findPluginRoot(startDir) {
  let current = startDir;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(current, 'manifest.json'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  if (Utils?.getPluginPath) {
    try { return Utils.getPluginPath(); } catch {}
  }
  return path.resolve(startDir, '..');
}
