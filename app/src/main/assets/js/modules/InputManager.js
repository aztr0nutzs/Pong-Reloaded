class InputManager {
    constructor(engine, predictor){
      this.engine = engine;
      this.predictor = predictor;
      
      this.layerEl = null;
      this.canvasEl = null;
      this.ctx = null;
      this.hintEl = null;
      this.crosshairEl = null;
      this.statsHudEl = null;
      this.arcFillEl = null;
      this.spinFillEl = null;
      this.releaseFillEl = null;
      this.releaseReadoutEl = null;
      this.powerFillEl = null;
      this.powerReadoutEl = null;

      this.active = false;
      this.pointerId = null;
      this.ballStart = null;
      this.current = null;
      this.target = null;
      this.startTarget = null;
      this.currentShotSolution = null;
      if (window.Thrower) window.Thrower.resetInput();
      this.phase = 'target';
      if (window.GameStateManager && GameStateManager.state && GameStateManager.state.aim) {
        GameStateManager.state.aim.phase = 'target';
      }
      
      this.MIN_PULL = 0.08;

      this._eventsBound = false;
      this._bindPointerEvents();
    }

    _ensureElements(){
      if (!this.layerEl) this.layerEl = $('aim-layer');
      if (!this.canvasEl) this.canvasEl = $('aim-canvas');
      if (!this.ctx && this.canvasEl) this.ctx = this.canvasEl.getContext('2d');
      if (!this.hintEl) this.hintEl = $('aim-hint');
      if (!this.crosshairEl) this.crosshairEl = $('aim-crosshair');
      if (!this.statsHudEl) this.statsHudEl = $('aim-stats-hud');
      if (!this.arcFillEl) this.arcFillEl = $('arc-fill');
      if (!this.spinFillEl) this.spinFillEl = $('spin-fill');
      if (!this.releaseFillEl) this.releaseFillEl = $('release-fill');
      if (!this.releaseReadoutEl) this.releaseReadoutEl = $('release-readout');
      if (!this.powerFillEl) this.powerFillEl = $('power-fill');
      if (!this.powerReadoutEl) this.powerReadoutEl = $('power-readout');
      this._bindPointerEvents();
    }

    resizeCanvas(){
      this._ensureElements();
      if (!this.canvasEl) return;
      this.canvasEl.width = window.innerWidth;
      this.canvasEl.height = window.innerHeight;
    }

    isReady(){
      var m = state ? state.match : null;
      return !!(m && m.active && !m.paused && !m.autoPaused && !m.busy && m.turn === 'player');
    }

    reset(){
      if (window.GameStateManager && GameStateManager.state && GameStateManager.state.aim) {
        GameStateManager.state.aim.powerPct = 0;
        GameStateManager.state.aim.statsHudData = { show: false };
        GameStateManager.state.aim.crosshair.show = false;
        GameStateManager.state.aim.shotSolution = null;
        this.phase = 'target';
        GameStateManager.state.aim.phase = 'target';
        this.target = null;
        this.currentShotSolution = null;
        GameStateManager.state.aim.hintOpacity = '1';
        GameStateManager.state.aim.hintText = 'Drag to place your crosshair target';
      }
      qsa('#ai-cups .cup').forEach(function(c){ c.classList.remove('cup-target'); });
    }
    
    tableClampedPoint(pt){
        var tr = this.cachedTableRect;
        if(!tr && $('table-surface')) {
            this.cachedTableRect = $('table-surface').getBoundingClientRect();
            tr = this.cachedTableRect;
        }
        if(!tr) return pt;
        return {
            x: clamp(pt.x, tr.left, tr.right),
            y: clamp(pt.y, tr.top, tr.bottom)
        };
    }

    updateStatsHud(sol){
      if (window.GameStateManager && GameStateManager.state && GameStateManager.state.aim) {
        GameStateManager.state.aim.statsHudData = {
            show: true,
            spinPct: Math.round(sol.spin * 100),
            relPct: Math.round(sol.releaseQuality * 100),
            arcPct: Math.round(sol.arc * 100),
            outcome: sol.predictedOutcome
        };
      }
    }

    updateVisuals(){
      this._ensureElements();
      var difficulty = (state && state.settings) ? (state.settings.difficulty || 'normal') : 'normal';
      
      if(this.phase === 'target'){
          var t = this.target || this.tableClampedPoint({x: window.innerWidth/2, y: window.innerHeight/4});
          if (window.GameStateManager && GameStateManager.state && GameStateManager.state.aim) {
            GameStateManager.state.aim.crosshair.x = t.x;
            GameStateManager.state.aim.crosshair.y = t.y;
            GameStateManager.state.aim.crosshair.show = true;
            GameStateManager.state.aim.hintText = 'Drag to place crosshair';
            GameStateManager.state.aim.hintOpacity = '1';
          }
          return;
      }
      
      if (!this.cachedPull) this.cachedPull = {};
      var pull = this.cachedPull;
      if (!this.current || !this.pullStart) return;
      pull.x = this.current.x - this.pullStart.x;
      pull.y = this.current.y - this.pullStart.y;
      var controlPull = Renderer.screenPullToControl(pull);
      var valid = controlPull.y > this.MIN_PULL;
      
      var windAccel = { LOW: 0, MED: 0.036, HIGH: 0.082 }[(state && state.match) ? state.match.wind : 'LOW'] || 0;
      var smoothedPull = window.Thrower ? window.Thrower.updateInput(controlPull) : controlPull;
      var targetWorld = Renderer.screenToWorld(this.target);
      var finalizedControls = (valid && window.Thrower) ? window.Thrower.finalizePlayerControls(
          smoothedPull,
          targetWorld,
          this.target,
          window.Thrower.DEFAULT_ARC
      ) : null;
      var sol = finalizedControls ? window.Thrower.computeSolution(
          finalizedControls,
          this.ballStart,
          this.cachedCupsEls,
          difficulty,
          windAccel
      ) : null;
      
      if(sol){
        ShotSolution.assertValid(sol);
        this.currentShotSolution = sol;
        if (window.GameStateManager && GameStateManager.state && GameStateManager.state.aim) {
          GameStateManager.state.aim.shotSolution = sol;
          GameStateManager.state.aim.powerPct = Math.round(clamp(sol.power, 0, 1) * 100);
        }
        this.updateStatsHud(sol);
      } else {
        if (window.GameStateManager && GameStateManager.state && GameStateManager.state.aim) {
          GameStateManager.state.aim.crosshair.show = false;
          GameStateManager.state.aim.shotSolution = null;
          GameStateManager.state.aim.powerPct = 0;
          this.currentShotSolution = null;
          GameStateManager.state.aim.hintOpacity = '1';
          GameStateManager.state.aim.hintText = 'Pull back to aim and throw';
        }
      }
    }

    _bindPointerEvents(){
      if (this._eventsBound) return;
      if (!this.layerEl && window.$) this.layerEl = $('aim-layer');
      if (!this.layerEl) return;
      
      this._eventsBound = true;
      var self = this;
      this.layerEl.addEventListener('pointerdown', function(e){
        if(!self.isReady()) return;
        self.active = true;
        self.pointerId = e.pointerId;
        self.layerEl.setPointerCapture(e.pointerId);
        
        var ballEl = $('ball');
        var tableEl = $('table-surface');
        if (!ballEl || !tableEl) return;
        
        self.cachedTableRect = tableEl.getBoundingClientRect();
        self.cachedCupsEls = qsa('#ai-cups .cup:not(.hit)');
        
        self.ballStart = self.engine.world.launchPosition('player');
        
        if(self.phase === 'target'){
            self.startTarget = self.target || self.tableClampedPoint({x: e.clientX, y: e.clientY});
            self.pointerDownPos = {x: e.clientX, y: e.clientY};
            self.target = self.startTarget;
        } else {
            if (!self.pullStart) self.pullStart = {};
            self.pullStart.x = e.clientX; self.pullStart.y = e.clientY;
            if (!self.current) self.current = {};
            self.current.x = e.clientX; self.current.y = e.clientY;
        }
        self.updateVisuals();
      });

      this.layerEl.addEventListener('pointermove', function(e){
        if(!self.active || e.pointerId !== self.pointerId) return;
        if(self.phase === 'target'){
            var dx = e.clientX - self.pointerDownPos.x;
            var dy = e.clientY - self.pointerDownPos.y;
            self.target = self.tableClampedPoint({x: self.startTarget.x + dx, y: self.startTarget.y + dy});
        } else {
            if (!self.current) self.current = {};
            self.current.x = e.clientX; self.current.y = e.clientY;
        }
        self.updateVisuals();
      });

      function release(e){
        if(!self.active || e.pointerId !== self.pointerId) return;
        self.active = false;
        try { self.layerEl.releasePointerCapture(e.pointerId); } catch(err){}
        
        if(self.phase === 'target'){
            self.phase = 'power';
            if (window.GameStateManager && GameStateManager.state && GameStateManager.state.aim) {
              GameStateManager.state.aim.hintText = 'Pull backward to set power and arc';
            }
            return;
        }
        
        if (!self.cachedPull) self.cachedPull = {};
        var pull = self.cachedPull;
        if (!self.current || !self.pullStart) {
          if (window.Thrower) window.Thrower.resetInput();
          self.reset();
          return;
        }
        pull.x = self.current.x - self.pullStart.x;
        pull.y = self.current.y - self.pullStart.y;
        if(Renderer.screenPullToControl(pull).y <= self.MIN_PULL){
          if (window.Thrower) window.Thrower.resetInput();
          self.reset();
          return;
        }
        
        var sol = self.currentShotSolution;
        if (sol) ShotSolution.assertValid(sol);
        if (window.Thrower) window.Thrower.resetInput();
        self.reset();
        
        if (state && state.match) state.match.trickArmed = false;
        if(typeof updateTrickButtonArmedUI === 'function') updateTrickButtonArmedUI(false);
        if (sol && window.Thrower) Thrower.performPlayerThrow(sol);
      }
      
      this.layerEl.addEventListener('pointerup', release);
      this.layerEl.addEventListener('pointercancel', function(e){
        self.active = false;
        if (window.Thrower) window.Thrower.resetInput();
        self.reset();
      });
    }
}
window.InputManager = InputManager;
