const fs = require('fs');
let js = fs.readFileSync('app/src/main/assets/js/modules/TrajectoryPredictor.js', 'utf8');

js = js.replace(/pN\.x = s\.x; pN\.y = s\.y; pN\.z = Math\.max\(0, s\.z\); pN\.event = s\.event;/, 
`pN.x = s.x; pN.y = s.y; pN.z = Math.max(0, s.z); pN.event = s.event; pN.v = Math.sqrt(s.vx*s.vx + s.vy*s.vy + s.vz*s.vz);`);

js = js.replace(/samples\.push\(\{ x:s\.x, y:s\.y, z:Math\.max\(0,s\.z\), event:s\.event \}\);/,
`samples.push({ x:s.x, y:s.y, z:Math.max(0,s.z), event:s.event, v:Math.sqrt(s.vx*s.vx + s.vy*s.vy + s.vz*s.vz) });`);

js = js.replace(/p0\.x = s\.x; p0\.y = s\.y; p0\.z = s\.z; p0\.event = null;/,
`p0.x = s.x; p0.y = s.y; p0.z = s.z; p0.event = null; p0.v = Math.sqrt(s.vx*s.vx + s.vy*s.vy + s.vz*s.vz);`);

// And fix the maxImpact calculation
let impactCode = `      let maxImpactV = 0;
      for (let j = 0; j < samples.length; j++) {
          if (samples[j].event) {
              // rough estimate of speed at impact
              maxImpactV = Math.max(maxImpactV, Math.sqrt(init.vx*init.vx + init.vy*init.vy + init.vz*init.vz));
          }
      }`;
      
let newImpactCode = `      let maxImpactV = 0;
      for (let j = 0; j < samples.length; j++) {
          if (samples[j].event) {
              maxImpactV = Math.max(maxImpactV, samples[j].v || 0);
          }
      }`;

js = js.replace(impactCode, newImpactCode);

fs.writeFileSync('app/src/main/assets/js/modules/TrajectoryPredictor.js', js);
console.log("Patched TrajectoryPredictor.js with speed");
