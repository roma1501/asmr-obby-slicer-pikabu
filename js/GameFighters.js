// GameFighters.js — бой Paint Blade: игрок (джойстик/WASD, автоудар мечом по ближайшему врагу), враги
// (погоня, удар с замахом, бегство без меча, прыжки на одной ноге), попадания, отрубание частей, смерть,
// волны врагов, границы арены (маркер arena) и препятствия (Nav, маркеры block).
// Позиции и решения — числами игры (x, y по карте), вид — PbCharacter (GameCharacter.js).

/** @typedef {{ id: number, team: 'player' | 'enemy', type: string, def: any, x: number, y: number, kx: number, ky: number,
 *   heading: number, hp: number, maxHp: number, speed: number, reach: number, scale: number, ch: PbCharacter,
 *   state: string, t: number, cd: number, atk: any, stag: number, inv: number, alive: boolean, hitShown: number,
 *   combo: number, spinCd: number, moving: boolean, coins: number, wander: number, bar: HTMLElement | null,
 *   stats: any, shield: number, shieldMax: number, shieldT: number, burn: number, burnFx: any, slow: number, bleed: number,
 *   dot: number, hits: number, nova: boolean, ai: any, jumpH: number }} PbFighter */

/** @satisfies {Record<string, any>} */
const GameFighters = {
    /** @type {LoryApp | null} */ app: null,
    /** @type {PbFighter | null} */ player: null,
    /** @type {PbFighter[]} */ enemies: [],
    /** @type {string[]} */ queue: [],
    /** @type {any} */ level: null,
    /** @type {any} */ arena: null,
    /** @type {any} */ cosm: null,       // экипировка игрока: { skin, hat, sword, paint, trail } — объекты каталогов
    running: false,
    finished: false,
    tutorialSafe: false,
    showcase: false,                    // меню/магазин: герой позирует с поднятым мечом (Game.update)                // обучение: враги не бьют, пока игрок не ударил сам, и бьют слабее
    playerHit: false,
    spawnT: 0,
    killed: 0,
    total: 0,
    coins: 0,
    timeScale: 1,
    slowT: 0,
    _id: 0,
    bossQueued: false,
    /** @type {{ onHit?: (f: PbFighter) => void, onKill?: (f: PbFighter, coins: number) => void, onPlayerHit?: (f: PbFighter, by?: PbFighter) => void, onWin?: () => void, onLose?: () => void, onSpawn?: (f: PbFighter) => void } } */
    hooks: {},
    stick: { x: 0, y: 0 },              // экранный джойстик (GameUI): x вправо, y вверх, длина ≤ 1
    /** @type {Array<{ t: number, fn: () => void }>} */
    timers: [],                         // отложенные действия в ИГРОВОМ времени: на любой паузе стоят

    // Через sec секунд игрового времени (не setTimeout: пауза площадки должна останавливать всё).
    after(sec, fn) { this.timers.push({ t: sec, fn }); },

    _tickTimers(dt) {
        if (!this.timers.length) return;
        const due = [];
        for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0) due.push(tm); }
        if (!due.length) return;
        this.timers = this.timers.filter(tm => tm.t > 0);
        for (const tm of due) { try { tm.fn(); } catch (e) { console.error(e); } }
    },

    cfg() {
        const U = 'undefined';
        return {
            hp: typeof PB_PLAYER_HP !== U ? PB_PLAYER_HP : 100,
            speed: typeof PB_PLAYER_SPEED !== U ? PB_PLAYER_SPEED : 410,
            reach: typeof PB_PLAYER_REACH !== U ? PB_PLAYER_REACH : 190,
            arc: (typeof PB_PLAYER_ARC_DEG !== U ? PB_PLAYER_ARC_DEG : 150) * Math.PI / 180,
            atk: typeof PB_PLAYER_ATTACK_SEC !== U ? PB_PLAYER_ATTACK_SEC : 0.42,
            spin: typeof PB_PLAYER_SPIN_SEC !== U ? PB_PLAYER_SPIN_SEC : 4,
            aggro: typeof PB_AGGRO_RANGE !== U ? PB_AGGRO_RANGE : 520,
            eSpeed: typeof PB_ENEMY_SPEED !== U ? PB_ENEMY_SPEED : 250,
            eReach: typeof PB_ENEMY_REACH !== U ? PB_ENEMY_REACH : 165,
            eDmg: typeof PB_ENEMY_DAMAGE !== U ? PB_ENEMY_DAMAGE : 12,
            eAtk: typeof PB_ENEMY_ATTACK_SEC !== U ? PB_ENEMY_ATTACK_SEC : 1.35,
            maxAlive: typeof PB_ENEMY_MAX_ALIVE !== U ? PB_ENEMY_MAX_ALIVE : 5,
            body: typeof PB_BODY_RADIUS !== U ? PB_BODY_RADIUS : 46,
            hitstop: typeof PB_HITSTOP_SEC !== U ? PB_HITSTOP_SEC : 0.06,
            knock: typeof PB_KNOCKBACK !== U ? PB_KNOCKBACK : 260,
            coinsKill: typeof PB_COINS_KILL !== U ? PB_COINS_KILL : 4,
        };
    },

    // --- Арена ------------------------------------------------------------------------------

    // Маркер arena: круг (scale[0]·100) или прямоугольник (scale[0]·100 × scale[2]·100, поворот rot[1]).
    readArena(location) {
        const m = location.marker('arena');
        if (!m) return { x: location.width / 2, y: location.height / 2, r: Math.min(location.width, location.height) * 0.4, rect: false };
        const s = m.scale || [8, 1, 8];
        const a = Number(s[0]) * 100, b = Number(s[2] == null ? s[0] : s[2]) * 100;
        const rect = Math.abs(a - b) > 1;
        return { x: m.x, y: m.y, r: a, hx: a, hy: b, rect, rot: ((m.rot && m.rot[1]) || 0) * Math.PI / 180 };
    },

    clampArena(x, y, pad) {
        const A = this.arena;
        if (!A) return { x, y };
        if (!A.rect) {
            const dx = x - A.x, dy = y - A.y, d = Math.hypot(dx, dy), r = A.r - pad;
            if (d <= r) return { x, y };
            return { x: A.x + dx / d * r, y: A.y + dy / d * r };
        }
        const c = Math.cos(-A.rot), s = Math.sin(-A.rot);
        const dx = x - A.x, dy = y - A.y;
        let lx = dx * c - dy * s, ly = dx * s + dy * c;
        lx = Math.max(-A.hx + pad, Math.min(A.hx - pad, lx));
        ly = Math.max(-A.hy + pad, Math.min(A.hy - pad, ly));
        const c2 = Math.cos(A.rot), s2 = Math.sin(A.rot);
        return { x: A.x + lx * c2 - ly * s2, y: A.y + lx * s2 + ly * c2 };
    },

    groundH(x, y) {
        const loc = this.app && this.app.location;
        return loc && loc.terrain ? loc.terrain.heightAt(x, y) : 0;
    },

    // --- Раунд --------------------------------------------------------------------------------

    // Новый раунд на загруженной карте: игрок у spawn, очередь врагов. Зовётся в prepare (под загрузкой).
    async start(app, level, cosm) {
        this.app = app;
        this.clear();
        this.level = level;
        this.cosm = cosm;
        this.arena = this.readArena(app.location);
        if (typeof Nav !== 'undefined') Nav.build(app.location);
        const sp = app.location.marker('spawn') || { x: this.arena.x, y: this.arena.y + this.arena.r * 0.6, rot: [0, -90, 0] };
        this.player = await this._spawnPlayer(sp.x, sp.y, ((sp.rot && sp.rot[1]) || -90) * Math.PI / 180);
        this.queue = level.enemies.filter(t => t !== 'boss');
        this.bossQueued = level.enemies.includes('boss');
        this.total = level.enemies.length;
        this.killed = 0;
        this.coins = 0;
        this.spawnT = 0.6;
        this.finished = false;
        this.running = false;
        this.timeScale = 1;
        this.slowT = 0;
        this.playerHit = false;
    },

    // Всё убрать: персонажи, куски, краска (краску чистит смена карты/GamePaint.reset).
    clear() {
        this.timers = [];
        if (typeof GameEnemies !== 'undefined') GameEnemies.clear();
        for (const a of this.anims) a.end();
        this.anims = [];
        for (const e of this.enemies) this._disposeFighter(e);
        if (this.player) this._disposeFighter(this.player);
        this.enemies = [];
        this.player = null;
        GameCharacter.clearPieces();
    },

    _disposeFighter(f) {
        if (f.bar && f.bar.parentNode) f.bar.parentNode.removeChild(f.bar);
        f.bar = null;
        if (f.ch && !f.ch.rig.disposed) f.ch.dispose();   // и «стоящие» тела (обезглавлен/разрублен) до обрушения
    },

    _paintOf(pal) {
        const cs = (pal && pal.colors) || ['#ffd400'];
        return GamePaint.rgb(cs[(Math.random() * cs.length) | 0]);
    },

    async _spawnPlayer(x, y, heading) {
        const c = this.cfg();
        const skin = this.cosm.skin;
        const paint = GamePaint.rgb(skin.look.shirt || '#ff3d7f');
        const ch = new PbCharacter(this.app.location.view, { name: 'player', look: skin.look, scale: 1, paint, pal: null });
        await Promise.all([
            ch.setSword(this.cosm.sword ? this.cosm.sword.model : null, this.cosm.sword),
            ch.setHat(this.cosm.hat ? this.cosm.hat.model : null),
            ch.setDetails(skin.look.details || []),
        ]);
        ch.setTrail(this.cosm.trail);
        ch.play('idle');
        const f = this._fighter('player', 'player', null, x, y, heading, ch, c.hp, c.speed, c.reach, 1);
        ch.place(x, y, this.groundH(x, y), heading);
        this.applyPlayerStats(f, true);
        return f;
    },

    // Характеристики игрока: меч (урон, скорость, дальность, способность) + скин (здоровье, бег) + прокачка.
    playerStats() {
        const c = this.cfg();
        const sw = GameData.swordStats(this.cosm && this.cosm.sword ? this.cosm.sword.id : 'sword_basic');
        const sk = GameData.skinStats(this.cosm && this.cosm.skin ? this.cosm.skin.id : 'skin_noob');
        const up = (typeof Game !== 'undefined' && Game.save && Game.save.upgrades) || {};
        const L = (k) => Math.max(0, Math.min(GameData.UPGRADE_MAX, up[k] | 0));
        return {
            sword: sw,
            maxHp: Math.round(c.hp * sk.hp * (1 + GameData.UPGRADES.hp.step * L('hp'))),
            shield: Math.round(GameData.UPGRADES.shield.step * L('shield')),
            dmg: sw.dmg * (1 + GameData.UPGRADES.dmg.step * L('dmg')),
            speed: c.speed * sk.speed * (1 + GameData.UPGRADES.speed.step * L('speed')),
            atk: c.atk * sw.speed * (1 - 0.03 * L('speed')),
            reach: c.reach * sw.reach * (1 + GameData.UPGRADES.reach.step * L('reach')), arc: c.arc * sw.arc, knock: sw.knock,
            spinAll: !!(up.spin && up.spinOn !== false),
            vamp: GameData.UPGRADES.vamp.step * L('vamp'),
        };
    },

    // Применить характеристики к игроку; full — полное здоровье (новый раунд), иначе доля сохраняется.
    applyPlayerStats(f, full) {
        const p = f || this.player;
        if (!p) return;
        const s = this.playerStats(), ratio = p.maxHp > 0 ? p.hp / p.maxHp : 1;
        p.stats = s;
        p.maxHp = s.maxHp;
        p.hp = full || !this.running ? s.maxHp : Math.max(1, Math.round(s.maxHp * ratio));
        p.speed = s.speed; p.reach = s.reach;
        p.shieldMax = s.shield;
        if (full || !this.running) p.shield = s.shield;
        if (p.bar) this._bar(p);
    },

    // Перекрасить/переодеть игрока на лету (магазин, примерка).
    async refreshPlayer(cosm) {
        this.cosm = cosm;
        const p = this.player;
        if (!p || !p.alive) return;
        p.ch.applyLook(cosm.skin.look);
        await Promise.all([
            p.ch.setSword(cosm.sword ? cosm.sword.model : null, cosm.sword),
            p.ch.setHat(cosm.hat ? cosm.hat.model : null),
            p.ch.setDetails(cosm.skin.look.details || []),
        ]);
        p.ch.setTrail(cosm.trail);
        this.applyPlayerStats(p, false);
    },

    _fighter(team, type, def, x, y, heading, ch, hp, speed, reach, scale) {
        /** @type {PbFighter} */
        const f = { id: ++this._id, team, type, def, x, y, kx: 0, ky: 0, heading, hp, maxHp: hp, speed, reach, scale, ch,
            state: 'idle', t: 0, cd: 0.3, atk: null, stag: 0, inv: 0, alive: true, hitShown: 0, combo: 0, spinCd: 0,
            moving: false, coins: 0, wander: Math.random() * 6, bar: null,
            stats: null, shield: 0, shieldMax: 0, shieldT: 0, burn: 0, burnFx: null, slow: 0, bleed: 0, dot: 0, hits: 0, nova: false,
            ai: null, jumpH: 0 };
        return f;
    },

    _pickSpawn(name) {
        const loc = this.app.location;
        let list = loc.markers(name);
        if (!list.length) list = loc.markers('enemy');
        const p = this.player;
        const far = list.filter(m => !p || Math.hypot(m.x - p.x, m.y - p.y) > 420);
        const pool = far.length ? far : list;
        if (!pool.length) {
            const a = Math.random() * Math.PI * 2, A = this.arena;
            return { x: A.x + Math.cos(a) * A.r * 0.8, y: A.y + Math.sin(a) * A.r * 0.8 };
        }
        return pool[(Math.random() * pool.length) | 0];
    },

    pending: 0,                          // враги в процессе появления (модели грузятся) — победы ещё нет

    // at — своё место появления (слуги босса, малыши делителя); иначе маркер enemy/boss.
    async _spawnEnemy(type, at) {
        if (!type) return null;
        this.pending++;
        try { return await this._spawnEnemyNow(type, at); } finally { this.pending--; }
    },

    async _spawnEnemyNow(type, place) {
        const c = this.cfg();
        const boss = type === 'boss';
        const bossDef = boss ? GameData.boss(this.level ? this.level.chapter : 1) : null;
        const def = boss ? Object.assign({}, GameData.ENEMIES.boss, { hp: bossDef.hp, speed: bossDef.speed, damage: bossDef.damage, scale: bossDef.scale,
            mech: bossDef.mech, bossDef, coins: 8 + bossDef.cycle * 2 }) : (GameData.ENEMIES[type] || GameData.ENEMIES.noob);
        const at = place ? GameFighters.clampArena(place.x, place.y, 60) : this._pickSpawn(boss ? 'boss' : 'enemy');
        const skinId = boss ? bossDef.skin : def.skin || GameData.ENEMY_SKIN_POOL[(Math.random() * GameData.ENEMY_SKIN_POOL.length) | 0];
        const skin = GameData.skin(skinId);
        const look = Object.assign({}, skin.look, { face: GameData.ENEMY_FACES[(Math.random() * GameData.ENEMY_FACES.length) | 0] });
        if (boss) look.face = 'evil';
        const pal = this.cosm.paint;
        const paint = this._paintOf(pal);
        const ch = new PbCharacter(this.app.location.view, { name: 'enemy' + this._id, look, scale: def.scale, paint, pal });
        const swords = typeof GAME_SWORDS !== 'undefined' ? GAME_SWORDS : [];
        const plain = swords.filter(s => s.rarity === 'common');
        const sw = boss ? swords.filter(s => s.rarity === 'epic' || s.rarity === 'legendary') : plain;
        const sword = sw.length ? sw[(Math.random() * sw.length) | 0] : null;
        const hats = typeof GAME_HATS !== 'undefined' ? GAME_HATS : [];
        const hat = boss ? (hats.find(h => h.id.includes(bossDef.hat)) || null)
            : (hats.length && !def.skin && Math.random() < 0.3 ? hats[(Math.random() * hats.length) | 0] : null);
        await Promise.all([
            def.sword === false ? Promise.resolve() : ch.setSword(sword ? sword.model : null, sword),
            ch.setHat(hat ? hat.model : null),
            ch.setDetails(boss ? (look.details || []) : []),
        ]);
        if (!this.app || !this.player) { ch.dispose(); return null; }
        const hp = def.hp + (this.level ? this.level.hpBonus : 0) * (boss ? 3 : 1);
        const heading = Math.atan2(this.player.y - at.y, this.player.x - at.x);
        const f = this._fighter('enemy', type, def, at.x, at.y, heading, ch, hp, c.eSpeed * def.speed, c.eReach * def.scale, def.scale);
        f.state = 'spawn'; f.t = place && place.quick ? 0.35 : 0;
        f.cd = 0.8 + Math.random() * 0.8;
        ch.place(at.x, at.y, this.groundH(at.x, at.y), heading);
        ch.play('idle', { at: Math.random() });
        this.enemies.push(f);
        if (typeof GameEnemies !== 'undefined') GameEnemies.onSpawn(f);
        // появление: хлопок краски
        const p = new BABYLON.Vector3(at.x, this.groundH(at.x, at.y) + 60, at.y);
        GamePaint.spray(p, new BABYLON.Vector3(0, 1, 0), paint, 14, 380, pal, 1.2);
        GamePaint.splat(at.x, at.y, 120 * def.scale, paint, 0.2);
        if (this.hooks.onSpawn) this.hooks.onSpawn(f);
        return f;
    },

    // --- Кадр ---------------------------------------------------------------------------------

    update(rawDt) {
        this._tickTimers(rawDt);
        this._tickAnims(rawDt);
        if (!this.player) return;
        // замедление на последнем ударе
        if (this.slowT > 0) { this.slowT -= rawDt; this.timeScale = this.slowT > 0 ? 0.3 : 1; }
        const dt = rawDt * this.timeScale;
        const c = this.cfg();
        if (this.running && !this.finished) {
            this._updatePlayer(dt, c);
            // волны
            this.spawnT -= dt;
            const alive = this.enemies.filter(e => e.alive).length + this.pending;
            if (this.spawnT <= 0 && alive < c.maxAlive) {
                if (this.queue.length) { this.spawnT = 0.7; this._spawnEnemy(this.queue.shift()); }
                else if (this.bossQueued && (this.killed >= Math.ceil((this.total - 1) * 0.4) || alive === 0)) {
                    this.bossQueued = false; this.spawnT = 1; this._spawnEnemy('boss');
                }
            }
        } else if (this.player.alive) {
            this._idlePlayer(dt);
        }
        for (const e of this.enemies) if (e.alive) this._updateEnemy(e, dt, c);
        this._separate(c);
        for (const f of [this.player, ...this.enemies]) {
            if (!f.alive) continue;
            f.ch.place(f.x, f.y, this.groundH(f.x, f.y) + (f.jumpH || 0), f.heading);
            f.ch.update(dt);
        }
        Rig.updateAll(dt);
        if (typeof GameEnemies !== 'undefined') GameEnemies.update(dt);
        GameCharacter.updatePieces(dt, (x, z) => this.groundH(x, z));
        GamePaint.update(dt);
        // все враги повержены — победа
        if (this.running && !this.finished && this.player.alive && !this.queue.length && !this.bossQueued && !this.pending && this.enemies.every(e => !e.alive)) {
            this.finished = true;
            this.running = false;
            this.after(0.7, () => { if (this.hooks.onWin) this.hooks.onWin(); });
        }
    },

    // Меню и пауза между раундами: игрок дышит на месте.
    _idlePlayer(dt) {
        const p = this.player;
        p.moving = false;
        if (/** @type {any} */ (p).dance) return;
        if (p.atk) this._tickAttack(p, dt, this.cfg());
        // поза для витрины: правая рука с мечом поднята вперёд-вверх, меч хорошо виден
        if (this.showcase && !p.atk && p.ch.limbs.armR === 'full') p.ch.rig.offset('Arm_R', 0, 0, 0.75);
        this._baseAnim(p);
    },

    _baseAnim(f) {
        const legs = f.ch.limbs.legL !== 'full' || f.ch.limbs.legR !== 'full';
        const clip = f.moving ? (legs ? 'hop' : 'run') : (legs ? 'hop' : 'idle');
        if (f.atk && (f.team === 'enemy' || f.atk.spin)) return;
        const speed = clip === 'run' ? Math.max(0.6, Math.min(1.3, f.speed / (f.scale || 1) / GameCharacter.RUN_PX)) : 1;
        f.ch.play(clip, { fade: 0.15, speed });
    },

    _updatePlayer(dt, c) {
        const p = this.player;
        if (!p.alive) return;
        p.inv = Math.max(0, p.inv - dt);
        p.cd = Math.max(0, p.cd - dt);
        p.spinCd = Math.max(0, p.spinCd - dt);
        // ввод: клавиатура/геймпад (Input) + экранный джойстик
        let mx = this.stick.x, my = this.stick.y;
        if (typeof Input !== 'undefined' && Input.enabled) { const m = Input.move(); mx += m.x; my += m.y; }
        const ml = Math.hypot(mx, my);
        if (ml > 1) { mx /= ml; my /= ml; }
        const vx = mx * p.speed, vy = -my * p.speed;
        p.moving = ml > 0.12;
        this._move(p, (vx + p.kx) * dt, (vy + p.ky) * dt, c);
        p.kx *= Math.pow(0.02, dt); p.ky *= Math.pow(0.02, dt);
        // цель: ближайший живой враг
        let target = null, best = Infinity, near = 0;
        for (const e of this.enemies) {
            if (!e.alive || e.state === 'spawn') continue;
            const d = Math.hypot(e.x - p.x, e.y - p.y) - c.body * (e.scale - 1);
            if (d < best) { best = d; target = e; }
            if (d <= p.reach) near++;
        }
        // поворот: к цели в бою, иначе по ходу
        let want = p.heading;
        if (target && best < c.aggro && (best <= p.reach * 1.25 || p.atk)) want = Math.atan2(target.y - p.y, target.x - p.x);
        else if (p.moving) want = Math.atan2(vy, vx);
        p.heading = this._turn(p.heading, want, dt * (p.atk ? 16 : 12));
        // удар
        // щит: восстанавливается через 3 с без урона
        if (p.shieldMax > 0) { if (p.shieldT > 0) p.shieldT -= dt; else p.shield = Math.min(p.shieldMax, p.shield + p.shieldMax * 0.35 * dt); }
        if (p.atk) this._tickAttack(p, dt, c);
        else if (target && best <= p.reach && p.cd <= 0) {
            if (p.stats && p.stats.spinAll) this._startAttack(p, 'spin', c);          // легендарный навык «Вихрь»
            else if (near >= 2 && p.spinCd <= 0) { p.spinCd = c.spin; this._startAttack(p, 'spin', c); }
            else { const clip = ['slash_1', 'slash_2', 'slash_3'][p.combo % 3]; p.combo++; this._startAttack(p, clip, c); }
        }
        this._baseAnim(p);
        if (p.bar) this._bar(p);
    },

    _updateEnemy(e, dt, c) {
        const p = this.player;
        if (!this._statuses(e, dt)) return;
        e.t += dt;
        e.cd = Math.max(0, e.cd - dt);
        e.stag = Math.max(0, e.stag - dt);
        e.inv = Math.max(0, e.inv - dt);
        let vx = 0, vy = 0;
        const legs = e.ch.limbs.legL !== 'full' || e.ch.limbs.legR !== 'full';
        const sp = e.speed * (legs ? 0.45 : 1) * (e.slow > 0 ? 0.5 : 1);
        const armed = e.ch.limbs.armR === 'full' && !!e.ch.sword;
        if (e.ai && typeof GameEnemies !== 'undefined') GameEnemies.tick(e, dt);
        const special = e.state !== 'spawn' && !e.atk && p && p.alive && this.running && typeof GameEnemies !== 'undefined'
            ? GameEnemies.think(e, dt, c, p) : null;
        if (e.state === 'spawn') {
            if (e.t > 0.55) { e.state = 'chase'; }
        } else if (e.atk) {
            this._tickAttack(e, dt, c);
        } else if (special) {
            vx = special.vx; vy = special.vy;      // особая механика (GameEnemies)
        } else if (e.stag > 0) {
            // оглушён: только отброс
        } else if (!p || !p.alive || !this.running) {
            // игрок пал или раунд не идёт — враги бродят и празднуют
            e.wander += dt;
            vx = Math.cos(e.wander * 0.7 + e.id) * sp * 0.25; vy = Math.sin(e.wander * 0.9 + e.id) * sp * 0.25;
        } else if (!armed) {
            // без меча: убегает от игрока
            const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
            if (d < 520) { vx = dx / d * sp * 0.85; vy = dy / d * sp * 0.85; }
            else { e.wander += dt; vx = Math.cos(e.wander + e.id) * sp * 0.3; vy = Math.sin(e.wander * 1.3 + e.id) * sp * 0.3; }
            e.heading = this._turn(e.heading, Math.atan2(vy, vx), dt * 8);
        } else {
            const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
            const want = Math.atan2(dy, dx);
            const slowTurn = e.def && (e.def.ai === 'shield' || (e.def.mech || []).includes('shield'));
            e.heading = this._turn(e.heading, want, dt * (slowTurn ? 2.4 : 7));   // щитоносца можно обойти
            const stop = e.reach * 0.8 + c.body * (e.scale - 1);
            if (d > stop) { vx = dx / d * sp; vy = dy / d * sp; }
            const facing = Math.abs(this._angDiff(e.heading, want)) < 0.6;
            if (d <= e.reach + c.body * e.scale && e.cd <= 0 && facing && !(this.tutorialSafe && !this.playerHit)) {
                const clip = e.type === 'boss' && Math.random() < 0.35 ? 'spin' : ['slash_1', 'slash_2', 'slash_3'][(Math.random() * 3) | 0];
                this._startAttack(e, clip, c);
            }
        }
        e.moving = Math.hypot(vx, vy) > 10;
        this._move(e, (vx + e.kx) * dt, (vy + e.ky) * dt, c);
        e.kx *= Math.pow(0.02, dt); e.ky *= Math.pow(0.02, dt);
        this._baseAnim(e);
        if (e.bar) this._bar(e);
    },

    _move(f, dx, dy, c) {
        let x = f.x + dx, y = f.y + dy;
        if (typeof Nav !== 'undefined' && Nav.move) {
            const r = Nav.move(f.x, f.y, dx, dy, c.body * f.scale * 0.8);
            if (r) { x = r.x; y = r.y; }
        }
        const q = this.clampArena(x, y, c.body * f.scale);
        f.x = q.x; f.y = q.y;
    },

    // Персонажи не стоят друг в друге.
    _separate(c) {
        const all = [this.player, ...this.enemies].filter(f => f && f.alive);
        for (let i = 0; i < all.length; i++) {
            for (let j = i + 1; j < all.length; j++) {
                const a = all[i], b = all[j];
                const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
                const min = c.body * (a.scale + b.scale) * 0.95;
                if (d >= min) continue;
                const push = (min - d) / 2, nx = dx / d, ny = dy / d;
                const wa = a.team === 'player' ? 0.3 : 1, wb = b.team === 'player' ? 0.3 : 1;
                a.x -= nx * push * wa; a.y -= ny * push * wa;
                b.x += nx * push * wb; b.y += ny * push * wb;
            }
        }
        for (const f of all) { const q = this.clampArena(f.x, f.y, c.body * f.scale); f.x = q.x; f.y = q.y; }
    },

    _angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; },
    _turn(a, b, k) { const d = this._angDiff(a, b); return a + d * Math.min(1, k); },

    // --- Удары ---------------------------------------------------------------------------------

    _startAttack(f, clip, c) {
        const ch = f.ch;
        const has = ch.rig.has(clip);
        const dur = has ? ch.rig.duration(clip) : 0.45;
        const frac = GameCharacter.IMPACT[clip] || 0.5;
        const sw = f.team === 'player' && f.stats ? f.stats.sword : null;
        const speed = f.team === 'player' ? Math.max(0.8, Math.min(1.6, 1.15 / (sw ? sw.speed : 1))) : (f.type === 'boss' ? 0.8 : 0.9);
        f.atk = { clip, t: 0, dur: dur / speed, at: dur * frac / speed, hit: false, spin: clip === 'spin' };
        ch.play(clip, { layer: f.team === 'player' && clip !== 'spin' ? 'upper' : 'base', loop: false, restart: true, fade: 0.06, speed });
        ch.trail(true);
        if (typeof Game !== 'undefined') Game.sfx(clip === 'spin' ? 'assets/sounds/whoosh_spin.ogg' : ['assets/sounds/swing_1.ogg', 'assets/sounds/swing_2.ogg', 'assets/sounds/swing_3.ogg'][(Math.random() * 3) | 0], { volume: f.team === 'player' ? 0.55 : 0.3, rate: 0.9 + Math.random() * 0.2 });
    },

    _tickAttack(f, dt, c) {
        const a = f.atk;
        a.t += dt;
        if (!a.hit && a.t >= a.at) { a.hit = true; this._impact(f, c); }
        if (a.t >= a.dur) {
            f.atk = null;
            f.ch.trail(false);
            if (f.team === 'player') { f.cd = f.stats ? f.stats.atk : c.atk; f.ch.rig.stop('upper', 0.12); }
            else f.cd = c.eAtk * (f.def ? f.def.rate : 1) * (0.8 + Math.random() * 0.45);
        }
    },

    _impact(f, c) {
        if (!f.alive) return;
        if (f.team === 'player') {
            const st = f.stats, ab = st ? st.sword.ability : null;
            const arc = f.atk && f.atk.spin ? Math.PI * 2 : (st ? st.arc : c.arc);
            let hits = 0;
            for (const e of this.enemies) {
                if (!e.alive || e.state === 'spawn') continue;
                const dx = e.x - f.x, dy = e.y - f.y, d = Math.hypot(dx, dy);
                const ang = Math.abs(this._angDiff(f.heading, Math.atan2(dy, dx)));
                const inArc = d <= f.reach + c.body * e.scale && ang <= arc / 2;
                const pierce = ab === 'pierce' && d <= f.reach * 1.5 + c.body * e.scale && ang < 0.3;   // трезубец: длинная линия
                if (!inArc && !pierce) continue;
                this.strike(e, f, { x: dx / (d || 1), y: dy / (d || 1) }, c);
                hits++;
            }
            if (hits && ab === 'shockwave' && ++f.hits % 3 === 0) this.shockwave(f, c);
            if (hits) {
                f.ch.rig.speed = 0; this.after(c.hitstop, () => { if (!f.ch.rig.disposed) f.ch.rig.speed = 1; });
                if (this.app && this.app.camera) this.app.camera.shake(110, 0.006 + hits * 0.003);
            }
        } else {
            const p = this.player;
            if (!p || !p.alive || p.inv > 0) return;
            const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy);
            const arc = f.atk && f.atk.spin ? Math.PI * 2 : Math.PI * 0.75;
            if (d > f.reach + c.body * 1.1) return;
            if (Math.abs(this._angDiff(f.heading, Math.atan2(dy, dx))) > arc / 2) return;
            this.hitPlayer(p, f, { x: dx / (d || 1), y: dy / (d || 1) }, c);
        }
    },

    // Удар по врагу: урон, отрубленная часть, краска, отброс; смерть — разлёт.
    // Удар игрока мечом: урон и способности меча (крит, поджог, заморозка, цепная молния…).
    strike(e, p, dir, c) {
        const st = p.stats, sw = st ? st.sword : GameData.swordStats('sword_basic'), ab = sw.ability;
        if (typeof GameEnemies !== 'undefined' && GameEnemies.blocks(e, p)) { GameEnemies.blockFx(e, p); return; }   // щит спереди
        let dmg = st ? st.dmg : 1, crit = false;
        if (ab === 'crit' && Math.random() < 0.25) { dmg *= 2.5; crit = true; }
        const at = new BABYLON.Vector3(e.x, this.groundH(e.x, e.y) + 120 * e.scale, e.y);
        this.hitEnemy(e, p, dir, c, dmg, { knock: sw.knock * (ab === 'slap' ? 1 : 1), cut: ab === 'shatter' ? 1 : null });
        if (st && st.vamp > 0 && p.alive && p.hp < p.maxHp) {   // вампиризм (прокачка): лечение за удар
            p.hp = Math.min(p.maxHp, p.hp + st.vamp);
            if (p.bar) this._bar(p);
        }
        if (crit) { this.abilityFx('crit', at); if (typeof GameUI !== 'undefined') GameUI.floatText(e.x, e.y, at.y + 80, Lang.t('crit'), '#d9a6ff'); }
        if (!e.alive) return;
        if (ab === 'bleed') e.bleed = 2;
        else if (ab === 'freeze') { if (e.slow <= 0) this.abilityFx('freeze', at); e.slow = 2; e.ch.tint(new BABYLON.Color3(0.55, 0.85, 1)); }
        else if (ab === 'burn') { e.burn = 3; this._burnFx(e, true); }
        else if (ab === 'slap') { e.stag = 0.9; this.abilityFx('slap', at.add(new BABYLON.Vector3(0, 90 * e.scale, 0))); }
        else if (ab === 'multi' && Math.random() < 0.3) this.after(0.12, () => { if (e.alive) this.hitEnemy(e, p, dir, c, dmg * 0.6, {}); });
        else if (ab === 'chain') this.chain(e, p, c);
    },

    // Цепная молния: ещё два ближайших врага.
    chain(from, p, c) {
        const others = this.enemies.filter(o => o.alive && o !== from && o.state !== 'spawn' && Math.hypot(o.x - from.x, o.y - from.y) < 420)
            .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y)).slice(0, 2);
        let prev = from;
        for (const o of others) {
            this.lightning(prev, o);
            const d = Math.hypot(o.x - prev.x, o.y - prev.y) || 1;
            this.hitEnemy(o, p, { x: (o.x - prev.x) / d, y: (o.y - prev.y) / d }, c, 1, {});
            prev = o;
        }
    },

    // Рок-волна (меч-гитара): удар по всем рядом.
    shockwave(p, c) {
        this.ring(p.x, p.y, '#ff5fa2', 560);
        for (const e of this.enemies) {
            if (!e.alive || e.state === 'spawn') continue;
            const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
            if (d < 300) this.hitEnemy(e, p, { x: dx / d, y: dy / d }, c, 1, { knock: 2 });
        }
    },

    // Длящиеся эффекты на враге: поджог, кровоток, заморозка. false — враг умер от них.
    _statuses(e, dt) {
        if (e.slow > 0) { e.slow -= dt; e.ch.rig.speed = e.slow > 0 ? 0.55 : 1; if (e.slow <= 0) e.ch.tint(null); }
        if (e.burn > 0 || e.bleed > 0) {
            e.dot += dt;
            if (e.burn > 0) { e.burn -= dt; if (e.burn <= 0) this._burnFx(e, false); }
            if (e.bleed > 0) e.bleed -= dt;
            if (e.dot >= 0.5) {
                e.dot = 0;
                const dmg = (e.burn > 0 ? 0.35 : 0) + (e.bleed > 0 ? 0.25 : 0);
                if (e.bleed > 0) GamePaint.drop(e.x, this.groundH(e.x, e.y) + 100 * e.scale, e.y, (Math.random() - 0.5) * 120, 80, (Math.random() - 0.5) * 120, 5, e.ch.paint, 1);
                if (dmg > 0) {
                    e.hp -= dmg;
                    if (e.bar) this._bar(e);
                    if (e.hp <= 0) { this.killEnemy(e, { x: 0, y: 1 }); return false; }
                }
            }
        }
        return true;
    },

    _burnFx(e, on) {
        const fx = this.app && this.app.fx;
        if (!on || !e.alive) { if (e.burnFx) { try { e.burnFx.stop(); } catch (err) { /* уже снят */ } e.burnFx = null; } return; }
        if (e.burnFx || !fx) return;
        e.burnFx = fx.create({ follow: () => new BABYLON.Vector3(e.x, this.groundH(e.x, e.y) + 110 * e.scale, e.y), texture: 'assets/fx/spark.webp',
            rate: 34, capacity: 60, life: [0.25, 0.6], size: [12, 26], speed: [40, 130], box: [[-30, -50, -30], [30, 40, 30]],
            direction: [[-0.3, 1, -0.3], [0.3, 2, 0.3]], color: '#ff7a1f', color2: '#ffd23f', blend: 'additive' });
    },

    hitEnemy(e, by, dir, c, dmg, o) {
        const opt = o || {};
        e.hp -= dmg == null ? 1 : dmg;
        const kn = c.knock * (opt.knock || 1);
        e.kx += dir.x * kn; e.ky += dir.y * kn;
        e.stag = 0.32;
        if (e.atk && e.type !== 'boss') { e.atk = null; e.ch.trail(false); }
        if (e.ai && e.ai.phase && e.ai.phase !== 'jump' && e.ai.phase !== 'fuse' && typeof GameEnemies !== 'undefined') GameEnemies._cancel(e);
        e.ch.flash();
        e.hitShown = 2.5;
        if (!e.bar) e.bar = this._makeBar(e);
        const hp = new BABYLON.Vector3(e.x, this.groundH(e.x, e.y) + 120 * e.scale, e.y);
        GamePaint.spray(hp, new BABYLON.Vector3(dir.x, 0.35, dir.y), e.ch.paint, 16, 520, e.ch.pal, 0.6);
        this.impactFx(hp, e.ch.paint);
        this.playerHit = true;
        if (this.hooks.onHit) this.hooks.onHit(e);
        if (typeof Game !== 'undefined') Game.sfx(['assets/sounds/cut_1.ogg', 'assets/sounds/cut_2.ogg', 'assets/sounds/cut_3.ogg'][(Math.random() * 3) | 0], { volume: 0.7, rate: 0.9 + Math.random() * 0.25 });
        if (e.hp <= 0) { this.killEnemy(e, dir); return; }
        if (Math.random() < (opt.cut != null ? opt.cut : (e.def ? e.def.cut : 1))) this._cutSomething(e, dir);
        e.ch.play('hit', { layer: 'upper', loop: false, restart: true, fade: 0.05 });
    },

    // Примерка меча или следа в меню/магазине: несколько взмахов подряд (без врагов).
    demoSwing(clips) {
        const p = this.player;
        if (!p || !p.alive) return;
        const c = this.cfg();
        clips.forEach((clip, i) => this.after(i * 0.5, () => { if (this.player === p && p.alive && !this.running) { p.atk = null; this._startAttack(p, clip, c); } }));
    },

    // Радужный взрыв: павший враг ранит всех рядом (цепная реакция возможна).
    nova(x, y) {
        const c = this.cfg(), p = this.player;
        const pal = GameData.paint('paint_rainbow');
        const at = new BABYLON.Vector3(x, this.groundH(x, y) + 80, y);
        GamePaint.spray(at, new BABYLON.Vector3(0, 1, 0), [1, 0.31, 0.64], 40, 760, pal, 1.6);
        this.ring(x, y, '#ff3d7f', 620);
        for (const e of this.enemies) {
            if (!e.alive || e.state === 'spawn') continue;
            const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy) || 1;
            if (d < 320) this.hitEnemy(e, p || e, { x: dx / d, y: dy / d }, c, 1.5, { knock: 2 });
        }
    },

    // Эффекты способностей (и в бою, и в примерке меча).
    abilityFx(kind, at) {
        const fx = this.app && this.app.fx;
        if (!fx) return;
        const burst = (o) => fx.create(Object.assign({ position: at, burst: 18, life: [0.3, 0.7], size: [14, 28], speed: [200, 480],
            direction: [[-1, -0.2, -1], [1, 1.2, 1]], blend: 'additive' }, o));
        if (kind === 'crit') burst({ texture: 'assets/fx/star.webp', color: '#e7c8ff', color2: '#a35cff', burst: 22, size: [16, 36] });
        else if (kind === 'freeze') burst({ texture: 'assets/fx/star.webp', color: '#ffffff', color2: '#8fe4ff', gravity: [0, -500, 0] });
        else if (kind === 'slap') burst({ texture: 'assets/fx/star.webp', color: '#fff6a0', color2: '#ffd23f', burst: 8, speed: [60, 140], direction: [[-1, 0.2, -1], [1, 0.6, 1]] });
        else if (kind === 'midas') burst({ texture: 'assets/fx/soft.webp', color: '#ffd23f', color2: '#ffb000', burst: 24, gravity: [0, -1200, 0], blend: 'standard', direction: [[-0.6, 1, -0.6], [0.6, 2, 0.6]] });
        else if (kind === 'shield') burst({ texture: 'assets/fx/soft.webp', color: '#8fe4ff', color2: '#2f9bff', burst: 14, size: [20, 40], speed: [120, 260] });
        else if (kind === 'burn') burst({ texture: 'assets/fx/spark.webp', color: '#ff7a1f', color2: '#ffd23f', burst: 26, direction: [[-0.5, 0.5, -0.5], [0.5, 2, 0.5]] });
    },

    // Молния между двумя бойцами: ломаная линия на миг.
    lightning(a, b) {
        const v = this.app && this.app.location && this.app.location.view;
        if (!v) return;
        const ha = this.groundH(a.x, a.y) + 120 * a.scale, hb = this.groundH(b.x, b.y) + 120 * b.scale;
        const pts = [];
        for (let i = 0; i <= 8; i++) {
            const u = i / 8, j = i === 0 || i === 8 ? 0 : 26;
            pts.push(new BABYLON.Vector3(a.x + (b.x - a.x) * u + (Math.random() - 0.5) * j, ha + (hb - ha) * u + (Math.random() - 0.5) * j, a.y + (b.y - a.y) * u + (Math.random() - 0.5) * j));
        }
        const line = BABYLON.MeshBuilder.CreateLines('bolt', { points: pts }, v.scene);
        line.color = new BABYLON.Color3(0.55, 0.95, 1);
        line.renderingGroupId = World3D.LAYER.OVERLAY;
        line.isPickable = false;
        this.abilityFx('freeze', pts[8]);
        this.after(0.16, () => line.dispose());
    },

    // Расходящееся кольцо по земле (волна, взрыв).
    ring(x, y, hex, size) {
        const v = this.app && this.app.location && this.app.location.view;
        if (!v) return;
        const m = BABYLON.MeshBuilder.CreateTorus('wave', { diameter: 1, thickness: 0.06, tessellation: 48 }, v.scene);
        const mat = new BABYLON.StandardMaterial('waveMat', v.scene);
        mat.disableLighting = true;
        mat.emissiveColor = BABYLON.Color3.FromHexString(hex);
        mat.alpha = 0.9;
        m.material = mat;
        m.isPickable = false;
        m.renderingGroupId = World3D.LAYER.OVERLAY;
        m.position.set(x, this.groundH(x, y) + 20, y);
        this.anims.push({ t: 0, dur: 0.38, fn: (u) => { const s = 40 + size * u; m.scaling.set(s, s * 0.6, s); mat.alpha = 0.9 * (1 - u); },
            end: () => { mat.dispose(); m.dispose(); } });
    },
    /** @type {Array<{ t: number, dur: number, fn: (u: number) => void, end: () => void }>} */
    anims: [],

    _tickAnims(dt) {
        for (let i = this.anims.length - 1; i >= 0; i--) {
            const a = this.anims[i];
            a.t += dt;
            const u = Math.min(1, a.t / a.dur);
            a.fn(u);
            if (u >= 1) { a.end(); this.anims.splice(i, 1); }
        }
    },

    // Примерка меча: показать способность перед героем.
    demoAbility(id) {
        const p = this.player;
        if (!p || !p.alive) return;
        const sw = GameData.swordStats(id), ab = sw.ability;
        const fx = p.x + Math.cos(p.heading) * 170, fy = p.y + Math.sin(p.heading) * 170;
        const at = new BABYLON.Vector3(fx, this.groundH(fx, fy) + 110, fy);
        if (!ab) { this.impactFx(at, [1, 1, 1]); return; }
        if (ab === 'crit') { this.abilityFx('crit', at); if (typeof GameUI !== 'undefined') GameUI.floatText(fx, fy, at.y + 60, Lang.t('crit'), '#d9a6ff'); }
        else if (ab === 'burn') this.abilityFx('burn', at);
        else if (ab === 'freeze' || ab === 'slap' || ab === 'midas') this.abilityFx(ab, at);
        else if (ab === 'shockwave') this.ring(p.x, p.y, '#ff5fa2', 560);
        else if (ab === 'chain') this.lightning({ x: p.x, y: p.y, scale: 1 }, { x: fx, y: fy, scale: 1 });
        else if (ab === 'nova') { this.ring(fx, fy, '#ff3d7f', 620); GamePaint.spray(at, new BABYLON.Vector3(0, 1, 0), [1, 0.31, 0.64], 30, 600, GameData.paint('paint_rainbow'), 1.4, 2.2); }
        else GamePaint.spray(at, new BABYLON.Vector3(Math.cos(p.heading), 0.6, Math.sin(p.heading)), [1, 0.3, 0.5], 20, 500, GameData.paint('paint_classic'), 0.8, 2.2);
    },

    // Вспышка удара: короткие белые искры и кольцо брызг цвета краски (ParticleFX, лимиты движка).
    impactFx(at, rgb) {
        const fx = this.app && this.app.fx;
        if (!fx) return;
        const hex = BABYLON.Color3.FromArray(rgb).toHexString();
        fx.create({ position: at, texture: 'assets/fx/star.webp', burst: 10, life: [0.18, 0.35], size: [18, 36], speed: [260, 520],
            direction: [[-1, -0.3, -1], [1, 1, 1]], color: '#ffffff', color2: '#fff6c2', blend: 'additive', spin: [-8, 8] });
        fx.create({ position: at, texture: 'assets/fx/soft.webp', burst: 1, life: [0.14, 0.14], size: [130, 130], speed: [0, 0],
            color: '#ffffff', blend: 'additive', sizeGradient: [[0, 0.3], [1, 1.2]], colorGradient: [[0, '#ffffff', 0.9], [1, hex, 0]] });
    },

    // Какую часть отрубить при не смертельном ударе.
    _cutSomething(f, dir) {
        const L = f.ch.limbs, opts = [];
        const add = (limb, whole, w) => opts.push({ limb, whole, w });
        if (L.armL === 'full') { add('armL', false, 3); add('armL', true, 2); } else if (L.armL === 'upper') add('armL', true, 2);
        if (L.armR === 'full') { add('armR', false, 1.2); add('armR', true, 0.8); } else if (L.armR === 'upper') add('armR', true, 1.5);
        const legOk = (other) => L[other] === 'full';
        if (L.legL === 'full' && legOk('legR')) { add('legL', false, 1.6); add('legL', true, 0.8); } else if (L.legL === 'upper' && legOk('legR')) add('legL', true, 1);
        if (L.legR === 'full' && legOk('legL')) { add('legR', false, 1.6); add('legR', true, 0.8); } else if (L.legR === 'upper' && legOk('legL')) add('legR', true, 1);
        if (!opts.length) return false;
        let r = Math.random() * opts.reduce((s, o) => s + o.w, 0);
        for (const o of opts) { r -= o.w; if (r <= 0) return f.ch.cut(o.limb, o.whole, dir); }
        return f.ch.cut(opts[0].limb, opts[0].whole, dir);
    },

    KILL_SFX: { burst: 'assets/sounds/kill_burst.ogg', behead: 'assets/sounds/kill_behead.ogg', bisect: 'assets/sounds/kill_bisect.ogg' },

    killEnemy(e, dir) {
        e.alive = false;
        e.atk = null;
        this._burnFx(e, false);
        e.ch.tint(null);
        if (e.bar && e.bar.parentNode) e.bar.parentNode.removeChild(e.bar);
        e.bar = null;
        // расчленение: взрыв на куски, отрубленная голова (тело стоит и брызжет) или разруб пополам
        const r = Math.random(), big = e.type === 'boss';
        let kill = 'burst';
        if (big || r < 0.42 || e.jumpH > 20) e.ch.explode(dir, big ? 1.6 : 1.15);
        else if (r < 0.72) { kill = 'behead'; e.ch.behead(dir); this.after(0.65, () => e.ch.collapse(dir)); }
        else { kill = 'bisect'; e.ch.bisect(dir); this.after(0.55, () => e.ch.collapse(dir)); }
        GamePaint.streak(e.x, e.y, dir, e.ch.paint, e.ch.pal, big ? 520 : 340);
        if (this.slowT <= 0.12) this.slowT = big ? 0.9 : 0.12;          // короткое замедление на каждом добивании
        if (this.app && this.app.camera) this.app.camera.zoom *= big ? 1.12 : 1.05;   // рывок камеры
        if (big) {
            for (let i = 1; i <= 3; i++) this.after(i * 0.16, () => {
                const a = Math.random() * Math.PI * 2;
                const at = new BABYLON.Vector3(e.x + Math.cos(a) * 90, this.groundH(e.x, e.y) + 120, e.y + Math.sin(a) * 90);
                GamePaint.spray(at, new BABYLON.Vector3(Math.cos(a), 1, Math.sin(a)), e.ch.paint, 36, 760, e.ch.pal, 1.4);
                this.ring(at.x, at.z, BABYLON.Color3.FromArray(e.ch.paint).toHexString(), 500);
            });
        }
        if (typeof GameEnemies !== 'undefined') GameEnemies.onKill(e);
        this.killed++;
        const c = this.cfg();
        let coins = Math.round(c.coinsKill * (e.def ? e.def.coins : 1));
        // способности меча при победе над врагом
        const p = this.player, ab = p && p.alive && p.stats ? p.stats.sword.ability : null;
        const at = new BABYLON.Vector3(e.x, this.groundH(e.x, e.y) + 100 * e.scale, e.y);
        if (ab === 'candy') coins += 3;
        if (ab === 'midas') { coins *= 2; this.abilityFx('midas', at); }
        if (ab === 'lifesteal' && p) { p.hp = Math.min(p.maxHp, p.hp + 8); if (typeof GameUI !== 'undefined') GameUI.floatText(p.x, p.y, this.groundH(p.x, p.y) + 260, '+8', '#5dff9a'); }
        if (ab === 'shatter') GamePaint.spray(at, new BABYLON.Vector3(0, 1, 0), e.ch.paint, 30, 700, e.ch.pal, 1.4);
        if (ab === 'nova' && !e.nova) {
            e.nova = true;
            this.after(0.12, () => this.nova(e.x, e.y));
        }
        this.coins += coins;
        if (typeof Game !== 'undefined') {
            // свой игрушечный звук у каждого добивания: разлёт на куски, отрубленная голова, разруб пополам
            Game.sfx(this.KILL_SFX[kill], { volume: big ? 1 : 0.85, rate: big ? 0.72 : 0.92 + Math.random() * 0.16 });
            if (big) Game.sfx('assets/sounds/enemy_die.ogg', { volume: 0.45, rate: 0.7 });
        }
        if (this.app && this.app.camera) this.app.camera.shake(220, e.type === 'boss' ? 0.025 : 0.012);
        const last = !this.queue.length && !this.bossQueued && this.enemies.every(x => !x.alive);
        if (last) this.slowT = 0.55;
        if (this.hooks.onKill) this.hooks.onKill(e, coins);
    },

    // Удар по игроку.
    hitPlayer(p, by, dir, c, mult) {
        if (!p.alive) return;
        let dmg = Math.round(c.eDmg * (by && by.def ? by.def.damage : 1) * (mult || 1) * (this.tutorialSafe ? 0.4 : 1));
        p.shieldT = 3;
        if (p.shield > 0) {                  // щит (прокачка) принимает удар первым
            const a = Math.min(p.shield, dmg);
            p.shield -= a; dmg -= a;
            this.abilityFx('shield', new BABYLON.Vector3(p.x, this.groundH(p.x, p.y) + 120, p.y));
        }
        p.hp = Math.max(0, p.hp - dmg);
        p.inv = 0.35;
        p.kx += dir.x * c.knock * 0.7; p.ky += dir.y * c.knock * 0.7;
        p.ch.flash();
        const hp = new BABYLON.Vector3(p.x, this.groundH(p.x, p.y) + 120, p.y);
        GamePaint.spray(hp, new BABYLON.Vector3(dir.x, 0.4, dir.y), p.ch.paint, 12, 460, null, 0.6);
        if (this.app && this.app.camera) this.app.camera.shake(160, 0.012);
        if (typeof Game !== 'undefined') Game.sfx('assets/sounds/hit_player.ogg', { volume: 0.7 });
        // видимый урон: левая рука по частям
        const ratio = p.hp / p.maxHp;
        if (ratio < 0.55 && p.ch.limbs.armL === 'full') p.ch.cut('armL', false, dir);
        else if (ratio < 0.25 && p.ch.limbs.armL === 'upper') p.ch.cut('armL', true, dir);
        if (this.hooks.onPlayerHit) this.hooks.onPlayerHit(p, by);
        if (p.hp <= 0) this.killPlayer(dir);
    },

    killPlayer(dir) {
        const p = this.player;
        if (!p || !p.alive) return;
        p.alive = false;
        p.atk = null;
        if (p.bar && p.bar.parentNode) p.bar.parentNode.removeChild(p.bar);   // полоска погибшего не остаётся висеть
        p.bar = null;
        this.stick.x = 0; this.stick.y = 0;
        p.ch.explode(dir);
        this.running = false;
        this.finished = true;
        if (typeof Game !== 'undefined') Game.sfx('assets/sounds/splat_2.ogg', { volume: 0.9, rate: 0.85 });
        this.after(1.3, () => { if (this.hooks.onLose) this.hooks.onLose(); });
    },

    // Воскрешение за рекламу: новый игрок на месте старого, враги отброшены.
    async revive() {
        const old = this.player;
        if (!old) return;
        const x = old.x, y = old.y, h = old.heading;
        if (old.bar && old.bar.parentNode) old.bar.parentNode.removeChild(old.bar);
        old.bar = null;
        this.player = await this._spawnPlayer(x, y, h);
        this.player.inv = 2;
        for (const e of this.enemies) {
            if (!e.alive) continue;
            const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy) || 1;
            e.kx += dx / d * 900; e.ky += dy / d * 900; e.stag = 0.8; e.atk = null; e.ch.trail(false);
        }
        GamePaint.spray(new BABYLON.Vector3(x, this.groundH(x, y) + 80, y), new BABYLON.Vector3(0, 1, 0), this.player.ch.paint, 30, 600, null, 1.3);
        this.finished = false;
        this.running = true;
    },

    // --- Полоски здоровья ----------------------------------------------------------------------

    _makeBar(f) {
        const layer = document.getElementById('pb-bars');
        if (!layer) return null;
        const el = document.createElement('div');
        el.className = 'pb-bar' + (f.team === 'player' ? ' me' : '') + (f.type === 'boss' ? ' boss' : '');
        el.innerHTML = '<i></i><b></b>';
        layer.appendChild(el);
        return el;
    },

    _bar(f) {
        const el = f.bar, v = this.app && this.app.location && this.app.location.view;
        if (!el || !v) return;
        const h = this.groundH(f.x, f.y) + 245 * f.scale;
        const s = v.projectToScreen(f.x, f.y, h);
        if (!s || !s.visible) { el.style.display = 'none'; return; }
        if (f.team === 'enemy') { f.hitShown -= 1 / 60; }
        el.style.display = '';
        el.style.transform = 'translate(' + Math.round(s.x) + 'px,' + Math.round(s.y) + 'px)';
        /** @type {HTMLElement} */ (el.firstElementChild).style.width = Math.max(0, f.hp / f.maxHp * 100) + '%';
        const sh = /** @type {HTMLElement} */ (el.lastElementChild);
        if (sh) sh.style.width = f.shieldMax > 0 ? Math.max(0, f.shield / f.shieldMax * 100) + '%' : '0';
    },

    showPlayerBar(on) {
        const p = this.player;
        if (!p) return;
        if (on && !p.bar) p.bar = this._makeBar(p);
        if (!on && p.bar) { p.bar.remove(); p.bar = null; }
    },
};
