const fs = require('fs');
let html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');

// Update perspective to feel more grounded
html = html.replace(/#table-perspective \{[^}]+\}/, '#table-perspective { perspective: 800px; -webkit-perspective: 800px; perspective-origin: 50% 20%; }');
html = html.replace(/transform: rotateX\(55deg\) translateY\(0%\) translateZ\(-150px\);/, 'transform: rotateX(60deg) translateY(10%) translateZ(-100px);');

// Enhance Table Plate (Premium carbon + glossy reflection + intense neon edge)
html = html.replace(/\.table-plate\{[^}]+\}/, `.table-plate{
    background:
      linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 10%),
      radial-gradient(ellipse at 50% -20%, rgba(0,243,255,0.25), transparent 60%),
      radial-gradient(ellipse at 50% 120%, rgba(255,46,196,0.15), transparent 60%),
      linear-gradient(180deg, #06070a 0%, #0d0f14 50%, #040507 100%);
    border: 3px solid rgba(0, 243, 255, 0.9);
    box-shadow: 
      inset 0 0 40px rgba(0, 243, 255, 0.3), 
      inset 0 0 100px rgba(0, 0, 0, 0.9), 
      0 0 30px rgba(0, 243, 255, 0.6),
      0 0 60px rgba(0, 243, 255, 0.3);
  }`);

// Make carbon texture pop more
html = html.replace(/\.carbon-texture\{[^}]+\}/, `.carbon-texture{
    background:
      linear-gradient(27deg, #151515 5px, transparent 5px) 0 5px,
      linear-gradient(207deg, #151515 5px, transparent 5px) 10px 0px,
      linear-gradient(27deg, #222 5px, transparent 5px) 0px 10px,
      linear-gradient(207deg, #222 5px, transparent 5px) 10px 5px,
      linear-gradient(90deg, #1b1b1b 10px, transparent 10px),
      linear-gradient(#1d1d1d 25%, #1a1a1a 25%, #1a1a1a 50%, transparent 50%, transparent 75%, #242424 75%, #242424 100%);
    background-size: 20px 20px;
    opacity: 0.45;
    mix-blend-mode: overlay;
  }`);

// Improve sheen sweep
html = html.replace(/\.table-sheen::after \{[^}]+\}/, `.table-sheen::after {
    content:""; position:absolute; top:0; left:-100%; width:150%; height:100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
    animation: sheen-sweep 4s infinite cubic-bezier(0.4, 0.0, 0.2, 1);
    transform: skewX(-30deg);
  }`);

fs.writeFileSync('app/src/main/assets/index.html', html);
console.log("Patched perspective and textures");
