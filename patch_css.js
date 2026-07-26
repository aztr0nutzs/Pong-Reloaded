const fs = require('fs');
let html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');

html = html.replace(/\.cup-formation\{[^\}]+\}/, '.cup-formation{ position:absolute; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; width:100%; z-index:15; gap: 0.5%; }');
html = html.replace(/\.cup-row\{[^\}]+\}/, '.cup-row{ display:flex; justify-content:center; width:100%; gap: 1%; }');

// We want width: 15.57% (95mm / 610mm). Height needs to match width. We can use aspect-ratio: 1/1.
html = html.replace(/\.cup\{[^\}]+\}/, '.cup{ width: 15.57%; aspect-ratio: 1 / 1; border-radius:9999px; position:relative; border-width:3px; border-style:solid; display:flex; align-items:center; justify-content:center; transition:transform .35s cubic-bezier(.3,-0.2,.6,1), opacity .35s ease, filter .35s ease; box-sizing: border-box; }');

// Table layout
html = html.replace(/<div id="table-surface" class="h-\[75vh\] sm:h-\[85vh\] aspect-\[1\/4\] max-w-\[90vw\] shadow-\[0_80px_120px_rgba\(0,0,0,0\.95\)\]">/, '<div id="table-surface" class="h-[80vh] aspect-[1/4] max-w-[90vw] shadow-[0_80px_120px_rgba(0,0,0,0.95)]" style="width: auto;">');

// Side Rails for depth and premium look. The user requested: "depth", "side rails", "shadowing", "neon edge lighting", "premium materials"
// We'll update the physical 3D rails to use proper thick table logic.
html = html.replace(/<div class="absolute -left-6 top-0 bottom-0 w-6 [^>]+><\/div>/, '<div class="absolute left-[-20px] top-0 bottom-0 w-[20px] bg-[#090b0d] border-y border-l border-primary/40 shadow-[inset_0_0_20px_rgba(0,243,255,0.15)]" style="transform-origin: right; transform: rotateY(-90deg);"></div>');
html = html.replace(/<div class="absolute -right-6 top-0 bottom-0 w-6 [^>]+><\/div>/, '<div class="absolute right-[-20px] top-0 bottom-0 w-[20px] bg-[#090b0d] border-y border-r border-primary/40 shadow-[inset_0_0_20px_rgba(0,243,255,0.15)]" style="transform-origin: left; transform: rotateY(90deg);"></div>');
html = html.replace(/<div class="absolute -top-6 left-0 right-0 h-6 [^>]+><\/div>/, '<div class="absolute top-[-20px] left-0 right-0 h-[20px] bg-[#090b0d] border-x border-t border-primary/40 shadow-[inset_0_0_20px_rgba(0,243,255,0.15)]" style="transform-origin: bottom; transform: rotateX(90deg);"></div>');
html = html.replace(/<div class="absolute -bottom-6 left-0 right-0 h-6 [^>]+><\/div>/, '<div class="absolute bottom-[-20px] left-0 right-0 h-[20px] bg-[#111] border-x border-b border-primary/60 shadow-[inset_0_0_30px_rgba(0,243,255,0.3)]" style="transform-origin: top; transform: rotateX(-90deg);"></div>');

fs.writeFileSync('app/src/main/assets/index.html', html);
console.log("Patched CSS");
