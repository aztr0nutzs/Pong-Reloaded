class GameStateManager {
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
    
    // Fixed physics tick step (120Hz)
    static fixedUpdate(dt) {
        if (window.Physics) {
            window.Physics.fixedUpdate(dt);
        }
    }
    
    // Variable state/UI tick step
    static update(dt) {
        // State management updates
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
