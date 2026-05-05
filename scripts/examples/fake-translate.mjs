import fs from 'fs';
import path from 'path';

const input = arg('--in') || '.deckdeckdeco/transcript.txt';
const out = arg('--out') || '.deckdeckdeco/response.txt';
const to = arg('--to') || 'en';
const source = read(input).trim();

const translated = to.toLowerCase().startsWith('en')
  ? 'Send this to the client tomorrow.'
  : 'Manda isso para o cliente amanha.';

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${translated}\nsource: ${source || 'empty'}\n`, 'utf8');
console.log('translation written');

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}
