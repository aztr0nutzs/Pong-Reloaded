const fs = require('fs');
let html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');

html = html.replace(/\.throw-lane\{[^}]+\}/, `.throw-lane{
    position:absolute; left:50%; top:0; bottom:0; width:15%; transform:translateX(-50%);
    border-left:1px solid rgba(0,243,255,0.15);
    border-right:1px solid rgba(0,243,255,0.15);
    background:
      linear-gradient(180deg, rgba(0,243,255,0.05) 0%, transparent 10%, transparent 90%, rgba(0,243,255,0.05) 100%),
      repeating-linear-gradient(180deg, transparent, transparent 10%, rgba(0,243,255,0.1) 10%, rgba(0,243,255,0.1) 10.5%);
    box-shadow: inset 0 0 20px rgba(0, 243, 255, 0.05);
    z-index:10; pointer-events:none;
  }`);

fs.writeFileSync('app/src/main/assets/index.html', html);
console.log("Patched throw lane");
