const fs = require('fs');
let js = fs.readFileSync('app/src/main/assets/js/modules/AIController.js', 'utf8');

js = js.replace(/var sim = this\.predictor\.simulate\(\{[\s\S]*?\}, cupsEls, tableRect, difficulty, 0\);/,
`var initParams = {
        x: ballStart.x, y: ballStart.y, z: ballStart.z,
        vx: (tx-ballStart.x)/T, vy: (ty-ballStart.y)/T, vz: vz0,
        angularVelocityX: 0.5, angularVelocityZ: 0
      };
      var sim = this.predictor.simulate(initParams, cupsEls, tableRect, difficulty, 0);`);

js = js.replace(/this\.thrower\.playback\.bind\(this\.thrower\)\(sim\.samples, this\.engine\.DT, depthRef\)\.then\(function\(\)\{/,
`this.thrower.playback.bind(this.thrower)(initParams, this.engine.DT, depthRef, cupsEls, tableRect, difficulty, 0).then(function(liveSim){
        sim = liveSim; // Update outcome with live sim`);

fs.writeFileSync('app/src/main/assets/js/modules/AIController.js', js);
console.log("Patched AIController.js");
