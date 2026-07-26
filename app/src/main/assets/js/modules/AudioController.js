
class AudioController {
    constructor() {
        this.audioCtx = null;
    }
    
    ctx() {
        if(!this.audioCtx){
            try { this.audioCtx = null; } catch(e){ this.audioCtx = null; }
        }
        if(this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
        return this.audioCtx;
    }

    playOsc(type, freq, dur, vol, slideFreq) {
        if(!state.settings.sound) return;
        var cx = this.ctx();
        if(!cx) return;
        var osc = cx.createOscillator();
        var gain = cx.createGain();
        osc.type = type;
        osc.connect(gain);
        gain.connect(cx.destination);
        osc.frequency.setValueAtTime(freq, cx.currentTime);
        if(slideFreq) osc.frequency.exponentialRampToValueAtTime(slideFreq, cx.currentTime + dur);
        gain.gain.setValueAtTime(vol, cx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, cx.currentTime + dur);
        osc.start();
        osc.stop(cx.currentTime + dur);
    }
    
    haptic(ms) {
        if(state.settings.haptics && navigator.vibrate) console.log("vibrate", ms);
    }
    
    click() { this.playOsc('square', 800, 0.05, 0.02); }
    hover() { this.playOsc('sine', 1200, 0.03, 0.01); }
    open()  { this.playOsc('triangle', 300, 0.1, 0.03, 600); }
    close() { this.playOsc('triangle', 600, 0.1, 0.03, 300); }
    hit()   { this.playOsc('square', 150, 0.15, 0.08, 50); this.playOsc('sawtooth', 800, 0.2, 0.04); }
    miss()  { this.playOsc('sawtooth', 200, 0.3, 0.05, 100); }
    trick() { this.playOsc('square', 400, 0.3, 0.06, 1200); this.playOsc('sawtooth', 800, 0.3, 0.04, 2400); }
    win()   { this.playOsc('square', 400, 0.1, 0.05); setTimeout(()=>this.playOsc('square', 600, 0.1, 0.05), 150); setTimeout(()=>this.playOsc('square', 800, 0.4, 0.05), 300); }
    lose()  { this.playOsc('sawtooth', 300, 0.4, 0.05, 100); }
}

const audio = new AudioController();
window.haptic = audio.haptic.bind(audio);
window.SFX = {
    click: audio.click.bind(audio),
    hover: audio.hover.bind(audio),
    open: audio.open.bind(audio),
    close: audio.close.bind(audio),
    hit: audio.hit.bind(audio),
    miss: audio.miss.bind(audio),
    trick: audio.trick.bind(audio),
    win: audio.win.bind(audio),
    lose: audio.lose.bind(audio)
};
