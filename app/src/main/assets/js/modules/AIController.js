
class AIController {
    constructor(engine, predictor, thrower) {
        this.engine = engine;
        this.predictor = predictor;
        this.thrower = thrower;
        this.PHYSICS_DIFFICULTY = 'normal';
        this.SKILL = Object.freeze({
          easy: Object.freeze({ targetError:0.055, powerError:0.12, arcError:0.14, spinError:0.35 }),
          normal: Object.freeze({ targetError:0.028, powerError:0.065, arcError:0.075, spinError:0.18 }),
          hard: Object.freeze({ targetError:0.012, powerError:0.025, arcError:0.030, spinError:0.08 })
        });
    }

    seedForDecision(match, difficulty, decisionIndex, cupElements) {
      var cupState = cupElements.map(function(cup) { return cup.dataset.idx; }).sort().join(',');
      var stateKey = [match.seed, difficulty, decisionIndex, match.playerRemaining,
        match.aiRemaining, match.score.player, match.score.ai, cupState].join('|');
      return GameStateManager.seedFrom(stateKey);
    }

    createPrng(seed) {
      var value = seed >>> 0 || 1;
      return function() {
        value ^= value << 13;
        value ^= value >>> 17;
        value ^= value << 5;
        return (value >>> 0) / 4294967296;
      };
    }

    createDecision(match, difficulty, decisionIndex, cupElements) {
      var profile = this.SKILL[difficulty] || this.SKILL.normal;
      if (!cupElements.length) return null;
      var available = cupElements.slice().sort(function(a, b) { return Number(a.dataset.idx) - Number(b.dataset.idx); });
      var random = this.createPrng(this.seedForDecision(match, difficulty, decisionIndex, available));
      var target = available[Math.floor(random() * available.length)];
      var cupPosition = this.engine.world.geometry.cupPosition('player', Number(target.dataset.idx));
      var angle = random() * Math.PI * 2;
      var radius = Math.sqrt(random()) * profile.targetError;
      var targetWorldPosition = Object.freeze({
        x: cupPosition.x + Math.cos(angle) * radius,
        y: cupPosition.y + Math.sin(angle) * radius,
        z: 0
      });
      var signed = function(limit) { return (random() * 2 - 1) * limit; };
      var power = clamp(0.62 + signed(profile.powerError), 0.35, 0.90);
      var arc = clamp(0.55 + signed(profile.arcError), 0.25, 0.85);
      var spin = clamp(signed(profile.spinError), -1, 1);
      return Object.freeze({
        targetElement: target,
        targetWorldPosition: targetWorldPosition,
        targetError: radius,
        powerError: Math.abs(power - 0.62),
        arcError: Math.abs(arc - 0.55),
        controls: Object.freeze({
          targetWorldPosition: targetWorldPosition,
          requestedTarget: Object.freeze({ x: targetWorldPosition.x, y: targetWorldPosition.y }),
          inputPull: Object.freeze({ x: spin * 0.4, y: power }),
          power: power,
          arc: arc,
          spin: spin
        })
      });
    }

    createShotSolution(match, difficulty, decisionIndex, cupElements) {
      if (!this.engine || !this.predictor || !this.thrower) {
        throw new Error('AI requires PhysicsWorld, TrajectoryPredictor, and ThrowController');
      }
      var decision = this.createDecision(match, difficulty, decisionIndex, cupElements);
      if (!decision) return null;
      var solution = this.thrower.computeSolution(
        decision.controls,
        this.engine.world.launchPosition('ai'),
        cupElements,
        this.PHYSICS_DIFFICULTY,
        0
      );
      ShotSolution.assertValid(solution);
      return Object.freeze({ decision: decision, solution: solution });
    }

    performAiThrow(){
      var m = state.match;
      var generation = window.GameStateManager ? GameStateManager.claimAiThrow() : null;
      if(!m || generation === null) return false;
      resetBallPosition('ai');
      var remainingCups = qsa('#player-cups .cup:not(.hit)');
      var difficulty = state.settings.difficulty || 'normal';
      var decisionIndex = GameStateManager.consumeAiDecisionIndex();
      var planned = this.createShotSolution(m, difficulty, decisionIndex, remainingCups);
      if(!planned){ finishMatch('lose'); return true; }

      this.thrower.playbackShot(planned.solution).then(function(liveSim){
        if (!GameStateManager.isCurrent(generation)) return;
        var sim = liveSim;
        var willHit = sim.outcome === 'hit' && !!sim.hitCupEl;
        var cupKey = sim.hitCupEl ? sim.hitCupEl.dataset.idx : null;
        var scored = GameStateManager.resolveThrow('ai', willHit, cupKey);
        if(scored){
          sim.hitCupEl.classList.add('hit');
          SFX.hit();
          toast('AI SCORES');
          haptic(20);
        } else {
          SFX.miss();
          toast('AI MISSED');
        }
        resetBallPosition('player');
        

        if(m.playerRemaining <= 0){ finishMatch('lose'); return; }

        GameStateManager.advanceTurn('ai');
      });
      return true;
    }
}
window.AIController = AIController;
