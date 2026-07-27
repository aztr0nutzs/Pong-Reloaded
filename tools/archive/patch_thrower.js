const fs = require('fs');
let js = fs.readFileSync('app/src/main/assets/js/modules/ThrowController.js', 'utf8');

js = js.replace(/playback\([\s\S]*?performPlayerThrow/, `playback(initParams, dt, depthRef, cupsEls, tableRect, difficulty, windAccel){
      var self = this;
      return new Promise(function(resolve){
          let cups = self.engine.parseCups(cupsEls, difficulty);
          
          GameStateManager.state.ball.active = true;
          
          self.activeSim = self.engine.startLiveSimulation(
              initParams, cups, tableRect, windAccel,
              (sim) => {
                  // onUpdate - update ball position for rendering
                  let state = GameStateManager.state;
                  state.ball.x = sim.x;
                  state.ball.y = sim.y;
                  state.ball.z = sim.z;
                  
                  // Update visual depth scale
                  let pt = state.ball;
                  let scaleDepth = 1;
                  if(depthRef){
                    let isPlayerThrow = depthRef.startY > depthRef.endY;
                    if(isPlayerThrow){
                      let span = Math.max(40, depthRef.startY - depthRef.endY);
                      let t = Math.max(0, Math.min(1, (depthRef.startY - pt.y) / span));
                      scaleDepth = 1 - t*0.4;
                    } else {
                      let span = Math.max(40, depthRef.endY - depthRef.startY);
                      let t = Math.max(0, Math.min(1, (pt.y - depthRef.startY) / span));
                      scaleDepth = 0.6 + t*0.4;
                    }
                  }
                  state.ball.scaleDepth = scaleDepth;
                  state.ball.shadowScale = Math.max(0.2, 1 - (pt.z / 150));
                  state.ball.shadowOpacity = Math.max(0, 1 - (pt.z / 150));
              },
              (sim) => {
                  // onComplete
                  resolve(sim);
              }
          );
      });
    }

    performPlayerThrow`);

fs.writeFileSync('app/src/main/assets/js/modules/ThrowController.js', js);
console.log("Patched ThrowController.js playback");
