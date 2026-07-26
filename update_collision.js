const fs = require('fs');

let file = fs.readFileSync('app/src/main/assets/index.html', 'utf8');

const newCollisionSystem = `
  class ModularCollisionEngine {
    constructor(engine, cupEls, difficulty){
      this.engine = engine;
      this.difficulty = difficulty || 'normal';
      this.cups = this._buildGeometry(cupEls);
    }

    _buildGeometry(cupEls){
      var openMul = this.difficulty === 'easy' ? 0.90 : (this.difficulty === 'hard' ? 0.60 : 0.76);
      var rimMul  = this.difficulty === 'easy' ? 1.30 : (this.difficulty === 'hard' ? 0.92 : 1.05);
      return cupEls.map(function(el){
        var r = el.getBoundingClientRect();
        var baseR = r.width / 2;
        return {
          el: el, cx: r.left + r.width/2, cy: r.top + r.height/2,
          colliders: {
            exteriorWall: baseR * rimMul,
            rim: baseR * rimMul * 0.94,
            opening: baseR * openMul,
            interiorWall: baseR * openMul + 1,
            bottom: 0
          }
        };
      });
    }

    resolveAll(s, prev, tableRect) {
      if (!s.insideCup) {
        this.checkBallVsCups(s, prev);
      }
      
      if (s.insideCup) {
        this.checkBallVsCupInterior(s);
      } else {
        this.checkBallVsTable(s, prev, tableRect);
      }
    }

    checkBallVsCups(s, prev) {
      for(var i=0;i<this.cups.length;i++){
        var g = this.cups[i];
        var dCur = Math.hypot(s.x - g.cx, s.y - g.cy);
        if(dCur > g.colliders.exteriorWall + this.engine.BALL_R + 30) continue;
        
        var crossedDown = prev.z > this.engine.CUP_HEIGHT && s.z <= this.engine.CUP_HEIGHT;
        if(!crossedDown) {
            if (s.z < this.engine.CUP_HEIGHT && dCur < g.colliders.exteriorWall + this.engine.BALL_R) {
               var nx = (s.x - g.cx) / (dCur || 1), ny = (s.y - g.cy) / (dCur || 1);
               var vn = s.vx * nx + s.vy * ny;
               if (vn < 0) {
                   s.vx -= (1 + this.engine.CUP_WALL_E) * vn * nx;
                   s.vy -= (1 + this.engine.CUP_WALL_E) * vn * ny;
                   s.x = g.cx + nx * (g.colliders.exteriorWall + this.engine.BALL_R);
                   s.y = g.cy + ny * (g.colliders.exteriorWall + this.engine.BALL_R);
                   s.event = 'wall-bounce';
               }
            }
            continue;
        }
        
        var t = (prev.z - this.engine.CUP_HEIGHT) / ((prev.z - s.z) || 1e-6);
        var ix = prev.x + (s.x - prev.x) * t, iy = prev.y + (s.y - prev.y) * t;
        var dist = Math.hypot(ix - g.cx, iy - g.cy);
        
        if(dist + this.engine.BALL_R <= g.colliders.opening){
          s.x = ix; s.y = iy; s.z = this.engine.CUP_HEIGHT;
          s.insideCup = g; s.event = 'enter';
          return g;
        }
        if(dist <= g.colliders.rim + this.engine.BALL_R){
          s.x = ix; s.y = iy; s.z = this.engine.CUP_HEIGHT;
          this._resolveRimContact(s, prev, g, ix, iy, dist);
          return g;
        }
      }
      return null;
    }

    _resolveRimContact(s, prev, g, ix, iy, dist){
      var nx = (ix - g.cx) / (dist || 1), ny = (iy - g.cy) / (dist || 1);
      var vn = s.vx * nx + s.vy * ny;
      var centered = clamp((g.colliders.rim - dist) / ((g.colliders.rim - g.colliders.opening) || 1), 0, 1);
      var steep = clamp(-prev.vz / (Math.abs(vn) * 40 + 120), 0, 1);
      var lipScore = centered * 0.62 + steep * 0.38;
      
      if(lipScore >= 0.58 && vn <= 34){
        s.insideCup = g; s.event = 'enter'; 
      } else if(lipScore >= 0.32 && vn <= 60){
        var vzAbs = Math.abs(prev.vz);
        var catches = ((lipScore - 0.32) * 260 + (40 - vn) * 0.9) > vzAbs * 0.12;
        if(catches){
          s.vx *= 0.22; s.vy *= 0.22; s.vz = Math.abs(s.vz) * 0.12;
          s.insideCup = g; s.event = 'lip-in';
        } else {
          var restLip = this.engine.RIM_BOUNCE_E * 0.7;
          s.vx -= (1 + restLip) * vn * nx;
          s.vy -= (1 + restLip) * vn * ny;
          s.vz = Math.abs(s.vz) * 0.4;
          s.angularVelocityX *= 0.5; s.angularVelocityZ *= 0.5;
          s.event = 'lip-out';
        }
      } else { 
        var rest = this.engine.RIM_BOUNCE_E;
        s.vx -= (1 + rest) * vn * nx;
        s.vy -= (1 + rest) * vn * ny;
        s.vz = Math.abs(s.vz) * 0.55;
        s.angularVelocityX *= 0.6; s.angularVelocityZ *= 0.6;
        s.event = 'rim';
      }
    }

    checkBallVsCupInterior(s){
      var g = s.insideCup;
      var d = Math.hypot(s.x - g.cx, s.y - g.cy);
      var wallR = g.colliders.interiorWall;
      if(d + this.engine.BALL_R > wallR){
        var nx = (s.x - g.cx) / (d || 1), ny = (s.y - g.cy) / (d || 1);
        var vn = s.vx * nx + s.vy * ny;
        s.vx -= (1 + this.engine.CUP_WALL_E) * vn * nx;
        s.vy -= (1 + this.engine.CUP_WALL_E) * vn * ny;
        var k = (wallR - this.engine.BALL_R) / (d || 1);
        s.x = g.cx + (s.x - g.cx) * k; s.y = g.cy + (s.y - g.cy) * k;
      }
      if(s.z <= g.colliders.bottom){
        s.z = g.colliders.bottom;
        s.bounces++;
        s.vz = Math.abs(s.vz) * this.engine.CUP_FLOOR_E;
        s.vx *= 0.5; s.vy *= 0.5;
        if(s.vz < 20) s.vz = 0;
      }
    }

    checkBallVsTable(s, prev, tableRect){
      var tableHeight = 0;
      var GROUND_Z = -500;
      if (s.z <= GROUND_Z) {
          s.z = GROUND_Z;
          s.vx = 0; s.vy = 0; s.vz = 0;
          s.settled = true;
          return;
      }

      if(s.z <= tableHeight && prev.z > tableHeight){
        if (tableRect && s.x >= tableRect.left && s.x <= tableRect.right && s.y >= tableRect.top && s.y <= tableRect.bottom) {
            var t = (prev.z - tableHeight) / ((prev.z - s.z) || 1e-6);
            s.x = prev.x + (s.x - prev.x) * t;
            s.y = prev.y + (s.y - prev.y) * t;
            s.z = tableHeight;
            s.bounces++;
            var e = this.engine.TABLE_BOUNCE_E * Math.pow(this.engine.TABLE_BOUNCE_DECAY, s.bounces - 1);
            s.vz = Math.abs(s.vz) * e;
            var grip = 1 + clamp(s.angularVelocityX, -1, 1) * 0.18;
            var wasHard = Math.abs(s.vz) > 260;
            s.vx *= (wasHard ? 0.66 : 0.72) * grip;
            s.vy *= (wasHard ? 0.66 : 0.72) * grip;
            s.angularVelocityX *= 0.7; s.angularVelocityZ *= 0.7;
            s.event = 'bounce';
            if(s.vz < 22){ s.z = tableHeight; s.vz = 0; }
        }
      }
      
      if(s.z <= tableHeight + 0.5 && tableRect && s.x >= tableRect.left && s.x <= tableRect.right && s.y >= tableRect.top && s.y <= tableRect.bottom){
        var speed = Math.hypot(s.vx, s.vy);
        if(speed > 0){
          var decel = (speed > 260 ? this.engine.SLIDE_FRICTION : this.engine.ROLL_FRICTION) * this.engine.DT;
          var ns = Math.max(0, speed - decel);
          var k = ns / speed;
          s.vx *= k; s.vy *= k;
        }
      }
      
      if(tableRect && s.z >= tableHeight - 20 && s.z <= tableHeight + 20){
        if(s.x < tableRect.left + this.engine.BALL_R){ s.x = tableRect.left + this.engine.BALL_R; s.vx = Math.abs(s.vx) * 0.5; }
        if(s.x > tableRect.right - this.engine.BALL_R){ s.x = tableRect.right - this.engine.BALL_R; s.vx = -Math.abs(s.vx) * 0.5; }
        if(s.y < tableRect.top + this.engine.BALL_R){ s.y = tableRect.top + this.engine.BALL_R; s.vy = Math.abs(s.vy) * 0.5; }
        if(s.y > tableRect.bottom - this.engine.BALL_R){ s.y = tableRect.bottom - this.engine.BALL_R; s.vy = -Math.abs(s.vy) * 0.5; }
      }
    }
  }
`;

file = file.replace(/class CupCollisionSystem \{[\s\S]*?\n  \}\n\n  class TrajectoryPredictor \{/g, newCollisionSystem + '\n\n  class TrajectoryPredictor {');
file = file.replace(/var cupSystem = new CupCollisionSystem\(this\.engine, cupEls, difficulty\);/g, 'var collisionEngine = new ModularCollisionEngine(this.engine, cupEls, difficulty);');
file = file.replace(/if\(!s\.insideCup\) cupSystem\.checkApproach\(s, prev\);\n\s*if\(s\.insideCup\) cupSystem\.resolveInterior\(s\); else eng\.resolveTable\(s, prev, tableRect\);/g, 'collisionEngine.resolveAll(s, prev, tableRect);');
file = file.replace(/\/\* Table surface \+ rail collision[\s\S]*?\}\n  \}\n\n  class ModularCollisionEngine \{/g, '}\n\n  class ModularCollisionEngine {');

fs.writeFileSync('app/src/main/assets/index.html', file);
