const fs = require('fs');
let code = fs.readFileSync('app/src/main/assets/js/modules/Main.js', 'utf8');

// We can just keep the initialization and remaining event listeners.
// Since UIController, GameState, etc. redefined some functions, we should remove the old ones.

// Instead of fragile string replacements, I'll just write a new Main.js that only contains what we didn't extract.
const newMain = `
/* ================= GAMEPLAY CORE ================= */
var Physics = new BeerPongPhysicsEngine();
var Predictor = new TrajectoryPredictor(Physics);
var Thrower = new ThrowController(Physics, Predictor);
var Aim = new InputManager(Physics, Predictor);
window.AI = new AIController(Physics, Predictor, Thrower);

window.addEventListener('resize', Renderer.sizeAimSvg);

function resetAimHud(){ Aim.reset(); }

$('btn-throw').addEventListener('click', function(){
    var m = state.match;
    if(!m || !m.active) return;
    UIController.toast(Aim.phase === 'target' ? 'DRAG TO PLACE YOUR CROSSHAIR TARGET' : 'PULL BACK & RELEASE TO THROW');
    SFX.click();
});

function updateTrickButtonArmedUI(on){
    $('btn-trick-shot').classList.toggle('trick-armed', !!on);
}

$('btn-trick-shot').addEventListener('click', function(){
    var m = state.match;
    if(!m || !m.active || m.paused || m.autoPaused || m.busy || m.turn !== 'player') return;
    if(m.trickMeter < 100){ UIController.toast('TRICK METER CHARGING'); SFX.miss(); return; }
    m.trickArmed = !m.trickArmed;
    updateTrickButtonArmedUI(m.trickArmed);
    UIController.toast(m.trickArmed ? 'TRICK SHOT ARMED — PULL BACK & RELEASE' : 'TRICK SHOT DISARMED');
    SFX.click();
});

qsa('[data-adjust]').forEach(function(btn){
    btn.addEventListener('click', function(){
        var m = state.match;
        if(!m || !m.active) return;
        var type = btn.getAttribute('data-adjust');
        SFX.click();
        if(type === 'wind'){
            m.wind = m.wind === 'LOW' ? 'MED' : (m.wind === 'MED' ? 'HIGH' : 'LOW');
            $('wind-value').textContent = m.wind;
            UIController.toast('WIND SHIFTED: ' + m.wind);
        } else if(type === 'spin'){
            m.spin = !m.spin;
            $('spin-value').textContent = m.spin ? 'ON' : 'OFF';
            UIController.toast('CURVE CONTROL ' + (m.spin ? 'ENGAGED' : 'DISENGAGED'));
        } else if(type === 'sens'){
            UIController.openPanel('panel-settings');
        }
    });
});

$('btn-quick-loadout').addEventListener('click', function(){ UIController.openPanel('panel-loadout'); });
$('btn-quick-log').addEventListener('click', function(){ UIController.openPanel('panel-log'); });
$('btn-quick-profile').addEventListener('click', function(){ UIController.openPanel('panel-profile'); });
$('btn-open-settings-game').addEventListener('click', function(){ UIController.openPanel('panel-settings'); });

$('btn-pause').addEventListener('click', function(){
    var m = state.match;
    if(!m || !m.active) return;
    m.paused = true;
    UIController.openModal('modal-pause');
    SFX.open();
});

$('btn-resume').addEventListener('click', function(){
    if(state.match) state.match.paused = false;
    UIController.closeModal('modal-pause');
    SFX.close();
});

$('btn-restart').addEventListener('click', function(){
    UIController.closeModal('modal-pause');
    var m = state.match;
    endMatchCleanup();
    startMatch(m.mode, m.opponent);
});

$('btn-pause-settings').addEventListener('click', function(){ UIController.openPanel('panel-settings'); });

$('btn-quit').addEventListener('click', function(){
    UIController.closeModal('modal-pause');
    endMatchCleanup();
    renderProfile();
    UIController.showScreen('screen-menu');
});

function finishMatch(result){
    var m = state.match;
    endMatchCleanup();
    var playerScore = 10 - m.aiRemaining;
    var aiScore = 10 - m.playerRemaining;
    var icon = $('go-icon'), title = $('go-title'), sub = $('go-subtitle');
    if(result === 'win'){
        icon.textContent = 'emoji_events'; icon.className = 'material-symbols-outlined text-5xl fill-icon text-primary neon-text';
        title.textContent = 'VICTORY'; title.className = 'font-display text-2xl italic-techno tracking-widest text-primary neon-text';
        sub.textContent = 'Arena Cleared';
        state.profile.wins++; state.profile.streak++;
        SFX.win(); haptic(60);
    } else if(result === 'lose'){
        icon.textContent = 'dangerous'; icon.className = 'material-symbols-outlined text-5xl fill-icon text-magenta';
        title.textContent = 'DEFEAT'; title.className = 'font-display text-2xl italic-techno tracking-widest text-magenta';
        sub.textContent = 'Core Breached';
        state.profile.losses++; state.profile.streak = 0;
        SFX.lose(); haptic(60);
    } else {
        icon.textContent = 'balance'; icon.className = 'material-symbols-outlined text-5xl fill-icon text-secondary-light';
        title.textContent = 'DRAW'; title.className = 'font-display text-2xl italic-techno tracking-widest text-secondary-light';
        sub.textContent = 'Stalemate Protocol';
    }
    $('go-score').textContent = playerScore + ' : ' + aiScore;
    $('go-xp').textContent = '+' + (result === 'win' ? 240 : result === 'lose' ? 60 : 120);
    state.matchHistory.unshift({
        opp: m.opponent,
        result: result === 'win' ? 'W' : (result === 'lose' ? 'L' : 'D'),
        score: playerScore + '-' + aiScore,
        mode: m.mode.toUpperCase()
    });
    if(state.matchHistory.length > 20) state.matchHistory.pop();
    renderProfile();
    renderLog();
    UIController.openModal('modal-gameover');
}

$('btn-rematch').addEventListener('click', function(){
    UIController.closeModal('modal-gameover');
    var last = state.matchHistory[0];
    startMatch(state.match ? state.match.mode : 'quick', last ? last.opp : 'CYBER_VOID');
});

$('btn-gameover-menu').addEventListener('click', function(){
    UIController.closeModal('modal-gameover');
    UIController.showScreen('screen-menu');
});

function runBoot(){
    var bar = $('boot-bar');
    var label = $('boot-label');
    var labels = ['Initializing systems...', 'Calibrating optics...', 'Syncing arena grid...', 'Loading pilot data...', 'Ready.'];
    var pct = 0;
    var li = 0;
    var handle = setInterval(function(){
        pct += rand(6, 14);
        if(pct >= 100){ pct = 100; }
        bar.style.width = pct + '%';
        var newLi = Math.min(labels.length-1, Math.floor((pct/100) * (labels.length-1)));
        if(newLi !== li){ li = newLi; label.textContent = labels[li]; }
        if(pct >= 100){
            clearInterval(handle);
            setTimeout(function(){ enterMenu(); }, 300);
        }
    }, 180);
    $('screen-boot').addEventListener('click', function(){
        clearInterval(handle);
        enterMenu();
    }, { once:true });
}

var enteredMenu = false;
function enterMenu(){
    if(enteredMenu) return;
    enteredMenu = true;
    UIController.showScreen('screen-menu');
}

function init(){
    Effects.spawnParticles('boot-particles', 22);
    Effects.spawnParticles('game-particles', 16);
    CupManager.buildCups();
    renderProfile();
    renderLog();
    renderBracket();
    renderLobby();
    renderSkins();
    renderArenas();
    CameraController.applyArenaTheme(state.loadout.arena);
    runDiagnostics();
    syncSettingsUI();
    document.documentElement.style.setProperty('--ball-color', '#00f3ff');
    Renderer.sizeAimSvg();
    runBoot();
}

document.addEventListener('DOMContentLoaded', init);

` + 
// We must keep the other render functions that were not in UIController.js
`
function renderLog(){
    var c = $('log-list');
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
    var c = $('tourney-bracket');
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
    var c = $('lobby-players');
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
    var c = $('skin-grid');
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
            if(!canEquip){ UIController.toast('SKIN LOCKED'); SFX.miss(); return; }
            state.loadout.skin = s.id;
            renderSkins();
            document.documentElement.style.setProperty('--ball-color', s.color);
            SFX.click();
        });
        c.appendChild(div);
    });
}

function renderArenas(){
    var c = $('arena-grid');
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
    $('stat-wins').textContent = p.wins;
    $('stat-losses').textContent = p.losses;
    $('stat-wr').textContent = wr + '%';
    $('stat-streak').textContent = p.streak;
}

function syncSettingsUI(){
    $('tog-sound').textContent = state.settings.sound ? 'toggle_on' : 'toggle_off';
    $('tog-sound').className = 'material-symbols-outlined text-4xl cursor-pointer transition-colors ' + (state.settings.sound ? 'text-primary' : 'text-white/30');
    $('tog-haptic').textContent = state.settings.haptics ? 'toggle_on' : 'toggle_off';
    $('tog-haptic').className = 'material-symbols-outlined text-4xl cursor-pointer transition-colors ' + (state.settings.haptics ? 'text-primary' : 'text-white/30');
    qsa('.btn-diff').forEach(function(b){
        if(b.dataset.val === state.settings.difficulty){ b.classList.add('bg-primary', 'text-surface'); b.classList.remove('bg-surface-light', 'text-white/70'); }
        else { b.classList.remove('bg-primary', 'text-surface'); b.classList.add('bg-surface-light', 'text-white/70'); }
    });
    $('sens-slider').value = state.settings.sensitivity;
}

$('tog-sound').addEventListener('click', function(){ state.settings.sound = !state.settings.sound; syncSettingsUI(); SFX.click(); });
$('tog-haptic').addEventListener('click', function(){ state.settings.haptics = !state.settings.haptics; syncSettingsUI(); SFX.click(); if(state.settings.haptics) haptic(30); });
qsa('.btn-diff').forEach(function(b){
    b.addEventListener('click', function(){
        state.settings.difficulty = b.dataset.val;
        syncSettingsUI();
        SFX.click();
        UIController.toast('DIFFICULTY: ' + state.settings.difficulty.toUpperCase());
    });
});
$('sens-slider').addEventListener('input', function(e){ state.settings.sensitivity = parseInt(e.target.value, 10); });

function runDiagnostics(){
    var g = $('sys-graph');
    g.innerHTML = '';
    for(var i=0;i<24;i++){
        var bar = document.createElement('div');
        bar.className = 'w-2 bg-primary/40 rounded-t';
        bar.style.height = rand(20, 100) + '%';
        g.appendChild(bar);
    }
    setInterval(function(){
        if(state.activePanel !== 'panel-log') return;
        g.removeChild(g.firstChild);
        var bar = document.createElement('div');
        bar.className = 'w-2 bg-primary/60 rounded-t';
        bar.style.height = rand(20, 100) + '%';
        g.appendChild(bar);
    }, 400);
}

function newMatchState(mode, opponent){
    return {
        mode: mode,
        opponent: opponent,
        active: true,
        paused: false,
        autoPaused: false,
        timer: 90,
        overtimeUsed: false,
        playerRemaining: 10,
        aiRemaining: 10,
        power: 75,
        powerDir: 1,
        turn: 'player',
        busy: false,
        trickArmed: false,
        trickMeter: 0,
        wind: 'LOW',
        spin: false,
        attempts: 0,
        hits: 0,
        timerHandle: null,
        powerHandle: null
    };
}

function startMatch(mode, opponent){
    UIController.closePanel();
    state.match = newMatchState(mode, opponent || 'CYBER_VOID');
    CupManager.buildCups();
    BallController.resetBallPosition('player');
    Renderer.updateGameHUD();
    UIController.showScreen('screen-game');
    Renderer.sizeAimSvg();
    resetAimHud();
    startPowerLoop();
    startTimer();
    UIController.toast((mode || 'QUICK').toUpperCase() + ' MATCH VS ' + (opponent || 'CYBER_VOID'));
}

function endMatchCleanup(){
    var m = state.match;
    if(!m) return;
    if(m.timerHandle) clearInterval(m.timerHandle);
    if(m.powerHandle) cancelAnimationFrame(m.powerHandle);
    m.active = false;
}

function startTimer(){
    var m = state.match;
    $('timer-display').textContent = m.timer;
    $('timer-display').style.color = '#00f3ff';
    m.timerHandle = setInterval(function(){
        if(m.paused || m.autoPaused || !m.active || m.busy) return;
        m.timer--;
        if(m.timer <= 15) $('timer-display').style.color = '#ff5566';
        if(m.timer <= 5 && m.timer > 0) SFX.click();
        if(m.timer <= 0){
            $('timer-display').textContent = '00';
            clearInterval(m.timerHandle);
            if(m.playerRemaining === m.aiRemaining && !m.overtimeUsed){
                m.overtimeUsed = true;
                m.timer = 30;
                $('timer-display').style.color = '#ffd23f';
                UIController.toast('OVERTIME PROTOCOL ACTIVATED');
                SFX.open();
                startTimer();
            } else {
                finishMatch(m.playerRemaining < m.aiRemaining ? 'win' : (m.aiRemaining < m.playerRemaining ? 'lose' : 'draw'));
            }
        } else {
            $('timer-display').textContent = m.timer < 10 ? '0'+m.timer : m.timer;
        }
    }, 1000);
}

function startPowerLoop(){
    var m = state.match;
    var lastTime = 0;
    function loop(ts){
        if(!m.active) return;
        if(!m.paused && !m.autoPaused && !m.busy){
            var dt = lastTime ? (ts - lastTime) / 1000 : 0.016;
            var speed = 80 + state.settings.sensitivity * 1.4;
            m.power += speed * m.powerDir * dt;
            if(m.power >= 100){ m.power = 100; m.powerDir = -1; }
            if(m.power <= 0){ m.power = 0; m.powerDir = 1; }
        }
        lastTime = ts;
        m.powerHandle = requestAnimationFrame(loop);
    }
    m.powerHandle = requestAnimationFrame(loop);
}

// Ensure any missing UI functions that use original names are mapped to UIController methods:
window.toast = UIController.toast;
window.showScreen = UIController.showScreen;
window.openPanel = UIController.openPanel;
window.closePanel = UIController.closePanel;
window.openModal = UIController.openModal;
window.closeModal = UIController.closeModal;
`;

fs.writeFileSync('app/src/main/assets/js/modules/Main.js', newMain);
console.log("Main.js updated and pruned");
