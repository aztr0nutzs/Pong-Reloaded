const fs = require('fs');

let code = fs.readFileSync('app/src/main/assets/js/modules/Main.js', 'utf8');

// I will just copy the remaining parts of Main.js that are not State, Util, Audio, Effects, CupManager, BallController.
// Actually, it's easier to just take all the remaining function definitions and put them in UIController and Main.

const uiCode = `
class UIController {
    static toast(msg){
        var t = $('toast-msg');
        t.textContent = msg;
        t.classList.remove('show');
        void t.offsetWidth;
        t.classList.add('show');
    }

    static showScreen(id){
        qsa('.screen').forEach(function(el){ el.classList.remove('active'); });
        $(id).classList.add('active');
        state.screen = id;
    }

    static openPanel(id){
        if(state.activePanel) $(state.activePanel).classList.remove('active');
        $(id).classList.add('active');
        $('layer-panels').classList.add('active');
        state.activePanel = id;
        SFX.open();
    }

    static closePanel(){
        if(state.activePanel) $(state.activePanel).classList.remove('active');
        $('layer-panels').classList.remove('active');
        state.activePanel = null;
        SFX.close();
    }

    static openModal(id){
        $(id).classList.add('active');
        $('layer-modals').classList.add('active');
    }

    static closeModal(id){
        $(id).classList.remove('active');
        $('layer-modals').classList.remove('active');
    }
}
window.toast = UIController.toast;
window.showScreen = UIController.showScreen;
window.openPanel = UIController.openPanel;
window.closePanel = UIController.closePanel;
window.openModal = UIController.openModal;
window.closeModal = UIController.closeModal;
`;

fs.writeFileSync('app/src/main/assets/js/modules/UIController.js', uiCode);
console.log("UIController generated");
