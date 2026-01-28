import './core.js';
import { initGeometry } from './games/geo.js';
import { initPong } from './games/pong.js';
import { initSnake } from './games/snake.js';
import { initRunner } from './games/runner.js';
import { initBJ, cleanupBJ } from './games/blackjack.js';
import { initTTT, cleanupTTT } from './games/ttt.js';
import { initFlappy } from './games/flappy.js';

console.log("MAIN: Script Loaded");

// --- Game Switcher ---
window.launchGame = (game) => {
    console.log("Launching Game:", game);
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

// --- UI Helpers ---
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

// --- SECRETS & GLOBAL KEYS ---
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

// --- INITIALIZATION ---
// This waits for the HTML to be ready before attaching buttons
window.onload = () => {
    console.log("MAIN: Window Loaded. Attaching listeners...");

    // 1. Clock
    setInterval(()=>{ 
        const d=new Date(); window.setText('sysClock', d.toLocaleTimeString('en-GB')); window.setText('sysPing', Math.floor(Math.random()*40+10)+"ms");
        if(d.getMinutes() === 37) window.unlockAchievement('leet'); if(d.getHours() === 3) window.unlockAchievement('insomniac');
    },1000);

    // 2. Auto-Login from LocalStorage
    if(localStorage.getItem('goonerUser')) window.login(localStorage.getItem('goonerUser'), localStorage.getItem('goonerPin'));

    // 3. Login Button
    const btnLogin = document.getElementById('btnLogin');
    if(btnLogin) {
        btnLogin.onclick = async () => { 
            console.log("Login Clicked");
            const u=document.getElementById('usernameInput').value.trim();
            const p=document.getElementById('pinInput').value.trim(); 
            if(u.length<3||p.length<4) return window.beep(200,'sawtooth',0.5); 
            
            window.setText('loginMsg', "CONNECTING...");
            const res=await window.login(u,p); 
            
            if(res===true) {
                window.beep(600,'square',0.1); 
            } else { 
                window.setText('loginMsg', res); 
                window.beep(100,'sawtooth',0.5); 
            } 
        };
    } else console.error("MAIN: Login Button Not Found!");

    // 4. Register Button
    const btnRegister = document.getElementById('btnRegister');
    if(btnRegister) {
        btnRegister.onclick = async () => { 
            console.log("Register Clicked");
            const u=document.getElementById('usernameInput').value.trim();
            const p=document.getElementById('pinInput').value.trim(); 
            if(u.length<3||p.length<4) return; 
            
            window.setText('loginMsg', "REGISTERING...");
            const res=await window.register(u,p); 
            
            if(res===true) {
                window.beep(600,'square',0.1); 
            } else { 
                window.setText('loginMsg', res); 
                window.beep(100,'sawtooth',0.5); 
            } 
        };
    } else console.error("MAIN: Register Button Not Found!");

    // 5. Menu Buttons
    const btnLogout = document.getElementById('btnLogout');
    if(btnLogout) btnLogout.onclick = () => { localStorage.clear(); location.reload(); };

    const menuToggle = document.getElementById('menuToggle');
    if(menuToggle) menuToggle.onclick = (e) => { e.stopPropagation(); document.getElementById('menuDropdown').classList.toggle('show'); };

    document.addEventListener('click', (e) => { if(!e.target.closest('#menuToggle')) document.getElementById('menuDropdown').classList.remove('show'); });

    // 6. Config Sliders
    document.getElementById('themeColor').oninput = (e) => { 
        const h = e.target.value; document.documentElement.style.setProperty('--accent', h); 
        const r=parseInt(h.slice(1,3),16), g=parseInt(h.slice(3,5),16), b=parseInt(h.slice(5,7),16); 
        document.documentElement.style.setProperty('--accent-dim', `rgba(${r},${g},${b},0.2)`); 
        document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.6)`); 
    };
    document.getElementById('volSlider').oninput = (e) => window.globalVol = e.target.value/100;
    document.getElementById('scanSlider').oninput = (e) => document.documentElement.style.setProperty('--scanline-opacity', e.target.value/100);
    document.getElementById('flickerToggle').onclick = (e) => { document.body.classList.toggle('flicker-on'); e.target.innerText = document.body.classList.contains('flicker-on')?"ON":"OFF"; };
    document.getElementById('fsToggle').onclick = () => { if(!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); };
    
    // 7. Tabs
    document.querySelectorAll('.score-tab').forEach(t => t.onclick = () => { document.querySelectorAll('.score-tab').forEach(x => x.classList.remove('active')); t.classList.add('active'); window.loadLeaderboard(t.dataset.tab); });
    
    // 8. Secrets
    let logoClicks = 0; 
    document.getElementById('mainBtn').onclick = () => { 
        logoClicks++; 
        if(logoClicks === 50) { window.unlockAchievement('spammer'); window.showToast("SECRET FOUND", "🤫", "500 Credits"); window.myMoney += 500; window.saveStats(); logoClicks = 0; } 
    };
    let bgClicks = 0; 
    document.addEventListener('click', (e) => { 
        if (e.target.tagName === 'BODY' || e.target.classList.contains('wrap')) { bgClicks++; if(bgClicks === 50) window.unlockAchievement('void_gazer'); } else { bgClicks = 0; } 
    });
    
    // 9. Game Over
    document.getElementById('goRestart').onclick=()=>{ 
        document.getElementById('modalGameOver').classList.remove('active'); 
        if(window.currentGame==='snake')initSnake(); 
        if(window.currentGame==='pong')initPong(); 
        if(window.currentGame==='runner')initRunner(); 
        if(window.currentGame==='geo')initGeometry(); 
        if(window.currentGame==='flappy')initFlappy(); 
        if(window.currentGame==='blackjack'){window.myMoney=1000;initBJ();document.getElementById('overlayBlackjack').classList.add('active');} 
    };
    document.getElementById('goExit').onclick=()=>{ window.closeOverlays(); document.getElementById('modalGameOver').classList.remove('active'); };
};
