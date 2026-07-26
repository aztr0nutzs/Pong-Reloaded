class PhysicsEngine {
    constructor() {
      // 1 mm = 1 unit. Standard ping pong ball: 40mm diameter (R=20mm, scaled in-game ~13-20mm). 
      // Gravity = 6000 mm/s^2 (calibrated for responsive arcade-table feel)
      this.GRAVITY = 6000; 
      this.BALL_R = 13; 
      this.AIR_DENSITY = 1.225e-9; // kg/mm^3
      this.BALL_MASS = 0.0027; // kg (2.7 grams)
      this.BALL_AREA = Math.PI * 13 * 13; // mm^2
      this.DRAG_COEFF = 0.47; // Sphere drag coefficient
      
      // Coefficients of restitution (Energy loss upon impact)
      this.TABLE_BOUNCE_E = 0.82; // Table surface bounce elasticity
      this.RIM_BOUNCE_E = 0.68;   // Plastic rim torus bounce elasticity
      this.CUP_WALL_E = 0.35;     // Plastic cup wall damping
      this.CUP_FLOOR_E = 0.18;    // Beer liquid / interior floor heavy damping
      
      // Friction constants
      this.SLIDE_FRICTION = 0.28; // Kinetic sliding friction coefficient
      this.ROLL_FRICTION = 0.015; // Rolling resistance coefficient
      this.SPIN_DECAY = 0.6;      // Angular velocity aerodynamic decay rate (rad/s^2)

      this.STOP_SPEED = 15;       // Settlement threshold (mm/s)
      this.FIXED_DT = 1 / 120;    // 120Hz fixed physics timestep
      
      this.liveSimulations = [];
    }
    
    stop() {
        this.liveSimulations = [];
    }
    
    parseCups(cupEls, difficulty) {
      var diffSizes = { easy: 4.0, normal: 0, hard: -2.0 };
      var szOffset = diffSizes[difficulty] || 0;
      
      var cups = [];
      for(var i=0; i<cupEls.length; i++){
          var el = cupEls[i];
          var cx = parseFloat(el.dataset.cx);
          var cy = parseFloat(el.dataset.cy);
          var w = parseFloat(el.dataset.cw);
          
          if (isNaN(cx) || isNaN(cy) || isNaN(w)) {
              var rect = el.getBoundingClientRect();
              cx = rect.left + rect.width / 2;
              cy = rect.top + rect.height / 2;
              w = rect.width;
              el.dataset.cx = cx;
              el.dataset.cy = cy;
              el.dataset.cw = w;
          }
          
          var outerTopR = (w / 2) + szOffset;
          var innerTopR = Math.max(8, outerTopR - 2.0); // 2mm rim wall thickness
          
          var outerBottomR = (w * 0.36) + szOffset;
          var innerBottomR = Math.max(5, outerBottomR - 2.0);
          
          var cupHeight = w * 1.25; // 3D cup height proportional to diameter
          var rimTubeRadius = (outerTopR - innerTopR) / 2;
          var rimCenterRadius = (outerTopR + innerTopR) / 2;
          
          cups.push({
             el: el,
             cx: cx,
             cy: cy,
             colliders: {
                // 1. Rim collider (3D torus ring at top of cup)
                rimCenterR: rimCenterRadius, 
                rimTubeR: Math.max(1.5, rimTubeRadius), 
                rimZ: cupHeight,

                // 2. Outer wall frustum
                outerTopR: outerTopR,
                outerBottomR: outerBottomR,

                // 3. Inner wall frustum
                innerTopR: innerTopR,
                innerBottomR: innerBottomR,

                // 4. Opening (top aperture at cupHeight)
                openingR: innerTopR,
                height: cupHeight,

                // 5. Interior & Bottom floor
                bottomZ: 2.0 // 2mm interior floor offset above table surface
             }
          });
      }
      return cups;
    }
    
    /**
     * Fixed physics update step driven by 120Hz accumulator loop.
     * Guarantees frame-rate independent physics simulation.
     */
    fixedUpdate(dt) {
        let stepDt = dt || this.FIXED_DT;
        for (let i = this.liveSimulations.length - 1; i >= 0; i--) {
            let sim = this.liveSimulations[i];
            if (!sim.settled) {
                sim.prevX = sim.x;
                sim.prevY = sim.y;
                sim.prevZ = sim.z;
                
                this.step(sim, stepDt, sim.tableRect, sim.cups, sim.windAccel);
                
                if (sim.onUpdate) sim.onUpdate(sim);
                
                // Settlement check: deterministic rest condition
                let hs = Math.sqrt(sim.vx*sim.vx + sim.vy*sim.vy);
                if (sim.insideCup) {
                    let bFloorZ = sim.insideCup.colliders.bottomZ;
                    if (Math.abs(sim.vz) < 25 && sim.z <= bFloorZ + 3.0 && hs < this.STOP_SPEED) {
                        sim.settled = true;
                        sim.outcome = 'hit';
                        sim.hitCupEl = sim.insideCup.el;
                    }
                } else if (sim.z <= 0.5 && hs < this.STOP_SPEED) {
                    sim.settled = true;
                    sim.outcome = sim.outcome || 'miss';
                }
                
                if (sim.settled) {
                    if (sim.onComplete) sim.onComplete(sim);
                    this.liveSimulations.splice(i, 1);
                }
            }
        }
    }
    
    startLiveSimulation(state, cups, tableRect, windAccel, onUpdate, onComplete) {
        let sim = {
            ...state,
            prevX: state.x,
            prevY: state.y,
            prevZ: state.z,
            cups: cups,
            tableRect: tableRect,
            windAccel: windAccel,
            onUpdate: onUpdate,
            onComplete: onComplete,
            bounces: 0,
            insideCup: null,
            settled: false,
            outcome: null,
            hitCupEl: null,
            event: null
        };
        this.liveSimulations.push(sim);
        return sim;
    }

    cloneState(s) {
        return {
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
            event: s.event || null
        };
    }

    /**
     * Advance simulation by dt using adaptive sub-stepping and Continuous Collision Detection (CCD).
     */
    step(s, dt, tableRect, cups, windAccel) {
        let speed = Math.sqrt(s.vx*s.vx + s.vy*s.vy + s.vz*s.vz);
        // Adaptive sub-stepping based on current velocity to prevent tunneling
        let minSubsteps = 10;
        let maxSubsteps = 40;
        let maxMovePerSubstep = Math.max(1.0, this.BALL_R * 0.4); // Max 5.2mm movement per substep
        let requiredSubsteps = Math.ceil((speed * dt) / maxMovePerSubstep);
        let steps = Math.min(maxSubsteps, Math.max(minSubsteps, requiredSubsteps));
        
        let sub_dt = dt / steps;
        let stepEvent = null;
        
        for (let step = 1; step <= steps; step++) {
            this.subStep(s, sub_dt, tableRect, cups, windAccel);
            if (s.event) stepEvent = s.event;
        }
        s.event = stepEvent;
    }

    /**
     * Single physics sub-step solver: Forces -> Position Update -> Continuous Collision Resolution.
     */
    subStep(s, dt, tableRect, cups, windAccel) {
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
            
            let magnusCoeff = 0.00012;
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
            if (dist2D > c.outerTopR + this.BALL_R + 60) continue;
            
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
            if (!s.insideCup && nextZ <= c.height && (nextZ - s.vz*dt) > c.height - 10) {
                if (dist2D < c.openingR) {
                    s.insideCup = g;
                    let speed = Math.sqrt(s.vx*s.vx + s.vy*s.vy + s.vz*s.vz);
                    s.event = (speed < 250 && dist2D < c.openingR * 0.6) ? 'soft-drop' : 'enter';
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
                        if (s.vz < 15) s.vz = 0;
                        s.event = 'floor-bounce';
                    }
                    nextZ = Math.max(nextZ, c.bottomZ);
                }
            }
        }
        
        // 4. Table Surface & Ground Collision Solver
        if (!s.insideCup) {
            let tableHeight = 0;
            let GROUND_Z = -500;
            
            if (nextZ <= tableHeight) {
                if (tableRect && nextX >= tableRect.left && nextX <= tableRect.right && nextY >= tableRect.top && nextY <= tableRect.bottom) {
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
                        
                        if (s.vz < 20) s.vz = 0;
                    }
                    nextZ = tableHeight;
                } else if (nextZ <= GROUND_Z) {
                    nextZ = GROUND_Z;
                    s.vx = 0; s.vy = 0; s.vz = 0;
                    s.settled = true;
                }
            }
            
            // Table Edge Bounds Solver
            if(tableRect && nextZ >= tableHeight - 20 && nextZ <= tableHeight + 20){
                if(nextX < tableRect.left + this.BALL_R){ nextX = tableRect.left + this.BALL_R; s.vx = Math.abs(s.vx) * 0.5; }
                if(nextX > tableRect.right - this.BALL_R){ nextX = tableRect.right - this.BALL_R; s.vx = -Math.abs(s.vx) * 0.5; }
                if(nextY < tableRect.top + this.BALL_R){ nextY = tableRect.top + this.BALL_R; s.vy = Math.abs(s.vy) * 0.5; }
                if(nextY > tableRect.bottom - this.BALL_R){ nextY = tableRect.bottom - this.BALL_R; s.vy = -Math.abs(s.vy) * 0.5; }
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
window.PhysicsEngine = PhysicsEngine;
