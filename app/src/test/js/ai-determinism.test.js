'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const modulesDirectory = path.resolve(__dirname, '../../main/assets/js/modules');
const context = {
  console,
  window: { state: { settings: { sensitivity: 70, difficulty: 'normal' }, match: null } },
  state: { settings: { sensitivity: 70, difficulty: 'normal' }, match: null },
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  qsa: () => [],
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
};
context.window.window = context.window;
vm.createContext(context);
for (const moduleName of [
  'GameStateManager.js',
  'PhysicsEngine.js',
  'TrajectoryPredictor.js',
  'ThrowController.js',
  'AIController.js',
]) {
  vm.runInContext(
    fs.readFileSync(path.join(modulesDirectory, moduleName), 'utf8'),
    context,
    { filename: moduleName },
  );
}

const manager = context.window.GameStateManager;
const engine = new context.window.PhysicsEngine();
const predictor = new context.window.TrajectoryPredictor(engine);
const thrower = new context.window.ThrowController(engine, predictor);
const ai = new context.window.AIController(engine, predictor, thrower);
const cups = Array.from({ length: 10 }, (_, index) => ({
  dataset: { team: 'player', idx: String(index) },
}));

function match(seed) {
  const value = manager.createMatch('quick', 'CYBER_VOID', seed);
  value.playerRemaining = 8;
  value.aiRemaining = 7;
  value.score.player = 3;
  value.score.ai = 2;
  return value;
}

function serializableDecision(decision) {
  return {
    targetIndex: decision.targetElement.dataset.idx,
    targetWorldPosition: { ...decision.targetWorldPosition },
    targetError: decision.targetError,
    powerError: decision.powerError,
    arcError: decision.arcError,
    controls: {
      targetWorldPosition: { ...decision.controls.targetWorldPosition },
      requestedTarget: { ...decision.controls.requestedTarget },
      inputPull: { ...decision.controls.inputPull },
      power: decision.controls.power,
      arc: decision.controls.arc,
      spin: decision.controls.spin,
    },
  };
}

const first = ai.createDecision(match(0x12345678), 'normal', 4, cups);
const repeated = ai.createDecision(match(0x12345678), 'normal', 4, cups.slice().reverse());
assert.deepEqual(serializableDecision(first), serializableDecision(repeated),
  'same seed, difficulty, decision index, and cup state must reproduce the decision');

const changedSeed = ai.createDecision(match(0x87654321), 'normal', 4, cups);
assert.notDeepEqual(serializableDecision(first), serializableDecision(changedSeed),
  'changing the match seed must vary the deterministic decision');

assert.ok(ai.SKILL.easy.targetError > ai.SKILL.normal.targetError);
assert.ok(ai.SKILL.normal.targetError > ai.SKILL.hard.targetError);
assert.ok(ai.SKILL.easy.powerError > ai.SKILL.normal.powerError);
assert.ok(ai.SKILL.normal.powerError > ai.SKILL.hard.powerError);
assert.ok(ai.SKILL.easy.arcError > ai.SKILL.normal.arcError);
assert.ok(ai.SKILL.normal.arcError > ai.SKILL.hard.arcError);
assert.ok(ai.SKILL.easy.spinError > ai.SKILL.normal.spinError);
assert.ok(ai.SKILL.normal.spinError > ai.SKILL.hard.spinError);

const physicsBefore = {
  gravity: engine.GRAVITY,
  mass: engine.BALL_MASS,
  radius: engine.BALL_R,
  tableRestitution: engine.TABLE_BOUNCE_E,
  tableWidth: engine.world.geometry.table.width,
  cupRadius: engine.world.geometry.cup.outerTopRadius,
};
let physicsSimulations = 0;
const originalSimulate = predictor.simulate.bind(predictor);
predictor.simulate = function(...args) {
  physicsSimulations++;
  return originalSimulate(...args);
};

const planned = ai.createShotSolution(match(0x12345678), 'easy', 4, cups);
const plannedAgain = ai.createShotSolution(match(0x12345678), 'easy', 4, cups);
context.window.ShotSolution.assertValid(planned.solution);
assert.ok(Object.isFrozen(planned.solution));
assert.deepEqual(planned.solution.launchVelocity, plannedAgain.solution.launchVelocity);
assert.deepEqual(planned.solution.angularVelocity, plannedAgain.solution.angularVelocity);
assert.deepEqual(planned.solution.trajectorySamples, plannedAgain.solution.trajectorySamples);
assert.ok(physicsSimulations > 0, 'AI solution must be evaluated through TrajectoryPredictor and PhysicsWorld');
assert.equal(planned.solution.simulationContext.difficulty, 'normal',
  'AI difficulty must not alter physics collision configuration');

const physicsAfter = {
  gravity: engine.GRAVITY,
  mass: engine.BALL_MASS,
  radius: engine.BALL_R,
  tableRestitution: engine.TABLE_BOUNCE_E,
  tableWidth: engine.world.geometry.table.width,
  cupRadius: engine.world.geometry.cup.outerTopRadius,
};
assert.deepEqual(physicsAfter, physicsBefore, 'AI difficulty must not mutate world physics');

const aiSource = fs.readFileSync(path.join(modulesDirectory, 'AIController.js'), 'utf8');
assert.doesNotMatch(aiSource, /Math\.random|\bpick\s*\(|DIFF_AI_HIT|computeAiThrowParams|predictor\.simulate/);
assert.match(aiSource, /thrower\.computeSolution/);
assert.match(aiSource, /thrower\.playbackShot/);

console.log('PASS: seeded AI decisions and physical ShotSolutions are repeatable');
