const params = new URLSearchParams(window.location.search);
const actionType = params.get('action') || window.DD_ACTION || inferActionFromLocation();
const form = document.querySelector('#property-inspector');
const actionInput = document.querySelector('#actionType');
const conn = document.querySelector('#conn');
const saveState = document.querySelector('#save');
const title = document.querySelector('#title');
const help = document.querySelector('#help');

actionInput.value = actionType;
showRows(actionType);
setHeader(actionType);

try {
  $UD.connect(actionUuid(actionType));
  conn.textContent = 'conectando';
} catch (error) {
  conn.textContent = 'erro SDK';
  saveState.textContent = String(error.message || error);
}

$UD.onConnected(() => {
  conn.textContent = 'conectado';
  saveState.textContent = 'pronto';
  saveState.className = 'ok';
  if ($UD.getSettings) $UD.getSettings();
});

$UD.onAdd((message) => hydrate(message));
$UD.onParamFromApp((message) => hydrate(message));
if ($UD.onDidReceiveSettings) $UD.onDidReceiveSettings((message) => hydrate(message));

form.addEventListener('change', save);
form.addEventListener('keyup', debounce(save, 260));

document.querySelector('#openPanel').addEventListener('click', () => {
  sendToPlugin({ type: 'openPanel' });
  saveState.textContent = 'abrindo painel';
  saveState.className = 'ok';
});

document.querySelector('#openIcons').addEventListener('click', () => {
  sendToPlugin({ type: 'openIconFolder' });
  saveState.textContent = 'abrindo icones';
  saveState.className = 'ok';
});

document.querySelector('#examplePy').addEventListener('click', () => {
  if (actionType !== 'runCommand') return;
  setFormValue({ title: 'PY', command: 'py -3 scripts/examples/teste.py', cwd: '{pluginRoot}', runningLabel: 'RUN', successLabel: 'OK', failLabel: 'FAIL' });
  save();
});

document.querySelector('#exampleNode').addEventListener('click', () => {
  if (actionType !== 'runCommand') return;
  setFormValue({ title: 'NODE', command: 'node scripts/examples/fake-test.mjs', cwd: '{pluginRoot}', runningLabel: 'RUN', successLabel: 'OK', failLabel: 'FAIL' });
  save();
});

if (actionType !== 'runCommand') {
  document.querySelector('#examplePy').classList.add('hidden');
  document.querySelector('#exampleNode').classList.add('hidden');
}

function hydrate(message) {
  const payload = message?.settings || message?.param || message?.payload || {};
  if (payload && typeof payload === 'object') {
    setFormValue(payload);
  }
  actionInput.value = actionType;
}

function save() {
  const values = getFormValue();
  values.actionType = actionType;
  sendParam(values);
  saveState.textContent = 'salvando';
  saveState.className = 'warn';
  setTimeout(() => {
    saveState.textContent = 'salvo';
    saveState.className = 'ok';
  }, 180);
}

function sendParam(values) {
  if ($UD.sendParamFromPlugin) return $UD.sendParamFromPlugin(values);
  if ($UD.setSettings) return $UD.setSettings(values);
}

function sendToPlugin(payload) {
  if ($UD.sendToPlugin) return $UD.sendToPlugin(payload);
  if ($UD.openUrl) return $UD.openUrl('http://127.0.0.1:39177/', false, {});
}

function showRows(type) {
  for (const row of document.querySelectorAll('.row')) {
    row.classList.toggle('active', row.classList.contains('for-' + type));
  }
}

function setHeader(type) {
  const names = {
    controlPanel: ['Control Panel', 'Aperte a tecla fisica para abrir a pagina grande. Clique no botao abaixo para tentar abrir pelo inspector.'],
    smartButton: ['Smart Button', 'Escolha um perfil A/B/C criado no painel web ou use modo pagina com slotIndex. O icone nao muda sozinho.'],
    runCommand: ['Run Command', 'Aqui vai o comando real que roda no PC. Mouse no Studio edita, botao fisico executa.'],
    snippetCard: ['Snippet Card', 'Mostra texto curto vindo de comando ou arquivo. Aperte a tecla para ligar/desligar.'],
    voiceAI: ['Voice AI', 'Pipeline de voz: STT, LLM e TTS.'],
    translator: ['Translator', 'Pipeline de traducao: STT, traduzir e TTS.'],
    youtubeControl: ['YouTube Control', 'Abre ou controla YouTube no PC.'],
    openIconFolder: ['Open Icon Folder', 'Abre a pasta segura resources/glitch para trocar/adicionar icones.'],
    glitchFx: ['Glitch FX', 'Efeito temporario: troca icones dos botoes DeckDeckDeco e depois restaura.']
  };
  const [name, text] = names[type] || names.runCommand;
  title.textContent = name;
  help.textContent = text;
}

function actionUuid(type) {
  return 'com.ulanzi.ulanzistudio.deckdeckdeco.' + type;
}

function inferActionFromLocation() {
  const path = window.location.pathname || '';
  if (path.includes('smartButton')) return 'smartButton';
  if (path.includes('controlPanel')) return 'controlPanel';
  if (path.includes('voiceAI')) return 'voiceAI';
  if (path.includes('translator')) return 'translator';
  if (path.includes('youtubeControl')) return 'youtubeControl';
  if (path.includes('openIconFolder')) return 'openIconFolder';
  if (path.includes('glitchFx')) return 'glitchFx';
  if (path.includes('snippetCard')) return 'snippetCard';
  return 'runCommand';
}

function getFormValue() {
  const values = {};
  for (const item of form.querySelectorAll('[name]')) {
    if (item.type === 'hidden') continue;
    if (!item.closest('.row.active')) continue;
    if (item.value === '') continue;
    values[item.name] = item.type === 'number' ? Number(item.value) : item.value;
  }
  return values;
}

function setFormValue(values) {
  for (const item of form.querySelectorAll('[name]')) {
    if (Object.prototype.hasOwnProperty.call(values, item.name)) item.value = values[item.name] ?? '';
  }
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
