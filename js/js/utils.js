import { state, db } from './config.js';
import { updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Sound System
export function beep(freq=440, type='square', len=0.1) {
    if(state.audioCtx.state==='suspended') state.audioCtx.resume();
    const o=state.audioCtx.createOscillator(), g=state.audioCtx.createGain();
    o.type=type; 
    o.frequency.setValueAtTime(freq, state.audioCtx.currentTime);
    g.gain.setValueAtTime(0.05 * state.globalVol, state.audioCtx.currentTime); 
    g.gain.exponentialRampToValueAtTime(0.001, state.audioCtx.currentTime+len);
    o.connect(g); g.connect(state.audioCtx.destination); 
    o.start(); o.stop(state.audioCtx.currentTime+len);
}

// Toast Notification
export function showToast(title, icon, subtitle = "") {
    const t = document.createElement('div');
    t.className = 'toast'; // Ensure CSS exists for .toast
    t.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-content"><div class="toast-title">${title}</div><div class="toast-desc">${subtitle}</div></div>`;
    const box = document.getElementById('toastBox');
    if(box) box.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

// Helper to set Text
export function setText(id, txt) { 
    const el = document.getElementById(id); 
    if(el) el.innerText = txt; 
}

// Database Save
export async function saveStats() {
    if(state.myName === "ANON") return;
    try {
        await updateDoc(doc(db, 'gooner_users', state.myName), {
            money: state.myMoney,
            stats: state.myStats,
            achievements: state.myAchievements,
            inventory: state.myInventory
        });
        // Dispatch event for UI update
        window.dispatchEvent(new CustomEvent('statsUpdated'));
    } catch(e) {
        console.error("Save failed", e);
    }
}
