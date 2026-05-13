import fs from 'fs';
import path from 'path';

const input = arg('--in') || '.deckdeckdeco/transcript.txt';
const out = arg('--out') || '.deckdeckdeco/response.txt';
const prompt = read(input).trim();

const response = [
  'FIX READY',
  'auth middleware',
  'check JWT',
  prompt ? 'prompt ok' : 'no prompt'
].join('\n');

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, response + '\n', 'utf8');
console.log('llm response written');

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}
