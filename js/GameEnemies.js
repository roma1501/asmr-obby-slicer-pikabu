// GameEnemies.js — особые враги и боссы ASMR Obby Slicer: рывок с прицелом (dasher), щит спереди (shield),
// бомбы краски по дуге (thrower), прыжок сверху (jumper), взрыв рядом (bomber), лечение союзников (healer),
// деление на малышей (splitter); боссы глав — удар по земле, град бомб, слуги, серия рывков, таран, бомберы.
// Каждая опасность сначала показывается меткой на земле (оранжевый круг / полоса) — от неё можно уйти.
// Решения — числами игры (x, y по карте); меши меток и снарядов — только вид.

/** @satisfies {Record<string, any>} */
const GameEnemies = {
    /** @type {Array<{ mesh: BABYLON.Mesh, mat: BABYLON.StandardMaterial, x0: number, y0: number, x1: number, y1: number, t: number, dur: number, h: number, r: number, mult: number, by: any, color: number[] }>} */
    shots: [],
    /** @type {Array<{ mesh: BABYLON.Mesh, mat: BABYLON.StandardMaterial, t: number, dur: number, grow: boolean, base: number, x: number, y: number }>} */
    marks: [],
    /** @type {any} */ bossF: null,

    clear() {
        const v = GameFighters.app && GameFighters.app.location ? GameFighters.app.location.view : null;
        for (const s of this.shots) { if (v) World3D.removeObject(v, s.mesh); else s.mesh.dispose(); s.mat.dispose(); }
        for (const m of this.marks) { m.mesh.dispose(); m.mat.dispose(); }
        this.shots = [];
        this.marks = [];
        this.bossF = null;
        if (typeof GameUI !== 'undefined' && GameUI.bossBar) GameUI.bossBar(null);
    },

    _scene() { const a = GameFighters.app; return a && a.location ? a.location.view.scene : null; },

    // --- Появление ------------------------------------------------------------------------------

    onSpawn(e) {
        const def = e.def || {}, mech = def.mech || [];
        e.ai = { t: 0, cd: 1.2 + Math.random() * 1.2, phase: '', cds: { slam: 3, barrage: 2.5, summon: 7, dashchain: 3, charge: 3.5, bombs: 4 } };
        if (def.ai === 'shield' || mech.includes('shield')) this._giveShield(e);
        if (def.ai === 'bomber') this._giveBomb(e);
        if (e.type === 'boss') {
            this.bossF = e;
            if (typeof GameUI !== 'undefined') {
                GameUI.boss(Lang.code === 'ru' ? def.bossDef.name.ru : def.bossDef.name.en);
                GameUI.bossBar(e);
                GameUI.toast(Lang.code === 'ru' ? def.bossDef.tip.ru : def.bossDef.tip.en, 3800);
            }
        } else if (def.name && typeof Game !== 'undefined' && Game.save) {
            // первая встреча с особым врагом — короткая подсказка
            const seen = Game.save.seen || (Game.save.seen = []);
            if (!seen.includes(e.type)) {
                seen.push(e.type);
                Game.persist();
                if (typeof GameUI !== 'undefined') GameUI.toast(Lang.code === 'ru' ? def.name.ru : def.name.en, 4200);
            }
        }
    },

    // Щит в левой руке (Hand_L): блокирует удары спереди, падает вместе с отрубленной рукой.
    _giveShield(e) {
        const sc = this._scene();
        if (!sc) return;
        const root = new BABYLON.Mesh('shield', sc);
        const plate = BABYLON.MeshBuilder.CreateBox('shieldPlate', { width: 9, height: 92, depth: 74 }, sc);
        const rim = BABYLON.MeshBuilder.CreateBox('shieldRim', { width: 11, height: 96, depth: 10 }, sc);
        const boss = BABYLON.MeshBuilder.CreateSphere('shieldBoss', { diameter: 26, segments: 8 }, sc);
        const m1 = new BABYLON.StandardMaterial('shieldMat', sc); m1.diffuseColor = BABYLON.Color3.FromHexString('#8f9cb0');
        const m2 = new BABYLON.StandardMaterial('shieldMat2', sc); m2.diffuseColor = BABYLON.Color3.FromArray(e.ch.paint);
        plate.material = m1; rim.material = m2; boss.material = m2;
        plate.parent = root; rim.parent = root; boss.parent = root;
        boss.position.x = 8;
        e.ch.rig.attach('Hand_L', root, { pos: [0.24, 0.3, 0], rot: [0, 0, 0] });
        e.ch.leftItem = root;
    },

    // Бомба на спине бомбера с искрящим фитилём.
    _giveBomb(e) {
        const sc = this._scene();
        if (!sc) return;
        const root = new BABYLON.Mesh('bomb', sc);
        const ball = BABYLON.MeshBuilder.CreateSphere('bombBall', { diameter: 62, segments: 10 }, sc);
        const fuse = BABYLON.MeshBuilder.CreateCylinder('bombFuse', { height: 22, diameter: 6 }, sc);
        const m = new BABYLON.StandardMaterial('bombMat', sc); m.diffuseColor = BABYLON.Color3.FromHexString('#25222e'); m.specularColor = new BABYLON.Color3(0.6, 0.6, 0.6);
        const mf = new BABYLON.StandardMaterial('fuseMat', sc); mf.diffuseColor = BABYLON.Color3.FromHexString('#c9a36b');
        ball.material = m; fuse.material = mf;
        ball.parent = root; fuse.parent = root;
        ball.position.set(-28, 0, 0); fuse.position.set(-28, 38, 0);
        e.ch.rig.attach('Back', root, {});
        e.ch.details.push(root);
        const fx = GameFighters.app && GameFighters.app.fx;
        if (fx) e.ai.spark = fx.create({ follow: () => { fuse.computeWorldMatrix(true); return fuse.getAbsolutePosition().add(new BABYLON.Vector3(0, 12, 0)); },
            texture: 'assets/fx/spark.webp', rate: 26, capacity: 30, life: [0.15, 0.35], size: [8, 14], speed: [30, 90], color: '#ffd23f', color2: '#ff5d1f', blend: 'additive' });
    },

    // --- Поведение -------------------------------------------------------------------------------

    // Особое поведение; { vx, vy } — движение задано здесь, null — обычный бой ближнего врага.
    think(e, dt, c, p) {
        const F = GameFighters, ai = e.ai;
        if (!ai) return null;
        const kind = e.type === 'boss' ? 'boss' : (e.def && e.def.ai);
        if (!kind || kind === 'splitter' || kind === 'shield') return null;
        if (e.stag > 0 && ai.phase && ai.phase !== 'jump') { this._cancel(e); return null; }   // удар сбивает приём
        ai.t += dt;
        const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx);
        const sp = e.speed * (e.slow > 0 ? 0.5 : 1);
        const stand = { vx: 0, vy: 0 };
        // --- общие фазы рывка (рывун, ниндзя, рыцарь) ---
        if (ai.phase === 'aim') {
            e.heading = F._turn(e.heading, ai.dir, dt * 12);
            if (ai.t >= ai.aimT) { ai.phase = 'dash'; ai.t = 0; ai.hit = false; }
            return stand;
        }
        if (ai.phase === 'dash') {
            const v = ai.dashV * dt;
            F._move(e, Math.cos(ai.dir) * v, Math.sin(ai.dir) * v, c);
            e.ch.play('run', { speed: 2.4, fade: 0.05 });
            if (Math.random() < dt * 30) GamePaint.drop(e.x, F.groundH(e.x, e.y) + 40, e.y, (Math.random() - 0.5) * 80, 120, (Math.random() - 0.5) * 80, 4, e.ch.paint, 1);
            if (!ai.hit && Math.hypot(p.x - e.x, p.y - e.y) < 100 * e.scale) { ai.hit = true; F.hitPlayer(p, e, { x: Math.cos(ai.dir), y: Math.sin(ai.dir) }, c, ai.dashDmg); }
            if (ai.t >= ai.dashT) {
                if (ai.chain > 1) { ai.chain--; this._aim(e, Math.atan2(p.y - e.y, p.x - e.x), 0.35, 1500, 0.3, ai.dashDmg); }
                else { ai.phase = 'tired'; ai.t = 0; }
            }
            return stand;
        }
        if (ai.phase === 'tired') { if (ai.t >= ai.tiredT) ai.phase = ''; return stand; }
        if (ai.phase === 'crouch' || ai.phase === 'jump') return this._jump(e, dt, c, p);
        if (ai.phase === 'fuse') {
            e.ch.tint(((ai.t * 9) | 0) % 2 ? new BABYLON.Color3(1, 0.62, 0.1) : null);
            if (ai.t >= 0.9) this.explode(e);
            return stand;
        }
        if (ai.phase === 'slam') {
            if (ai.t >= 0.9 && !ai.hit) { ai.hit = true; this._slamHit(e, c, p); }
            if (ai.t >= 1.3) { ai.phase = ''; }
            return stand;
        }

        switch (kind) {
            case 'dasher':
                if (ai.cd <= 0 && d > 200 && d < 580) { this._aim(e, ang, 0.65, 1450, 0.42, 1); ai.chain = 1; ai.tiredT = 1.1; ai.cd = 3.2; return stand; }
                return null;
            case 'thrower': {
                e.heading = F._turn(e.heading, ang, dt * 8);
                if (ai.cd <= 0 && d < 850) {
                    ai.cd = 2.3 + Math.random() * 0.6;
                    e.ch.play('slash_3', { layer: 'upper', loop: false, restart: true, fade: 0.05 });
                    const lead = 0.55;
                    const tx = p.x + (p.moving ? Math.cos(p.heading) * p.speed * lead : 0), ty = p.y + (p.moving ? Math.sin(p.heading) * p.speed * lead : 0);
                    F.after(0.22, () => { if (e.alive) this.lob(e, tx, ty, 120, 1, 0.95); });
                }
                // держит дистанцию 400–650 и обходит по кругу
                const away = d < 400 ? -1 : d > 650 ? 1 : 0, side = ((e.id % 2) ? 1 : -1) * 0.5;
                return { vx: (dx / d * away - dy / d * side) * sp, vy: (dy / d * away + dx / d * side) * sp };
            }
            case 'jumper':
                if (ai.cd <= 0 && d > 240 && d < 640) {
                    ai.phase = 'crouch'; ai.t = 0; ai.to = { x: p.x, y: p.y }; ai.from = { x: e.x, y: e.y };
                    this.markCircle(p.x, p.y, 150, 1.1);
                    e.ch.play('hit', { layer: 'upper', loop: false, restart: true });
                    return stand;
                }
                return null;
            case 'bomber':
                e.heading = F._turn(e.heading, ang, dt * 10);
                if (d < 150 * e.scale) { ai.phase = 'fuse'; ai.t = 0; this.markCircle(e.x, e.y, 190, 0.9); if (typeof Game !== 'undefined') Game.sfx('assets/sounds/click.ogg', { volume: 0.6, rate: 1.6 }); return stand; }
                return { vx: dx / d * sp, vy: dy / d * sp };
            case 'healer': {
                e.heading = F._turn(e.heading, ang, dt * 6);
                if (ai.cd <= 0) {
                    const hurt = F.enemies.filter(o => o.alive && o !== e && o.hp < o.maxHp && Math.hypot(o.x - e.x, o.y - e.y) < 560)
                        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
                    if (hurt) { ai.cd = 2.6; this.heal(e, hurt); }
                    else ai.cd = 0.8;
                }
                if (d < 480) return { vx: -dx / d * sp, vy: -dy / d * sp };
                return { vx: Math.cos(ai.t * 0.7 + e.id) * sp * 0.3, vy: Math.sin(ai.t * 0.9 + e.id) * sp * 0.3 };
            }
            case 'boss': return this._boss(e, dt, c, p, d, ang);
        }
        return null;
    },

    // Перезарядка приёмов идёт всегда (и пока враг бьёт мечом) — иначе у вплотную дерущегося босса приёмы не наступают.
    tick(e, dt) {
        const ai = e.ai;
        if (!ai) return;
        ai.cd -= dt;
        for (const k in ai.cds) ai.cds[k] -= dt;
    },

    _aim(e, dir, aimT, dashV, dashT, dmg) {
        const ai = e.ai;
        ai.phase = 'aim'; ai.t = 0; ai.dir = dir; ai.aimT = aimT; ai.dashV = dashV; ai.dashT = dashT; ai.dashDmg = dmg;
        this.markLine(e.x, e.y, dir, dashV * dashT + 90, 92 * e.scale, aimT);
    },

    _cancel(e) {
        const ai = e.ai;
        if (!ai) return;
        if (ai.phase === 'fuse') return;          // фитиль не гаснет
        ai.phase = ''; ai.t = 0; e.jumpH = 0;
    },

    _jump(e, dt, c, p) {
        const ai = e.ai, F = GameFighters;
        if (ai.phase === 'crouch') { if (ai.t >= 0.35) { ai.phase = 'jump'; ai.t = 0; } return { vx: 0, vy: 0 }; }
        const u = Math.min(1, ai.t / 0.75);
        const x = ai.from.x + (ai.to.x - ai.from.x) * u, y = ai.from.y + (ai.to.y - ai.from.y) * u;
        const q = F.clampArena(x, y, c.body * e.scale);
        e.x = q.x; e.y = q.y;
        e.jumpH = Math.sin(Math.PI * u) * 280;
        e.ch.play('dance_1', { fade: 0.08 });
        if (u >= 1) {
            e.jumpH = 0; ai.phase = ''; ai.cd = 3.6;
            const at = new BABYLON.Vector3(e.x, F.groundH(e.x, e.y) + 20, e.y);
            GamePaint.spray(at, new BABYLON.Vector3(0, 1, 0), e.ch.paint, 22, 520, e.ch.pal, 1.5);
            GamePaint.splat(e.x, e.y, 210, e.ch.paint, 0.2);
            F.ring(e.x, e.y, BABYLON.Color3.FromArray(e.ch.paint).toHexString(), 360);
            if (F.app && F.app.camera) F.app.camera.shake(180, 0.018);
            const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
            if (d < 150) F.hitPlayer(p, e, { x: (p.x - e.x) / d, y: (p.y - e.y) / d }, c, 1.1);
        }
        return { vx: 0, vy: 0 };
    },

    // --- Боссы -----------------------------------------------------------------------------------

    _boss(e, dt, c, p, d, ang) {
        const ai = e.ai, F = GameFighters, mech = e.def.mech || [], cd = ai.cds;
        if (e.ch.limbs.armR !== 'full') return null;
        if (mech.includes('slam') && cd.slam <= 0 && d < 430) {
            cd.slam = 6; ai.phase = 'slam'; ai.t = 0; ai.hit = false;
            this.markCircle(e.x, e.y, 300, 0.9);
            e.ch.play('slash_3', { loop: false, restart: true, fade: 0.06, speed: 0.6 });
            return { vx: 0, vy: 0 };
        }
        if (mech.includes('charge') && cd.charge <= 0 && d > 260 && d < 900) {
            cd.charge = 6.5; this._aim(e, ang, 0.85, 1300, 0.62, 1.25); ai.chain = 1; ai.tiredT = 1.4;
            return { vx: 0, vy: 0 };
        }
        if (mech.includes('dashchain') && cd.dashchain <= 0 && d < 720) {
            cd.dashchain = 5.5; this._aim(e, ang, 0.4, 1600, 0.3, 1); ai.chain = 3; ai.tiredT = 1.2;
            return { vx: 0, vy: 0 };
        }
        if (mech.includes('barrage') && cd.barrage <= 0 && d < 950) {
            cd.barrage = 5;
            e.ch.play('slash_3', { layer: 'upper', loop: false, restart: true });
            for (let i = 0; i < 5; i++) {
                const a = Math.random() * Math.PI * 2, r = i === 0 ? 0 : 120 + Math.random() * 200;
                const tx = p.x + Math.cos(a) * r, ty = p.y + Math.sin(a) * r;
                F.after(0.15 + i * 0.13, () => { if (e.alive) this.lob(e, tx, ty, 130, 1, 1.05); });
            }
        }
        if (mech.includes('summon') && cd.summon <= 0) {
            cd.summon = 10;
            if (F.enemies.filter(o => o.alive).length < 7) for (let i = 0; i < 2; i++) this.summon(e, 'noob');
        }
        if (mech.includes('bombs') && cd.bombs <= 0) {
            cd.bombs = 7;
            if (F.enemies.filter(o => o.alive).length < 7) this.summon(e, 'bomber');
        }
        return null;   // остальное время — обычный ближний бой
    },

    _slamHit(e, c, p) {
        const F = GameFighters;
        const at = new BABYLON.Vector3(e.x, F.groundH(e.x, e.y) + 20, e.y);
        F.ring(e.x, e.y, '#ff8a1f', 700);
        GamePaint.spray(at, new BABYLON.Vector3(0, 1, 0), e.ch.paint, 34, 650, e.ch.pal, 1.6);
        GamePaint.puddle(e.x, e.y, 260, e.ch.paint, e.ch.pal);
        if (F.app && F.app.camera) F.app.camera.shake(320, 0.03);
        if (typeof Game !== 'undefined') Game.sfx('assets/sounds/splat_3.ogg', { volume: 0.9, rate: 0.7 });
        const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
        if (d < 300) { F.hitPlayer(p, e, { x: (p.x - e.x) / d, y: (p.y - e.y) / d }, c, 1.25); p.kx += (p.x - e.x) / d * 900; p.ky += (p.y - e.y) / d * 900; }
    },

    // Слуга появляется рядом с хозяином с хлопком краски.
    summon(e, type) {
        const F = GameFighters, a = Math.random() * Math.PI * 2;
        F.total++;
        F._spawnEnemy(type, { x: e.x + Math.cos(a) * 170, y: e.y + Math.sin(a) * 170 });
    },

    // --- Щит, взрыв, лечение, деление ------------------------------------------------------------

    // Удар игрока спереди по щиту отражён.
    blocks(e, p) {
        const def = e.def || {};
        if (!(def.ai === 'shield' || (def.mech || []).includes('shield'))) return false;
        if (e.ch.limbs.armL !== 'full' || !e.ch.leftItem || e.atk || (e.ai && e.ai.phase === 'tired')) return false;
        const toP = Math.atan2(p.y - e.y, p.x - e.x);
        return Math.abs(GameFighters._angDiff(e.heading, toP)) < 1.15;
    },

    blockFx(e, p) {
        const F = GameFighters;
        const at = new BABYLON.Vector3((e.x + p.x) / 2, F.groundH(e.x, e.y) + 120 * e.scale, (e.y + p.y) / 2);
        F.abilityFx('slap', at);
        F.impactFx(at, [1, 1, 1]);
        if (typeof GameUI !== 'undefined') GameUI.floatText(e.x, e.y, at.y + 70, Lang.t('block'), '#bfe6ff');
        if (typeof Game !== 'undefined') Game.sfx('assets/sounds/swing_2.ogg', { volume: 0.6, rate: 1.7 });
        const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
        p.kx += (p.x - e.x) / d * 420; p.ky += (p.y - e.y) / d * 420;
        e.ch.flash();
    },

    // Взрыв бомбера: ранит игрока и ВРАГОВ рядом, краска во все стороны.
    explode(e) {
        const F = GameFighters, c = F.cfg(), p = F.player;
        if (!e.ai || e.ai.boom) return;
        e.ai.boom = true;
        if (e.ai.spark) { try { e.ai.spark.stop(); } catch (err) { /* снят сменой карты */ } e.ai.spark = null; }
        const at = new BABYLON.Vector3(e.x, F.groundH(e.x, e.y) + 80, e.y);
        GamePaint.spray(at, new BABYLON.Vector3(0, 1, 0), e.ch.paint, 50, 820, e.ch.pal, 1.7);
        GamePaint.puddle(e.x, e.y, 300, e.ch.paint, e.ch.pal);
        F.ring(e.x, e.y, '#ff8a1f', 520);
        F.abilityFx('burn', at);
        if (F.app && F.app.camera) F.app.camera.shake(280, 0.035);
        if (typeof Game !== 'undefined') Game.sfx('assets/sounds/splat_2.ogg', { volume: 1, rate: 0.6 });
        if (p && p.alive) {
            const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
            if (d < 190) F.hitPlayer(p, e, { x: (p.x - e.x) / d, y: (p.y - e.y) / d }, c, 1);
        }
        for (const o of F.enemies) {
            if (!o.alive || o === e) continue;
            const d = Math.hypot(o.x - e.x, o.y - e.y) || 1;
            if (d < 200) F.hitEnemy(o, e, { x: (o.x - e.x) / d, y: (o.y - e.y) / d }, c, 2, { knock: 2.5 });
        }
        if (e.alive) F.killEnemy(e, { x: 0, y: 1 });
    },

    heal(e, o) {
        const F = GameFighters;
        o.hp = Math.min(o.maxHp, o.hp + 1.5);
        if (o.bar) F._bar(o);
        this.beam(e, o, '#5dff9a');
        const at = new BABYLON.Vector3(o.x, F.groundH(o.x, o.y) + 140 * o.scale, o.y);
        if (F.app && F.app.fx) F.app.fx.create({ position: at, texture: 'assets/fx/soft.webp', burst: 14, life: [0.4, 0.8], size: [12, 24], speed: [40, 120],
            direction: [[-0.5, 1, -0.5], [0.5, 2, 0.5]], color: '#5dff9a', color2: '#d8ffe6', blend: 'additive' });
        if (typeof GameUI !== 'undefined') GameUI.floatText(o.x, o.y, at.y + 60, '+', '#5dff9a');
        e.ch.play('slash_3', { layer: 'upper', loop: false, restart: true });
    },

    // Луч между двумя бойцами на миг (лечение).
    beam(a, b, hex) {
        const sc = this._scene();
        if (!sc) return;
        const F = GameFighters;
        const pa = new BABYLON.Vector3(a.x, F.groundH(a.x, a.y) + 150 * a.scale, a.y), pb = new BABYLON.Vector3(b.x, F.groundH(b.x, b.y) + 120 * b.scale, b.y);
        const line = BABYLON.MeshBuilder.CreateLines('beam', { points: [pa, BABYLON.Vector3.Lerp(pa, pb, 0.5).add(new BABYLON.Vector3(0, 40, 0)), pb] }, sc);
        line.color = BABYLON.Color3.FromHexString(hex);
        line.renderingGroupId = World3D.LAYER.OVERLAY;
        F.after(0.25, () => line.dispose());
    },

    // Павший враг: делитель распадается на двух малышей, бомбер всё равно взрывается.
    onKill(e) {
        const F = GameFighters, def = e.def || {};
        if (def.ai === 'splitter') {
            for (let i = 0; i < 2; i++) {
                const a = Math.random() * Math.PI * 2;
                F.total++;
                F._spawnEnemy('mini', { x: e.x + Math.cos(a) * 70, y: e.y + Math.sin(a) * 70, quick: true });
            }
        }
        if (def.ai === 'bomber' && e.ai && !e.ai.boom) F.after(0.12, () => this.explode(e));
        if (e.ai && e.ai.spark) { try { e.ai.spark.stop(); } catch (err) { /* снят */ } e.ai.spark = null; }
        if (e === this.bossF) { this.bossF = null; if (typeof GameUI !== 'undefined') GameUI.bossBar(null); }
    },

    // --- Снаряды и метки ---------------------------------------------------------------------------

    // Бомба краски по дуге в точку (tx, ty): на земле сразу метка-круг радиуса r.
    lob(e, tx, ty, r, mult, dur) {
        const sc = this._scene(), F = GameFighters;
        if (!sc) return;
        const q = F.clampArena(tx, ty, 40);
        const mesh = BABYLON.MeshBuilder.CreateSphere('paintBomb', { diameter: 46, segments: 8 }, sc);
        const mat = new BABYLON.StandardMaterial('paintBombMat', sc);
        const col = BABYLON.Color3.FromArray(e.ch.paint);
        mat.diffuseColor = col; mat.emissiveColor = col.scale(0.4); mat.specularColor = new BABYLON.Color3(0.6, 0.6, 0.6);
        mesh.material = mat;
        mesh.isPickable = false;
        World3D.addObject(F.app.location.view, mesh, 'prop', { ink: false, outline: false });
        this.shots.push({ mesh, mat, x0: e.x, y0: e.y, x1: q.x, y1: q.y, t: 0, dur: dur || 0.95, h: 380, r, mult: mult || 1, by: e, color: e.ch.paint });
        this.markCircle(q.x, q.y, r, dur || 0.95);
        if (typeof Game !== 'undefined') Game.sfx('assets/sounds/swing_1.ogg', { volume: 0.35, rate: 0.7 });
    },

    _mat(sc, hex, alpha) {
        const m = new BABYLON.StandardMaterial('warnMat', sc);
        m.disableLighting = true;
        m.emissiveColor = BABYLON.Color3.FromHexString(hex);
        m.alpha = alpha;
        m.disableDepthWrite = true;
        m.zOffset = -4;
        m.backFaceCulling = false;
        return m;
    },

    // Красный круг-предупреждение: заполняется к моменту удара.
    markCircle(x, y, r, dur) {
        const sc = this._scene(), F = GameFighters;
        if (!sc) return;
        const mesh = BABYLON.MeshBuilder.CreateDisc('warnCircle', { radius: 1, tessellation: 40, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, sc);
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(x, F.groundH(x, y) + 2, y);
        mesh.scaling.set(r, r, 1);
        mesh.isPickable = false;
        const mat = this._mat(sc, '#ff8a1f', 0.22);
        mesh.material = mat;
        const ring = BABYLON.MeshBuilder.CreateTorus('warnRing', { diameter: 2, thickness: 0.07, tessellation: 40 }, sc);
        ring.parent = mesh; ring.rotation.x = -Math.PI / 2; ring.material = mat;
        this.marks.push({ mesh, mat, t: 0, dur, grow: true, base: r, x, y });
    },

    // Красная полоса рывка от точки по направлению.
    markLine(x, y, dir, len, width, dur) {
        const sc = this._scene(), F = GameFighters;
        if (!sc) return;
        const mesh = BABYLON.MeshBuilder.CreateGround('warnLine', { width: 1, height: 1 }, sc);
        mesh.scaling.set(len, 1, width);
        mesh.rotation.y = -dir;
        const cx = x + Math.cos(dir) * len / 2, cy = y + Math.sin(dir) * len / 2;
        mesh.position.set(cx, F.groundH(cx, cy) + 2, cy);
        mesh.isPickable = false;
        mesh.material = this._mat(sc, '#ff8a1f', 0.3);
        this.marks.push({ mesh, mat: /** @type {BABYLON.StandardMaterial} */ (mesh.material), t: 0, dur, grow: false, base: 1, x: cx, y: cy });
    },

    update(dt) {
        const F = GameFighters, c = F.cfg(), p = F.player;
        for (let i = this.marks.length - 1; i >= 0; i--) {
            const m = this.marks[i];
            m.t += dt;
            const u = Math.min(1, m.t / m.dur);
            m.mat.alpha = (m.grow ? 0.16 + 0.3 * u : 0.22 + 0.2 * Math.abs(Math.sin(m.t * 14))) * (u >= 1 ? Math.max(0, 1 - (m.t - m.dur) / 0.15) : 1);
            if (m.t >= m.dur + 0.15) { m.mesh.dispose(); m.mat.dispose(); this.marks.splice(i, 1); }
        }
        for (let i = this.shots.length - 1; i >= 0; i--) {
            const s = this.shots[i];
            s.t += dt;
            const u = Math.min(1, s.t / s.dur);
            const x = s.x0 + (s.x1 - s.x0) * u, y = s.y0 + (s.y1 - s.y0) * u;
            s.mesh.position.set(x, F.groundH(x, y) + 30 + Math.sin(Math.PI * u) * s.h, y);
            s.mesh.rotation.x += dt * 8;
            if (u < 1) continue;
            // попадание: краска, урон игроку в круге
            const at = new BABYLON.Vector3(s.x1, F.groundH(s.x1, s.y1) + 20, s.y1);
            GamePaint.spray(at, new BABYLON.Vector3(0, 1, 0), s.color, 20, 480, s.by && s.by.ch ? s.by.ch.pal : null, 1.5);
            GamePaint.splat(s.x1, s.y1, s.r * 1.8, s.color, 0.15);
            if (typeof Game !== 'undefined') Game.sfx('assets/sounds/splat_1.ogg', { volume: 0.55, rate: 1.1 });
            if (p && p.alive) {
                const d = Math.hypot(p.x - s.x1, p.y - s.y1) || 1;
                if (d < s.r) F.hitPlayer(p, s.by, { x: (p.x - s.x1) / d, y: (p.y - s.y1) / d }, c, s.mult);
            }
            World3D.removeObject(F.app.location.view, s.mesh); s.mat.dispose();
            this.shots.splice(i, 1);
        }
        if (this.bossF && typeof GameUI !== 'undefined') GameUI.bossBar(this.bossF);
    },
};
