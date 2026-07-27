const fs = require('fs');

let file = fs.readFileSync('app/src/main/assets/index.html', 'utf8');

// Retune physics for realistic ping pong ball
file = file.replace(/GRAVITY: 2500|this\.GRAVITY = 2500/, 'this.GRAVITY = 3500');
file = file.replace(/AIR_DRAG: 0\.045|this\.AIR_DRAG = 0\.045/, 'this.AIR_DRAG = 0.055');
file = file.replace(/MAGNUS: 0\.00022|this\.MAGNUS = 0\.00022/, 'this.MAGNUS = 0.00035');
file = file.replace(/SPIN_DECAY: 0\.55|this\.SPIN_DECAY = 0\.55/, 'this.SPIN_DECAY = 0.65');
file = file.replace(/TABLE_BOUNCE_E: 0\.42|this\.TABLE_BOUNCE_E = 0\.42/, 'this.TABLE_BOUNCE_E = 0.65');
file = file.replace(/RIM_BOUNCE_E: 0\.48|this\.RIM_BOUNCE_E = 0\.48/, 'this.RIM_BOUNCE_E = 0.55');
file = file.replace(/ROLL_FRICTION: 620|this\.ROLL_FRICTION = 620/, 'this.ROLL_FRICTION = 500');
file = file.replace(/SLIDE_FRICTION: 900|this\.SLIDE_FRICTION = 900/, 'this.SLIDE_FRICTION = 800');

// Update Camera (CSS Perspective)
const oldCamera = `#table-surface{
    position:relative; margin:0 auto; overflow:hidden; border-radius:26px;
    transform:rotateX(44deg); transform-origin:center bottom; transform-style:preserve-3d;
    box-shadow:0 40px 80px rgba(0,0,0,0.8);
  }`;
const newCamera = `#table-surface{
    position:relative; margin:0 auto; overflow:hidden; border-radius:26px;
    transform:rotateX(55deg) translateY(10%); transform-origin:center bottom; transform-style:preserve-3d;
    box-shadow:0 40px 80px rgba(0,0,0,0.8);
  }`;
file = file.replace(oldCamera, newCamera);

fs.writeFileSync('app/src/main/assets/index.html', file);
