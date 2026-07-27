'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const modulesDirectory = path.resolve(__dirname, '../../main/assets/js/modules');
const context = {
  console,
  window: { state: { settings: { sensitivity: 70 }, match: {} } },
  state: { settings: { sensitivity: 70 }, match: {} },
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  qsa: () => [],
};
vm.createContext(context);
for (const moduleName of ['PhysicsEngine.js', 'TrajectoryPredictor.js', 'ThrowController.js']) {
  vm.runInContext(
    fs.readFileSync(path.join(modulesDirectory, moduleName), 'utf8'),
    context,
    { filename: moduleName },
  );
}

const engine = new context.window.PhysicsEngine();
const predictor = new context.window.TrajectoryPredictor(engine);
const thrower = new context.window.ThrowController(engine, predictor);
const ballStart = engine.world.launchPosition('player');
const target = { x: 0.305, y: 0.280, z: 0 };
const requestedTarget = { x: 300, y: 200 };
const cups = [];

function controls(overrides = {}) {
  return Object.freeze({
    targetWorldPosition: Object.freeze({ ...(overrides.targetWorldPosition || target) }),
    requestedTarget: Object.freeze({ ...requestedTarget }),
    inputPull: Object.freeze({ x: 0.12, y: 0.72 }),
    power: overrides.power ?? 0.72,
    arc: overrides.arc ?? 0.55,
    spin: overrides.spin ?? 0.30,
  });
}

function solve(finalizedControls) {
  return thrower.computeSolution(finalizedControls, ballStart, cups, 'normal', 0.036);
}

const first = solve(controls());
const second = solve(controls());
assert.deepEqual(first.launchVelocity, second.launchVelocity);
assert.deepEqual(first.angularVelocity, second.angularVelocity);
assert.deepEqual(first.trajectorySamples, second.trajectorySamples);
assert.deepEqual(first.landingPosition, second.landingPosition);
assert.deepEqual(first.solverDiagnostics, second.solverDiagnostics);
assert.ok(Object.isFrozen(first));
assert.ok(Object.isFrozen(first.solverDiagnostics));
assert.equal(first.solverDiagnostics.tolerance, 0.005);
assert.ok(first.solverDiagnostics.converged, `representative shot error ${first.solverDiagnostics.targetError} must be within tolerance`);

const powerChanged = solve(controls({ power: 0.40 }));
assert.equal(powerChanged.arc, first.arc, 'power must not alter arc');
assert.equal(powerChanged.spin, first.spin, 'power must not alter spin');
assert.deepEqual(powerChanged.angularVelocity, first.angularVelocity, 'power must not alter angular velocity');

const arcChanged = solve(controls({ arc: 0.80 }));
assert.equal(arcChanged.power, first.power, 'arc must not alter power');
assert.equal(arcChanged.spin, first.spin, 'arc must not alter spin');
assert.equal(arcChanged.launchVelocity.z, thrower.MIN_VERTICAL_SPEED + 0.80 * (thrower.MAX_VERTICAL_SPEED - thrower.MIN_VERTICAL_SPEED));

const spinChanged = solve(controls({ spin: -0.60 }));
assert.equal(spinChanged.power, first.power, 'spin must not alter power');
assert.equal(spinChanged.arc, first.arc, 'spin must not alter arc');
assert.equal(spinChanged.angularVelocity.z, -0.60 * thrower.SPIN_RATE);

const targetChanged = solve(controls({ targetWorldPosition: { x: 0.420, y: 0.360, z: 0 } }));
assert.equal(targetChanged.power, first.power, 'target must not alter power');
assert.equal(targetChanged.arc, first.arc, 'target must not alter arc');
assert.equal(targetChanged.spin, first.spin, 'target must not alter spin');

const pullA = thrower.finalizePlayerControls({ x: 0, y: 0.7 }, target, requestedTarget, 0.55);
const pullB = thrower.finalizePlayerControls({ x: 0.35, y: 0.7 }, target, requestedTarget, 0.55);
assert.equal(pullA.power, pullB.power, 'lateral spin gesture must not change power');
assert.equal(pullA.arc, pullB.arc, 'lateral spin gesture must not change arc');
assert.notEqual(pullA.spin, pullB.spin);

console.log('PASS: inverse throw solver is repeatable and target/power/arc/spin controls are independent');
