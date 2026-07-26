const fs = require('fs');

let file = fs.readFileSync('app/src/main/assets/index.html', 'utf8');
const scriptMatch = file.match(/<script>\s*\(function\(\)\{\s*"use strict";([\s\S]*?)\}\)\(\);\s*<\/script>/);

if (!scriptMatch) {
    console.error("Could not find script block");
    process.exit(1);
}

let scriptContent = scriptMatch[1];
fs.writeFileSync('app/src/main/assets/js/main.js', scriptContent);
console.log("Extracted main.js");
