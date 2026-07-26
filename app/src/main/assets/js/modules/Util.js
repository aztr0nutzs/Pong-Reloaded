
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
