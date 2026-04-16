const canvas = document.getElementById("caveGame");
const ctx = canvas.getContext("2d");

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// ======================
// ASSETS & STATE
// ======================
const titleImage = new Image();
titleImage.src = "https://i.postimg.cc/9FkGYZd6/Gemini-Generated-Image-qx8anfqx8anfqx8a.png";

const gameOverImage = new Image();
gameOverImage.src = "https://i.postimg.cc/Pr0wwhht/Gemini-Generated-Image-8xafco8xafco8xaf.png";

const bgImage = new Image();
bgImage.src = "https://i.postimg.cc/zXjz6YB0/Gemini-Generated-Image-vvpa8wvvpa8wvvpa.png";

let leaderBoard = JSON.parse(localStorage.getItem("caveGameLeaderBoard")) || [1, 1, 1];
let started = false;
let gameOver = false;
let caveCount = 1; 
let levelPhase = "PARKOUR"; 
let upgradeMessage = "";
let upgradeTimer = 0;

const STEP = 1000 / 60;
let last = performance.now();
let acc = 0;

// ======================
// AUDIO 
// ======================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audio;
let masterGain;

function initAudio() {
    audio = new AudioCtx();
    masterGain = audio.createGain();
    masterGain.gain.value = 0.35; 
    masterGain.connect(audio.destination);
}

function tone(freq, time = 0.1, vol = 0.2, type = "square") {
    if (gameOver || !audio) return; 
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(masterGain);
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + time);
    o.start(); o.stop(audio.currentTime + time);
}

function musicLoop() {
    setInterval(() => {
        if (!started || levelPhase === "LOOT" || gameOver) return;
        tone(60 + Math.random() * 40, 0.15, 0.15); 
    }, 220);
}

// ======================
// INPUT
// ======================
const keys = {};
let mouseX = 0;
let mouseY = 0;

window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);
window.addEventListener("mousemove", e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});
window.addEventListener("mousedown", () => keys["Mouse"] = true);
window.addEventListener("mouseup", () => keys["Mouse"] = false);

canvas.onclick = async () => {
    if (!started) {
        if (mouseY > canvas.height - 120 && mouseY < canvas.height - 80) {
            if (mouseX > canvas.width/2 - 200 && mouseX < canvas.width/2 - 100) { player.maxHp = 300; player.hp = 300; } 
            else if (mouseX > canvas.width/2 - 50 && mouseX < canvas.width/2 + 50) { player.maxHp = 200; player.hp = 200; } 
            else if (mouseX > canvas.width/2 + 100 && mouseX < canvas.width/2 + 200) { player.maxHp = 100; player.hp = 100; } 
            else return;
        } else return;

        initAudio();
        started = true;
        musicLoop();
        initLevel();
    } else if (gameOver) {
        if (mouseX > canvas.width/2 - 100 && mouseX < canvas.width/2 + 100 && mouseY > canvas.height/2 + 130 && mouseY < canvas.height/2 + 170) {
            gameOver = false; started = false; caveCount = 1;
            player.hp = player.maxHp; player.upgrades = { spread: false, maxJumps: 2, fireRate: 8 };
            return;
        }
        gameOver = false; caveCount = 1; player.hp = player.maxHp; 
        player.upgrades = { spread: false, maxJumps: 2, fireRate: 8 };
        initLevel();
    }
};

// ======================
// PLAYER & MECHANICS
// ======================
const player = {
    x: 100, y: 100, vx: 0, vy: 0, w: 32, h: 48,
    hp: 200, maxHp: 200, facing: 1, jumps: 0, alive: true, onGround: false,
    upgrades: { spread: false, maxJumps: 2, fireRate: 8 }
};
const gravity = 0.7;

let platforms = [], spikes = [], bullets = [], enemyBullets = [], blood = [], chunks = [], potions = [], basicEnemies = [];
const interactables = { hasKey: false, puzzleType: "KEY", keyX: 0, keyY: 0, doorX: 0, doorY: 0, targets: [], switchActive: false, switchX: 0, switchY: 0, lasers: [] };
const boss = { type: "VAPORIZER", x: 1400, y: 200, hp: 150, maxHp: 150, phase: 1, attackCooldown: 0, dead: false, deadTimer: 0 };
const bossTypes = ["VAPORIZER", "BEE", "VOID_EYE", "SYSTEM_GLITCH"];

let cameraX = 0;
let shake = 0;
let shootCD = 0;

function initLevel() {
    player.alive = true; player.x = 100; player.y = 100; player.vx = 0; player.vy = 0;
    platforms = []; spikes = []; bullets = []; enemyBullets = []; potions = []; blood = []; chunks = []; basicEnemies = [];
    levelPhase = "PARKOUR";
    interactables.hasKey = false; interactables.targets = []; interactables.lasers = []; interactables.switchActive = false;

    if (caveCount === 1) interactables.puzzleType = "KEY";
    else if (caveCount === 2) interactables.puzzleType = "TARGETS";
    else interactables.puzzleType = "SWITCH";

    let lastX = 50, lastY = 320;
    platforms.push({ x: lastX, y: lastY, w: 200, h: 20 });

    for (let i = 1; i < 80; i++) {
        let gapX = 120 + Math.random() * 80;
        let px = lastX + gapX;
        let py = Math.max(200, Math.min(600, lastY + (Math.random() - 0.5) * 180));
        let pw = 80 + Math.random() * 100;
        platforms.push({ x: px, y: py, w: pw, h: 20 });
        lastX = px; lastY = py;

        if (i > 3 && Math.random() < 0.15) potions.push({ x: px + (pw / 2), y: py - 20, isSuper: Math.random() < 0.10 });
        if (i > 5 && Math.random() < 0.25 + (caveCount * 0.05)) {
            if (Math.random() > 0.5 && pw > 100) basicEnemies.push({ type: "HELMET", x: px + pw/2, y: py - 20, w: 24, h: 20, vx: 2, minX: px, maxX: px + pw, hp: 15, cd: 0 });
            else basicEnemies.push({ type: "MINI_VAPE", x: px + Math.random()*pw, y: py - 100 - Math.random()*50, w: 20, h: 20, hp: 10, cd: 0, startY: py - 100 });
        }
    }

    platforms.forEach((p, idx) => {
        if (idx > 2 && idx < platforms.length - 3 && Math.random() < 0.40) {
            spikes.push({ x: p.x + 5 + Math.random() * (p.w - 40), y: p.y, w: 30, h: 25 });
        }
    });

    let keyIndex = Math.floor(Math.random() * (platforms.length - 20)) + 10;
    interactables.keyX = platforms[keyIndex].x + (platforms[keyIndex].w / 2);
    interactables.keyY = platforms[keyIndex].y - 30;

    if (interactables.puzzleType === "TARGETS") {
        for(let j=0; j<3; j++) {
            let plat = platforms[Math.floor(Math.random()*(platforms.length-20))+10];
            interactables.targets.push({x: plat.x+plat.w/2, y: plat.y-40, active: true, radius: 15});
        }
    } else if (interactables.puzzleType === "SWITCH") {
        let sPlat = platforms[Math.floor(Math.random()*(platforms.length-30))+10];
        interactables.switchX = sPlat.x + sPlat.w/2;
        interactables.switchY = sPlat.y - 30;
        interactables.lasers.push({x: interactables.keyX - 40, y: interactables.keyY - 100, w: 10, h: 120}, {x: interactables.keyX + 30, y: interactables.keyY - 100, w: 10, h: 120});
    }

    let endPlat = platforms[platforms.length - 1];
    interactables.doorX = endPlat.x + (endPlat.w / 2) - 20;
    interactables.doorY = endPlat.y - 60;
    boss.type = bossTypes[(caveCount - 1) % bossTypes.length];
    boss.maxHp = 150 + (50 * caveCount);
    boss.hp = boss.maxHp; boss.dead = false; boss.x = endPlat.x + 800; boss.y = endPlat.y - 150;
}

function spawnBlood(x, y) { for (let i = 0; i < 40; i++) blood.push({ x, y, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 8, life: 120, color: "rgba(180, 0, 0, 0.8)", pooled: false, w: 4 }); }
function spawnChunks(x, y, color = "#880000") { for (let i = 0; i < 10; i++) chunks.push({ x, y, vx: (Math.random() - 0.5) * 10, vy: -Math.random() * 8, life: 70, color }); }
function explode(x, y, color) { spawnBlood(x, y); spawnChunks(x, y, color); }

function update(dt) {
    if (!started || gameOver) return;
    if (player.hp <= 0) {
        player.alive = false; gameOver = true; explode(player.x, player.y); shake = 40;
        leaderBoard.push(caveCount); leaderBoard.sort((a,b)=>b-a); leaderBoard = leaderBoard.slice(0,3);
        localStorage.setItem("caveGameLeaderBoard", JSON.stringify(leaderBoard));
        tone(40, 1.0, 0.8, "sawtooth"); return;
    }

    if (keys["a"] || keys["ArrowLeft"]) player.vx = -5; else if (keys["d"] || keys["ArrowRight"]) player.vx = 5; else player.vx *= 0.85;
    player.facing = (mouseX + cameraX) > (player.x + player.w/2) ? 1 : -1;

    if ((keys["w"] || keys[" "] || keys["ArrowUp"]) && player.jumps < player.upgrades.maxJumps) {
        player.vy = -13; player.jumps++; tone(500, 0.08, 0.25); keys["w"] = keys[" "] = keys["ArrowUp"] = false;
    }

    shootCD -= dt;
    if ((keys["f"] || keys["Mouse"]) && shootCD <= 0 && levelPhase !== "LOOT") {
        let angle = Math.atan2(mouseY - (player.y + 20), (mouseX + cameraX) - (player.x + player.w / 2));
        const fire = (a) => bullets.push({ x: player.x+16, y: player.y+20, vx: Math.cos(a)*18, vy: Math.sin(a)*18 });
        fire(angle); if (player.upgrades.spread) { fire(angle-0.2); fire(angle+0.2); }
        tone(900, 0.05, 0.2); shootCD = player.upgrades.fireRate;
    }

    player.vy += gravity * dt; player.x += player.vx * dt; player.y += player.vy * dt;
    player.onGround = false;
    platforms.forEach(p => { if (player.x < p.x + p.w && player.x + player.w > p.x && player.y + player.h > p.y && player.y < p.y + p.h && player.vy > 0) { player.y = p.y - player.h; player.vy = 0; player.onGround = true; player.jumps = 0; } });
    if (player.y > 2000) player.hp = 0;

    spikes.forEach(s => { if (player.x < s.x + s.w && player.x + player.w > s.x && player.y + player.h > s.y - s.h && player.y < s.y) { player.hp -= 2 * dt; shake = 10; } });
    potions = potions.filter(pot => { if (Math.hypot(player.x+16-pot.x, player.y+24-pot.y) < 30) { if(pot.isSuper) player.hp = player.maxHp; else player.hp = Math.min(player.maxHp, player.hp+25); tone(800, 0.1, 0.3); return false; } return true; });

    basicEnemies.forEach((e, i) => {
        e.cd -= dt;
        if (e.type === "HELMET") { e.x += e.vx * dt; if (e.x > e.maxX || e.x < e.minX) e.vx *= -1; if (e.cd <= 0 && Math.abs(player.x - e.x) < 400) { enemyBullets.push({ x: e.x, y: e.y, vx: (player.x > e.x ? 1 : -1) * 6, vy: 0.1 }); e.cd = 60; } }
        else { e.y = e.startY + Math.sin(performance.now() * 0.003 + e.x) * 20; if (e.cd <= 0 && Math.abs(player.x - e.x) < 300) { let dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy); enemyBullets.push({ x: e.x, y: e.y, vx: (dx/d)*5, vy: (dy/d)*5 }); e.cd = 90; } }
        bullets.forEach(b => { if (b.x > e.x-15 && b.x < e.x+15 && b.y > e.y-15 && b.y < e.y+15) { e.hp -= 5; b.vx = 0; explode(e.x, e.y, "#999"); } });
        if (e.hp <= 0) { explode(e.x, e.y, "#444"); basicEnemies.splice(i,1); }
    });

    if (levelPhase === "PARKOUR") {
        if (!interactables.hasKey && Math.hypot(player.x - interactables.keyX, player.y - interactables.keyY) < 40) interactables.hasKey = true;
        if (interactables.hasKey && player.x > interactables.doorX && player.x < interactables.doorX + 40 && player.y > interactables.doorY && player.y < interactables.doorY + 60) { levelPhase = "BOSS"; boss.x = player.x + 500; }
    }

    if (levelPhase === "BOSS") {
        if (boss.hp <= 0 && !boss.dead) { boss.dead = true; boss.deadTimer = 150; }
        if (boss.dead) { boss.deadTimer -= dt; if (boss.deadTimer <= 0) levelPhase = "LOOT"; } 
        else {
            boss.attackCooldown -= dt;
            let speed = boss.type === "VAPORIZER" ? 0.03 : 0.01;
            boss.x += (player.x - boss.x) * speed; boss.y += (player.y - 100 - boss.y) * speed;
            if (boss.attackCooldown <= 0) { enemyBullets.push({ x: boss.x, y: boss.y, vx: (player.x-boss.x)*0.02, vy: (player.y-boss.y)*0.02 }); boss.attackCooldown = 60; }
            bullets.forEach(b => { if (Math.hypot(b.x-boss.x, b.y-boss.y) < 40) { boss.hp -= 3; b.vx = 0; explode(boss.x, boss.y, "#111"); } });
        }
    }

    bullets.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; });
    enemyBullets.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; if (Math.hypot(b.x-player.x-16, b.y-player.y-24) < 20) { player.hp -= 10; b.vx = 0; } });
    
    blood.forEach(b => { if (!b.pooled) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 0.3 * dt; platforms.forEach(p => { if (b.x > p.x && b.x < p.x+p.w && b.y > p.y && b.y < p.y+10) { b.pooled = true; b.y = p.y; b.life = 600; } }); } b.life--; });
    cameraX = player.x - canvas.width / 3;
    if (shake > 0) shake--;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!started) {
        if (titleImage.complete) ctx.drawImage(titleImage, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.font = "20px Arial";
        ctx.fillText("SELECT DIFFICULTY: EASY | MEDIUM | HARD", canvas.width/2, canvas.height-100);
        return;
    }

    if (bgImage.complete) ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(-cameraX + (Math.random()-0.5)*shake, (Math.random()-0.5)*shake);

    ctx.fillStyle = "#C2A88D"; platforms.forEach(p => ctx.fillRect(p.x, p.y, p.w, p.h));
    potions.forEach(p => { ctx.font = "20px Arial"; ctx.fillText(p.isSuper ? "💕" : "❤️", p.x, p.y); });
    
    // Player
    ctx.strokeStyle = "white"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(player.x+16, player.y+12, 8, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(player.x+16, player.y+20); ctx.lineTo(player.x+16, player.y+35); ctx.stroke();

    // Boss rendering
    if ((levelPhase === "BOSS" || levelPhase === "LOOT") && (!boss.dead || Math.floor(boss.deadTimer)%4 !== 0)) {
        ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(boss.x, boss.y, 30, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "red"; ctx.shadowBlur = 10; ctx.shadowColor = "red";
        ctx.beginPath(); ctx.arc(boss.x-10, boss.y-5, 5, 0, Math.PI*2); ctx.arc(boss.x+10, boss.y-5, 5, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
    }

    ctx.fillStyle = "yellow"; bullets.forEach(b => ctx.fillRect(b.x, b.y, 8, 8));
    ctx.fillStyle = "cyan"; enemyBullets.forEach(b => ctx.fillRect(b.x, b.y, 6, 6));
    ctx.fillStyle = "red"; blood.forEach(b => ctx.fillRect(b.x, b.y, b.w, 2));

    ctx.restore();

    ctx.fillStyle = "white"; ctx.font = "20px Arial"; ctx.textAlign = "left";
    ctx.fillText(`HP: ${Math.ceil(player.hp)} | CAVE: ${caveCount}`, 20, 40);

    if (gameOver) {
        if (gameOverImage.complete) ctx.drawImage(gameOverImage, 0, 0, canvas.width, canvas.height);
        else { ctx.fillStyle = "red"; ctx.textAlign = "center"; ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2); }
    }
}

function loop(now) {
    acc += now - last; last = now;
    while (acc >= STEP) { update(1); acc -= STEP; }
    draw(); requestAnimationFrame(loop);
}
loop(performance.now());