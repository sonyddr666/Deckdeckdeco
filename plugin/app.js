import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

import UlanziApi, { Utils, RandomPort } from './ulanzi-api/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginRoot = findPluginRoot(__dirname);
const runtimeDir = path.join(pluginRoot, '.deckdeckdeco');
const configPath = path.join(pluginRoot, 'config', 'deckdeckdeco.config.json');
const exampleConfigPath = path.join(pluginRoot, 'config', 'deckdeckdeco.config.example.json');

fs.mkdirSync(runtimeDir, { recursive: true });

const $UD = new UlanziApi();
const randomPort = new RandomPort();
randomPort.getPort();

const actionSettings = new Map();
const snippetLoops = new Map();
const keyDownState = new Map();

$UD.connect('com.ulanzi.ulanzistudio.deckdeckdeco');

$UD.onConnected(() => {
  $UD.logMessage('DeckDeckDeco connected', 'info');
});

$UD.onAdd((message) => {
  rememberSettings(message);
  setCard(message.context, {
    title: actionName(message),
    lines: ['READY'],
    theme: 'idle'
  });
});

$UD.onParamFromApp((message) => {
  rememberSettings(message);
  setCard(message.context, {
    title: actionName(message),
    lines: ['SAVED'],
    theme: 'idle'
  });
});

$UD.onKeyDown(async (message) => {
  rememberSettings(message);
  const action = actionKey(message);
  if (action === 'voiceAI') {
    keyDownState.set(message.context, { startedAt: Date.now() });
    await safeRunOptionalCommand(settingsFor(message, action).recordStartCommand, message.context, 'REC START');
    setCard(message.context, { title: 'VOICE', lines: ['REC', 'hold...'], theme: 'running' });
  }
});

$UD.onKeyUp(async (message) => {
  rememberSettings(message);
  const action = actionKey(message);
  if (action === 'voiceAI' && keyDownState.has(message.context)) {
    keyDownState.delete(message.context);
    await runVoiceAI(message);
  }
});

$UD.onRun(async (message) => {
  rememberSettings(message);
  const action = actionKey(message);

  if (action === 'voiceAI') {
    // If host fires onRun after keyUp, avoid duplicate pipeline.
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

  const result = await runShell(command, { cwd });
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
      setCard(context, {
        title: cfg.title || 'LIVE',
        lines,
        theme: 'info'
      });
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
    exec(command, {
      cwd: options.cwd || pluginRoot,
      windowsHide: true,
      timeout: options.timeout || 120000,
      maxBuffer: 1024 * 1024 * 8
    }, (error, stdout, stderr) => {
      resolve({
        code: error && typeof error.code === 'number' ? error.code : 0,
        stdout: stdout || '',
        stderr: stderr || '',
        error
      });
    });
  });
}

function setCard(context, card) {
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
    actionSettings.set(message.context, message.param);
  }
}

function settingsFor(message, key) {
  const globalConfig = readGlobalConfig();
  const saved = actionSettings.get(message.context) || message.param || {};
  return {
    ...(globalConfig[key] || {}),
    ...(saved || {})
  };
}

function readGlobalConfig() {
  const target = fs.existsSync(configPath) ? configPath : exampleConfigPath;
  try {
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch {
    return {};
  }
}

function actionKey(message) {
  const uuid = message?.action || message?.uuid || '';
  const context = message?.context || '';
  const source = uuid || context;
  if (source.includes('.runCommand')) return 'runCommand';
  if (source.includes('.snippetCard')) return 'snippetCard';
  if (source.includes('.voiceAI')) return 'voiceAI';
  if (source.includes('.translator')) return 'translator';
  if (source.includes('.youtubeControl')) return 'youtubeControl';
  return 'unknown';
}

function actionName(message) {
  return actionKey(message).replace(/([A-Z])/g, ' $1').trim().toUpperCase() || 'DECK';
}

function applyTokens(text, extra = {}) {
  return String(text || '')
    .replaceAll('{pluginRoot}', pluginRoot)
    .replaceAll('{runtimeDir}', runtimeDir)
    .replaceAll('{transcriptFile}', extra.transcriptFile || path.join(runtimeDir, 'transcript.txt'))
    .replaceAll('{responseFile}', extra.responseFile || path.join(runtimeDir, 'response.txt'));
}

function toCardLines(text, maxLines = 4, maxCharsPerLine = 18) {
  const raw = String(text || '').replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  const lines = raw.length ? raw : ['EMPTY'];
  return lines.slice(0, maxLines).map((line) => line.slice(0, maxCharsPerLine));
}

function compactOutput(text) {
  return toCardLines(text, 5, 18);
}

function shortCommand(command) {
  return String(command).split(/[\\/]/).pop().slice(0, 18);
}

function readTextIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function stopSnippetLoop(context) {
  const loop = snippetLoops.get(context);
  if (loop) clearInterval(loop);
  snippetLoops.delete(context);
}

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
