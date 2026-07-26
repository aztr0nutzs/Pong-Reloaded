const fs = require('fs');
let js = fs.readFileSync('app/src/main/assets/js/modules/ThrowController.js', 'utf8');

js = js.replace(/this\.BASE_VZ = 200;/, `this.BASE_VZ = 350;`);
js = js.replace(/this\.MAX_ADDITIONAL_VZ = 600;/, `this.MAX_ADDITIONAL_VZ = 1000;`);

fs.writeFileSync('app/src/main/assets/js/modules/ThrowController.js', js);
console.log("Patched ThrowController.js VZ scaling");
