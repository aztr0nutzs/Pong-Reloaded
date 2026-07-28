'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const modulesDirectory = path.resolve(__dirname, '../../main/assets/js/modules');
const context = {
  console,
  window: { state: { settings: { sensitivity: 70 }, match: { wind: 'LOW' } } },
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
};
context.state = context.window.state;
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

assert.deepEqual({
  gravity: engine.GRAVITY,
  airDensity: engine.AIR_DENSITY,
  dragCoefficient: engine.DRAG_COEFF,
  tableRestitution: engine.TABLE_BOUNCE_E,
  rimRestitution: engine.RIM_BOUNCE_E,
  cupWallRestitution: engine.CUP_WALL_E,
  cupFloorRestitution: engine.CUP_FLOOR_E,
  slideFriction: engine.SLIDE_FRICTION,
  rollFriction: engine.ROLL_FRICTION,
  spinDecay: engine.SPIN_DECAY,
  magnus: engine.MAGNUS_ACCELERATION_FACTOR,
  stopSpeed: engine.STOP_SPEED,
  bounceStopSpeed: engine.BOUNCE_STOP_SPEED,
  cupStopVerticalSpeed: engine.CUP_STOP_VERTICAL_SPEED,
  surfaceContactTolerance: engine.SURFACE_CONTACT_TOLERANCE,
}, {
  gravity: 9.80665,
  airDensity: 1.225,
  dragCoefficient: 0.47,
  tableRestitution: 0.80,
  rimRestitution: 0.60,
  cupWallRestitution: 0.30,
  cupFloorRestitution: 0.12,
  slideFriction: 0.24,
  rollFriction: 0.018,
  spinDecay: 1.1,
  magnus: 0.0045,
  stopSpeed: 0.022,
  bounceStopSpeed: 0.40,
  cupStopVerticalSpeed: 0.035,
  surfaceContactTolerance: 0.00005,
});

assert.deepEqual({
  defaultArc: thrower.DEFAULT_ARC,
  powerExponent: thrower.POWER_CURVE_EXPONENT,
  spinRate: thrower.SPIN_RATE,
  minVertical: thrower.MIN_VERTICAL_SPEED,
  maxVertical: thrower.MAX_VERTICAL_SPEED,
  minHorizontal: thrower.MIN_HORIZONTAL_SPEED,
  maxHorizontal: thrower.MAX_HORIZONTAL_SPEED,
  envelopeBase: thrower.POWER_ENVELOPE_BASE,
  envelopeScale: thrower.POWER_ENVELOPE_SCALE,
  headingEnvelope: thrower.HEADING_ENVELOPE,
  refinementPasses: thrower.REFINEMENT_PASSES,
}, {
  defaultArc: 0.52,
  powerExponent: 1.25,
  spinRate: 12,
  minVertical: 1.35,
  maxVertical: 3.35,
  minHorizontal: 0.90,
  maxHorizontal: 10.50,
  envelopeBase: 0.55,
  envelopeScale: 1.35,
  headingEnvelope: 0.14,
  refinementPasses: 4,
});

const directApex = thrower.MIN_VERTICAL_SPEED ** 2 / (2 * engine.GRAVITY);
const highArcApex = thrower.MAX_VERTICAL_SPEED ** 2 / (2 * engine.GRAVITY);
assert.ok(directApex > 0.08 && directApex < 0.11,
  `direct throw apex ${directApex}m must remain low but controllable`);
assert.ok(highArcApex > 0.55 && highArcApex < 0.60,
  `high throw apex ${highArcApex}m must remain natural rather than floaty`);
assert.ok(thrower.getPowerCurve(0.25) < thrower.getPowerCurve(0.5));
assert.ok(thrower.getPowerCurve(0.5) < thrower.getPowerCurve(0.75));
assert.equal(thrower.getPowerCurve(1), 1);

function flightState(spinZ) {
  return engine.createSimulationState({
    x: 0.305, y: 1.7, z: 0.8,
    vx: 0, vy: -5, vz: 0,
    angularVelocityZ: spinZ,
  });
}
const noSpin = flightState(0);
const positiveSpin = flightState(thrower.SPIN_RATE);
const negativeSpin = flightState(-thrower.SPIN_RATE);
for (let step = 0; step < 30; step++) {
  engine.stepFixed(noSpin, engine.world.geometry.table.bounds, [], 0);
  engine.stepFixed(positiveSpin, engine.world.geometry.table.bounds, [], 0);
  engine.stepFixed(negativeSpin, engine.world.geometry.table.bounds, [], 0);
}
assert.ok(noSpin.vy > -5, 'physical air drag must reduce forward speed');
assert.ok(positiveSpin.x > noSpin.x && negativeSpin.x < noSpin.x,
  'bounded spin must curve symmetrically through the Magnus force');
assert.ok(Math.abs(positiveSpin.x - noSpin.x) < 0.05,
  'maximum spin must remain a readable correction rather than an exaggerated hook');

const landing = engine.createSimulationState({
  x: 0.305, y: 1.22, z: 0.20,
  vx: 0, vy: 0, vz: -2,
});
let peakBounces = 0;
for (let step = 0; step < 600 && !landing.settled; step++) {
  engine.stepFixed(landing, engine.world.geometry.table.bounds, [], 0);
  peakBounces = Math.max(peakBounces, landing.bounces);
}
assert.equal(landing.settled, true, 'calibrated bounces must settle within five seconds');
assert.ok(peakBounces >= 2 && peakBounces <= 10,
  `rigid-table response must be lively but finite; received ${peakBounces} bounces`);
assert.equal(landing.vz, 0);

const cupElement = { dataset: { team: 'player', idx: '0' } };
const cupBody = engine.parseCups([cupElement], 'normal')[0];
const capture = engine.createSimulationState({
  x: cupBody.cx, y: cupBody.cy, z: 0.24,
  vx: 0, vy: 0, vz: -1.1,
});
for (let step = 0; step < 600 && !capture.settled; step++) {
  engine.stepFixed(capture, engine.world.geometry.table.bounds, [cupBody], 0);
}
assert.equal(capture.settled, true, 'centered valid entry must settle naturally');
assert.equal(capture.outcome, 'hit');
assert.equal(capture.hitCupEl, cupElement);

console.log('PASS: calibrated throw, flight, spin, bounce, and settlement envelopes');
