
class AIController {
    constructor(engine, predictor, thrower) {
        this.engine = engine;
        this.predictor = predictor;
        this.thrower = thrower;
        this.DIFF_AI_HIT = { easy:0.30, normal:0.44, hard:0.58 };
    }
    
    /* AI opponent: randomness here decides the AI's aim quality (its
       in-game "skill" per difficulty) — that's opponent behavior, not the
       physics. Whatever aim point the AI ends up choosing is then resolved
       by the exact same deterministic physics engine used for the player. */
    performAiThrow(){
      var m = state.match;
      if(!m || !m.active || m.paused || m.autoPaused) return;
      m.busy = true;
      resetBallPosition('ai');
      var diffChance = this.DIFF_AI_HIT[state.settings.difficulty] || 0.44;
      var aimsWell = Math.random() < diffChance;
      var remainingCups = qsa('#player-cups .cup:not(.hit)');
      var target = remainingCups.length ? pick(remainingCups) : null;
      if(!target){ finishMatch('lose'); m.busy=false; return; }

      var ballRect = $('ball').getBoundingClientRect();
      var ballStart = { x: ballRect.left + ballRect.width/2, y: ballRect.top + ballRect.height/2, z:6 };
      var tr = target.getBoundingClientRect();
      var tx = tr.left + tr.width/2, ty = tr.top + tr.height/2;
      if(!aimsWell){
        // A deterministic-per-cup miss offset (not per-throw random) —
        // the imperfection is the AI's aim, not the physics resolving it.
        var offAngle = ((Number(target.dataset.idx) * 47) % 360) * Math.PI/180;
        tx += Math.cos(offAngle) * 46;
        ty += Math.sin(offAngle) * 20;
      }
      var apexHeight = 140;
      var initParams = this.thrower ? this.thrower.computeAiThrowParams(ballStart, { x: tx, y: ty }, apexHeight, 0.5) : {
        x: ballStart.x, y: ballStart.y, z: ballStart.z,
        vx: (tx - ballStart.x) / 0.338, vy: (ty - ballStart.y) / 0.338, vz: Math.sqrt(2 * this.engine.GRAVITY * apexHeight),
        angularVelocityX: 0.5, angularVelocityZ: 0
      };
      var cupsEls = qsa('#player-cups .cup:not(.hit)');
      var tableRect = $('table-surface').getBoundingClientRect();
      var difficulty = state.settings.difficulty || 'normal';
      var sim = this.predictor.simulate(initParams, cupsEls, tableRect, difficulty, 0);
      var playerCupsRect = $('player-cups').getBoundingClientRect();
      var depthRef = { startY: ballStart.y, endY: playerCupsRect.top + playerCupsRect.height/2 };
      var self = this;

      this.thrower.playback.bind(this.thrower)(initParams, this.engine.DT, depthRef, cupsEls, tableRect, difficulty, 0).then(function(liveSim){
        sim = liveSim; // Update outcome with live sim
        if(sim.outcome === 'hit' && sim.hitCupEl){
          sim.hitCupEl.classList.add('hit');
          m.playerRemaining--;
          SFX.hit();
          toast('AI SCORES');
          haptic(20);
        } else {
          SFX.miss();
          toast('AI MISSED');
        }
        resetBallPosition('player');
        

        if(m.playerRemaining <= 0){ finishMatch('lose'); m.busy=false; return; }

        m.turn = 'player';
        m.busy = false;
      });
    }
}
window.AIController = AIController;
