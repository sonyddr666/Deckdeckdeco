const now = new Date();
const states = ['AI THINK', 'BUILD OK', 'AUTH BUG', 'Docker UP', 'PR READY'];
const state = states[Math.floor(now.getSeconds() / 12) % states.length];

console.log(state);
console.log(now.toLocaleTimeString());
console.log('branch: main');
console.log('deck: live');
