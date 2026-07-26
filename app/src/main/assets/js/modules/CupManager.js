
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
