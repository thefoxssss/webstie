/* voice.js - Voice Chat Logic */

// CONFIGURATION
const PEER_CONFIG = {
    host: '0.peerjs.com',
    port: 443,
    path: '/'
};

let peer;
let myStream;
let isMuted = false;
let myName = 'Me (You)';
let peerPollTimer;
const knownPeers = new Set();

// 1. THE TRIGGER: User clicks "Join Voice"
async function joinVoiceChannel() {
    try {
        console.log("Requesting Microphone Access...");
        
        myName = localStorage.getItem('goonerUser') || myName;
        // --- THIS IS THE PERMISSION REQUEST ---
        // The browser will pop up a dialog asking the user to "Allow" microphone.
        myStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        
        // If allowed, we proceed:
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('connected-screen').classList.remove('hidden');
        
        // Initialize the connection
        initPeerConnection();
        
        // Add myself to the list
        addUserToUI(myName, true);
        
    } catch (err) {
        // If they click "Block" or don't have a mic
        console.error("Mic Access Denied:", err);
        alert("ACCESS DENIED: Microphone permission is required to enter the terminal voice channel.");
    }
}

// 2. CONNECT TO SERVER
function initPeerConnection() {
    const myId = `${myName}-${Math.floor(Math.random() * 1000)}`; 
    
    // Connect to PeerJS cloud
    peer = new Peer(myId, PEER_CONFIG);

    peer.on('open', (id) => {
        document.getElementById('status-text').innerText = "Connected";
        document.getElementById('status-text').style.color = "#0f0";
        startPeerDiscovery(id);
    });

    // When someone calls us, answer automatically
    peer.on('call', (call) => {
        call.answer(myStream);
        handleCall(call);
    });
}

function startPeerDiscovery(selfId) {
    if (!peer.listAllPeers) {
        document.getElementById('status-text').innerText = "Connected (No Peer List)";
        return;
    }
    if (peerPollTimer) clearInterval(peerPollTimer);
    peerPollTimer = setInterval(() => {
        peer.listAllPeers((peers) => {
            const activePeers = peers.filter((p) => p && p !== selfId);
            syncPeerList(activePeers);
            activePeers.forEach((peerId) => {
                if (knownPeers.has(peerId)) return;
                knownPeers.add(peerId);
                const call = peer.call(peerId, myStream);
                handleCall(call);
            });
        });
    }, 2000);
}

function syncPeerList(peerIds) {
    const list = document.getElementById('user-list');
    if (!list) return;
    const nextIds = new Set(peerIds);
    [...knownPeers].forEach((peerId) => {
        if (!nextIds.has(peerId)) {
            const safeId = peerId.replace(/[^a-zA-Z0-9_-]/g, '');
            const row = document.getElementById(`user-${safeId}`);
            if (row) row.remove();
            knownPeers.delete(peerId);
        }
    });
}

// 3. HANDLE INCOMING AUDIO
function handleCall(call) {
    call.on('stream', (remoteStream) => {
        // If user isn't in the list, add them
        const safeId = call.peer.replace(/[^a-zA-Z0-9_-]/g, '');
        if (!document.getElementById(`user-${safeId}`)) {
            addUserToUI(call.peer, false, remoteStream);
        }
    });
}

// 4. UI: Add User to List
function addUserToUI(name, isLocal, stream = null) {
    const list = document.getElementById('user-list');
    
    const div = document.createElement('div');
    div.className = 'user-row';
    div.id = isLocal ? 'user-local' : `user-${name.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    
    // Create the visual structure
    div.innerHTML = `
        <div class="user-avatar" id="avatar-${name.replace(/[^a-zA-Z0-9_-]/g, '')}"></div>
        <div class="user-name">${name}</div>
    `;
    
    list.appendChild(div);

    // Setup the "Green Light" visualizer
    const targetStream = isLocal ? myStream : stream;
    if (targetStream) {
        setupVoiceVisualizer(targetStream, document.getElementById(`avatar-${name.replace(/[^a-zA-Z0-9_-]/g, '')}`));
    }

    // If it's a remote user, we need an invisible <audio> tag to actually hear them
    if (!isLocal && stream) {
        const audio = document.createElement('audio');
        audio.srcObject = stream;
        audio.play();
        div.appendChild(audio);
    }
}

// 5. VISUALIZER (Makes the green circle flash)
function setupVoiceVisualizer(stream, element) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const checkVolume = () => {
        if (!stream.active) return;
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        let average = sum / dataArray.length;

        // If volume is loud enough, add "speaking" class
        if (average > 10) {
            element.parentElement.classList.add('speaking');
        } else {
            element.parentElement.classList.remove('speaking');
        }
        requestAnimationFrame(checkVolume);
    };
    checkVolume();
}

// 6. CONTROLS
function toggleMute() {
    if (!myStream) return;
    isMuted = !isMuted;
    myStream.getAudioTracks()[0].enabled = !isMuted;
    
    const btn = document.getElementById('btn-mute');
    btn.innerText = isMuted ? "UNMUTE" : "MUTE";
    btn.style.color = isMuted ? "red" : "#0f0";
}

function leaveVoice() {
    if (peer) peer.destroy();
    if (myStream) myStream.getTracks().forEach(track => track.stop());
    if (peerPollTimer) clearInterval(peerPollTimer);
    knownPeers.clear();
    location.reload(); // Simple way to reset everything
import { firebase, state, showToast } from "./core.js";

const { doc, setDoc, getDoc, updateDoc, onSnapshot, collection, addDoc } = firebase;

let pc = null;
let localStream = null;
let remoteStream = null;
let unsubRoom = null;
let unsubHostCandidates = null;
let unsubGuestCandidates = null;
let currentChannel = null;
let isHost = false;
let muted = false;

const ICE_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

function channelRef(channel) {
  return doc(firebase.db, "gooner_voice_channels", channel);
}

function candidatesRef(channel, role) {
  return collection(firebase.db, "gooner_voice_channels", channel, `${role}Candidates`);
}

function setStatus(text) {
  const statusEl = document.getElementById("voiceStatus");
  if (statusEl) statusEl.innerText = text;
}

async function createPeerConnection() {
  pc = new RTCPeerConnection(ICE_CONFIG);
  remoteStream = new MediaStream();
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
    const audioEl = document.getElementById("voiceRemote");
    if (audioEl) audioEl.srcObject = remoteStream;
  };
  pc.onicecandidate = async (event) => {
    if (!event.candidate || !currentChannel) return;
    const role = isHost ? "host" : "guest";
    await addDoc(candidatesRef(currentChannel, role), event.candidate.toJSON());
  };
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
}

async function joinChannel(channel) {
  if (!state.myUid) {
    showToast("LOGIN REQUIRED", "⚠️");
    return;
  }
  await leaveChannel();
  currentChannel = channel;
  setStatus("CONNECTING...");
  const ref = channelRef(channel);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    isHost = true;
    await createPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await setDoc(ref, { hostUid: state.myUid, offer: offer.toJSON(), answer: null });
    unsubRoom = onSnapshot(ref, async (docSnap) => {
      const data = docSnap.data();
      if (data?.answer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        setStatus("LIVE");
      }
    });
    unsubGuestCandidates = onSnapshot(candidatesRef(channel, "guest"), (snapCandidates) => {
      snapCandidates.docChanges().forEach((change) => {
        if (change.type === "added") {
          pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    });
  } else {
    const data = snap.data();
    if (!data.offer) {
      showToast("VOICE BUSY", "⚠️");
      setStatus("OFFLINE");
      currentChannel = null;
      return;
    }
    isHost = false;
    await createPeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await updateDoc(ref, { answer: answer.toJSON() });
    setStatus("LIVE");
    unsubHostCandidates = onSnapshot(candidatesRef(channel, "host"), (snapCandidates) => {
      snapCandidates.docChanges().forEach((change) => {
        if (change.type === "added") {
          pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    });
  }
}

async function leaveChannel() {
  if (unsubRoom) unsubRoom();
  if (unsubHostCandidates) unsubHostCandidates();
  if (unsubGuestCandidates) unsubGuestCandidates();
  unsubRoom = null;
  unsubHostCandidates = null;
  unsubGuestCandidates = null;
  if (pc) {
    pc.close();
    pc = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
  if (remoteStream) {
    remoteStream.getTracks().forEach((track) => track.stop());
    remoteStream = null;
  }
  if (currentChannel && isHost) {
    await setDoc(channelRef(currentChannel), { hostUid: null, offer: null, answer: null });
  }
  currentChannel = null;
  isHost = false;
  setStatus("OFFLINE");
}

function toggleMute() {
  muted = !muted;
  if (localStream) {
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }
  const muteBtn = document.getElementById("voiceMuteBtn");
  if (muteBtn) muteBtn.innerText = muted ? "UNMUTE" : "MUTE";
}

export function initVoiceChat() {
  const channelButtons = document.querySelectorAll(".voice-btn");
  channelButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      channelButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      await joinChannel(btn.dataset.channel);
    });
  });
  const leaveBtn = document.getElementById("voiceLeaveBtn");
  if (leaveBtn) leaveBtn.addEventListener("click", leaveChannel);
  const muteBtn = document.getElementById("voiceMuteBtn");
  if (muteBtn) muteBtn.addEventListener("click", toggleMute);
  const closeBtn = document.getElementById("chatCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", leaveChannel);
  setStatus("OFFLINE");
}
