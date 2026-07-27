class PhysicsConstants {
    static SI = Object.freeze({
        gravity: 9.80665,
        airDensity: 1.225,
        dragCoefficient: 0.47,
        tableRestitution: 0.82,
        rimRestitution: 0.68,
        cupWallRestitution: 0.35,
        cupFloorRestitution: 0.18,
        slideFriction: 0.28,
        rollFriction: 0.015,
        spinDecay: 0.6,
        magnusAccelerationFactor: 0.00012,
        stopSpeed: 0.015,
        fixedTimeStep: 1 / 120
    });
}

class BallBody {
    constructor() {
        this.diameter = 0.040;
        this.radius = this.diameter / 2;
        this.mass = 0.0027;
        this.crossSectionArea = Math.PI * this.radius * this.radius;
        Object.freeze(this);
    }
}

class CupGeometry {
    constructor() {
        this.height = 0.121;
        this.outerTopRadius = 0.0475;
        this.outerBottomRadius = 0.0285;
        this.wallThickness = 0.002;
        this.rimTubeRadius = 0.0015;
        this.bottomHeight = 0.002;
        this.centerSpacing = 0.100;
        Object.freeze(this);
    }
}

class TableGeometry {
    constructor() {
        this.width = 0.610;
        this.length = 2.440;
        this.surfaceHeight = 0;
        this.groundHeight = -0.760;
        this.bounds = Object.freeze({ left: 0, right: this.width, top: 0, bottom: this.length, width: this.width, height: this.length });
        Object.freeze(this);
    }
}

class WorldGeometry {
    constructor() {
        this.ball = new BallBody();
        this.cup = new CupGeometry();
        this.table = new TableGeometry();
        Object.freeze(this);
    }

    cupPosition(team, index) {
        var rows = team === 'ai' ? [4, 3, 2, 1] : [1, 2, 3, 4];
        var cursor = 0;
        for (var row = 0; row < rows.length; row++) {
            var count = rows[row];
            if (index < cursor + count) {
                var column = index - cursor;
                var x = this.table.width / 2 + (column - (count - 1) / 2) * this.cup.centerSpacing;
                var aiY = 0.180 + row * this.cup.centerSpacing;
                return Object.freeze({ x: x, y: team === 'ai' ? aiY : this.table.length - (0.480 - row * this.cup.centerSpacing), z: 0 });
            }
            cursor += count;
        }
        throw new RangeError('Invalid cup index: ' + index);
    }
}

class PhysicsWorld {
    constructor(geometry) {
        this.geometry = geometry || new WorldGeometry();
        this.fixedTimeStep = PhysicsConstants.SI.fixedTimeStep;
        this.maxCatchUpSteps = 8;
        this.maxFrameDelta = this.fixedTimeStep * this.maxCatchUpSteps;
        this.accumulator = 0;
        this.simulatedTime = 0;
        this.droppedTime = 0;
        this.lastStepCount = 0;
    }

    advanceFrame(elapsedSeconds, fixedStepCallback) {
        var safeElapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
        var acceptedElapsed = Math.min(safeElapsed, this.maxFrameDelta);
        this.droppedTime += safeElapsed - acceptedElapsed;
        this.accumulator += acceptedElapsed;

        var stepCount = Math.min(Math.floor(this.accumulator / this.fixedTimeStep), this.maxCatchUpSteps);
        for (var step = 0; step < stepCount; step++) {
            fixedStepCallback(this.fixedTimeStep);
            this.accumulator -= this.fixedTimeStep;
            this.simulatedTime += this.fixedTimeStep;
        }

        if (this.accumulator >= this.fixedTimeStep) {
            var discarded = this.accumulator - (this.accumulator % this.fixedTimeStep);
            this.accumulator -= discarded;
            this.droppedTime += discarded;
        }
        this.lastStepCount = stepCount;
        return Object.freeze({
            stepCount: stepCount,
            interpolationAlpha: this.accumulator / this.fixedTimeStep,
            simulatedTime: this.simulatedTime,
            droppedTime: this.droppedTime
        });
    }

    resetClock() {
        this.accumulator = 0;
        this.simulatedTime = 0;
        this.droppedTime = 0;
        this.lastStepCount = 0;
    }

    launchPosition(team) {
        return Object.freeze({
            x: this.geometry.table.width / 2,
            y: team === 'player' ? this.geometry.table.length - 0.080 : 0.080,
            z: 0
        });
    }

    createCupBodies(cupElements, difficulty) {
        var cup = this.geometry.cup;
        var radiusOffset = ({ easy: 0.004, normal: 0, hard: -0.002 })[difficulty] || 0;
        return cupElements.map((element) => {
            var team = element.dataset.team;
            var position = this.geometry.cupPosition(team, Number(element.dataset.idx));
            var outerTopRadius = cup.outerTopRadius + radiusOffset;
            var innerTopRadius = outerTopRadius - cup.wallThickness;
            var outerBottomRadius = cup.outerBottomRadius + radiusOffset;
            var innerBottomRadius = outerBottomRadius - cup.wallThickness;
            return Object.freeze({
                el: element,
                cx: position.x,
                cy: position.y,
                colliders: Object.freeze({
                    rimCenterR: (outerTopRadius + innerTopRadius) / 2,
                    rimTubeR: cup.rimTubeRadius,
                    rimZ: cup.height,
                    outerTopR: outerTopRadius,
                    outerBottomR: outerBottomRadius,
                    innerTopR: innerTopRadius,
                    innerBottomR: innerBottomRadius,
                    openingR: innerTopRadius,
                    height: cup.height,
                    bottomZ: cup.bottomHeight
                })
            });
        });
    }
}

class PhysicsEngine {
    constructor() {
      this.world = new PhysicsWorld();
      var constants = PhysicsConstants.SI;
      var ball = this.world.geometry.ball;
      this.GRAVITY = constants.gravity;
      this.BALL_R = ball.radius;
      this.BALL_MASS = ball.mass;
      this.BALL_AREA = ball.crossSectionArea;
      this.AIR_DENSITY = constants.airDensity;
      this.DRAG_COEFF = constants.dragCoefficient;
      
      // Coefficients of restitution (Energy loss upon impact)
      this.TABLE_BOUNCE_E = constants.tableRestitution;
      this.RIM_BOUNCE_E = constants.rimRestitution;
      this.CUP_WALL_E = constants.cupWallRestitution;
      this.CUP_FLOOR_E = constants.cupFloorRestitution;
      
      // Friction constants
      this.SLIDE_FRICTION = constants.slideFriction;
      this.ROLL_FRICTION = constants.rollFriction;
      this.SPIN_DECAY = constants.spinDecay;
      this.MAGNUS_ACCELERATION_FACTOR = constants.magnusAccelerationFactor;

      this.STOP_SPEED = constants.stopSpeed;
      this.FIXED_DT = constants.fixedTimeStep;
      
      this.liveSimulations = [];
    }
    
    stop() {
        this.liveSimulations = [];
        this.world.resetClock();
    }
    
    parseCups(cupEls, difficulty) {
      return this.world.createCupBodies(cupEls, difficulty);
    }
    
    advanceFrame(elapsedSeconds) {
        return this.world.advanceFrame(elapsedSeconds, () => this.stepLiveSimulations());
    }

    stepLiveSimulations() {
        for (let i = this.liveSimulations.length - 1; i >= 0; i--) {
            let sim = this.liveSimulations[i];
            if (!sim.settled) {
                this.stepFixed(sim, sim.tableGeometry, sim.cups, sim.windAccel);
                if (sim.onUpdate) sim.onUpdate(sim);
                if (sim.settled) {
                    if (sim.onComplete) sim.onComplete(sim);
                    this.liveSimulations.splice(i, 1);
                }
            }
        }
    }
    
    startLiveSimulation(state, cups, tableGeometry, windAccel, onUpdate, onComplete) {
        let sim = Object.assign(this.createSimulationState(state), {
            cups: cups,
            tableGeometry: tableGeometry,
            windAccel: windAccel,
            onUpdate: onUpdate,
            onComplete: onComplete,
        });
        this.liveSimulations.push(sim);
        return sim;
    }

    cloneState(s) {
        return this.createSimulationState(s);
    }

    createSimulationState(s) {
        var state = {
            x: s.x, y: s.y, z: s.z || 0,
            prevX: s.x, prevY: s.y, prevZ: s.z || 0,
            vx: s.vx, vy: s.vy, vz: s.vz,
            angularVelocityX: s.angularVelocityX || 0,
            angularVelocityY: s.angularVelocityY || 0,
            angularVelocityZ: s.angularVelocityZ || 0,
            bounces: s.bounces || 0,
            insideCup: s.insideCup || null,
            settled: s.settled || false,
            outcome: s.outcome || null,
            hitCupEl: s.hitCupEl || null,
            event: s.event || null,
            orientation: {
                x: s.orientation ? s.orientation.x : 0,
                y: s.orientation ? s.orientation.y : 0,
                z: s.orientation ? s.orientation.z : 0
            },
            airborne: true,
            contactState: { type: 'none', cupElement: null },
            activeContacts: []
        };
        this.synchronizeStructuredState(state);
        return state;
    }

    synchronizeStructuredState(s) {
        s.position = { x: s.x, y: s.y, z: s.z };
        s.previousPosition = { x: s.prevX, y: s.prevY, z: s.prevZ };
        s.velocity = { x: s.vx, y: s.vy, z: s.vz };
        s.angularVelocity = { x: s.angularVelocityX || 0, y: s.angularVelocityY || 0, z: s.angularVelocityZ || 0 };
        s.airborne = s.z > this.world.geometry.table.surfaceHeight + 0.0005 && !s.insideCup;
        var contactType = s.event || (s.insideCup ? 'cup-interior' : (s.airborne ? 'none' : 'table'));
        s.contactState = { type: contactType, cupElement: s.insideCup ? s.insideCup.el : null };
        s.activeContacts = contactType === 'none' ? [] : [s.contactState];
    }

    evaluateSettlement(s) {
        let horizontalSpeed = Math.hypot(s.vx, s.vy);
        if (s.insideCup) {
            let bottom = s.insideCup.colliders.bottomZ;
            if (Math.abs(s.vz) < 0.025 && s.z <= bottom + 0.003 && horizontalSpeed < this.STOP_SPEED) {
                s.settled = true;
                s.outcome = 'hit';
                s.hitCupEl = s.insideCup.el;
            }
        } else if (s.z <= 0.0005 && horizontalSpeed < this.STOP_SPEED) {
            s.settled = true;
            s.outcome = s.outcome || 'miss';
        }
    }

    /**
     * Advance simulation by dt using adaptive sub-stepping and Continuous Collision Detection (CCD).
     */
    stepFixed(s, tableGeometry, cups, windAccel) {
        s.prevX = s.x;
        s.prevY = s.y;
        s.prevZ = s.z;
        this._integrateFixedInterval(s, tableGeometry, cups, windAccel);
        this.evaluateSettlement(s);
        this.synchronizeStructuredState(s);
    }

    _integrateFixedInterval(s, tableGeometry, cups, windAccel) {
        let dt = this.FIXED_DT;
        let speed = Math.sqrt(s.vx*s.vx + s.vy*s.vy + s.vz*s.vz);
        // Adaptive sub-stepping based on current velocity to prevent tunneling
        let minSubsteps = 10;
        let maxSubsteps = 40;
        let maxMovePerSubstep = Math.max(0.001, this.BALL_R * 0.4); // Maximum one-millimeter movement floor per substep
        let requiredSubsteps = Math.ceil((speed * dt) / maxMovePerSubstep);
        let steps = Math.min(maxSubsteps, Math.max(minSubsteps, requiredSubsteps));
        
        let sub_dt = dt / steps;
        let stepEvent = null;
        
        for (let step = 1; step <= steps; step++) {
            this.subStep(s, sub_dt, tableGeometry, cups, windAccel);
            if (s.event) stepEvent = s.event;
        }
        s.event = stepEvent;
    }

    /**
     * Single physics sub-step solver: Forces -> Position Update -> Continuous Collision Resolution.
     */
    subStep(s, dt, tableGeometry, cups, windAccel) {
        // 1. Aerodynamic Forces & Spin (Drag + Magnus + Gravity + Wind)
        let vMag = Math.sqrt(s.vx*s.vx + s.vy*s.vy + s.vz*s.vz);
        if (vMag > 0.001) {
            // Air Drag: Fd = 0.5 * rho * v^2 * Cd * A
            let dragForce = 0.5 * this.AIR_DENSITY * vMag * vMag * this.DRAG_COEFF * this.BALL_AREA;
            let dragAccel = dragForce / this.BALL_MASS;
            
            s.vx -= (s.vx / vMag) * dragAccel * dt;
            s.vy -= (s.vy / vMag) * dragAccel * dt;
            s.vz -= (s.vz / vMag) * dragAccel * dt;
            
            // Aerodynamic Magnus Effect (Spin Curve)
            // Force vector F_magnus = S * (w x v)
            let wx = s.angularVelocityX || 0;
            let wy = s.angularVelocityY || 0;
            let wz = s.angularVelocityZ || 0;
            
            let cx = wy * s.vz - wz * s.vy;
            let cy = wz * s.vx - wx * s.vz;
            let cz = wx * s.vy - wy * s.vx;
            
            let magnusCoeff = this.MAGNUS_ACCELERATION_FACTOR;
            s.vx += cx * magnusCoeff * dt;
            s.vy += cy * magnusCoeff * dt;
            s.vz += cz * magnusCoeff * dt;
        }
        
        // Gravity & Environmental Wind
        s.vz -= this.GRAVITY * dt;
        if (windAccel) {
            s.vx += windAccel * dt;
        }

        // Aerodynamic spin decay
        let spinMag = Math.sqrt((s.angularVelocityX||0)**2 + (s.angularVelocityY||0)**2 + (s.angularVelocityZ||0)**2);
        if (spinMag > 0) {
            let decay = this.SPIN_DECAY * dt;
            let ratio = Math.max(0, spinMag - decay) / spinMag;
            s.angularVelocityX *= ratio;
            s.angularVelocityY *= ratio;
            s.angularVelocityZ *= ratio;
        }
        s.orientation.x += (s.angularVelocityX || 0) * dt;
        s.orientation.y += (s.angularVelocityY || 0) * dt;
        s.orientation.z += (s.angularVelocityZ || 0) * dt;

        s.event = null;

        // 2. Integration / Position Prediction
        let nextX = s.x + s.vx * dt;
        let nextY = s.y + s.vy * dt;
        let nextZ = s.z + s.vz * dt;
        
        // 3. 3D Cup Geometry Collision Solver
        for(let i = 0; i < cups.length; i++) {
            let g = cups[i];
            let c = g.colliders;
            
            let dx = nextX - g.cx;
            let dy = nextY - g.cy;
            let dist2D = Math.sqrt(dx*dx + dy*dy);
            
            // Broadphase spatial culling
            if (dist2D > c.outerTopR + this.BALL_R + 0.060) continue;
            
            let uX = dist2D > 0.0001 ? dx / dist2D : 1;
            let uY = dist2D > 0.0001 ? dy / dist2D : 0;
            let ballCenterZ = nextZ + this.BALL_R;

            // --- A. RIM COLLIDER (3D Torus Ring at z = height) ---
            let ringX = g.cx + c.rimCenterR * uX;
            let ringY = g.cy + c.rimCenterR * uY;
            let ringZ = c.rimZ;
            
            let rx = nextX - ringX;
            let ry = nextY - ringY;
            let rz = ballCenterZ - ringZ;
            let distToRing = Math.sqrt(rx*rx + ry*ry + rz*rz);
            
            if (distToRing < this.BALL_R + c.rimTubeR) {
                let nx = distToRing > 0.0001 ? rx / distToRing : uX;
                let ny = distToRing > 0.0001 ? ry / distToRing : uY;
                let nz = distToRing > 0.0001 ? rz / distToRing : 0;
                
                let vn = s.vx * nx + s.vy * ny + s.vz * nz;
                if (vn < 0) {
                    // Normal restitution impulse
                    s.vx -= (1 + this.RIM_BOUNCE_E) * vn * nx;
                    s.vy -= (1 + this.RIM_BOUNCE_E) * vn * ny;
                    s.vz -= (1 + this.RIM_BOUNCE_E) * vn * nz;
                    
                    // Spin coupling on rim contact
                    this.applySurfaceSpinTransfer(s, nx, ny, nz, this.SLIDE_FRICTION);

                    // Event classification
                    let inwardDir = (-uX * s.vx) + (-uY * s.vy);
                    if (s.vz < 0 && inwardDir > 0) {
                        s.event = 'lip-in';
                    } else if (inwardDir <= 0 && (s.vx*uX + s.vy*uY) > 0) {
                        s.event = 'lip-out';
                    } else {
                        s.event = 'rim';
                    }
                }
                
                // Position anti-penetration resolution
                let push = (this.BALL_R + c.rimTubeR) - distToRing;
                nextX += nx * push;
                nextY += ny * push;
                nextZ += nz * push;
                
                dx = nextX - g.cx;
                dy = nextY - g.cy;
                dist2D = Math.sqrt(dx*dx + dy*dy);
                uX = dist2D > 0.0001 ? dx / dist2D : 1;
                uY = dist2D > 0.0001 ? dy / dist2D : 0;
                ballCenterZ = nextZ + this.BALL_R;
            }
            
            // --- B. TOP APERTURE / CUP ENTRY ---
            if (!s.insideCup && nextZ <= c.height && (nextZ - s.vz*dt) > c.height - 0.010) {
                if (dist2D < c.openingR) {
                    s.insideCup = g;
                    let speed = Math.sqrt(s.vx*s.vx + s.vy*s.vy + s.vz*s.vz);
                    s.event = (speed < 0.250 && dist2D < c.openingR * 0.6) ? 'soft-drop' : 'enter';
                }
            }
            if (s.insideCup === g && nextZ > c.height) {
                s.insideCup = null;
            }
            
            let zFrac = Math.max(0, Math.min(1, ballCenterZ / c.height));
            
            // --- C. OUTER WALL FRUSTUM COLLIDER ---
            if (!s.insideCup) {
                if (nextZ < c.height && nextZ > 0) {
                    let outerRAtZ = c.outerBottomR + (c.outerTopR - c.outerBottomR) * zFrac;
                    if (dist2D < outerRAtZ + this.BALL_R) {
                        let slope = (c.outerTopR - c.outerBottomR) / c.height;
                        let nx = uX;
                        let ny = uY;
                        let nz = -slope;
                        let nLen = Math.sqrt(nx*nx + ny*ny + nz*nz);
                        nx /= nLen; ny /= nLen; nz /= nLen;
                        
                        let vn = s.vx * nx + s.vy * ny + s.vz * nz;
                        if (vn < 0) {
                            s.vx -= (1 + this.CUP_WALL_E) * vn * nx;
                            s.vy -= (1 + this.CUP_WALL_E) * vn * ny;
                            s.vz -= (1 + this.CUP_WALL_E) * vn * nz;
                            this.applySurfaceSpinTransfer(s, nx, ny, nz, this.SLIDE_FRICTION);
                            s.event = 'hard-rebound';
                        }
                        
                        let push = (outerRAtZ + this.BALL_R) - dist2D;
                        nextX += uX * push;
                        nextY += uY * push;
                        
                        dx = nextX - g.cx;
                        dy = nextY - g.cy;
                        dist2D = Math.sqrt(dx*dx + dy*dy);
                        uX = dist2D > 0.0001 ? dx / dist2D : 1;
                        uY = dist2D > 0.0001 ? dy / dist2D : 0;
                    }
                }
            }
            
            // --- D. INNER WALL INTERIOR FRUSTUM COLLIDER ---
            if (s.insideCup === g) {
                let innerRAtZ = c.innerBottomR + (c.innerTopR - c.innerBottomR) * zFrac;
                if (dist2D + this.BALL_R > innerRAtZ && nextZ < c.height) {
                    let slope = (c.innerTopR - c.innerBottomR) / c.height;
                    let nx = -uX;
                    let ny = -uY;
                    let nz = slope;
                    let nLen = Math.sqrt(nx*nx + ny*ny + nz*nz);
                    nx /= nLen; ny /= nLen; nz /= nLen;
                    
                    let vn = s.vx * nx + s.vy * ny + s.vz * nz;
                    if (vn < 0) {
                        s.vx -= (1 + this.CUP_WALL_E) * vn * nx;
                        s.vy -= (1 + this.CUP_WALL_E) * vn * ny;
                        s.vz -= (1 + this.CUP_WALL_E) * vn * nz;
                        this.applySurfaceSpinTransfer(s, nx, ny, nz, this.SLIDE_FRICTION);
                        s.event = 'interior-bounce';
                    }
                    let push = (dist2D + this.BALL_R) - innerRAtZ;
                    nextX -= uX * push;
                    nextY -= uY * push;
                    
                    dx = nextX - g.cx;
                    dy = nextY - g.cy;
                    dist2D = Math.sqrt(dx*dx + dy*dy);
                    uX = dist2D > 0.0001 ? dx / dist2D : 1;
                    uY = dist2D > 0.0001 ? dy / dist2D : 0;
                }
                
                // --- E. CUP INTERIOR FLOOR ---
                if (nextZ <= c.bottomZ) {
                    if (s.vz < 0) {
                        s.bounces++;
                        s.vz = Math.abs(s.vz) * this.CUP_FLOOR_E;
                        
                        let vtX = s.vx;
                        let vtY = s.vy;
                        let vtMag = Math.sqrt(vtX*vtX + vtY*vtY);
                        if (vtMag > 0) {
                            let friction = this.SLIDE_FRICTION * Math.abs(s.vz);
                            let loss = Math.min(vtMag, friction);
                            s.vx -= (vtX/vtMag) * loss;
                            s.vy -= (vtY/vtMag) * loss;
                        }
                        if (s.vz < 0.015) s.vz = 0;
                        s.event = 'floor-bounce';
                    }
                    nextZ = Math.max(nextZ, c.bottomZ);
                }
            }
        }
        
        // 4. Table Surface & Ground Collision Solver
        if (!s.insideCup) {
            let tableHeight = this.world.geometry.table.surfaceHeight;
            let GROUND_Z = this.world.geometry.table.groundHeight;
            
            if (nextZ <= tableHeight) {
                if (tableGeometry && nextX >= tableGeometry.left && nextX <= tableGeometry.right && nextY >= tableGeometry.top && nextY <= tableGeometry.bottom) {
                    if (s.vz < 0) {
                        s.bounces++;
                        s.vz = Math.abs(s.vz) * this.TABLE_BOUNCE_E;
                        s.event = 'bounce';
                        
                        // Spin transfer on table bounce (Sidespin kicks ball sideways on impact)
                        this.applySurfaceSpinTransfer(s, 0, 0, 1, this.SLIDE_FRICTION);
                        
                        let vtX = s.vx;
                        let vtY = s.vy;
                        let vtMag = Math.sqrt(vtX*vtX + vtY*vtY);
                        if (vtMag > 0) {
                            let slideLoss = this.SLIDE_FRICTION * Math.abs(s.vz);
                            let rollLoss = this.ROLL_FRICTION * dt * this.GRAVITY;
                            let totalLoss = Math.min(vtMag, slideLoss + rollLoss);
                            s.vx -= (vtX/vtMag) * totalLoss;
                            s.vy -= (vtY/vtMag) * totalLoss;
                        }
                        
                        if (s.vz < 0.020) s.vz = 0;
                    }
                    nextZ = tableHeight;
                } else if (nextZ <= GROUND_Z) {
                    nextZ = GROUND_Z;
                    s.vx = 0; s.vy = 0; s.vz = 0;
                    s.settled = true;
                }
            }
            
            // Table Edge Bounds Solver
            if(tableGeometry && nextZ >= tableHeight - 0.020 && nextZ <= tableHeight + 0.020){
                if(nextX < tableGeometry.left + this.BALL_R){ nextX = tableGeometry.left + this.BALL_R; s.vx = Math.abs(s.vx) * 0.5; }
                if(nextX > tableGeometry.right - this.BALL_R){ nextX = tableGeometry.right - this.BALL_R; s.vx = -Math.abs(s.vx) * 0.5; }
                if(nextY < tableGeometry.top + this.BALL_R){ nextY = tableGeometry.top + this.BALL_R; s.vy = Math.abs(s.vy) * 0.5; }
                if(nextY > tableGeometry.bottom - this.BALL_R){ nextY = tableGeometry.bottom - this.BALL_R; s.vy = -Math.abs(s.vy) * 0.5; }
            }
        }
        
        s.x = nextX;
        s.y = nextY;
        s.z = nextZ;
    }

    /**
     * Tangential spin impulse coupling: converts angular momentum into linear velocity shift on surface contact.
     */
    applySurfaceSpinTransfer(s, nx, ny, nz, frictionCoeff) {
        let wx = s.angularVelocityX || 0;
        let wy = s.angularVelocityY || 0;
        let wz = s.angularVelocityZ || 0;
        
        let spinMag = Math.sqrt(wx*wx + wy*wy + wz*wz);
        if (spinMag < 0.01) return;

        // Tangential velocity generated by spin at contact point r = -n * R
        // v_tangent_spin = w x r = w x (-n * R) = R * (n x w)
        let R = this.BALL_R;
        let cx = R * (ny * wz - nz * wy);
        let cy = R * (nz * wx - nx * wz);
        let cz = R * (nx * wy - ny * wx);

        // Apply friction transfer impulse to linear velocity
        let transferFactor = frictionCoeff * 0.15;
        s.vx += cx * transferFactor;
        s.vy += cy * transferFactor;
        s.vz += cz * transferFactor;

        // Angular momentum conservation damping
        s.angularVelocityX *= (1 - transferFactor);
        s.angularVelocityY *= (1 - transferFactor);
        s.angularVelocityZ *= (1 - transferFactor);
    }
}
window.PhysicsConstants = PhysicsConstants;
window.WorldGeometry = WorldGeometry;
window.BallBody = BallBody;
window.CupGeometry = CupGeometry;
window.TableGeometry = TableGeometry;
window.PhysicsWorld = PhysicsWorld;
window.PhysicsEngine = PhysicsEngine;
