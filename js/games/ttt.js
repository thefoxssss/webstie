import { db, doc, setDoc, getDoc, updateDoc, runTransaction, onSnapshot } from '../firebase.js';

// === TIC TAC TOE ===
let tttUnsub; 
function getTTTRef(c){return doc(db,'gooner_terminal_rooms',c);}

export function initTTT() { window.currentGame = 'ttt'; }
export function cleanupTTT() { if(tttUnsub) tttUnsub(); tttUnsub=null; }

document.getElementById('btnCreateTTT').onclick=async()=>{if(!window.myUid)return alert("Offline");const c=Math.floor(1000+Math.random()*9000).toString();await setDoc(getTTTRef(c),{board:Array(9).fill(null),turn:'X',players:{X:window.myUid,O:null},names:{X:window.myName,O:"..."},status:'lobby'});joinTTT(c,'X');};
document.getElementById('btnJoinTTT').onclick=async()=>{const c=document.getElementById('joinTTTCode').value,ref=getTTTRef(c),s=await getDoc(ref);if(!s.exists())return alert("404");if(!s.data().players.O){await updateDoc(ref,{['players.O']:window.myUid,['names.O']:window.myName});joinTTT(c,'O');}};

function joinTTT(c,side){
    document.getElementById('tttMenu').style.display='none';document.getElementById('tttLobby').style.display='flex';window.setText('tttRoomId', c);
    if(tttUnsub)tttUnsub();
    tttUnsub=onSnapshot(getTTTRef(c),d=>{
        if(!d.exists())return;const data=d.data();
        if(data.status==='lobby'){
            document.getElementById('tttPList').innerHTML=`<div>X: ${data.names.X}</div><div>O: ${data.names.O}</div>`;
            if(side==='X'&&data.players.O){document.getElementById('tttStartBtn').style.display='block';window.setText('tttWait', "READY");}else{document.getElementById('tttStartBtn').style.display='none';window.setText('tttWait', "WAITING...");}
        }else{
            document.getElementById('tttLobby').style.display='none';document.getElementById('tttGame').style.display='block';
            const cells=document.getElementById('tttGrid').children;
            data.board.forEach((v,i)=>{cells[i].innerText=v||'';cells[i].style.color=v==='X'?'red':'#fff';});
            window.setText('tttStatus', data.status==='finished'?"GAME OVER":(data.turn===side?"YOUR TURN":"OPPONENT TURN"));
            if(data.status==='finished'&&side==='X'){
                document.getElementById('tttReplay').style.display='block';
                document.getElementById('tttReplay').onclick=async()=>{await updateDoc(getTTTRef(c),{board:Array(9).fill(null),turn:'X',status:'playing'});};
            }else document.getElementById('tttReplay').style.display='none';
        }
    });
    tttUnsub.side = side;
}

document.getElementById('tttStartBtn').onclick=async()=>{await updateDoc(getTTTRef(document.getElementById('tttRoomId').innerText),{status:'playing'});};
document.getElementById('tttGrid').onclick=async(e)=>{const i=e.target.dataset.i;if(!i)return;await runTransaction(db,async(t)=>{const r=getTTTRef(document.getElementById('tttRoomId').innerText),s=await t.get(r);if(!s.exists())return;const d=s.data();if(d.turn!==tttUnsub.side||d.board[i]||d.status!=='playing')return;const nb=[...d.board];nb[i]=tttUnsub.side;let w=null;[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].forEach(k=>{if(nb[k[0]]&&nb[k[0]]===nb[k[1]]&&nb[k[0]]===nb[k[2]])w=nb[k[0]];});t.update(r,{board:nb,turn:tttUnsub.side==='X'?'O':'X',status:(w||!nb.includes(null))?'finished':'playing'});});};
