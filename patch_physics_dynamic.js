const fs = require('fs');
let js = fs.readFileSync('app/src/main/assets/js/modules/PhysicsEngine.js', 'utf8');

js = js.replace(/var topR = 28 \+ szOffset;/, 'var topR = (rect.width / 2) + szOffset;');
js = js.replace(/var bottomR = 20 \+ szOffset;/, 'var bottomR = (rect.width * 0.71) / 2 + szOffset;'); // bottom is slightly smaller
js = js.replace(/height: 35/, 'height: rect.width * 1.25'); // height is relative to diameter

fs.writeFileSync('app/src/main/assets/js/modules/PhysicsEngine.js', js);
console.log("Patched PhysicsEngine.js to use dynamic cup radii");
