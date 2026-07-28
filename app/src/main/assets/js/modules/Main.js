/* ================= GAMEPLAY CORE ================= */
var Physics = new PhysicsEngine();
window.Physics = Physics;
var Predictor = new TrajectoryPredictor(Physics);
window.Predictor = Predictor;
var Thrower = new ThrowController(Physics, Predictor);
window.Thrower = Thrower;
var Aim = new InputManager(Physics, Predictor);
window.Aim = Aim;
window.AI = new AIController(Physics, Predictor, Thrower);

window.addEventListener('resize', function() {
    if (window.Renderer && window.Renderer.sizeAimSvg) {
        Renderer.sizeAimSvg();
    }
});

function helper$(id) {
    return document.getElementById(id);
}

function bindClick(id, fn) {
    var el = typeof id === 'string' ? helper$(id) : id;
    if (el) el.addEventListener('click', fn);
}

function bindEvent(id, evt, fn) {
    var el = typeof id === 'string' ? helper$(id) : id;
    if (el) el.addEventListener(evt, fn);
}

function resetAimHud(){ Aim.reset(); }

function updateTrickButtonArmedUI(on){
    var btn = helper$('btn-trick-shot');
    if (btn) btn.classList.toggle('trick-armed', !!on);
}

function setupEventListeners() {
    bindClick('btn-throw', function(){
        var m = state.match;
        if(!m || !m.active) return;
        UIRenderer.toast(Aim.phase === 'target' ? 'DRAG TO PLACE YOUR CROSSHAIR TARGET' : 'PULL BACK & RELEASE TO THROW');
        SFX.click();
    });

    bindClick('btn-trick-shot', function(){
        var m = state.match;
        if(!m || !GameStateManager.canPlayerAim()) return;
        if(m.trickMeter < 100){ UIRenderer.toast('TRICK METER CHARGING'); SFX.miss(); return; }
        var armed = GameStateManager.toggleTrickArmed();
        updateTrickButtonArmedUI(armed);
        UIRenderer.toast(armed ? 'TRICK SHOT ARMED — PULL BACK & RELEASE' : 'TRICK SHOT DISARMED');
        SFX.click();
    });

    qsa('[data-adjust]').forEach(function(btn){
        btn.addEventListener('click', function(){
            var m = state.match;
            if(!m || !m.active) return;
            var type = btn.getAttribute('data-adjust');
            SFX.click();
            if(type === 'wind'){
                if(GameStateManager.cycleWind() === null) return;
                var wv = helper$('wind-value');
                if (wv) wv.textContent = m.wind;
                UIRenderer.toast('WIND SHIFTED: ' + m.wind);
            } else if(type === 'spin'){
                if(GameStateManager.toggleSpin() === null) return;
                var sv = helper$('spin-value');
                if (sv) sv.textContent = m.spin ? 'ON' : 'OFF';
                UIRenderer.toast('CURVE CONTROL ' + (m.spin ? 'ENGAGED' : 'DISENGAGED'));
            } else if(type === 'sens'){
                UIRenderer.openPanel('panel-settings');
            }
        });
    });

    bindClick('btn-quick-loadout', function(){ UIRenderer.openPanel('panel-loadout'); });
    bindClick('btn-quick-log', function(){ UIRenderer.openPanel('panel-log'); });
    bindClick('btn-quick-profile', function(){ UIRenderer.openPanel('panel-profile'); });
    bindClick('btn-open-settings-game', function(){ UIRenderer.openPanel('panel-settings'); });

    bindClick('btn-pause', function(){
        var m = state.match;
        if(!m || !GameStateManager.pause()) return;
        UIRenderer.openModal('modal-pause');
        SFX.open();
    });

    bindClick('btn-resume', function(){
        if(!GameStateManager.resume()) return;
        UIRenderer.closeModal('modal-pause');
        SFX.close();
    });

    bindClick('btn-restart', function(){
        UIRenderer.closeModal('modal-pause');
        var m = state.match;
        endMatchCleanup();
        startMatch(m ? m.mode : 'quick', m ? m.opponent : 'CYBER_VOID');
    });

    bindClick('btn-pause-settings', function(){ UIRenderer.openPanel('panel-settings'); });

    bindClick('btn-quit', function(){
        UIRenderer.closeModal('modal-pause');
        GameStateManager.shutdownMatch(true);
        renderProfile();
        UIRenderer.showScreen('screen-menu');
    });

    bindClick('btn-rematch', function(){
        UIRenderer.closeModal('modal-gameover');
        var last = state.matchHistory[0];
        startMatch(state.match ? state.match.mode : 'quick', last ? last.opp : 'CYBER_VOID');
    });

    bindClick('btn-gameover-menu', function(){
        UIRenderer.closeModal('modal-gameover');
        GameStateManager.shutdownMatch(true);
        UIRenderer.showScreen('screen-menu');
    });

    bindClick('toggle-sound', function(){
        state.settings.sound = !state.settings.sound;
        syncSettingsUI();
        SFX.click();
    });

    bindClick('toggle-haptics', function(){
        state.settings.haptics = !state.settings.haptics;
        syncSettingsUI();
        SFX.click();
        if(state.settings.haptics) haptic(30);
    });

    qsa('.btn-diff').forEach(function(b){
        b.addEventListener('click', function(){
            state.settings.difficulty = b.dataset.val;
            syncSettingsUI();
            SFX.click();
            UIRenderer.toast('DIFFICULTY: ' + state.settings.difficulty.toUpperCase());
        });
    });

    var _sl = helper$('sensitivity-slider') || helper$('sens-slider');
    if(_sl) _sl.addEventListener('input', function(e){ state.settings.sensitivity = parseInt(e.target.value, 10); });

    qsa('.btn-close-panel').forEach(function(btn){
        btn.addEventListener('click', function(){
            if(window.UIRenderer) UIRenderer.closePanel();
            if(window.SFX) SFX.click();
        });
    });

    bindClick('panel-backdrop', function(){
        if(window.UIRenderer) UIRenderer.closePanel();
    });
}

function finishMatch(result){
    var m = state.match;
    if(!m || !GameStateManager.finishMatch(result)) return;
    var playerScore = 10 - m.aiRemaining;
    var aiScore = 10 - m.playerRemaining;
    var icon = helper$('go-icon'), title = helper$('go-title'), sub = helper$('go-subtitle');
    if(result === 'win'){
        if(icon) { icon.textContent = 'emoji_events'; icon.className = 'material-symbols-outlined text-5xl fill-icon text-primary neon-text'; }
        if(title) { title.textContent = 'VICTORY'; title.className = 'font-display text-2xl italic-techno tracking-widest text-primary neon-text'; }
        if(sub) sub.textContent = 'Arena Cleared';
        state.profile.wins++; state.profile.streak++;
        SFX.win(); haptic(60);
    } else if(result === 'lose'){
        if(icon) { icon.textContent = 'dangerous'; icon.className = 'material-symbols-outlined text-5xl fill-icon text-magenta'; }
        if(title) { title.textContent = 'DEFEAT'; title.className = 'font-display text-2xl italic-techno tracking-widest text-magenta'; }
        if(sub) sub.textContent = 'Core Breached';
        state.profile.losses++; state.profile.streak = 0;
        SFX.lose(); haptic(60);
    } else {
        if(icon) { icon.textContent = 'balance'; icon.className = 'material-symbols-outlined text-5xl fill-icon text-secondary-light'; }
        if(title) { title.textContent = 'DRAW'; title.className = 'font-display text-2xl italic-techno tracking-widest text-secondary-light'; }
        if(sub) sub.textContent = 'Stalemate Protocol';
    }
    var goScore = helper$('go-score');
    if (goScore) goScore.textContent = playerScore + ' : ' + aiScore;
    var goXp = helper$('go-xp');
    if (goXp) goXp.textContent = '+' + (result === 'win' ? 240 : result === 'lose' ? 60 : 120);
    state.matchHistory.unshift({
        opp: m.opponent,
        result: result === 'win' ? 'W' : (result === 'lose' ? 'L' : 'D'),
        score: playerScore + '-' + aiScore,
        mode: m.mode.toUpperCase()
    });
    if(state.matchHistory.length > 20) state.matchHistory.pop();
    renderProfile();
    renderLog();
    UIRenderer.openModal('modal-gameover');
}

function runBoot(){
    var bar = helper$('boot-bar');
    var label = helper$('boot-label');
    var labels = ['Initializing systems...', 'Calibrating optics...', 'Syncing arena grid...', 'Loading pilot data...', 'Ready.'];
    var pct = 0;
    var li = 0;
    var targetPct = 0;
    var lastUpdate = performance.now();
    var started = false;
    
    function bootLoop(time) {
        if (started) return;
        if (time - lastUpdate > 100 && targetPct < 100) {
            targetPct += rand(8, 20);
            if (targetPct > 100) targetPct = 100;
            lastUpdate = time;
        }
        
        pct += (targetPct - pct) * 0.15;
        if (pct >= 99.5) pct = 100;
        
        if (bar) bar.style.width = pct + '%';
        
        var newLi = Math.min(labels.length-1, Math.floor((pct/100) * (labels.length-1)));
        if(newLi !== li){ li = newLi; if(label) label.textContent = labels[li]; }
        
        if(pct >= 100){
            started = true;
            setTimeout(function(){ enterMenu(); }, 300);
            return;
        }
        
        requestAnimationFrame(bootLoop);
    }
    
    bindClick('screen-boot', function(){
        if(started) return;
        started = true;
        pct = 100;
        targetPct = 100;
        if(bar) bar.style.width = '100%';
        if(label) label.textContent = labels[labels.length - 1];
        enterMenu();
    });
    
    requestAnimationFrame(bootLoop);
}

let lastTime = 0;

function mainGameLoop(ts) {
    if (!lastTime) lastTime = ts;
    let frameTime = (ts - lastTime) / 1000;
    lastTime = ts;
    let alpha = window.GameStateManager ? GameStateManager.advanceSimulation(frameTime) : 0;
    
    if (window.GameStateManager) {
        if (window.Renderer) {
            Renderer.render(GameStateManager.getState(), alpha);
        }
        if (window.EffectsManager) {
            EffectsManager.render(GameStateManager.getState());
        }
    }
    
    if (window.EffectsManager) {
        EffectsManager.update(frameTime);
    }
    
    requestAnimationFrame(mainGameLoop);
}

function init() {
    setupEventListeners();
    if (window.EffectsManager) {
        EffectsManager.spawnParticles('boot-particles', 60);
        EffectsManager.spawnParticles('game-particles', 40);
    }
    if (window.CupManager) CupManager.buildCups();
    if (window.CameraController) {
        CameraController.setupCamera();
        CameraController.applyArenaTheme('neon');
    }
    runBoot();
    requestAnimationFrame(ts => { lastTime = ts; mainGameLoop(ts); });
}

function enterMenu() {
    if(window.UIRenderer) UIRenderer.showScreen('screen-menu');
    syncSettingsUI();
    renderBracket();
    renderLobby();
    renderSkins();
    renderArenas();
    renderProfile();
    renderLog();
    if(window.SFX) SFX.open();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function renderLog(){
    var c = helper$('log-list');
    if (!c) return;
    c.innerHTML = '';
    state.matchHistory.forEach(function(m){
        var div = document.createElement('div');
        div.className = 'bg-surface-light border border-white/5 p-4 rounded-xl flex justify-between items-center';
        var color = m.result === 'W' ? 'text-primary' : (m.result === 'L' ? 'text-magenta' : 'text-secondary-light');
        div.innerHTML = '<div class="flex flex-col"><span class="font-display tracking-widest text-sm text-secondary-light mb-1">' + m.mode + ' vs ' + m.opp + '</span>' +
                        '<span class="font-bold text-xl ' + color + '">' + (m.result === 'W' ? 'VICTORY' : (m.result === 'L' ? 'DEFEAT' : 'DRAW')) + '</span></div>' +
                        '<div class="font-mono text-2xl text-white/90">' + m.score + '</div>';
        c.appendChild(div);
    });
}

function renderBracket(){
    var c = helper$('tourney-bracket') || helper$('bracket-list'); if (!c) return;
    c.innerHTML = '';
    OPPONENTS.forEach(function(o, i){
        var div = document.createElement('div');
        div.className = 'bg-surface-light border border-white/5 p-4 rounded-xl flex items-center justify-between mb-3';
        div.innerHTML = '<div class="flex items-center"><div class="w-8 h-8 rounded bg-primary/20 flex items-center justify-center mr-4"><span class="font-display text-primary">' + (i+1) + '</span></div>' +
                        '<div class="flex flex-col"><span class="font-bold text-white/90">' + o.name + '</span><span class="text-xs text-secondary-light uppercase tracking-widest">' + o.rank + '</span></div></div>' +
                        '<button class="btn-play-tourney material-symbols-outlined fill-icon text-3xl text-primary opacity-70 hover:opacity-100 transition-opacity" data-idx="'+i+'">play_circle</button>';
        c.appendChild(div);
    });
    qsa('.btn-play-tourney', c).forEach(function(btn){
        btn.addEventListener('click', function(){ startMatch('tourney', OPPONENTS[btn.dataset.idx].name); });
    });
}

function renderLobby(){
    var c = helper$('lobby-list'); if (!c) return;
    c.innerHTML = '';
    OPPONENTS.forEach(function(o, i){
        var div = document.createElement('div');
        div.className = 'bg-surface-light border border-white/5 p-4 rounded-xl flex items-center justify-between mb-3';
        div.innerHTML = '<div class="flex items-center"><div class="w-2 h-2 rounded-full bg-primary animate-pulse mr-4"></div>' +
                        '<div class="flex flex-col"><span class="font-bold text-white/90">' + o.name + '</span><span class="text-xs text-secondary-light uppercase tracking-widest">WR: ' + o.winrate + '</span></div></div>' +
                        '<button class="btn-play-quick px-4 py-2 bg-primary/10 text-primary font-bold rounded hover:bg-primary/20 transition-colors uppercase tracking-widest text-sm" data-idx="'+i+'">CHALLENGE</button>';
        c.appendChild(div);
    });
    qsa('.btn-play-quick', c).forEach(function(btn){
        btn.addEventListener('click', function(){ startMatch('quick', OPPONENTS[btn.dataset.idx].name); });
    });
}

function renderSkins(){
    var c = helper$('skin-grid');
    if (!c) return;
    c.innerHTML = '';
    SKINS.forEach(function(s){
        var div = document.createElement('div');
        var isSel = state.loadout.skin === s.id;
        var canEquip = state.loadout.unlocked.indexOf(s.id) !== -1;
        div.className = 'relative aspect-square rounded-2xl border-2 flex items-center justify-center cursor-pointer overflow-hidden transition-all duration-300 ' + (isSel ? 'border-primary' : 'border-white/10 opacity-70 hover:opacity-100');
        var bg = document.createElement('div');
        bg.className = 'absolute inset-0 opacity-20';
        bg.style.backgroundColor = s.color;
        var ball = document.createElement('div');
        ball.className = 'w-16 h-16 rounded-full shadow-[inset_-4px_-4px_12px_rgba(0,0,0,0.6)] relative z-10';
        ball.style.backgroundColor = s.color;
        if(!canEquip){
            var lck = document.createElement('span');
            lck.className = 'material-symbols-outlined absolute inset-0 m-auto w-8 h-8 flex items-center justify-center text-white/50 z-20';
            lck.textContent = 'lock';
            div.appendChild(lck);
            div.classList.add('grayscale');
        }
        div.appendChild(bg);
        div.appendChild(ball);
        div.addEventListener('click', function(){
            if(!canEquip){ UIRenderer.toast('SKIN LOCKED'); SFX.miss(); return; }
            state.loadout.skin = s.id;
            renderSkins();
            document.documentElement.style.setProperty('--ball-color', s.color);
            SFX.click();
        });
        c.appendChild(div);
    });
}

function renderArenas(){
    var c = helper$('arena-grid');
    if (!c) return;
    c.innerHTML = '';
    ARENAS.forEach(function(a){
        var div = document.createElement('div');
        var isSel = state.loadout.arena === a.id;
        div.className = 'relative h-24 rounded-2xl border-2 flex items-center justify-center cursor-pointer overflow-hidden transition-all duration-300 ' + (isSel ? 'border-primary' : 'border-white/10 opacity-70 hover:opacity-100');
        var bg = document.createElement('div');
        bg.className = 'absolute inset-0 opacity-30';
        bg.style.backgroundColor = a.color;
        var name = document.createElement('span');
        name.className = 'relative z-10 font-display tracking-widest text-sm font-bold text-white';
        name.textContent = a.name.toUpperCase();
        div.appendChild(bg);
        div.appendChild(name);
        div.addEventListener('click', function(){
            state.loadout.arena = a.id;
            renderArenas();
            CameraController.applyArenaTheme(a.id);
            SFX.click();
        });
        c.appendChild(div);
    });
}

function renderProfile(){
    var p = state.profile;
    var wr = p.wins + p.losses > 0 ? Math.round((p.wins / (p.wins + p.losses)) * 100) : 0;
    qsa('.prof-name').forEach(function(el){ el.textContent = p.name; });
    qsa('.prof-rank').forEach(function(el){ el.textContent = p.rank; });
    qsa('.prof-level').forEach(function(el){ el.textContent = p.level; });
    var pw = helper$('profile-wins'); if (pw) pw.textContent = p.wins;
    var pl = helper$('profile-losses'); if (pl) pl.textContent = p.losses;
    var pwr = helper$('profile-winrate'); if (pwr) pwr.textContent = wr + '%';
    var ps = helper$('profile-streak'); if (ps) ps.textContent = p.streak;
}

function syncSettingsUI(){
    var ts = helper$('toggle-sound');
    if(ts) {
        ts.className = 'toggle-switch w-12 h-7 rounded-full relative transition-transform duration-300 ease-out ' + (state.settings.sound ? 'bg-primary' : 'bg-surface-light');
        var knob = ts.querySelector('.knob');
        if(knob) knob.style.transform = state.settings.sound ? 'translateX(20px)' : 'translateX(0)';
    }
    var th = helper$('toggle-haptics');
    if(th) {
        th.className = 'toggle-switch w-12 h-7 rounded-full relative transition-transform duration-300 ease-out ' + (state.settings.haptics ? 'bg-primary' : 'bg-surface-light');
        var knob2 = th.querySelector('.knob');
        if(knob2) knob2.style.transform = state.settings.haptics ? 'translateX(20px)' : 'translateX(0)';
    }
    qsa('.btn-diff').forEach(function(b){
        if(b.dataset.val === state.settings.difficulty){ b.classList.add('bg-primary', 'text-surface'); b.classList.remove('bg-surface-light', 'text-white/70'); }
        else { b.classList.remove('bg-primary', 'text-surface'); b.classList.add('bg-surface-light', 'text-white/70'); }
    });
    var sl = helper$('sensitivity-slider') || helper$('sens-slider');
    if(sl) sl.value = state.settings.sensitivity;
}

function runDiagnostics(){
    var g = helper$('sys-graph');
    if (!g) return;
    g.innerHTML = '';
    for(var i=0;i<24;i++){
        var bar = document.createElement('div');
        bar.className = 'w-2 bg-primary/40 rounded-t';
        bar.style.height = rand(20, 100) + '%';
        g.appendChild(bar);
    }
    setInterval(function(){
        if(state.activePanel !== 'panel-log') return;
        if(g.firstChild) g.removeChild(g.firstChild);
        var bar = document.createElement('div');
        bar.className = 'w-2 bg-primary/60 rounded-t';
        bar.style.height = rand(20, 100) + '%';
        g.appendChild(bar);
    }, 400);
}

function newMatchState(mode, opponent){
    return GameStateManager.createMatch(mode, opponent);
}

function startMatch(mode, opponent){
    UIRenderer.closePanel();
    GameStateManager.beginMatch(mode, opponent || 'CYBER_VOID');
    CupManager.buildCups();
    BallController.resetBallPosition('player');
    UIRenderer.showScreen('screen-game');
    Renderer.sizeAimSvg();
    resetAimHud();
    GameStateManager.completeInitialization();
    
    startTimer();
    UIRenderer.toast((mode || 'QUICK').toUpperCase() + ' MATCH VS ' + (opponent || 'CYBER_VOID'));
}

function endMatchCleanup(){
    GameStateManager.shutdownMatch(false);
}

function startTimer(){
    var m = state.match;
    var timerEl = helper$('game-timer');
    if(timerEl) {
        timerEl.textContent = m.timer;
        timerEl.style.color = '#00f3ff';
    }
    GameStateManager.startTimer(function(){
        if(timerEl) {
            if(m.timer <= 15) timerEl.style.color = '#ff5566';
            if(m.timer <= 0) timerEl.textContent = '00';
            else timerEl.textContent = m.timer < 10 ? '0'+m.timer : m.timer;
        }
        if(m.timer <= 5 && m.timer > 0) SFX.click();
    }, function(){
            if(m.playerRemaining === m.aiRemaining && GameStateManager.startOvertime(30)){
                if(timerEl) timerEl.style.color = '#ffd23f';
                UIRenderer.toast('OVERTIME PROTOCOL ACTIVATED');
                SFX.open();
                startTimer();
            } else {
                finishMatch(m.playerRemaining < m.aiRemaining ? 'win' : (m.aiRemaining < m.playerRemaining ? 'lose' : 'draw'));
            }
    });
}

// Ensure any missing UI functions that use original names are mapped to UIRenderer methods:
window.toast = UIRenderer.toast;
window.showScreen = UIRenderer.showScreen;
window.openPanel = UIRenderer.openPanel;
window.closePanel = UIRenderer.closePanel;
window.openModal = UIRenderer.openModal;
window.closeModal = UIRenderer.closeModal;
