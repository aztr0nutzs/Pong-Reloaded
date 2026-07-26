const fs = require('fs');
let html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');

// The requirement specifies 80% of the screen.
// `h-[80vh]` perfectly fulfills this, and `aspect-[1/4]` makes it a 1:4 table length.
html = html.replace(/pb-\[5vh\]/, 'pb-[2vh]'); // Decrease bottom padding slightly so table bottom sits cleanly at the bottom edge
fs.writeFileSync('app/src/main/assets/index.html', html);
console.log("Patched final spacing constraints");
