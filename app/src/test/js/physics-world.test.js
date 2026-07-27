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

const authoritativeBounds = engine.world.geometry.table.bounds;
const irrelevantRenderBounds = { left: 1000, right: 1001, top: 1000, bottom: 1001 };

function physicsState(overrides) {
  return engine.createSimulationState({
    x: authoritativeBounds.width / 2,
    y: authoritativeBounds.height / 2,
    z: 0.20,
    vx: 0,
    vy: 0,
    vz: 0,
    ...overrides,
  });
}

function stepState(state, count = 1) {
  for (let step = 0; step < count && !state.settled; step++) {
    engine.stepFixed(state, irrelevantRenderBounds, [], 0);
  }
  return state;
}

function stepUntil(state, predicate, limit = 2000) {
  for (let step = 0; step < limit && !predicate(state); step++) stepState(state);
  assert.ok(predicate(state), `condition was not reached after ${limit} fixed steps`);
  return state;
}

const verticalBounce = physicsState({ vz: -2 });
stepUntil(verticalBounce, state => state.event === 'bounce');
assert.ok(verticalBounce.z >= engine.world.geometry.table.surfaceHeight,
  'continuous table collision must leave the ball above the surface');
const verticalIdealImpactSpeed = Math.sqrt(2 * 2 + 2 * engine.GRAVITY * 0.20);
assert.ok(verticalBounce.vz > 0 && verticalBounce.vz < verticalIdealImpactSpeed,
  'vertical restitution must return a smaller upward speed without tunneling');
assert.equal(verticalBounce.vx, 0);
assert.equal(verticalBounce.vy, 0);

const angledBounce = physicsState({ vx: 0.8, vy: -0.35, vz: -2 });
const angledHorizontalBefore = Math.hypot(angledBounce.vx, angledBounce.vy);
stepUntil(angledBounce, state => state.event === 'bounce');
assert.ok(angledBounce.vz > 0 && angledBounce.vz < verticalIdealImpactSpeed);
assert.ok(Math.hypot(angledBounce.vx, angledBounce.vy) < angledHorizontalBefore,
  'table friction must dissipate tangential speed on an angled impact');
assert.ok(angledBounce.vx > 0 && angledBounce.vy < 0,
  'an angled bounce must preserve direction when friction cannot stop the slip');

const noSpinBounce = physicsState({ vz: -2 });
const spinBounce = physicsState({ vz: -2, angularVelocityY: 80 });
stepUntil(noSpinBounce, state => state.event === 'bounce');
stepUntil(spinBounce, state => state.event === 'bounce');
assert.ok(spinBounce.vx > noSpinBounce.vx,
  'surface friction must convert controlled horizontal-axis spin into bounce direction');
assert.ok(spinBounce.vx < engine.SLIDE_FRICTION * (1 + engine.TABLE_BOUNCE_E) * 2,
  'spin coupling must remain bounded by the available normal impulse');

const lowEnergyLanding = physicsState({ z: 0.001, vz: -0.03 });
stepUntil(lowEnergyLanding, state => state.settled, 20);
assert.equal(lowEnergyLanding.z, engine.world.geometry.table.surfaceHeight);
assert.equal(lowEnergyLanding.vz, 0);
assert.equal(lowEnergyLanding.bounces, 0, 'low-energy contact must not jitter into a bounce');
assert.equal(lowEnergyLanding.settled, true);
assert.equal(lowEnergyLanding.surfaceState, 'settled');

const rolling = physicsState({ z: 0, vx: 0.08 });
let previousRollingSpeed = Math.hypot(rolling.vx, rolling.vy);
for (let step = 0; step < 1000 && !rolling.settled; step++) {
  stepState(rolling);
  const speed = Math.hypot(rolling.vx, rolling.vy);
  assert.ok(speed <= previousRollingSpeed + 1e-12, 'rolling resistance must never add energy');
  previousRollingSpeed = speed;
}
assert.equal(rolling.settled, true, 'rolling must damp to a finite settled state');
assert.equal(rolling.vx, 0);
assert.equal(rolling.vz, 0);

const edgeDeparture = physicsState({ x: authoritativeBounds.right - 0.001, z: 0, vx: 0.5 });
stepUntil(edgeDeparture, state => state.x > authoritativeBounds.right, 20);
stepState(edgeDeparture, 5);
assert.equal(edgeDeparture.offTable, true);
assert.equal(edgeDeparture.onTable, false);
assert.ok(edgeDeparture.vx > 0, 'a departing ball must not reflect from an imaginary table rail');
assert.ok(edgeDeparture.z < engine.world.geometry.table.surfaceHeight,
  'a departed ball must fall instead of hovering at tabletop height');
assert.equal(edgeDeparture.settled, false, 'off-table flight must not settle before reaching the ground');

console.log('PASS: SI world geometry, stable table response, and render-invariant outcomes');
