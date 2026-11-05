// Game.js — ход игры Paint Blade: загрузка сохранения, меню, уровни (карта по кругу, 5 уровней в главе,
// на 5-м — босс и сундук), победа/поражение, награды, реклама (правило двух раундов, rewarded:
// пропуск уровня, x2 награда, воскрешение), туториал, магазин/подарок/колесо (GameShopUI), настройки.
// Бой — GameFighters.js, вид персонажа — GameCharacter.js, краска — GamePaint.js, интерфейс — GameUI.js.

/** @satisfies {Record<string, any>} */
const Game = {
    /** @type {LoryApp | null} */ app: null,
    /** @type {any} */ save: null,
    state: 'boot',              // boot | menu | play | result | shop
    busy: false,
    dirty: false,               // на текущей карте уже шёл бой (краска, куски) — перед новым раундом перезагрузить
    /** @type {any} */ lv: null,
    revived: false,
    winCoins: 0,
    x2Done: false,
    chestPending: false,
    tutorialSafe: false,
    _arenaKeys: /** @type {string[]} */ ([]),

    SFX: {
        coin: 'assets/sounds/coin.ogg', win: 'assets/sounds/win.ogg', lose: 'assets/sounds/lose.ogg', chest: 'assets/sounds/chest_open.ogg',
        reward: 'assets/sounds/reward.ogg',
    },
    MUSIC_MENU: 'assets/sounds/music_menu.ogg',
    MUSIC_BATTLE: 'assets/sounds/music_battle.ogg',
    FX: { confetti: ['assets/fx/confetti_01.webp', 'assets/fx/confetti_02.webp', 'assets/fx/confetti_03.webp'], star: 'assets/fx/star.webp', soft: 'assets/fx/soft.webp', spark: 'assets/fx/spark.webp', smoke: 'assets/fx/smoke.webp' },

    // --- Запуск ------------------------------------------------------------------------------

    async init(app) {
        this.app = app;
        document.title = Lang.t('title');
        if (typeof HudLayout !== 'undefined') HudLayout.init({ app });
        if (typeof Input !== 'undefined') Input.init({ app, mouse: 'none', touch: false });
        // Камера только следит за героем: ввод камеры (панорама средней кнопкой, колесо, щипок, клавиши) снят.
        if (app.camera) app.camera.detach();
        const cv = document.getElementById('world3d');
        if (cv) cv.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });   // без автопрокрутки
        GameUI.init();
        await this.loadSave();
        this.applySettings();
        const ui = this.shopUI();
        if (ui) ui.init({ save: this.save, persist: () => this.persist(), onLook: (cosm) => this.applyCosmetics(cosm) });
        this.refreshCoins();
        await GameCharacter.preload();
        Sound.preload(Object.values(GameFighters.KILL_SFX));   // звуки добивания — без задержки на первом убийстве
        // карта текущего уровня — под тем же экраном загрузки
        this.lv = GameData.level(this.save.level);
        if (this.lv.mapId && app.map && app.map.id !== this.lv.mapId) await this._loadMapDirect(this.lv.mapId);
        await this._prepareLevel(app);
        this._initTutorial();
        GameFighters.hooks = {
            onHit: () => { if (typeof Tutorial !== 'undefined' && Tutorial.active) Tutorial.complete('hit'); },
            onKill: (e, coins) => this.onKill(e, coins),
            onPlayerHit: (p, by) => {
                GameUI.hurt(by && by.ch ? BABYLON.Color3.FromArray(by.ch.paint).toHexString() : null);
                if (typeof Tutorial !== 'undefined' && Tutorial.active) Tutorial.complete('hp');
            },
            onWin: () => this.onWin(),
            onLose: () => this.onLose(),
            onSpawn: () => {},
        };
        window.addEventListener('keydown', (e) => {
            if (e.code !== 'Escape') return;   // Esc не глушим (preventDefault нельзя — Playables)
            if (GameUI.el['pb-settings'].classList.contains('show')) { GameUI.showSettings(false); return; }
            if (GameUI.el['pb-top-s'].classList.contains('show')) { GameUI.show('pb-top-s', false); return; }
            if (GameUI.el['pb-up'].classList.contains('show')) { this.closeUpgrades(); return; }
            const ui = this.shopUI();
            if (ui && ui.isOpen) { ui.close(); return; }
            if (this.state === 'play') this.pause(!Pause.has('manual'));
        });
        // Playables: общий собственный mute не рекомендован — звук ведут SDK и раздельные настройки.
        if (Platform.name === 'playables') GameUI.el['pb-sound'].style.display = 'none';
        Pause.onChange(() => { if (this.state === 'play') GameUI.show('pb-pause-s', Pause.has('manual')); });
        if (typeof Platform !== 'undefined') GameUI.setAdButtons(Platform.rewardedSupported());
        Platform.leaderboard().then(rows => { if (rows === null) GameUI.el['pb-m-top'].style.display = 'none'; }).catch(() => { GameUI.el['pb-m-top'].style.display = 'none'; });
        Platform.backHandler = () => this.back();
    },

    async ready() {
        this.toMenuNow();
        if (!this.save.notice) GameUI.show('pb-notice', true);   // первый запуск: «все — пиньяты и роботы, внутри краска»
    },

    // Окно «Только краска» закрыто: больше не показывать; «Играть», нажатое до этого, — продолжить.
    noticeOk() {
        this.save.notice = true;
        this.persist();
        GameUI.show('pb-notice', false);
        const f = this._afterNotice;
        this._afterNotice = null;
        if (f) f();
    },
    /** @type {(() => void) | null} */ _afterNotice: null,

    // Сохранение: ошибка загрузки — экран с повтором (облако не перезаписываем, пока не загрузилось).
    async loadSave() {
        for (;;) {
            try {
                const data = await Platform.load();
                this.save = this._normalize(data);
                return;
            } catch (e) {
                console.warn('Paint Blade: сохранение не загрузилось', e);
                LoadingScreen.hide();
                GameUI.show('pb-err', true);
                await new Promise(res => { this._retryLoad = res; });
                GameUI.show('pb-err', false);
            }
        }
    },
    /** @type {any} */ _retryLoad: null,
    retryLoad() { if (this._retryLoad) { const f = this._retryLoad; this._retryLoad = null; f(); } },

    _normalize(d) {
        const s = d && typeof d === 'object' ? d : {};
        s.v = 1;
        s.level = Math.max(1, Number(s.level) || 1);
        s.best = Math.max(Number(s.best) || 0, s.level - 1);
        s.tutorialDone = !!s.tutorialDone;
        s.notice = !!s.notice;   // окно «все персонажи — пиньяты и роботы» уже показано
        s.kills = Number(s.kills) || 0;
        s.seen = Array.isArray(s.seen) ? s.seen : [];   // особые враги, о которых уже была подсказка
        s.settings = Object.assign({ sfx: 1, music: 1, quality: 'auto', outline: 0 }, s.settings || {});
        s.upgrades = Object.assign({ dmg: 0, hp: 0, shield: 0, speed: 0, reach: 0, vamp: 0, spin: false, spinOn: true }, s.upgrades || {});
        return s;
    },

    persist() { if (this.save) Platform.save(this.save); },

    // Идентификатор шага для аналитики площадки — ограниченный словарь (уровни бесконечны).
    stepId(n) { return n <= 30 ? 'level_' + n : 'level_31_plus'; },

    // Магазин/подарок/колесо (js/GameShopUI.js) — если модуль подключён.
    /** @returns {any} */
    shopUI() { return typeof GameShopUI !== 'undefined' ? GameShopUI : null; },

    // Смена карты прямо под экраном первого запуска (LoadingScreen.run внутри загрузки не вкладывается).
    async _loadMapDirect(id) {
        const app = this.app, src = app.maps.find(m => m.id === id);
        if (!src) return;
        const ready = app.location.loadMap(Location3D.copyMap(src));
        app.camera.setTerrain(app.location.terrain, { w: app.location.width, h: app.location.height });
        app.camera.home();
        await ready;
    },

    // Подготовка уровня на загруженной карте: свет арены, краска, игрок (враги — по «Играть»).
    async _prepareLevel(app) {
        this.lv = GameData.level(this.save.level);
        this._applyArena(app.map ? app.map.id : '');
        GamePaint.reset(app.location.view, (x, z) => app.location.terrain.heightAt(x, z));
        this._lastCosm = this.cosm();   // с чем сравнивать примерку (что показать)
        await GameFighters.start(app, this.lv, this._lastCosm);
        const p = GameFighters.player;
        this.follow = { x: p.x, y: p.y, frameHeight: 560, frameWidth: 520 };
        app.camera.follow(this.follow);
        app.camera.home();
        GameUI.renderProgress(this.lv.n);
        this.dirty = false;
        this.revived = false;
        this.disposeChest();
    },

    _frameH() { return typeof PB_CAMERA_FRAME_H !== 'undefined' ? PB_CAMERA_FRAME_H : 980; },
    _frameW() { return typeof PB_CAMERA_FRAME_W !== 'undefined' ? PB_CAMERA_FRAME_W : 900; },

    _applyArena(id) {
        const a = typeof GAME_ARENAS !== 'undefined' ? GAME_ARENAS[id] : null;
        const reset = {};
        for (const k of this._arenaKeys) reset[k] = null;
        World3D.setLighting(reset, this.app.location.view);
        if (a && a.lighting) { World3D.setLighting(a.lighting, this.app.location.view); this._arenaKeys = Object.keys(a.lighting); }
        else this._arenaKeys = [];
    },

    // Экипировка игрока — объекты каталогов (GameShopUI.equipped()).
    cosm() {
        const ui = this.shopUI();
        const e = ui && ui.equipped ? ui.equipped() : null;
        const swords = typeof GAME_SWORDS !== 'undefined' ? GAME_SWORDS : [];
        return {
            skin: (e && e.skin) || GameData.SKINS[0],
            hat: (e && e.hat) || null,
            sword: (e && e.sword) || swords[0] || null,
            paint: (e && e.paint) || GameData.PAINTS[0],
            trail: (e && e.trail) || GameData.TRAILS[0],
            victory: (e && e.victory) || GameData.VICTORIES[0],
        };
    },

    applyCosmetics(cosm) {
        const c = Object.assign(this.cosm(), cosm || {});
        const was = this._lastCosm;
        this._lastCosm = c;
        GameFighters.refreshPlayer(c).then(() => { if (was && (this.state === 'shop' || this.state === 'menu')) this.demoCosmetic(was, c); });
    },
    /** @type {any} */ _lastCosm: null,

    // Примерка показывает, что даёт предмет: меч и след — взмах, краска — брызги и кляксы,
    // победа — танец и салют, скин и шапка — вспышка-блеск.
    demoCosmetic(was, c) {
        const p = GameFighters.player;
        if (!p || !p.alive) return;
        const id = (x) => (x ? x.id : '');
        const at = new BABYLON.Vector3(p.x, GameFighters.groundH(p.x, p.y) + 130, p.y);
        if (id(was.victory) !== id(c.victory)) {
            this.celebrate(c.victory);
            GameFighters.after(2.6, () => { /** @type {any} */ (p).dance = false; });
            return;
        }
        if (id(was.trail) !== id(c.trail)) { GameFighters.demoSwing(['slash_1', 'slash_2', 'slash_3']); return; }
        if (id(was.sword) !== id(c.sword)) {
            GameFighters.demoSwing(['slash_2']);
            if (c.sword) GameFighters.after(0.3, () => GameFighters.demoAbility(c.sword.id));
            return;
        }
        if (id(was.paint) !== id(c.paint)) {
            // брызги краски этой палитры вокруг героя — как у разрубленного врага
            const pal = c.paint, cols = pal.colors || ['#ffd400'];
            for (let i = 0; i < 6; i++) {
                const a = i / 6 * Math.PI * 2 + Math.random() * 0.5, d = 150 + Math.random() * 120;
                const col = GamePaint.rgb(cols[i % cols.length]);
                const q = new BABYLON.Vector3(p.x + Math.cos(a) * d, at.y, p.y + Math.sin(a) * d);
                GamePaint.spray(q, new BABYLON.Vector3(Math.cos(a), 0.9, Math.sin(a)), col, 10, 420, pal, 0.8, 2.2);
                GameFighters.after(0.05 * i, () => GamePaint.splat(q.x, q.z, 80 + Math.random() * 70, GamePaint.pick(pal, col), 0.25, 2.5));
            }
            if (pal.sparkle || pal.glow) GameFighters.impactFx(at, GamePaint.rgb(cols[0]));
            this.sfx('assets/sounds/splat_1.ogg', { volume: 0.6 });
            return;
        }
        if (id(was.skin) !== id(c.skin) || id(was.hat) !== id(c.hat)) {
            GameFighters.impactFx(new BABYLON.Vector3(p.x, at.y + 60, p.y), [1, 1, 1]);
            this.sfx('assets/sounds/reward.ogg', { volume: 0.35 });
        }
    },

    refreshCoins() { GameUI.setCoins(typeof Shop !== 'undefined' && Shop.state ? Shop.coins : (this.save ? this.save.coinsLocal || 0 : 0)); this._badges(); },

    // Валюта — Shop (единая с магазином); без Shop.init — запасной счётчик в сохранении.
    addCoins(n, opts) {
        if (typeof Shop !== 'undefined' && Shop.state) Shop.addCoins(n, opts);
        else if (this.save) this.save.coinsLocal = (this.save.coinsLocal || 0) + n;
    },

    _badges() {
        const ui = this.shopUI();
        const b = ui && ui.badges ? ui.badges() : null;
        GameUI.alert('pb-m-shop', b && b.shop);
        GameUI.alert('pb-m-daily', b && b.daily);
        GameUI.alert('pb-m-wheel', b && b.wheel);
        const up = this.save ? this.save.upgrades : null, c = this.coins();
        GameUI.alert('pb-m-up', !!up && ['dmg', 'hp', 'shield', 'speed', 'reach', 'vamp'].some(k => (up[k] | 0) < GameData.UPGRADE_MAX && c >= GameData.upgradePrice(k, up[k] | 0)));
    },

    // --- Кадр --------------------------------------------------------------------------------

    update(dt) {
        GameFighters.update(dt);
        const p = GameFighters.player;
        // наклон камеры — всегда стандартный (вращения нет): край земли поднимает его только пока нужно,
        // иначе после смены размера окна или далёкого зума камера оставалась почти сверху
        const cam = this.app && this.app.camera;
        if (cam && !cam.free) cam.pitch = cam._clampPitch(cam.c.pitch * Math.PI / 180);
        if (p && this.follow && !this.chest3d) { this.follow.x = p.x; this.follow.y = p.y; }
        // меню и магазин: герой развёрнут 3/4 к камере, меч поднят — видны и меч, и примерка
        GameFighters.showcase = (this.state === 'menu' || this.state === 'shop') && !!p && p.alive;
        if (this.state === 'shop' && p && p.alive) this._shopCam(p);
        else {
            if (this._shift) this._lensShift(0, 0);
            if (this.state === 'menu' && p && p.alive && !this.chest3d) this._menuCam(p);
        }
        if (GameFighters.showcase && !(/** @type {any} */ (p).dance)) p.heading += GameFighters._angDiff(p.heading, Math.PI / 2 - 0.55) * Math.min(1, dt * 6);
        this._updateChest(dt);
        if (this.state === 'play') {
            const left = GameFighters.enemies.filter(e => e.alive).length + GameFighters.queue.length + (GameFighters.bossQueued ? 1 : 0);
            if (left !== this._left) { this._left = left; GameUI.setEnemies(left); }
            if (this.tutorialSafe && !Tutorial.active) this.tutorialSafe = false;
        }
    },
    _left: -1,
    _combo: 0,
    _lastKill: 0,

    // --- Меню ----------------------------------------------------------------------------------

    // Камера: в меню и магазине — близко к герою, в бою — шире (видно врагов вокруг).
    camFrame(close) {
        if (!this.follow) return;
        this.follow.frameHeight = close ? 560 : this._frameH();
        this.follow.frameWidth = close ? 520 : this._frameW();
    },

    toMenuNow() {
        this.state = 'menu';
        this.camFrame(true);
        if (GameFighters.player && GameFighters.player.alive) GameFighters.player.heading = Math.PI / 2;   // лицом к камере
        Pause.set('manual', false);
        GameUI.setMode('menu');
        GameUI.renderProgress(this.save.level);
        GameFighters.running = false;
        GameFighters.showPlayerBar(false);
        Platform.gameplay(false);
        this.music(this.MUSIC_MENU);
        this.refreshCoins();
        const ui = this.shopUI();
        if (ui && typeof Tutorial !== 'undefined') Tutorial.whenIdle(() => { if (this.state === 'menu' && this.save.tutorialDone) ui.maybeOfferDaily(); });
    },

    // В меню из паузы или результата: карта перезагружается (чистая арена), interstitial по правилу двух раундов.
    toMenu(fromResult) {
        if (this.busy) return;
        const go = async () => {
            if (this.dirty || this.state === 'play') await this.reload();
            this.toMenuNow();
        };
        if (fromResult) Platform.ads.next(go); else go();
    },

    async reload(level) {
        if (level) this.save.level = level;
        const lv = GameData.level(this.save.level);
        this.busy = true;
        this.state = 'loading';
        GameFighters.running = false;
        try {
            Pause.set('manual', false);
            GameUI.setMode('menu');
            GameUI.show('pb-menu', false);
            await this.app.loadMap(lv.mapId || this.app.map.id, {
                label: Lang.t('level', { n: lv.n }),
                prepare: async (app) => { await this._prepareLevel(app); },
            });
        } finally { this.busy = false; }
    },

    async play() {
        if (this.busy || this.state === 'play') return;
        if (!this.save.notice) { this._afterNotice = () => this.play(); GameUI.show('pb-notice', true); return; }
        if (this.dirty) await this.reload();
        else if (GameFighters.player) { /** @type {any} */ (GameFighters.player).dance = false; GameFighters.player.atk = null; }
        this.begin();
    },

    // Раунд пошёл: враги, HUD, музыка, туториал при первом запуске.
    async begin() {
        this.state = 'play';
        this.camFrame(false);
        this.dirty = true;
        this.revived = false;
        this.winCoins = 0;
        this.x2Done = false;
        GameUI.setMode('play');
        GameUI.renderProgress(this.lv.n);
        GameUI.setSoundIcon(this.save.settings.sfx || this.save.settings.music);
        this._left = -1;
        const first = this.lv.n === 1 && !this.save.tutorialDone;
        this.tutorialSafe = first;
        GameFighters.tutorialSafe = first;
        GameFighters.showPlayerBar(true);
        const n = Math.min(GameFighters.cfg().maxAlive, GameFighters.queue.length, 3);
        await Promise.all(Array.from({ length: n }, () => GameFighters._spawnEnemy(GameFighters.queue.shift())));
        if (this.state !== 'play') return;
        GameFighters.running = true;
        Platform.gameplay(true);
        if (typeof Telemetry !== 'undefined') Telemetry.progress('started', this.stepId(this.lv.n), { step_index: this.lv.n });
        this.music(this.MUSIC_BATTLE);
        if (first && typeof Tutorial !== 'undefined') Tutorial.autoStart();
    },

    howTo() {
        if (typeof Tutorial === 'undefined') return;
        if (this.state === 'play') { this.pause(false); Tutorial.start({ replay: true }); return; }
        // из меню: начать уровень и показать обучение
        this.play().then(() => Tutorial.start({ replay: true }));
    },

    pause(on) {
        if (this.state !== 'play') return;
        Pause.set('manual', !!on);
        GameUI.show('pb-pause-s', !!on);
        if (!on) GameUI.showSettings(false);
    },

    back() {
        const ui = this.shopUI();
        if (ui && ui.isOpen) { ui.close(); return true; }
        if (this.state === 'play') { this.pause(!Pause.has('manual')); return true; }
        return false;
    },

    restartLevel() {
        if (this.busy) return;
        if (typeof Tutorial !== 'undefined' && Tutorial.active) Tutorial.finish('abort');
        this.reload().then(() => this.begin());
    },

    // --- Бой: события -------------------------------------------------------------------------

    onKill(e, coins) {
        if (e.type === 'boss') Platform.analytics('boss_defeated', { step_index: this.lv.n });
        this.winCoins += coins;
        const h = GameFighters.groundH(e.x, e.y) + 200 * e.scale;
        GameUI.floatText(e.x, e.y, h, '+' + coins);
        const v = this.app.location.view, sp = v.projectToScreen(e.x, e.y, h);
        if (sp && sp.visible) GameUI.flyCoins(sp.x, sp.y, Math.min(5, 1 + Math.round(coins / 3)));
        // комбо: убийства подряд быстрее 1.6 с
        const now = performance.now();
        this._combo = now - this._lastKill < 1600 ? this._combo + 1 : 1;
        this._lastKill = now;
        if (this._combo >= 2) GameUI.combo(this._combo);
        this.sfx(this.SFX.coin, { volume: 0.4 });
        this.save.kills++;
        if (typeof Tutorial !== 'undefined' && Tutorial.active) Tutorial.complete('kill');
    },

    onWin() {
        if (this.state !== 'play') return;
        this.state = 'result';
        // раунд под обучением не считается раундом рекламы; победил раньше, чем дочитал обучение, — оно засчитано
        const counted = typeof Tutorial === 'undefined' || Tutorial.roundCounts();
        if (typeof Tutorial !== 'undefined' && Tutorial.active) Tutorial.finish('done');
        const lv = this.lv;
        const C = typeof PB_COINS_WIN !== 'undefined' ? PB_COINS_WIN : 25;
        this.winCoins += C + lv.chapter * 5;
        if (counted) Platform.ads.roundEnded(true, this.stepId(lv.n));
        Platform.gameplay(false);
        if (typeof Telemetry !== 'undefined') Telemetry.progress('completed', this.stepId(lv.n), { step_index: lv.n });
        this.save.level = lv.n + 1;
        this.save.best = Math.max(this.save.best || 0, lv.n);
        this.addCoins(this.winCoins, { save: false });
        this.persist();
        this.submitScore();
        this.refreshCoins();
        this.music(null);
        this.sfx(this.SFX.win, { volume: 0.8 });
        this.celebrate();
        GameUI.drips(['#ff3d7f', '#ffd23f', '#2f9bff', '#2fd36b', '#9b4dff']);
        GameFighters.showPlayerBar(false);
        this.chestPending = !!lv.chest;
        GameFighters.after(1.4, () => {
            if (this.chestPending) this.showChest();
            else this.showWin();
        });
    },

    showWin() {
        GameUI.setMode('result');
        GameUI.countUp(/** @type {HTMLElement} */ (GameUI.el['pb-win-coins'].lastElementChild), this.winCoins, '+');
        const x2 = /** @type {HTMLButtonElement} */ (GameUI.el['pb-win-x2']);
        x2.disabled = false;
        x2.style.display = Platform.rewardedSupported() ? '' : 'none';
        GameUI.show('pb-win', true);
    },

    // 3D-сундук (Kenney Mini Dungeon, крышка — отдельная часть lid) у маркера chest или перед игроком.
    async spawnChest() {
        this.disposeChest();
        const model = await GameCharacter.loadAcc('assets/models/items/chest.glb');
        const view = this.app.location.view, p = GameFighters.player;
        if (!model || !p) return;
        // сбоку от игрока (не за ним — камера сзади-сверху), в пределах арены
        const side = GameFighters.clampArena(p.x + 230, p.y + 40, 120).x > p.x + 150 ? 1 : -1;
        const q = GameFighters.clampArena(p.x + side * 230, p.y + 40, 120);
        const x = q.x, y = q.y;
        const root = Model3D.build(model, view.scene, { name: 'chest' });
        root.scaling.setAll(3.2);
        root.position.set(x, GameFighters.groundH(x, y), y);
        World3D.addObject(view, root, 'actor');
        const lid = /** @type {BABYLON.Mesh | undefined} */ (root.getChildMeshes(false).find(c => c.metadata && c.metadata.part === 'lid'));
        if (lid && lid.metadata.pivot) lid.setPivotPoint(BABYLON.Vector3.FromArray(lid.metadata.pivot));
        this.chest3d = { root, lid, t: 0, open: false, x, y, drop: 260 };
        root.position.y += 260;
        p.heading = Math.atan2(y - p.y, x - p.x);
        if (this.follow) { this.follow.x = (p.x + x) / 2; this.follow.y = (p.y + y) / 2; }
    },
    /** @type {any} */ chest3d: null,

    disposeChest() {
        if (this.chest3d && !this.chest3d.root.isDisposed()) Model3D.dispose(this.app.location.view, this.chest3d.root);
        this.chest3d = null;
    },

    _updateChest(dt) {
        const c = this.chest3d;
        if (!c || c.root.isDisposed()) return;
        if (c.drop > 0) {   // падает с неба и подпрыгивает
            c.drop = Math.max(0, c.drop - dt * 900);
            c.root.position.y = GameFighters.groundH(c.x, c.y) + c.drop;
        }
        c.t += dt;
        if (!c.open) c.root.rotation.z = Math.sin(c.t * 9) * 0.05 * (c.drop > 0 ? 0 : 1);
        else if (c.lid) { c.root.rotation.z = 0; c.lid.rotation.x = -Math.min(1, c.ot / 0.35) * 1.9; c.ot += dt; }
    },

    showChest() {
        GameUI.setMode('result');
        this.spawnChest();
        GameUI.el['pb-chest-img'].classList.remove('open');
        GameUI.el['pb-chest-img'].style.display = 'none';   // сундук — 3D в сцене
        GameUI.el['pb-chest-txt'].textContent = Lang.t('chest.tap');
        GameUI.show('pb-chest', true);
    },

    openChest() {
        if (!this.chestPending) return;
        this.chestPending = false;
        const n = (typeof PB_CHEST_COINS !== 'undefined' ? PB_CHEST_COINS : 120) + this.lv.chapter * 20;
        this.addCoins(n, { save: false });
        this.persist();
        this.refreshCoins();
        GameUI.el['pb-chest-img'].classList.add('open');
        if (this.chest3d) {
            const c = this.chest3d;
            c.open = true; c.ot = 0;
            const at = new BABYLON.Vector3(c.x, GameFighters.groundH(c.x, c.y) + 120, c.y);
            if (this.app.fx) this.app.fx.create({ position: at, texture: this.FX.soft, burst: 40, life: [0.8, 1.5], size: [14, 26], speed: [300, 650],
                direction: [[-0.6, 1, -0.6], [0.6, 2, 0.6]], gravity: [0, -1200, 0], color: '#ffd23f', color2: '#ffb000', blend: 'standard' });
        }
        GameUI.el['pb-chest-txt'].textContent = Lang.t('chest.got', { n });
        this.sfx(this.SFX.chest, { volume: 0.8 });
        this.sfx(this.SFX.reward, { volume: 0.6 });
        GameFighters.after(1.5, () => { GameUI.show('pb-chest', false); this.showWin(); });
    },

    async winX2() {
        if (this.x2Done || this.busy) return;
        const b = /** @type {HTMLButtonElement} */ (GameUI.el['pb-win-x2']);
        b.disabled = true;
        const ok = await Platform.rewarded('win-x2');
        if (ok && !this.x2Done) {
            this.x2Done = true;
            this.addCoins(this.winCoins, { save: false });
            this.persist();
            this.refreshCoins();
            GameUI.el['pb-win-coins'].lastElementChild.textContent = '+' + this.winCoins * 2;
            this.sfx(this.SFX.reward, { volume: 0.7 });
            b.style.display = 'none';
        } else {
            b.disabled = false;
            if (!ok) GameUI.toast(Lang.t('ad.none'));
        }
    },

    nextLevel() {
        if (this.busy) return;
        GameUI.show('pb-win', false);
        Platform.ads.next(async () => { await this.reload(); this.begin(); });
    },

    onLose() {
        if (this.state !== 'play') return;
        this.state = 'result';
        if (Tutorial.roundCounts()) Platform.ads.roundEnded(false, this.stepId(this.lv.n));
        Platform.gameplay(false);
        if (typeof Telemetry !== 'undefined') Telemetry.progress('failed', this.stepId(this.lv.n), { step_index: this.lv.n });
        if (this.winCoins > 0) this.addCoins(this.winCoins, { save: false });
        this.persist();
        this.refreshCoins();
        this.submitScore();
        this.music(null);
        this.sfx(this.SFX.lose, { volume: 0.8 });
        GameUI.setMode('result');
        const rv = /** @type {HTMLButtonElement} */ (GameUI.el['pb-lose-revive']);
        // «Ожить за рекламу» — один раз за попытку. Playgama запрещает предлагать «+1 жизнь» после каждой смерти,
        // поэтому там — только когда уровень пройден хотя бы наполовину.
        const F = GameFighters, half = F.total > 0 && F.killed / F.total >= 0.5;
        const allowed = Platform.name !== 'playgama' || half;
        rv.style.display = !this.revived && allowed && Platform.rewardedSupported() ? '' : 'none';
        rv.disabled = false;
        GameUI.show('pb-lose', true);
    },

    async revive() {
        if (this.revived || this.busy) return;
        const b = /** @type {HTMLButtonElement} */ (GameUI.el['pb-lose-revive']);
        b.disabled = true;
        this.busy = true;
        let ok = false;
        try { ok = await Platform.rewarded('revive'); } finally { this.busy = false; }
        if (!ok) { b.disabled = false; GameUI.toast(Lang.t('ad.none')); return; }
        this.revived = true;
        this.winCoins = 0;   // монеты раунда уже начислены при поражении
        GameUI.show('pb-lose', false);
        this.state = 'play';
        GameUI.setMode('play');
        await GameFighters.revive();
        GameFighters.showPlayerBar(true);
        Platform.gameplay(true);
        this.music(this.MUSIC_BATTLE);
    },

    retry() {
        if (this.busy) return;
        GameUI.show('pb-lose', false);
        Platform.ads.next(async () => { await this.reload(); this.begin(); });
    },

    async skipLevel() {
        if (this.busy || this.state !== 'play') return;
        this.busy = true;
        let ok = false;
        try { ok = await Platform.rewarded('skip-level'); } finally { this.busy = false; }
        if (!ok) { GameUI.toast(Lang.t('ad.none')); return; }
        if (typeof Tutorial !== 'undefined' && Tutorial.active) Tutorial.finish('abort');
        GameFighters.running = false;
        this.save.level = this.lv.n + 1;
        this.save.best = Math.max(this.save.best || 0, this.lv.n);
        this.persist();
        await this.reload();
        this.begin();
    },

    // --- Салют победы ----------------------------------------------------------------------------

    celebrate(def) {
        const p = GameFighters.player, fx = this.app.fx;
        const v = def || this.cosm().victory;
        if (p && p.alive) { /** @type {any} */ (p).dance = true; p.ch.trail(false); p.ch.rig.stop('upper', 0.1); p.ch.play(v.dance || 'dance_1', { fade: 0.2 }); }
        if (!fx || !p) return;
        const h = GameFighters.groundH(p.x, p.y);
        const at = new BABYLON.Vector3(p.x, h + 380, p.y);
        const cols = v.colors || ['#ff3d7f', '#ffd23f', '#2f9bff', '#2fd36b', '#9b4dff', '#ff8a1f'];
        const layer = (opts) => fx.create(Object.assign({ position: at, blend: 'standard' }, opts));
        const kind = v.fx || 'confetti';
        cols.forEach((c, i) => {
            const base = { color: c, color2: cols[(i + 1) % cols.length], delay: i * 0.05 };
            if (kind === 'confetti' || kind === 'paintRain') {
                layer(Object.assign(base, { texture: kind === 'paintRain' ? 'assets/fx/drop_01.webp' : this.FX.confetti[i % 3], burst: 36, life: [1.4, 2.6], size: kind === 'paintRain' ? [10, 22] : [12, 22],
                    speed: [260, 620], direction: [[-1, 0.6, -1], [1, 1.4, 1]], gravity: [0, -700, 0], spin: [-6, 6], box: [[-260, 0, -260], [260, 60, 260]] }));
            } else if (kind === 'stars' || kind === 'sparkles') {
                layer(Object.assign(base, { texture: kind === 'stars' ? this.FX.star : this.FX.spark, burst: 26, life: [0.9, 1.8], size: [14, 30], speed: [120, 420],
                    direction: [[-1, 0.4, -1], [1, 1.5, 1]], gravity: [0, -260, 0], blend: 'additive', spin: [-4, 4] }));
            } else if (kind === 'fireworks') {
                layer(Object.assign(base, { texture: this.FX.spark, burst: 50, life: [0.8, 1.5], size: [10, 20], speed: [380, 520], direction: [[-1, -1, -1], [1, 1, 1]],
                    gravity: [0, -200, 0], blend: 'additive', delay: i * 0.25, position: at.add(new BABYLON.Vector3((Math.random() - 0.5) * 500, 120 + Math.random() * 200, (Math.random() - 0.5) * 300)) }));
            } else if (kind === 'coins') {
                layer(Object.assign(base, { texture: this.FX.soft, burst: 24, life: [1.2, 2], size: [16, 26], speed: [200, 500], color: '#ffd23f', color2: '#ffb000',
                    direction: [[-1, 1, -1], [1, 2, 1]], gravity: [0, -900, 0] }));
            } else if (kind === 'hearts' || kind === 'bubbles') {
                layer(Object.assign(base, { texture: this.FX.soft, burst: 22, life: [1.6, 2.6], size: [18, 40], speed: [60, 160], direction: [[-0.4, 1, -0.4], [0.4, 1.6, 0.4]],
                    gravity: [0, 120, 0], box: [[-300, -300, -300], [300, -200, 300]], color: kind === 'hearts' ? '#ff4f8b' : c }));
            }
        });
        if (kind === 'paintRain') {
            for (let i = 0; i < 18; i++) {
                const a = Math.random() * Math.PI * 2, d = 100 + Math.random() * 420;
                const life = this.state === 'shop' || this.state === 'menu' ? 2.8 : 0;   // примерка — краска исчезает
                GameFighters.after(0.3 + i * 0.06, () => GamePaint.splat(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 60 + Math.random() * 90, GamePaint.rgb(cols[i % cols.length]), 0.2, life));
            }
        }
    },

    // --- Звук и настройки -------------------------------------------------------------------------

    sfx(url, opts) { if (this.save && this.save.settings.sfx) Sound.play(url, opts); },

    music(url) {
        this._musicWant = url;
        if (url && this.save && this.save.settings.music) Sound.music(url, { volume: 0.55 });
        else Sound.stopMusic();
    },
    /** @type {string | null} */ _musicWant: null,

    settings() { return this.save ? this.save.settings : { sfx: 1, music: 1, quality: 'auto', outline: 0 }; },

    setSetting(k, v) {
        this.save.settings[k] = v;
        this.applySettings();
        this.persist();
    },

    applySettings() {
        const s = this.save.settings;
        Sound.setMuted(!s.sfx && !s.music);
        if (this._musicWant !== null) this.music(this._musicWant);
        if (typeof Quality !== 'undefined' && Quality.choice !== s.quality) Quality.set(s.quality);
        this.applyOutline();
        GameUI.setSoundIcon(s.sfx || s.music);
    },

    // Обводка силуэта и контур рёбер: по умолчанию выключены, включаются в настройках. Уровень графики
    // (Quality) пишет те же ключи — после его смены настройка игрока накладывается снова.
    applyOutline() {
        const on = !!(this.save && this.save.settings.outline);
        if (on && typeof Quality !== 'undefined') Quality.apply();
        else if (!on) World3D.setOutlines(false);
        if (!this._outlineSub && typeof Quality !== 'undefined') this._outlineSub = Quality.onChange(() => this.applyOutline());
    },
    /** @type {any} */ _outlineSub: null,

    toggleSound() {
        const s = this.save.settings, on = !(s.sfx || s.music);
        s.sfx = on ? 1 : 0; s.music = on ? 1 : 0;
        this.applySettings();
        this.persist();
    },

    // --- Прокачка (урон, здоровье, щит, скорость, дальность; легендарный «Вихрь») ------------------

    upgrades() { return this.save ? this.save.upgrades : {}; },
    coins() { return typeof Shop !== 'undefined' ? Shop.coins : 0; },

    openUpgrades() {
        if (this.state !== 'menu') return;
        GameUI.renderUpgrades();
        const list = GameUI.el['pb-up-list'];
        list.classList.add('enter');
        setTimeout(() => list.classList.remove('enter'), 900);   // каскад — только при открытии, не при каждой покупке
        GameUI.show('pb-up', true);
        requestAnimationFrame(() => GameUI.upScrollHint());
        setTimeout(() => GameUI.upScrollHint(), 450);
    },

    closeUpgrades() { GameUI.show('pb-up', false); this._badges(); },

    buyUpgrade(key) {
        const up = this.save.upgrades;
        const price = key === 'spin' ? (up.spin ? 0 : GameData.SPIN_PRICE) : ((up[key] | 0) >= GameData.UPGRADE_MAX ? 0 : GameData.upgradePrice(key, up[key] | 0));
        if (!price) return;
        if (!Shop.spend(price, { save: false, reason: 'upgrade' })) { GameUI.toast(Lang.t('up.nocoins')); return; }
        if (key === 'spin') { up.spin = true; up.spinOn = true; } else up[key] = (up[key] | 0) + 1;
        this.persist();
        this.refreshCoins();
        GameFighters.applyPlayerStats(null, true);
        GameUI.renderUpgrades();
        GameUI.upScrollHint();
        GameUI.flashUpgrade(key);
        this.sfx(this.SFX.reward, { volume: 0.6 });
        const p = GameFighters.player;
        if (p && p.alive) {
            GameFighters.impactFx(new BABYLON.Vector3(p.x, GameFighters.groundH(p.x, p.y) + 160, p.y), [1, 0.85, 0.2]);
            if (key === 'spin') GameFighters.demoSwing(['spin']);
        }
        Platform.analytics('upgrade_bought', { upgrade: key });
    },

    // Уровень прокачки за рекламу (когда не хватает монет): засчитывается только по подтверждению SDK.
    async upgradeByAd(key, btn) {
        const up = this.save.upgrades;
        if (this._adBusy || !GameData.UPGRADES[key] || (up[key] | 0) >= GameData.UPGRADE_MAX) return;
        this._adBusy = true;
        if (btn) btn.disabled = true;
        let ok = false;
        try { ok = await Platform.rewarded('upgrade'); } finally { this._adBusy = false; }
        if (!ok) { if (btn) btn.disabled = false; GameUI.toast(Lang.t('ad.none')); return; }
        up[key] = (up[key] | 0) + 1;
        this.persist();
        GameFighters.applyPlayerStats(null, true);
        GameUI.renderUpgrades();
        GameUI.flashUpgrade(key);
        this.sfx(this.SFX.reward, { volume: 0.6 });
        Platform.analytics('upgrade_bought', { upgrade: key, ad: true });
    },
    _adBusy: false,

    toggleSpin() {
        const up = this.save.upgrades;
        if (!up.spin) return;
        up.spinOn = up.spinOn === false;
        this.persist();
        GameFighters.applyPlayerStats(null, true);
        GameUI.renderUpgrades();
    },

    // --- Рекорды (лидерборд Score площадки) -------------------------------------------------------

    async openTop() {
        if (this.state !== 'menu') return;
        GameUI.renderTop(null, false);
        GameUI.show('pb-top-s', true);
        let rows = null;
        try { rows = await Platform.leaderboard({ avatarSize: 'medium' }); } catch (e) { rows = null; }
        GameUI.renderTop(rows, Platform.canLogin());
    },

    async login() {
        const ok = await Platform.login();
        if (ok) {
            try { const data = await Platform.load(); if (data) { this.save = this._normalize(data); } } catch (e) { /* остаётся текущее */ }
            this.openTop();
        }
    },

    // Результат раунда — в лидерборд после каждого раунда (и победы, и поражения).
    submitScore() { Platform.submitScore(this.save.kills || 0); },

    // --- Магазин -------------------------------------------------------------------------------

    openShop(kind) {
        const ui = this.shopUI();
        if (this.state !== 'menu' || this.busy || !ui) return;
        ui.open(kind);
    },

    onShopOpen(kind) {
        this.state = 'shop';
        GameUI.setMode('shop');
    },

    // Примерочная: камера ближе, герой — в центре части экрана, свободной от окна магазина
    // (слева от панели в альбоме, над панелью в портрете).
    _shopCam(p) {
        const cam = this.app.camera, ui = this.shopUI();
        if (!cam || !this.follow) return;
        const W = ViewCap.width(), H = window.innerHeight || 600;          // px поля игры (ViewCap.js)
        let fx = W / 2, fy = H / 2, fw = W, fh = H;
        // свободная от окна магазина зона (GameShopUI.layout: слева от панели в альбоме, над ней в портрете)
        const lay = ui && ui.isOpen && ui.kind === 'shop' && ui.layout ? ui.layout() : null;
        if (lay && lay.free && lay.free.w > 40 && lay.free.h > 40) {
            fw = lay.free.w; fh = lay.free.h; fx = lay.free.x + fw / 2; fy = lay.free.y + fh / 2;
        }
        const kWant = 250 / (0.42 * Math.min(fh, fw * 1.3));            // герой с шапкой ≈ 42% свободной зоны
        cam.zoomTarget = Math.max(0.3, Math.min(2, 1 / kWant));
        this.follow.frameHeight = 0; this.follow.frameWidth = 0;
        // камера смотрит прямо на середину фигуры, а в свободную зону картинку переносит сдвиг
        // объектива: без него герой у края кадра заваливался набок перспективой
        const s = Math.sin(cam.pitch) || 0.8, cpt = Math.cos(cam.pitch) || 0.6;
        this.follow.x = p.x;
        this.follow.y = p.y - 105 * cpt / s;
        this._lensShift(2 * (fx - W / 2) / W, -2 * (fy - H / 2) / H);
    },

    // Сдвиг объектива (доли половины кадра, как NDC): 0, 0 — обычная проекция камеры.
    _lensShift(dx, dy) {
        const c = this.app.camera && this.app.camera.cam;
        if (!c) return;
        c.unfreezeProjectionMatrix();
        this._shift = !!(dx || dy);
        if (!this._shift) return;
        const m = Array.from(c.getProjectionMatrix(true).m);
        const w = m[11] < 0 ? -1 : 1;                                     // правая/левая система координат
        m[8] += dx * w; m[9] += dy * w;
        c.freezeProjectionMatrix(BABYLON.Matrix.FromArray(m));
    },
    _shift: false,

    // Меню: герой — между логотипом и кнопкой «Играть» (не под надписями) на любом соотношении сторон.
    // Размеры блоков — offsetTop/offsetHeight (без transform: логотип покачивается анимацией).
    _menuCam(p) {
        const cam = this.app.camera, el = GameUI.el;
        if (!cam || !this.follow || !el || !el['pb-logo'] || !el['pb-menu-bottom']) return;
        const H = window.innerHeight || 600, logo = el['pb-logo'], left = el['pb-menu-left'];
        const top = logo.offsetTop + logo.offsetHeight + 6;
        let bot = el['pb-menu-bottom'].offsetTop - 6;
        if (left && getComputedStyle(left).position === 'static') bot = Math.min(bot, left.offsetTop - 6);
        const zone = bot - top;
        if (zone < 60 || top <= 6) return;
        this.follow.frameHeight = Math.min(980, Math.max(560, 300 * H / zone));   // герой с мечом и шапкой (≈260 px мира) — в зоне
        this.follow.frameWidth = 520;
        const k = cam.worldPerScreenPx();
        const s = Math.sin(cam.pitch) || 0.8, cpt = Math.cos(cam.pitch) || 0.6;
        const feetY = (top + bot) / 2 + 105 * cpt / k;
        this.follow.x = p.x;
        this.follow.y = p.y + (H / 2 - feetY) * k / s;
    },

    // Зум камеры по умолчанию (как у CameraController.home), плавно.
    _camZoomDefault() {
        const cam = this.app.camera;
        if (!cam) return;
        const small = IS_MOBILE && Math.max(window.innerWidth || 0, window.innerHeight || 0) < 1024;
        cam.zoomTarget = small ? cam.c.zoomMobile : cam.c.zoom;
    },

    onShopClose() {
        this._camZoomDefault();
        this.applyCosmetics(this.cosm());
        this.toMenuNow();
    },

    // --- Туториал --------------------------------------------------------------------------------

    _initTutorial() {
        if (typeof Tutorial === 'undefined') return;
        const nearest = () => {
            const p = GameFighters.player;
            let best = null, bd = Infinity;
            for (const e of GameFighters.enemies) {
                if (!e.alive || !p) continue;
                const d = Math.hypot(e.x - p.x, e.y - p.y);
                if (d < bd) { bd = d; best = e; }
            }
            return best ? { x: best.x, y: best.y, h: GameFighters.groundH(best.x, best.y) + 230 * best.scale } : null;
        };
        let moved = 0, lastX = 0, lastY = 0;
        Tutorial.init({
            app: this.app,
            steps: [
                { id: 'move', title: 'tut.pb.move.t', hint: { keyboard: 'tut.pb.move.mouse', touch: 'tut.pb.move.touch', pad: 'tut.move.pad' },
                    keys: { keyboard: ['forward', 'left', 'back', 'right'] },
                    onEnter: () => { const p = GameFighters.player; moved = 0; if (p) { lastX = p.x; lastY = p.y; } },
                    check: () => { const p = GameFighters.player; if (!p) return 0; moved += Math.hypot(p.x - lastX, p.y - lastY); lastX = p.x; lastY = p.y; return Math.min(1, moved / 320); } },
                { id: 'hit', title: 'tut.pb.attack.t', hint: 'tut.pb.attack.hint', event: 'hit', world: nearest },
                { id: 'kill', title: 'tut.pb.kill.t', hint: 'tut.pb.kill.hint', event: 'kill', world: nearest },
                { id: 'hp', title: 'tut.pb.hp.t', hint: 'tut.pb.hp.hint', check: (ctx) => Math.min(1, ctx.time / 3.5),
                    world: () => { const p = GameFighters.player; return p ? { x: p.x, y: p.y, h: GameFighters.groundH(p.x, p.y) + 250 } : null; } },
            ],
            state: () => this.save, field: 'tutorialDone',
            persist: () => this.persist(),
            onFinish: (reason) => {
                this.tutorialSafe = false; GameFighters.tutorialSafe = false;
                Platform.analytics('tutorial_finished', { reason: String(reason || 'done') });
            },
        });
    },
};
