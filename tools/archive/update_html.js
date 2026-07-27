const fs = require('fs');

let html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');

const newScripts = `
<script src="js/modules/GameState.js"></script>
<script src="js/modules/Util.js"></script>
<script src="js/modules/AudioController.js"></script>
<script src="js/modules/Effects.js"></script>
<script src="js/modules/CupManager.js"></script>
<script src="js/modules/BallController.js"></script>
<script src="js/modules/UIController.js"></script>
<script src="js/modules/Renderer.js"></script>
<script src="js/modules/CameraController.js"></script>
<script src="js/modules/BeerPongPhysicsEngine.js"></script>
<script src="js/modules/ModularCollisionEngine.js"></script>
<script src="js/modules/TrajectoryPredictor.js"></script>
<script src="js/modules/InputManager.js"></script>
<script src="js/modules/ThrowController.js"></script>
<script src="js/modules/AIController.js"></script>
<script src="js/modules/Main.js"></script>
`;

html = html.replace(/<script src="js\/modules\/BeerPongPhysicsEngine\.js">[\s\S]*?<script src="js\/modules\/Main\.js"><\/script>/, newScripts.trim());

fs.writeFileSync('app/src/main/assets/index.html', html);
console.log("HTML updated");
