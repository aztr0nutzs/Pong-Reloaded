const fs = require('fs');
let code = fs.readFileSync('app/src/main/assets/js/modules/Main.js', 'utf8');

const sections = code.split('  /* ================= ');
let sectionMap = {};
for (let i = 1; i < sections.length; i++) {
  const parts = sections[i].split(' ================= */');
  const name = parts[0].trim();
  sectionMap[name] = parts[1];
}

fs.writeFileSync('section_flight.txt', sectionMap['GAME: BALL FLIGHT']);
fs.writeFileSync('section_setup.txt', sectionMap['GAME: SETUP']);
