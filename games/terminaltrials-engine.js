import {
  registerGameStop,
  setText,
  showToast,
  state,
  updateHighScore,
  unlockAchievement,
} from "../core.js";

const WIDTH = 800;
const HEIGHT = 420;
const FRAME_MS = 1000 / 60;

const GAME_CONFIG = {
  byteblitz: {
    title: "BYTE BLITZ",
    durationMs: 30000,
    spawnMs: 560,
    targetRadius: [12, 22],
    speed: [80, 130],
    scoreBase: 12,
    missPenalty: 6,
    bg: ["#060d17", "#0e2a4a"],
    accent: "#51c9ff",
    secondary: "#15ffcc",
    prompt: "CLICK FALLING BYTES BEFORE THEY BREACH THE BUFFER",
  },
  ciphercrack: {
    title: "CIPHER CRACK",
    durationMs: 30000,
    spawnMs: 620,
    targetRadius: [16, 28],
    speed: [60, 105],
    scoreBase: 14,
    missPenalty: 5,
    bg: ["#130912", "#3f1636"],
    accent: "#ff5fc0",
    secondary: "#ffef89",
    prompt: "DECRYPT WOBBLING TOKENS. SMALLER TOKENS SCORE MORE",
  },
  astrohop: {
    title: "ASTRO HOP",
    durationMs: 32000,
    spawnMs: 1080,
    targetRadius: [14, 24],
    speed: [160, 235],
    scoreBase: 18,
    missPenalty: 6,
    mode: "platformer",
    gravity: 2600,
    bg: ["#070b1d", "#101c45"],
    accent: "#9bb3ff",
    secondary: "#a8ffe5",
    prompt: "RUN + JUMP THROUGH ORBIT RINGS. WASD / ARROWS + SPACE",
  },
  pulsestack: {
    title: "PULSE STACK",
    durationMs: 28000,
    spawnMs: 500,
    targetRadius: [10, 20],
    speed: [95, 145],
    scoreBase: 10,
    missPenalty: 4,
    comboBoost: 0.35,
    mode: "stack",
    bg: ["#0f0716", "#2a1042"],
    accent: "#bf7cff",
    secondary: "#77ffe0",
    prompt: "CHAIN HITS TO RAISE MULTIPLIER — DON'T MISS",
  },
  glitchgate: {
    title: "GLITCH GATE",
    durationMs: 30000,
    spawnMs: 470,
    targetRadius: [12, 26],
    speed: [100, 165],
    scoreBase: 12,
    missPenalty: 8,
    mode: "glitch",
    bg: ["#0a0a0a", "#2b2b2b"],
    accent: "#f5f5f5",
    secondary: "#ff4d4d",
    prompt: "CLOSE BREACHES FAST. MISSED GLITCHES HURT HARD",
  },
  orbweaver: {
    title: "ORB WEAVER",
    durationMs: 32000,
    spawnMs: 640,
    targetRadius: [20, 34],
    speed: [55, 95],
    scoreBase: 15,
    missPenalty: 3,
    chainRadius: 85,
    mode: "weave",
    bg: ["#08150f", "#163d2b"],
    accent: "#74ffa5",
    secondary: "#a6f3ff",
    prompt: "HIT LARGE ORBS TO TRIGGER CHAIN REACTIONS",
  },
  laserlock: {
    title: "LASER LOCK",
    durationMs: 28000,
    spawnMs: 430,
    targetRadius: [9, 18],
    speed: [115, 180],
    scoreBase: 13,
    missPenalty: 6,
    mode: "lock",
    bg: ["#17090a", "#4b1016"],
    accent: "#ff6b6b",
    secondary: "#ffd166",
    prompt: "PRECISION MODE: SMALL FAST TARGETS, HIGH PAYOUT",
  },
  metromaze: {
    title: "METRO MAZE",
    durationMs: 32000,
    spawnMs: 580,
    targetRadius: [14, 24],
    speed: [70, 120],
    scoreBase: 12,
    missPenalty: 5,
    lateral: true,
    mode: "lane",
    bg: ["#091219", "#123248"],
    accent: "#8bcfff",
    secondary: "#f9ff9e",
    prompt: "TRACK NODES AS THEY SWERVE THROUGH THE GRID",
  },
  stacksmash: {
    title: "STACK SMASH",
    durationMs: 30000,
    spawnMs: 540,
    targetRadius: [14, 24],
    speed: [85, 135],
    scoreBase: 11,
    missPenalty: 5,
    armoredChance: 0.25,
    mode: "smash",
    bg: ["#1a1208", "#4c3116"],
    accent: "#ffc06b",
    secondary: "#fff1c9",
    prompt: "ARMORED STACKS NEED TWO HITS — PRIORITIZE THEM",
  },
  quantumflip: {
    title: "QUANTUM FLIP",
    durationMs: 34000,
    spawnMs: 520,
    targetRadius: [13, 25],
    speed: [80, 145],
    scoreBase: 12,
    missPenalty: 4,
    flipInterval: 3800,
    mode: "quantum",
    bg: ["#0b0720", "#24124d"],
    accent: "#9b8cff",
    secondary: "#7fffd4",
    prompt: "REALITY FLIPS PERIODICALLY — ADAPT TO REVERSED MOTION",
  },
};

const runtime = new Map();

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function stopTrial(id) {
  const run = runtime.get(id);
  if (!run) return;
  window.clearInterval(run.timer);
  window.cancelAnimationFrame(run.raf);
  if (typeof run.cleanup === "function") run.cleanup();
  const canvas = run.canvas;
  if (canvas) canvas.onpointerdown = null;
  runtime.delete(id);
}

function spawnTarget(cfg, flipped) {
  const r = rand(cfg.targetRadius[0], cfg.targetRadius[1]);
  const lane = randInt(0, 2);
  const target = {
    x: rand(r + 8, WIDTH - r - 8),
    y: flipped ? rand(220, HEIGHT - r - 8) : -r - rand(0, 80),
    vx: cfg.lateral ? rand(-50, 50) : rand(-18, 18),
    vy: rand(cfg.speed[0], cfg.speed[1]) * (flipped ? -1 : 1),
    r,
    life: 1,
    armored: !!cfg.armoredChance && Math.random() < cfg.armoredChance,
    born: performance.now(),
    lane,
  };

  if (cfg.mode === "stack") {
    target.y = HEIGHT + r + rand(0, 36);
    target.vy = -rand(cfg.speed[0] * 0.65, cfg.speed[1] * 0.75);
    target.vx = rand(-10, 10);
  }

  if (cfg.mode === "glitch") {
    target.integrity = rand(0.65, 1);
  }

  if (cfg.mode === "lock") {
    target.lock = 0;
  }

  if (cfg.mode === "lane") {
    target.y = 95 + lane * 115 + rand(-18, 18);
    target.vx = rand(cfg.speed[0], cfg.speed[1]) * (Math.random() < 0.5 ? -1 : 1);
    target.vy = rand(-8, 8);
  }

  if (cfg.mode === "smash") {
    target.life = randInt(1, 3);
    target.armored = target.life > 1;
  }

  if (cfg.mode === "quantum") {
    target.phase = Math.random() < 0.5 ? -1 : 1;
  }

  return target;
}

function drawBackground(ctx, cfg, remainingMs, flipped) {
  const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  g.addColorStop(0, cfg.bg[0]);
  g.addColorStop(1, cfg.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const sweep = (remainingMs / cfg.durationMs) * WIDTH;
  ctx.fillStyle = `${cfg.secondary}22`;
  ctx.fillRect(0, flipped ? 0 : HEIGHT - 7, sweep, 7);
  ctx.strokeStyle = `${cfg.accent}66`;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    const y = (HEIGHT / 8) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
}

function drawTarget(ctx, cfg, target, t) {
  const pulse = 1 + Math.sin(t * 0.01 + target.x * 0.05) * 0.08;
  const r = target.r * pulse;

  if (cfg.mode === "smash") {
    const w = r * 2.2;
    const h = r * 1.2;
    ctx.fillStyle = `${cfg.accent}22`;
    ctx.fillRect(target.x - w / 2 - 3, target.y - h / 2 - 3, w + 6, h + 6);
    ctx.fillStyle = cfg.accent;
    ctx.fillRect(target.x - w / 2, target.y - h / 2, w, h);
    ctx.fillStyle = "#071017";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(target.life), target.x, target.y + 5);
    return;
  }

  if (cfg.mode === "glitch") {
    const jitter = rand(-2.5, 2.5);
    const size = r * 1.65;
    ctx.fillStyle = `${cfg.secondary}${target.integrity < 0.35 ? "aa" : "44"}`;
    ctx.fillRect(target.x - size / 2 + jitter, target.y - size / 2 - jitter, size, size);
    ctx.fillStyle = cfg.accent;
    ctx.fillRect(target.x - r / 1.8, target.y - r / 1.8, r * 1.1, r * 1.1);
    return;
  }

  ctx.beginPath();
  ctx.fillStyle = `${cfg.accent}25`;
  ctx.arc(target.x, target.y, r + 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = cfg.accent;
  ctx.arc(target.x, target.y, r, 0, Math.PI * 2);
  ctx.fill();

  if (target.armored) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = cfg.secondary;
    ctx.beginPath();
    ctx.arc(target.x, target.y, r - 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#071017";
  ctx.beginPath();
  ctx.arc(target.x, target.y, Math.max(3, r * 0.35), 0, Math.PI * 2);
  ctx.fill();

  if (cfg.mode === "quantum") {
    ctx.fillStyle = target.phase > 0 ? cfg.secondary : "#111";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(target.phase > 0 ? "+" : "−", target.x, target.y + 4);
  }

  if (cfg.mode === "lock") {
    ctx.strokeStyle = target.lock > 0.72 ? cfg.secondary : `${cfg.secondary}66`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(target.x, target.y, r + 10 + (1 - target.lock) * 12, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPlatformActor(ctx, actor, cfg) {
  ctx.fillStyle = `${cfg.accent}20`;
  ctx.fillRect(actor.x - actor.w / 2 - 3, actor.y - actor.h / 2 - 3, actor.w + 6, actor.h + 6);

  ctx.fillStyle = cfg.accent;
  ctx.fillRect(actor.x - actor.w / 2, actor.y - actor.h / 2, actor.w, actor.h);

  ctx.fillStyle = cfg.secondary;
  ctx.fillRect(actor.x - actor.w / 2 + 6, actor.y + actor.h / 2 - 9, actor.w - 12, 6);
}

function drawPlatform(ctx, platform, cfg) {
  ctx.fillStyle = `${cfg.secondary}25`;
  ctx.fillRect(platform.x, platform.y - 3, platform.w, platform.h + 6);
  ctx.fillStyle = `${cfg.accent}88`;
  ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
}

function updateHud(id, score, combo, remainingMs) {
  setText(`${id}Score`, `SCORE: ${Math.max(0, Math.floor(score))}`);
  setText(`${id}Timer`, `TIME: ${(Math.max(0, remainingMs) / 1000).toFixed(1)}s`);
  setText(`${id}Hud`, `COMBO: ${combo}x`);
}

function endRound(id, cfg, run) {
  stopTrial(id);
  const finalScore = Math.max(0, Math.floor(run.score));
  updateHighScore(id, finalScore);
  if (finalScore >= 700) unlockAchievement("arcade_grinder");
  if (run.bestCombo >= 12) unlockAchievement("combo_king");
  showToast(`${cfg.title}: ${finalScore} PTS`, "🎮");
  const actionBtn = document.getElementById(`${id}Action`);
  if (actionBtn) {
    actionBtn.disabled = false;
    actionBtn.textContent = "PLAY AGAIN";
  }
}

function initTrial(id) {
  const cfg = GAME_CONFIG[id];
  if (!cfg) return;
  state.currentGame = id;

  const canvas = document.getElementById(`${id}Canvas`);
  const actionBtn = document.getElementById(`${id}Action`);
  if (!canvas || !actionBtn) return;

  const ctx = canvas.getContext("2d");
  actionBtn.onclick = () => initTrial(id);
  stopTrial(id);

  let score = 0;
  let combo = 1;
  let streak = 0;
  let bestCombo = 1;
  let remainingMs = cfg.durationMs;
  let spawnBudget = 0;
  let flipped = false;
  let flipAt = cfg.flipInterval || Infinity;
  let lastHitAt = 0;
  let stackChain = 0;
  let nextLane = 0;
  let last = performance.now();
  let targets = [];
  const keys = new Set();
  let player = null;
  let platforms = [];

  if (cfg.mode === "platformer") {
    player = {
      x: WIDTH * 0.23,
      y: HEIGHT - 130,
      w: 28,
      h: 34,
      vx: 0,
      vy: 0,
      maxSpeed: 330,
      accel: 2000,
      drag: 1650,
      jumpForce: -860,
      jumpsLeft: 2,
      coyoteUntil: 0,
      jumpBufferUntil: 0,
      grounded: false,
    };

    platforms = [
      { x: 0, y: HEIGHT - 46, w: WIDTH, h: 46 },
      { x: 130, y: HEIGHT - 140, w: 170, h: 18 },
      { x: 360, y: HEIGHT - 220, w: 155, h: 18 },
      { x: 575, y: HEIGHT - 145, w: 155, h: 18 },
      { x: 640, y: HEIGHT - 285, w: 115, h: 18 },
      { x: 250, y: HEIGHT - 315, w: 125, h: 18 },
    ];
  }

  updateHud(id, score, combo, remainingMs);
  setText(`${id}Hud`, `${cfg.prompt} | COMBO: ${combo}x`);
  actionBtn.disabled = true;
  actionBtn.textContent = "ROUND LIVE";

  canvas.onpointerdown = (event) => {
    if (cfg.mode === "platformer") return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const hitIdx = targets.findIndex((target) => Math.hypot(target.x - x, target.y - y) <= target.r + 8);
    if (hitIdx === -1) {
      score -= cfg.missPenalty;
      combo = 1;
      streak = 0;
      stackChain = 0;
      updateHud(id, score, combo, remainingMs);
      return;
    }

    const target = targets[hitIdx];

    if (cfg.mode === "lane" && target.lane !== nextLane) {
      score -= cfg.missPenalty + 2;
      combo = 1;
      streak = 0;
      updateHud(id, score, combo, remainingMs);
      return;
    }

    if (cfg.mode === "quantum" && (flipped ? 1 : -1) !== target.phase) {
      score -= cfg.missPenalty;
      combo = 1;
      streak = 0;
      updateHud(id, score, combo, remainingMs);
      return;
    }

    if (cfg.mode === "lock" && target.lock < 0.72) {
      score -= Math.ceil(cfg.missPenalty * 0.5);
      updateHud(id, score, combo, remainingMs);
      return;
    }

    if (target.armored && target.life === 1) {
      target.life = 0;
      target.armored = false;
      score += 4;
      return;
    }

    if (cfg.mode === "smash" && target.life > 1) {
      target.life -= 1;
      score += 3;
      updateHud(id, score, combo, remainingMs);
      return;
    }

    targets.splice(hitIdx, 1);
    streak += 1;
    combo = clamp(1 + Math.floor(streak / 3), 1, 12);
    bestCombo = Math.max(bestCombo, combo);

    let gain = cfg.scoreBase + Math.floor((28 - target.r) * 0.7);
    gain += Math.floor(gain * ((combo - 1) * (cfg.comboBoost || 0.22)));

    if (cfg.chainRadius && target.r > 24) {
      let chain = 0;
      targets = targets.filter((other) => {
        if (Math.hypot(other.x - target.x, other.y - target.y) <= cfg.chainRadius) {
          chain += 1;
          return false;
        }
        return true;
      });
      gain += chain * 8;
    }

    if (cfg.mode === "stack") {
      const now = performance.now();
      stackChain = now - lastHitAt < 900 ? stackChain + 1 : 1;
      lastHitAt = now;
      gain += stackChain * 3;
    }

    if (cfg.mode === "glitch") {
      gain += Math.floor((1.1 - (target.integrity || 1)) * 16);
    }

    if (cfg.mode === "lane") {
      nextLane = (nextLane + 1) % 3;
      gain += 5;
    }

    score += gain;
    updateHud(id, score, combo, remainingMs);
  };

  const onKeyDown = (event) => {
    if (cfg.mode !== "platformer") return;
    keys.add(event.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
      event.preventDefault();
    }
    if (["KeyW", "ArrowUp", "Space"].includes(event.code)) {
      player.jumpBufferUntil = performance.now() + 120;
    }
  };

  const onKeyUp = (event) => {
    if (cfg.mode !== "platformer") return;
    keys.delete(event.code);
  };

  if (cfg.mode === "platformer") {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
  }

  const timer = window.setInterval(() => {
    remainingMs -= 100;
    updateHud(id, score, combo, remainingMs);
    if (remainingMs <= 0) {
      endRound(id, cfg, { score, bestCombo });
    }
  }, 100);

  function frame(now) {
    if (!runtime.has(id)) return;
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;

    if (cfg.flipInterval && remainingMs < flipAt) {
      flipped = !flipped;
      flipAt -= cfg.flipInterval;
      showToast(`${cfg.title}: POLARITY FLIP`, "🌀");
    }

    spawnBudget += dt * 1000;
    while (spawnBudget >= cfg.spawnMs) {
      spawnBudget -= cfg.spawnMs;
      targets.push(spawnTarget(cfg, flipped));
      if (cfg.mode === "platformer") {
        const ring = targets[targets.length - 1];
        ring.x = WIDTH + ring.r + rand(10, 80);
        ring.y = rand(70, HEIGHT - 110);
        ring.vx = -rand(cfg.speed[0], cfg.speed[1]);
        ring.vy = 0;
      }
    }

    if (cfg.mode === "platformer") {
      const moveLeft = keys.has("KeyA") || keys.has("ArrowLeft");
      const moveRight = keys.has("KeyD") || keys.has("ArrowRight");
      const axis = Number(moveRight) - Number(moveLeft);

      if (axis !== 0) {
        player.vx += axis * player.accel * dt;
      } else {
        const dragStep = player.drag * dt;
        if (Math.abs(player.vx) <= dragStep) player.vx = 0;
        else player.vx -= Math.sign(player.vx) * dragStep;
      }

      player.vx = clamp(player.vx, -player.maxSpeed, player.maxSpeed);

      const jumpRequested = player.jumpBufferUntil > now;
      const canGroundJump = now < player.coyoteUntil;
      if (jumpRequested && (canGroundJump || player.jumpsLeft > 0)) {
        player.vy = player.jumpForce;
        player.jumpBufferUntil = 0;
        if (!canGroundJump) player.jumpsLeft -= 1;
        player.coyoteUntil = 0;
        player.grounded = false;
      }

      player.vy += cfg.gravity * dt;

      const prevBottom = player.y + player.h / 2;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      player.x = clamp(player.x, player.w / 2, WIDTH - player.w / 2);

      player.grounded = false;
      for (const platform of platforms) {
        const withinX = player.x + player.w / 2 > platform.x && player.x - player.w / 2 < platform.x + platform.w;
        const top = platform.y;
        const playerBottom = player.y + player.h / 2;
        if (withinX && prevBottom <= top && playerBottom >= top && player.vy >= 0) {
          player.y = top - player.h / 2;
          player.vy = 0;
          player.grounded = true;
          player.jumpsLeft = 1;
          player.coyoteUntil = now + 120;
        }
      }

      if (player.grounded) {
        player.coyoteUntil = now + 120;
      }

      if (player.y - player.h / 2 > HEIGHT + 70) {
        player.x = WIDTH * 0.23;
        player.y = HEIGHT - 130;
        player.vx = 0;
        player.vy = 0;
        score -= cfg.missPenalty + 2;
        combo = 1;
        streak = 0;
      }
    }

    targets.forEach((target) => {
      target.x += target.vx * dt;
      target.y += target.vy * dt;
      if (target.x - target.r < 0 || target.x + target.r > WIDTH) target.vx *= -1;
      if (cfg.gravity && cfg.mode !== "platformer") target.vy += cfg.gravity * dt;
      if (cfg.mode === "glitch") target.integrity = Math.max(0, target.integrity - dt * 0.2);
      if (cfg.mode === "lock") {
        const phase = ((now - target.born) % 1200) / 1200;
        target.lock = Math.sin(phase * Math.PI);
      }
    });

    const missTop = -40;
    const missBottom = HEIGHT + 40;
    const survivors = [];
    for (const target of targets) {
      const missed =
        cfg.mode === "platformer"
          ? target.x + target.r < 0
          : flipped
            ? target.y < missTop
            : target.y > missBottom;
      const breached = cfg.mode === "glitch" && target.integrity <= 0;
      if (missed || breached) {
        score -= cfg.missPenalty;
        combo = 1;
        streak = 0;
        if (cfg.mode === "stack") stackChain = 0;
      } else {
        survivors.push(target);
      }
    }
    targets = survivors;

    drawBackground(ctx, cfg, remainingMs, flipped);
    if (cfg.mode === "platformer") {
      platforms.forEach((platform) => drawPlatform(ctx, platform, cfg));
    }
    if (cfg.mode === "lane") {
      ctx.strokeStyle = `${cfg.secondary}33`;
      [95, 210, 325].forEach((y, i) => {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
        if (i === nextLane) {
          ctx.fillStyle = `${cfg.secondary}66`;
          ctx.fillRect(0, y - 18, 14, 36);
        }
      });
    }
    const t = performance.now();
    targets.forEach((target) => drawTarget(ctx, cfg, target, t));
    if (cfg.mode === "platformer") {
      let gained = 0;
      const kept = [];
      for (const target of targets) {
        if (Math.hypot(target.x - player.x, target.y - player.y) <= target.r + player.w * 0.55) {
          streak += 1;
          combo = clamp(1 + Math.floor(streak / 3), 1, 12);
          bestCombo = Math.max(bestCombo, combo);
          gained += cfg.scoreBase + combo * 2 + Math.floor((28 - target.r) * 0.5);
        } else {
          kept.push(target);
        }
      }
      if (gained > 0) {
        score += gained;
      }
      targets = kept;
      drawPlatformActor(ctx, player, cfg);
    }

    updateHud(id, score, combo, remainingMs);

    runtime.get(id).raf = window.requestAnimationFrame(frame);
  }

  runtime.set(id, {
    timer,
    raf: 0,
    canvas,
    score,
    bestCombo,
    cleanup: cfg.mode === "platformer" ? () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    } : null,
  });
  runtime.get(id).raf = window.requestAnimationFrame(frame);

  registerGameStop(() => stopTrial(id));
}

export function createTrialInit(id) {
  return () => initTrial(id);
}
