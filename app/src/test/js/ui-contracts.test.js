'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const classes = new Set();
const toastElement = {
  className: '',
  textContent: '',
  removed: false,
  classList: {
    add(value) { classes.add(value); },
    remove(value) { classes.delete(value); },
  },
  remove() { this.removed = true; },
};
const stack = {
  children: [],
  appendChild(element) { this.children.push(element); },
};
const timers = [];
const context = {
  document: {
    createElement: () => toastElement,
    getElementById: id => (id === 'toast-stack' ? stack : null),
  },
  qsa: () => [],
  requestAnimationFrame: callback => callback(),
  setTimeout(callback, delay) {
    timers.push({ callback, delay });
    return timers.length;
  },
  window: {},
};
vm.createContext(context);
const source = fs.readFileSync(
  path.resolve(__dirname, '../../main/assets/js/modules/UIRenderer.js'),
  'utf8',
);
vm.runInContext(source, context, { filename: 'UIRenderer.js' });

const indexSource = fs.readFileSync(path.resolve(__dirname, '../../main/assets/index.html'), 'utf8');
const documentIds = new Set([...indexSource.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]));
for (const match of source.matchAll(/getElementById\(["']([^"']+)["']\)/g)) {
  assert.ok(documentIds.has(match[1]), `UIRenderer references missing DOM id: ${match[1]}`);
}

for (const contract of ['toast', 'showScreen', 'openPanel', 'closePanel', 'openModal', 'closeModal']) {
  assert.equal(typeof context.window[contract], 'function', `${contract} must be exported`);
}
assert.equal(typeof context.window.UIRenderer, 'function', 'UIRenderer must be exported for guarded runtime calls');

const mainSource = fs.readFileSync(path.resolve(__dirname, '../../main/assets/js/modules/Main.js'), 'utf8');
assert.match(mainSource, /function bootLoop\(time\) \{\s*if \(started\) return;/,
  'boot animation must stop after manual or automatic completion');
assert.match(mainSource, /if\(pct >= 100\)\{\s*started = true;/,
  'automatic boot completion must be claimed before scheduling menu entry');

context.window.toast('MATCH READY');
assert.equal(stack.children.length, 1);
assert.equal(toastElement.className, 'toast');
assert.equal(toastElement.textContent, 'MATCH READY');
assert.ok(classes.has('show'));
assert.equal(timers[0].delay, 1700);

timers.shift().callback();
assert.ok(!classes.has('show'));
assert.equal(timers[0].delay, 300);
timers.shift().callback();
assert.equal(toastElement.removed, true);

console.log('PASS: UI controller exports are defined and toast lifecycle is complete');
