class BallController {
    
    static resetBallPosition(fromTeam) {
        if (!window.GameStateManager) return;
        if (!window.Physics || !window.Physics.world) return;
        var position = window.Physics.world.launchPosition(fromTeam);
        
        let state = GameStateManager.getState();
        GameStateManager.setBallVisible(true);
        state.ball.prevX = position.x;
        state.ball.prevY = position.y;
        state.ball.prevZ = position.z;
        state.ball.x = position.x;
        state.ball.y = position.y;
        state.ball.z = position.z;
        state.ball.position = { x: position.x, y: position.y, z: position.z };
        state.ball.previousPosition = { x: position.x, y: position.y, z: position.z };
        state.ball.velocity = { x: 0, y: 0, z: 0 };
        state.ball.angularVelocity = { x: 0, y: 0, z: 0 };
        state.ball.orientation = { x: 0, y: 0, z: 0 };
        state.ball.airborne = false;
        state.ball.contactState = { type: 'table', cupElement: null };
        state.ball.activeContacts = [state.ball.contactState];
        state.ball.scaleDepth = 1;
        state.ball.shadowScale = 1;
        state.ball.shadowOpacity = 1;
        
        if (window.Renderer) Renderer.render(state);
    }

}
window.BallController = BallController;
window.resetBallPosition = BallController.resetBallPosition;
