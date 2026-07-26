const fs = require('fs');
let html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');

html = html.replace(/border-radius: 12px;/, '');
html = html.replace(/rounded-lg/g, '');

fs.writeFileSync('app/src/main/assets/index.html', html);
console.log("Patched corners");
