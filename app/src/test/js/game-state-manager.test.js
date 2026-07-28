'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let nextHandle = 1;
const timeouts = new Map();
const intervals = new Map();
const physics = {
  stopCount: 0,
  advanceCount: 0,
  stop() { this.stopCount++; },
  advanceFrame() { this.advanceCount++; return { interpolationAlpha: 0.5 }; },
};
const context = {
  console,
  setTimeout(callback) { const id = nextHandle++; timeouts.set(id, callback); return id; },
  clearTimeout(id) { timeouts.delete(id); },
  setInterval(callback) { const id = nextHandle++; intervals.set(id, callback); return id; },
  clearInterval(id) { intervals.delete(id); },
  window: { Physics: physics },
};
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, '../../main/assets/js/modules/GameStateManager.js'), 'utf8'),
  context,
  { filename: 'GameStateManager.js' },
);

const manager = context.window.GameStateManager;
const S = manager.STATES;

assert.equal(manager.getLifecycle(), S.MENU);
assert.equal(manager.transition(S.PLAYER_AIM), false, 'MENU must not skip initialization');

const firstMatch = manager.beginMatch('quick', 'CYBER_VOID');
assert.equal(manager.getLifecycle(), S.MATCH_INITIALIZING);
assert.equal(firstMatch.turn, 'player');
assert.equal(firstMatch.score.player, 0);
assert.equal(manager.completeInitialization(), true);
assert.equal(manager.getLifecycle(), S.PLAYER_AIM);
assert.equal(manager.canPlayerAim(), true);

const firstGeneration = manager.claimPlayerThrow();
assert.equal(typeof firstGeneration, 'number');
assert.equal(manager.getLifecycle(), S.BALL_ACTIVE);
assert.equal(firstMatch.attempts, 1);
assert.equal(manager.claimPlayerThrow(), null, 'a second player throw must be rejected');
assert.equal(manager.claimAiThrow(), null, 'AI cannot throw during the player ball');

assert.equal(manager.resolveThrow('player', true, 'cup-3'), true);
assert.equal(firstMatch.score.player, 1);
assert.equal(firstMatch.aiRemaining, 9);
assert.equal(firstMatch.hits, 1);
assert.equal(firstMatch.accuracy, 100);
assert.equal(manager.resolveThrow('player', true, 'cup-3'), false, 'one throw cannot score twice');
assert.equal(firstMatch.score.player, 1);
assert.equal(manager.advanceTurn('player'), true);
assert.equal(manager.getLifecycle(), S.AI_AIM);
assert.equal(manager.claimPlayerThrow(), null, 'player cannot throw during the AI turn');

const aiGeneration = manager.claimAiThrow();
assert.equal(aiGeneration, firstGeneration);
assert.equal(manager.resolveThrow('ai', true, 'cup-7'), true);
assert.equal(firstMatch.score.ai, 1);
assert.equal(firstMatch.playerRemaining, 9);
assert.equal(manager.advanceTurn('ai'), true);
assert.equal(manager.getLifecycle(), S.PLAYER_AIM);

assert.equal(manager.pause(), true);
assert.equal(manager.getLifecycle(), S.PAUSED);
assert.equal(manager.canPlayerAim(), false);
assert.equal(manager.advanceSimulation(1 / 60), 0, 'physics must not advance while paused');
assert.equal(manager.resume(), true);
assert.equal(manager.getLifecycle(), S.PLAYER_AIM);

let staleCallbackCount = 0;
manager.schedule(() => staleCallbackCount++, 900, [S.PLAYER_AIM]);
assert.equal(timeouts.size, 1);
manager.beginMatch('quick', 'GHOST_PROTOCOL');
assert.equal(timeouts.size, 0, 'restart must cancel old owned timeouts');
for (const callback of timeouts.values()) callback();
assert.equal(staleCallbackCount, 0, 'old generation callback must not run after restart');

manager.completeInitialization();
let tickCount = 0;
manager.startTimer(() => tickCount++);
assert.equal(intervals.size, 1);
for (const callback of intervals.values()) callback();
assert.equal(tickCount, 1);
assert.equal(manager.state.match.timer, 89);

manager.claimPlayerThrow();
assert.equal(manager.advanceSimulation(1 / 60), 0.5);
assert.equal(physics.advanceCount, 1);
assert.equal(manager.finishMatch('win'), true);
assert.equal(manager.getLifecycle(), S.GAME_OVER);
assert.equal(manager.state.match.result, 'win');
assert.equal(intervals.size, 0, 'game over must cancel the match timer');
const stopCount = physics.stopCount;
assert.equal(manager.finishMatch('lose'), false, 'game over must be idempotent');
assert.equal(physics.stopCount, stopCount, 'duplicate game over must not repeat cleanup');
assert.equal(manager.advanceSimulation(1 / 60), 0, 'physics must stop after game over');

manager.shutdownMatch(true);
assert.equal(manager.getLifecycle(), S.MENU);
assert.equal(manager.state.match, null);
assert.equal(manager.state.aim.shotSolution, null);
assert.equal(manager.state.ball.active, false);

console.log('PASS: authoritative match lifecycle rejects illegal and stale transitions');
