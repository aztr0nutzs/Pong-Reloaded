const fs = require('fs');
const trajCode = `class TrajectoryPredictor {
    constructor(engine) {
        this.engine = engine;
    }
    
    simulate(init, cupEls, tableRect, difficulty, windAccel) {
        let cups = this.engine.parseCups(cupEls, difficulty);
        
        let simState = this.engine.cloneState(init);
        let maxSteps = Math.round(5.0 / this.engine.FIXED_DT);
        let samples = [];
        
        // Initial sample
        samples.push({
            x: simState.x, y: simState.y, z: simState.z, 
            event: null, v: Math.sqrt(simState.vx**2 + simState.vy**2 + simState.vz**2)
        });
        
        for (let i = 0; i < maxSteps && !simState.settled; i++) {
            this.engine.step(simState, this.engine.FIXED_DT, tableRect, cups, windAccel);
            
            // Settlement logic
            let hs = Math.sqrt(simState.vx**2 + simState.vy**2);
            if (simState.insideCup) {
                if (Math.abs(simState.vz) < 30 && simState.z <= 2) {
                    simState.settled = true;
                    simState.outcome = 'hit';
                    simState.hitCupEl = simState.insideCup.el;
                }
            } else if (simState.z <= 0.5 && hs < this.engine.STOP_SPEED) {
                simState.settled = true;
                simState.outcome = simState.outcome || 'miss';
            }
            
            samples.push({
                x: simState.x, y: simState.y, z: Math.max(0, simState.z), 
                event: simState.event, 
                v: Math.sqrt(simState.vx**2 + simState.vy**2 + simState.vz**2)
            });
        }
        
        if (!simState.settled) simState.outcome = simState.outcome || 'miss';
        
        let maxImpactV = 0;
        for (let j = 0; j < samples.length; j++) {
            if (samples[j].event) {
                maxImpactV = Math.max(maxImpactV, samples[j].v || 0);
            }
        }
        
        return {
            samples: samples,
            outcome: simState.outcome,
            hitCupEl: simState.hitCupEl,
            finalX: simState.x,
            finalY: simState.y,
            dt: this.engine.FIXED_DT,
            impactForce: maxImpactV
        };
    }
    
    grazedRim(sim) {
        for(let i=0; i<sim.samples.length; i++){
            let ev = sim.samples[i].event;
            if(ev === 'rim' || ev === 'lip-in' || ev === 'lip-out') return true;
        }
        return false;
    }
    
    firstRimSample(sim) {
        for(let i=0; i<sim.samples.length; i++){
            let ev = sim.samples[i].event;
            if(ev === 'rim' || ev === 'lip-in' || ev === 'lip-out') return sim.samples[i];
        }
        return null;
    }
}
window.TrajectoryPredictor = TrajectoryPredictor;
`;
fs.writeFileSync('app/src/main/assets/js/modules/TrajectoryPredictor.js', trajCode);
console.log("Wrote updated TrajectoryPredictor.js");
