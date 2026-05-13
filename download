const shouldFail = process.argv.includes('--fail') || Math.random() < 0.25;

await sleep(900);

if (shouldFail) {
  console.error('auth.spec.ts');
  console.error('3 failed');
  process.exit(1);
}

console.log('all tests passed');
console.log('12.4s');
process.exit(0);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
