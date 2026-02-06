// Typing speed game that tracks WPM and updates high scores.
import {
  registerGameStop,
  setText,
  saveGlobalScore,
  saveStats,
  unlockAchievement,
  state,
} from "../core.js";

let typeText = "";
let typeIndex = 0;
let typeStartTime = null;
let typeCorrectChars = 0;
let typeInterval;

// Word list used to build randomized typing prompts.
const commonWords = [
  "the",
  "be",
  "to",
  "of",
  "and",
  "a",
  "in",
  "that",
  "have",
  "I",
  "it",
  "for",
  "not",
  "on",
  "with",
  "he",
  "as",
  "you",
  "do",
  "at",
  "this",
  "but",
  "his",
  "by",
  "from",
  "they",
  "we",
  "say",
  "her",
  "she",
  "or",
  "an",
  "will",
  "my",
  "one",
  "all",
  "would",
  "there",
  "their",
  "what",
  "so",
  "up",
  "out",
  "if",
  "about",
  "who",
  "get",
  "which",
  "go",
  "me",
  "when",
  "make",
  "can",
  "like",
  "time",
  "no",
  "just",
  "him",
  "know",
  "take",
  "people",
  "into",
  "year",
  "your",
  "good",
  "some",
  "could",
  "them",
  "see",
  "other",
  "than",
  "then",
  "now",
  "look",
  "only",
  "come",
  "its",
  "over",
  "think",
  "also",
  "back",
  "after",
  "use",
  "two",
  "how",
  "our",
  "work",
  "first",
  "well",
  "way",
  "even",
  "new",
  "want",
  "because",
  "any",
  "these",
  "give",
  "day",
  "most",
  "us",
];

// Initialize typing state, build a new prompt, and focus the input.
export function initTypeGame() {
  state.currentGame = "type";
  typeIndex = 0;
  typeStartTime = null;
  typeCorrectChars = 0;
  if (typeInterval) clearInterval(typeInterval);
  setText("typeTimer", "0");
  setText("typeWPM", "0");
  document.getElementById("typeHiddenInput").value = "";
  document.getElementById("typeHiddenInput").focus();
  typeText = "";
  for (let i = 0; i < 30; i++) {
    typeText += commonWords[Math.floor(Math.random() * commonWords.length)] + " ";
  }
  typeText = typeText.trim();
  renderTypeDisplay();
}

// Render the prompt with per-letter spans for styling.
function renderTypeDisplay() {
  const display = document.getElementById("typeTextBox");
  display.innerHTML = "";
  typeText.split("").forEach((char, idx) => {
    const span = document.createElement("span");
    span.innerText = char;
    span.className = "letter";
    if (idx === typeIndex) span.classList.add("active");
    display.appendChild(span);
  });
}

// Handle text input and score as the player types.
document.getElementById("typeHiddenInput").addEventListener("input", (e) => {
  if (state.currentGame !== "type") return;
  if (!typeStartTime) {
    typeStartTime = Date.now();
    typeInterval = setInterval(() => {
      const elapsedMin = (Date.now() - typeStartTime) / 1000 / 60;
      const wpm = Math.round(typeCorrectChars / 5 / elapsedMin);
      setText("typeTimer", Math.round(elapsedMin * 60));
      if (wpm > 0 && wpm < 300) setText("typeWPM", wpm);
    }, 100);
  }
  if (state.myInventory.includes("item_autotype")) {
    if (Math.random() > 0.1) {
      typeText[typeIndex];
    }
  }
  const inputVal = e.target.value;
  const charTyped = inputVal.charAt(inputVal.length - 1);
  const letters = document.querySelectorAll(".letter");
  if (e.inputType === "deleteContentBackward") {
    if (typeIndex > 0) {
      typeIndex--;
      letters[typeIndex].classList.remove("correct", "incorrect");
      if (letters[typeIndex].innerText === typeText[typeIndex]) typeCorrectChars--;
    }
  } else if (typeIndex < typeText.length) {
    if (charTyped === typeText[typeIndex]) {
      letters[typeIndex].classList.add("correct");
      typeCorrectChars++;
    } else {
      letters[typeIndex].classList.add("incorrect");
    }
    typeIndex++;
  }
  document.querySelectorAll(".letter").forEach((l) => l.classList.remove("active"));
  if (typeIndex < letters.length) letters[typeIndex].classList.add("active");
  if (typeIndex >= typeText.length) {
    clearInterval(typeInterval);
    const elapsedMin = (Date.now() - typeStartTime) / 1000 / 60;
    const wpm = Math.round(typeCorrectChars / 5 / elapsedMin);
    if (wpm > (state.myStats.wpm || 0)) {
      state.myStats = { ...state.myStats, wpm };
      saveStats();
      saveGlobalScore("type", wpm);
    }
    if (wpm >= 80) unlockAchievement("type_god");
    alert("FINISHED! WPM: " + wpm);
    initTypeGame();
  }
});

// Auto-typing bot that completes prompts if the perk is active.
setInterval(() => {
  if (
    state.currentGame === "type" &&
    state.myInventory.includes("item_autotype") &&
    typeText.length > 0
  ) {
    const letters = document.querySelectorAll(".letter");
    if (typeIndex < typeText.length) {
      letters[typeIndex].classList.add("correct");
      typeIndex++;
      typeCorrectChars++;
      document.querySelectorAll(".letter").forEach((l) => l.classList.remove("active"));
      if (typeIndex < letters.length) letters[typeIndex].classList.add("active");
      if (typeIndex >= typeText.length) {
        clearInterval(typeInterval);
        alert("BOT FINISHED!");
        initTypeGame();
      }
    }
  }
}, 150);

// Clear any active intervals when leaving the game.
registerGameStop(() => {
  if (typeInterval) clearInterval(typeInterval);
});
