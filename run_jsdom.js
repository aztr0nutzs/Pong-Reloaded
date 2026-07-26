const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM, VirtualConsole } = jsdom;

const html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');

const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", function (error) {
  console.error(error.stack, error.detail);
});
virtualConsole.on("error", function (error) {
  console.error("ERROR", error);
});
virtualConsole.on("warn", function (warn) {
  console.log("WARN", warn);
});

const dom = new JSDOM(html, { 
    runScripts: "dangerously", 
    resources: "usable",
    url: "file://" + __dirname + "/app/src/main/assets/",
    virtualConsole 
});
