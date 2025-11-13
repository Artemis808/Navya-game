/* ======================================================
      ULTRA-OPTIMIZED GAME.JS  (Light Blur Edition)
======================================================= */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let gameStarted = false;
let difficulty = "medium";
let soundReady = false;
let muted = false;

const soundUnlock = document.getElementById("soundUnlock");
function unlockAudio() {
    soundReady = true;
    soundUnlock.style.display = "none";
}
document.addEventListener("click", unlockAudio, { once: true });
document.addEventListener("touchstart", unlockAudio, { once: true });

/* ====== ASSETS ====== */

const bg1 = new Image(); bg1.src = "assets/bg1.png";
const bg2 = new Image(); bg2.src = "assets/bg2.png";

const runnerImg = new Image(); runnerImg.src = "assets/runner.png";
const enemy1Img = new Image(); enemy1Img.src = "assets/enemy1.png";
const enemy2Img = new Image(); enemy2Img.src = "assets/enemy2.png";
const planeImg  = new Image(); planeImg.src = "assets/plane.png";

const healthImg = new Image(); healthImg.src = "assets/health.png";

/* ====== AUDIO ====== */

const sJump = new Audio("assets/sound/jump.wav");
const sHit = new Audio("assets/sound/hit.wav");
const sPickup = new Audio("assets/sound/pickup.wav");
const sGameOver = new Audio("assets/sound/gameover.wav");

const bgMusic = new Audio("assets/sound/bgmusic.mp3");
bgMusic.loop = true;
bgMusic.volume = 0.45;

[sJump, sHit, sPickup, sGameOver].forEach(a => a.volume = 0.7);

function setMuted(v) {
    muted = v;
    [sJump, sHit, sPickup, sGameOver, bgMusic].forEach(a => a.muted = v);
    document.getElementById("muteBtn").innerHTML = v ? "Unmute" : "Mute";
}
if (localStorage.getItem("gameMuted") === "1") setMuted(true);

document.getElementById("muteBtn").onclick = () => {
    setMuted(!muted);
    localStorage.setItem("gameMuted", muted ? "1" : "0");
};

/* ====== GAME CONSTANTS ====== */

const GROUND_Y = 320;

/* ====== RUNNER ====== */

let runner = {
    x: 100,
    y: GROUND_Y,
    width: 80,
    height: 120,
    yVelocity: 0,
    gravity: 2.0,
    jumpForce: -28
};

let jumpCount = 0;
let playerHealth = 100;

/* ====== SCORE ====== */
let score = 0;
let distance = 0;
let highScore = parseFloat(localStorage.getItem("highScore") || "0");

/* ====== ENEMIES ====== */

let enemy1 = { x: 1200, y: GROUND_Y, width: 80, height: 120, speed: 6 };
let enemy2 = { x: 1600, y: GROUND_Y, width: 80, height: 120, speed: 7 };
let plane  = { x: 2000, y: 120, width: 200, height: 80, speed: 5 };

/* ====== HEALTH PICKUP ====== */

let healthPickup = {
    x: canvas.width + 500,
    y: 200,
    width: 40,
    height: 40,
    speed: 4,
    floatOffset: 0,
    floatDir: 1
};

let lastHealthSpawn = Date.now();

/* ====== BACKGROUND PARALLAX ====== */

let bg1X = 0, bg2X = 0;
const bg1Speed = 0.1;
const bg2Speed = 0.2;

/* ====== BULLETS ====== */

let bullets = [];
let lastEnemyShot = Date.now();

/* ====== POWER-UPS ====== */

let powerupsOnField = [];
let activePower = null;
let lastPowerSpawn = Date.now();

const POWER_SPAWN_MIN = 15000;
const POWER_SPAWN_MAX = 25000;
const HEALTH_TRIGGER = 40;

function spawnPowerup() {
    if (powerupsOnField.length >= 1) return; // optimization: max 1

    const type = Math.random() < 0.5 ? "shield" : "magnet";

    powerupsOnField.push({
        x: canvas.width + 400,
        y: 150 + Math.random() * 120,
        width: 48,
        height: 48,
        type,
        float: 0,
        floatDir: 1
    });
}

function maybeSpawnPowerup() {
    const now = Date.now();
    const interval = POWER_SPAWN_MIN + Math.random() * (POWER_SPAWN_MAX - POWER_SPAWN_MIN);

    if (now - lastPowerSpawn > interval || (playerHealth < HEALTH_TRIGGER && Math.random() < 0.5)) {
        spawnPowerup();
        lastPowerSpawn = now;
    }
}

function pickupPowerup(p) {
    const now = Date.now();
    if (p.type === "shield") 
        activePower = { type: "shield", expiresAt: now + 5000 };
    else 
        activePower = { type: "magnet", expiresAt: now + 6000 };

    if (!muted && soundReady) sPickup.play();
    if (navigator.vibrate) navigator.vibrate(40);
}

/* ====== DIFFICULTY ====== */

const DIFF = {
    easy:   { e1:4, e2:5, plane:4 },
    medium: { e1:6, e2:7, plane:5 },
    hard:   { e1:7, e2:8, plane:6 }
};

/* ====== GAME START ====== */

function startGame(level) {
    difficulty = level;
    gameStarted = true;
    document.getElementById("difficultyMenu").style.display = "none";

    if (soundReady && !muted) bgMusic.play();

    const d = DIFF[level];
    enemy1.speed = d.e1;
    enemy2.speed = d.e2;
    plane.speed  = d.plane;

    gameLoop();
}

/* ====== INPUT (Optimized) ====== */

document.addEventListener("keydown", e => {
    if (!gameStarted) return;

    if (e.code === "Space" && jumpCount < 2) {
        runner.yVelocity = runner.jumpForce;
        jumpCount++;
        if (!muted && soundReady) sJump.play();
    }

    if (e.code === "KeyP") usePowerNearby();
    if (e.code === "KeyR" && playerHealth <= 0) location.reload();
});

/* MOBILE BUTTONS */
document.getElementById("jumpBtn").ontouchstart = () => {
    if (!gameStarted) return;
    if (jumpCount < 2) {
        runner.yVelocity = runner.jumpForce;
        jumpCount++;
        if (!muted && soundReady) sJump.play();
    }
};

document.getElementById("powerBtn").ontouchstart = () => usePowerNearby();

canvas.addEventListener("touchstart", ev => {
    if (!gameStarted) return;
    const rect = canvas.getBoundingClientRect();
    const x = ev.touches[0].clientX - rect.left;

    if (x > canvas.width / 2) {
        if (jumpCount < 2) {
            runner.yVelocity = runner.jumpForce;
            jumpCount++;
            if (!muted && soundReady) sJump.play();
        }
    } else {
        usePowerNearby();
    }
});

/* ====== POWER-UP USE ====== */

function usePowerNearby() {
    if (activePower || powerupsOnField.length === 0) return;

    const p = powerupsOnField.shift();
    pickupPowerup(p);
}

/* ====== COLLISION (Optimized AABB) ====== */

function hit(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y - a.height < b.y &&
        a.y > b.y - b.height
    );
}

/* ====== GAME LOOP ====== */

let lastUIUpdate = 0; // throttle DOM updates

function gameLoop() {
    if (!gameStarted) return;

    /* ====== CLEAR FRAME ====== */
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* ====== LIGHT BLUR BG (1px) ====== */
    ctx.save();
    ctx.filter = "blur(1px)";

    bg1X -= bg1Speed;
    if (bg1X <= -canvas.width) bg1X = 0;
    ctx.drawImage(bg1, bg1X, 0, canvas.width, canvas.height);
    ctx.drawImage(bg1, bg1X + canvas.width, 0, canvas.width, canvas.height);

    bg2X -= bg2Speed;
    if (bg2X <= -canvas.width) bg2X = 0;
    ctx.drawImage(bg2, bg2X, 0, canvas.width, canvas.height);
    ctx.drawImage(bg2, bg2X + canvas.width, 0, canvas.width, canvas.height);

    ctx.restore();

    /* ====== SCORE ====== */
    score++;
    distance += 0.1;

    /* ====== GROUND ====== */
    ctx.fillStyle = "#222";
    ctx.fillRect(0, GROUND_Y + 10, canvas.width, 10);

    /* ====== RUNNER PHYSICS ====== */
    runner.yVelocity += runner.gravity;
    if (runner.yVelocity > 0) runner.yVelocity += 0.5;
    runner.y += runner.yVelocity;

    if (runner.y > GROUND_Y) {
        runner.y = GROUND_Y;
        jumpCount = 0;
        runner.yVelocity = 0;
    }

    ctx.drawImage(runnerImg, runner.x, runner.y - runner.height, runner.width, runner.height);

    /* ====== HEALTH PICKUP ====== */

    healthPickup.x -= healthPickup.speed;
    healthPickup.floatOffset += 0.3 * healthPickup.floatDir;
    if (healthPickup.floatOffset > 10 || healthPickup.floatOffset < -10)
        healthPickup.floatDir *= -1;

    ctx.drawImage(
        healthImg,
        healthPickup.x,
        healthPickup.y + healthPickup.floatOffset,
        healthPickup.width,
        healthPickup.height
    );

    if (
        healthPickup.x < -100 ||
        Date.now() - lastHealthSpawn > 15000
    ) {
        healthPickup.x = canvas.width + 400;
        healthPickup.y = 150 + Math.random() * 150;
        lastHealthSpawn = Date.now();
    }

    /* ====== ENEMIES ====== */

    enemy1.x -= enemy1.speed;
    if (enemy1.x < -150) enemy1.x = canvas.width + 600;

    enemy2.x -= enemy2.speed;
    if (enemy2.x < -150) enemy2.x = canvas.width + 900;

    plane.x -= plane.speed;
    if (plane.x < -600) {
        plane.x = canvas.width + 300;
        plane.y = 60 + Math.random() * 140;
    }

    ctx.drawImage(enemy1Img, enemy1.x, enemy1.y - enemy1.height, enemy1.width, enemy1.height);
    ctx.drawImage(enemy2Img, enemy2.x, enemy2.y - enemy2.height, enemy2.width, enemy2.height);
    ctx.drawImage(planeImg, plane.x, plane.y, plane.width, plane.height);

    /* ====== BULLETS (OPTIMIZED) ====== */

    if (Date.now() - lastEnemyShot > 3000) {
        if (Math.random() < 0.5) bullets.push({ x: enemy1.x, y: enemy1.y - 60, width: 15, height: 15 });
        if (Math.random() < 0.5) bullets.push({ x: enemy2.x, y: enemy2.y - 60, width: 15, height: 15 });
        lastEnemyShot = Date.now();
    }

    ctx.fillStyle = "yellow";
    bullets = bullets.filter(b => b.x > -30);
    bullets.forEach(b => {
        b.x -= 7; // slightly slower bullet
        ctx.fillRect(b.x, b.y, b.width, b.height);
    });

    /* ====== COLLISIONS ====== */

    const bigRunner = {
        x: runner.x - 10,
        y: runner.y,
        width: runner.width + 20,
        height: runner.height
    };

    if (!activePower || activePower.type !== "shield") {
        if (hit(runner, enemy1)) playerHealth -= 1;
        if (hit(runner, enemy2)) playerHealth -= 2;
        if (hit(runner, { x: plane.x, y: plane.y + plane.height * 0.3, width: plane.width, height: plane.height * 0.6 })) playerHealth -= 2;

        bullets.forEach(b => {
            if (hit(runner, { x: b.x, y: b.y + b.height, width: b.width, height: b.height })) {
                playerHealth -= 2;
                b.x = -999;
            }
        });
    }

    // Health pickup collision
    if (hit(bigRunner, {
        x: healthPickup.x,
        y: healthPickup.y,
        width: healthPickup.width,
        height: healthPickup.height
    })) {
        playerHealth = Math.min(100, playerHealth + 20);
        healthPickup.x = -400;
        if (!muted && soundReady) sPickup.play();
    }

    /* ====== POWERUP SPAWN ====== */
    maybeSpawnPowerup();

    /* ====== POWERUP FIELD DRAW ====== */

    for (let i = powerupsOnField.length - 1; i >= 0; i--) {
        const p = powerupsOnField[i];

        p.x -= 3;
        p.float += 0.3 * p.floatDir;
        if (p.float > 8 || p.float < -8) p.floatDir *= -1;

        ctx.fillStyle = p.type === "shield" ? "#99F" : "#F88";
        ctx.beginPath();
        ctx.arc(
            p.x + p.width / 2,
            p.y + p.height / 2 + p.float,
            20,
            0,
            Math.PI * 2
        );
        ctx.fill();

        if (hit(bigRunner, {
            x: p.x,
            y: p.y + p.float,
            width: p.width,
            height: p.height
        })) {
            powerupsOnField.splice(i, 1);
            pickupPowerup(p);
        }
    }

    /* ====== ACTIVE POWER EFFECTS ====== */

    if (activePower) {
        if (activePower.type === "shield") {
            ctx.save();
            ctx.globalAlpha = 0.12;
            ctx.fillStyle = "#99ccee";
            ctx.beginPath();
            ctx.arc(
                runner.x + runner.width / 2,
                runner.y - runner.height / 2,
                90,
                0,
                Math.PI * 2
            );
            ctx.fill();
            ctx.restore();
        }

        if (activePower.type === "magnet") {
            healthPickup.x += (runner.x - healthPickup.x) * 0.05;
            healthPickup.y += (runner.y - healthPickup.y) * 0.05;
        }

        if (Date.now() > activePower.expiresAt) activePower = null;
    }

    /* ====== HEALTH BAR ====== */
    ctx.fillStyle = "red";
    ctx.fillRect(20, 20, 200, 20);
    ctx.fillStyle = "green";
    ctx.fillRect(20, 20, Math.max(0, playerHealth * 2), 20);
    ctx.strokeStyle = "black";
    ctx.strokeRect(20, 20, 200, 20);

    /* ====== UPDATE DOM UI (THROTTLED) ====== */
    const now = performance.now();
    if (now - lastUIUpdate > 200) {
        document.getElementById("scoreDisplay").innerText = "Score: " + score;
        document.getElementById("distanceDisplay").innerText = "Distance: " + distance.toFixed(1) + " m";
        document.getElementById("highDisplay").innerText = "High: " + highScore.toFixed(1);

        lastUIUpdate = now;
    }

    /* ====== GAME OVER ====== */

    if (playerHealth <= 0) {
        if (!muted && soundReady) sGameOver.play();

        if (distance > highScore) {
            highScore = distance;
            localStorage.setItem("highScore", highScore.toFixed(1));
        }

        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "white";
        ctx.font = "40px Arial";
        ctx.fillText("GAME OVER", canvas.width / 2 - 120, canvas.height / 2 - 40);

        ctx.font = "22px Arial";
        ctx.fillText("Distance: " + distance.toFixed(1) + " m", canvas.width / 2 - 110, canvas.height / 2);
        ctx.fillText("High Score: " + highScore.toFixed(1) + " m", canvas.width / 2 - 110, canvas.height / 2 + 40);

        ctx.font = "20px Arial";
        ctx.fillText("Press R to Restart", canvas.width / 2 - 90, canvas.height / 2 + 80);

        return;
    }

    requestAnimationFrame(gameLoop);
}

/* ====== ENABLE MUSIC WHEN READY ====== */

document.addEventListener("click", () => {
    if (soundReady && !muted) {
        try { bgMusic.play(); } catch (e) {}
    }
}, { once: true });

document.addEventListener("touchstart", () => {
    if (soundReady && !muted) {
        try { bgMusic.play(); } catch (e) {}
    }
}, { once: true });
