'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const modulesDirectory = path.resolve(__dirname, '../../main/assets/js/modules');
const context = {
  console,
  performance: { now: () => 16 },
  window: { state: { settings: { sensitivity: 70 }, match: { spin: true, trickArmed: false } } },
  state: { settings: { sensitivity: 70 }, match: { spin: true, trickArmed: false } },
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  qsa: () => [],
  document: { getElementById: () => null },
};
context.window.window = context.window;
vm.createContext(context);

for (const moduleName of ['PhysicsEngine.js', 'TrajectoryPredictor.js', 'ThrowController.js', 'Renderer.js']) {
  const source = fs.readFileSync(path.join(modulesDirectory, moduleName), 'utf8');
  vm.runInContext(source, context, { filename: moduleName });
}

const PhysicsEngine = context.window.PhysicsEngine;
const Renderer = context.window.Renderer;
const engine = new PhysicsEngine();
context.window.Physics = engine;
const predictor = new context.window.TrajectoryPredictor(engine);
const thrower = new context.window.ThrowController(engine, predictor);

assert.equal(engine.world.geometry.ball.diameter, 0.040);
assert.equal(engine.world.geometry.ball.radius, 0.020);
assert.equal(engine.world.geometry.ball.mass, 0.0027);
assert.equal(engine.GRAVITY, 9.80665);
assert.equal(engine.world.geometry.table.width, 0.610);
assert.equal(engine.world.geometry.table.length, 2.440);

const smallRenderBounds = { left: 10, top: 20, width: 244, height: 976 };
smallRenderBounds.right = smallRenderBounds.left + smallRenderBounds.width;
smallRenderBounds.bottom = smallRenderBounds.top + smallRenderBounds.height;
const largeRenderBounds = { left: 80, top: 120, width: 610, height: 2440 };
largeRenderBounds.right = largeRenderBounds.left + largeRenderBounds.width;
largeRenderBounds.bottom = largeRenderBounds.top + largeRenderBounds.height;

const smallTargetScreen = { x: 132, y: 140 };
const largeTargetScreen = { x: 385, y: 420 };
const smallPullScreen = { x: 24.4, y: 390.4 };
const largePullScreen = { x: 61, y: 976 };

const smallTargetWorld = Renderer.screenToWorld(smallTargetScreen, smallRenderBounds);
const largeTargetWorld = Renderer.screenToWorld(largeTargetScreen, largeRenderBounds);
const smallControlPull = Renderer.screenPullToControl(smallPullScreen, smallRenderBounds);
const largeControlPull = Renderer.screenPullToControl(largePullScreen, largeRenderBounds);

assert.deepEqual(smallTargetWorld, largeTargetWorld);
assert.deepEqual(smallControlPull, largeControlPull);

const cupElements = Array.from({ length: 10 }, (_, index) => ({
  dataset: { team: 'ai', idx: String(index) },
  getBoundingClientRect() {
    throw new Error('Physics must not read rendering geometry');
  },
}));
const cups = engine.parseCups(cupElements, 'normal');
assert.equal(cups.length, 10);
assert.equal(cups[0].colliders.outerTopR, engine.world.geometry.cup.outerTopRadius);

function solve(targetWorld, requestedTarget, controlPull) {
  const controls = thrower.finalizePlayerControls(controlPull, targetWorld, requestedTarget);
  return thrower.computeSolution(
    controls,
    engine.world.launchPosition('player'),
    cupElements,
    'normal',
    0,
  );
}

const smallSolution = solve(smallTargetWorld, smallTargetScreen, smallControlPull);
const largeSolution = solve(largeTargetWorld, largeTargetScreen, largeControlPull);

assert.equal(smallSolution.predictedOutcome, largeSolution.predictedOutcome);
assert.deepEqual(smallSolution.launchPosition, largeSolution.launchPosition);
assert.deepEqual(smallSolution.launchVelocity, largeSolution.launchVelocity);
assert.deepEqual(smallSolution.angularVelocity, largeSolution.angularVelocity);
assert.deepEqual(smallSolution.targetWorldPosition, largeSolution.targetWorldPosition);
assert.deepEqual(smallSolution.landingPosition, largeSolution.landingPosition);
assert.deepEqual(smallSolution.trajectorySamples, largeSolution.trajectorySamples);
assert.deepEqual(smallSolution.bounceEvents, largeSolution.bounceEvents);
assert.equal(smallSolution.impactVelocity, largeSolution.impactVelocity);

console.log('PASS: SI world geometry and shot outcomes are invariant across rendering dimensions');
