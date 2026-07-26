const fs = require('fs');
let js = fs.readFileSync('app/src/main/assets/js/modules/PhysicsEngine.js', 'utf8');

js = js.replace(/let steps = 4;/, 'let steps = 10; // high substeps for basic CCD');

fs.writeFileSync('app/src/main/assets/js/modules/PhysicsEngine.js', js);
console.log("Increased substepping for better CCD proxy");
