'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const FLOAT_TOLERANCE = 1e-12;
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
  vm.runInContext(fs.readFileSync(path.join(modulesDirectory, moduleName), 'utf8'), context, { filename: moduleName });
}

const engine = new context.window.PhysicsEngine();
const predictor = new context.window.TrajectoryPredictor(engine);
const thrower = new context.window.ThrowController(engine, predictor);
const cupElements = Array.from({ length: 10 }, (_, index) => ({
  dataset: { team: 'ai', idx: String(index) },
}));
const target = engine.world.geometry.cupPosition('ai', 5);
const controls = Object.freeze({
  targetWorldPosition: target,
  requestedTarget: Object.freeze({ x: 320, y: 240 }),
  inputPull: Object.freeze({ x: 0.08, y: 0.72 }),
  power: 0.72,
  arc: 0.55,
  spin: 0.20,
});
const solution = thrower.computeSolution(
  controls,
  engine.world.launchPosition('player'),
  cupElements,
  'normal',
  0.036,
);

const prediction = predictor.predictShot(solution);
const live = engine.createSimulationFromShot(solution);
const liveSamples = [{ x: live.x, y: live.y, z: Math.max(0, live.z), event: null }];
while (!live.settled) {
  engine.stepSimulation(live);
  liveSamples.push({ x: live.x, y: live.y, z: Math.max(0, live.z), event: live.event });
}

function assertClose(actual, expected, label) {
  const difference = Math.abs(actual - expected);
  assert.ok(difference <= FLOAT_TOLERANCE, `${label} differs by ${difference}`);
}

assert.equal(liveSamples.length, prediction.samples.length);
assert.equal(solution.trajectorySamples.length, prediction.samples.length);
for (let index = 0; index < liveSamples.length; index++) {
  assertClose(liveSamples[index].x, prediction.samples[index].x, `samples[${index}].x`);
  assertClose(liveSamples[index].y, prediction.samples[index].y, `samples[${index}].y`);
  assertClose(liveSamples[index].z, prediction.samples[index].z, `samples[${index}].z`);
  assert.equal(liveSamples[index].event, prediction.samples[index].event, `samples[${index}].event`);
  assertClose(solution.trajectorySamples[index].x, prediction.samples[index].x, `solution.samples[${index}].x`);
  assertClose(solution.trajectorySamples[index].y, prediction.samples[index].y, `solution.samples[${index}].y`);
  assertClose(solution.trajectorySamples[index].z, prediction.samples[index].z, `solution.samples[${index}].z`);
  assert.equal(solution.trajectorySamples[index].event, prediction.samples[index].event, `solution.samples[${index}].event`);
}

const liveBounceEvents = liveSamples.filter((sample) => sample.event === 'bounce' || sample.event === 'floor-bounce');
const liveCupEvents = liveSamples.filter((sample) => context.window.PhysicsEngine.CUP_EVENTS.includes(sample.event));
assert.deepEqual(liveBounceEvents.map((sample) => sample.event), Array.from(prediction.bouncePoints, (sample) => sample.event));
assert.deepEqual(liveCupEvents.map((sample) => sample.event), Array.from(prediction.cupIntersections, (sample) => sample.event));
assert.equal(live.outcome, prediction.outcome);
assert.equal(live.hitCupEl, prediction.hitCupEl);
assertClose(live.x, prediction.finalX, 'final.x');
assertClose(live.y, prediction.finalY, 'final.y');
assertClose(Math.max(0, live.z), prediction.finalZ, 'final.z');
assert.ok(liveBounceEvents.length > 0, 'parity fixture must exercise table bounce events');
assert.ok(liveCupEvents.length > 0, 'parity fixture must exercise cup collision events');

console.log(`PASS: prediction/live positions and events match within ${FLOAT_TOLERANCE}`);
