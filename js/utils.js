export const audioCtx = new (window.AudioContext||window.webkitAudioContext)();
let globalVol = 0.5;

export function setVolume(val) { globalVol = val; }

export function beep(freq=440, type='square', len=0.1) {
    if(audioCtx.state==='suspended') audioCtx.resume();
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type=type; 
    o.frequency.setValueAtTime(freq,audioCtx.currentTime);
    g.gain.setValueAtTime(0.05*globalVol,audioCtx.currentTime); 
    g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+len);
    o.connect(g); g.connect(audioCtx.destination); 
    o.start(); o.stop(audioCtx.currentTime+len);
}

export function setText(id, txt) { 
    const el = document.getElementById(id); 
    if(el) el.innerText = txt; 
}

export function showToast(title, icon, subtitle = "") {
    const t = document.createElement('div'); 
    t.className = 'toast'; 
    t.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-content"><div class="toast-title">${title}</div><div class="toast-desc">${subtitle}</div></div>`; 
    document.getElementById('toastBox').appendChild(t); 
    setTimeout(() => t.remove(), 4000); 
}
