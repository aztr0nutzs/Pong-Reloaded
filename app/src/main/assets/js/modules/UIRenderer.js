
class UIRenderer {

    static toast(message) {
        var stack = document.getElementById('toast-stack');
        if (!stack) return;
        var el = document.createElement('div');
        el.className = 'toast';
        el.textContent = message;
        stack.appendChild(el);
        requestAnimationFrame(function() { el.classList.add('show'); });
        setTimeout(function() {
            el.classList.remove('show');
            setTimeout(function() { el.remove(); }, 300);
        }, 1700);
    }

    static showScreen(id) {
        qsa('.screen').forEach(s => s.classList.remove('active'));
        var el = document.getElementById(id);
        if (el) el.classList.add('active');
    }
    
    static openPanel(id) {
        var bd = document.getElementById('panel-backdrop');
        if (bd) bd.classList.add('open');
        var el = document.getElementById(id);
        if (el) el.classList.add('open');
    }
    
    static closePanel() {
        var bd = document.getElementById('panel-backdrop');
        if (bd) bd.classList.remove('open');
        qsa('.sheet').forEach(s => s.classList.remove('open'));
    }
    
    static openModal(id) {
        var el = document.getElementById(id);
        if (el) el.classList.add('open');
    }
    
    static closeModal(id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('open');
    }

    
    static DOM = { initialized: false };
    static initDOM() {
        if (UIRenderer.DOM.initialized) return;
        UIRenderer.DOM.statsHudEl = document.getElementById('aim-stats-hud');
        UIRenderer.DOM.arcFillEl = document.getElementById('arc-fill');
        UIRenderer.DOM.spinFillEl = document.getElementById('spin-fill');
        UIRenderer.DOM.releaseFillEl = document.getElementById('release-fill');
        UIRenderer.DOM.releaseReadoutEl = document.getElementById('release-readout');
        UIRenderer.DOM.score = document.getElementById('game-score');
        UIRenderer.DOM.accuracy = document.getElementById('game-accuracy');
        UIRenderer.DOM.trickBtn = document.getElementById('btn-trick-shot');
        UIRenderer.DOM.trickSegments = document.getElementById('trick-segments');
        UIRenderer.DOM.hintEl = document.getElementById('aim-hint');
        UIRenderer.DOM.powerReadoutEl = document.getElementById('power-readout');
        UIRenderer.DOM.initialized = true;
    }

    static render(state) {
        UIRenderer.initDOM();
        
        var m = state.match;
        if(m) {
            let scoreText = String(m.score.player).padStart(2, '0') + ' : ' + String(m.score.ai).padStart(2, '0');
            if (UIRenderer.DOM.score && UIRenderer.lastScoreText !== scoreText) {
                UIRenderer.DOM.score.textContent = scoreText;
                UIRenderer.lastScoreText = scoreText;
            }
            let accuracyText = 'ACC: ' + m.accuracy + '%';
            if (UIRenderer.DOM.accuracy && UIRenderer.lastAccuracyText !== accuracyText) {
                UIRenderer.DOM.accuracy.textContent = accuracyText;
                UIRenderer.lastAccuracyText = accuracyText;
            }
            if (UIRenderer.DOM.trickSegments && UIRenderer.lastTrickMeter !== m.trickMeter) {
                if (!UIRenderer.DOM.trickSegments.children.length) {
                    for (let index = 0; index < 10; index++) {
                        UIRenderer.DOM.trickSegments.appendChild(document.createElement('div'));
                    }
                }
                let litSegments = Math.ceil(m.trickMeter / 10);
                Array.from(UIRenderer.DOM.trickSegments.children).forEach(function(segment, index) {
                    segment.classList.toggle('lit', index < litSegments);
                });
                UIRenderer.lastTrickMeter = m.trickMeter;
                
                if (UIRenderer.DOM.trickBtn) {
                    if(m.trickMeter >= 100){
                        UIRenderer.DOM.trickBtn.classList.add('ready');
                    } else {
                        UIRenderer.DOM.trickBtn.classList.remove('ready');
                        UIRenderer.DOM.trickBtn.classList.remove('trick-armed');
                    }
                }
            }
        }
        
        if (state.aim) {
            if (UIRenderer.DOM.hintEl) {
                if (UIRenderer.lastHintText !== state.aim.hintText) {
                    if(state.aim.hintText !== undefined) UIRenderer.DOM.hintEl.textContent = state.aim.hintText;
                    UIRenderer.lastHintText = state.aim.hintText;
                }
                if (UIRenderer.lastHintOpacity !== state.aim.hintOpacity) {
                    if(state.aim.hintOpacity !== undefined) UIRenderer.DOM.hintEl.style.opacity = state.aim.hintOpacity;
                    UIRenderer.lastHintOpacity = state.aim.hintOpacity;
                }
            }
            if (UIRenderer.DOM.powerReadoutEl) {
                let pText = (state.aim.powerPct || 0) + '%';
                if (UIRenderer.lastPowerText !== pText) {
                    UIRenderer.DOM.powerReadoutEl.textContent = pText;
                    UIRenderer.lastPowerText = pText;
                }
            }
        }
        
        if (state.aim && state.aim.statsHudData) {
            let d = state.aim.statsHudData;
            if (UIRenderer.DOM.statsHudEl) {
                if (d.show && !UIRenderer.lastStatsShow) {
                    UIRenderer.DOM.statsHudEl.classList.add('show');
                    UIRenderer.lastStatsShow = true;
                } else if (!d.show && UIRenderer.lastStatsShow) {
                    UIRenderer.DOM.statsHudEl.classList.remove('show');
                    UIRenderer.lastStatsShow = false;
                }
            }
            
            if (d.show) {
                if (UIRenderer.DOM.arcFillEl && UIRenderer.lastArcPct !== d.arcPct) {
                    UIRenderer.DOM.arcFillEl.style.width = d.arcPct + '%';
                    UIRenderer.lastArcPct = d.arcPct;
                }
                
                if (UIRenderer.DOM.spinFillEl && UIRenderer.lastSpinPct !== d.spinPct) {
                    UIRenderer.DOM.spinFillEl.style.width = Math.abs(d.spinPct) + '%';
                    UIRenderer.DOM.spinFillEl.style.left = d.spinPct < 0 ? (50 - Math.abs(d.spinPct)/2) + '%' : '50%';
                    UIRenderer.DOM.spinFillEl.className = 'aim-stat-fill ' + (d.spinPct < 0 ? 'fill-magenta' : 'fill-primary');
                    UIRenderer.lastSpinPct = d.spinPct;
                }
                
                if (UIRenderer.DOM.releaseFillEl && (UIRenderer.lastRelPct !== d.relPct || UIRenderer.lastOutcome !== d.outcome)) {
                    UIRenderer.DOM.releaseFillEl.style.width = d.relPct + '%';
                    UIRenderer.DOM.releaseFillEl.className = 'aim-stat-fill ' + (d.outcome === 'hit' ? 'fill-green' : (d.relPct > 70 ? 'fill-gold' : 'fill-magenta'));
                    
                    if (UIRenderer.DOM.releaseReadoutEl) {
                        UIRenderer.DOM.releaseReadoutEl.textContent = d.relPct + '% ' + (d.outcome === 'hit' ? 'PERFECT' : (d.relPct > 70 ? 'GOOD' : 'OVERPOWERED'));
                        UIRenderer.DOM.releaseReadoutEl.style.color = d.outcome === 'hit' ? '#39ff8c' : (d.relPct > 70 ? '#ffd23f' : '#ff5566');
                    }
                    
                    UIRenderer.lastRelPct = d.relPct;
                    UIRenderer.lastOutcome = d.outcome;
                }
            }
        }
    }

}
window.UIRenderer = UIRenderer;
window.toast = UIRenderer.toast;
window.showScreen = UIRenderer.showScreen;
window.openPanel = UIRenderer.openPanel;
window.closePanel = UIRenderer.closePanel;
window.openModal = UIRenderer.openModal;
window.closeModal = UIRenderer.closeModal;
