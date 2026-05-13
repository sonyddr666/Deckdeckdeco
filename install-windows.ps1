import fs from 'fs';
import path from 'path';

const out = arg('--out') || '.deckdeckdeco/transcript.txt';
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, 'explica esse erro do terminal e me da um patch minimo\n', 'utf8');
console.log('transcript written');

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}
