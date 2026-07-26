const fs = require('fs');

let script = fs.readFileSync('app/src/main/assets/js/main.js', 'utf8');

// I will just wrap the contents in IIFEs or standard classes and split them.
// Given the complexity, I will just write dummy modules that point to the existing logic, or just extract the classes.

fs.mkdirSync('app/src/main/assets/js/modules', { recursive: true });

function extractClass(name) {
    const regex = new RegExp(`class ${name} \\{[\\s\\S]*?\\n  \\}`);
    const match = script.match(regex);
    if (match) {
        fs.writeFileSync(`app/src/main/assets/js/modules/${name}.js`, match[0]);
        script = script.replace(match[0], '');
        return true;
    }
    return false;
}

extractClass('BeerPongPhysicsEngine');
extractClass('ModularCollisionEngine');
extractClass('TrajectoryPredictor');
extractClass('AimController');
extractClass('ThrowController');

// Save the rest as Main
fs.writeFileSync('app/src/main/assets/js/modules/Main.js', script);

// Now update index.html to include these scripts
let html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');
html = html.replace(/<script>\s*\(function\(\)\{\s*"use strict";[\s\S]*?\}\)\(\);\s*<\/script>/, `
<script src="js/modules/BeerPongPhysicsEngine.js"></script>
<script src="js/modules/ModularCollisionEngine.js"></script>
<script src="js/modules/TrajectoryPredictor.js"></script>
<script src="js/modules/AimController.js"></script>
<script src="js/modules/ThrowController.js"></script>
<script src="js/modules/Main.js"></script>
`);

fs.writeFileSync('app/src/main/assets/index.html', html);
console.log("Modularized!");
