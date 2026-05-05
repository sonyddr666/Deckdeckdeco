const params = new URLSearchParams(window.location.search);
const actionType = params.get('action') || inferActionFromLocation();
const form = document.querySelector('#property-inspector');
const actionInput = document.querySelector('#actionType');

actionInput.value = actionType;
showRows(actionType);

$UD.connect(actionUuid(actionType));

$UD.onAdd((message) => {
  if (message.param) Utils.setFormValue(message.param, form);
  actionInput.value = actionType;
});

$UD.onParamFromApp((message) => {
  if (message.param) Utils.setFormValue(message.param, form);
  actionInput.value = actionType;
});

form.addEventListener('change', save);
form.addEventListener('keyup', Utils.debounce(save, 250));

function save() {
  const values = Utils.getFormValue(form);
  values.actionType = actionType;
  $UD.sendParamFromPlugin(values);
}

function showRows(type) {
  for (const row of document.querySelectorAll('.dd-row')) {
    row.classList.toggle('active', row.classList.contains('for-' + type));
  }
}

function actionUuid(type) {
  return 'com.ulanzi.ulanzistudio.deckdeckdeco.' + type;
}

function inferActionFromLocation() {
  const path = window.location.pathname || '';
  if (path.includes('voice')) return 'voiceAI';
  if (path.includes('translate')) return 'translator';
  if (path.includes('youtube')) return 'youtubeControl';
  if (path.includes('snippet')) return 'snippetCard';
  return 'runCommand';
}
