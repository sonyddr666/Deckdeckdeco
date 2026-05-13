let config = {};
let smart = { buttons: [], pages: { defaultPage: 'main', pages: { main: [] } }, activePage: 'main' };
let selectedButtonId = '';
let savingSmart = false;
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

init().catch(err => showStatus('Falhou: ' + err.message, true));

async function init(){
  bind();
  await loadAll();
}

function bind(){
  $$('.tab').forEach(btn => btn.onclick = () => switchTab(btn.dataset.tab));
  $('#saveSmart').onclick = saveSmart;
  $('#reloadSmart').onclick = loadSmart;
  $('#openFolder').onclick = () => api('/api/open-folder', { method:'POST', body:{ target:'plugin' }}).then(()=>showStatus('Abrindo pasta do plugin...'));
  $('#createPy').onclick = () => api('/api/create-python-example', { method:'POST' }).then(r=>showStatus('teste.py criado em ' + r.file));
  $('#addButton').onclick = addButton;
  $('#applyButton').onclick = applyButtonForm;
  $('#deleteButton').onclick = deleteButton;
  $('#uploadAsset').onclick = uploadAsset;
  $('#addPage').onclick = addPage;
  $('#deletePage').onclick = deletePage;
  $('#pageSelect').onchange = renderSlots;
  $('#applySmartRaw').onclick = () => { smart = JSON.parse($('#rawSmartText').value); renderAll(); showStatus('Smart JSON aplicado na tela. Clique em salvar.'); };
  $('#saveConfig').onclick = saveConfig;
  $('#reloadConfig').onclick = loadConfig;
  $('#applyConfigRaw').onclick = () => { config = JSON.parse($('#rawConfigText').value); showStatus('Config antiga aplicada. Clique em salvar config antiga.'); };
  ['btnId','btnTitle','btnImage','btnAction','btnCommand','btnUrl','btnTargetPage','btnShowStatus','btnDuration','btnFrame'].forEach(id => $('#'+id).addEventListener('input', updatePreview));
}

async function loadAll(){
  await Promise.all([loadSmart(), loadConfig()]);
}

async function loadSmart(){
  smart = await api('/api/smart-data');
  selectedButtonId = smart.buttons[0]?.id || '';
  renderAll();
  showStatus('Smart Buttons carregados. Arquivos: deck-data/buttons.json e deck-data/pages.json');
}

async function saveSmart(){
  collectSlots();
  applyButtonForm(false, false);
  await saveSmartNow();
}

async function saveSmartNow(message='Salvo e deck atualizado.'){
  if (savingSmart) return;
  savingSmart = true;
  try {
    collectSlots();
    const result = await api('/api/smart-data', { method:'POST', body:{ buttons: smart.buttons, pages: smart.pages }});
    renderAll();
    showStatus(message + ' Arquivo: ' + result.buttonsPath);
  } finally {
    savingSmart = false;
  }
}

async function loadConfig(){
  config = await api('/api/config');
  $('#rawConfigText').value = JSON.stringify(config, null, 2);
}

async function saveConfig(){
  config = JSON.parse($('#rawConfigText').value || '{}');
  const result = await api('/api/config', { method:'POST', body: config });
  showStatus('Config antiga salva: ' + result.configPath);
}

function renderAll(){
  renderButtonList();
  renderButtonForm();
  renderPageSelect();
  renderSlots();
  $('#rawSmartText').value = JSON.stringify({ buttons: smart.buttons, pages: smart.pages }, null, 2);
  $('#rawConfigText').value = JSON.stringify(config, null, 2);
}

function renderButtonList(){
  const list = $('#buttonList');
  list.innerHTML = '';
  for (const btn of smart.buttons){
    const item = document.createElement('button');
    item.className = 'listItem' + (btn.id === selectedButtonId ? ' active' : '');
    item.textContent = `${btn.id} · ${btn.title || ''} · ${btn.action || 'none'}`;
    item.onclick = () => { selectedButtonId = btn.id; renderAll(); };
    list.appendChild(item);
  }
}

function renderButtonForm(){
  const btn = smart.buttons.find(b => b.id === selectedButtonId) || {};
  $('#btnId').value = btn.id || '';
  $('#btnTitle').value = btn.title || '';
  $('#btnImage').value = btn.image || btn.gif || '';
  $('#btnAction').value = btn.action || 'none';
  $('#btnCommand').value = btn.command || btn.script || '';
  $('#btnUrl').value = btn.url || '';
  $('#btnTargetPage').value = btn.targetPage || '';
  $('#btnShowStatus').value = String(btn.showStatus === true);
  $('#btnDuration').value = btn.durationMs || '';
  $('#btnFrame').value = btn.frameMs || '';
  updatePreview();
}

function updatePreview(){
  const img = $('#btnImage').value.trim();
  const title = $('#btnTitle').value || $('#btnId').value || 'SMART';
  const preview = $('#previewBox');
  if (img) preview.innerHTML = `<img src="/assets/${encodeURIComponent(img)}" onerror="this.style.display='none'"/><strong>${escapeHtml(title)}</strong>`;
  else preview.innerHTML = `<strong>${escapeHtml(title)}</strong>`;
}

function applyButtonForm(show=true, autosave=true){
  const id = $('#btnId').value.trim() || selectedButtonId || 'A';
  const next = {
    id,
    title: $('#btnTitle').value.trim() || id,
    image: $('#btnImage').value.trim(),
    action: $('#btnAction').value,
    showStatus: $('#btnShowStatus').value === 'true'
  };
  if ($('#btnCommand').value.trim()) next.command = $('#btnCommand').value.trim();
  if ($('#btnUrl').value.trim()) next.url = $('#btnUrl').value.trim();
  if ($('#btnTargetPage').value.trim()) next.targetPage = $('#btnTargetPage').value.trim();
  if ($('#btnDuration').value) next.durationMs = Number($('#btnDuration').value);
  if ($('#btnFrame').value) next.frameMs = Number($('#btnFrame').value);
  const idx = smart.buttons.findIndex(b => b.id === selectedButtonId || b.id === id);
  if (idx >= 0) smart.buttons[idx] = next; else smart.buttons.push(next);
  selectedButtonId = id;
  renderAll();
  if (show) showStatus('Perfil aplicado. Salvando em deck-data/buttons.json...');
  if (autosave) saveSmartNow('Perfil salvo e enviado para o deck.');
}

function addButton(){
  const id = uniqueId('BTN');
  smart.buttons.push({ id, title: id, image: '', action: 'none' });
  selectedButtonId = id;
  renderAll();
}

function deleteButton(){
  smart.buttons = smart.buttons.filter(b => b.id !== selectedButtonId);
  for (const page of Object.values(smart.pages.pages || {})) {
    for (let i=0;i<page.length;i++) if (page[i] === selectedButtonId) page[i] = '';
  }
  selectedButtonId = smart.buttons[0]?.id || '';
  renderAll();
}

function renderPageSelect(){
  const sel = $('#pageSelect');
  const current = sel.value || smart.pages.defaultPage || 'main';
  sel.innerHTML = Object.keys(smart.pages.pages || {}).map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  sel.value = smart.pages.pages[current] ? current : (smart.pages.defaultPage || Object.keys(smart.pages.pages || {})[0]);
}

function renderSlots(){
  const pageName = $('#pageSelect').value || smart.pages.defaultPage || 'main';
  const arr = smart.pages.pages[pageName] || (smart.pages.pages[pageName] = []);
  const box = $('#slots');
  box.innerHTML = '';
  for (let i=0;i<15;i++){
    const row = document.createElement('div');
    row.className = 'slotRow';
    row.innerHTML = `<span>Slot ${i+1}</span><select data-slot="${i}"><option value="">vazio</option>${smart.buttons.map(b=>`<option value="${escapeHtml(b.id)}">${escapeHtml(b.id)} · ${escapeHtml(b.title || '')}</option>`).join('')}</select>`;
    row.querySelector('select').value = arr[i] || '';
    box.appendChild(row);
  }
}

function collectSlots(){
  const pageName = $('#pageSelect').value || smart.pages.defaultPage || 'main';
  if (!pageName) return;
  smart.pages.pages[pageName] = $$('[data-slot]').map(sel => sel.value || '');
}

function addPage(){
  collectSlots();
  const name = prompt('Nome da página virtual:', 'tools' + Object.keys(smart.pages.pages || {}).length);
  if (!name) return;
  smart.pages.pages[name] = [];
  if (!smart.pages.defaultPage) smart.pages.defaultPage = name;
  renderAll();
}

function deletePage(){
  const name = $('#pageSelect').value;
  if (!name || name === smart.pages.defaultPage) return showStatus('Não apaga a página default.', true);
  delete smart.pages.pages[name];
  renderAll();
}

async function uploadAsset(){
  const file = $('#assetFile').files[0];
  if (!file) return showStatus('Escolhe uma imagem/GIF primeiro.', true);
  const data = await fileToDataUrl(file);
  const result = await api('/api/smart-asset', { method:'POST', body:{ name:file.name, data }});
  $('#btnImage').value = result.relative;
  updatePreview();
  showStatus('Imagem salva em pasta do plugin: ' + result.relative + '. Aplicando perfil...');
  applyButtonForm(false, true);
}

function switchTab(id){
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  $$('.card').forEach(c => c.classList.toggle('active', c.id === id));
}

async function api(path, options = {}){
  const fetchOptions = { method: options.method || 'GET', headers: {} };
  if (options.body){ fetchOptions.headers['Content-Type'] = 'application/json'; fetchOptions.body = JSON.stringify(options.body); }
  const res = await fetch(path, fetchOptions);
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new Error(data.error || 'API fail');
  return data;
}

function fileToDataUrl(file){
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
}
function uniqueId(prefix){ let n=1; while(smart.buttons.some(b => b.id === prefix+n)) n++; return prefix+n; }
function escapeHtml(value){ return String(value ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function showStatus(message, bad=false){ const el = $('#status'); el.textContent = message; el.style.color = bad ? 'var(--red)' : 'var(--muted)'; }
