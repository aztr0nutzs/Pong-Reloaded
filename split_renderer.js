const fs = require('fs');

const renderCode = `
class Renderer {
    static updateGameHUD() {
        var m = state.match;
        if(!m) return;
        $('score-player').textContent = 10 - m.aiRemaining;
        $('score-ai').textContent = 10 - m.playerRemaining;
        $('turn-indicator').textContent = m.turn === 'player' ? 'YOUR TURN' : 'AI TURN';
        $('turn-indicator').style.color = m.turn === 'player' ? '#00f3ff' : '#ff5566';
        var trickBtn = $('btn-trick-shot');
        var trickFill = $('trick-fill');
        trickFill.style.width = m.trickMeter + '%';
        if(m.trickMeter >= 100){
            trickBtn.classList.add('ready');
        } else {
            trickBtn.classList.remove('ready');
            trickBtn.classList.remove('trick-armed');
        }
    }
    
    static sizeAimSvg() {
        if(window.Aim) window.Aim.resizeSvg();
    }
}
window.Renderer = Renderer;
window.updateGameHUD = Renderer.updateGameHUD;
window.sizeAimSvg = Renderer.sizeAimSvg;
`;

const cameraCode = `
class CameraController {
    static applyArenaTheme(arenaId) {
        var a = ARENAS.find(function(x){ return x.id === arenaId; });
        if(a) document.documentElement.style.setProperty('--primary', a.color);
    }
}
window.CameraController = CameraController;
window.applyArenaTheme = CameraController.applyArenaTheme;
`;

fs.writeFileSync('app/src/main/assets/js/modules/Renderer.js', renderCode);
fs.writeFileSync('app/src/main/assets/js/modules/CameraController.js', cameraCode);
console.log("Renderer, CameraController generated");
