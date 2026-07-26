const fs = require('fs');
let js = fs.readFileSync('app/src/main/assets/js/modules/ThrowController.js', 'utf8');

js = js.replace(/this\.cachedSol\.finalTarget\.x = last\.x;/, 
`this.cachedSol.finalTarget.x = last.x;
        this.cachedSol.initParams = { ...this.cachedInit };
        this.cachedSol.cupsEls = cupsEls;
        this.cachedSol.tableRect = tableRect;
        this.cachedSol.difficulty = difficulty;
        this.cachedSol.windAccel = windAccel;`);

js = js.replace(/this\.playback\(sol\.samples, this\.engine\.DT, sol\.depthRef\)\.then\(function\(\)\{/,
`this.playback(sol.initParams, this.engine.DT, sol.depthRef, sol.cupsEls, sol.tableRect, sol.difficulty, sol.windAccel).then(function(liveSim){
        willHit = liveSim.outcome === 'hit' && !!liveSim.hitCupEl; // Verify with live sim outcome
        if (willHit) sol.hitCupEl = liveSim.hitCupEl;`);

fs.writeFileSync('app/src/main/assets/js/modules/ThrowController.js', js);
console.log("Patched ThrowController.js performPlayerThrow");
