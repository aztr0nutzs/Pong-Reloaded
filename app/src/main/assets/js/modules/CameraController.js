class CameraController {
    static CONFIG = {
        perspective: '1100px',
        perspectiveOrigin: '50% 15%',
        rotateX: '56deg',
        translateY: '3%',
        translateZ: '-40px',
        fovDeg: 55, // Realistic 55° horizontal FOV
        cameraHeightMm: 1200, // Eye level standing position (~1.2m above table)
        cameraDistanceMm: -400 // Standing 400mm behind the player's throwing line
    };

    /**
     * Enforces an authoritative, locked 3D beer pong viewpoint positioned behind the table.
     * Guarantees 100% table surface visibility, zero camera shake, zero drift, and zero unwanted rotation.
     */
    static setupCamera() {
        var perspectiveEl = document.getElementById('table-perspective');
        var surfaceEl = document.getElementById('table-surface');
        
        if (perspectiveEl) {
            perspectiveEl.style.perspective = CameraController.CONFIG.perspective;
            perspectiveEl.style.webkitPerspective = CameraController.CONFIG.perspective;
            perspectiveEl.style.perspectiveOrigin = CameraController.CONFIG.perspectiveOrigin;
            
            perspectiveEl.style.display = 'flex';
            perspectiveEl.style.alignItems = 'flex-end';
            perspectiveEl.style.justifyContent = 'center';
            perspectiveEl.style.paddingBottom = '1vh';
            perspectiveEl.style.overflow = 'hidden';

            var viewportWidth = perspectiveEl.clientWidth || window.innerWidth;
            var viewportHeight = perspectiveEl.clientHeight ||
                (window.visualViewport ? window.visualViewport.height : window.innerHeight);
            var heightForWidth = viewportWidth * 0.92 * 4;
            var framedHeight = Math.min(viewportHeight * 0.88, heightForWidth);
            document.documentElement.style.setProperty('--table-height', Math.max(1, framedHeight) + 'px');
        }
        
        if (surfaceEl) {
            surfaceEl.style.transformOrigin = 'center bottom';
            surfaceEl.style.transform = `rotateX(${CameraController.CONFIG.rotateX}) translateY(${CameraController.CONFIG.translateY}) translateZ(${CameraController.CONFIG.translateZ})`;
            surfaceEl.style.transition = 'none'; // Lock perspective: strictly no unexpected zoom, pan, or rotation
            surfaceEl.style.willChange = 'transform';
        }
    }

    /**
     * Re-asserts camera parameters to ensure no dynamic animation or DOM mutation alters gameplay perspective.
     */
    static lockCamera() {
        CameraController.setupCamera();
    }

    /**
     * Resets camera to standard tournament view.
     */
    static resetCamera() {
        CameraController.setupCamera();
    }

    static bindViewport() {
        if (CameraController.viewportBound) return;
        CameraController.viewportBound = true;
        var scheduled = false;
        var schedule = function() {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(function() {
                scheduled = false;
                CameraController.setupCamera();
            });
        };
        window.addEventListener('resize', schedule, { passive: true });
        window.addEventListener('orientationchange', schedule, { passive: true });
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', schedule, { passive: true });
            window.visualViewport.addEventListener('scroll', schedule, { passive: true });
        }
    }

    /**
     * Returns camera geometric metrics for 3D projection calculations.
     */
    static getCameraMetrics() {
        return {
            perspectivePx: parseFloat(CameraController.CONFIG.perspective),
            pitchDeg: parseFloat(CameraController.CONFIG.rotateX),
            fovDeg: CameraController.CONFIG.fovDeg,
            eyeHeightMm: CameraController.CONFIG.cameraHeightMm,
            eyeDistanceMm: CameraController.CONFIG.cameraDistanceMm
        };
    }

    /**
     * Applies color scheme themes while preserving fixed camera viewport properties.
     */
    static applyArenaTheme(arenaId) {
        var a = window.ARENAS ? window.ARENAS.find(function(x){ return x.id === arenaId; }) : null;
        if (a) {
            document.documentElement.style.setProperty('--primary', a.color);
        }
        CameraController.lockCamera();
    }
}

window.CameraController = CameraController;
window.applyArenaTheme = CameraController.applyArenaTheme;
CameraController.bindViewport();
