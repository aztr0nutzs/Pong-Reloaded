const fs = require('fs');
let js = fs.readFileSync('app/src/main/assets/js/modules/PhysicsEngine.js', 'utf8');

js = js.replace(/this\.GRAVITY = 9800;/, `this.GRAVITY = 6000;`);
js = js.replace(/this\.BALL_MASS = 0\.0027;/, `this.BALL_MASS = 0.0027;`);
js = js.replace(/this\.BALL_AREA = Math\.PI \* this\.BALL_R \* this\.BALL_R;/, `this.BALL_AREA = Math.PI * 13 * 13;`);

fs.writeFileSync('app/src/main/assets/js/modules/PhysicsEngine.js', js);
console.log("Patched PhysicsEngine.js params");
