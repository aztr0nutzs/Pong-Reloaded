const fs = require('fs');

const cupCode = `
class CupManager {
    static buildCups() {
        CupManager.buildFormation($('ai-cups'), [4,3,2,1], 'ai');
        CupManager.buildFormation($('player-cups'), [1,2,3,4], 'player');
    }
    static buildFormation(container, rowOrder, team) {
        container.innerHTML = '';
        var idx = 0;
        rowOrder.forEach(function(rowSize){
            var row = document.createElement('div');
            row.className = 'cup-row';
            for(var i=0;i<rowSize;i++){
                var cup = document.createElement('div');
                cup.className = 'cup cup-' + team;
                cup.id = team + '-cup-' + idx;
                cup.dataset.idx = idx;
                cup.dataset.team = team;
                var inner = document.createElement('div');
                inner.className = 'cup-inner';
                cup.appendChild(inner);
                row.appendChild(cup);
                idx++;
            }
            container.appendChild(row);
        });
    }
}
window.CupManager = CupManager;
window.buildCups = CupManager.buildCups;
window.buildFormation = CupManager.buildFormation;
`;

const ballCode = `
class BallController {
    static resetBallPosition(fromTeam) {
        var ball = $('ball');
        var laneEl = fromTeam === 'player' ? $('player-cups') : $('ai-cups');
        var rect = laneEl.getBoundingClientRect();
        ball.style.transform = '';
        var x = rect.left + rect.width/2 - Physics.BALL_R;
        var y = fromTeam === 'player' ? (rect.bottom - 10) : (rect.top - 10);
        ball.style.left = x + 'px';
        ball.style.top = y + 'px';
    }
}
window.BallController = BallController;
window.resetBallPosition = BallController.resetBallPosition;
`;

fs.writeFileSync('app/src/main/assets/js/modules/CupManager.js', cupCode);
fs.writeFileSync('app/src/main/assets/js/modules/BallController.js', ballCode);

console.log('CupManager, BallController generated');
