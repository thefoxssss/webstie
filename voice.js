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

// 1. THE TRIGGER: User clicks "Join Voice"
async function joinVoiceChannel() {
    try {
        console.log("Requesting Microphone Access...");
        
        // --- THIS IS THE PERMISSION REQUEST ---
        // The browser will pop up a dialog asking the user to "Allow" microphone.
        myStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        
        // If allowed, we proceed:
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('connected-screen').classList.remove('hidden');
        
        // Initialize the connection
        initPeerConnection();
        
        // Add myself to the list
        addUserToUI('Me (You)', true);
        
    } catch (err) {
        // If they click "Block" or don't have a mic
        console.error("Mic Access Denied:", err);
        alert("ACCESS DENIED: Microphone permission is required to enter the terminal voice channel.");
    }
}

// 2. CONNECT TO SERVER
function initPeerConnection() {
    const myId = "User-" + Math.floor(Math.random() * 1000); 
    
    // Connect to PeerJS cloud
    peer = new Peer(myId, PEER_CONFIG);

    peer.on('open', (id) => {
        document.getElementById('status-text').innerText = "Connected";
        document.getElementById('status-text').style.color = "#0f0";
    });

    // When someone calls us, answer automatically
    peer.on('call', (call) => {
        call.answer(myStream);
        handleCall(call);
    });
}

// 3. HANDLE INCOMING AUDIO
function handleCall(call) {
    call.on('stream', (remoteStream) => {
        // If user isn't in the list, add them
        if (!document.getElementById(`user-${call.peer}`)) {
            addUserToUI(call.peer, false, remoteStream);
        }
    });
}

// 4. UI: Add User to List
function addUserToUI(name, isLocal, stream = null) {
    const list = document.getElementById('user-list');
    
    const div = document.createElement('div');
    div.className = 'user-row';
    div.id = isLocal ? 'user-local' : `user-${name}`;
    
    // Create the visual structure
    div.innerHTML = `
        <div class="user-avatar" id="avatar-${name}"></div>
        <div class="user-name">${name}</div>
    `;
    
    list.appendChild(div);

    // Setup the "Green Light" visualizer
    const targetStream = isLocal ? myStream : stream;
    if (targetStream) {
        setupVoiceVisualizer(targetStream, document.getElementById(`avatar-${name}`));
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
    location.reload(); // Simple way to reset everything
}
