import { firebase, state, showToast } from "./core.js";

const { doc, setDoc, getDoc, updateDoc, onSnapshot, collection, addDoc, runTransaction } = firebase;

let pc = null;
let localStream = null;
let remoteStream = null;
let unsubRoom = null;
let unsubHostCandidates = null;
let unsubGuestCandidates = null;
let currentChannel = null;
let isHost = false;
let muted = false;
let memberUnsub = null;

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

function setChannelLabel(channel) {
  const label = document.getElementById("voiceChannelLabel");
  if (!label) return;
  label.innerText = channel ? `IN #${channel}` : "NO CHANNEL";
}

function renderMembers(members = []) {
  const list = document.getElementById("voiceMemberList");
  if (!list) return;
  list.innerHTML = "";
  members.forEach((member) => {
    const row = document.createElement("div");
    row.className = "voice-member";
    row.innerHTML = `<div class="voice-member-name"><span class="voice-indicator"></span>${member.name}</div><span>${member.uid === state.myUid ? "YOU" : ""}</span>`;
    list.appendChild(row);
  });
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
    if (!window.isSecureContext) {
      showToast("HTTPS REQUIRED FOR MIC", "⚠️");
      setStatus("MIC BLOCKED");
      throw new Error("Microphone requires a secure context (HTTPS).");
    }
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
  setChannelLabel(channel);
  setStatus(`CONNECTING: ${channel.toUpperCase()}`);
  const ref = channelRef(channel);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    isHost = true;
    try {
      await createPeerConnection();
    } catch (err) {
      showToast("MIC PERMISSION BLOCKED", "🎙️");
      return;
    }
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await setDoc(ref, { hostUid: state.myUid, offer: offer.toJSON(), answer: null, members: [{ uid: state.myUid, name: state.myName }] });
    unsubRoom = onSnapshot(ref, async (docSnap) => {
      const data = docSnap.data();
      if (data?.members) renderMembers(data.members);
      if (data?.answer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        setStatus(`LIVE: ${channel.toUpperCase()}`);
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
    await runTransaction(firebase.db, async (t) => {
      const fresh = await t.get(ref);
      if (!fresh.exists()) return;
      const room = fresh.data();
      const members = room.members || [];
      if (!members.find((m) => m.uid === state.myUid)) {
        members.push({ uid: state.myUid, name: state.myName });
        t.update(ref, { members });
      }
    });
    try {
      await createPeerConnection();
    } catch (err) {
      showToast("MIC PERMISSION BLOCKED", "🎙️");
      return;
    }
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await updateDoc(ref, { answer: answer.toJSON() });
    setStatus(`LIVE: ${channel.toUpperCase()}`);
    unsubHostCandidates = onSnapshot(candidatesRef(channel, "host"), (snapCandidates) => {
      snapCandidates.docChanges().forEach((change) => {
        if (change.type === "added") {
          pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    });
  }
  memberUnsub = onSnapshot(ref, (docSnap) => {
    const data = docSnap.data();
    if (data?.members) renderMembers(data.members);
  });
}

async function leaveChannel() {
  if (unsubRoom) unsubRoom();
  if (unsubHostCandidates) unsubHostCandidates();
  if (unsubGuestCandidates) unsubGuestCandidates();
  if (memberUnsub) memberUnsub();
  unsubRoom = null;
  unsubHostCandidates = null;
  unsubGuestCandidates = null;
  memberUnsub = null;
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
  if (currentChannel) {
    const ref = channelRef(currentChannel);
    if (isHost) {
      await setDoc(ref, { hostUid: null, offer: null, answer: null, members: [] });
    } else {
      await runTransaction(firebase.db, async (t) => {
        const snap = await t.get(ref);
        if (!snap.exists()) return;
        const room = snap.data();
        const members = (room.members || []).filter((member) => member.uid !== state.myUid);
        t.update(ref, { members });
      });
    }
  }
  currentChannel = null;
  isHost = false;
  setStatus("OFFLINE");
  setChannelLabel(null);
  renderMembers([]);
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
  setChannelLabel(null);
  renderMembers([]);
  window.addEventListener("beforeunload", leaveChannel);
}
