'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const NUMERICAL_TOLERANCE = 1e-12;
const physicsSource = fs.readFileSync(
  path.resolve(__dirname, '../../main/assets/js/modules/PhysicsEngine.js'),
  'utf8',
);

function loadPhysicsEngine() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(physicsSource, context, { filename: 'PhysicsEngine.js' });
  return context.window.PhysicsEngine;
}

function runSchedule(frameCount, frameDelta) {
  const PhysicsEngine = loadPhysicsEngine();
  const engine = new PhysicsEngine();
  const initialState = {
    x: 0.305,
    y: 2.200,
    z: 0.080,
    vx: 0.120,
    vy: -1.450,
    vz: 1.100,
    angularVelocityX: 3.2,
    angularVelocityY: -0.4,
    angularVelocityZ: 1.7,
  };
  const simulation = engine.startLiveSimulation(
    initialState,
    [],
    engine.world.geometry.table.bounds,
    'normal',
    0.036,
    null,
    null,
  );

  let lastClockResult = null;
  for (let frame = 0; frame < frameCount; frame++) {
    lastClockResult = engine.advanceFrame(frameDelta);
  }
  return { engine, simulation, lastClockResult };
}

function assertClose(actual, expected, label) {
  const difference = Math.abs(actual - expected);
  assert.ok(
    difference <= NUMERICAL_TOLERANCE,
    `${label}: expected ${expected}, received ${actual}, difference ${difference}`,
  );
}

function assertVectorClose(actual, expected, label) {
  assertClose(actual.x, expected.x, `${label}.x`);
  assertClose(actual.y, expected.y, `${label}.y`);
  assertClose(actual.z, expected.z, `${label}.z`);
}

const at120Fps = runSchedule(240, 1 / 120);
const at60Fps = runSchedule(120, 1 / 60);
const at40Fps = runSchedule(80, 1 / 40);
const repeated = runSchedule(240, 1 / 120);

for (const candidate of [at60Fps, at40Fps, repeated]) {
  assertVectorClose(candidate.simulation.position, at120Fps.simulation.position, 'position');
  assertVectorClose(candidate.simulation.previousPosition, at120Fps.simulation.previousPosition, 'previousPosition');
  assertVectorClose(candidate.simulation.velocity, at120Fps.simulation.velocity, 'velocity');
  assertVectorClose(candidate.simulation.angularVelocity, at120Fps.simulation.angularVelocity, 'angularVelocity');
  assertVectorClose(candidate.simulation.orientation, at120Fps.simulation.orientation, 'orientation');
  assert.equal(candidate.simulation.airborne, at120Fps.simulation.airborne);
  assert.equal(candidate.simulation.contactState.type, at120Fps.simulation.contactState.type);
  assert.equal(candidate.simulation.outcome, at120Fps.simulation.outcome);
  assert.equal(candidate.simulation.bounces, at120Fps.simulation.bounces);
  assertClose(candidate.engine.world.simulatedTime, at120Fps.engine.world.simulatedTime, 'simulatedTime');
}

assert.ok(at120Fps.simulation.position);
assert.ok(at120Fps.simulation.previousPosition);
assert.ok(at120Fps.simulation.velocity);
assert.ok(at120Fps.simulation.angularVelocity);
assert.ok(at120Fps.simulation.orientation);
assert.equal(typeof at120Fps.simulation.airborne, 'boolean');
assert.ok(at120Fps.simulation.contactState);
assert.ok(Array.isArray(at120Fps.simulation.activeContacts));

const PhysicsEngine = loadPhysicsEngine();
const overloadedEngine = new PhysicsEngine();
let executedSteps = 0;
const overloadResult = overloadedEngine.world.advanceFrame(1, () => {
  executedSteps++;
});
assert.equal(executedSteps, overloadedEngine.world.maxCatchUpSteps);
assert.equal(overloadResult.stepCount, overloadedEngine.world.maxCatchUpSteps);
assert.ok(overloadResult.interpolationAlpha >= 0 && overloadResult.interpolationAlpha < 1);
assert.ok(overloadResult.droppedTime > 0.9, 'excess elapsed time must be discarded');

console.log(
  `PASS: fixed-step repeatability and frame-schedule invariance within ${NUMERICAL_TOLERANCE}`,
);
