class GameStateManager {
    static STATES = Object.freeze({
      MENU: 'MENU',
      MATCH_INITIALIZING: 'MATCH_INITIALIZING',
      PLAYER_AIM: 'PLAYER_AIM',
      PLAYER_THROW: 'PLAYER_THROW',
      BALL_ACTIVE: 'BALL_ACTIVE',
      TURN_RESOLVING: 'TURN_RESOLVING',
      AI_AIM: 'AI_AIM',
      AI_THROW: 'AI_THROW',
      PAUSED: 'PAUSED',
      GAME_OVER: 'GAME_OVER'
    });

    static lifecycle = 'MENU';
    static generation = 0;
    static ownedHandles = [];
    static pausedFrom = null;

    static state = {
      screen: 'boot',
      activePanel: null,
      settings: { sound:true, haptics:true, difficulty:'normal', sensitivity:70 },
      profile: { name:'COMMANDER_01', level:99, rank:'ELITE IV', wins:1240, losses:572, streak:7 },
      loadout: { skin:'cyan', unlocked:['cyan','purple','magenta'], arena:'neon' },
      matchHistory: [
        { opp:'CYBER_VOID', result:'W', score:'10-6', mode:'RANKED' },
        { opp:'GHOST_PROTOCOL', result:'W', score:'10-8', mode:'QUICK' },
        { opp:'NULL_SECTOR', result:'L', score:'7-10', mode:'TOURNEY' },
        { opp:'RAZOR_WIRE', result:'W', score:'10-3', mode:'QUICK' }
      ],
      match: null,
      ball: {
        active: false,
        x: 0, y: 0, z: 0,
        prevX: 0, prevY: 0, prevZ: 0,
        position: { x: 0, y: 0, z: 0 },
        previousPosition: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0 },
        airborne: false,
        contactState: { type: 'none', cupElement: null },
        activeContacts: [],
        scaleDepth: 1, shadowScale: 1, shadowOpacity: 0
      },
      throwAnim: null,
      aim: {
        phase: 'none',
        crosshair: { x: 0, y: 0, show: false, locked: false },
        shotSolution: null,
        powerPct: 0,
        statsHudData: { show: false }
      },
      particleSystems: []
    };
    
    static getState() {
        return GameStateManager.state;
    }

    static getLifecycle() {
        return GameStateManager.lifecycle;
    }

    static seedFrom(value) {
        var text = String(value);
        var hash = 2166136261;
        for (var index = 0; index < text.length; index++) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0 || 1;
    }

    static createMatch(mode, opponent, seed) {
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
          score: { player: 0, ai: 0 },
          power: 75,
          powerDir: 1,
          turn: 'player',
          busy: false,
          activeBall: false,
          activeThrow: null,
          trickArmed: false,
          trickMeter: 0,
          wind: 'LOW',
          spin: false,
          attempts: 0,
          hits: 0,
          accuracy: 0,
          result: null,
          seed: seed === undefined ? GameStateManager.seedFrom(mode + '|' + opponent + '|' + GameStateManager.generation) :
            (Number.isFinite(seed) ? (seed >>> 0 || 1) : GameStateManager.seedFrom(seed)),
          aiDecisionIndex: 0,
          generation: GameStateManager.generation,
          scoredCups: { player: Object.create(null), ai: Object.create(null) },
          timerHandle: null,
          powerHandle: null
        };
    }

    static beginMatch(mode, opponent, seed) {
        GameStateManager.shutdownMatch(false);
        GameStateManager.generation++;
        GameStateManager.state.match = GameStateManager.createMatch(mode, opponent, seed);
        GameStateManager.lifecycle = GameStateManager.STATES.MATCH_INITIALIZING;
        GameStateManager.clearPrediction();
        return GameStateManager.state.match;
    }

    static completeInitialization() {
        return GameStateManager.transition(GameStateManager.STATES.PLAYER_AIM);
    }

    static transition(next) {
        var current = GameStateManager.lifecycle;
        var S = GameStateManager.STATES;
        var allowed = {};
        allowed[S.MENU] = [S.MATCH_INITIALIZING];
        allowed[S.MATCH_INITIALIZING] = [S.PLAYER_AIM, S.MENU];
        allowed[S.PLAYER_AIM] = [S.PLAYER_THROW, S.PAUSED, S.GAME_OVER, S.MENU];
        allowed[S.PLAYER_THROW] = [S.BALL_ACTIVE, S.GAME_OVER, S.MENU];
        allowed[S.BALL_ACTIVE] = [S.TURN_RESOLVING, S.PAUSED, S.GAME_OVER, S.MENU];
        allowed[S.TURN_RESOLVING] = [S.AI_AIM, S.PLAYER_AIM, S.GAME_OVER, S.MENU];
        allowed[S.AI_AIM] = [S.AI_THROW, S.PAUSED, S.GAME_OVER, S.MENU];
        allowed[S.AI_THROW] = [S.BALL_ACTIVE, S.GAME_OVER, S.MENU];
        allowed[S.PAUSED] = [S.MENU, S.GAME_OVER];
        allowed[S.GAME_OVER] = [S.MATCH_INITIALIZING, S.MENU];
        if (!allowed[current] || allowed[current].indexOf(next) === -1) return false;
        GameStateManager.lifecycle = next;
        GameStateManager.synchronizeMatchFlags();
        return true;
    }

    static synchronizeMatchFlags() {
        var m = GameStateManager.state.match;
        if (!m) return;
        var S = GameStateManager.STATES;
        m.paused = GameStateManager.lifecycle === S.PAUSED;
        m.activeBall = GameStateManager.lifecycle === S.BALL_ACTIVE;
        m.busy = [S.PLAYER_THROW, S.BALL_ACTIVE, S.TURN_RESOLVING, S.AI_THROW].indexOf(GameStateManager.lifecycle) !== -1;
        m.active = GameStateManager.lifecycle !== S.MENU && GameStateManager.lifecycle !== S.GAME_OVER;
        if (GameStateManager.lifecycle === S.PLAYER_AIM || GameStateManager.lifecycle === S.PLAYER_THROW) m.turn = 'player';
        if (GameStateManager.lifecycle === S.AI_AIM || GameStateManager.lifecycle === S.AI_THROW) m.turn = 'ai';
        GameStateManager.state.ball.active = m.active;
    }

    static setBallVisible(visible) {
        GameStateManager.state.ball.active = !!visible;
    }

    static canPlayerAim() {
        var m = GameStateManager.state.match;
        return !!m && m.generation === GameStateManager.generation &&
          GameStateManager.lifecycle === GameStateManager.STATES.PLAYER_AIM;
    }

    static claimPlayerThrow() {
        var m = GameStateManager.state.match;
        if (!GameStateManager.canPlayerAim() || !GameStateManager.transition(GameStateManager.STATES.PLAYER_THROW)) return null;
        m.attempts++;
        m.activeThrow = 'player';
        GameStateManager.clearPrediction();
        GameStateManager.transition(GameStateManager.STATES.BALL_ACTIVE);
        return m.generation;
    }

    static claimAiThrow() {
        var m = GameStateManager.state.match;
        if (!m || GameStateManager.lifecycle !== GameStateManager.STATES.AI_AIM ||
            !GameStateManager.transition(GameStateManager.STATES.AI_THROW)) return null;
        m.activeThrow = 'ai';
        GameStateManager.transition(GameStateManager.STATES.BALL_ACTIVE);
        return m.generation;
    }

    static consumeAiDecisionIndex() {
        var m = GameStateManager.state.match;
        if (!m || m.activeThrow !== 'ai' || GameStateManager.lifecycle !== GameStateManager.STATES.BALL_ACTIVE) return null;
        return m.aiDecisionIndex++;
    }
    static resolveThrow(side, hit, cupKey) {
        var m = GameStateManager.state.match;
        if (!m || m.activeThrow !== side || GameStateManager.lifecycle !== GameStateManager.STATES.BALL_ACTIVE ||
            !GameStateManager.transition(GameStateManager.STATES.TURN_RESOLVING)) return false;
        var scored = !!hit && cupKey !== undefined && cupKey !== null && !m.scoredCups[side][cupKey];
        if (scored) {
            m.scoredCups[side][cupKey] = true;
            if (side === 'player') {
                m.hits++;
                m.score.player++;
                m.aiRemaining = Math.max(0, 10 - m.score.player);
                m.trickMeter = Math.min(100, m.trickMeter + 16);
            } else {
                m.score.ai++;
                m.playerRemaining = Math.max(0, 10 - m.score.ai);
            }
        }
        m.accuracy = m.attempts ? Math.round((m.hits / m.attempts) * 100) : 0;
        m.activeThrow = null;
        return scored;
    }

    static advanceTurn(side) {
        if (GameStateManager.lifecycle !== GameStateManager.STATES.TURN_RESOLVING) return false;
        return GameStateManager.transition(side === 'player' ? GameStateManager.STATES.AI_AIM : GameStateManager.STATES.PLAYER_AIM);
    }

    static toggleTrickArmed() {
        var m = GameStateManager.state.match;
        if (!GameStateManager.canPlayerAim() || m.trickMeter < 100) return null;
        m.trickArmed = !m.trickArmed;
        return m.trickArmed;
    }

    static disarmTrick() {
        var m = GameStateManager.state.match;
        if (m) m.trickArmed = false;
    }

    static cycleWind() {
        var m = GameStateManager.state.match;
        if (!m || !GameStateManager.canPlayerAim()) return null;
        m.wind = m.wind === 'LOW' ? 'MED' : (m.wind === 'MED' ? 'HIGH' : 'LOW');
        return m.wind;
    }

    static toggleSpin() {
        var m = GameStateManager.state.match;
        if (!m || !GameStateManager.canPlayerAim()) return null;
        m.spin = !m.spin;
        return m.spin;
    }

    static startOvertime(seconds) {
        var m = GameStateManager.state.match;
        if (!m || m.overtimeUsed || m.timer > 0) return false;
        m.overtimeUsed = true;
        m.timer = seconds;
        return true;
    }

    static pause() {
        var S = GameStateManager.STATES;
        if ([S.PLAYER_AIM, S.AI_AIM, S.BALL_ACTIVE].indexOf(GameStateManager.lifecycle) === -1) return false;
        GameStateManager.pausedFrom = GameStateManager.lifecycle;
        return GameStateManager.transition(S.PAUSED);
    }

    static resume() {
        var next = GameStateManager.pausedFrom;
        if (GameStateManager.lifecycle !== GameStateManager.STATES.PAUSED || !next) return false;
        GameStateManager.lifecycle = next;
        GameStateManager.pausedFrom = null;
        GameStateManager.synchronizeMatchFlags();
        return true;
    }

    static isCurrent(generation) {
        var m = GameStateManager.state.match;
        return !!m && m.active && m.generation === generation && GameStateManager.generation === generation;
    }

    static schedule(callback, delay, expectedStates) {
        var generation = GameStateManager.generation;
        var handle = setTimeout(function() {
            GameStateManager.removeHandle(handle);
            if (!GameStateManager.isCurrent(generation)) return;
            if (GameStateManager.lifecycle === GameStateManager.STATES.PAUSED) {
                GameStateManager.schedule(callback, 100, expectedStates);
                return;
            }
            if (expectedStates && expectedStates.indexOf(GameStateManager.lifecycle) === -1) return;
            callback();
        }, delay);
        GameStateManager.ownedHandles.push({ id: handle, interval: false });
        return handle;
    }

    static startTimer(onTick, onExpire) {
        var m = GameStateManager.state.match;
        if (!m) return null;
        var generation = m.generation;
        var handle = setInterval(function() {
            if (!GameStateManager.isCurrent(generation)) return;
            var S = GameStateManager.STATES;
            if ([S.PLAYER_AIM, S.AI_AIM].indexOf(GameStateManager.lifecycle) === -1) return;
            m.timer--;
            if (onTick) onTick(m.timer);
            if (m.timer <= 0) {
                GameStateManager.cancelHandle(handle);
                m.timerHandle = null;
                if (onExpire) onExpire();
            }
        }, 1000);
        GameStateManager.ownedHandles.push({ id: handle, interval: true });
        m.timerHandle = handle;
        return handle;
    }

    static cancelHandle(handle) {
        var entry = GameStateManager.ownedHandles.find(function(item) { return item.id === handle; });
        if (entry && entry.interval) clearInterval(handle); else clearTimeout(handle);
        GameStateManager.removeHandle(handle);
    }

    static removeHandle(handle) {
        GameStateManager.ownedHandles = GameStateManager.ownedHandles.filter(function(item) { return item.id !== handle; });
    }

    static cancelOwnedHandles() {
        GameStateManager.ownedHandles.forEach(function(entry) {
            if (entry.interval) clearInterval(entry.id); else clearTimeout(entry.id);
        });
        GameStateManager.ownedHandles = [];
    }

    static finishMatch(result) {
        var m = GameStateManager.state.match;
        if (!m || !m.active || m.result || GameStateManager.lifecycle === GameStateManager.STATES.GAME_OVER) return false;
        m.result = result;
        m.active = false;
        GameStateManager.cancelOwnedHandles();
        if (window.Physics) window.Physics.stop();
        if (window.Aim && window.Aim.cancelLifecycle) window.Aim.cancelLifecycle();
        GameStateManager.clearPrediction();
        GameStateManager.lifecycle = GameStateManager.STATES.GAME_OVER;
        GameStateManager.synchronizeMatchFlags();
        return true;
    }

    static clearPrediction() {
        var aim = GameStateManager.state.aim;
        aim.phase = 'none';
        aim.shotSolution = null;
        aim.powerPct = 0;
        aim.statsHudData = { show: false };
        aim.crosshair.show = false;
    }

    static shutdownMatch(clearMatch) {
        GameStateManager.cancelOwnedHandles();
        GameStateManager.generation++;
        GameStateManager.pausedFrom = null;
        if (window.Physics) window.Physics.stop();
        if (window.Aim && window.Aim.cancelLifecycle) window.Aim.cancelLifecycle();
        GameStateManager.clearPrediction();
        GameStateManager.state.ball.active = false;
        if (GameStateManager.state.match) GameStateManager.state.match.active = false;
        GameStateManager.lifecycle = GameStateManager.STATES.MENU;
        if (clearMatch !== false) GameStateManager.state.match = null;
    }
    
    static advanceSimulation(elapsedSeconds) {
        if (!window.Physics || GameStateManager.lifecycle !== GameStateManager.STATES.BALL_ACTIVE) return 0;
        return window.Physics.advanceFrame(elapsedSeconds).interpolationAlpha;
    }
}
window.GameStateManager = GameStateManager;
window.state = GameStateManager.state;
window.SKINS = [
  { id:'cyan', name:'Cyan Surge', color:'#00f3ff', locked:false },
  { id:'purple', name:'Violet Wraith', color:'#bd93f9', locked:false },
  { id:'magenta', name:'Magenta Pulse', color:'#ff2e78', locked:false },
  { id:'gold', name:'Gold Overdrive', color:'#ffc233', locked:true }
];
window.ARENAS = [
  { id:'neon', name:'Neon Overdrive', color:'#00f3ff' },
  { id:'space', name:'Deep Space', color:'#bd93f9' }
];
window.OPPONENTS = [
  { name:'CYBER_VOID', rank:'ELITE IV', winrate:'71%' },
  { name:'GHOST_PROTOCOL', rank:'ELITE II', winrate:'64%' },
  { name:'NULL_SECTOR', rank:'DIAMOND I', winrate:'58%' },
  { name:'RAZOR_WIRE', rank:'ELITE V', winrate:'77%' }
];
