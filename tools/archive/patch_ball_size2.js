const fs = require('fs');
let js = fs.readFileSync('app/src/main/assets/js/modules/InputManager.js', 'utf8');

js = js.replace(/\$\('ball'\)\.style\.height = bw \+ 'px';/, 
`$('ball').style.height = bw + 'px';
        if ($('ball-shadow')) {
            $('ball-shadow').style.width = (bw * 0.85) + 'px';
            $('ball-shadow').style.height = (bw * 0.27) + 'px';
        }`);

fs.writeFileSync('app/src/main/assets/js/modules/InputManager.js', js);
console.log("Patched dynamic ball shadow size");
