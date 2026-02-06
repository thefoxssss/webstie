// WebRTC-based voice chat, backed by Firestore for signaling.
import { firebase, state, showToast } from "./core.js";

const {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  deleteDoc,
  getDocs,
} = firebase;

let pc = null;
let localStream = null;
let remoteStream = null;
let unsubRoom = null;
let unsubHostCandidates = null;
let unsubGuestCandidates = null;
let currentChannel = null;
let isHost = false;
let muted = false;

// Minimal ICE server list for NAT traversal.
const ICE_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// Resolve the Firestore document for a specific voice channel.
function channelRef(channel) {
  return doc(firebase.db, "gooner_voice_channels", channel);
}

// Reference for candidate ICE sub-collection by role.
function candidatesRef(channel, role) {
  return collection(firebase.db, "gooner_voice_channels", channel, `${role}Candidates`);
}

// Update the voice chat status label + data attribute.
function setStatus(text) {
  const statusEl = document.getElementById("voiceStatus");
  if (statusEl) {
    statusEl.innerText = text;
    statusEl.dataset.state = text.toLowerCase().replace(/[^a-z]+/g, " ").trim();
  }
}

// Remove all ICE candidates for the given channel/role.
async function clearCandidates(channel, role) {
  const snapshot = await getDocs(candidatesRef(channel, role));
  await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
}

// Clear a channel state so a new host can initialize.
async function resetChannel(channel) {
  await setDoc(channelRef(channel), {
    hostUid: null,
    offer: null,
    answer: null,
    updatedAt: Date.now(),
  });
  await Promise.all([clearCandidates(channel, "host"), clearCandidates(channel, "guest")]);
}

// Create a peer connection, wiring tracks + ICE handling.
async function createPeerConnection() {
  pc = new RTCPeerConnection(ICE_CONFIG);
  remoteStream = new MediaStream();
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
    const audioEl = document.getElementById("voiceRemote");
    if (audioEl) {
      audioEl.srcObject = remoteStream;
      audioEl.play().catch(() => {
        showToast("CLICK TO ENABLE AUDIO", "⚠️");
      });
    }
  };
  pc.onconnectionstatechange = () => {
    if (!pc) return;
    if (pc.connectionState === "connected") setStatus("LIVE");
    if (pc.connectionState === "disconnected") setStatus("RECONNECTING");
    if (pc.connectionState === "failed") setStatus("FAILED");
  };
  pc.oniceconnectionstatechange = () => {
    if (!pc) return;
    if (pc.iceConnectionState === "checking") setStatus("CONNECTING");
    if (pc.iceConnectionState === "disconnected") setStatus("RECONNECTING");
  };
  pc.onicecandidate = async (event) => {
    if (!event.candidate || !currentChannel) return;
    const role = isHost ? "host" : "guest";
    await addDoc(candidatesRef(currentChannel, role), event.candidate.toJSON());
  };
  if (!localStream) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      setStatus("MIC BLOCKED");
      showToast("MIC ACCESS REQUIRED", "⚠️");
      throw error;
    }
  }
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
}

// Join a channel as host or guest depending on existing offer state.
async function joinChannel(channel) {
  if (!state.myUid) {
    showToast("LOGIN REQUIRED", "⚠️");
    return;
  }
  await leaveChannel();
  currentChannel = channel;
  setStatus("CONNECTING");
  const ref = channelRef(channel);
  const snap = await getDoc(ref);
  const data = snap.data();
  if (!snap.exists() || !data?.offer || !data?.hostUid) {
    isHost = true;
    await resetChannel(channel);
    await createPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await setDoc(ref, {
      hostUid: state.myUid,
      offer: offer.toJSON(),
      answer: null,
      updatedAt: Date.now(),
    });
    unsubRoom = onSnapshot(ref, async (docSnap) => {
      const room = docSnap.data();
      if (room?.answer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(room.answer));
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
    if (!data.offer || data.answer) {
      showToast("VOICE BUSY", "⚠️");
      setStatus("BUSY");
      currentChannel = null;
      return;
    }
    isHost = false;
    await clearCandidates(channel, "guest");
    await createPeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await updateDoc(ref, { answer: answer.toJSON(), updatedAt: Date.now() });
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

// Leave a channel and tear down local/remote streams.
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
    await resetChannel(currentChannel);
  } else if (currentChannel) {
    await clearCandidates(currentChannel, "guest");
  }
  currentChannel = null;
  isHost = false;
  setStatus("OFFLINE");
}

// Toggle local microphone track enablement.
function toggleMute() {
  muted = !muted;
  if (localStream) {
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }
  const muteBtn = document.getElementById("voiceMuteBtn");
  if (muteBtn) {
    muteBtn.innerText = muted ? "UNMUTE" : "MUTE";
    muteBtn.classList.toggle("active", muted);
  }
}

// Wire up buttons for channel selection, leave, and mute.
export function initVoiceChat() {
  const channelButtons = document.querySelectorAll(".voice-btn");
  channelButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      channelButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      try {
        await joinChannel(btn.dataset.channel);
      } catch (error) {
        channelButtons.forEach((b) => b.classList.remove("active"));
      }
    });
  });
  const leaveBtn = document.getElementById("voiceLeaveBtn");
  if (leaveBtn) {
    leaveBtn.addEventListener("click", async () => {
      await leaveChannel();
      channelButtons.forEach((b) => b.classList.remove("active"));
    });
  }
  const muteBtn = document.getElementById("voiceMuteBtn");
  if (muteBtn) muteBtn.addEventListener("click", toggleMute);
  const closeBtn = document.getElementById("chatCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", leaveChannel);
  window.addEventListener("beforeunload", leaveChannel);
  setStatus("OFFLINE");
}
