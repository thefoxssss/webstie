// === TYPE RUNNER ===
let typeText = ""; let typeIndex = 0; let typeStartTime = null; let typeCorrectChars = 0;
const commonWords = ["the","be","to","of","and","a","in","that","have","I","it","for","not","on","with","he","as","you","do","at","this","but","his","by","from","they","we","say","her","she","or","an","will","my","one","all","would","there","their","what","so","up","out","if","about","who","get","which","go","me","when","make","can","like","time","no","just","him","know","take","people","into","year","your","good","some","could","them","see","other","than","then","now","look","only","come","its","over","think","also","back","after","use","two","how","our","work","first","well","way","even","new","want","because","any","these","give","day","most","us"];

window.initTypeGame = () => { 
    window.currentGame = 'type'; typeIndex = 0; typeStartTime = null; typeCorrectChars = 0; 
    if(window.typeInterval) clearInterval(window.typeInterval); 
    window.setText('typeTimer', "0"); window.setText('typeWPM', "0"); 
    document.getElementById('typeHiddenInput').value = ""; document.getElementById('typeHiddenInput').focus(); 
    typeText = ""; for(let i=0; i<30; i++) typeText += commonWords[Math.floor(Math.random() * commonWords.length)] + " "; 
    typeText = typeText.trim(); renderTypeDisplay(); 
};

function renderTypeDisplay() { 
    const display = document.getElementById('typeTextBox'); display.innerHTML = ""; 
    typeText.split('').forEach((char, idx) => { 
        const span = document.createElement('span'); span.innerText = char; span.className = 'letter'; 
        if (idx === typeIndex) span.classList.add('active'); 
        display.appendChild(span); 
    }); 
}

document.getElementById('typeHiddenInput').addEventListener('input', (e) => { 
    if(window.currentGame !== 'type') return; 
    if(!typeStartTime) { 
        typeStartTime = Date.now(); 
        window.typeInterval = setInterval(() => { 
            const elapsedMin = (Date.now() - typeStartTime) / 1000 / 60; 
            const wpm = Math.round((typeCorrectChars / 5) / elapsedMin); 
            window.setText('typeTimer', Math.round(elapsedMin * 60)); 
            if(wpm > 0 && wpm < 300) window.setText('typeWPM', wpm); 
        }, 100); 
    }
    if(window.myInventory.includes('item_autotype')) { if(Math.random() > 0.1) { let char = typeText[typeIndex]; } }
    const inputVal = e.target.value; const charTyped = inputVal.charAt(inputVal.length - 1); 
    const letters = document.querySelectorAll('.letter'); 
    if (e.inputType === "deleteContentBackward") { 
        if(typeIndex > 0) { typeIndex--; letters[typeIndex].classList.remove('correct', 'incorrect'); if(letters[typeIndex].innerText === typeText[typeIndex]) typeCorrectChars--; } 
    } else { 
        if(typeIndex < typeText.length) { 
            if(charTyped === typeText[typeIndex]) { letters[typeIndex].classList.add('correct'); typeCorrectChars++; } 
            else { letters[typeIndex].classList.add('incorrect'); } 
            typeIndex++; 
        } 
    } 
    document.querySelectorAll('.letter').forEach(l => l.classList.remove('active')); 
    if(typeIndex < letters.length) letters[typeIndex].classList.add('active'); 
    if(typeIndex >= typeText.length) { 
        clearInterval(window.typeInterval); 
        const elapsedMin = (Date.now() - typeStartTime) / 1000 / 60; 
        const wpm = Math.round((typeCorrectChars / 5) / elapsedMin); 
        if(wpm > (window.myStats.wpm || 0)) { window.myStats.wpm = wpm; window.saveStats(); window.saveGlobalScore('type', wpm); } 
        if(wpm >= 80) window.unlockAchievement('type_god'); 
        alert("FINISHED! WPM: " + wpm); window.initTypeGame(); 
    } 
});

setInterval(() => { 
    if(window.currentGame === 'type' && window.myInventory.includes('item_autotype') && typeText.length > 0) { 
        const letters = document.querySelectorAll('.letter'); 
        if(typeIndex < typeText.length) { 
            letters[typeIndex].classList.add('correct'); typeIndex++; typeCorrectChars++; 
            document.querySelectorAll('.letter').forEach(l => l.classList.remove('active')); 
            if(typeIndex < letters.length) letters[typeIndex].classList.add('active'); 
            if(typeIndex >= typeText.length) { clearInterval(window.typeInterval); alert("BOT FINISHED!"); window.initTypeGame(); } 
        } 
    } 
}, 150);
