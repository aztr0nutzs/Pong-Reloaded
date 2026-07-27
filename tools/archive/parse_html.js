const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');
const dom = new JSDOM(html);
console.log("ai-cups:", dom.window.document.getElementById('ai-cups'));
console.log("body children count:", dom.window.document.body.children.length);
