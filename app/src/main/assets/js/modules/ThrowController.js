class ThrowController {
    constructor(engine, predictor){
        this.engine = engine;
        this.predictor = predictor;
        
        // Configuration constants
        this.MAX_PULL_DIST = 1;
        this.MIN_PULL = 0.08;
        this.BASE_VZ = 0.350;
        this.MAX_ADDITIONAL_VZ = 1.000;
        
        // Touch smoothing state
        this.smoothedPull = { x: 0, y: 0 };
        this.lastInputTime = 0;
        this.isPulling = false;
        
        // Active simulation cancellation reference
        this.activeSim = null;
        
        // Cached throw parameters avoid transient allocations during drag frames.
        this.cachedParams = {};
    }

    /**
     * Frame-rate independent touch input smoothing using a deterministic exponential filter.
     * Smooths touch micro-jitters without introducing phase lag or non-deterministic frame drift.
     * @param {Object} rawPull - Raw touch pull delta {x, y}
     * @returns {Object} Deterministically smoothed pull delta {x, y}
     */
    updateInput(rawPull) {
        var now = performance.now();
        var dt = this.lastInputTime ? (now - this.lastInputTime) / 1000.0 : 0.016;
        this.lastInputTime = now;
        
        // Clamp dt to eliminate sudden spikes from frame drops or tab unfocus
        dt = clamp(dt, 0.001, 0.05);
        
        if (!this.isPulling) {
            this.smoothedPull.x = rawPull.x;
            this.smoothedPull.y = rawPull.y;
            this.isPulling = true;
        } else {
            // Tau = 0.04s time constant for immediate responsiveness with sub-pixel jitter filtering
            var tau = 0.04;
            var alpha = 1.0 - Math.exp(-dt / tau);
            this.smoothedPull.x += (rawPull.x - this.smoothedPull.x) * alpha;
            this.smoothedPull.y += (rawPull.y - this.smoothedPull.y) * alpha;
        }
        return { x: this.smoothedPull.x, y: this.smoothedPull.y };
    }
    
    resetInput() {
        this.isPulling = false;
        this.lastInputTime = 0;
        this.smoothedPull.x = 0;
        this.smoothedPull.y = 0;
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

    /**
     * Authoritative calculation of ball launch velocity and spin parameters from user pull input.
     * Guaranteed deterministic: identical inputs yield identical throw parameter vectors.
     */
    computeThrowParams(pull, target, ballStart) {
        var sens = (window.state && window.state.settings && window.state.settings.sensitivity) ? window.state.settings.sensitivity : 70;
        var sensScale = sens / 70.0;
        
        var pullMag = Math.sqrt(pull.x * pull.x + pull.y * pull.y);
        var effectiveMaxDist = Math.max(0.2, this.MAX_PULL_DIST * sensScale);
        var rawPower = pullMag / effectiveMaxDist;
        var power = this.getPowerCurve(rawPower);
        
        // Vertical pull ratio determines launch arc (height)
        var vertRatio = clamp(pull.y / effectiveMaxDist, 0, 1.2);
        
        // Horizontal pull ratio determines sidespin / curve
        var spinRatio = clamp(pull.x / (0.4 * sensScale), -1, 1);
        
        // Match state modifiers
        var spinEnabled = (window.state && window.state.match && window.state.match.spin);
        var trickArmed = (window.state && window.state.match && window.state.match.trickArmed);
        
        // Vertical launch velocity (determines peak apex and flight time)
        var arcBoost = trickArmed ? 0.200 : 0;
        var vz = this.BASE_VZ + (this.MAX_ADDITIONAL_VZ * vertRatio) + arcBoost;
        
        // Theoretical time of flight to target distance
        var gravity = this.engine ? this.engine.GRAVITY : PhysicsConstants.SI.gravity;
        var T_actual = (2 * vz) / gravity;
        if (T_actual <= 0.01) T_actual = 0.1;
        
        // Distance and direction to target
        var dx = target.x - ballStart.x;
        var dy = target.y - ballStart.y;
        var targetDist = Math.sqrt(dx * dx + dy * dy);
        var azimuth = Math.atan2(dy, dx);
        
        // Base horizontal velocity needed to hit target perfectly at power = 1.0
        var vh_base = targetDist / T_actual;
        var vh_actual = vh_base * power;
        
        var vx = Math.cos(azimuth) * vh_actual;
        var vy = Math.sin(azimuth) * vh_actual;
        
        // Calculate angular velocities (Spin)
        var angularX = spinEnabled ? (vertRatio * 2.0) : 0; // Topspin / Backspin
        var angularZ = spinRatio * (trickArmed ? 4.0 : 2.0); // Lateral curve / Sidespin
        
        this.cachedParams.vx = vx;
        this.cachedParams.vy = vy;
        this.cachedParams.vz = vz;
        this.cachedParams.angularVelocityX = angularX;
        this.cachedParams.angularVelocityY = 0;
        this.cachedParams.angularVelocityZ = angularZ;
        this.cachedParams.power = power;
        this.cachedParams.arc = vertRatio;
        this.cachedParams.spin = spinRatio;
        this.cachedParams.rawPower = rawPower;
        
        return this.cachedParams;
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
    computeSolution(pull, target, requestedTarget, ballStart, cupsEls, difficulty, windAccel) {
        var params = this.computeThrowParams(pull, target, ballStart);
        var launchPosition = { x: ballStart.x, y: ballStart.y, z: ballStart.z };
        var launchVelocity = { x: params.vx, y: params.vy, z: params.vz };
        var angularVelocity = { x: params.angularVelocityX, y: params.angularVelocityY || 0, z: params.angularVelocityZ };
        var initialState = {
            x: launchPosition.x,
            y: launchPosition.y,
            z: launchPosition.z,
            vx: launchVelocity.x,
            vy: launchVelocity.y,
            vz: launchVelocity.z,
            angularVelocityX: angularVelocity.x,
            angularVelocityY: angularVelocity.y,
            angularVelocityZ: angularVelocity.z
        };
        var sim = this.predictor.simulate(initialState, cupsEls, this.engine.world.geometry.table.bounds, difficulty, windAccel);
        var releaseQuality = clamp(1 - (params.rawPower > 1.1 ? (params.rawPower - 1.1) * 2 : 0), 0, 1);

        return this.predictor.createShotSolution({
            launchPosition: launchPosition,
            launchVelocity: launchVelocity,
            angularVelocity: angularVelocity,
            targetWorldPosition: { x: target.x, y: target.y, z: 0 },
            requestedTarget: { x: requestedTarget.x, y: requestedTarget.y, cupElement: this.findTargetCup(target, cupsEls) },
            inputPull: { x: pull.x, y: pull.y },
            power: params.power,
            arc: params.arc,
            spin: params.spin,
            releaseQuality: releaseQuality,
            depthRange: { startY: ballStart.y, endY: target.y },
            simulationContext: {
                cupElements: cupsEls,
                tableBounds: this.engine.world.geometry.table.bounds,
                difficulty: difficulty,
                windAcceleration: windAccel,
                timeStep: this.engine.FIXED_DT
            }
        }, sim);
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
    playback(initParams, dt, depthRef, cupsEls, tableGeometry, difficulty, windAccel) {
        var self = this;
        if (this.activeSim && typeof this.activeSim.cancel === 'function') {
            this.activeSim.cancel();
            this.activeSim = null;
        }
        
        return new Promise(function(resolve) {
            let cups = self.engine.parseCups(cupsEls, difficulty);
            
            if (window.GameStateManager && window.GameStateManager.state) {
                window.GameStateManager.state.ball.active = true;
            }
            
            self.activeSim = self.engine.startLiveSimulation(
                initParams, cups, tableGeometry, windAccel,
                (sim) => {
                    let state = window.GameStateManager ? window.GameStateManager.state : null;
                    if (!state) return;
                    
                    state.ball.prevX = (sim.prevX !== undefined) ? sim.prevX : sim.x;
                    state.ball.prevY = (sim.prevY !== undefined) ? sim.prevY : sim.y;
                    state.ball.prevZ = (sim.prevZ !== undefined) ? sim.prevZ : sim.z;
                    state.ball.x = sim.x;
                    state.ball.y = sim.y;
                    state.ball.z = sim.z;
                    
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

    /**
     * Authoritative execution of player throw lifecycle.
     */
    performPlayerThrow(sol) {
        ShotSolution.assertValid(sol);
        var m = window.state ? window.state.match : null;
        if (!m || !m.active) return;
        
        m.busy = true;
        m.attempts++;
        
        var remainingCups = qsa('#ai-cups .cup:not(.hit)');
        if (!remainingCups.length) {
            if (window.finishMatch) finishMatch('win');
            m.busy = false;
            return;
        }
        
        var context = sol.simulationContext;
        var initialState = {
            x: sol.launchPosition.x,
            y: sol.launchPosition.y,
            z: sol.launchPosition.z,
            vx: sol.launchVelocity.x,
            vy: sol.launchVelocity.y,
            vz: sol.launchVelocity.z,
            angularVelocityX: sol.angularVelocity.x,
            angularVelocityY: sol.angularVelocity.y,
            angularVelocityZ: sol.angularVelocity.z
        };
        this.playback(initialState, context.timeStep, sol.depthRange, context.cupElements, context.tableBounds, context.difficulty, context.windAcceleration).then(function(liveSim) {
            var willHit = liveSim.outcome === 'hit' && !!liveSim.hitCupEl;
            var hitCupElement = willHit ? liveSim.hitCupEl : null;
            
            if (willHit) {
                m.hits++;
                hitCupElement.classList.add('hit');
                m.aiRemaining--;
                m.trickMeter = clamp(m.trickMeter + 16, 0, 100);
                
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
                m.busy = false;
                return;
            }
            
            m.turn = 'ai';
            m.busy = false;
            setTimeout(function() {
                if (window.AI) window.AI.performAiThrow();
            }, 900);
        });
    }
}
window.ThrowController = ThrowController;
