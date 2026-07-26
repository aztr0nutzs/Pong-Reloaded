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
      if (window.Thrower) window.Thrower.resetInput();
      this.phase = 'target';
      if (window.GameStateManager && GameStateManager.state && GameStateManager.state.aim) {
        GameStateManager.state.aim.phase = 'target';
      }
      
      this.MAX_PULL = 250;
      this.MIN_PULL = 20;

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
        GameStateManager.state.aim.preview = null;
        this.phase = 'target';
        GameStateManager.state.aim.phase = 'target';
        this.target = null;
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
            x: clamp(pt.x, tr.left + 20, tr.right - 20),
            y: clamp(pt.y, tr.top + 20, tr.bottom - 40)
        };
    }

    updateStatsHud(sol){
      if (window.GameStateManager && GameStateManager.state && GameStateManager.state.aim) {
        GameStateManager.state.aim.statsHudData = {
            show: true,
            spinPct: Math.round(sol.spinFactor * 100),
            relPct: Math.round(sol.releaseQuality * 100),
            arcPct: Math.round(sol.arcFactor * 100),
            outcome: sol.outcome
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
      var valid = pull.y > this.MIN_PULL;
      
      var windAccel = { LOW: 0, MED: 36, HIGH: 82 }[(state && state.match) ? state.match.wind : 'LOW'] || 0;
      var smoothedPull = window.Thrower ? window.Thrower.updateInput(pull) : pull;
      var sol = (valid && window.Thrower) ? window.Thrower.computeSolution(
          smoothedPull, 
          this.target, 
          this.ballStart, 
          this.cachedCupsEls, 
          this.cachedTableRect, 
          difficulty, 
          windAccel, 
          this.cachedAiCupsRect
      ) : null;
      
      if(sol){
        if (window.GameStateManager && GameStateManager.state && GameStateManager.state.aim) {
          GameStateManager.state.aim.preview = sol.previewPoints;
          GameStateManager.state.aim.targetCup = sol.targetCupIndex;
          GameStateManager.state.aim.powerPct = sol.powerPct;
        }
        this.updateStatsHud(sol);
      } else {
        if (window.GameStateManager && GameStateManager.state && GameStateManager.state.aim) {
          GameStateManager.state.aim.crosshair.show = false;
          GameStateManager.state.aim.preview = null;
          GameStateManager.state.aim.powerPct = 0;
          GameStateManager.state.aim.targetCup = null;
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
        
        self.cachedBallRect = ballEl.getBoundingClientRect();
        self.cachedTableRect = tableEl.getBoundingClientRect();
        let bw = self.cachedTableRect.width * 0.06557;
        ballEl.style.width = bw + 'px';
        ballEl.style.height = bw + 'px';
        if ($('ball-shadow')) {
            $('ball-shadow').style.width = (bw * 0.85) + 'px';
            $('ball-shadow').style.height = (bw * 0.27) + 'px';
        }
        if (window.Thrower && window.Thrower.engine) {
          window.Thrower.engine.BALL_R = bw / 2;
          window.Thrower.engine.BALL_AREA = Math.PI * (bw/2) * (bw/2);
        }
        self.cachedBallRect = ballEl.getBoundingClientRect();
        var aiCupsEl = $('ai-cups');
        self.cachedAiCupsRect = aiCupsEl ? aiCupsEl.getBoundingClientRect() : null;
        self.cachedCupsEls = qsa('#ai-cups .cup:not(.hit)');
        
        self.ballStart = { x: self.cachedBallRect.left + self.cachedBallRect.width/2, y: self.cachedBallRect.top + self.cachedBallRect.height/2, z: 6 };
        
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
        if(pull.y <= self.MIN_PULL){
          if (window.Thrower) window.Thrower.resetInput();
          self.reset();
          return;
        }
        
        var difficulty = (state && state.settings) ? (state.settings.difficulty || 'normal') : 'normal';
        var windAccel = { LOW: 0, MED: 36, HIGH: 82 }[(state && state.match) ? state.match.wind : 'LOW'] || 0;
        var smoothedPull = window.Thrower ? window.Thrower.updateInput(pull) : pull;
        var sol = window.Thrower ? window.Thrower.computeSolution(
            smoothedPull, 
            self.target, 
            self.ballStart, 
            self.cachedCupsEls, 
            self.cachedTableRect, 
            difficulty, 
            windAccel, 
            self.cachedAiCupsRect
        ) : null;
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
