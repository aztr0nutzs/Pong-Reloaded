const fs = require('fs');

const utilCode = `
function $(id){ return document.getElementById(id); }
function qsa(sel, ctx){ return Array.prototype.slice.call((ctx||document).querySelectorAll(sel)); }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function rand(min,max){ return Math.random()*(max-min)+min; }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
window.$ = $;
window.qsa = qsa;
window.clamp = clamp;
window.rand = rand;
window.pick = pick;
`;

const stateCode = `
window.state = {
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
  match: null
};

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
`;

fs.writeFileSync('app/src/main/assets/js/modules/GameState.js', stateCode);
fs.writeFileSync('app/src/main/assets/js/modules/Util.js', utilCode);
console.log('GameState and Util generated');
