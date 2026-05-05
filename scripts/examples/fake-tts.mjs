import fs from 'fs';

const input = arg('--in') || '.deckdeckdeco/response.txt';
const text = read(input).trim() || 'No response to speak.';
console.log('TTS would speak:');
console.log(text);

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}
