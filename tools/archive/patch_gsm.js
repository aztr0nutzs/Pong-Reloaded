const fs = require('fs');
let js = fs.readFileSync('app/src/main/assets/js/modules/GameStateManager.js', 'utf8');

js = js.replace(/static update\(dt\) \{[\s\S]*?\}\n    \}/, 
`static update(dt) {
        // Live physics runs on its own interval in PhysicsEngine.js
        // Ball position is updated via the onUpdate callback in ThrowController.js
    }`);

fs.writeFileSync('app/src/main/assets/js/modules/GameStateManager.js', js);
console.log("Patched GameStateManager.js");
