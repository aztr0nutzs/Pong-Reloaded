const fs = require('fs');
let js = fs.readFileSync('app/src/main/assets/js/modules/Renderer.js', 'utf8');

js = js.replace(/ctx\.stroke\(\);\n\n      \/\/ Draw pull line/, 
`ctx.stroke();
      
      // Draw landing marker (Cross)
      ctx.beginPath();
      ctx.moveTo(lx - 5, ly - 5);
      ctx.lineTo(lx + 5, ly + 5);
      ctx.moveTo(lx + 5, ly - 5);
      ctx.lineTo(lx - 5, ly + 5);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw pull line`);

fs.writeFileSync('app/src/main/assets/js/modules/Renderer.js', js);
console.log("Patched Renderer.js to add landing marker");
