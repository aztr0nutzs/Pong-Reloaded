const fs = require('fs');
let throwCode = fs.readFileSync('app/src/main/assets/js/modules/ThrowController.js', 'utf8');

const startIdx = throwCode.indexOf('/* AI opponent:');
if (startIdx !== -1) {
    const aiThrow = throwCode.substring(startIdx);
    // it goes to the end minus two closing braces
    const trimmed = aiThrow.substring(0, aiThrow.lastIndexOf('}'));
    const finalAiThrow = trimmed.substring(0, trimmed.lastIndexOf('}')) + '}';
    
    const aiCode = `
class AIController {
    constructor(engine, predictor, thrower) {
        this.engine = engine;
        this.predictor = predictor;
        this.thrower = thrower;
        this.DIFF_AI_HIT = { easy:0.30, normal:0.44, hard:0.58 };
    }
    
    ` + finalAiThrow.replace(/this\.DIFF_AI_HIT/g, 'this.DIFF_AI_HIT')
            .replace(/this\.engine/g, 'this.engine')
            .replace(/this\.predictor/g, 'this.predictor')
            .replace(/this\.playback/g, 'this.thrower.playback.bind(this.thrower)') + `
}
window.AIController = AIController;
`;
    fs.writeFileSync('app/src/main/assets/js/modules/AIController.js', aiCode);
    
    throwCode = throwCode.substring(0, startIdx) + '\n  }\n';
    fs.writeFileSync('app/src/main/assets/js/modules/ThrowController.js', throwCode);
    console.log("Extracted");
} else {
    console.log("Not found");
}
