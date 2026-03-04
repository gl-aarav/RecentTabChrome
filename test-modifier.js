let modifiers = new Set();
window.addEventListener('keydown', e => modifiers.add(e.key), true);
window.addEventListener('keyup', e => modifiers.delete(e.key), true);
console.log(modifiers);
