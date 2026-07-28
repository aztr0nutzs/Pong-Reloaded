'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function style() {
  return {
    setProperty(name, value) { this[name] = value; },
  };
}
function classList() {
  const values = new Set();
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    toggle(value, enabled) { if (enabled) values.add(value); else values.delete(value); },
    contains(value) { return values.has(value); },
  };
}

const drawCalls = { arcs: 0, strokes: 0, fills: 0 };
const canvasContext = {
  canvas: { width: 400, height: 900 },
  clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, setLineDash() {}, fillText() {},
  arc() { drawCalls.arcs++; },
  stroke() { drawCalls.strokes++; },
  fill() { drawCalls.fills++; },
};
const table = { getBoundingClientRect: () => ({ left: 50, top: 40, width: 244, height: 976 }) };
const elements = {
  'table-surface': table,
  ball: { style: style() },
  'ball-shadow': { style: style() },
  'aim-crosshair': { style: style(), classList: classList() },
  'power-fill': { style: style() },
  'aim-canvas': { width: 400, height: 900, getContext: () => canvasContext },
};
const context = {
  console,
  window: { state: { settings: { sensitivity: 70 } } },
  document: { getElementById: id => elements[id] || null },
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
};
context.state = context.window.state;
vm.createContext(context);
const modulesDirectory = path.resolve(__dirname, '../../main/assets/js/modules');
for (const moduleName of ['PhysicsEngine.js', 'TrajectoryPredictor.js', 'ThrowController.js', 'Renderer.js']) {
  vm.runInContext(
    fs.readFileSync(path.join(modulesDirectory, moduleName), 'utf8'),
    context,
    { filename: moduleName },
  );
}

const engine = new context.window.PhysicsEngine();
context.window.Physics = engine;
const predictor = new context.window.TrajectoryPredictor(engine);
const thrower = new context.window.ThrowController(engine, predictor);
const state = {
  ball: {
    active: true,
    position: { x: 0.305, y: 1.2, z: 0.16 },
    previousPosition: { x: 0.300, y: 1.22, z: 0.14 },
    orientation: { x: 0.8, y: -0.3, z: 1.4 },
    contactState: { type: 'bounce', cupElement: null },
    scaleDepth: 0.9,
  },
  aim: {
    crosshair: { x: 180, y: 260, show: true, locked: false },
    powerPct: 64,
    shotSolution: null,
  },
};
const beforeRender = JSON.stringify(state);
context.window.Renderer.render(state, 0.5);
assert.equal(JSON.stringify(state), beforeRender, 'rendering must not mutate physics/game state');
assert.match(elements.ball.style['--ball-spin'], /deg$/);
assert.equal(elements.ball.style['--impact-light'], '1.18');
assert.match(elements['ball-shadow'].style.filter, /^blur\([\d.]+px\)$/);
assert.ok(Number(elements['ball-shadow'].style['--contact-opacity']) < 0.82);

const controls = Object.freeze({
  targetWorldPosition: Object.freeze({ x: 0.305, y: 0.3, z: 0 }),
  requestedTarget: Object.freeze({ x: 180, y: 220 }),
  inputPull: Object.freeze({ x: 0.08, y: 0.65 }),
  power: 0.65,
  arc: 0.52,
  spin: 0.2,
});
state.aim.shotSolution = thrower.computeSolution(
  controls,
  engine.world.launchPosition('player'),
  [],
  'normal',
  0,
);
const solutionBefore = JSON.stringify(state.aim.shotSolution);
context.window.Renderer.render(state, 0.5);
assert.equal(JSON.stringify(state.aim.shotSolution), solutionBefore,
  'trajectory rendering must not mutate ShotSolution');
assert.ok(drawCalls.strokes >= 5, 'trajectory should include glow, path, target, and marker strokes');
assert.ok(drawCalls.arcs >= 2, 'trajectory should include readable target or bounce markers');
assert.ok(drawCalls.fills >= 1, 'trajectory should include a target center');

console.log('PASS: visual polish passively consumes orientation, height, contact, and trajectory state');
