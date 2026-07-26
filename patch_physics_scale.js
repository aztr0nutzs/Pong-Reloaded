const fs = require('fs');
let js = fs.readFileSync('app/src/main/assets/js/modules/PhysicsEngine.js', 'utf8');

js = js.replace(/this\.BALL_R = 20; \/\/ Standard size is 20mm radius/, 
`this.BALL_R = 13; // Scaled to fit the game's cup sizes visually`);

fs.writeFileSync('app/src/main/assets/js/modules/PhysicsEngine.js', js);
console.log("Patched PhysicsEngine.js scale");
