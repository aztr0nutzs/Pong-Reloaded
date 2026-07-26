const fs = require('fs');
let js = fs.readFileSync('app/src/main/assets/js/modules/InputManager.js', 'utf8');

js = js.replace(/if \(!this\.cachedTablePoint\) this\.cachedTablePoint = \{\};\s*this\.cachedTablePoint\.x = clamp\(pt\.x, r\.left \+ 20, r\.right - 20\);\s*this\.cachedTablePoint\.y = clamp\(pt\.y, r\.top \+ 40, r\.bottom - 40\);\s*return this\.cachedTablePoint;/, 
`return {
          x: clamp(pt.x, r.left + 20, r.right - 20),
          y: clamp(pt.y, r.top + 40, r.bottom - 40)
        };`);

fs.writeFileSync('app/src/main/assets/js/modules/InputManager.js', js);
console.log("Reverted InputManager tableClampedPoint pooling");
