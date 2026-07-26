const fs = require('fs');

const physicsCode = `class PhysicsEngine {
    constructor() {
      // 1 mm = 1 unit. Standard ping pong ball: 40mm diameter. 
      // We'll use mm for positions, so Gravity = 9800 mm/s^2
      this.GRAVITY = 9800; 
      this.BALL_R = 20; // Standard size is 20mm radius
      this.AIR_DENSITY = 1.225e-9; // kg/mm^3
      this.BALL_MASS = 0.0027; // kg (2.7 grams)
      this.BALL_AREA = Math.PI * this.BALL_R * this.BALL_R; // mm^2
      this.DRAG_COEFF = 0.47;
      
      this.TABLE_BOUNCE_E = 0.85; // high restitution
      this.RIM_BOUNCE_E = 0.7;
      this.CUP_WALL_E = 0.3;
      this.CUP_FLOOR_E = 0.2;
      
      this.SLIDE_FRICTION = 0.25;
      this.ROLL_FRICTION = 0.02;
      this.SPIN_DECAY = 0.5; // rad/s^2

      this.STOP_SPEED = 15; // mm/s
      
      this.FIXED_DT = 1 / 120; // 120Hz fixed timestep
      
      this.liveSimulations = [];
      this.tickInterval = setInterval(() => this.liveTick(), this.FIXED_DT * 1000);
    }
    
    stop() {
        clearInterval(this.tickInterval);
    }
    
    parseCups(cupEls, difficulty) {
      var diffSizes = { easy: 4.0, normal: 0, hard: -2.0 };
      var szOffset = diffSizes[difficulty] || 0;
      
      var cups = [];
      for(var i=0; i<cupEls.length; i++){
          var el = cupEls[i];
          var rect = el.getBoundingClientRect();
          var topR = 28 + szOffset;
          var bottomR = 20 + szOffset;
          cups.push({
             el: el,
             cx: rect.left + rect.width/2,
             cy: rect.top + rect.height/2,
             colliders: {
                rimR: topR, 
                rimTubeR: 3.5, 
                topInnerR: topR - 1.5,
                topOuterR: topR + 1.5,
                bottomInnerR: bottomR - 1.5,
                bottomOuterR: bottomR + 1.5,
                bottomZ: 0,
                height: 35
             }
          });
      }
      return cups;
    }
    
    // Live tick running independently of rendering
    liveTick() {
        for (let i = this.liveSimulations.length - 1; i >= 0; i--) {
            let sim = this.liveSimulations[i];
            if (!sim.settled) {
                this.step(sim, this.FIXED_DT, sim.tableRect, sim.cups, sim.windAccel);
                
                // Keep track of trajectory dynamically for rendering
                if (sim.onUpdate) sim.onUpdate(sim);
                
                // Settlement check
                let hs = Math.sqrt(sim.vx*sim.vx + sim.vy*sim.vy);
                if (sim.insideCup) {
                    if (Math.abs(sim.vz) < 30 && sim.z <= 2) {
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

    // Clone a state for prediction
    cloneState(s) {
        return {
            x: s.x, y: s.y, z: s.z || 0,
            vx: s.vx, vy: s.vy, vz: s.vz,
            angularVelocityX: s.angularVelocityX || 0,
            angularVelocityZ: s.angularVelocityZ || 0,
            angularVelocityY: s.angularVelocityY || 0,
            bounces: s.bounces || 0,
            insideCup: s.insideCup || null,
            settled: s.settled || false,
            outcome: s.outcome || null,
            hitCupEl: s.hitCupEl || null,
            event: s.event || null
        };
    }

    // Step physics forward by dt. Uses continuous collision detection (CCD) logic via sweeps or multiple sub-steps.
    step(s, dt, tableRect, cups, windAccel) {
        // We use sub-stepping for CCD
        let steps = 4;
        let sub_dt = dt / steps;
        
        for (let step = 1; step <= steps; step++) {
            this.subStep(s, sub_dt, tableRect, cups, windAccel);
        }
    }

    subStep(s, dt, tableRect, cups, windAccel) {
        // 1. Compute forces
        let vMag = Math.sqrt(s.vx*s.vx + s.vy*s.vy + s.vz*s.vz);
        if (vMag > 0.001) {
            // Air drag: Fd = 0.5 * rho * v^2 * Cd * A
            let dragForce = 0.5 * this.AIR_DENSITY * vMag * vMag * this.DRAG_COEFF * this.BALL_AREA;
            let dragAccel = dragForce / this.BALL_MASS;
            
            s.vx -= (s.vx / vMag) * dragAccel * dt;
            s.vy -= (s.vy / vMag) * dragAccel * dt;
            s.vz -= (s.vz / vMag) * dragAccel * dt;
            
            // Magnus effect (spin)
            // Fm = 0.5 * rho * v^2 * Cl * A
            // Simplified: perpendicular force based on cross product of angular velocity and velocity
            let wx = s.angularVelocityX || 0;
            let wy = s.angularVelocityY || 0;
            let wz = s.angularVelocityZ || 0;
            
            // Cross product W x V
            let cx = wy * s.vz - wz * s.vy;
            let cy = wz * s.vx - wx * s.vz;
            let cz = wx * s.vy - wy * s.vx;
            
            let magnusCoeff = 0.0001; // empirical tuning
            s.vx += cx * magnusCoeff * dt;
            s.vy += cy * magnusCoeff * dt;
            s.vz += cz * magnusCoeff * dt;
        }
        
        // Gravity & Wind
        s.vz -= this.GRAVITY * dt;
        if (windAccel) {
            s.vx += windAccel * dt;
        }

        // Apply angular decay
        let spinMag = Math.sqrt((s.angularVelocityX||0)**2 + (s.angularVelocityY||0)**2 + (s.angularVelocityZ||0)**2);
        if (spinMag > 0) {
            let decay = this.SPIN_DECAY * dt;
            let ratio = Math.max(0, spinMag - decay) / spinMag;
            s.angularVelocityX *= ratio;
            s.angularVelocityY *= ratio;
            s.angularVelocityZ *= ratio;
        }

        s.event = null;

        // 2. Continuous Collision Detection (CCD)
        // Ray cast from current pos to next pos
        let nextX = s.x + s.vx * dt;
        let nextY = s.y + s.vy * dt;
        let nextZ = s.z + s.vz * dt;
        
        // Check collisions against cups
        for(let i = 0; i < cups.length; i++) {
            let g = cups[i];
            let c = g.colliders;
            
            let dx = nextX - g.cx;
            let dy = nextY - g.cy;
            let dist2D = Math.sqrt(dx*dx + dy*dy);
            
            if (dist2D > c.topOuterR + this.BALL_R + 50) continue;
            
            let ballCenterZ = nextZ + this.BALL_R;
            let angle = Math.atan2(dy, dx);
            let ringX = g.cx + c.rimR * Math.cos(angle);
            let ringY = g.cy + c.rimR * Math.sin(angle);
            let ringZ = c.height;
            
            let distToRing = Math.sqrt((nextX-ringX)**2 + (nextY-ringY)**2 + (ballCenterZ-ringZ)**2);
            
            // Rim continuous collision
            if (distToRing < this.BALL_R + c.rimTubeR) {
                let nx = (nextX - ringX) / (distToRing || 1);
                let ny = (nextY - ringY) / (distToRing || 1);
                let nz = (ballCenterZ - ringZ) / (distToRing || 1);
                
                let vn = s.vx * nx + s.vy * ny + s.vz * nz;
                if (vn < 0) {
                    s.vx -= (1 + this.RIM_BOUNCE_E) * vn * nx;
                    s.vy -= (1 + this.RIM_BOUNCE_E) * vn * ny;
                    s.vz -= (1 + this.RIM_BOUNCE_E) * vn * nz;
                    s.event = 'rim';
                }
                
                let push = (this.BALL_R + c.rimTubeR) - distToRing;
                nextX += nx * push;
                nextY += ny * push;
                nextZ += nz * push;
                
                dx = nextX - g.cx;
                dy = nextY - g.cy;
                dist2D = Math.sqrt(dx*dx + dy*dy);
                ballCenterZ = nextZ + this.BALL_R;
            }
            
            // Cup Entry/Exit
            if (!s.insideCup && nextZ <= c.height && nextZ > 0) {
                if (dist2D < c.rimR) {
                    s.insideCup = g;
                    s.event = 'enter';
                }
            }
            if (s.insideCup === g && nextZ > c.height) {
                s.insideCup = null;
            }
            
            let zFrac = Math.max(0, Math.min(1, ballCenterZ / c.height));
            
            // Outer wall
            if (!s.insideCup) {
                if (nextZ < c.height && nextZ > 0) {
                    let outerRAtZ = c.bottomOuterR + (c.topOuterR - c.bottomOuterR) * zFrac;
                    if (dist2D < outerRAtZ + this.BALL_R) {
                        let slope = (c.topOuterR - c.bottomOuterR) / c.height;
                        let nx = dx / (dist2D || 1);
                        let ny = dy / (dist2D || 1);
                        let nz = -slope;
                        let nLen = Math.sqrt(nx*nx + ny*ny + nz*nz);
                        nx /= nLen; ny /= nLen; nz /= nLen;
                        
                        let vn = s.vx * nx + s.vy * ny + s.vz * nz;
                        if (vn < 0) {
                            s.vx -= (1 + this.CUP_WALL_E) * vn * nx;
                            s.vy -= (1 + this.CUP_WALL_E) * vn * ny;
                            s.vz -= (1 + this.CUP_WALL_E) * vn * nz;
                            s.event = 'wall-bounce';
                        }
                        
                        let push = (outerRAtZ + this.BALL_R) - dist2D;
                        nextX += (dx / dist2D) * push;
                        nextY += (dy / dist2D) * push;
                        
                        dx = nextX - g.cx;
                        dy = nextY - g.cy;
                        dist2D = Math.sqrt(dx*dx + dy*dy);
                    }
                }
            }
            
            // Inner wall and floor
            if (s.insideCup === g) {
                let innerRAtZ = c.bottomInnerR + (c.topInnerR - c.bottomInnerR) * zFrac;
                if (dist2D + this.BALL_R > innerRAtZ && nextZ < c.height) {
                    let slope = (c.topInnerR - c.bottomInnerR) / c.height;
                    let nx = -dx / (dist2D || 1);
                    let ny = -dy / (dist2D || 1);
                    let nz = slope;
                    let nLen = Math.sqrt(nx*nx + ny*ny + nz*nz);
                    nx /= nLen; ny /= nLen; nz /= nLen;
                    
                    let vn = s.vx * nx + s.vy * ny + s.vz * nz;
                    if (vn < 0) {
                        s.vx -= (1 + this.CUP_WALL_E) * vn * nx;
                        s.vy -= (1 + this.CUP_WALL_E) * vn * ny;
                        s.vz -= (1 + this.CUP_WALL_E) * vn * nz;
                    }
                    let push = (dist2D + this.BALL_R) - innerRAtZ;
                    nextX -= (dx / dist2D) * push;
                    nextY -= (dy / dist2D) * push;
                    
                    dx = nextX - g.cx;
                    dy = nextY - g.cy;
                    dist2D = Math.sqrt(dx*dx + dy*dy);
                }
                
                if (nextZ <= c.bottomZ) {
                    if (s.vz < 0) {
                        s.bounces++;
                        s.vz = Math.abs(s.vz) * this.CUP_FLOOR_E;
                        
                        // Stable contact solver for energy loss and friction
                        let vtX = s.vx;
                        let vtY = s.vy;
                        let vtMag = Math.sqrt(vtX*vtX + vtY*vtY);
                        if (vtMag > 0) {
                            let friction = this.SLIDE_FRICTION * Math.abs(s.vz);
                            let loss = Math.min(vtMag, friction);
                            s.vx -= (vtX/vtMag) * loss;
                            s.vy -= (vtY/vtMag) * loss;
                        }
                        if (s.vz < 25) s.vz = 0;
                    }
                    nextZ = Math.max(nextZ, c.bottomZ);
                }
            }
        }
        
        // Ground / Table Collision
        if (!s.insideCup) {
            let tableHeight = 0;
            let GROUND_Z = -500;
            
            if (nextZ <= tableHeight) {
                if (tableRect && nextX >= tableRect.left && nextX <= tableRect.right && nextY >= tableRect.top && nextY <= tableRect.bottom) {
                    if (s.vz < 0) {
                        s.bounces++;
                        s.vz = Math.abs(s.vz) * this.TABLE_BOUNCE_E;
                        s.event = 'bounce';
                        
                        // Apply friction / rolling
                        let vtX = s.vx;
                        let vtY = s.vy;
                        let vtMag = Math.sqrt(vtX*vtX + vtY*vtY);
                        if (vtMag > 0) {
                            let slideLoss = this.SLIDE_FRICTION * Math.abs(s.vz);
                            let rollLoss = this.ROLL_FRICTION * dt * 9800; // gravity force
                            let totalLoss = Math.min(vtMag, slideLoss + rollLoss);
                            s.vx -= (vtX/vtMag) * totalLoss;
                            s.vy -= (vtY/vtMag) * totalLoss;
                        }
                        
                        if (s.vz < 30) s.vz = 0;
                    }
                    nextZ = tableHeight;
                } else if (nextZ <= GROUND_Z) {
                    nextZ = GROUND_Z;
                    s.vx = 0; s.vy = 0; s.vz = 0;
                    s.settled = true;
                }
            }
            
            // Edges of table collision
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
}
window.PhysicsEngine = PhysicsEngine;
`;
fs.writeFileSync('app/src/main/assets/js/modules/PhysicsEngine.js', physicsCode);
console.log("Wrote updated PhysicsEngine.js");
