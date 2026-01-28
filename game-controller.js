import { setCurrentGame, getCurrentGame, getKeysPressed, beep, updateHighScore, loadHighScores, saveStats, setText, unlockAchievement, getMyInventory, showToast, getMyMoney, setMyMoney, setLossStreak, getMyStats, setMyStats, renderBadges, updateUI, renderShop, logTransaction, updateBankLog } from './main.js';

export let pAnim, sAnim, rAnim, gAnim, fAnim, typeInterval;

window.openGame = (id) => { 
    window.closeOverlays(); 
    const el = document.getElementById(id); 
    if(el) el.classList.add('active'); 
    if(id==='overlayProfile') renderBadges(); 
    if(id==='overlayShop') renderShop(); 
    if(id==='overlayBank') updateBankLog(); 
};

window.closeOverlays = () => { 
    stopAllGames(); 
    document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active')); 
    document.getElementById('menuDropdown').classList.remove('show'); 
};

window.launchGame = (game) => {
    window.closeOverlays();
    const overlayId = 'overlay' + (game === 'ttt' || game === 'geo' ? game.toUpperCase() : (game.charAt(0).toUpperCase() + game.slice(1)));
    const el = document.getElementById(overlayId); 
    if(el) el.classList.add('active');
    if(game==='pong') window.initPong(); 
    if(game==='snake') window.initSnake(); 
    if(game==='runner') window.initRunner(); 
    if(game==='geo') window.initGeometry(); 
    if(game==='type') window.initTypeGame(); 
    if(game==='blackjack') window.initBJ(); 
    if(game==='ttt') window.initTTT(); 
    if(game==='flappy') window.initFlappy();
    unlockAchievement('noob');
};

export function stopAllGames(){
    if(pAnim) cancelAnimationFrame(pAnim); 
    if(sAnim) clearTimeout(sAnim); 
    if(rAnim) cancelAnimationFrame(rAnim); 
    if(gAnim) cancelAnimationFrame(gAnim); 
    if(fAnim) cancelAnimationFrame(fAnim); 
    if(typeInterval) clearInterval(typeInterval);
    window.cleanupTTT(); 
    window.cleanupBJ(); 
    setCurrentGame(null); 
    window.removeEventListener('keydown', quickRestartListener);
}

export function checkLossStreak() { 
    setLossStreak(1); 
}

function quickRestartListener(e) { 
    if (e.key === ' ' || e.key === 'Enter') { 
        document.getElementById('goRestart').click(); 
        window.removeEventListener('keydown', quickRestartListener); 
    } 
}

window.showGameOver=(g,s)=>{ 
    stopAllGames(); 
    beep(150, 'sawtooth', 0.5); 
    setText('gameOverText', 'SYSTEM_FAILURE: SCORE_' + s); 
    document.getElementById('modalGameOver').classList.add('active'); 
    window.addEventListener('keydown', quickRestartListener); 
};

document.getElementById('goRestart').onclick=()=>{ 
    document.getElementById('modalGameOver').classList.remove('active'); 
    window.removeEventListener('keydown', quickRestartListener); 
    if(getCurrentGame()==='snake') window.initSnake(); 
    if(getCurrentGame()==='pong') window.initPong(); 
    if(getCurrentGame()==='runner') window.initRunner(); 
    if(getCurrentGame()==='geo') window.initGeometry(); 
    if(getCurrentGame()==='flappy') window.initFlappy(); 
    if(getCurrentGame()==='blackjack'){ 
        setMyMoney(1000); 
        updateUI(); 
        window.initBJ(); 
        document.getElementById('overlayBlackjack').classList.add('active');
    } 
};

document.getElementById('goExit').onclick=()=>{ 
    window.closeOverlays(); 
    document.getElementById('modalGameOver').classList.remove('active'); 
};

export { pAnim as getPAnim, sAnim as getSAnim, rAnim as getRAnim, gAnim as getGAnim, fAnim as getFAnim };
export function setPAnim(v) { pAnim = v; }
export function setSAnim(v) { sAnim = v; }
export function setRAnim(v) { rAnim = v; }
export function setGAnim(v) { gAnim = v; }
export function setFAnim(v) { fAnim = v; }
export function setTypeInterval(v) { typeInterval = v; }
