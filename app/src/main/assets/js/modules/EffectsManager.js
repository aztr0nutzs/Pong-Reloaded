
class EffectsManager {
    static spawnParticles(container, count){
        var el = document.getElementById(container);
        if(!el) return;
        el.innerHTML = '';
        
        var canvas = document.createElement('canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.position = 'absolute';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.pointerEvents = 'none';
        el.appendChild(canvas);
        
        var ctx = canvas.getContext('2d');
        var particles = [];
        
        for(var i=0; i<count * 2; i++){
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height + canvas.height * 0.2,
                size: Math.random() * 2 + 1,
                speedY: Math.random() * -0.5 - 0.2,
                speedX: Math.random() * 0.4 - 0.2,
                alpha: Math.random() * 0.5 + 0.1,
                pulseSpeed: Math.random() * 0.05 + 0.01,
                pulseVal: Math.random() * Math.PI * 2
            });
        }
        
        if (!GameStateManager.state.particleSystems) {
            GameStateManager.state.particleSystems = [];
        }
        
        GameStateManager.state.particleSystems.push({
            canvas: canvas,
            ctx: ctx,
            particles: particles
        });
        
        window.addEventListener('resize', function() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });
    }
    
    static update(dt) {
        if (!GameStateManager.state.particleSystems) return;
        
        for (let sys of GameStateManager.state.particleSystems) {
            let canvas = sys.canvas;
            let particles = sys.particles;
            
            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];
                let dtFactor = dt * 60;
                p.y += p.speedY * dtFactor;
                p.x += p.speedX * dtFactor;
                p.pulseVal += p.pulseSpeed * dtFactor;
                
                if (p.y < -10) {
                    p.y = canvas.height + 10;
                    p.x = Math.random() * canvas.width;
                }
                if (p.x < -10) p.x = canvas.width + 10;
                if (p.x > canvas.width + 10) p.x = -10;
            }
        }
    }
    
    static render(state) {
        if (!state.particleSystems) return;
        
        for (let sys of state.particleSystems) {
            let canvas = sys.canvas;
            let ctx = sys.ctx;
            let particles = sys.particles;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];
                var currentAlpha = p.alpha + Math.sin(p.pulseVal) * 0.2;
                if (currentAlpha < 0) currentAlpha = 0;
                if (currentAlpha > 1) currentAlpha = 1;
                
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 243, 255, ' + currentAlpha + ')';
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#00f3ff';
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;
        }
    }
}
window.EffectsManager = EffectsManager;
