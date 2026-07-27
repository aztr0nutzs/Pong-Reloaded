class ShotSolution {
    constructor(data) {
        this.launchPosition = ShotSolution.freezeVector(data.launchPosition);
        this.launchVelocity = ShotSolution.freezeVector(data.launchVelocity);
        this.angularVelocity = ShotSolution.freezeVector(data.angularVelocity);
        this.targetWorldPosition = ShotSolution.freezeVector(data.targetWorldPosition);
        this.requestedTarget = Object.freeze({ x: data.requestedTarget.x, y: data.requestedTarget.y, cupElement: data.requestedTarget.cupElement || null });
        this.inputPull = Object.freeze({ x: data.inputPull.x, y: data.inputPull.y });
        this.power = data.power;
        this.arc = data.arc;
        this.spin = data.spin;
        this.releaseQuality = data.releaseQuality;
        this.solverDiagnostics = Object.freeze({ ...data.solverDiagnostics });
        this.trajectorySamples = ShotSolution.freezeRecords(data.trajectorySamples);
        this.bounceEvents = ShotSolution.freezeRecords(data.bounceEvents);
        this.landingPosition = ShotSolution.freezeVector(data.landingPosition);
        this.cupIntersection = data.cupIntersection ? Object.freeze({
            position: ShotSolution.freezeVector(data.cupIntersection.position),
            event: data.cupIntersection.event,
            cupElement: data.cupIntersection.cupElement || null
        }) : null;
        this.predictedOutcome = data.predictedOutcome;
        this.impactVelocity = data.impactVelocity;
        this.impactForce = data.impactForce;
        this.grazedRim = data.grazedRim;
        this.firstRimSample = data.firstRimSample ? Object.freeze({ ...data.firstRimSample }) : null;
        this.depthRange = Object.freeze({ ...data.depthRange });
        this.simulationContext = Object.freeze({
            cupElements: Object.freeze(data.simulationContext.cupElements.slice()),
            tableBounds: Object.freeze({ ...data.simulationContext.tableBounds }),
            difficulty: data.simulationContext.difficulty,
            windAcceleration: data.simulationContext.windAcceleration,
            timeStep: data.simulationContext.timeStep
        });
        Object.freeze(this);
        ShotSolution.assertValid(this);
    }

    static freezeVector(vector) {
        return Object.freeze({ x: vector.x, y: vector.y, z: vector.z });
    }

    static freezeRecords(records) {
        return Object.freeze(records.map(function(record) { return Object.freeze({ ...record }); }));
    }

    static assertValid(solution) {
        function assert(condition, message) {
            if (!condition) throw new TypeError('Invalid ShotSolution: ' + message);
        }
        function finiteVector(vector, name) {
            assert(vector && Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z), name + ' must be a finite 3D vector');
        }

        assert(solution instanceof ShotSolution, 'unexpected object type');
        finiteVector(solution.launchPosition, 'launchPosition');
        finiteVector(solution.launchVelocity, 'launchVelocity');
        finiteVector(solution.angularVelocity, 'angularVelocity');
        finiteVector(solution.targetWorldPosition, 'targetWorldPosition');
        finiteVector(solution.landingPosition, 'landingPosition');
        assert(solution.requestedTarget && Number.isFinite(solution.requestedTarget.x) && Number.isFinite(solution.requestedTarget.y), 'requestedTarget must be a finite 2D point');
        assert(Number.isFinite(solution.inputPull.x) && Number.isFinite(solution.inputPull.y), 'inputPull must be finite');
        assert(Number.isFinite(solution.power) && solution.power >= 0, 'power must be non-negative');
        assert(Number.isFinite(solution.arc), 'arc must be finite');
        assert(Number.isFinite(solution.spin), 'spin must be finite');
        assert(Number.isFinite(solution.releaseQuality), 'releaseQuality must be finite');
        assert(solution.solverDiagnostics && Number.isFinite(solution.solverDiagnostics.targetError) && solution.solverDiagnostics.targetError >= 0, 'solverDiagnostics.targetError must be non-negative');
        assert(Number.isFinite(solution.solverDiagnostics.tolerance) && solution.solverDiagnostics.tolerance > 0, 'solverDiagnostics.tolerance must be positive');
        assert(Number.isInteger(solution.solverDiagnostics.evaluations) && solution.solverDiagnostics.evaluations > 0, 'solverDiagnostics.evaluations must be a positive integer');
        assert(typeof solution.solverDiagnostics.converged === 'boolean', 'solverDiagnostics.converged must be boolean');
        assert(Array.isArray(solution.trajectorySamples) && solution.trajectorySamples.length > 0, 'trajectorySamples must not be empty');
        assert(Array.isArray(solution.bounceEvents), 'bounceEvents must be an array');
        solution.trajectorySamples.forEach(function(sample, index) {
            finiteVector(sample, 'trajectorySamples[' + index + ']');
            assert(Number.isFinite(sample.v), 'trajectorySamples[' + index + '].v must be finite');
        });
        solution.bounceEvents.forEach(function(event, index) {
            finiteVector(event, 'bounceEvents[' + index + ']');
            assert(typeof event.event === 'string', 'bounceEvents[' + index + '].event is required');
        });
        assert(typeof solution.predictedOutcome === 'string' && solution.predictedOutcome.length > 0, 'predictedOutcome is required');
        assert(Number.isFinite(solution.impactVelocity) && solution.impactVelocity >= 0, 'impactVelocity must be non-negative');
        assert(Number.isFinite(solution.impactForce) && solution.impactForce >= 0, 'impactForce must be non-negative');
        if (solution.cupIntersection) {
            finiteVector(solution.cupIntersection.position, 'cupIntersection.position');
            assert(typeof solution.cupIntersection.event === 'string', 'cupIntersection.event is required');
        }
        assert(solution.simulationContext && Array.isArray(solution.simulationContext.cupElements), 'simulationContext is required');
        assert(Number.isFinite(solution.simulationContext.timeStep) && solution.simulationContext.timeStep > 0, 'simulationContext.timeStep must be positive');
        assert(Object.isFrozen(solution), 'solution must be immutable');
        return solution;
    }
}

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
     * @param {TableGeometry.bounds} tableGeometry Immutable world-space table bounds in meters
     * @param {string} difficulty Game difficulty
     * @param {number} windAccel Wind acceleration vector
     * @returns {Object} Comprehensive trajectory prediction result
     */
    simulate(init, cupEls, tableGeometry, difficulty, windAccel) {
        return this.engine.simulate(init, cupEls, tableGeometry, difficulty, windAccel);
    }

    predictShot(solution) {
        ShotSolution.assertValid(solution);
        return this.engine.simulateShot(solution);
    }

    createShotSolution(data, prediction) {
        var firstIntersection = prediction.cupIntersections[0] || null;
        return new ShotSolution({
            launchPosition: data.launchPosition,
            launchVelocity: data.launchVelocity,
            angularVelocity: data.angularVelocity,
            targetWorldPosition: data.targetWorldPosition,
            requestedTarget: data.requestedTarget,
            inputPull: data.inputPull,
            power: data.power,
            arc: data.arc,
            spin: data.spin,
            releaseQuality: data.releaseQuality,
            solverDiagnostics: data.solverDiagnostics,
            trajectorySamples: prediction.samples,
            bounceEvents: prediction.bouncePoints,
            landingPosition: prediction.landingPoint,
            cupIntersection: firstIntersection ? {
                position: firstIntersection,
                event: firstIntersection.event,
                cupElement: prediction.hitCupEl || firstIntersection.cup
            } : null,
            predictedOutcome: prediction.outcome,
            impactVelocity: prediction.impactVelocity,
            impactForce: prediction.impactForce,
            grazedRim: this.grazedRim(prediction),
            firstRimSample: this.firstRimSample(prediction),
            depthRange: data.depthRange,
            simulationContext: data.simulationContext
        });
    }

    grazedRim(sim) {
        if (!sim || !sim.samples) return false;
        for (let i = 0; i < sim.samples.length; i++) {
            let ev = sim.samples[i].event;
            if (PhysicsEngine.CUP_EVENTS.includes(ev)) {
                return true;
            }
        }
        return false;
    }

    firstRimSample(sim) {
        if (!sim || !sim.samples) return null;
        for (let i = 0; i < sim.samples.length; i++) {
            let ev = sim.samples[i].event;
            if (PhysicsEngine.CUP_EVENTS.includes(ev)) {
                return sim.samples[i];
            }
        }
        return null;
    }
}
window.TrajectoryPredictor = TrajectoryPredictor;
window.ShotSolution = ShotSolution;
