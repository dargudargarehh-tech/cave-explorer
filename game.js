window.addEventListener("DOMContentLoaded", () => {

(() => {

    // ======================
    // SAFE INIT (prevents Vercel timing issues)
    // ======================
    const old = document.getElementById("caveGame");
    if (old) old.remove();

    const canvas = document.createElement("canvas");
    canvas.id = "caveGame";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    function resize() {
        canvas.width = innerWidth;
        canvas.height = innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // =========================================================
    // 👇 EVERYTHING BELOW IS YOUR ORIGINAL CODE UNCHANGED
    // =========================================================

    (() => {
    const old = document.getElementById("caveGame");
    if (old) old.remove();

    const canvas = document.createElement("canvas");
    canvas.id = "caveGame";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.zIndex = "999999";
    canvas.style.background = "#111"; 
    // Change cursor to a crosshair to help with aiming
    canvas.style.cursor = "crosshair";

    function resize() {
        canvas.width = innerWidth;
        canvas.height = innerHeight;
    }
    resize();
    addEventListener("resize", resize);

    // ======================
    // CUSTOM IMAGE SLOTS
    // ======================
    const titleImage = new Image();
    titleImage.src = "https://i.postimg.cc/9FkGYZd6/Gemini-Generated-Image-qx8anfqx8anfqx8a.png";

    const gameOverImage = new Image();
    gameOverImage.src = "https://i.postimg.cc/Pr0wwhht/Gemini-Generated-Image-8xafco8xafco8xaf.png";

    const bgImage = new Image();
    bgImage.src = "https://i.postimg.cc/zXjz6YB0/Gemini-Generated-Image-vvpa8wvvpa8wvvpa.png";

    // ======================
    // LEADERBOARD & STATE
    // ======================
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
    const audio = new AudioCtx();
    let masterGain = audio.createGain();
    masterGain.gain.value = 0.35; 
    masterGain.connect(audio.destination);

    function tone(freq, time = 0.1, vol = 0.2, type = "square") {
        if (gameOver) return; 
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.type = type; o.frequency.value = freq;
        o.connect(g); g.connect(masterGain);
        g.gain.value = vol;
        g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + time);
        o.start(); o.stop(audio.currentTime + time);
    }

    function music() {
        setInterval(() => {
            if (!started || levelPhase === "LOOT" || gameOver) return;
            // Increased volume from 0.05 to 0.15 for a much louder, driving bassline
            tone(60 + Math.random() * 40, 0.15, 0.15); 
        }, 220);
    }

    // ======================
    // INPUT & DIFFICULTY
    // ======================
    const keys = {};
    let mouseX = canvas.width / 2;
    let mouseY = canvas.height / 2;

    addEventListener("keydown", e => keys[e.key] = true);
    addEventListener("keyup", e => keys[e.key] = false);
    
    // NEW: Mouse tracking for aiming
    addEventListener("mousemove", e => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    });

    addEventListener("mousedown", () => keys["Mouse"] = true);
    addEventListener("mouseup", () => keys["Mouse"] = false);

    canvas.onclick = async (e) => {
        if (!started) {
            if (mouseY > canvas.height - 120 && mouseY < canvas.height - 80) {
                if (mouseX > canvas.width/2 - 200 && mouseX < canvas.width/2 - 100) { player.maxHp = 300; player.hp = 300; } 
                else if (mouseX > canvas.width/2 - 50 && mouseX < canvas.width/2 + 50) { player.maxHp = 200; player.hp = 200; } 
                else if (mouseX > canvas.width/2 + 100 && mouseX < canvas.width/2 + 200) { player.maxHp = 100; player.hp = 100; } 
                else return; 
            } else {
                return; 
            }

            started = true;
            await audio.resume();
            music();
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
    // PLAYER & UPGRADES
    // ======================
    const player = {
        x: 100, y: 100, vx: 0, vy: 0, w: 32, h: 48,
        hp: 200, maxHp: 200, facing: 1, jumps: 0, alive: true, onGround: false,
        upgrades: { spread: false, maxJumps: 2, fireRate: 8 }
    };
    const gravity = 0.7;

    // ======================
    // ENTITIES & POOLS
    // ======================
    let platforms = [];
    let spikes = [];
    let bullets = [];
    let enemyBullets = [];
    let blood = [];
    let chunks = [];
    let potions = []; 
    let basicEnemies = []; 

    const interactables = { 
        hasKey: false, puzzleType: "KEY", 
        keyX: 0, keyY: 0, doorX: 0, doorY: 0, 
        targets: [], switchActive: false, switchX: 0, switchY: 0, lasers: [] 
    };

    const boss = { type: "VAPORIZER", x: 1400, y: 200, hp: 150, maxHp: 150, phase: 1, attackCooldown: 0, dead: false, deadTimer: 0 };
    const bossTypes = ["VAPORIZER", "BEE", "VOID_EYE", "SYSTEM_GLITCH"];

    let cameraX = 0;
    let shake = 0;
    let shootCD = 0;

    // ======================
    // LEVEL GENERATION
    // ======================
    function initLevel() {
        player.alive = true; player.x = 100; player.y = 100; player.vx = 0; player.vy = 0;
        platforms = []; spikes = []; bullets = []; enemyBullets = []; potions = []; blood = []; chunks = []; basicEnemies = [];
        levelPhase = "PARKOUR";
        
        interactables.hasKey = false;
        interactables.targets = [];
        interactables.lasers = [];
        interactables.switchActive = false;
        
        if (caveCount === 1) interactables.puzzleType = "KEY";
        else if (caveCount === 2) interactables.puzzleType = "TARGETS";
        else interactables.puzzleType = "SWITCH";

        let lastX = 50;
        let lastY = 320;
        
        platforms.push({ x: lastX, y: lastY, w: 200, h: 20 });

        for (let i = 1; i < 80; i++) {
            let gapX = 120 + Math.random() * 80;
            let px = lastX + gapX;
            let heightShift = (Math.random() - 0.5) * 180;
            let py = Math.max(200, Math.min(600, lastY + heightShift));
            let pw = 80 + Math.random() * 100;
            
            platforms.push({ x: px, y: py, w: pw, h: 20 });
            lastX = px; lastY = py;
            
            // NEW: 10% chance for a spawned potion to be a super heart (💕)
            if (i > 3 && Math.random() < 0.15) {
                potions.push({ x: px + (pw / 2), y: py - 20, isSuper: Math.random() < 0.10 });
            }

            if (i > 5 && Math.random() < 0.25 + (caveCount * 0.05)) {
                if (Math.random() > 0.5 && pw > 100) {
                    basicEnemies.push({ type: "HELMET", x: px + pw/2, y: py - 20, w: 24, h: 20, vx: 2, minX: px, maxX: px + pw, hp: 15, cd: 0 });
                } else {
                    basicEnemies.push({ type: "MINI_VAPE", x: px + Math.random()*pw, y: py - 100 - Math.random()*50, w: 20, h: 20, hp: 10, cd: 0, startY: py - 100 });
                }
            }
        }

        platforms.forEach((p, index) => {
            if (index > 2 && index < platforms.length - 3) {
                if (Math.random() < 0.40) {
                    let sWidth = 30; let sHeight = 25;
                    let sx = p.x + 5 + Math.random() * (p.w - sWidth - 10);
                    spikes.push({ x: sx, y: p.y, w: sWidth, h: sHeight });
                }
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
            interactables.lasers.push({x: interactables.keyX - 40, y: interactables.keyY - 100, w: 10, h: 120});
            interactables.lasers.push({x: interactables.keyX + 30, y: interactables.keyY - 100, w: 10, h: 120});
        }

        let endPlat = platforms[platforms.length - 1];
        interactables.doorX = endPlat.x + (endPlat.w / 2) - 20;
        interactables.doorY = endPlat.y - 60;

        boss.type = bossTypes[(caveCount - 1) % bossTypes.length];
        boss.maxHp = 150 + (50 * caveCount);
        boss.hp = boss.maxHp; boss.dead = false; boss.phase = 1;
        boss.x = endPlat.x + 800; boss.y = endPlat.y - 150;
    }

    function grantLoot() {
        const loots = ["MAX HP +50", "SPREAD SHOT", "TRIPLE JUMP", "RAPID FIRE"];
        let choice = Math.floor(Math.random() * loots.length);
        if (choice === 0) { player.maxHp += 50; player.hp = player.maxHp; }
        if (choice === 1) player.upgrades.spread = true;
        if (choice === 2) player.upgrades.maxJumps = 3;
        if (choice === 3) player.upgrades.fireRate = 4;

        upgradeMessage = "GOT: " + loots[choice] + "!";
        upgradeTimer = 180;
    }

    function spawnBlood(x, y) {
        for (let i = 0; i < 40; i++) blood.push({ x, y, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 8, life: 120, color: "rgba(180, 0, 0, 0.8)", pooled: false, w: 4 });
    }
    function spawnChunks(x, y, color = "#880000") {
        for (let i = 0; i < 10; i++) chunks.push({ x, y, vx: (Math.random() - 0.5) * 10, vy: -Math.random() * 8, life: 70, color: color });
    }
    function explode(x, y, color = "#880000") { spawnBlood(x, y); spawnChunks(x, y, color); }

    // ======================
    // UPDATE
    // ======================
    function update(dt) {
        if (!started) return;

        if (player.hp <= 0 && player.alive) {
            player.alive = false; gameOver = true; explode(player.x, player.y); shake = 40; keys["Mouse"] = false;
            leaderBoard.push(caveCount); leaderBoard.sort((a, b) => b - a); leaderBoard = leaderBoard.slice(0, 3);
            localStorage.setItem("caveGameLeaderBoard", JSON.stringify(leaderBoard));
            const o = audio.createOscillator(); const g = audio.createGain();
            o.type = "sawtooth"; o.frequency.value = 40; o.connect(g); g.connect(masterGain);
            g.gain.value = 0.8; g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 1.0); o.start(); o.stop(audio.currentTime + 1.0);
        }

        if (!gameOver) {
            if (keys["a"] || keys["ArrowLeft"]) { player.vx = -5; }
            else if (keys["d"] || keys["ArrowRight"]) { player.vx = 5; }
            else player.vx *= 0.85;

            // Update facing based on mouse position relative to player
            player.facing = (mouseX + cameraX) > (player.x + player.w/2) ? 1 : -1;

            if ((keys["w"] || keys[" "] || keys["ArrowUp"]) && player.jumps < player.upgrades.maxJumps) {
                player.vy = -13; player.jumps++; tone(500, 0.08, 0.25); keys["w"] = keys[" "] = keys["ArrowUp"] = false;
            }

            shootCD -= dt;
            // NEW: Shoot towards cursor using 'F' or Left-Click
            if ((keys["f"] || keys["Mouse"]) && shootCD <= 0 && levelPhase !== "LOOT") {
                let dx = (mouseX + cameraX) - (player.x + player.w / 2);
                let dy = mouseY - (player.y + 20);
                let angle = Math.atan2(dy, dx);
                let speed = 18;

                bullets.push({ x: player.x + (player.w / 2), y: player.y + 20, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
                
                if (player.upgrades.spread) {
                    bullets.push({ x: player.x + (player.w / 2), y: player.y + 20, vx: Math.cos(angle - 0.2) * speed, vy: Math.sin(angle - 0.2) * speed });
                    bullets.push({ x: player.x + (player.w / 2), y: player.y + 20, vx: Math.cos(angle + 0.2) * speed, vy: Math.sin(angle + 0.2) * speed });
                }
                tone(900, 0.05, 0.2); shootCD = player.upgrades.fireRate;
            }

            player.vy += gravity * dt; player.x += player.vx * dt; player.y += player.vy * dt;
            player.onGround = false;

            platforms.forEach(p => {
                if (player.x < p.x + p.w && player.x + player.w > p.x && player.y < p.y + p.h && player.y + player.h > p.y) {
                    if (player.vy > 0) { player.y = p.y - player.h; player.vy = 0; player.onGround = true; player.jumps = 0; }
                }
            });

            if (player.y > 1000) player.hp = 0;

            spikes.forEach(s => {
                if (player.x < s.x + s.w && player.x + player.w > s.x && player.y < s.y && player.y + player.h > s.y - s.h) {
                    player.hp -= 2 * dt; explode(player.x, player.y); shake = 10;
                }
            });

            for (let i = potions.length - 1; i >= 0; i--) {
                let pot = potions[i];
                if (player.x < pot.x + 15 && player.x + player.w > pot.x - 15 && player.y < pot.y + 15 && player.y + player.h > pot.y - 15) {
                    // NEW: Super hearts restore Max HP, regular hearts restore 25
                    if (pot.isSuper) {
                        player.hp = player.maxHp;
                        tone(900, 0.2, 0.4); // Special sound for super heart
                    } else {
                        player.hp = Math.min(player.maxHp, player.hp + 25); 
                        tone(700, 0.1, 0.3);
                    }
                    potions.splice(i, 1); 
                }
            }

            for (let i = basicEnemies.length - 1; i >= 0; i--) {
                let e = basicEnemies[i];
                e.cd -= dt;

                if (e.type === "HELMET") {
                    e.x += e.vx * dt;
                    if (e.x > e.maxX || e.x < e.minX) e.vx *= -1;
                    if (e.cd <= 0 && Math.abs(player.x - e.x) < 400 && Math.abs(player.y - e.y) < 100) {
                        enemyBullets.push({ x: e.x, y: e.y, vx: (player.x > e.x ? 1 : -1) * 6, vy: 0 }); e.cd = 60; tone(300, 0.05, 0.1, "square");
                    }
                } else if (e.type === "MINI_VAPE") {
                    e.y = e.startY + Math.sin(performance.now() * 0.003 + e.x) * 20;
                    if (e.cd <= 0 && Math.abs(player.x - e.x) < 300) {
                        let dx = player.x - e.x; let dy = player.y - e.y; let dist = Math.hypot(dx, dy);
                        enemyBullets.push({ x: e.x, y: e.y, vx: (dx/dist)*5, vy: (dy/dist)*5 }); e.cd = 90; tone(400, 0.05, 0.1, "triangle");
                    }
                }

                bullets.forEach(b => {
                    if (b.x > e.x - e.w/2 && b.x < e.x + e.w/2 && b.y > e.y - e.h/2 && b.y < e.y + e.h/2) {
                        e.hp -= 5; b.vx = 0; explode(e.x, e.y, e.type === "HELMET" ? "#aaaaaa" : "#3B4CCA");
                    }
                });

                if (player.x < e.x + e.w/2 && player.x + player.w > e.x - e.w/2 && player.y < e.y + e.h/2 && player.y + player.h > e.y - e.h/2) {
                    player.hp -= 2 * dt; explode(player.x, player.y); shake = 5;
                }

                if (e.hp <= 0) {
                    explode(e.x, e.y, e.type === "HELMET" ? "#aaaaaa" : "#6B3FA0"); tone(200, 0.1, 0.2); basicEnemies.splice(i, 1);
                }
            }

            if (levelPhase === "PARKOUR") {
                if (interactables.puzzleType === "KEY" || interactables.puzzleType === "SWITCH") {
                    if (!interactables.hasKey && player.x > interactables.keyX - 20 && player.x < interactables.keyX + 20 && player.y < interactables.keyY + 20 && player.y + player.h > interactables.keyY - 20) {
                        interactables.hasKey = true; tone(1200, 0.2, 0.4);
                    }
                }

                if (interactables.puzzleType === "TARGETS") {
                    let allDead = true;
                    interactables.targets.forEach(t => {
                        if (t.active) {
                            allDead = false;
                            bullets.forEach(b => {
                                if (Math.hypot(b.x - t.x, b.y - t.y) < t.radius + 5) {
                                    t.active = false; b.vx = 0; explode(t.x, t.y, "#00ff00"); tone(800, 0.1, 0.3);
                                }
                            });
                        }
                    });
                    if (allDead && !interactables.hasKey) { interactables.hasKey = true; tone(1200, 0.2, 0.4); }
                }

                if (interactables.puzzleType === "SWITCH") {
                    if (!interactables.switchActive) {
                        let hit = false;
                        if (Math.hypot(player.x - interactables.switchX, player.y - interactables.switchY) < 30) hit = true;
                        bullets.forEach(b => { if (Math.hypot(b.x - interactables.switchX, b.y - interactables.switchY) < 30) { hit = true; b.vx = 0; } });
                        
                        if (hit) { interactables.switchActive = true; tone(1000, 0.2, 0.3); explode(interactables.switchX, interactables.switchY, "#00ff00"); }
                        
                        interactables.lasers.forEach(l => {
                            if (player.x < l.x+l.w && player.x+player.w > l.x && player.y < l.y+l.h && player.y+player.h > l.y) {
                                player.hp -= 5 * dt; explode(player.x, player.y); shake = 5;
                            }
                        });
                    }
                }

                if (interactables.hasKey && player.x > interactables.doorX - 20 && player.x < interactables.doorX + 60 && player.y < interactables.doorY + 60 && player.y + player.h > interactables.doorY - 20) {
                    levelPhase = "BOSS"; boss.x = player.x + 600; boss.y = player.y - 150;
                    tone(200, 0.5, 0.5, "sawtooth"); shake = 20;
                }
            }

            if (levelPhase === "BOSS") {
                if (boss.hp <= 0 && !boss.dead) { boss.dead = true; boss.deadTimer = 150; shake = 40; tone(100, 1.5, 0.5, "sawtooth"); }

                if (boss.dead) {
                    boss.deadTimer -= dt;
                    if (boss.deadTimer > 0) {
                        if (Math.random() < 0.2) { 
                            let bColor = "#F1C40F";
                            if(boss.type === "VAPORIZER") bColor = "#000000"; if(boss.type === "VOID_EYE") bColor = "#990000"; if(boss.type === "SYSTEM_GLITCH") bColor = "#00ff00";
                            explode(boss.x + (Math.random()-0.5)*80, boss.y + (Math.random()-0.5)*80, bColor); tone(50 + Math.random() * 50, 0.2, 0.4, "sawtooth"); shake = 20; 
                        }
                    } else { levelPhase = "LOOT"; tone(600, 0.2, 0.3); setTimeout(() => tone(800, 0.4, 0.3), 200); }
                } else {
                    boss.attackCooldown -= dt; if (boss.hp < (boss.maxHp / 2)) boss.phase = 2;

                    if (boss.type === "VAPORIZER") {
                        const speed = boss.phase === 1 ? (0.02 + (caveCount * 0.005)) : (0.06 + (caveCount * 0.005));
                        boss.x += (player.x - boss.x) * speed; boss.y += (player.y - boss.y) * speed;
                        if (boss.attackCooldown <= 0 && Math.random() < 0.02) { player.hp -= 10; explode(player.x, player.y); shake = 20; tone(80, 0.2, 0.3); boss.attackCooldown = 40; }
                    } 
                    else if (boss.type === "BEE") {
                        const targetX = player.x; const targetY = player.y - 200;
                        boss.x += (targetX - boss.x) * 0.03; boss.y += (targetY - boss.y) * 0.03;
                        if (boss.attackCooldown <= 0) { enemyBullets.push({ x: boss.x, y: boss.y + 20, vx: (Math.random()-0.5)*4, vy: boss.phase === 1 ? 6 : 10 }); tone(300, 0.1, 0.2, "triangle"); boss.attackCooldown = boss.phase === 1 ? 40 : 20; }
                    }
                    else if (boss.type === "VOID_EYE") {
                        boss.x += (player.x - boss.x) * 0.015; boss.y += ((player.y - 120) - boss.y) * 0.02;
                        if (boss.attackCooldown <= 0) {
                            let dx = player.x - boss.x; let dy = player.y - boss.y; let dist = Math.hypot(dx, dy);
                            enemyBullets.push({ x: boss.x, y: boss.y, vx: (dx/dist)*8, vy: (dy/dist)*8 }); tone(450, 0.1, 0.3, "sawtooth"); boss.attackCooldown = boss.phase === 1 ? 50 : 25;
                        }
                    }
                    else if (boss.type === "SYSTEM_GLITCH") {
                        if (Math.random() < (boss.phase === 1 ? 0.03 : 0.08)) { boss.x += (Math.random() - 0.5) * 300; boss.y += (Math.random() - 0.5) * 200; tone(150, 0.05, 0.2, "square"); }
                        boss.x += (player.x - boss.x) * 0.01; boss.y += (player.y - boss.y) * 0.01;
                        if (boss.attackCooldown <= 0) {
                            let burst = boss.phase === 1 ? 4 : 8;
                            for(let i=0; i<burst; i++) enemyBullets.push({ x: boss.x, y: boss.y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10 });
                            tone(800, 0.05, 0.2, "square"); boss.attackCooldown = 70;
                        }
                    }
                }
            }

            if (levelPhase === "LOOT") {
                let chestX = boss.x - 15; let chestY = boss.y - 15;
                if (upgradeTimer === 0 && player.x < chestX + 30 && player.x + player.w > chestX && player.y < chestY + 20 && player.y + player.h > chestY) {
                    grantLoot(); tone(600, 0.1, 0.3); setTimeout(() => tone(800, 0.1, 0.3), 150); setTimeout(() => tone(1200, 0.4, 0.4), 300);
                    setTimeout(() => { caveCount++; initLevel(); }, 3500);
                }
                if (upgradeTimer > 0) upgradeTimer--;
            }

            bullets.forEach(b => {
                b.x += b.vx * dt; b.y += b.vy * dt;
                if (levelPhase === "BOSS" && !boss.dead && b.x > boss.x - 30 && b.x < boss.x + 30 && b.y > boss.y - 30 && b.y < boss.y + 30) {
                    boss.hp -= 3; let bColor = "#000000"; if(boss.type==="VAPORIZER") bColor = "#111111"; if(boss.type==="SYSTEM_GLITCH") bColor = "#00ff00";
                    explode(boss.x, boss.y, bColor); tone(400, 0.05, 0.1); b.vx = 0; 
                }
            });
            
            enemyBullets.forEach(b => {
                b.x += b.vx * dt; b.y += b.vy * dt;
                if (b.x > player.x && b.x < player.x + player.w && b.y > player.y && b.y < player.y + player.h) {
                    player.hp -= 8; explode(player.x, player.y); shake = 15; tone(80, 0.2, 0.3); b.vy = 0;
                }
            });

            cameraX = player.x - canvas.width / 3;
        }

        if (blood.length > 1000) blood.splice(0, 200); 
        if (chunks.length > 150) chunks.splice(0, 40);
        bullets = bullets.filter(b => b.vx !== 0 && b.vy !== 0 && Math.abs(b.x - player.x) < 1000);
        enemyBullets = enemyBullets.filter(b => b.vy !== 0 && b.y < canvas.height && b.x > cameraX - 500 && b.x < cameraX + canvas.width + 500);

        blood.forEach(b => { 
            if (!b.pooled) {
                b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 0.3 * dt; b.life--; 
                platforms.forEach(p => { if (b.x > p.x && b.x < p.x + p.w && b.y > p.y && b.y < p.y + p.h) { if (b.vy > 0) { b.pooled = true; b.y = p.y; b.life = 600; b.w = 6 + Math.random() * 10; } } });
            } else { b.life--; }
        });
        chunks.forEach(c => { c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 0.4 * dt; c.life--; });
        if (shake > 0) shake--;
    }
// ======================
// MISSION SETUP
// ======================
var missionText = "";
var missionTimer = 0;

function showMissionBanner(text) {
    missionText = text;
    missionTimer = 180; 
}
    // ======================
    // DRAW
    // ======================
    function draw() {
        if (!started) {
            if (titleImage.src && titleImage.complete) ctx.drawImage(titleImage, 0, 0, canvas.width, canvas.height);
            else { ctx.fillStyle = "#111"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.font = "52px orbitron"; ctx.fillText("THE CAVE EXPLORER", canvas.width / 2, 160); }
            ctx.textAlign = "center"; ctx.font = "24px sans-serif"; ctx.fillStyle = "gold"; ctx.fillText("TOP 3 LOCAL CAVES: " + leaderBoard.join(" | "), canvas.width / 2, 50);
            ctx.fillStyle = "white"; ctx.font = "24px sans-serif"; ctx.fillText("Select Difficulty to Start:", canvas.width / 2, canvas.height - 140);
            ctx.fillStyle = "#2ecc71"; ctx.fillRect(canvas.width/2 - 200, canvas.height - 120, 100, 40); ctx.fillStyle = "white"; ctx.fillText("EASY", canvas.width/2 - 150, canvas.height - 92);
            ctx.fillStyle = "#f1c40f"; ctx.fillRect(canvas.width/2 - 50, canvas.height - 120, 100, 40); ctx.fillStyle = "white"; ctx.fillText("MEDIUM", canvas.width/2, canvas.height - 92);
            ctx.fillStyle = "#e74c3c"; ctx.fillRect(canvas.width/2 + 100, canvas.height - 120, 100, 40); ctx.fillStyle = "white"; ctx.fillText("HARD", canvas.width/2 + 150, canvas.height - 92);
            return; 
       // Reset camera so HUD doesn't move with the cave
ctx.setTransform(1, 0, 0, 1, 0, 0); 

if (missionTimer > 0) {
    // 1. Draw Background Bar (fades out with timer)
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.7, missionTimer / 60)})`;
    ctx.fillRect(0, canvas.height * 0.2, canvas.width, 80);

    // 2. Draw Text
    ctx.textAlign = "center";
    ctx.font = "bold 32px 'Orbitron', sans-serif"; // Using your cave font
    ctx.fillStyle = `rgba(255, 215, 0, ${missionTimer / 60})`; // Gold fade
    ctx.fillText(missionText, canvas.width / 2, canvas.height * 0.2 + 50);

    missionTimer--; // Animate it out
}
 }

        if (bgImage.src && bgImage.complete) ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        else { ctx.fillStyle = "#111"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        
        ctx.save();
        ctx.translate(-cameraX + (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

        ctx.fillStyle = "#C2A88D"; platforms.forEach(p => ctx.fillRect(p.x, p.y, p.w, p.h));
        ctx.fillStyle = "#D4C0A8"; spikes.forEach(s => { ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + (s.w / 2), s.y - s.h); ctx.lineTo(s.x + s.w, s.y); ctx.fill(); });

        ctx.font = "24px sans-serif"; ctx.textAlign = "center";
        // NEW: Draw normal hearts and super hearts
        potions.forEach(pot => { 
            let floatOffset = Math.sin(performance.now() * 0.005 + pot.x) * 5; 
            ctx.fillText(pot.isSuper ? "💕" : "❤️", pot.x, pot.y + floatOffset); 
        });

        basicEnemies.forEach(e => {
            if (e.type === "HELMET") {
                ctx.fillStyle = "#f1c40f"; ctx.beginPath(); ctx.arc(e.x, e.y+e.h/2, e.w/2, Math.PI, 0); ctx.fill();
                ctx.fillStyle = "#555"; ctx.fillRect(e.x + (e.vx > 0 ? 5 : -15), e.y, 10, 4); 
            } else if (e.type === "MINI_VAPE") {
                ctx.fillStyle = "#6B3FA0"; ctx.beginPath(); ctx.moveTo(e.x, e.y-e.h/2); ctx.lineTo(e.x+e.w/2, e.y+e.h/2); ctx.lineTo(e.x-e.w/2, e.y+e.h/2); ctx.fill();
                ctx.fillStyle = "#ff0000"; ctx.beginPath(); ctx.arc(e.x, e.y+4, 4, 0, Math.PI*2); ctx.fill();
            }
        });

        if (levelPhase === "PARKOUR") {
            if (interactables.puzzleType === "TARGETS") {
                interactables.targets.forEach(t => {
                    if (t.active) {
                        ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI*2); ctx.fill();
                        ctx.fillStyle = "red"; ctx.beginPath(); ctx.arc(t.x, t.y, t.radius-5, 0, Math.PI*2); ctx.fill();
                        ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(t.x, t.y, t.radius-10, 0, Math.PI*2); ctx.fill();
                    }
                });
            } else if (interactables.puzzleType === "SWITCH") {
                if (!interactables.switchActive) {
                    ctx.fillStyle = "#aa0000"; ctx.fillRect(interactables.switchX-15, interactables.switchY-5, 30, 10);
                    ctx.fillStyle = "red"; ctx.fillRect(interactables.switchX-10, interactables.switchY-15, 20, 10);
                    ctx.fillStyle = "rgba(255, 0, 0, 0.5)"; interactables.lasers.forEach(l => ctx.fillRect(l.x, l.y, l.w, l.h));
                } else {
                    ctx.fillStyle = "#005500"; ctx.fillRect(interactables.switchX-15, interactables.switchY-5, 30, 10);
                    ctx.fillStyle = "#00ff00"; ctx.fillRect(interactables.switchX-10, interactables.switchY-10, 20, 5);
                }
            }

            if ((interactables.puzzleType === "KEY" || interactables.puzzleType === "SWITCH") && !interactables.hasKey) {
                ctx.font = "24px sans-serif"; ctx.textAlign = "center"; ctx.fillText("🔑", interactables.keyX, interactables.keyY + Math.sin(performance.now()*0.005)*10);
            }

            if (!interactables.hasKey) {
                ctx.fillStyle = "#ff3333"; ctx.fillRect(interactables.doorX, interactables.doorY, 40, 60); ctx.fillStyle = "#550000"; ctx.fillRect(interactables.doorX + 5, interactables.doorY + 5, 30, 50);
            } else {
                let glow = Math.sin(performance.now() * 0.01) * 10;
                ctx.fillStyle = "#33ff33"; ctx.fillRect(interactables.doorX, interactables.doorY, 40, 60); ctx.fillStyle = `rgb(0, ${150 + glow*5}, 0)`; ctx.fillRect(interactables.doorX + 5, interactables.doorY + 5, 30, 50);
                ctx.fillStyle = "white"; ctx.font = "12px sans-serif"; ctx.fillText("ENTER", interactables.doorX + 20, interactables.doorY + 30);
            }
        }

        if (player.alive) {
            let runCycle = (Math.abs(player.vx) > 0.5 && player.onGround) ? performance.now() * 0.015 : 0;
            let legSwing = Math.sin(runCycle) * 12; let armSwing = Math.cos(runCycle) * 8;
            ctx.strokeStyle = "white"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(player.x + 16, player.y + 12, 8, 0, Math.PI * 2);
            ctx.moveTo(player.x+16, player.y+20); ctx.lineTo(player.x+16, player.y+35); ctx.moveTo(player.x+16, player.y+35); ctx.lineTo(player.x+16 - legSwing, player.y+48); ctx.moveTo(player.x+16, player.y+35); ctx.lineTo(player.x+16 + legSwing, player.y+48); 
            ctx.moveTo(player.x+16, player.y+25); ctx.lineTo(player.x+16 + (player.facing*15), player.y+25); ctx.moveTo(player.x+16, player.y+25); ctx.lineTo(player.x+16 - (player.facing*armSwing), player.y+32); ctx.stroke();
            ctx.fillStyle = "#f1c40f"; ctx.fillRect(player.x+16 + (player.facing*10), player.y+22, 10, 4);
        }

        if ((levelPhase === "BOSS" || levelPhase === "LOOT") && (!boss.dead || (boss.dead && Math.floor(boss.deadTimer) % 4 !== 0))) {
            let flap = Math.sin(performance.now() * 0.015) * 20;  ctx.save(); ctx.translate(boss.x, boss.y);
            
            // NEW: Updated Vaporizer boss aesthetic (Shadowy, geometric, glowing red eyes)
            if (boss.type === "VAPORIZER") {
                // Tendrils/Wings
                ctx.fillStyle = boss.phase === 2 ? "#330000" : "#222222"; 
                ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-50, -30 + flap); ctx.lineTo(-40, 10 + flap); ctx.fill();
                ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(50, -30 + flap); ctx.lineTo(40, 10 + flap); ctx.fill();
                
                // Shadowy core body
                ctx.fillStyle = boss.phase === 2 ? "#110000" : "#111111";
                ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
                
                // Glowing red eyes
                ctx.shadowBlur = 15; ctx.shadowColor = "red"; ctx.fillStyle = "red";
                ctx.beginPath(); ctx.arc(-10, -5, 5, 0, Math.PI * 2); ctx.arc(10, -5, 5, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0; 

            } else if (boss.type === "BEE") {
                ctx.fillStyle = "#F1C40F"; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = "black"; ctx.fillRect(-30, -10, 60, 10); ctx.fillRect(-25, 5, 50, 10);
                ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.beginPath(); ctx.ellipse(-20, -30+flap/2, 10, 20, 0.5, 0, Math.PI*2); ctx.ellipse(20, -30-flap/2, 10, 20, -0.5, 0, Math.PI*2); ctx.fill();
            } else if (boss.type === "VOID_EYE") {
                ctx.fillStyle = "#330033"; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = boss.phase === 2 ? "red" : "black"; ctx.beginPath(); ctx.arc(Math.sin(performance.now()*0.005)*5, Math.cos(performance.now()*0.005)*5, 8, 0, Math.PI*2); ctx.fill();
            } else if (boss.type === "SYSTEM_GLITCH") {
                ctx.fillStyle = "#00ff00"; ctx.fillRect(-20 + (Math.random()-0.5)*10, -20 + (Math.random()-0.5)*10, 40, 40);
                ctx.fillStyle = "black"; ctx.font="20px monospace"; ctx.fillText("ERR", 0, 5);
            }
            ctx.restore();
        }

        if (levelPhase === "LOOT") {
            let chestX = boss.x - 15; let chestY = boss.y - 15;
            ctx.fillStyle = "#f1c40f"; ctx.fillRect(chestX, chestY, 30, 20);
            ctx.fillStyle = "#d35400"; ctx.fillRect(chestX, chestY + 5, 30, 4);
            if (upgradeTimer > 0) {
                ctx.fillStyle = "white"; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center";
                ctx.fillText(upgradeMessage, boss.x, boss.y - 40 - (180 - upgradeTimer) * 0.2);
            }
        }

        ctx.fillStyle = "yellow"; bullets.forEach(b => ctx.fillRect(b.x - 4, b.y - 4, 8, 8));
        ctx.fillStyle = "cyan"; enemyBullets.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI*2); ctx.fill(); });
        blood.forEach(b => { ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, 3); });
        chunks.forEach(c => { ctx.fillStyle = c.color; ctx.fillRect(c.x, c.y, 6, 6); });

        ctx.restore();

        // HUD
        ctx.fillStyle = "white"; ctx.font = "20px sans-serif"; ctx.textAlign = "left";
        ctx.fillText(`HP: ${Math.ceil(player.hp)} / ${player.maxHp} | CAVE: ${caveCount}`, 20, 40);
        
        // CROSSHAIR
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(mouseX - 10, mouseY); ctx.lineTo(mouseX + 10, mouseY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(mouseX, mouseY - 10); ctx.lineTo(mouseX, mouseY + 10); ctx.stroke();

        if (gameOver) {
            if (gameOverImage.src && gameOverImage.complete) {
                ctx.drawImage(gameOverImage, 0, 0, canvas.width, canvas.height);
            } else { 
                ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(0,0,canvas.width,canvas.height); 
                ctx.fillStyle = "red"; ctx.textAlign = "center"; ctx.font = "60px sans-serif"; 
                ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2); 
            }
            ctx.fillStyle = "white"; ctx.font = "24px sans-serif"; ctx.textAlign = "center";
            ctx.fillText("CAVES SURVIVED: " + (caveCount - 1), canvas.width/2, canvas.height/2 + 50);
            ctx.fillStyle = "#e74c3c"; ctx.fillRect(canvas.width/2 - 100, canvas.height/2 + 130, 200, 40);
            ctx.fillStyle = "white"; ctx.fillText("BACK TO TITLE", canvas.width/2, canvas.height/2 + 158);
        }
    }

    function loop(now) {
        acc += now - last; last = now;
        while (acc >= STEP) { update(1); acc -= STEP; }
        draw(); requestAnimationFrame(loop);
    }
    loop(performance.now());
})();
(function() {
    window.currentMission = { title: "SCANNING CAVE", task: "Begin your descent...", timer: 0 };
    let missionStep = 0;

    window.showMission = function(t, d) {
        window.currentMission.title = String(t).toUpperCase();
        window.currentMission.task = String(d).toUpperCase();
        window.currentMission.timer = 240;
    };

    function watchProgress() {
        // Find player and boss
        let p = window.p || window.player || window.hero || {};
        let py = p.y || window.score || window.depth || 0;
        let boss = window.boss || window.vaporizer || window.v || null;
        let bHealth = boss ? (boss.hp || boss.health || 0) : 0;

        // Reset if game restarts
        if (window.gameOver || py < 10) missionStep = 0;

        // Mission Logic
        if (missionStep === 0 && (py > 1500 || boss)) {
            window.showMission("VAPORIZER DETECTED", "Destroy the Core to open the path!");
            missionStep = 1;
        } else if (missionStep === 1 && (bHealth <= 0 && py > 1600)) {
            window.showMission("MISSION SECURED", "The Vaporizer is down. Find the Exit!");
            missionStep = 2;
        } else if (missionStep === 2 && (py > 3000 || window.victory)) {
            window.showMission("FINAL DESCENT", "Exit portal detected ahead!");
            missionStep = 3;
        }
    }

    // Initialize HUD Canvas
    let hud = document.getElementById("missionLayer") || document.createElement("canvas");
    hud.id = "missionLayer";
    Object.assign(hud.style, { position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "999999" });
    if (!hud.parentElement) document.body.appendChild(hud);
    const mctx = hud.getContext("2d");

    function draw() {
        mctx.clearRect(0, 0, hud.width, hud.height);
        if (window.gameOver) { requestAnimationFrame(draw); return; }
        
        mctx.shadowBlur = 6; mctx.shadowColor = "black";
        mctx.textAlign = "left"; mctx.font = "bold 22px sans-serif"; mctx.fillStyle = "gold";
        mctx.fillText(`◈ MISSION: ${window.currentMission.title}`, 25, 110);
        mctx.font = "14px monospace"; mctx.fillStyle = "white";
        mctx.fillText(`  > ${window.currentMission.task}`, 30, 135);

        if (window.currentMission.timer > 0) {
            let a = window.currentMission.timer > 60 ? 1 : window.currentMission.timer / 60;
            mctx.fillStyle = `rgba(0,0,0,${a*0.8})`; mctx.fillRect(0, hud.height*0.35, hud.width, 100);
            mctx.textAlign = "center"; mctx.fillStyle = `rgba(255,215,0,${a})`;
            mctx.font = "bold 50px Impact"; mctx.fillText(window.currentMission.title, hud.width/2, hud.height*0.35+45);
            mctx.font = "18px monospace"; mctx.fillStyle = "white";
            mctx.fillText(window.currentMission.task, hud.width/2, hud.height*0.35+80);
            window.currentMission.timer--;
        }
        requestAnimationFrame(draw);
    }

    const res = () => { hud.width = window.innerWidth; hud.height = window.innerHeight; };
    window.addEventListener("resize", res); res();
    
    draw();
    setInterval(watchProgress, 1000); // Check every second
})();



})();

});