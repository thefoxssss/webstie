import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { 
    apiKey: "AIzaSyAoXwDA6KtqSD4yfGprus8C8Mi_--1KwSw", 
    authDomain: "funnys-18ff7.firebaseapp.com", 
    projectId: "funnys-18ff7", 
    storageBucket: "funnys-18ff7.firebasestorage.app", 
    messagingSenderId: "368675604960", 
    appId: "1:368675604960:web:24c5dcd6a5329c9fd94385", 
    measurementId: "G-6PE47RLP8V" 
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Global State Object to replace loose global variables
export const state = {
    myUid: null,
    myName: "ANON",
    myMoney: 1000,
    myStats: { games: 0, wpm: 0, wins: 0 },
    myAchievements: [],
    myInventory: [],
    currentGame: null,
    keysPressed: {},
    audioCtx: new (window.AudioContext || window.webkitAudioContext)(),
    globalVol: 0.5
};

// Achievements Data
export const ACHIEVEMENTS = [
    { id: 'noob', icon: '🐣', title: 'NOOB', desc: 'Played your first game', rarity: 'common', reward: 500 },
    { id: 'diamond_hands', icon: '💎', title: 'DIAMOND HANDS', desc: 'Bank account > $5000', rarity: 'rare', reward: 2500 },
    // ... add rest of achievements
];
