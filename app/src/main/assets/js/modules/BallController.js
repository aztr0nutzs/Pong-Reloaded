class BallController {
    
    static resetBallPosition(fromTeam) {
        if (!window.GameStateManager) return;
        var laneEl = fromTeam === 'player' ? document.getElementById('player-cups') : document.getElementById('ai-cups');
        if (!laneEl) return;
        var rect = laneEl.getBoundingClientRect();
        
        var x = rect.left + rect.width/2;
        var y = fromTeam === 'player' ? (rect.bottom - 10) : (rect.top - 10);
        
        let state = GameStateManager.getState();
        state.ball.active = true;
        state.ball.prevX = x;
        state.ball.prevY = y;
        state.ball.prevZ = 0;
        state.ball.x = x;
        state.ball.y = y;
        state.ball.z = 0;
        state.ball.scaleDepth = 1;
        state.ball.shadowScale = 1;
        state.ball.shadowOpacity = 1;
        
        if (window.Renderer) Renderer.render(state);
    }

}
window.BallController = BallController;
window.resetBallPosition = BallController.resetBallPosition;
