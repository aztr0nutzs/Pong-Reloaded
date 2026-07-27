const fs = require('fs');
let js = fs.readFileSync('app/src/main/assets/js/modules/Renderer.js', 'utf8');

js = js.replace(/let sx = pt\.x - 11;/, `let br = window.Thrower ? window.Thrower.engine.BALL_R : 13;
                let sx = pt.x - (br * 0.85);`);
js = js.replace(/let sy = pt\.y - 3\.5;/, `let sy = pt.y - (br * 0.27);`);

js = js.replace(/var sx = pt\.x - 11; \/\/ half of 22px width/, `let br2 = window.Thrower ? window.Thrower.engine.BALL_R : 13; var sx = pt.x - (br2 * 0.85);`);
js = js.replace(/var sy = pt\.y - 3\.5; \/\/ half of 7px height/, `var sy = pt.y - (br2 * 0.27);`);

fs.writeFileSync('app/src/main/assets/js/modules/Renderer.js', js);
console.log("Patched dynamic shadow position");
