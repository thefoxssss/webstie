import { db } from '../config.js';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { setText } from '../utils.js';

let tttUnsub;
let mySide = null;

export function initTTT(System) {
    document.getElementById('tttMenu').style.display='flex';
    document.getElementById('tttLobby').style.display='none';
    document.getElementById('tttGame').style.display='none';
    
    // Bind Buttons (These need to be rebound here or in main)
    document.getElementById('btnCreateTTT').onclick = () => createRoom(System);
    document.getElementById('btnJoinTTT').onclick = () => joinRoom(System);
    document.getElementById('tttStartBtn').onclick = startGame;
    document.getElementById('tttGrid').onclick = (e) => handleGridClick(e, System);
}

export function cleanupTTT() {
    if(tttUnsub) tttUnsub();
    tttUnsub = null;
    mySide = null;
}

function getTTTRef(c){ return doc(db,'gooner_terminal_rooms',c); }

async function createRoom(System) {
    if(!System.uid) return alert("Offline");
    const c = Math.floor(1000+Math.random()*9000).toString();
    await setDoc(getTTTRef(c), {
        board: Array(9).fill(null),
        turn: 'X',
        players: { X: System.uid, O: null },
        names: { X: System.name, O: "..." },
        status: 'lobby'
    });
    subscribeTTT(c, 'X');
}

async function joinRoom(System) {
    const c = document.getElementById('joinTTTCode').value;
    const ref = getTTTRef(c);
    const s = await getDoc(ref);
    if(!s.exists()) return alert("404");
    
    if(!s.data().players.O){
        await updateDoc(ref,{ ['players.O']: System.uid, ['names.O']: System.name });
        subscribeTTT(c, 'O');
    }
}

function subscribeTTT(c, side) {
    mySide = side;
    document.getElementById('tttMenu').style.display='none';
    document.getElementById('tttLobby').style.display='flex';
    setText('tttRoomId', c);
    
    if(tttUnsub) tttUnsub();
    
    tttUnsub = onSnapshot(getTTTRef(c), d => {
        if(!d.exists()) return;
        const data = d.data();
        
        if(data.status==='lobby'){
            document.getElementById('tttPList').innerHTML = `<div>X: ${data.names.X}</div><div>O: ${data.names.O}</div>`;
            if(side==='X' && data.players.O){
                document.getElementById('tttStartBtn').style.display='block';
                setText('tttWait', "READY");
            } else {
                document.getElementById('tttStartBtn').style.display='none';
                setText('tttWait', "WAITING...");
            }
        } else {
            document.getElementById('tttLobby').style.display='none';
            document.getElementById('tttGame').style.display='block';
            
            const cells = document.getElementById('tttGrid').children;
            data.board.forEach((v,i) => {
                cells[i].innerText = v || '';
                cells[i].style.color = v==='X'?'red':'#fff';
            });
            
            setText('tttStatus', data.status==='finished' ? "GAME OVER" : (data.turn===side ? "YOUR TURN" : "OPPONENT TURN"));
            
            if(data.status==='finished' && side==='X'){
                const btn = document.getElementById('tttReplay');
                btn.style.display='block';
                btn.onclick = async () => {
                    await updateDoc(getTTTRef(c), { board:Array(9).fill(null), turn:'X', status:'playing' });
                };
            } else {
                document.getElementById('tttReplay').style.display='none';
            }
        }
    });
}

async function startGame() {
    await updateDoc(getTTTRef(document.getElementById('tttRoomId').innerText), {status:'playing'});
}

async function handleGridClick(e, System) {
    const i = e.target.dataset.i;
    if(!i || !mySide) return;
    
    await runTransaction(db, async(t) => {
        const r = getTTTRef(document.getElementById('tttRoomId').innerText);
        const s = await t.get(r);
        if(!s.exists()) return;
        const d = s.data();
        
        if(d.turn !== mySide || d.board[i] || d.status !== 'playing') return;
        
        const nb = [...d.board];
        nb[i] = mySide;
        
        let w = null;
        [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].forEach(k => {
            if(nb[k[0]] && nb[k[0]]===nb[k[1]] && nb[k[0]]===nb[k[2]]) w = nb[k[0]];
        });
        
        t.update(r, {
            board: nb,
            turn: mySide === 'X' ? 'O' : 'X',
            status: (w || !nb.includes(null)) ? 'finished' : 'playing'
        });
    });
}
