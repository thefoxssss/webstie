import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, onSnapshot, runTransaction, query, orderBy, limit, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, signInAnonymously, onAuthStateChanged, collection, doc, setDoc, getDoc, updateDoc, onSnapshot, runTransaction, query, orderBy, limit, addDoc };
