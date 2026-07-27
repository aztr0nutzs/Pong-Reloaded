class Renderer {
    static ballEl = null;
    static shadowEl = null;
    static lastShotSolutionRef = null;
    
    static getBall() {
        if (!Renderer.ballEl) Renderer.ballEl = document.getElementById('ball');
        return Renderer.ballEl;
    }
    
    static getShadow() {
        if (!Renderer.shadowEl) Renderer.shadowEl = document.getElementById('ball-shadow');
        return Renderer.shadowEl;
    }

    static getWorldScreenTransform(renderBounds) {
        var table = window.Physics.world.geometry.table;
        var bounds = renderBounds || document.getElementById('table-surface').getBoundingClientRect();
        return Object.freeze({
            bounds: bounds,
            worldWidth: table.width,
            worldLength: table.length,
            pixelsPerMeterX: bounds.width / table.width,
            pixelsPerMeterY: bounds.height / table.length
        });
    }

    static worldToScreen(point, renderBounds) {
        var transform = Renderer.getWorldScreenTransform(renderBounds);
        return {
            x: transform.bounds.left + point.x * transform.pixelsPerMeterX,
            y: transform.bounds.top + point.y * transform.pixelsPerMeterY - point.z * transform.pixelsPerMeterY
        };
    }

    static screenToWorld(point, renderBounds) {
        var transform = Renderer.getWorldScreenTransform(renderBounds);
        return {
            x: Renderer.stableWorldScalar(clamp((point.x - transform.bounds.left) / transform.pixelsPerMeterX, 0, transform.worldWidth)),
            y: Renderer.stableWorldScalar(clamp((point.y - transform.bounds.top) / transform.pixelsPerMeterY, 0, transform.worldLength)),
            z: 0
        };
    }

    static screenPullToControl(pull, renderBounds) {
        var transform = Renderer.getWorldScreenTransform(renderBounds);
        var referencePixels = transform.bounds.height * 0.4;
        return {
            x: Renderer.stableWorldScalar(pull.x / referencePixels),
            y: Renderer.stableWorldScalar(pull.y / referencePixels)
        };
    }

    static stableWorldScalar(value) {
        return Math.round(value * 1e12) / 1e12;
    }

    static renderPreview(ctx, solution){
      if(!ctx) return;
      var w = ctx.canvas.width;
      var h = ctx.canvas.height;
      ctx.clearRect(0, 0, w, h);
      if(!solution) return;
      ShotSolution.assertValid(solution);
      
      var bs = Renderer.worldToScreen(solution.launchPosition);
      var color = solution.predictedOutcome === 'hit' ? '#39ff8c' : (solution.grazedRim ? '#ffd23f' : '#00f3ff');
      
      // Draw target line
      var last = Renderer.worldToScreen(solution.landingPosition);
      var lx = last.x, ly = last.y;
      
      ctx.beginPath();
      var target = Renderer.worldToScreen(solution.targetWorldPosition);
      ctx.moveTo(target.x, target.y);
      ctx.lineTo(lx, ly);
      ctx.strokeStyle = 'rgba(255, 46, 196, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 5]);
      ctx.stroke();
      
      // Draw pull line
      ctx.beginPath();
      ctx.moveTo(bs.x, bs.y);
      var transform = Renderer.getWorldScreenTransform();
      var pullScale = transform.bounds.height * 0.4;
      ctx.lineTo(bs.x + solution.inputPull.x * pullScale, bs.y + solution.inputPull.y * pullScale);
      ctx.strokeStyle = 'rgba(255, 46, 196, 0.85)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 7]);
      ctx.lineCap = 'round';
      ctx.stroke();
      
      // Draw trajectory polyline
      var step = Math.max(1, Math.floor(solution.trajectorySamples.length / 70));
      ctx.beginPath();
      for(var i=0; i<solution.trajectorySamples.length; i+=step){
        var p = Renderer.worldToScreen(solution.trajectorySamples[i]);
        var px = p.x, py = p.y;
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
      solution.bounceEvents.forEach(function(event){
        ctx.beginPath();
        var point = Renderer.worldToScreen(event);
        ctx.arc(point.x, point.y, 3, 0, Math.PI*2);
        ctx.fill();
      });
      
      // Draw impact force
      if (solution.impactForce) {
          ctx.fillStyle = color;
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText((solution.impactForce > 1000 ? (solution.impactForce / 100).toFixed(0) : solution.impactForce.toFixed(1)) + ' N', lx, ly - 20);
      }
      
      // Draw rim marker
      var rimSample = solution.firstRimSample;
      if(rimSample){
        var rimPoint = Renderer.worldToScreen(rimSample);
        var rx = rimPoint.x, ry = rimPoint.y;
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
        Renderer.DOM.canvas = document.getElementById('aim-canvas');
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
            let currentPosition = pt.position || { x: pt.x, y: pt.y, z: pt.z };
            let previousPosition = pt.previousPosition || { x: pt.prevX, y: pt.prevY, z: pt.prevZ };
            let ix = previousPosition.x + (currentPosition.x - previousPosition.x) * a;
            let iy = previousPosition.y + (currentPosition.y - previousPosition.y) * a;
            let iz = previousPosition.z + (currentPosition.z - previousPosition.z) * a;
            
            let worldPoint = { x: ix, y: iy, z: iz + window.Physics.world.geometry.ball.radius };
            let screenPoint = Renderer.worldToScreen(worldPoint);
            let transform = Renderer.getWorldScreenTransform();
            let br = window.Physics.world.geometry.ball.radius * transform.pixelsPerMeterX;
            let diameter = br * 2;
            if (Renderer.lastBallDiameter !== diameter) {
                ball.style.width = diameter.toFixed(2) + 'px';
                ball.style.height = diameter.toFixed(2) + 'px';
                if (shadow) {
                    shadow.style.width = (diameter * 0.85).toFixed(2) + 'px';
                    shadow.style.height = (diameter * 0.27).toFixed(2) + 'px';
                }
                Renderer.lastBallDiameter = diameter;
            }
            let bx = screenPoint.x - br;
            let by = screenPoint.y - br;
            let scaleDepth = pt.scaleDepth || 1;
            let shadowScale = pt.shadowScale || 1;
            let shadowOpacity = pt.shadowOpacity || 1;
            
            let bTransform = 'translate3d(' + bx.toFixed(1) + 'px, ' + by.toFixed(1) + 'px, 0) scale(' + scaleDepth.toFixed(3) + ')';
            if (Renderer.lastBTransform !== bTransform) {
                ball.style.transform = bTransform;
                Renderer.lastBTransform = bTransform;
            }
            if (shadow) {
                let groundPoint = Renderer.worldToScreen({ x: ix, y: iy, z: 0 });
                let sx = groundPoint.x - (br * 0.85);
                let sy = groundPoint.y - (br * 0.27);
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
            
            // Draw the trajectory when the immutable shot solution changes (passive; no state mutation).
            if (state.aim.shotSolution !== Renderer.lastShotSolutionRef) {
                Renderer.lastShotSolutionRef = state.aim.shotSolution;
                let canvas = Renderer.DOM.canvas;
                if (canvas) {
                    let ctx = Renderer.DOM.ctx;
                    if (state.aim.shotSolution) {
                        Renderer.renderPreview(ctx, state.aim.shotSolution);
                    } else if (ctx) {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }
                }
            }
            
            // Target cup highlight
            let targetCup = state.aim.shotSolution ? state.aim.shotSolution.requestedTarget.cupElement : null;
            if (Renderer.lastTargetCup !== targetCup) {
                if (Renderer.lastTargetCup) Renderer.lastTargetCup.classList.remove('cup-target');
                if (targetCup) targetCup.classList.add('cup-target');
                Renderer.lastTargetCup = targetCup;
            }
        }
        
        if (window.UIRenderer) UIRenderer.render(state);
    }

    static sizeAimSvg() {
        if(window.Aim && window.Aim.resizeCanvas) window.Aim.resizeCanvas();
    }
}
window.Renderer = Renderer;
window.sizeAimSvg = Renderer.sizeAimSvg;
