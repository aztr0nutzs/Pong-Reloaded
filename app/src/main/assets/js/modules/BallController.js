class BallController {
    
    static resetBallPosition(fromTeam) {
        if (!window.GameStateManager) return;
        if (!window.Physics || !window.Physics.world) return;
        var position = window.Physics.world.launchPosition(fromTeam);
        
        let state = GameStateManager.getState();
        state.ball.active = true;
        state.ball.prevX = position.x;
        state.ball.prevY = position.y;
        state.ball.prevZ = position.z;
        state.ball.x = position.x;
        state.ball.y = position.y;
        state.ball.z = position.z;
        state.ball.scaleDepth = 1;
        state.ball.shadowScale = 1;
        state.ball.shadowOpacity = 1;
        
        if (window.Renderer) Renderer.render(state);
    }

}
window.BallController = BallController;
window.resetBallPosition = BallController.resetBallPosition;
