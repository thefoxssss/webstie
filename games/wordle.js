import { registerGameStop, setText, showToast, state, saveStats, playSuccessSound, beep } from "../core.js";

const WORDS = ["ABOUT", "ALERT", "ARGUE", "BEACH", "BEGIN", "BLACK", "BOARD", "BRAIN", "BREAD", "BREAK", "BROWN", "BUILD", "BUYER", "CARRY", "CATCH", "CAUSE", "CHAIN", "CHAIR", "CHART", "CHIEF", "CHILD", "CHINA", "CLAIM", "CLASS", "CLEAN", "CLEAR", "CLICK", "CLOCK", "CLOSE", "COACH", "COAST", "COUNT", "COURT", "COVER", "CRAZY", "CREAM", "CRIME", "CROSS", "CROWD", "CROWN", "DANCE", "DEATH", "DELAY", "DEPTH", "DOUBT", "DRAFT", "DRAMA", "DREAM", "DRESS", "DRINK", "DRIVE", "EARTH", "EIGHT", "EMPTY", "ENEMY", "ENTRY", "ERROR", "EVENT", "EXACT", "EXIST", "EXTRA", "FAITH", "FALSE", "FAULT", "FIELD", "FIGHT", "FINAL", "FIRST", "FIXED", "FLASH", "FLEET", "FLOOR", "FLUID", "FOCUS", "FORCE", "FORUM", "FOUND", "FRAME", "FRANK", "FRAUD", "FRESH", "FRONT", "FRUIT", "FULLY", "FUNNY", "GIANT", "GIVEN", "GLASS", "GLOBE", "GOING", "GRACE", "GRADE", "GRAND", "GRANT", "GRASS", "GREAT", "GREEN", "GROSS", "GROUP", "GROWN", "GUARD", "GUESS", "GUEST", "GUIDE", "HAPPY", "HARRY", "HEART", "HEAVY", "HELLO", "HORSE", "HOTEL", "HOUSE", "HUMAN", "IDEAL", "IMAGE", "INDEX", "INNER", "INPUT", "ISSUE", "JAPAN", "JOINT", "JONES", "JUDGE", "KNOWN", "LABEL", "LARGE", "LASER", "LATER", "LAUGH", "LAYER", "LEARN", "LEASE", "LEAST", "LEAVE", "LEGAL", "LEVEL", "LEWIS", "LIGHT", "LIMIT", "LINKS", "LIVES", "LOCAL", "LOGIC", "LOOSE", "LOWER", "LUCKY", "MAGIC", "MAJOR", "MAKER", "MARCH", "MATCH", "MAYOR", "MEANT", "MEDIA", "METAL", "MIGHT", "MINOR", "MINUS", "MIXED", "MODEL", "MONEY", "MONTH", "MORAL", "MOTOR", "MOUNT", "MOUSE", "MOUTH", "MOVIE", "MUSIC", "NEEDS", "NEVER", "NIGHT", "NOISE", "NORTH", "NOVEL", "NURSE", "OCCUR", "OCEAN", "OFFER", "OFTEN", "ORDER", "OTHER", "OUGHT", "PAINT", "PANEL", "PAPER", "PARTY", "PEACE", "PETER", "PHASE", "PHONE", "PHOTO", "PIECE", "PILOT", "PITCH", "PLACE", "PLAIN", "PLANE", "PLANT", "PLATE", "POINT", "POUND", "POWER", "PRESS", "PRICE", "PRIDE", "PRIME", "PRINT", "PRIOR", "PRIZE", "PROOF", "PROUD", "PROVE", "QUEEN", "QUICK", "QUIET", "QUITE", "RADIO", "RAISE", "RANGE", "RAPID", "RATIO", "REACH", "READY", "REFER", "RIGHT", "RIVAL", "RIVER", "ROBIN", "ROUGH", "ROUND", "ROUTE", "ROYAL", "RURAL", "SCALE", "SCENE", "SCOPE", "SCORE", "SENSE", "SERVE", "SEVEN", "SHALL", "SHAPE", "SHARE", "SHARP", "SHEET", "SHIFT", "SHIRT", "SHOCK", "SHOOT", "SHORT", "SHOWN", "SIGHT", "SIMON", "SIXTH", "SKILL", "SLEEP", "SMALL", "SMART", "SMILE", "SMITH", "SMOKE", "SOLID", "SOLVE", "SORRY", "SOUND", "SOUTH", "SPACE", "SPARE", "SPEAK", "SPEED", "SPEND", "SPLIT", "SPOKE", "SPORT", "STAFF", "STAGE", "STAND", "START", "STATE", "STEAM", "STEEL", "STICK", "STILL", "STOCK", "STONE", "STORE", "STORM", "STORY", "STRIP", "STUDY", "STUFF", "STYLE", "SUGAR", "SUPER", "SWEET", "TABLE", "TASTE", "TEACH", "TERRY", "TEXAS", "THANK", "THEFT", "THEIR", "THEME", "THERE", "THESE", "THICK", "THING", "THINK", "THIRD", "THOSE", "THREE", "THROW", "TIGHT", "TITLE", "TODAY", "TOPIC", "TOTAL", "TOUCH", "TOUGH", "TOWER", "TRACK", "TRADE", "TRAIN", "TREAT", "TREND", "TRIAL", "TRUST", "TRUTH", "TWICE", "UNDER", "UNDUE", "UNION", "UNITY", "UNTIL", "UPPER", "UPSET", "URBAN", "USAGE", "USUAL", "VALID", "VALUE", "VIDEO", "VIRUS", "VISIT", "VITAL", "VOICE", "WASTE", "WATCH", "WATER", "WHEEL", "WHERE", "WHICH", "WHILE", "WHITE", "WHOLE", "WHOSE", "WOMAN", "WOMEN", "WORLD", "WORRY", "WORSE", "WORST", "WORTH", "WOULD", "WOUND", "WRITE", "WRONG", "YIELD", "YOUNG", "YOUTH"];

let targetWord = "";
let currentGuess = "";
let guesses = [];
let gameFinished = false;
let keyStates = {}; // 'correct', 'present', 'absent'

// Default stats
const DEFAULT_STATS = {
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: [0, 0, 0, 0, 0, 0]
};

// Start a new game
export function initWordle() {
  state.currentGame = "wordle";
  startNewGame();

  // Attach keyboard event listener
  document.addEventListener('keydown', handleKeyDown);

  registerGameStop(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });
}

function getWordleStats() {
  if (!state.myStats.wordle) {
    state.myStats.wordle = JSON.parse(JSON.stringify(DEFAULT_STATS));
  }
  return state.myStats.wordle;
}

function updateAndSaveStats(won, numGuesses) {
  const stats = getWordleStats();
  stats.played += 1;
  if (won) {
    stats.wins += 1;
    stats.currentStreak += 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    stats.guessDistribution[numGuesses - 1] += 1;
  } else {
    stats.currentStreak = 0;
  }
  saveStats();
  updateStatsUI();
}

function startNewGame() {
  targetWord = WORDS[Math.floor(Math.random() * WORDS.length)];
  currentGuess = "";
  guesses = [];
  gameFinished = false;
  keyStates = {};

  updateGrid();
  updateKeyboard();
  document.getElementById('wordleStatsModal').style.display = 'none';
  setText('wordleStatus', 'GUESS THE WORD');
}

window.startNewWordleGame = startNewGame;
window.showWordleStats = () => {
    updateStatsUI();
    document.getElementById('wordleStatsModal').style.display = 'flex';
};
window.closeWordleStats = () => {
    document.getElementById('wordleStatsModal').style.display = 'none';
};

window.handleWordleKeyClick = (key) => {
    if (gameFinished) return;

    if (key === 'ENTER') {
        submitGuess();
    } else if (key === 'BACKSPACE') {
        if (currentGuess.length > 0) {
            currentGuess = currentGuess.slice(0, -1);
            updateGrid();
            beep(200, "sine", 0.05);
        }
    } else {
        if (currentGuess.length < 5) {
            currentGuess += key;
            updateGrid();
            beep(300, "sine", 0.05);
        }
    }
};

function handleKeyDown(e) {
    if (gameFinished) return;
    if (state.currentGame !== "wordle") return;

    // Ignore keypresses if typing in an input
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

    if (e.key === 'Enter') {
        submitGuess();
    } else if (e.key === 'Backspace') {
        if (currentGuess.length > 0) {
            currentGuess = currentGuess.slice(0, -1);
            updateGrid();
            beep(200, "sine", 0.05);
        }
    } else if (/^[A-Za-z]$/.test(e.key)) {
        if (currentGuess.length < 5) {
            currentGuess += e.key.toUpperCase();
            updateGrid();
            beep(300, "sine", 0.05);
        }
    }
}

function submitGuess() {
    if (currentGuess.length !== 5) {
        showToast("TOO SHORT", "⚠️");
        return;
    }

    if (!WORDS.includes(currentGuess)) {
        showToast("NOT IN WORD LIST", "⚠️");
        return;
    }

    guesses.push(currentGuess);

    // Update key states
    const targetLetters = targetWord.split('');
    const guessLetters = currentGuess.split('');

    // First pass: find exact matches
    guessLetters.forEach((letter, i) => {
        if (letter === targetLetters[i]) {
            keyStates[letter] = 'correct';
            targetLetters[i] = null; // Mark as used
        }
    });

    // Second pass: find present letters
    guessLetters.forEach((letter, i) => {
        if (letter !== targetWord[i]) {
            if (targetLetters.includes(letter)) {
                if (keyStates[letter] !== 'correct') {
                    keyStates[letter] = 'present';
                }
                targetLetters[targetLetters.indexOf(letter)] = null; // Mark as used
            } else {
                if (keyStates[letter] !== 'correct' && keyStates[letter] !== 'present') {
                    keyStates[letter] = 'absent';
                }
            }
        }
    });

    currentGuess = "";
    updateGrid();
    updateKeyboard();

    const lastGuess = guesses[guesses.length - 1];
    if (lastGuess === targetWord) {
        gameFinished = true;
        setText('wordleStatus', 'ACCESS GRANTED');
        playSuccessSound();
        updateAndSaveStats(true, guesses.length);
        setTimeout(() => {
            window.showWordleStats();
        }, 1500);
    } else if (guesses.length >= 6) {
        gameFinished = true;
        setText('wordleStatus', `TRACE FAILED — WORD: ${targetWord}`);
        updateAndSaveStats(false, guesses.length);
        setTimeout(() => {
            window.showWordleStats();
        }, 1500);
    }
}

function updateGrid() {
    const grid = document.getElementById('wordleGrid');
    if (!grid) return;

    grid.innerHTML = '';

    for (let row = 0; row < 6; row++) {
        const word = row < guesses.length ? guesses[row] : (row === guesses.length ? currentGuess : "");
        const rowDiv = document.createElement('div');
        rowDiv.className = 'wordle-row';

        const targetLetters = targetWord.split('');
        const guessStates = [];

        if (row < guesses.length) {
            const guessLetters = word.split('');
            // Pre-calculate states for this row
            guessLetters.forEach((l, i) => {
                if (l === targetLetters[i]) {
                    guessStates[i] = 'correct';
                    targetLetters[i] = null;
                }
            });
            guessLetters.forEach((l, i) => {
                if (!guessStates[i]) {
                    if (targetLetters.includes(l)) {
                        guessStates[i] = 'present';
                        targetLetters[targetLetters.indexOf(l)] = null;
                    } else {
                        guessStates[i] = 'absent';
                    }
                }
            });
        }

        for (let col = 0; col < 5; col++) {
            const cell = document.createElement('div');
            cell.className = 'wordle-cell';
            const letter = word[col] || "";
            cell.innerText = letter;

            if (letter) {
                 cell.classList.add('filled');
            }

            if (row < guesses.length) {
                cell.classList.add(guessStates[col]);
                // Add a small delay for animation effect
                cell.style.animationDelay = `${col * 0.1}s`;
                cell.classList.add('flip');
            }

            rowDiv.appendChild(cell);
        }
        grid.appendChild(rowDiv);
    }
}

function updateKeyboard() {
    const keys = document.querySelectorAll('.wordle-key');
    keys.forEach(key => {
        const letter = key.dataset.key;
        const stateClass = keyStates[letter];
        key.className = stateClass ? `wordle-key ${stateClass}` : 'wordle-key';
    });
}

function updateStatsUI() {
    const stats = getWordleStats();
    setText('wordleStatPlayed', stats.played);

    const winPct = stats.played === 0 ? 0 : Math.round((stats.wins / stats.played) * 100);
    setText('wordleStatWinPct', winPct);

    setText('wordleStatStreak', stats.currentStreak);
    setText('wordleStatMaxStreak', stats.maxStreak);

    const distContainer = document.getElementById('wordleGuessDist');
    if (distContainer) {
        distContainer.innerHTML = '';
        const maxDist = Math.max(...stats.guessDistribution, 1);

        stats.guessDistribution.forEach((count, i) => {
            const row = document.createElement('div');
            row.className = 'wordle-dist-row';

            const num = document.createElement('div');
            num.className = 'wordle-dist-num';
            num.innerText = i + 1;

            const barContainer = document.createElement('div');
            barContainer.className = 'wordle-dist-bar-container';

            const bar = document.createElement('div');
            bar.className = `wordle-dist-bar ${count > 0 ? 'active' : ''}`;
            const width = Math.max(5, (count / maxDist) * 100);
            bar.style.width = `${width}%`;
            bar.innerText = count;

            barContainer.appendChild(bar);
            row.appendChild(num);
            row.appendChild(barContainer);
            distContainer.appendChild(row);
        });
    }
}
