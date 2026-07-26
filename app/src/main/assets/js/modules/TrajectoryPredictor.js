class TrajectoryPredictor {
    constructor(engine) {
        this.engine = engine;
    }

    /**
     * Executes the exact same physics simulation used by live gameplay without approximations.
     * Guarantees 100% trajectory match between prediction and live throw.
     * 
     * @param {Object} init Initial physics state {x, y, z, vx, vy, vz, angularVelocityX, angularVelocityZ...}
     * @param {Array} cupEls Array of DOM cup elements
     * @param {DOMRect} tableRect Table surface bounds
     * @param {string} difficulty Game difficulty
     * @param {number} windAccel Wind acceleration vector
     * @returns {Object} Comprehensive trajectory prediction result
     */
    simulate(init, cupEls, tableRect, difficulty, windAccel) {
        let cups = this.engine.parseCups(cupEls, difficulty);
        let simState = this.engine.cloneState(init);
        
        let maxSteps = Math.round(5.0 / this.engine.FIXED_DT); // Max 5 seconds simulation cutoff
        let samples = [];
        let bouncePoints = [];
        let cupIntersections = [];
        let maxImpactV = 0;
        let hitCupEl = null;

        // Initial trajectory sample
        let initialVel = Math.sqrt(simState.vx**2 + simState.vy**2 + simState.vz**2);
        samples.push({
            x: simState.x,
            y: simState.y,
            z: simState.z,
            event: null,
            v: initialVel
        });

        for (let i = 0; i < maxSteps && !simState.settled; i++) {
            this.engine.step(simState, this.engine.FIXED_DT, tableRect, cups, windAccel);

            let speed = Math.sqrt(simState.vx**2 + simState.vy**2 + simState.vz**2);
            let sample = {
                x: simState.x,
                y: simState.y,
                z: Math.max(0, simState.z),
                event: simState.event,
                v: speed
            };
            samples.push(sample);

            if (simState.event) {
                maxImpactV = Math.max(maxImpactV, speed);

                // Track bounce points
                if (simState.event === 'bounce' || simState.event === 'floor-bounce') {
                    bouncePoints.push({
                        x: simState.x,
                        y: simState.y,
                        z: Math.max(0, simState.z),
                        event: simState.event
                    });
                }

                // Track cup interactions
                if (['rim', 'lip-in', 'lip-out', 'hard-rebound', 'interior-bounce', 'enter', 'soft-drop'].includes(simState.event)) {
                    cupIntersections.push({
                        x: simState.x,
                        y: simState.y,
                        z: simState.z,
                        event: simState.event,
                        cup: simState.insideCup ? simState.insideCup.el : null
                    });
                }
            }

            // Settlement logic identical to PhysicsEngine.fixedUpdate
            let hs = Math.sqrt(simState.vx**2 + simState.vy**2);
            if (simState.insideCup) {
                let bFloorZ = simState.insideCup.colliders.bottomZ;
                if (Math.abs(simState.vz) < 25 && simState.z <= bFloorZ + 3.0 && hs < this.engine.STOP_SPEED) {
                    simState.settled = true;
                    simState.outcome = 'hit';
                    hitCupEl = simState.insideCup.el;
                }
            } else if (simState.z <= 0.5 && hs < this.engine.STOP_SPEED) {
                simState.settled = true;
                simState.outcome = simState.outcome || 'miss';
            }
        }

        if (!simState.settled) simState.outcome = simState.outcome || 'miss';

        // Impact force in Newtons: F = (m * v) / dt
        let impactForceN = (this.engine.BALL_MASS * maxImpactV) / this.engine.FIXED_DT;

        return {
            samples: samples,
            outcome: simState.outcome,
            hitCupEl: hitCupEl || simState.hitCupEl,
            finalX: simState.x,
            finalY: simState.y,
            finalZ: Math.max(0, simState.z),
            landingPoint: { x: simState.x, y: simState.y, z: Math.max(0, simState.z) },
            bouncePoints: bouncePoints,
            cupIntersections: cupIntersections,
            dt: this.engine.FIXED_DT,
            impactForce: impactForceN
        };
    }

    grazedRim(sim) {
        if (!sim || !sim.samples) return false;
        for (let i = 0; i < sim.samples.length; i++) {
            let ev = sim.samples[i].event;
            if (['rim', 'lip-in', 'lip-out', 'hard-rebound', 'interior-bounce', 'enter', 'soft-drop'].includes(ev)) {
                return true;
            }
        }
        return false;
    }

    firstRimSample(sim) {
        if (!sim || !sim.samples) return null;
        for (let i = 0; i < sim.samples.length; i++) {
            let ev = sim.samples[i].event;
            if (['rim', 'lip-in', 'lip-out', 'hard-rebound', 'interior-bounce', 'enter', 'soft-drop'].includes(ev)) {
                return sim.samples[i];
            }
        }
        return null;
    }
}
window.TrajectoryPredictor = TrajectoryPredictor;
