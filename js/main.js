// 1. CREATE VISUAL DEBUGGER (So you can see errors on screen)
const debugBox = document.createElement('div');
debugBox.style.position = 'fixed';
debugBox.style.bottom = '10px';
debugBox.style.right = '10px';
debugBox.style.width = '300px';
debugBox.style.height = '200px';
debugBox.style.background = 'rgba(0,0,0,0.9)';
debugBox.style.border = '2px solid red';
debugBox.style.color = '#0f0';
debugBox.style.fontFamily = 'monospace';
debugBox.style.fontSize = '10px';
debugBox.style.overflowY = 'scroll';
debugBox.style.zIndex = '10000';
debugBox.style.padding = '5px';
debugBox.id = 'visual-debug';
document.body.appendChild(debugBox);

function log(msg, type='info') {
    const l = document.createElement('div');
    l.innerText = `> ${msg}`;
    if(type==='error') l.style.color = 'red';
    if(type==='success') l.style.color = 'cyan';
    debugBox.appendChild(l);
    debugBox.scrollTop = debugBox.scrollHeight;
    console.log(msg);
}

log("SYSTEM BOOT: Starting script...");

// 2. IMPORT MODULES WITH ERROR CATCHING
try {
    log("Importing Core...", 'info');
    await import('./core.js');
    log("Core Imported.", 'success');
} catch (e) {
    log("CRITICAL ERROR: Could not load core.js! " + e.message, 'error');
}

// Import Games
import { initGeometry } from './games/geo.js';
import { initPong } from './games/pong.js';
import { initSnake } from './games/snake.js';
import { initRunner } from './games/runner.js';
import { initBJ, cleanupBJ } from './games/blackjack.js';
import { initTTT, cleanupTTT } from './games/ttt.js';
import { initFlappy } from './games/flappy.js';

// --- GAME SWITCHER ---
window.launchGame = (game) => {
    log(`Launching: ${game}`);
    window.closeOverlays();
    const overlayId = 'overlay' + (game === 'ttt' || game === 'geo' ? game.toUpperCase() : (game.charAt(0).toUpperCase() + game.slice(1)));
    const el = document.getElementById(overlayId); if(el) el.classList.add('active');
    
    if(game==='pong') initPong(); 
    if(game==='snake') initSnake(); 
    if(game==='runner') initRunner(); 
    if(game==='geo') initGeometry(); 
    if(game==='type') window.initTypeGame(); 
    if(game==='blackjack') initBJ(); 
    if(game==='ttt') initTTT(); 
    if(game==='flappy') initFlappy();
    
    window.unlockAchievement('noob');
};

window.openGame = (id) => { 
    window.closeOverlays(); 
    const el = document.getElementById(id); if(el) el.classList.add('active'); 
    if(id==='overlayProfile') window.renderBadges(); 
    if(id==='overlayShop') window.renderShop(); 
    if(id==='overlayBank') window.updateBankLog(); 
};

window.closeOverlays = () => { 
    stopAllGames(); 
    document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active')); 
    document.getElementById('menuDropdown').classList.remove('show'); 
};

function stopAllGames(){
    if(window.pAnim) cancelAnimationFrame(window.pAnim); 
    if(window.sAnim) clearTimeout(window.sAnim); 
    if(window.rAnim) cancelAnimationFrame(window.rAnim); 
    if(window.gAnim) cancelAnimationFrame(window.gAnim); 
    if(window.fAnim) cancelAnimationFrame(window.fAnim); 
    if(window.typeInterval) clearInterval(window.typeInterval);
    cleanupTTT(); cleanupBJ(); 
    window.currentGame=null; 
    window.keysPressed = {}; 
}

// --- WAIT FOR HTML TO LOAD ---
// We use a safe logic here to ensure buttons exist
function attachListeners() {
    log("Searching for buttons...");

    const btnLogin = document.getElementById('btnLogin');
    const btnRegister = document.getElementById('btnRegister');

    if(!btnLogin) {
        log("ERROR: Login Button (btnLogin) NOT FOUND in HTML", 'error');
        return;
    }
    if(!btnRegister) {
        log("ERROR: Register Button (btnRegister) NOT FOUND in HTML", 'error');
        return;
    }

    log("Buttons found. Attaching click events.", 'success');

    // === LOGIN LOGIC ===
    btnLogin.onclick = async function() {
        log("Login Clicked detected!", 'info');
        const u = document.getElementById('usernameInput').value.trim();
        const p = document.getElementById('pinInput').value.trim();

        if(!window.login) {
            log("CRITICAL: window.login function missing!", 'error');
            return;
        }

        if(u.length < 3 || p.length < 4) {
            log("Invalid Input length", 'error');
            return window.beep(200,'sawtooth',0.5);
        }

        window.setText('loginMsg', "CONNECTING...");
        log("Calling Firebase Login...");
        
        try {
            const res = await window.login(u,p);
            log("Result: " + res);
            
            if(res === true) {
                window.beep(600,'square',0.1);
                log("Login Success!", 'success');
            } else {
                window.setText('loginMsg', res);
                window.beep(100,'sawtooth',0.5);
                log("Login Failed: " + res, 'error');
            }
        } catch (err) {
            log("JS Error during login: " + err.message, 'error');
        }
    };

    // === REGISTER LOGIC ===
    btnRegister.onclick = async function() {
        log("Register Clicked detected!", 'info');
        const u = document.getElementById('usernameInput').value.trim();
        const p = document.getElementById('pinInput').value.trim();

        if(!window.register) {
            log("CRITICAL: window.register function missing!", 'error');
            return;
        }

        if(u.length < 3 || p.length < 4) return;

        window.setText('loginMsg', "REGISTERING...");
        log("Calling Firebase Register...");

        try {
            const res = await window.register(u,p);
            log("Result: " + res);

            if(res === true) {
                window.beep(600,'square',0.1);
                log("Register Success!", 'success');
            } else {
                window.setText('loginMsg', res);
                window.beep(100,'sawtooth',0.5);
                log("Register Failed: " + res, 'error');
            }
        } catch (err) {
            log("JS Error during reg: " + err.message, 'error');
        }
    };

    // OTHER LISTENERS
    const btnLogout = document.getElementById('btnLogout');
    if(btnLogout) btnLogout.onclick = () => { localStorage.clear(); location.reload(); };

    const menuToggle = document.getElementById('menuToggle');
    if(menuToggle) menuToggle.onclick = (e) => { e.stopPropagation(); document.getElementById('menuDropdown').classList.toggle('show'); };
    
    document.addEventListener('click', (e) => { if(!e.target.closest('#menuToggle')) document.getElementById('menuDropdown').classList.remove('show'); });

    // Config Sliders
    const themeColor = document.getElementById('themeColor');
    if(themeColor) themeColor.oninput = (e) => { 
        const h = e.target.value; document.documentElement.style.setProperty('--accent', h); 
        const r=parseInt(h.slice(1,3),16), g=parseInt(h.slice(3,5),16), b=parseInt(h.slice(5,7),16); 
        document.documentElement.style.setProperty('--accent-dim', `rgba(${r},${g},${b},0.2)`); 
        document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.6)`); 
    };

    // Restart Button
    const goRestart = document.getElementById('goRestart');
    if(goRestart) goRestart.onclick=()=>{ 
        document.getElementById('modalGameOver').classList.remove('active'); 
        if(window.currentGame==='snake')initSnake(); 
        if(window.currentGame==='pong')initPong(); 
        if(window.currentGame==='runner')initRunner(); 
        if(window.currentGame==='geo')initGeometry(); 
        if(window.currentGame==='flappy')initFlappy(); 
        if(window.currentGame==='blackjack'){window.myMoney=1000;initBJ();document.getElementById('overlayBlackjack').classList.add('active');} 
    };
    
    // Exit Button
    const goExit = document.getElementById('goExit');
    if(goExit) goExit.onclick=()=>{ window.closeOverlays(); document.getElementById('modalGameOver').classList.remove('active'); };
}

// 4. BOOT STRAP
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachListeners);
} else {
    attachListeners();
}

// SECRETS
const konamiCode = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a']; let konamiIndex = 0; 
document.addEventListener('keydown', (e) => { 
    window.keysPressed[e.key] = true; 
    if(e.key === konamiCode[konamiIndex]) { 
        konamiIndex++; if(konamiIndex === konamiCode.length) { activateMatrixHack(); konamiIndex = 0; } 
    } else konamiIndex = 0; 
});
document.addEventListener('keyup', e => { window.keysPressed[e.key] = false; });

function activateMatrixHack() { 
    if(window.myName === "ANON") return alert("LOGIN FIRST"); 
    document.documentElement.style.setProperty('--accent', '#00ff00'); document.getElementById('matrixCanvas').classList.add('active'); 
    window.showToast("MATRIX MODE ACTIVATED", "🐇"); window.myMoney += 1000; window.saveStats(); window.playSuccessSound(); 
}
