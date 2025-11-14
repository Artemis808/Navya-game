/* ============================================================
     FULL GAME.JS — Difficulty Balanced + Boss (Enemy2) + Forward Jump
============================================================= */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

/* ------------------------------------------------------------
    GLOBAL STATE
------------------------------------------------------------ */

let gameStarted = false;
let gameOver = false;
let difficulty = "medium";

let score = 0;
let distance = 0;
let highScore = parseFloat(localStorage.getItem("highScore") || "0");

let playerHealth = 100;
let maxHealth = 100;

let jumpCount = 0;
const maxJumps = 2;

const GROUND_Y = 320;

let bullets = [];               // normal bullets (enemy/plane)
let powerupsOnField = [];
let activePower = null;

let bossGossip = [];            // gossip projectiles (boss)
let bossActive = false;
let boss = null;
let bossStartTime = 0;
let bossDuration = 10000;       // will be set per difficulty (ms)
let bossWarningActive = false;

let lastEnemyShot = Date.now();
let lastUIUpdate = 0;
let lastPowerSpawn = Date.now();
let lastHealthSpawn = Date.now();

const POWER_SPAWN_MIN = 15000;
const POWER_SPAWN_MAX = 25000;
const HEALTH_TRIGGER = 40;

/* ------------------------------------------------------------
    ASSETS
------------------------------------------------------------ */

const runnerImg = new Image(); runnerImg.src = "assets/runner.png";
const bg1 = new Image(); bg1.src = "assets/bg1.png";
const bg2 = new Image(); bg2.src = "assets/bg2.png";
const enemy1Img = new Image(); enemy1Img.src = "assets/enemy1.png";
const enemy2Img = new Image(); enemy2Img.src = "assets/enemy2.png";
const planeImg  = new Image(); planeImg.src = "assets/plane.png";
const healthImg = new Image(); healthImg.src = "assets/health.png";

/* ------------------------- AUDIO -------------------------- */

const sJump = new Audio("assets/sound/jump.wav");
const sHit = new Audio("assets/sound/hit.wav");
const sPickup = new Audio("assets/sound/pickup.wav");
const sGameOver = new Audio("assets/sound/gameover.wav");

const bgMusic = new Audio("assets/sound/bgmusic.mp3");
bgMusic.loop = true;

/* ------------------------------------------------------------
    KEEP MUTE CONTROL (AS BEFORE)
------------------------------------------------------------ */

let muted = false;
function setMuted(m) {
    muted = m;
    [sJump, sHit, sPickup, sGameOver, bgMusic].forEach(a => a.muted = m);
    const mb = document.getElementById("muteBtn");
    if (mb) mb.innerText = m ? "Unmute" : "Mute";
}
if (localStorage.getItem("gameMuted") === "1") setMuted(true);
if (document.getElementById("muteBtn")) {
    document.getElementById("muteBtn").onclick = () => {
        setMuted(!muted);
        localStorage.setItem("gameMuted", muted ? "1" : "0");
    };
}

/* ------------------------------------------------------------
    RUNNER (added horizontal movement on jump)
------------------------------------------------------------ */

let runner = {
    x: 100,
    y: GROUND_Y,
    width: 80,
    height: 120,
    yVelocity: 0,
    gravity: 2.0,
    jumpForce: -28,

    // forward-movement properties
    xVelocity: 0,
    forwardJumpForce: 3.5,   // how much forward push on jump
    xFriction: 0.12,
    minX: 70,
    maxX: 260               // clamp so runner doesn't go too far right
};

/* ------------------------------------------------------------
    ENEMIES + PLANE (enemy2 now reserved for boss)
------------------------------------------------------------ */

let enemy1 = { x: 1200, y: GROUND_Y, width: 80, height: 120, speed: 6 };
let enemy2 = { x: 1600, y: GROUND_Y, width: 80, height: 120, speed: 7 }; // will not spawn normally
let plane  = { x: 2000, y: 120,   width:200, height: 80,  speed: 5 };

/* ------------------------------------------------------------
    BACKGROUND
------------------------------------------------------------ */

let bg1X = 0, bg2X = 0;
const bg1Speed = 0.1;
const bg2Speed = 0.2;

/* ------------------------------------------------------------
    BOSS CONFIG
    - Option B size: ~80% width, 50% height, crop bottom half of sprite
    - Durations: easy=10s, medium=12s, hard=20s
------------------------------------------------------------ */

function getBossDurationForDifficulty(diff) {
    if (diff === "easy") return 10000;
    if (diff === "medium") return 12000;
    return 20000; // hard
}

// boss spawn distance scheduling:
let nextBossDistance = 200 + Math.random() * 300; // first boss after ~200-500 m

/* ------------------------------------------------------------
    INPUT HANDLERS (jump forward implemented)
------------------------------------------------------------ */

function doJump() {
    if (!gameStarted || gameOver) return;
    if (jumpCount < maxJumps) {
        runner.yVelocity = runner.jumpForce;
        runner.xVelocity = runner.forwardJumpForce;
        jumpCount++;
        if (!muted) sJump.play();
    }
}

canvas.addEventListener("touchstart",(e)=>{
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    if (x > canvas.width / 2) doJump();
    else usePowerNearby();
},{ passive:false });

if (document.getElementById("jumpBtn")) {
    document.getElementById("jumpBtn").addEventListener("touchstart",(e)=>{
        e.preventDefault(); doJump();
    },{ passive:false });
    document.getElementById("jumpBtn").addEventListener("mousedown",()=>doJump());
}
if (document.getElementById("powerBtn")) {
    document.getElementById("powerBtn").addEventListener("mousedown",()=>usePowerNearby());
    document.getElementById("powerBtn").addEventListener("touchstart",(e)=>{
        e.preventDefault(); usePowerNearby();
    },{ passive:false });
}

document.addEventListener("keydown",(e)=>{
    if (e.code==="Space") doJump();
});

/* ------------------------------------------------------------
    RESTART
------------------------------------------------------------ */

if (document.getElementById("restartBtn")) {
    document.getElementById("restartBtn").addEventListener("click", restartGame);
    document.getElementById("restartBtn").addEventListener("touchstart",(e)=>{
        e.preventDefault(); restartGame();
    },{ passive:false });
}

function restartGame() {
    score = 0;
    distance = 0;
    playerHealth = maxHealth;
    jumpCount = 0;
    bullets = [];
    bossGossip = [];
    powerupsOnField = [];
    activePower = null;
    bossActive = false;
    boss = null;
    bossWarningActive = false;

    enemy1.x = canvas.width + 400;
    enemy2.x = canvas.width + 700;
    plane.x  = canvas.width + 1200;

    runner.y = GROUND_Y;
    runner.yVelocity = 0;
    runner.x = 100;
    runner.xVelocity = 0;

    gameOver = false;
    document.getElementById("gameover-overlay").style.display = "none";

    nextBossDistance = distance + 200 + Math.random() * 300;

    if (!muted && startMenuSoundOn) {
        bgMusic.currentTime = 0;
        bgMusic.play().catch(()=>{});
    }

    requestAnimationFrame(gameLoop);
}

/* ------------------------------------------------------------
    DIFFICULTY CONFIG (unchanged except boss durations set later)
------------------------------------------------------------ */

const DIFF = {
    easy: {
        e1: 2, e2: 4, plane: 2, maxEnemies: 1,
        e1Chance: 0.20, e2Chance: 0.75, planeChance: 0.05
    },
    medium: {
        e1:6, e2:6, plane:5, maxEnemies:2,
        e1Chance:0.40, e2Chance:0.45, planeChance:0.15
    },
    hard: {
        e1:7, e2:9, plane:6, maxEnemies:3,
        e1Chance:0.33, e2Chance:0.33, planeChance:0.34
    }
};

function startGame(level) {
    difficulty = level;
    const d = DIFF[level];
    enemy1.speed = d.e1;
    enemy2.speed = d.e2;
    plane.speed = d.plane;

    // boss duration
    bossDuration = getBossDurationForDifficulty(level);

    document.getElementById("difficultyMenu").style.display = "none";
    gameStarted = true;

    if (!muted && startMenuSoundOn) bgMusic.play().catch(()=>{});
    requestAnimationFrame(gameLoop);
}

/* ------------------------------------------------------------
    COLLISION
------------------------------------------------------------ */

function hit(a,b){
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y > b.y - b.height &&
        a.y - a.height < b.y
    );
}

/* ------------------------------------------------------------
    POWERUPS
------------------------------------------------------------ */

function spawnPowerup() {
    if (powerupsOnField.length >= 2) return; // allow up to 2 now
    const type = Math.random() < 0.5 ? "shield" : "magnet";
    powerupsOnField.push({
        x: canvas.width + 300,
        y: 120 + Math.random() * 120,
        width: 48,
        height: 48,
        type,
        float: 0,
        floatDir: 1,
    });
}

function maybeSpawnPowerup() {
    const now = Date.now();
    const next = POWER_SPAWN_MIN + Math.random() * (POWER_SPAWN_MAX - POWER_SPAWN_MIN);
    if (now - lastPowerSpawn > next || (playerHealth < HEALTH_TRIGGER && Math.random() < 0.4)) {
        spawnPowerup();
        lastPowerSpawn = now;
    }
}

function usePowerNearby() {
    if (activePower || powerupsOnField.length === 0) return;
    const p = powerupsOnField.shift();
    activePower = {
        type: p.type,
        expiresAt: Date.now() + (p.type==="shield" ? 5000 : 6000)
    };
    if (!muted) sPickup.play();
}

/* ------------------------------------------------------------
    HEALTH PICKUP
------------------------------------------------------------ */

let healthPickup = {
    x: canvas.width + 400,
    y: 200,
    width: 40,
    height: 40,
    floatOffset: 0,
    floatDir: 1,
    speed: 3
};

/* ------------------------------------------------------------
    BOSS SPAWN LOGIC
    - Trigger when distance >= nextBossDistance
    - Show warning flash for 900ms, then boss enters
------------------------------------------------------------ */

function scheduleNextBoss() {
    nextBossDistance = distance + 300 + Math.random() * 300; // next boss after +300..600m
}

function triggerBoss() {
    if (bossActive || bossWarningActive) return;
    bossWarningActive = true;

    // show warning visual for 900ms then start boss
    setTimeout(() => {
        bossWarningActive = false;
        startBoss();
    }, 900);
}

function startBoss() {
    bossActive = true;
    bossStartTime = Date.now();

    // boss size: 80% width, 50% height; we'll crop bottom half of sprite
    const bw = Math.floor(canvas.width * 0.80);
    const bh = Math.floor(canvas.height * 0.50);

    // boss initial entry off-screen to right
    boss = {
        x: canvas.width + 50,
        y: 20,               // top area
        width: bw,
        height: bh,
        speed: 3,            // entry speed then 0
        entered: false
    };

    // clear normal bullets and pause other enemies while boss active
    bullets = [];
    // move other enemies offscreen
    enemy1.x = -9999;
    plane.x = -9999;

    // give small delay before gossip starts
    setTimeout(()=> spawnBossGossipWave(), 600);
}

/* Boss leaves after duration (handled in gameLoop) */
function endBoss() {
    bossActive = false;
    boss = null;
    bossGossip = [];
    scheduleNextBoss();

    // Reward player
    playerHealth = Math.min(maxHealth, playerHealth + 20);
    score += 500;

    // spawn 1-2 powerups to reward
    spawnPowerup();
    if (Math.random() < 0.6) spawnPowerup();
}

/* ------------------------------------------------------------
    BOSSGOSSIP (boss projectiles) logic
    "gossip" = special projectile name as requested
------------------------------------------------------------ */

function spawnBossGossipWave() {
    if (!bossActive || !boss) return;
    // spawn a horizontal line of gossip projectiles aimed roughly at player area
    const count = 8 + Math.floor(Math.random()*6); // 8..13 gossip
    for (let i=0;i<count;i++){
        const gx = boss.x - (i * 30) - 40; // spread behind boss
        const gy = boss.y + 30 + (Math.random()* (boss.height - 60));
        // small random velocity leftwards, and slight vertical wobble
        bossGossip.push({
            x: gx,
            y: gy,
            w: 16,
            h: 16,
            vx: -3 - Math.random()*2,
            vy: (Math.random()-0.5) * 1.2,
            dmg: 3
        });
    }

    // schedule next wave if boss still active
    const interval = 600 + Math.random()*600; // 600..1200ms
    setTimeout(()=>{
        if (bossActive) spawnBossGossipWave();
    }, interval);
}

/* ------------------------------------------------------------
    NORMAL ENEMY SPAWNER (modified to not spawn enemy2 normally)
------------------------------------------------------------ */

function enemySpawnManager() {
    if (bossActive || bossWarningActive) return; // while boss, stop normal spawns

    const cfg = DIFF[difficulty];
    const maxEnemies = cfg.maxEnemies;

    // Count how many are active (plane considered)
    let count = 0;
    if (enemy1.x > -150) count++;
    if (plane.x > -600) count++;

    if (count >= maxEnemies) return;

    // Roll for enemy type (enemy2 no longer spawns normally)
    const roll = Math.random();

    if (roll < cfg.e1Chance) {
        if (enemy1.x < -150) {
            enemy1.x = canvas.width + 200 + Math.random()*200;
        }
        return;
    }

    if (roll < cfg.e1Chance + cfg.planeChance) {
        if (plane.x < -600) {
            plane.x = canvas.width + 500 + Math.random()*400;
            plane.y = 60 + Math.random()*140;
        }
    }
}

/* ------------------------------------------------------------
    NORMAL BULLETS (spawned by enemies/plane) - paused during boss
------------------------------------------------------------ */

function spawnBullet(enemy) {
    bullets.push({
        x: enemy.x,
        y: enemy.y - 60,
        width: 15,
        height: 15,
        speed: 6
    });
}

/* ------------------------------------------------------------
    MAIN GAME LOOP
------------------------------------------------------------ */

function gameLoop() {
    if (!gameStarted || gameOver) return;

    ctx.clearRect(0,0,canvas.width,canvas.height);

    /* --- Background --- */
    ctx.save();
    ctx.filter = "blur(1px)";
    ctx.drawImage(bg1, bg1X, 0, canvas.width, canvas.height);
    ctx.drawImage(bg1, bg1X + canvas.width, 0, canvas.width, canvas.height);
    ctx.drawImage(bg2, bg2X, 0, canvas.width, canvas.height);
    ctx.drawImage(bg2, bg2X + canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    bg1X -= bg1Speed; if (bg1X <= -canvas.width) bg1X = 0;
    bg2X -= bg2Speed; if (bg2X <= -canvas.width) bg2X = 0;

    /* --- Score / Distance --- */
    score++;
    distance += 0.1;

    if (performance.now() - lastUIUpdate > 200) {
        const sd = document.getElementById("scoreDisplay");
        const dd = document.getElementById("distanceDisplay");
        const hd = document.getElementById("highDisplay");
        if (sd) sd.innerText = "Score: " + score;
        if (dd) dd.innerText = "Distance: " + distance.toFixed(1) + " m";
        if (hd) hd.innerText = "High: " + highScore.toFixed(1);
        lastUIUpdate = performance.now();
    }

    /* --- Ground --- */
    ctx.fillStyle = "#222";
    ctx.fillRect(0, GROUND_Y + 10, canvas.width, 10);

    /* --- Runner physics (vertical + horizontal) --- */
    runner.yVelocity += runner.gravity;
    runner.y += runner.yVelocity;

    // horizontal drift friction
    runner.x += runner.xVelocity;
    runner.xVelocity *= (1 - runner.xFriction);

    // clamp x
    if (runner.x < runner.minX) { runner.x = runner.minX; runner.xVelocity = 0; }
    if (runner.x > runner.maxX) { runner.x = runner.maxX; runner.xVelocity *= 0.4; }

    // ground collision
    if (runner.y > GROUND_Y) {
        runner.y = GROUND_Y;
        runner.yVelocity = 0;
        jumpCount = 0;
    }

    // Draw runner
    ctx.drawImage(runnerImg, runner.x, runner.y - runner.height, runner.width, runner.height);

    /* --- Boss warning flash overlay --- */
    if (bossWarningActive) {
        ctx.save();
        ctx.fillStyle = "rgba(255,0,0,0.28)";
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = "white";
        ctx.font = "36px Arial";
        ctx.textAlign = "center";
        ctx.fillText("WARNING! BOSS INCOMING", canvas.width/2, canvas.height/2);
        ctx.restore();
    }

    /* --- Boss handling --- */
    if (bossActive && boss) {
        // boss entry: move left until centered position
        const targetX = (canvas.width - boss.width) / 1.05; // keep slightly right-of-center
        if (!boss.entered) {
            boss.x -= boss.speed;
            if (boss.x <= targetX) {
                boss.x = targetX;
                boss.entered = true;
            }
        } else {
            // stay in place
        }

        // draw boss using top half of sprite (crop bottom half)
        if (enemy2Img.complete && enemy2Img.naturalWidth) {
            const sx = 0;
            const sy = 0;
            const sw = enemy2Img.naturalWidth;
            const sh = Math.floor(enemy2Img.naturalHeight / 2); // crop bottom half
            ctx.drawImage(enemy2Img, sx, sy, sw, sh, boss.x, boss.y, boss.width, boss.height);
        } else {
            // fallback: draw scaled sprite without cropping
            ctx.drawImage(enemy2Img, boss.x, boss.y, boss.width, boss.height);
        }

        // spawn gossip projectiles movement & render
        for (let i = bossGossip.length - 1; i >= 0; i--) {
            const g = bossGossip[i];
            g.x += g.vx;
            g.y += g.vy;
            // gentle gravity on gossip
            g.vy += 0.02;

            ctx.fillStyle = "#ffdd55";
            ctx.fillRect(g.x, g.y, g.w, g.h);

            // collision with runner
            const gbox = { x: g.x, y: g.y, width: g.w, height: g.h };
            const rbox = { x: runner.x, y: runner.y, width: runner.width, height: runner.height };
            if (hit(rbox, gbox)) {
                playerHealth -= g.dmg;
                // remove gossip
                bossGossip.splice(i,1);
                if (!muted) sHit.play();
                continue;
            }

            // remove off-screen gossip
            if (g.x < -50 || g.y > canvas.height + 50 || g.y < -100) bossGossip.splice(i,1);
        }

        // check boss duration expiry
        if (Date.now() - bossStartTime >= bossDuration) {
            // boss leaves
            // animate exit quickly to the right (optional)
            // simple end
            endBoss();
        }
    } else {
        // Not bossActive: normal enemy movement/draw
        enemy1.x -= enemy1.speed;
        plane.x  -= plane.speed;

        enemySpawnManager();

        ctx.drawImage(enemy1Img, enemy1.x, enemy1.y - enemy1.height, enemy1.width, enemy1.height);
        ctx.drawImage(planeImg, plane.x, plane.y, plane.width, plane.height);

        // normal bullets (enemies/plane)
        let shotDelay = 3500;
        if (difficulty === "medium") shotDelay = 2800;
        if (difficulty === "hard") shotDelay = 2200;

        if (Date.now() - lastEnemyShot > shotDelay) {
            const d = DIFF[difficulty];
            // only spawn bullets when those enemies are onscreen
            if (Math.random() < 0.5 && enemy1.x > -100 && enemy1.x < canvas.width) spawnBullet(enemy1);
            if (Math.random() < 0.4 && plane.x > -100 && plane.x < canvas.width) spawnBullet(plane);
            lastEnemyShot = Date.now();
        }

        ctx.fillStyle = "yellow";
        bullets.forEach(b => {
            let sp = b.speed;
            if (difficulty === "easy") sp *= 0.5;
            if (difficulty === "medium") sp *= 0.8;
            b.x -= sp;
            ctx.fillRect(b.x, b.y, b.width, b.height);
        });
        bullets = bullets.filter(b => b.x > -50);

        // check boss trigger by distance
        if (!bossActive && !bossWarningActive && distance >= nextBossDistance) {
            triggerBoss();
        }
    }

    /* --- Health pickup --- */
    healthPickup.x -= healthPickup.speed;
    healthPickup.floatOffset += 0.3 * healthPickup.floatDir;
    if (healthPickup.floatOffset > 10 || healthPickup.floatOffset < -10) healthPickup.floatDir *= -1;

    ctx.drawImage(healthImg,
        healthPickup.x,
        healthPickup.y + healthPickup.floatOffset,
        healthPickup.width,
        healthPickup.height
    );

    if (healthPickup.x < -100 || Date.now() - lastHealthSpawn > 15000) {
        healthPickup.x = canvas.width + 400;
        healthPickup.y = 150 + Math.random() * 120;
        lastHealthSpawn = Date.now();
    }

    /* --- Powerups --- */
    maybeSpawnPowerup();

    for (let i = powerupsOnField.length - 1; i >= 0; i--) {
        const p = powerupsOnField[i];
        p.x -= 3;
        p.float += 0.3 * p.floatDir;
        if (p.float > 8 || p.float < -8) p.floatDir *= -1;

        ctx.fillStyle = p.type === "shield" ? "#55f" : "#f88";
        ctx.beginPath();
        ctx.arc(p.x + p.width / 2, p.y + p.height / 2 + p.float, 20, 0, Math.PI * 2);
        ctx.fill();

        const pbox = { x: p.x, y: p.y + p.float, width: p.width, height: p.height };
        const rbox = { x: runner.x, y: runner.y, width: runner.width, height: runner.height };

        if (hit(rbox, pbox)) {
            if (!muted) sPickup.play();
            activePower = {
                type: p.type,
                expiresAt: Date.now() + (p.type === "shield" ? 5000 : 6000)
            };
            powerupsOnField.splice(i, 1);
        }
    }

    /* --- ACTIVE POWER EFFECTS --- */
    if (activePower) {
        if (activePower.type === "shield") {
            ctx.save();
            ctx.globalAlpha = 0.18;
            ctx.fillStyle = "#99c9ff";
            ctx.beginPath();
            ctx.arc(runner.x + runner.width / 2, runner.y - runner.height / 2, 90, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        if (activePower.type === "magnet") {
            // magnet affects healthPickup only
            healthPickup.x += (runner.x - healthPickup.x) * 0.03;
            healthPickup.y += (runner.y - healthPickup.y) * 0.03;
        }

        if (Date.now() > activePower.expiresAt) activePower = null;
    }

    /* --- COLLISIONS (runner vs enemies & bullets & gossip) --- */
    const rbox = { x: runner.x, y: runner.y, width: runner.width, height: runner.height };

    if (!activePower || activePower.type !== "shield") {
        // normal enemies only check if not bossActive (enemy1 may still be present)
        if (!bossActive) {
            if (enemy1.x > -200 && hit(rbox, { x: enemy1.x, y: enemy1.y, width: enemy1.width, height: enemy1.height })) {
                playerHealth -= 1;
            }
            if (plane.x > -600 && hit(rbox, { x: plane.x, y: plane.y + plane.height * 0.2, width: plane.width, height: plane.height * 0.6 })) {
                playerHealth -= 2;
            }
        }

        // normal bullets
        bullets.forEach(b => {
            if (hit(rbox, { x: b.x, y: b.y, width: b.width, height: b.height })) {
                playerHealth -= 2;
                b.x = -999;
                if (!muted) sHit.play();
            }
        });

        // boss gossip collisions
        bossGossip.forEach(g => {
            if (hit(rbox, { x: g.x, y: g.y, width: g.w, height: g.h })) {
                playerHealth -= g.dmg;
                g.x = -9999;
                if (!muted) sHit.play();
            }
        });
    }

    // health pickup collision
    if (hit(rbox, healthPickup)) {
        playerHealth = Math.min(maxHealth, playerHealth + 20);
        healthPickup.x = -300;
        if (!muted) sPickup.play();
    }

    /* --- HEALTH BAR --- */
    ctx.fillStyle = "red";
    ctx.fillRect(20, 20, 200, 20);

    ctx.fillStyle = "green";
    ctx.fillRect(20, 20, (playerHealth / maxHealth) * 200, 20);

    ctx.strokeStyle = "black";
    ctx.strokeRect(20, 20, 200, 20);

    /* --- END CONDS --- */
    if (playerHealth <= 0) return endGame();

    requestAnimationFrame(gameLoop);
}

/* ------------------------------------------------------------
    GAME OVER
------------------------------------------------------------ */

function endGame() {
    gameOver = true;
    if (!muted) sGameOver.play();
    if (distance > highScore) {
        highScore = distance;
        localStorage.setItem("highScore", highScore.toFixed(1));
    }
    const fd = document.getElementById("finalDistance");
    const fh = document.getElementById("finalHigh");
    if (fd) fd.innerText = "Distance: " + distance.toFixed(1) + " m";
    if (fh) fh.innerText = "High Score: " + highScore.toFixed(1) + " m";
    document.getElementById("gameover-overlay").style.display = "flex";
}

/* ------------------------------------------------------------
    EXTRA: spawn initial boss schedule and start-menu sound toggle
------------------------------------------------------------ */

// start menu sound toggle integration (if you used the prior version)
let startMenuSoundOn = true; // default on, controlled by your menu if present
// if your index.html has a button with id "soundToggleBtn" we wire it
if (document.getElementById("soundToggleBtn")) {
    document.getElementById("soundToggleBtn").addEventListener("click", () => {
        startMenuSoundOn = !startMenuSoundOn;
        document.getElementById("soundToggleBtn").innerText = startMenuSoundOn ? "Sound: ON" : "Sound: OFF";
        setMuted(!startMenuSoundOn);
    });
}

// ensure boss schedule initialised
scheduleNextBoss();
