const fs = require('fs');
let js = fs.readFileSync('app/src/main/assets/js/modules/Renderer.js', 'utf8');

js = js.replace(/let bx = pt\.x - 12; \/\/ BALL_R/, `let br = window.Thrower ? window.Thrower.engine.BALL_R : 13;
            let bx = pt.x - br;`);
js = js.replace(/let by = pt\.y - 12 - lift;/, `let by = pt.y - br - lift;`);

js = js.replace(/var bx = pt\.x - ballR;/, `var bx = pt.x - ballR;`);
js = js.replace(/var by = pt\.y - ballR - lift;/, `var by = pt.y - ballR - lift;`);

fs.writeFileSync('app/src/main/assets/js/modules/Renderer.js', js);
console.log("Patched Renderer.js for dynamic ball size");
