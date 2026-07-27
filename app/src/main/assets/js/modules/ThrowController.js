class ThrowController {
    constructor(engine, predictor){
        this.engine = engine;
        this.predictor = predictor;
        
        // Configuration constants
        this.MIN_PULL = 0.08;
        this.DEFAULT_ARC = 0.55;
        this.SPIN_RATE = 4.0;
        this.MIN_VERTICAL_SPEED = 1.20;
        this.MAX_VERTICAL_SPEED = 3.80;
        this.MIN_HORIZONTAL_SPEED = 0.80;
        this.MAX_HORIZONTAL_SPEED = 12.00;
        this.SOLVER_TOLERANCE = 0.005;
        this.COARSE_SPEED_STEPS = 7;
        this.COARSE_HEADING_STEPS = 5;
        this.REFINEMENT_PASSES = 3;
        
        // Active simulation cancellation reference
        this.activeSim = null;
        
    }

    /**
     * Returns the current normalized control input without wall-clock filtering.
     * Physics launch state therefore depends only on the input value, never event timing.
     * @param {Object} rawPull - Raw touch pull delta {x, y}
     * @returns {Object} Deterministic normalized pull delta {x, y}
     */
    updateInput(rawPull) {
        return { x: rawPull.x, y: rawPull.y };
    }
    
    resetInput() {
        // Input is stateless; retained as the public lifecycle hook used by InputManager.
    }

    /**
     * Non-linear power response curve mapped from raw pull distance and user sensitivity.
     * @param {number} rawPower - Unscaled drag power ratio
     * @returns {number} Mapped power value
     */
    getPowerCurve(rawPower) {
        var clamped = clamp(rawPower, 0, 1.2);
        // Power curve mapping: high precision near aim target with authoritative max reach
        return Math.pow(clamped, 1.15);
    }

    finalizePlayerControls(pull, targetWorldPosition, requestedTarget, arcPreference) {
        var sens = (window.state && window.state.settings && window.state.settings.sensitivity) ? window.state.settings.sensitivity : 70;
        var sensScale = sens / 70.0;
        var rawPower = clamp(pull.y / Math.max(0.2, sensScale), 0, 1);
        var spinRatio = clamp(pull.x / (0.4 * sensScale), -1, 1);
        return Object.freeze({
            targetWorldPosition: Object.freeze({ x: targetWorldPosition.x, y: targetWorldPosition.y, z: targetWorldPosition.z || 0 }),
            requestedTarget: Object.freeze({ x: requestedTarget.x, y: requestedTarget.y }),
            inputPull: Object.freeze({ x: pull.x, y: pull.y }),
            power: this.getPowerCurve(rawPower),
            arc: clamp(Number.isFinite(arcPreference) ? arcPreference : this.DEFAULT_ARC, 0, 1),
            spin: spinRatio
        });
    }

    _candidatePrediction(ballStart, controls, speed, heading, cupsEls, difficulty, windAccel) {
        var verticalSpeed = this.MIN_VERTICAL_SPEED + controls.arc * (this.MAX_VERTICAL_SPEED - this.MIN_VERTICAL_SPEED);
        var angularVelocity = { x: 0, y: 0, z: controls.spin * this.SPIN_RATE };
        var launchVelocity = {
            x: Math.cos(heading) * speed,
            y: Math.sin(heading) * speed,
            z: verticalSpeed
        };
        var prediction = this.predictor.simulate({
            x: ballStart.x, y: ballStart.y, z: ballStart.z,
            vx: launchVelocity.x, vy: launchVelocity.y, vz: launchVelocity.z,
            angularVelocityX: angularVelocity.x,
            angularVelocityY: angularVelocity.y,
            angularVelocityZ: angularVelocity.z
        }, cupsEls, this.engine.world.geometry.table.bounds, difficulty, windAccel);
        var error = this._targetError(prediction, controls.targetWorldPosition);
        return { speed: speed, heading: heading, launchVelocity: launchVelocity, angularVelocity: angularVelocity, prediction: prediction, error: error };
    }

    _targetError(prediction, target) {
        var best = Infinity;
        for (var index = 0; index < prediction.samples.length; index++) {
            var sample = prediction.samples[index];
            var distance = Math.hypot(sample.x - target.x, sample.y - target.y);
            if (distance < best) best = distance;
        }
        return best;
    }

    _isBetterCandidate(candidate, best) {
        return !best || candidate.error < best.error - 1e-12 ||
            (Math.abs(candidate.error - best.error) <= 1e-12 && candidate.speed < best.speed);
    }

    solveInverse(controls, ballStart, cupsEls, difficulty, windAccel) {
        var target = controls.targetWorldPosition;
        var baseHeading = Math.atan2(target.y - ballStart.y, target.x - ballStart.x);
        var powerCenter = this.MIN_HORIZONTAL_SPEED + controls.power * (this.MAX_HORIZONTAL_SPEED - this.MIN_HORIZONTAL_SPEED);
        var envelopeHalfWidth = 0.75 + controls.power * 2.25;
        var minimumSpeed = Math.max(this.MIN_HORIZONTAL_SPEED, powerCenter - envelopeHalfWidth);
        var maximumSpeed = Math.min(this.MAX_HORIZONTAL_SPEED, powerCenter + envelopeHalfWidth);
        var headingHalfWidth = 0.20;
        var best = null;
        var evaluations = 0;

        // Stage one explores the complete power-constrained speed envelope. Stage two
        // refines only around the deterministic best candidate until the 5 mm tolerance
        // is reached or the bounded refinement budget is exhausted.
        for (var speedIndex = 0; speedIndex < this.COARSE_SPEED_STEPS; speedIndex++) {
            var speedT = speedIndex / (this.COARSE_SPEED_STEPS - 1);
            var speed = minimumSpeed + (maximumSpeed - minimumSpeed) * speedT;
            for (var headingIndex = 0; headingIndex < this.COARSE_HEADING_STEPS; headingIndex++) {
                var headingT = headingIndex / (this.COARSE_HEADING_STEPS - 1);
                var heading = baseHeading - headingHalfWidth + headingHalfWidth * 2 * headingT;
                var candidate = this._candidatePrediction(ballStart, controls, speed, heading, cupsEls, difficulty, windAccel);
                evaluations++;
                if (this._isBetterCandidate(candidate, best)) best = candidate;
            }
        }

        var speedRadius = (maximumSpeed - minimumSpeed) / (this.COARSE_SPEED_STEPS - 1);
        var headingRadius = (headingHalfWidth * 2) / (this.COARSE_HEADING_STEPS - 1);
        for (var pass = 0; pass < this.REFINEMENT_PASSES && best.error > this.SOLVER_TOLERANCE; pass++) {
            speedRadius *= 0.5;
            headingRadius *= 0.5;
            var centerSpeed = best.speed;
            var centerHeading = best.heading;
            for (var speedOffset = -1; speedOffset <= 1; speedOffset++) {
                var refinedSpeed = clamp(centerSpeed + speedOffset * speedRadius, minimumSpeed, maximumSpeed);
                for (var headingOffset = -1; headingOffset <= 1; headingOffset++) {
                    var refinedHeading = centerHeading + headingOffset * headingRadius;
                    var refined = this._candidatePrediction(ballStart, controls, refinedSpeed, refinedHeading, cupsEls, difficulty, windAccel);
                    evaluations++;
                    if (this._isBetterCandidate(refined, best)) best = refined;
                }
            }
        }
        best.evaluations = evaluations;
        return best;
    }

    /**
     * Authoritative launch calculation for AI opponent throws.
     */
    computeAiThrowParams(ballStart, targetPos, apexHeight, spinAmount) {
        apexHeight = apexHeight || 0.140;
        var gravity = this.engine ? this.engine.GRAVITY : PhysicsConstants.SI.gravity;
        var vz0 = Math.sqrt(2 * gravity * apexHeight);
        var T = (2 * vz0) / gravity;
        if (T <= 0.01) T = 0.1;
        
        var dx = targetPos.x - ballStart.x;
        var dy = targetPos.y - ballStart.y;
        
        return {
            x: ballStart.x,
            y: ballStart.y,
            z: ballStart.z,
            vx: dx / T,
            vy: dy / T,
            vz: vz0,
            angularVelocityX: spinAmount || 0,
            angularVelocityY: 0,
            angularVelocityZ: 0
        };
    }

    /**
     * Compute full deterministic trajectory solution and collision outcomes.
     */
    computeSolution(controls, ballStart, cupsEls, difficulty, windAccel) {
        var solved = this.solveInverse(controls, ballStart, cupsEls, difficulty, windAccel);
        var launchPosition = { x: ballStart.x, y: ballStart.y, z: ballStart.z };
        var releaseQuality = clamp(1 - solved.error / Math.max(this.SOLVER_TOLERANCE * 4, 0.001), 0, 1);

        return this.predictor.createShotSolution({
            launchPosition: launchPosition,
            launchVelocity: solved.launchVelocity,
            angularVelocity: solved.angularVelocity,
            targetWorldPosition: controls.targetWorldPosition,
            requestedTarget: { x: controls.requestedTarget.x, y: controls.requestedTarget.y, cupElement: this.findTargetCup(controls.targetWorldPosition, cupsEls) },
            inputPull: controls.inputPull,
            power: controls.power,
            arc: controls.arc,
            spin: controls.spin,
            releaseQuality: releaseQuality,
            solverDiagnostics: { targetError: solved.error, tolerance: this.SOLVER_TOLERANCE, evaluations: solved.evaluations, converged: solved.error <= this.SOLVER_TOLERANCE },
            depthRange: { startY: ballStart.y, endY: controls.targetWorldPosition.y },
            simulationContext: {
                cupElements: cupsEls,
                tableBounds: this.engine.world.geometry.table.bounds,
                difficulty: difficulty,
                windAcceleration: windAccel,
                timeStep: this.engine.FIXED_DT
            }
        }, solved.prediction);
    }

    findTargetCup(target, cupElements) {
        var closestCup = null;
        var closestDistance = Infinity;
        var geometry = this.engine.world.geometry;
        cupElements.forEach(function(cupElement) {
            var position = geometry.cupPosition(cupElement.dataset.team, Number(cupElement.dataset.idx));
            var distance = Math.hypot(target.x - position.x, target.y - position.y);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestCup = cupElement;
            }
        });
        return closestCup;
    }

    /**
     * Playback simulation animation loop tied to fixed physics ticks.
     */
    playback(initParams, depthRef, cupsEls, tableGeometry, difficulty, windAccel) {
        var self = this;
        if (this.activeSim && typeof this.activeSim.cancel === 'function') {
            this.activeSim.cancel();
            this.activeSim = null;
        }
        
        return new Promise(function(resolve) {
            self.activeSim = self.engine.startLiveSimulation(
                initParams, cupsEls, tableGeometry, difficulty, windAccel,
                (sim) => {
                    let state = window.GameStateManager ? window.GameStateManager.state : null;
                    if (!state) return;
                    
                    state.ball.prevX = (sim.prevX !== undefined) ? sim.prevX : sim.x;
                    state.ball.prevY = (sim.prevY !== undefined) ? sim.prevY : sim.y;
                    state.ball.prevZ = (sim.prevZ !== undefined) ? sim.prevZ : sim.z;
                    state.ball.x = sim.x;
                    state.ball.y = sim.y;
                    state.ball.z = sim.z;
                    state.ball.position = sim.position;
                    state.ball.previousPosition = sim.previousPosition;
                    state.ball.velocity = sim.velocity;
                    state.ball.angularVelocity = sim.angularVelocity;
                    state.ball.orientation = sim.orientation;
                    state.ball.airborne = sim.airborne;
                    state.ball.contactState = sim.contactState;
                    state.ball.activeContacts = sim.activeContacts;
                    
                    let pt = state.ball;
                    let scaleDepth = 1;
                    if (depthRef) {
                        let isPlayerThrow = depthRef.startY > depthRef.endY;
                        if (isPlayerThrow) {
                            let span = Math.max(0.040, depthRef.startY - depthRef.endY);
                            let t = Math.max(0, Math.min(1, (depthRef.startY - pt.y) / span));
                            scaleDepth = 1 - t * 0.4;
                        } else {
                            let span = Math.max(0.040, depthRef.endY - depthRef.startY);
                            let t = Math.max(0, Math.min(1, (pt.y - depthRef.startY) / span));
                            scaleDepth = 0.6 + t * 0.4;
                        }
                    }
                    state.ball.scaleDepth = scaleDepth;
                    state.ball.shadowScale = Math.max(0.2, 1 - (pt.z / 0.150));
                    state.ball.shadowOpacity = Math.max(0, 1 - (pt.z / 0.150));
                },
                (sim) => {
                    self.activeSim = null;
                    resolve(sim);
                }
            );
        });
    }

    playbackShot(solution) {
        ShotSolution.assertValid(solution);
        var context = solution.simulationContext;
        return this.playback(
            this.engine.stateFromShotSolution(solution),
            solution.depthRange,
            context.cupElements,
            context.tableBounds,
            context.difficulty,
            context.windAcceleration
        );
    }

    /**
     * Authoritative execution of player throw lifecycle.
     */
    performPlayerThrow(sol) {
        ShotSolution.assertValid(sol);
        var m = window.state ? window.state.match : null;
        var generation = window.GameStateManager ? GameStateManager.claimPlayerThrow() : null;
        if (!m || generation === null) return false;
        
        var remainingCups = qsa('#ai-cups .cup:not(.hit)');
        if (!remainingCups.length) {
            if (window.finishMatch) finishMatch('win');
            return true;
        }
        
        this.playbackShot(sol).then(function(liveSim) {
            if (!GameStateManager.isCurrent(generation)) return;
            var willHit = liveSim.outcome === 'hit' && !!liveSim.hitCupEl;
            var hitCupElement = willHit ? liveSim.hitCupEl : null;
            var cupKey = hitCupElement ? hitCupElement.dataset.idx : null;
            var scored = GameStateManager.resolveThrow('player', willHit, cupKey);
            
            if (scored) {
                hitCupElement.classList.add('hit');
                
                if (window.SFX) SFX.hit();
                if (window.UIRenderer) UIRenderer.toast('CUP DESTROYED');
                if (window.haptic) haptic(20);
            } else {
                if (window.SFX) SFX.miss();
                if (window.UIRenderer) UIRenderer.toast(sol.grazedRim ? 'RIM OUT — SO CLOSE' : 'SHOT MISSED');
            }
            
            if (window.BallController) BallController.resetBallPosition('player');
            else if (window.resetBallPosition) resetBallPosition('player');
            
            if (m.aiRemaining <= 0) {
                if (window.finishMatch) finishMatch('win');
                return;
            }
            
            GameStateManager.advanceTurn('player');
            GameStateManager.schedule(function() {
                if (window.AI) window.AI.performAiThrow();
            }, 900, [GameStateManager.STATES.AI_AIM]);
        });
        return true;
    }
}
window.ThrowController = ThrowController;
