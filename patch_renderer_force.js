const fs = require('fs');
let js = fs.readFileSync('app/src/main/assets/js/modules/Renderer.js', 'utf8');

if (!js.includes('impactForce')) {
    let oldCode = "ctx.fill();\n        }\n      });";
    let newCode = `ctx.fill();
        }
      });
      
      // Draw impact force
      if (sol.impactForce) {
          ctx.fillStyle = color;
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText((sol.impactForce / 10).toFixed(0) + ' N', lx, ly - 20);
      }`;
    js = js.replace(oldCode, newCode);
    fs.writeFileSync('app/src/main/assets/js/modules/Renderer.js', js);
}
console.log("Patched Renderer.js to show impact force");
