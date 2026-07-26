const fs = require('fs');
let file = fs.readFileSync('app/src/main/assets/index.html', 'utf8');

// Replace spinTop/spinSide with explicit angular velocity terms to perfectly match the prompt's requirements
file = file.replace(/spinTop: /g, 'angularVelocityX: ');
file = file.replace(/spinSide: /g, 'angularVelocityZ: ');
file = file.replace(/s\.spinTop/g, 's.angularVelocityX');
file = file.replace(/s\.spinSide/g, 's.angularVelocityZ');
file = file.replace(/init\.spinTop/g, 'init.angularVelocityX');
file = file.replace(/init\.spinSide/g, 'init.angularVelocityZ');
file = file.replace(/params\.spinTop/g, 'params.angularVelocityX');
file = file.replace(/params\.spinSide/g, 'params.angularVelocityZ');

fs.writeFileSync('app/src/main/assets/index.html', file);
