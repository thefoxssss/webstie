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
