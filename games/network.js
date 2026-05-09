const LEGACY_PROD_HOST = "seahorse-app-mv4sg.ondigitalocean.app";

function isLocalHost(hostname = window.location.hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || !hostname;
}

function normalizeServerMode(selectOrMode) {
  if (typeof selectOrMode === "string") return selectOrMode || "auto";
  return selectOrMode?.value || "auto";
}

function currentHost() {
  if (window.GOONER_MULTIPLAYER_HOST) return String(window.GOONER_MULTIPLAYER_HOST).replace(/^https?:\/\//, "").replace(/^wss?:\/\//, "");
  if (isLocalHost()) return "localhost:2567";
  return window.location.host || LEGACY_PROD_HOST;
}

export function getColyseusWsUrl(selectOrMode = "auto") {
  const mode = normalizeServerMode(selectOrMode);
  if (mode === "local") return "ws://localhost:2567";
  if (mode === "prod") return `wss://${LEGACY_PROD_HOST}`;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${currentHost()}`;
}

export function getColyseusHttpUrl(selectOrMode = "auto") {
  const wsUrl = getColyseusWsUrl(selectOrMode);
  if (wsUrl.startsWith("wss://")) return `https://${wsUrl.slice(6)}`;
  if (wsUrl.startsWith("ws://")) return `http://${wsUrl.slice(5)}`;
  return wsUrl;
}

export function hasColyseusClient() {
  return Boolean(window.Colyseus?.Client);
}
