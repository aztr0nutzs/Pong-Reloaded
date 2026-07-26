class Renderer {
    static ballEl = null;
    static shadowEl = null;
    static lastPreviewRef = null;
    
    static getBall() {
        if (!Renderer.ballEl) Renderer.ballEl = document.getElementById('ball');
        return Renderer.ballEl;
    }
    
    static getShadow() {
        if (!Renderer.shadowEl) Renderer.shadowEl = document.getElementById('ball-shadow');
        return Renderer.shadowEl;
    }

    static renderPreview(ctx, sol, pullPoint, valid, grazedRim, firstRimSample){
      if(!ctx) return;
      var w = ctx.canvas.width;
      var h = ctx.canvas.height;
      ctx.clearRect(0, 0, w, h);
      if(!valid || !sol) return;
      
      var bs = sol.ballStart;
      var grazed = grazedRim;
      var color = sol.outcome === 'hit' ? '#39ff8c' : (grazed ? '#ffd23f' : '#00f3ff');
      
      // Draw target line
      var last = sol.samples[sol.samples.length - 1];
      var lx = last.x, ly = last.y - last.z*0.85;
      
      ctx.beginPath();
      ctx.moveTo(sol.target.x, sol.target.y);
      ctx.lineTo(lx, ly);
      ctx.strokeStyle = 'rgba(255, 46, 196, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 5]);
      ctx.stroke();
      
      // Draw pull line
      if(pullPoint){
        ctx.beginPath();
        ctx.moveTo(bs.x, bs.y);
        ctx.lineTo(pullPoint.x, pullPoint.y);
        ctx.strokeStyle = 'rgba(255, 46, 196, 0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 7]);
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      
      // Draw trajectory polyline
      var step = Math.max(1, Math.floor(sol.samples.length / 70));
      ctx.beginPath();
      for(var i=0; i<sol.samples.length; i+=step){
        var p = sol.samples[i];
        var px = p.x, py = p.y - p.z*0.85;
        if(i===0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash([2, 10]);
      ctx.globalAlpha = 0.95;
      ctx.lineCap = 'round';
      ctx.stroke();
      
      ctx.setLineDash([]);
      
      // Draw bounce markers
      ctx.fillStyle = '#00f3ff';
      ctx.globalAlpha = 0.8;
      sol.samples.forEach(function(p){
        if(p.event === 'bounce'){
          ctx.beginPath();
          ctx.arc(p.x, p.y - p.z*0.85, 3, 0, Math.PI*2);
          ctx.fill();
        }
      });
      
      // Draw impact force
      if (sol.impactForce) {
          ctx.fillStyle = color;
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText((sol.impactForce > 1000 ? (sol.impactForce / 100).toFixed(0) : sol.impactForce.toFixed(1)) + ' N', lx, ly - 20);
      }
      
      // Draw rim marker
      var rimSample = firstRimSample;
      if(rimSample){
        var rx = rimSample.x, ry = rimSample.y - rimSample.z*0.85;
        ctx.beginPath();
        ctx.arc(rx, ry, 10, 0, Math.PI*2);
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 4]);
        ctx.globalAlpha = 0.9;
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.beginPath();
        ctx.arc(rx, ry, 2.5, 0, Math.PI*2);
        ctx.fillStyle = '#ffd23f';
        ctx.fill();
      }
      
      // Draw final target circle
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(lx, ly, 15, 0, Math.PI*2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(lx, ly, 3.5, 0, Math.PI*2);
      ctx.fillStyle = color;
      ctx.fill();
      
      ctx.globalAlpha = 1.0;
    }

    static DOM = { initialized: false };
    static initDOM() {
        if (Renderer.DOM.initialized) return;
        Renderer.DOM.crosshairEl = document.getElementById('aim-crosshair');
        Renderer.DOM.powerFillEl = document.getElementById('power-fill');
        Renderer.DOM.canvas = document.getElementById('aim-layer-canvas');
        Renderer.DOM.ctx = Renderer.DOM.canvas ? Renderer.DOM.canvas.getContext('2d') : null;
        Renderer.DOM.initialized = true;
    }

    // Passive consumer of game state with frame interpolation factor alpha [0, 1]
    static render(state, alpha) {
        if (!state) return;
        Renderer.initDOM();
        
        let ball = Renderer.getBall();
        let shadow = Renderer.getShadow();
        let a = (alpha !== undefined) ? Math.max(0, Math.min(1, alpha)) : 1.0;
        
        if (ball && state.ball && state.ball.active) {
            let pt = state.ball;
            
            // Interpolate position between previous and current physics steps
            let ix = (pt.prevX !== undefined) ? pt.prevX + (pt.x - pt.prevX) * a : pt.x;
            let iy = (pt.prevY !== undefined) ? pt.prevY + (pt.y - pt.prevY) * a : pt.y;
            let iz = (pt.prevZ !== undefined) ? pt.prevZ + (pt.z - pt.prevZ) * a : pt.z;
            
            let lift = iz * 0.85;
            let br = window.Thrower ? window.Thrower.engine.BALL_R : 13;
            let bx = ix - br;
            let by = iy - br - lift;
            let scaleDepth = pt.scaleDepth || 1;
            let shadowScale = pt.shadowScale || 1;
            let shadowOpacity = pt.shadowOpacity || 1;
            
            let bTransform = 'translate3d(' + bx.toFixed(1) + 'px, ' + by.toFixed(1) + 'px, 0) scale(' + scaleDepth.toFixed(3) + ')';
            if (Renderer.lastBTransform !== bTransform) {
                ball.style.transform = bTransform;
                Renderer.lastBTransform = bTransform;
            }
            if (shadow) {
                let sx = ix - (br * 0.85);
                let sy = iy - (br * 0.27);
                let sTransform = 'translate3d(' + sx.toFixed(1) + 'px, ' + sy.toFixed(1) + 'px, 0) scale(' + (scaleDepth * shadowScale).toFixed(3) + ')';
                if (Renderer.lastSTransform !== sTransform) {
                    shadow.style.transform = sTransform;
                    shadow.style.opacity = shadowOpacity.toFixed(2);
                    Renderer.lastSTransform = sTransform;
                }
            }
        }
        
        // Passive Aim UI Rendering
        if (state.aim) {
            let crosshairEl = Renderer.DOM.crosshairEl;
            if (crosshairEl) {
                if (state.aim.crosshair.show) {
                    let cTransform = 'translate3d(' + state.aim.crosshair.x.toFixed(1) + 'px, ' + state.aim.crosshair.y.toFixed(1) + 'px, 0)';
                    if (Renderer.lastCTransform !== cTransform) {
                        crosshairEl.style.transform = cTransform;
                        Renderer.lastCTransform = cTransform;
                    }
                    if (!Renderer.lastCShow) { crosshairEl.classList.add('show'); Renderer.lastCShow = true; }
                    let locked = state.aim.crosshair.locked;
                    if (Renderer.lastCLocked !== locked) {
                        crosshairEl.classList.toggle('locked', locked);
                        Renderer.lastCLocked = locked;
                    }
                } else {
                    if (Renderer.lastCShow) { crosshairEl.classList.remove('show'); Renderer.lastCShow = false; }
                }
            }
            
            let powerFillEl = Renderer.DOM.powerFillEl;
            if (powerFillEl) {
                let pHeight = (state.aim.powerPct || 0) + '%';
                if (Renderer.lastPHeight !== pHeight) {
                    powerFillEl.style.height = pHeight;
                    Renderer.lastPHeight = pHeight;
                }
            }
            
            // Draw preview when preview object changes (Passive - NO STATE MUTATION)
            if (state.aim.preview !== Renderer.lastPreviewRef) {
                Renderer.lastPreviewRef = state.aim.preview;
                let canvas = Renderer.DOM.canvas;
                if (canvas) {
                    let ctx = Renderer.DOM.ctx;
                    if (state.aim.preview) {
                        Renderer.renderPreview(
                            ctx, 
                            state.aim.preview.sol, 
                            state.aim.preview.pullStart, 
                            true, 
                            state.aim.preview.grazedRim, 
                            state.aim.preview.firstRimSample
                        );
                    } else if (ctx) {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }
                }
            }
            
            // Target cup highlight
            let targetCup = state.aim.targetCup;
            if (Renderer.lastTargetCup !== targetCup) {
                if (Renderer.lastTargetCup) Renderer.lastTargetCup.classList.remove('cup-target');
                if (targetCup) targetCup.classList.add('cup-target');
                Renderer.lastTargetCup = targetCup;
            }
        }
        
        if (window.UIRenderer) UIRenderer.render(state);
    }

    static sizeAimSvg() {
        qsa('.cup').forEach(function(c) {
            delete c.dataset.cx;
            delete c.dataset.cy;
            delete c.dataset.cw;
        });
        if(window.Aim && window.Aim.resizeCanvas) window.Aim.resizeCanvas();
    }
}
window.Renderer = Renderer;
window.sizeAimSvg = Renderer.sizeAimSvg;
