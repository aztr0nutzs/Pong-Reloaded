/* ============================================================================
   ARCHIVED — LEGACY GAMEPLAY PHYSICS SUBSYSTEM (v1)
   ----------------------------------------------------------------------------
   This file preserves the ORIGINAL ball-flight / cup-collision / aiming /
   throw-resolution code that shipped in cyber_pong_arena_simulation_quality.html
   before the v2 rewrite. It has been fully removed from the live game and
   replaced by a new, from-scratch implementation split into five components:

       BeerPongPhysicsEngine, CupCollisionSystem, TrajectoryPredictor,
       AimController, ThrowController

   This archive is kept for historical reference only — it is NOT loaded by
   the game and NOT imported anywhere. Do not re-enable it.
   ============================================================================ */

  /* ================= GAME: BALL FLIGHT ================= */
  function resetBallPosition(fromTeam){
    var ball = $('ball');
    var laneEl = fromTeam === 'player' ? $('player-cups') : $('ai-cups');
    var rect = laneEl.getBoundingClientRect();
    ball.style.transform = '';
    var x = rect.left + rect.width/2 - PHYS.BALL_R;
    var y = fromTeam === 'player' ? (rect.bottom - 10) : (rect.top - 10);
    ball.style.left = x + 'px';
    ball.style.top = y + 'px';
  }

  /* ============================================================
     REALISTIC BEER-PONG PHYSICS ENGINE
     ------------------------------------------------------------
     Fixed-timestep, fully deterministic ball simulation. Given the
     same initial position/velocity/spin and the same cup layout,
     this ALWAYS produces the exact same path, bounces, and outcome
     — there is no Math.random() anywhere in this module.

     Coordinate model: x/y are real screen-space table coordinates
     (so the sim lines up with the existing DOM layout/rendering
     with zero changes to markup or CSS). z is height above the
     table, simulated with real gravity/restitution/friction and
     rendered back onto the 2D view as a vertical lift + depth
     scale on the existing #ball element — the same visual trick
     the old canned keyframe animation used, just now driven by an
     actual physics integration instead of a fixed curve.

     Cups are modeled with three collision zones, not a single
     circle: the rim ring (a torus the ball can bounce off or, on
     a well-controlled near-vertical drop, roll past), the interior
     wall (keeps a ball that fell in from sliding back out), and
     the floor (where it finally settles = scored point).
     ============================================================ */
  var PHYS = {
    GRAVITY: 2500,            // px/s^2
    AIR_DRAG: 0.045,          // air resistance coefficient
    MAGNUS: 0.00022,          // side-spin curve strength (Magnus-like)
    SPIN_DECAY: 0.55,         // spin lost per second
    BALL_R: 13,               // matches #ball (26px dia)
    CUP_HEIGHT: 30,           // rim height above table
    TABLE_BOUNCE_E: 0.42,     // table restitution
    TABLE_BOUNCE_DECAY: 0.82, // energy lost on each successive bounce
    RIM_BOUNCE_E: 0.48,
    CUP_WALL_E: 0.30,
    CUP_FLOOR_E: 0.22,
    ROLL_FRICTION: 620,       // px/s^2 once ball is rolling flat
    STOP_SPEED: 14,           // px/s below which a rolling ball is "stopped"
    DT: 1/120,                // fixed physics timestep (independent of render FPS)
    MAX_SIM_SECONDS: 4.5
  };

  function cupGeoms(cupsEls){
    var diff = state.settings.difficulty || 'normal';
    // Difficulty changes cup forgiveness only — never the throw physics itself.
    var openMul = diff === 'easy' ? 0.90 : (diff === 'hard' ? 0.60 : 0.76);
    var rimMul  = diff === 'easy' ? 1.30 : (diff === 'hard' ? 0.92 : 1.05);
    return cupsEls.map(function(el){
      var r = el.getBoundingClientRect();
      var baseR = r.width / 2;
      // Real cup geometry: outerR = physical outer wall, rimR = the lip the
      // ball actually contacts, openR = the true opening it must clear to
      // drop straight in, cavityR = interior wall once inside.
      return {
        el: el, cx: r.left + r.width/2, cy: r.top + r.height/2,
        outerR: baseR*rimMul, rimR: baseR*rimMul*0.94, openR: baseR*openMul, cavityR: baseR*openMul + 1
      };
    });
  }

  function handleTableAndWalls(s, prev, tableRect){
    if(s.z <= 0 && prev.z > 0){
      var t = prev.z / ((prev.z - s.z) || 1e-6);
      s.x = prev.x + (s.x - prev.x) * t;
      s.y = prev.y + (s.y - prev.y) * t;
      s.z = 0;
      s.bounces++;
      var e = PHYS.TABLE_BOUNCE_E * Math.pow(PHYS.TABLE_BOUNCE_DECAY, s.bounces - 1);
      s.vz = Math.abs(s.vz) * e;
      var grip = 1 + clamp(s.spinTop, -1, 1) * 0.18; // topspin grips & carries forward, backspin brakes
      s.vx *= 0.72 * grip; s.vy *= 0.72 * grip;
      s.spinTop *= 0.7; s.spinSide *= 0.7;
      s._event = 'bounce';
      if(s.vz < 22){ s.z = 0; s.vz = 0; }
    } else if(s.z < 0){
      s.z = 0;
    }
    if(s.z <= 0.5){
      var speed = Math.hypot(s.vx, s.vy);
      if(speed > 0){
        var dec = PHYS.ROLL_FRICTION * PHYS.DT;
        var ns = Math.max(0, speed - dec);
        var k = ns / speed;
        s.vx *= k; s.vy *= k;
      }
    }
    if(tableRect){
      if(s.x < tableRect.left + PHYS.BALL_R){ s.x = tableRect.left + PHYS.BALL_R; s.vx = Math.abs(s.vx) * 0.5; }
      if(s.x > tableRect.right - PHYS.BALL_R){ s.x = tableRect.right - PHYS.BALL_R; s.vx = -Math.abs(s.vx) * 0.5; }
    }
  }

  /* Cup contact resolution against the real, non-circular collision model:
     outer wall -> rim lip -> opening -> cavity -> floor. A shot's exact
     radial offset from center (how "centered" it crossed the rim band) and
     its exact vertical steepness at contact are combined into a single
     deterministic lipScore -- there is no dice roll here, just geometry and
     momentum, so the identical shot always resolves the identical way:
       lipScore >= CLEAN_IN   -> falls straight through the opening
       LIP_ZONE <= score < CLEAN_IN -> catches the rim lip; whether it then
         drops in ("lip-in") or spins out ("lip-out") is decided purely by
         comparing the ball's remaining downward momentum against how much
         the lip caught it -- a fast, off-center graze kicks out, a slow,
         near-centered graze tips in, exactly like a real rim shot.
       below LIP_ZONE -> clean rim deflection, ball bounces away. */
  function handleCupCollision(s, prev, cups){
    for(var i=0;i<cups.length;i++){
      var g = cups[i];
      var dCur = Math.hypot(s.x - g.cx, s.y - g.cy);
      if(dCur > g.outerR + PHYS.BALL_R + 30) continue; // cheap distance culling
      var crossedDown = prev.z > PHYS.CUP_HEIGHT && s.z <= PHYS.CUP_HEIGHT;
      if(!crossedDown) continue;
      // CCD: find the exact point within this substep where the ball crosses
      // the rim's height band, so a fast throw can't tunnel through a thin rim.
      var t = (prev.z - PHYS.CUP_HEIGHT) / ((prev.z - s.z) || 1e-6);
      var ix = prev.x + (s.x - prev.x) * t, iy = prev.y + (s.y - prev.y) * t;
      var dist = Math.hypot(ix - g.cx, iy - g.cy);
      if(dist + PHYS.BALL_R <= g.openR){
        s.x = ix; s.y = iy; s.z = PHYS.CUP_HEIGHT;
        s.insideCup = g; s._event = 'enter';
        return;
      } else if(dist <= g.rimR + PHYS.BALL_R){
        var nx = (ix - g.cx) / (dist || 1), ny = (iy - g.cy) / (dist || 1);
        var vn = s.vx * nx + s.vy * ny; // outward radial velocity component
        var centered = clamp((g.rimR - dist) / ((g.rimR - g.openR) || 1), 0, 1);
        var steep = clamp(-prev.vz / (Math.abs(vn) * 40 + 120), 0, 1);
        var lipScore = centered * 0.62 + steep * 0.38;
        s.x = ix; s.y = iy; s.z = PHYS.CUP_HEIGHT;
        if(lipScore >= 0.58 && vn <= 34){
          s.insideCup = g; s._event = 'enter';
        } else if(lipScore >= 0.32 && vn <= 60){
          // LIP ZONE: caught the rim -- geometry + momentum, not chance,
          // decides whether it tips in or spins back out.
          var vzAbs = Math.abs(prev.vz);
          var catches = ((lipScore - 0.32) * 260 + (40 - vn) * 0.9) > vzAbs * 0.12;
          if(catches){
            s.vx *= 0.22; s.vy *= 0.22; s.vz = Math.abs(s.vz) * 0.12;
            s.insideCup = g; s._event = 'lip-in';
          } else {
            var restLip = PHYS.RIM_BOUNCE_E * 0.7;
            s.vx -= (1 + restLip) * vn * nx;
            s.vy -= (1 + restLip) * vn * ny;
            s.vz = Math.abs(s.vz) * 0.4;
            s.spinTop *= 0.5; s.spinSide *= 0.5;
            s._event = 'lip-out';
          }
        } else {
          var rest = PHYS.RIM_BOUNCE_E;
          s.vx -= (1 + rest) * vn * nx;
          s.vy -= (1 + rest) * vn * ny;
          s.vz = Math.abs(s.vz) * 0.55;
          s.spinTop *= 0.6; s.spinSide *= 0.6;
          s._event = 'rim';
        }
        return;
      }
    }
  }

  function handleInsideCup(s){
    var g = s.insideCup;
    var d = Math.hypot(s.x - g.cx, s.y - g.cy);
    var wallR = g.cavityR;
    if(d + PHYS.BALL_R > wallR){
      var nx = (s.x - g.cx) / (d || 1), ny = (s.y - g.cy) / (d || 1);
      var vn = s.vx * nx + s.vy * ny;
      s.vx -= (1 + PHYS.CUP_WALL_E) * vn * nx;
      s.vy -= (1 + PHYS.CUP_WALL_E) * vn * ny;
      var k = (wallR - PHYS.BALL_R) / (d || 1);
      s.x = g.cx + (s.x - g.cx) * k; s.y = g.cy + (s.y - g.cy) * k;
    }
    if(s.z <= 0){
      s.z = 0;
      s.bounces++;
      s.vz = Math.abs(s.vz) * PHYS.CUP_FLOOR_E;
      s.vx *= 0.5; s.vy *= 0.5;
      if(s.vz < 20) s.vz = 0;
    }
  }

  /* Runs the entire deterministic simulation up front (used for both the
     live shot-preview while dragging, and for actually resolving a thrown
     shot) so the preview the player sees is guaranteed to be exactly the
     shot they get. */
  function simulateShot(init, cupsEls, tableRect){
    var cups = cupGeoms(cupsEls);
    var m = state.match;
    var windAccel = { LOW: 0, MED: 36, HIGH: 82 }[m ? m.wind : 'LOW'] || 0;
    var s = {
      x: init.x, y: init.y, z: init.z || 0,
      vx: init.vx, vy: init.vy, vz: init.vz,
      spinTop: init.spinTop || 0, spinSide: init.spinSide || 0,
      bounces: 0, insideCup: null, settled: false, outcome: null, hitCupEl: null
    };
    var samples = [{ x:s.x, y:s.y, z:s.z, event:null }];
    var dt = PHYS.DT;
    var maxSteps = Math.round(PHYS.MAX_SIM_SECONDS / dt);

    for(var i=0;i<maxSteps && !s.settled;i++){
      var prev = { x:s.x, y:s.y, z:s.z, vz:s.vz };
      var speed = Math.hypot(s.vx, s.vy, s.vz) || 0.0001;
      var dragK = Math.exp(-PHYS.AIR_DRAG * dt * (speed/500));
      s.vx *= dragK; s.vy *= dragK; s.vz *= dragK;
      s.vz -= PHYS.GRAVITY * dt;
      if(!s.insideCup){
        s.vx += PHYS.MAGNUS * s.spinSide * speed * dt * 60; // side-spin curve while airborne
        s.vx += windAccel * dt;
        s.spinTop *= (1 - PHYS.SPIN_DECAY*dt);
        s.spinSide *= (1 - PHYS.SPIN_DECAY*dt);
      }
      s.x += s.vx*dt; s.y += s.vy*dt; s.z += s.vz*dt;
      s._event = null;
      if(!s.insideCup) handleCupCollision(s, prev, cups);
      if(s.insideCup) handleInsideCup(s); else handleTableAndWalls(s, prev, tableRect);

      var hs = Math.hypot(s.vx, s.vy);
      if(s.insideCup){
        if(Math.abs(s.vz) < 25 && s.z <= 1){ s.settled = true; s.outcome = 'hit'; s.hitCupEl = s.insideCup.el; }
      } else if(s.z <= 0.5 && hs < PHYS.STOP_SPEED){
        s.settled = true; s.outcome = s.outcome || 'miss';
      }
      samples.push({ x:s.x, y:s.y, z:Math.max(0,s.z), event:s._event });
    }
    if(!s.settled){ s.outcome = s.outcome || 'miss'; }
    return { samples: samples, outcome: s.outcome, hitCupEl: s.hitCupEl, finalX:s.x, finalY:s.y, dt: dt };
  }

  function shotGrazedRim(sim){
    for(var i=0;i<sim.samples.length;i++){
      var ev = sim.samples[i].event;
      if(ev === 'rim' || ev === 'lip-in' || ev === 'lip-out') return true;
    }
    return false;
  }

  /* Projects the simulated 3D (x,y,z) point back onto the existing 2D DOM
     ball element: z becomes a vertical lift (the arc), and a depth scale
     mirrors the original foreshortening (ball shrinks as it travels toward
     the far end of the table). Rendering system / markup is untouched. */
  function projectBallVisual(pt, depthRef){
    var ball = $('ball');
    var scaleDepth = 1;
    if(depthRef){
      var span = Math.max(40, depthRef.startY - depthRef.endY);
      var t = clamp((depthRef.startY - pt.y) / span, 0, 1);
      scaleDepth = 1 - t*0.6;
    }
    var lift = pt.z * 0.85;
    ball.style.left = (pt.x - PHYS.BALL_R) + 'px';
    ball.style.top = (pt.y - PHYS.BALL_R) + 'px';
    ball.style.transform = 'translateY(-' + lift.toFixed(1) + 'px) scale(' + scaleDepth.toFixed(3) + ')';
  }

  /* Plays back a precomputed (already-deterministic) sample set in real
     time via requestAnimationFrame, at a fixed physics sample rate
     independent of render FPS. Long rolling settles are visually capped
     so gameplay never stalls waiting on friction to fully zero out --
     the outcome was already decided the instant the shot was simulated. */
  function playSamples(samples, dt, depthRef){
    return new Promise(function(resolve){
      var startTime = null;
      var totalMs = (samples.length - 1) * dt * 1000;
      var playMs = Math.min(totalMs, 2500);
      function frame(ts){
        if(startTime === null) startTime = ts;
        var elapsed = ts - startTime;
        var simTime = Math.min(elapsed, playMs);
        var idxF = (simTime/1000) / dt;
        var i0 = Math.min(samples.length-1, Math.floor(idxF));
        var i1 = Math.min(samples.length-1, i0+1);
        var frac = idxF - i0;
        var a = samples[i0], b = samples[i1];
        projectBallVisual({ x: a.x+(b.x-a.x)*frac, y: a.y+(b.y-a.y)*frac, z: a.z+(b.z-a.z)*frac }, depthRef);
        if(elapsed < playMs){
          requestAnimationFrame(frame);
        } else {
          var last = samples[samples.length-1];
          projectBallVisual(last, depthRef);
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  /* ================= GAME: THROW LOGIC ================= */
  var DIFF_AI_HIT = { easy:0.30, normal:0.44, hard:0.58 };

  /* ---- AIMING SYSTEM ------------------------------------------------
     Two-stage, skill-based, fully deterministic precision control.

     STAGE 1 — TARGETING: the player drags a crosshair anywhere over the
     table. The crosshair marks the exact (x,y) landing point they intend
     to hit. Releasing locks the target (crosshair turns green).

     STAGE 2 — SLINGSHOT RELEASE: with a target locked, the player pulls
     the ball backward like a slingshot near its resting spot.
       - Pull DISTANCE controls power (how close the throw's real range
         gets to the exact distance needed to reach the locked target —
         under-power falls short, over-power sails long).
       - Pull VERTICAL component controls arc height.
       - Pull HORIZONTAL offset controls side-spin (curves the ball off
         the straight line via the same Magnus term the physics engine
         already integrates).
     Releasing throws. Every value is pure arithmetic on the two drags —
     there is no Math.random() anywhere in this module, so an identical
     crosshair + identical pull always reproduces the exact same shot.
  --------------------------------------------------------------------- */
  var REF_DRAG = 170;   // px pull that represents "perfect, target-exact" power
  var MAX_DRAG = 230;   // px pull cap -- beyond this the overshoot readout clamps
  var MIN_DRAG = 14;    // px pull below which a release is ignored (accidental tap)
  var MIN_TARGET_DRAG = 6; // px crosshair drag below which a tap still sets the target

  var aimLayerEl = $('aim-layer');
  var aimSvgEl = $('aim-svg');
  var aimHintEl = $('aim-hint');
  var crosshairEl = $('aim-crosshair');
  var statsHudEl = $('aim-stats-hud');
  var arcFillEl = $('arc-fill');
  var spinFillEl = $('spin-fill');
  var releaseFillEl = $('release-fill');
  var releaseReadoutEl = $('release-readout');

  /* phase: 'target' (stage 1, placing crosshair) | 'power' (stage 2, pull-back armed) */
  var aimState = {
    phase: 'target',
    active: false,
    pointerId: null,
    ballStart: null,
    current: null,
    target: null      // locked (x,y) landing point, set at end of stage 1
  };

  function sizeAimSvg(){
    aimSvgEl.setAttribute('viewBox', '0 0 ' + window.innerWidth + ' ' + window.innerHeight);
    aimSvgEl.setAttribute('width', window.innerWidth);
    aimSvgEl.setAttribute('height', window.innerHeight);
  }
  window.addEventListener('resize', sizeAimSvg);

  function aimReady(){
    var m = state.match;
    return !!(m && m.active && !m.paused && !m.autoPaused && !m.busy && m.turn === 'player');
  }

  function defaultTarget(){
    var r = $('ai-cups').getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }

  function moveCrosshair(pt, locked){
    crosshairEl.style.left = pt.x + 'px';
    crosshairEl.style.top = pt.y + 'px';
    crosshairEl.classList.add('show');
    crosshairEl.classList.toggle('locked', !!locked);
  }

  /* ---- STAGE 2 velocity solve ---------------------------------------
     Given the locked target and the live pull vector, analytically finds
     the exact velocity that would land the ball precisely on target at
     "perfect" power (pullMag == REF_DRAG), then scales that magnitude by
     the player's actual power so under/over-pulling under/over-shoots —
     exactly like a golf-style precision throw. Vertical pull sets arc
     height; horizontal pull sets side-spin, which the existing Magnus
     term then curves the flight path with during simulation. */
  function buildTargetedVelocity(pull, ballStart, target){
    var pullMag = Math.hypot(pull.x, pull.y);
    var clampedMag = clamp(pullMag, 0, MAX_DRAG);
    var powerFactor = clampedMag / REF_DRAG; // 1.0 == exact reference power (can exceed 1 = overshoot)
    var arcFactor = pullMag > 0 ? clamp(pull.y / pullMag, 0, 1) : 0.6; // straight-down pull = high arc
    var spinFactor = clamp(pull.x / MAX_DRAG, -1, 1); // sideways offset = side-spin

    var dx = target.x - ballStart.x, dy = target.y - ballStart.y;
    var D = Math.max(20, Math.hypot(dx, dy));
    var apexHeight = 55 + 220 * clamp(powerFactor, 0, 1) * (0.35 + 0.65*arcFactor);
    var vz0 = Math.sqrt(2 * PHYS.GRAVITY * apexHeight);
    var T = Math.max(0.18, 2 * vz0 / PHYS.GRAVITY);
    var refHorizSpeed = D / T;                 // speed needed to travel exactly D in time T
    var actualHorizSpeed = refHorizSpeed * powerFactor;
    var ux = dx / D, uy = dy / D;
    var m = state.match;
    var spinSide = (m && m.spin) ? spinFactor : spinFactor * 0.4; // spin toggle affects curve strength, not availability
    return {
      vx: ux * actualHorizSpeed, vy: uy * actualHorizSpeed, vz: vz0,
      spinTop: arcFactor, spinSide: spinSide,
      power: clamp(powerFactor, 0, 1.3), arcFactor: arcFactor, spinFactor: spinFactor
    };
  }

  /* Pure function: given the locked target + a pull vector, deterministically
     simulates the entire shot with the real physics engine. Calling this
     twice with the same target + pull always yields the exact same path
     and outcome, so the preview the player sees IS the shot they'll get. */
  function computeAimSolution(pull, target){
    var ballRect = $('ball').getBoundingClientRect();
    var ballStart = { x: ballRect.left + ballRect.width/2, y: ballRect.top + ballRect.height/2, z:6 };
    var aiCupsRect = $('ai-cups').getBoundingClientRect();
    var tableRect = $('table-surface').getBoundingClientRect();
    var aiCenterY = aiCupsRect.top + aiCupsRect.height/2;
    var init = buildTargetedVelocity(pull, ballStart, target);
    var cupsEls = qsa('#ai-cups .cup:not(.hit)');
    var sim = simulateShot({
      x: ballStart.x, y: ballStart.y, z: ballStart.z,
      vx: init.vx, vy: init.vy, vz: init.vz,
      spinTop: init.spinTop, spinSide: init.spinSide
    }, cupsEls, tableRect);
    var last = sim.samples[sim.samples.length - 1];
    var landErr = Math.hypot(last.x - target.x, last.y - target.y);
    var releaseQuality = clamp(1 - landErr / 130, 0, 1);
    return {
      ballStart: ballStart, target: target, power: init.power, arcFactor: init.arcFactor, spinFactor: init.spinFactor,
      samples: sim.samples, outcome: sim.outcome, hitCupEl: sim.hitCupEl,
      finalTarget: { x: sim.finalX, y: sim.finalY }, releaseQuality: releaseQuality,
      depthRef: { startY: ballStart.y, endY: aiCenterY }
    };
  }

  function firstRimSample(sol){
    for(var i=0;i<sol.samples.length;i++){
      var ev = sol.samples[i].event;
      if(ev === 'rim' || ev === 'lip-in' || ev === 'lip-out') return sol.samples[i];
    }
    return null;
  }

  function renderAimSVG(sol, valid){
    if(!valid || !sol){ aimSvgEl.innerHTML = ''; return; }
    var bs = sol.ballStart;
    var grazed = shotGrazedRim(sol);
    var color = sol.outcome === 'hit' ? '#39ff8c' : (grazed ? '#ffd23f' : '#00f3ff');
    var pts = [];
    var step = Math.max(1, Math.floor(sol.samples.length / 70));
    var markers = '';
    for(var i=0;i<sol.samples.length;i+=step){
      var p = sol.samples[i];
      pts.push(p.x.toFixed(1) + ',' + (p.y - p.z*0.85).toFixed(1));
    }
    sol.samples.forEach(function(p){
      if(p.event === 'bounce'){
        markers += '<circle cx="'+p.x.toFixed(1)+'" cy="'+(p.y - p.z*0.85).toFixed(1)+'" r="3" fill="#00f3ff" opacity="0.8"/>';
      }
    });
    // Distinct, larger rim-impact prediction marker (first rim contact only).
    var rimSample = firstRimSample(sol);
    var rimMarker = '';
    if(rimSample){
      var rx = rimSample.x.toFixed(1), ry = (rimSample.y - rimSample.z*0.85).toFixed(1);
      rimMarker = '<circle cx="'+rx+'" cy="'+ry+'" r="10" fill="none" stroke="#ffd23f" stroke-width="2" stroke-dasharray="3 4" opacity="0.9"/>' +
                  '<circle cx="'+rx+'" cy="'+ry+'" r="2.5" fill="#ffd23f"/>';
    }
    var last = sol.samples[sol.samples.length - 1];
    var lx = last.x.toFixed(1), ly = (last.y - last.z*0.85).toFixed(1);
    // Target crosshair reference line + locked target ring.
    var tgtLine = '<line x1="'+sol.target.x+'" y1="'+sol.target.y+'" x2="'+lx+'" y2="'+ly+'" stroke="#ff2ec4" stroke-width="1" stroke-dasharray="2 5" opacity="0.4"/>';
    var pullLine = aimState.current ? ('<line x1="'+bs.x+'" y1="'+bs.y+'" x2="'+aimState.current.x+'" y2="'+aimState.current.y+'" stroke="#ff2ec4" stroke-width="3" stroke-dasharray="6 7" stroke-linecap="round" opacity="0.85"/>') : '';
    aimSvgEl.innerHTML =
      tgtLine + pullLine +
      '<polyline points="'+pts.join(' ')+'" fill="none" stroke="'+color+'" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round" opacity="0.95"/>' +
      markers + rimMarker +
      '<circle cx="'+lx+'" cy="'+ly+'" r="15" fill="none" stroke="'+color+'" stroke-width="2.5" opacity="0.95"/>' +
      '<circle cx="'+lx+'" cy="'+ly+'" r="3.5" fill="'+color+'"/>';
  }

  function highlightTargetCup(sol){
    qsa('#ai-cups .cup').forEach(function(c){ c.classList.remove('cup-target'); });
    var diff = state.settings.difficulty || 'normal';
    if(diff === 'hard' || !sol) return; // Hard mode: exact collision physics, no aim assist highlight
    var highlightCup = sol.hitCupEl;
    if(!highlightCup){
      var cupsEls = qsa('#ai-cups .cup:not(.hit)');
      var last = sol.samples[sol.samples.length - 1];
      var nd = Infinity, nc = null;
      cupsEls.forEach(function(c){
        var r = c.getBoundingClientRect(); var cx = r.left+r.width/2, cy = r.top+r.height/2;
        var d = Math.hypot(cx-last.x, cy-last.y);
        if(d < nd){ nd = d; nc = c; }
      });
      if(nc && nd < 60) highlightCup = nc;
    }
    if(highlightCup) highlightCup.classList.add('cup-target');
  }

  function updateStatsHud(sol){
    if(!sol){ statsHudEl.classList.remove('show'); return; }
    statsHudEl.classList.add('show');
    arcFillEl.style.width = Math.round(sol.arcFactor * 100) + '%';
    var spinPct = sol.spinFactor * 50; // -50..50 around center
    spinFillEl.style.width = Math.abs(spinPct) + '%';
    spinFillEl.style.left = spinPct >= 0 ? '50%' : (50+spinPct) + '%';
    var relPct = Math.round(sol.releaseQuality * 100);
    releaseFillEl.style.width = relPct + '%';
    releaseReadoutEl.textContent = relPct + '% ' + (sol.outcome === 'hit' ? 'ON TARGET' : (relPct > 70 ? 'CLOSE' : 'OFF LINE'));
    releaseReadoutEl.style.color = sol.outcome === 'hit' ? '#39ff8c' : (relPct > 70 ? '#ffd23f' : '#ff5566');
  }

  function updateAimVisuals(){
    if(aimState.phase === 'target'){
      moveCrosshair(aimState.current, false);
      aimSvgEl.innerHTML = '';
      statsHudEl.classList.remove('show');
      highlightTargetCup(null);
      $('power-fill').style.height = '0%';
      $('power-readout').textContent = '0%';
      aimHintEl.style.opacity = '1';
      return;
    }
    // phase === 'power'
    var pull = { x: aimState.current.x - aimState.ballStart.x, y: aimState.current.y - aimState.ballStart.y };
    var mag = Math.hypot(pull.x, pull.y);
    var valid = pull.y > 6 && mag > MIN_DRAG; // must pull backward (down/away), like a slingshot
    var sol = valid ? computeAimSolution(pull, aimState.target) : null;
    renderAimSVG(sol, valid);
    updateStatsHud(sol);
    if(sol){
      var pwrPct = Math.round(clamp(sol.power, 0, 1) * 100);
      $('power-fill').style.height = pwrPct + '%';
      $('power-readout').textContent = pwrPct + '%';
      highlightTargetCup(sol);
      aimHintEl.style.opacity = '0';
    } else {
      $('power-fill').style.height = '0%';
      $('power-readout').textContent = '0%';
      highlightTargetCup(null);
      aimHintEl.style.opacity = mag > 0 ? '1' : '0';
    }
  }

  function setAimHint(){
    aimHintEl.textContent = aimState.phase === 'target'
      ? 'Drag to place crosshair over target'
      : 'Pull the ball back & release to throw';
  }

  function resetAimHud(){
    aimSvgEl.innerHTML = '';
    $('power-fill').style.height = '0%';
    $('power-readout').textContent = '0%';
    qsa('#ai-cups .cup').forEach(function(c){ c.classList.remove('cup-target'); });
    statsHudEl.classList.remove('show');
    crosshairEl.classList.remove('show', 'locked');
    aimState.phase = 'target';
    aimState.target = null;
    setAimHint();
    aimHintEl.style.opacity = '1';
  }

  function tableClampedPoint(pt){
    var r = $('table-surface').getBoundingClientRect();
    return { x: clamp(pt.x, r.left+16, r.right-16), y: clamp(pt.y, r.top+16, r.bottom-16) };
  }

  aimLayerEl.addEventListener('pointerdown', function(e){
    if(!aimReady()) return;
    var pt = { x: e.clientX, y: e.clientY };

    if(aimState.phase === 'power'){
      // In stage 2: a pointerdown far from the ball re-opens targeting
      // instead of arming a pull, so the player can always re-aim.
      var ballRect = $('ball').getBoundingClientRect();
      var bx = ballRect.left + ballRect.width/2, by = ballRect.top + ballRect.height/2;
      var distFromBall = Math.hypot(pt.x - bx, pt.y - by);
      if(distFromBall > 140){
        aimState.phase = 'target';
        aimState.target = null;
        setAimHint();
      }
    }

    aimState.active = true;
    aimState.pointerId = e.pointerId;
    try{ aimLayerEl.setPointerCapture(e.pointerId); }catch(err){}

    if(aimState.phase === 'target'){
      aimState.current = tableClampedPoint(pt);
    } else {
      var ballRect2 = $('ball').getBoundingClientRect();
      aimState.ballStart = { x: ballRect2.left + ballRect2.width/2, y: ballRect2.top + ballRect2.height/2 };
      aimState.current = pt;
    }
    updateAimVisuals();
    e.preventDefault();
  });
  aimLayerEl.addEventListener('pointermove', function(e){
    if(!aimState.active || e.pointerId !== aimState.pointerId) return;
    aimState.current = aimState.phase === 'target' ? tableClampedPoint({ x: e.clientX, y: e.clientY }) : { x: e.clientX, y: e.clientY };
    updateAimVisuals();
    e.preventDefault();
  });
  function releaseAim(e){
    if(!aimState.active || e.pointerId !== aimState.pointerId) return;
    aimState.active = false;
    try{ aimLayerEl.releasePointerCapture(e.pointerId); }catch(err){}
    if(!aimReady()){ resetAimHud(); return; }

    if(aimState.phase === 'target'){
      // Lock stage 1: crosshair becomes the fixed landing target, advance to stage 2.
      aimState.target = aimState.current || defaultTarget();
      aimState.phase = 'power';
      moveCrosshair(aimState.target, true);
      setAimHint();
      aimHintEl.style.opacity = '1';
      aimSvgEl.innerHTML = '';
      SFX.click();
      return;
    }

    // phase === 'power' -> attempt to throw
    var pull = { x: aimState.current.x - aimState.ballStart.x, y: aimState.current.y - aimState.ballStart.y };
    var mag = Math.hypot(pull.x, pull.y);
    var target = aimState.target;
    if(pull.y <= 6 || mag < MIN_DRAG){
      // too small / wrong direction — cancel this pull, stay armed on the same locked target
      aimSvgEl.innerHTML = '';
      statsHudEl.classList.remove('show');
      $('power-fill').style.height = '0%';
      $('power-readout').textContent = '0%';
      return;
    }
    var sol = computeAimSolution(pull, target);
    resetAimHud();
    var m = state.match;
    var wasTrick = !!m.trickArmed;
    m.trickArmed = false;
    updateTrickButtonArmedUI(false);
    performPlayerThrow(sol, wasTrick);
  }
  aimLayerEl.addEventListener('pointerup', releaseAim);
  aimLayerEl.addEventListener('pointercancel', function(e){
    aimState.active = false;
    if(aimState.phase === 'power' && aimState.target){
      // keep the locked target armed, just drop the in-progress pull
      aimSvgEl.innerHTML = '';
      statsHudEl.classList.remove('show');
    } else {
      resetAimHud();
    }
  });

  $('btn-throw').addEventListener('click', function(){
    var m = state.match;
    if(!m || !m.active) return;
    toast(aimState.phase === 'target' ? 'DRAG TO PLACE YOUR CROSSHAIR TARGET' : 'PULL BACK & RELEASE TO THROW');
    SFX.click();
  });


  function updateTrickButtonArmedUI(on){
    $('btn-trick-shot').classList.toggle('trick-armed', !!on);
  }

  $('btn-trick-shot').addEventListener('click', function(){
    var m = state.match;
    if(!m || !m.active || m.paused || m.autoPaused || m.busy || m.turn !== 'player') return;
    if(m.trickMeter < 100){ toast('TRICK METER CHARGING'); SFX.miss(); return; }
    m.trickArmed = !m.trickArmed;
    updateTrickButtonArmedUI(m.trickArmed);
    toast(m.trickArmed ? 'TRICK SHOT ARMED — PULL BACK & RELEASE' : 'TRICK SHOT DISARMED');
    SFX.click();
  });

  /* ---- THROW EXECUTION ----------------------------------------------
     sol is the deterministic solution produced by computeAimSolution().
     isTrick guarantees the shot lands (on the cup the player was already
     aiming at) and detonates a bonus cup, exactly as the original trick
     mechanic did — the guarantee is the trick's *reward*, not a random
     dice roll on top of the throw itself.
  --------------------------------------------------------------------- */
  /* Trick shot: rather than overriding the outcome by fiat, this computes
     the analytically "perfect" aimed velocity at the intended cup and runs
     it through the SAME deterministic physics as any other shot. The
     reward is precise aim, not hidden randomness. */
  function computeTrickSolution(sol){
    var cupsEls = qsa('#ai-cups .cup:not(.hit)');
    if(!cupsEls.length) return sol;
    var target = sol.hitCupEl;
    if(!target){
      var last = sol.samples[sol.samples.length - 1];
      var nd = Infinity;
      cupsEls.forEach(function(c){
        var r = c.getBoundingClientRect(); var cx = r.left+r.width/2, cy = r.top+r.height/2;
        var d = Math.hypot(cx-last.x, cy-last.y);
        if(d < nd){ nd = d; target = c; }
      });
    }
    var r = target.getBoundingClientRect();
    var tx = r.left + r.width/2, ty = r.top + r.height/2;
    var ballStart = sol.ballStart;
    var tableRect = $('table-surface').getBoundingClientRect();
    var apexHeight = 150;
    var vz0 = Math.sqrt(2 * PHYS.GRAVITY * apexHeight);
    var T = 2 * vz0 / PHYS.GRAVITY;
    var sim = simulateShot({
      x: ballStart.x, y: ballStart.y, z: ballStart.z,
      vx: (tx-ballStart.x)/T, vy: (ty-ballStart.y)/T, vz: vz0,
      spinTop: 0.8, spinSide: 0
    }, cupsEls, tableRect);
    return {
      ballStart: ballStart, samples: sim.samples, outcome: sim.outcome,
      hitCupEl: sim.hitCupEl || target, depthRef: sol.depthRef
    };
  }

  function performPlayerThrow(sol, isTrick){
    var m = state.match;
    m.busy = true;
    m.attempts++;

    var remainingCups = qsa('#ai-cups .cup:not(.hit)');
    if(!remainingCups.length){ finishMatch('win'); m.busy = false; return; }

    var finalSol = isTrick ? computeTrickSolution(sol) : sol;
    var willHit = finalSol.outcome === 'hit' && !!finalSol.hitCupEl;

    playSamples(finalSol.samples, PHYS.DT, finalSol.depthRef).then(function(){
      if(willHit){
        m.hits++;
        finalSol.hitCupEl.classList.add('hit');
        m.aiRemaining--;
        m.trickMeter = clamp(m.trickMeter + (isTrick ? 0 : 16), 0, 100);
        if(isTrick){
          m.trickMeter = 0;
          var bonusRemaining = qsa('#ai-cups .cup:not(.hit)');
          if(bonusRemaining.length){
            var bonus = bonusRemaining[0];
            bonus.classList.add('hit');
            m.aiRemaining--;
          }
          SFX.trick();
          toast('TRICK SHOT! DOUBLE HIT');
          haptic(40);
        } else {
          SFX.hit();
          toast('CUP DESTROYED');
          haptic(20);
        }
      } else {
        SFX.miss();
        toast(shotGrazedRim(finalSol) ? 'RIM OUT — SO CLOSE' : 'SHOT MISSED');
      }
      resetBallPosition('player');
      updateGameHUD();

      if(m.aiRemaining <= 0){ finishMatch('win'); m.busy=false; return; }

      m.turn = 'ai';
      m.busy = false;
      setTimeout(function(){ performAiThrow(); }, 900);
    });
  }

  /* AI opponent: the RNG here decides the AI's aim quality (its in-game
     "skill" per difficulty) -- that's opponent behavior, not the physics.
     Whatever aim point the AI ends up choosing is then resolved by the
     exact same deterministic physics engine used for the player. */
  function performAiThrow(){
    var m = state.match;
    if(!m || !m.active || m.paused || m.autoPaused) return;
    m.busy = true;
    resetBallPosition('ai');
    var diffChance = DIFF_AI_HIT[state.settings.difficulty] || 0.44;
    var aimsWell = Math.random() < diffChance;
    var remainingCups = qsa('#player-cups .cup:not(.hit)');
    var target = remainingCups.length ? pick(remainingCups) : null;
    if(!target){ finishMatch('lose'); m.busy=false; return; }

    var ballRect = $('ball').getBoundingClientRect();
    var ballStart = { x: ballRect.left + ballRect.width/2, y: ballRect.top + ballRect.height/2, z:6 };
    var tr = target.getBoundingClientRect();
    var tx = tr.left + tr.width/2, ty = tr.top + tr.height/2;
    if(!aimsWell){
      // A deterministic-per-cup miss offset (not per-throw random) --
      // the imperfection is the AI's aim, not the physics resolving it.
      var offAngle = ((Number(target.dataset.idx) * 47) % 360) * Math.PI/180;
      tx += Math.cos(offAngle) * 46;
      ty += Math.sin(offAngle) * 20;
    }
    var apexHeight = 140;
    var vz0 = Math.sqrt(2 * PHYS.GRAVITY * apexHeight);
    var T = 2 * vz0 / PHYS.GRAVITY;
    var cupsEls = qsa('#player-cups .cup:not(.hit)');
    var tableRect = $('table-surface').getBoundingClientRect();
    var sim = simulateShot({
      x: ballStart.x, y: ballStart.y, z: ballStart.z,
      vx: (tx-ballStart.x)/T, vy: (ty-ballStart.y)/T, vz: vz0,
      spinTop: 0.5, spinSide: 0
    }, cupsEls, tableRect);
    var playerCupsRect = $('player-cups').getBoundingClientRect();
    var depthRef = { startY: ballStart.y, endY: playerCupsRect.top + playerCupsRect.height/2 };

    playSamples(sim.samples, PHYS.DT, depthRef).then(function(){
      if(sim.outcome === 'hit' && sim.hitCupEl){
        sim.hitCupEl.classList.add('hit');
        m.playerRemaining--;
        SFX.hit();
        toast('AI SCORES');
        haptic(20);
      } else {
        SFX.miss();
        toast('AI MISSED');
      }
      resetBallPosition('player');
      updateGameHUD();

      if(m.playerRemaining <= 0){ finishMatch('lose'); m.busy=false; return; }

      m.turn = 'player';
      m.busy = false;
    });
  }
