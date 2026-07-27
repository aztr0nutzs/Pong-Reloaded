const fs = require('fs');
let js = fs.readFileSync('app/src/main/assets/js/modules/InputManager.js', 'utf8');

js = js.replace(/self\.cachedTableRect = \$\('table-surface'\)\.getBoundingClientRect\(\);/,
`self.cachedTableRect = $('table-surface').getBoundingClientRect();
        let bw = self.cachedTableRect.width * 0.06557; // 40mm / 610mm
        $('ball').style.width = bw + 'px';
        $('ball').style.height = bw + 'px';
        window.Thrower.engine.BALL_R = bw / 2;
        window.Thrower.engine.BALL_AREA = Math.PI * (bw/2) * (bw/2);
        self.cachedBallRect = $('ball').getBoundingClientRect();`);

fs.writeFileSync('app/src/main/assets/js/modules/InputManager.js', js);
console.log("Patched dynamic ball size");
