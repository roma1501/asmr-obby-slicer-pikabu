// GameCharacter.js — вид блочного персонажа R6: риг (Rig.js, assets/models/hero.glb + клипы), цвета частей,
// нарисованное лицо, меч / шапка / детали скина, след клинка и РАСЧЛЕНЕНИЕ: часть отрывается от рига,
// летит куском (простая физика), на срезах — крышки цвета краски, из обрубков бьёт струя краски.
// Логика боя (здоровье, кто кого ударил) — GameFighters.js; здесь только вид.
// Контракт модели (имена частей, кости, клипы) — docs/DESIGN.md §1 и docs/CHARACTER-RIG.md.

/** @typedef {{ mesh: BABYLON.Mesh, vel: BABYLON.Vector3, ang: BABYLON.Vector3, rest: boolean, t: number, owner: any, leak: number, color: number[], pal: any, restT?: number, s0?: BABYLON.Vector3 }} PbPiece */

/** @satisfies {Record<string, any>} */
const GameCharacter = {
    HERO: 'assets/models/hero.glb',
    CLIPS: 'assets/models/hero_clips.glb',
    SWORD: 'assets/models/sword_basic.glb',
    /** @type {any} */ model: null,
    /** @type {any} */ clips: null,
    /** @type {Map<string, Promise<any>>} */ _acc: new Map(),
    /** @type {Map<string, BABYLON.StandardMaterial>} */ _mats: new Map(),
    /** @type {Map<string, BABYLON.DynamicTexture>} */ _faces: new Map(),
    /** @type {PbPiece[]} */ pieces: [],
    /** @type {any} */ _ready: null,

    // Момент удара (доля длины клипа) — уточняется по docs/CHARACTER-RIG.md.
    IMPACT: { slash_1: 0.474, slash_2: 0.469, slash_3: 0.559, spin: 0.388 },   // docs/CHARACTER-RIG.md
    RUN_PX: 445,   // px/с, при которых ноги клипа run не скользят (speed клипа = скорость / RUN_PX)

    PARTS: ['Head', 'Face', 'Torso_Upper', 'Torso_Lower', 'Arm_L_Upper', 'Arm_L_Lower', 'Arm_R_Upper', 'Arm_R_Lower',
        'Leg_L_Upper', 'Leg_L_Lower', 'Leg_R_Upper', 'Leg_R_Lower'],
    // Конечности: верх, низ, к чему крепится (крышка на обрубке), ось/знак грани крепления на якоре.
    LIMBS: {
        armL: { upper: 'Arm_L_Upper', lower: 'Arm_L_Lower', anchor: 'Torso_Upper', side: 'z', arm: true },
        armR: { upper: 'Arm_R_Upper', lower: 'Arm_R_Lower', anchor: 'Torso_Upper', side: 'z', arm: true, sword: true },
        legL: { upper: 'Leg_L_Upper', lower: 'Leg_L_Lower', anchor: 'Torso_Lower', side: 'y' },
        legR: { upper: 'Leg_R_Upper', lower: 'Leg_R_Lower', anchor: 'Torso_Lower', side: 'y' },
    },

    // Модели персонажа и клипов — один раз, под экраном загрузки.
    preload() {
        if (!this._ready) {
            this._ready = (async () => {
                const [model, clips] = await Promise.all([Rig.load(this.HERO), Rig.load(this.CLIPS).catch(e => { console.warn('Paint Blade: нет клипов', e); return null; })]);
                this.model = model;
                this.clips = clips;
            })();
        }
        return this._ready;
    },

    // Модель аксессуара (меч, шапка, деталь) по пути — с кэшем; ошибка — null (персонаж без предмета).
    loadAcc(url) {
        if (!url) return Promise.resolve(null);
        let p = this._acc.get(url);
        if (!p) {
            p = Model3D.load(url).catch(e => { console.warn('Paint Blade: не загрузилась модель ' + url, e); return null; });
            this._acc.set(url, p);
        }
        return p;
    },

    // Материал тела цвета hex (общий на сцену: одинаковые цвета делят материал).
    bodyMat(scene, hex, glow) {
        const key = scene.uid + '|b|' + hex + '|' + (glow || '');
        let m = this._mats.get(key);
        if (!m || m.getScene() !== scene) {
            m = new BABYLON.StandardMaterial('pbBody' + hex, scene);
            m.diffuseColor = BABYLON.Color3.FromHexString(hex);
            m.specularColor = new BABYLON.Color3(0.18, 0.18, 0.18);
            m.specularPower = 28;
            if (glow) m.emissiveColor = BABYLON.Color3.FromHexString(glow).scale(0.28);
            m.metadata = { toonGroup: 'actor' };
            this._mats.set(key, m);
        }
        return m;
    },

    // Материал среза — краска: ярче тела, с подсветкой (видна и в тени).
    capMat(scene, rgb) {
        const hex = BABYLON.Color3.FromArray(rgb).toHexString();
        const key = scene.uid + '|c|' + hex;
        let m = this._mats.get(key);
        if (!m || m.getScene() !== scene) {
            m = new BABYLON.StandardMaterial('pbCap' + hex, scene);
            const c = BABYLON.Color3.FromArray(rgb);
            m.diffuseColor = c;
            m.emissiveColor = c.scale(0.45);
            m.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
            m.specularPower = 40;
            m.metadata = { toonGroup: 'actor' };
            this._mats.set(key, m);
        }
        return m;
    },

    // Картинки лиц (256×256, прозрачный фон). Пока лежит заглушка 1×1 — лицо рисуется на canvas (drawFace).
    FACE_FILES: {
        smile: 'assets/ui/faces/smile.webp', grin: 'assets/ui/faces/grin.webp', cool: 'assets/ui/faces/cool.webp',
        happy: 'assets/ui/faces/happy.webp', wink: 'assets/ui/faces/wink.webp', cute: 'assets/ui/faces/cute.webp',
        surprised: 'assets/ui/faces/surprised.webp', robot: 'assets/ui/faces/robot.webp', ninja: 'assets/ui/faces/ninja.webp',
        zombie: 'assets/ui/faces/zombie.webp', angry: 'assets/ui/faces/angry.webp', mad: 'assets/ui/faces/mad.webp',
        evil: 'assets/ui/faces/evil.webp', king: 'assets/ui/faces/king.webp',
    },

    // Лицо — прозрачная текстура на пластине Face: файл из FACE_FILES или рисунок на canvas.
    faceMat(scene, style) {
        const key = scene.uid + '|f|' + style;
        let m = this._mats.get(key);
        if (m && m.getScene() === scene) return m;
        const t = new BABYLON.DynamicTexture('pbFace' + style, { width: 256, height: 256 }, scene, true);
        this.drawFace(/** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ (t.getContext())), style);
        t.hasAlpha = true;
        t.update();
        m = new BABYLON.StandardMaterial('pbFaceMat' + style, scene);
        m.diffuseTexture = t;
        m.specularColor = new BABYLON.Color3(0, 0, 0);
        m.emissiveColor = new BABYLON.Color3(0.12, 0.12, 0.12);
        m.alphaCutOff = 0.4;
        m.metadata = { toonGroup: 'actor' };
        this._mats.set(key, m);
        const url = this.FACE_FILES[style];
        if (url) {
            const img = new Image();
            img.onload = () => {
                if (img.naturalWidth < 64 || m.getScene() !== scene) return;   // заглушка — остаётся canvas
                const tex = new BABYLON.Texture(url, scene, { invertY: true, samplingMode: BABYLON.Texture.TRILINEAR_SAMPLINGMODE });
                tex.hasAlpha = true;
                m.diffuseTexture = tex;
            };
            img.src = url;
        }
        return m;
    },

    drawFace(g, style) {
        g.clearRect(0, 0, 256, 256);
        const ink = '#16161c';
        g.fillStyle = ink; g.strokeStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round';
        const eye = (x, y, w, h) => { g.beginPath(); g.ellipse(x, y, w, h, 0, 0, Math.PI * 2); g.fill(); };
        const shine = (x, y, r) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.fillStyle = ink; };
        const brow = (x1, y1, x2, y2) => { g.lineWidth = 12; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
        const smile = (w, y, depth, lw) => { g.lineWidth = lw || 12; g.beginPath(); g.moveTo(128 - w, y); g.quadraticCurveTo(128, y + depth, 128 + w, y); g.stroke(); };
        switch (style) {
            case 'grin':
                eye(92, 100, 13, 22); eye(164, 100, 13, 22);
                g.beginPath(); g.moveTo(74, 150); g.quadraticCurveTo(128, 215, 182, 150); g.closePath(); g.fill();
                g.fillStyle = '#fff'; g.fillRect(92, 152, 72, 14); g.fillStyle = ink; break;
            case 'cool':
                g.beginPath(); g.moveTo(52, 82); g.lineTo(204, 82); g.lineTo(196, 112); g.quadraticCurveTo(160, 132, 138, 104);
                g.lineTo(118, 104); g.quadraticCurveTo(96, 132, 60, 112); g.closePath(); g.fill();
                g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(70, 88, 22, 6); g.fillRect(150, 88, 22, 6); g.fillStyle = ink;
                smile(36, 164, 26, 11); break;
            case 'happy':
                g.lineWidth = 12; g.beginPath(); g.arc(92, 108, 18, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
                g.beginPath(); g.arc(164, 108, 18, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
                g.beginPath(); g.moveTo(80, 148); g.quadraticCurveTo(128, 206, 176, 148); g.closePath(); g.fill(); break;
            case 'wink':
                eye(92, 100, 13, 22); shine(96, 92, 5);
                g.lineWidth = 12; g.beginPath(); g.moveTo(148, 104); g.lineTo(182, 98); g.stroke();
                smile(44, 156, 40); break;
            case 'cute':
                eye(90, 104, 18, 24); eye(166, 104, 18, 24); shine(96, 94, 7); shine(172, 94, 7);
                g.fillStyle = 'rgba(255,110,140,0.55)'; g.beginPath(); g.ellipse(64, 146, 18, 10, 0, 0, 7); g.fill();
                g.beginPath(); g.ellipse(192, 146, 18, 10, 0, 0, 7); g.fill(); g.fillStyle = ink;
                smile(18, 160, 18, 10); break;
            case 'surprised':
                eye(92, 100, 16, 24); eye(164, 100, 16, 24); eye(128, 172, 16, 20); break;
            case 'robot':
                g.fillStyle = '#16161c'; g.fillRect(62, 82, 132, 44);
                g.fillStyle = '#3df2ff'; g.fillRect(74, 94, 40, 20); g.fillRect(142, 94, 40, 20);
                g.fillStyle = ink; g.fillRect(84, 158, 88, 14);
                g.fillStyle = '#9aa4ad'; for (let i = 0; i < 4; i++) g.fillRect(92 + i * 20, 158, 8, 14); break;
            case 'ninja':
                g.fillStyle = ink; g.fillRect(40, 78, 176, 52);
                g.fillStyle = '#fff'; g.beginPath(); g.ellipse(94, 104, 20, 10, 0.15, 0, 7); g.fill();
                g.beginPath(); g.ellipse(162, 104, 20, 10, -0.15, 0, 7); g.fill();
                g.fillStyle = ink; eye(96, 104, 7, 8); eye(160, 104, 7, 8); break;
            case 'zombie':
                eye(92, 104, 15, 15); g.fillStyle = '#fff'; g.beginPath(); g.arc(164, 104, 15, 0, 7); g.fill(); g.fillStyle = ink;
                eye(166, 106, 5, 5);
                g.lineWidth = 10; g.beginPath(); g.moveTo(80, 166); g.lineTo(100, 156); g.lineTo(120, 168); g.lineTo(140, 156); g.lineTo(160, 168); g.lineTo(178, 158); g.stroke(); break;
            case 'angry':
                eye(92, 108, 13, 18); eye(164, 108, 13, 18);
                brow(68, 74, 112, 92); brow(188, 74, 144, 92);
                g.lineWidth = 12; g.beginPath(); g.moveTo(88, 176); g.quadraticCurveTo(128, 146, 168, 176); g.stroke(); break;
            case 'mad':
                eye(92, 110, 15, 13); eye(164, 110, 15, 13);
                brow(66, 80, 114, 98); brow(190, 80, 142, 98);
                g.beginPath(); g.moveTo(82, 158); g.lineTo(174, 158); g.lineTo(162, 186); g.lineTo(94, 186); g.closePath(); g.fill();
                g.fillStyle = '#fff'; g.fillRect(96, 160, 64, 10); g.fillStyle = ink; break;
            case 'evil':
                g.beginPath(); g.moveTo(66, 92); g.lineTo(118, 108); g.lineTo(80, 122); g.closePath(); g.fill();
                g.beginPath(); g.moveTo(190, 92); g.lineTo(138, 108); g.lineTo(176, 122); g.closePath(); g.fill();
                g.beginPath(); g.moveTo(70, 150); g.quadraticCurveTo(128, 214, 186, 150); g.quadraticCurveTo(128, 178, 70, 150); g.fill(); break;
            case 'king':
                eye(92, 102, 13, 20); eye(164, 102, 13, 20); shine(96, 94, 5); shine(168, 94, 5);
                g.lineWidth = 9; g.beginPath(); g.moveTo(96, 150); g.quadraticCurveTo(112, 138, 128, 150); g.quadraticCurveTo(144, 138, 160, 150); g.stroke();
                smile(30, 172, 18, 10); break;
            default: // smile — классическое лицо: две вертикальные овальные точки и дуга улыбки
                eye(94, 102, 12, 21); eye(162, 102, 12, 21);
                smile(46, 150, 44, 12);
        }
    },

    // Снять все куски (смена уровня). Материалы общие — живут со сценой.
    clearPieces() {
        for (const p of this.pieces) if (!p.mesh.isDisposed()) p.mesh.dispose(false, false);
        this.pieces = [];
    },

    // Физика кусков: полёт, отскок от земли, покой. Капли из свежих срезов.
    updatePieces(dt, heightAt) {
        const g = typeof PB_GRAVITY !== 'undefined' ? PB_GRAVITY : 1900;
        const life = typeof PB_PIECES_LIFE !== 'undefined' ? PB_PIECES_LIFE : 6;
        let gone = false;
        for (const p of this.pieces) {
            if (p.mesh.isDisposed()) { gone = true; continue; }
            if (p.rest) {
                // полежала — сжимается и уходит в землю, потом исчезает (лужа краски остаётся)
                p.restT = (p.restT || 0) + dt;
                if (p.restT > life) {
                    if (!p.s0) p.s0 = p.mesh.scaling.clone();
                    const k = Math.max(0, 1 - (p.restT - life) / 0.6);
                    p.mesh.scaling.copyFrom(p.s0.scale(k));
                    p.mesh.position.y -= dt * 30;
                    if (k <= 0) { p.mesh.dispose(false, false); gone = true; }
                }
                continue;
            }
            p.t += dt;
            p.vel.y -= g * dt;
            const m = p.mesh;
            m.position.addInPlace(p.vel.scale(dt));
            const al = p.ang.length();
            if (al > 0.01) m.rotate(p.ang.scale(1 / al), al * dt, BABYLON.Space.WORLD);
            m.computeWorldMatrix(true);
            const bb = m.getHierarchyBoundingVectors(true);
            const gy = heightAt(m.position.x, m.position.z);
            if (bb.min.y < gy) {
                m.position.y += gy - bb.min.y;
                if (p.vel.y < 0) p.vel.y = -p.vel.y * 0.32;
                p.vel.x *= 0.62; p.vel.z *= 0.62;
                p.ang.scaleInPlace(0.55);
                if (Math.abs(p.vel.y) < 70 && Math.hypot(p.vel.x, p.vel.z) < 40) { p.rest = true; p.vel.setAll(0); }
                if (p.leak > 0 && p.t > 0.08) {
                    GamePaint.splat(m.position.x, m.position.z, 34 + Math.random() * 30, GamePaint.pick(p.pal, p.color), 0.12);
                }
            }
            if (p.leak > 0) {
                p.leak -= dt;
                if (Math.random() < dt * 48) {
                    GamePaint.drop(m.position.x, m.position.y, m.position.z, (Math.random() - 0.5) * 120, 60 + Math.random() * 80,
                        (Math.random() - 0.5) * 120, 3 + Math.random() * 3, GamePaint.pick(p.pal, p.color), 1);
                }
            }
        }
        if (gone) this.pieces = this.pieces.filter(p => !p.mesh.isDisposed());
        // лимит: лишние лежащие куски тают
        const max = typeof PB_PIECES_MAX !== 'undefined' ? PB_PIECES_MAX : 90;
        if (this.pieces.length > max) {
            const old = this.pieces.splice(0, this.pieces.length - max);
            for (const p of old) if (!p.mesh.isDisposed()) p.mesh.dispose(false, false);
        }
    },
};

// Один персонаж в сцене.
class PbCharacter {
    /**
     * @param {any} view View3D карты
     * @param {{ name?: string, look: PbLook, scale?: number, paint?: number[], pal?: any }} opts
     */
    constructor(view, opts) {
        this.view = view;
        this.scene = view.scene;
        this.scale = opts.scale || 1;
        this.look = opts.look;
        this.paint = opts.paint || [1, 0.85, 0];   // цвет краски этого персонажа (срезы, струи)
        this.pal = opts.pal || null;
        this.rig = Rig.create(GameCharacter.model, view, { name: opts.name || 'pb', clips: GameCharacter.clips ? [GameCharacter.clips] : [] });
        this.root = this.rig.root;
        /** @type {Map<string, BABYLON.Mesh>} */
        this.parts = new Map(this.rig.parts);
        // Габариты частей в покое (локально) и центр каждой части в осях корня — для крышек срезов.
        /** @type {Map<string, { min: BABYLON.Vector3, max: BABYLON.Vector3 }>} */
        this.box = new Map();
        /** @type {Map<string, BABYLON.Vector3>} */
        this.restCenter = new Map();
        this.root.computeWorldMatrix(true);
        for (const [name, m] of this.parts) {
            m.computeWorldMatrix(true);
            const bb = m.getBoundingInfo().boundingBox;
            this.box.set(name, { min: bb.minimum.clone(), max: bb.maximum.clone() });
            this.restCenter.set(name, bb.centerWorld.clone());
        }
        const face = this.parts.get('Face');
        if (face) { face.disableEdgesRendering(); World3D.outlineRemove(view, face); }
        /** @type {{ armL: string, armR: string, legL: string, legR: string }} */
        this.limbs = { armL: 'full', armR: 'full', legL: 'full', legR: 'full' };
        this.headOn = true;
        this.dead = false;
        /** @type {BABYLON.Mesh | null} */ this.sword = null;
        /** @type {BABYLON.Mesh | null} */ this.hat = null;
        /** @type {BABYLON.Mesh[]} */ this.details = [];
        this.swordLen = 110;
        this._tip = new BABYLON.TransformNode('tip', this.scene);
        this._base = new BABYLON.TransformNode('base', this.scene);
        /** @type {any} */ this.trailDef = null;
        /** @type {BABYLON.Mesh | null} */ this.trailMesh = null;
        this._trailPts = [];
        this._trailOn = false;
        this._flash = 0;
        /** @type {BABYLON.Color3 | null} */ this._tint = null;
        /** @type {BABYLON.Mesh | null} */ this.leftItem = null;   // щит в левой руке (GameEnemies)
        /** @type {any} */ this._aura = null;
        this.root.scaling.setAll(this.scale);
        this.applyLook(opts.look);
    }

    // --- Внешний вид ------------------------------------------------------------------------

    /** @param {PbLook} look */
    applyLook(look) {
        this.look = look;
        const sleeves = !!look.armsLower;
        const col = {
            Head: look.head || look.skin,
            Torso_Upper: look.shirt,
            Torso_Lower: look.waist || look.shirt,
            Arm_L_Upper: look.armsUpper || (sleeves ? look.shirt : look.skin),
            Arm_R_Upper: look.armsUpper || (sleeves ? look.shirt : look.skin),
            Arm_L_Lower: look.armsLower || look.skin,
            Arm_R_Lower: look.armsLower || look.skin,
            Leg_L_Upper: look.legsUpper || look.pants,
            Leg_R_Upper: look.legsUpper || look.pants,
            Leg_L_Lower: look.legsLower || look.pants,
            Leg_R_Lower: look.legsLower || look.pants,
        };
        for (const [name, hex] of Object.entries(col)) {
            const m = this.parts.get(name);
            if (m && !m.isDisposed()) m.material = GameCharacter.bodyMat(this.scene, hex, look.glow);
        }
        const face = this.parts.get('Face');
        if (face && !face.isDisposed()) face.material = GameCharacter.faceMat(this.scene, look.face || 'smile');
    }

    // Модель-аксессуар -> меш (Model3D.build) или null.
    async _build(url, name) {
        const model = await GameCharacter.loadAcc(url);
        if (!model || this.rig.disposed) return null;
        const mesh = Model3D.build(model, this.scene, { name });
        return { mesh, model };
    }

    // Аура клинка у эпических и легендарных мечей: непрерывные искры вдоль лезвия.
    _setAura(swordDef) {
        if (this._aura) { try { this._aura.dispose(); } catch (e) { /* уже снята сменой карты */ } this._aura = null; }
        const st = swordDef ? GameData.swordStats(swordDef.id) : null;
        const fx = typeof Game !== 'undefined' && Game.app ? Game.app.fx : null;
        if (!st || !st.aura || !fx || !this.sword) return;
        const rainbow = st.aura === 'rainbow';
        const tmp = new BABYLON.Vector3();
        this._aura = fx.create({ follow: () => { this._tip.computeWorldMatrix(true); this._base.computeWorldMatrix(true);
                return BABYLON.Vector3.LerpToRef(this._base.getAbsolutePosition(), this._tip.getAbsolutePosition(), Math.random(), tmp); },
            texture: 'assets/fx/star.webp', rate: 22, capacity: 40, life: [0.25, 0.55], size: [7, 15], speed: [10, 40],
            direction: [[-1, 0.4, -1], [1, 1.4, 1]], color: rainbow ? '#ff3d7f' : st.aura, color2: rainbow ? '#3dc1ff' : '#ffffff', blend: 'additive' });
    }

    async setSword(url, swordDef) {
        if (this._aura) this._setAura(null);
        if (this.sword) { this.rig.detach(this.sword, true); this.sword = null; }
        if (this.limbs.armR !== 'full') return;
        const b = await this._build(url || GameCharacter.SWORD, 'sword');
        if (!b) return;
        if (this.sword) { this.rig.detach(this.sword, true); }
        this.sword = this.rig.attach('Hand_R', b.mesh, {});
        this.swordLen = Math.max(60, (b.model.max[0] || 110));
        this._tip.parent = this.sword; this._tip.position.set(this.swordLen * 0.98, 0, 0);
        this._base.parent = this.sword; this._base.position.set(this.swordLen * 0.3, 0, 0);
        this._setAura(swordDef);
        if (swordDef && swordDef.glow) {
            // светится только материал Glow (клинок), рукоять и гарда — как есть; нет такого — весь меч слабее
            const c = BABYLON.Color3.FromHexString(swordDef.glow);
            const all = [];
            for (const m of b.mesh.getChildMeshes(false)) {
                const mats = m.material ? (/** @type {any} */ (m.material).subMaterials || [m.material]) : [];
                for (const sm of mats) if (sm && sm.emissiveColor) all.push(sm);
            }
            const glow = all.filter(sm => /glow$/i.test(sm.name));
            for (const sm of glow.length ? glow : all) sm.emissiveColor = c.scale(glow.length ? 0.85 : 0.4);
        }
    }

    async setHat(url) {
        if (this.hat) { this.rig.detach(this.hat, true); this.hat = null; }
        if (!url || !this.headOn) return;
        const b = await this._build(url, 'hat');
        if (!b) return;
        if (this.hat) this.rig.detach(this.hat, true);
        this.hat = this.rig.attach('HatPoint', b.mesh, {});
    }

    // ids — ключевые слова деталей скина ('cape', 'wings'…): ищутся в GAME_DETAILS по вхождению в id.
    async setDetails(ids) {
        for (const d of this.details) this.rig.detach(d, true);
        this.details = [];
        const list = typeof GAME_DETAILS !== 'undefined' ? GAME_DETAILS : [];
        for (const key of ids || []) {
            const def = list.find(d => d.id === key) || list.find(d => d.id.includes(key));
            if (!def) continue;
            const b = await this._build(def.model, 'detail');
            if (!b) continue;
            this.details.push(this.rig.attach(def.bone || 'Back', b.mesh, {}));
        }
    }

    // --- След клинка ----------------------------------------------------------------------------

    setTrail(def) {
        this.trailDef = def;
        if (this.trailMesh) { this.trailMesh.dispose(); this.trailMesh = null; }
        this._trailPts = [];
    }

    trail(on) { this._trailOn = on; }

    _updateTrail(dt) {
        const def = this.trailDef;
        if (!def || !this.sword) return;
        const N = 14, pts = this._trailPts;
        if (this._trailOn) {
            this._tip.computeWorldMatrix(true); this._base.computeWorldMatrix(true);
            pts.unshift({ a: this._base.getAbsolutePosition().clone(), b: this._tip.getAbsolutePosition().clone(), t: 0 });
            if (pts.length > N) pts.length = N;
        } else if (pts.length) pts.pop();
        for (const p of pts) p.t += dt;
        if (pts.length < 2) { if (this.trailMesh) this.trailMesh.isVisible = false; return; }
        const from = BABYLON.Color3.FromHexString(def.from), to = BABYLON.Color3.FromHexString(def.to);
        const positions = [], colors = [], indices = [];
        const n = pts.length;
        for (let i = 0; i < n; i++) {
            const u = i / (N - 1);
            let c = BABYLON.Color3.Lerp(from, to, u);
            if (def.rainbow) { const h = 25 + (u * 300 + performance.now() * 0.2) % 305; c = BABYLON.Color3.FromHSV(h, 0.85, 1); }   // радуга без красного
            const alpha = (1 - u) * 0.85;
            const w = (def.width || 30) / 30;
            // ширина ленты: от основания клинка к кончику, сужается к хвосту
            const a = pts[i].a, b = pts[i].b;
            const ax = b.x + (a.x - b.x) * Math.min(1, w * (1 - u * 0.5)), ay = b.y + (a.y - b.y) * Math.min(1, w * (1 - u * 0.5)), az = b.z + (a.z - b.z) * Math.min(1, w * (1 - u * 0.5));
            positions.push(ax, ay, az, b.x, b.y, b.z);
            colors.push(c.r, c.g, c.b, alpha, c.r, c.g, c.b, alpha);
            if (i < n - 1) { const k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
        }
        let mesh = this.trailMesh;
        if (!mesh || mesh.isDisposed()) {
            mesh = new BABYLON.Mesh('swordTrail', this.scene);
            const mat = new BABYLON.StandardMaterial('swordTrailMat', this.scene);
            mat.disableLighting = true;
            mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
            mat.backFaceCulling = false;
            mat.alpha = 0.999;
            mat.disableDepthWrite = true;
            // обычное смешивание: аддитивное на светлом полу выгорает в белый и цвет следа пропадает
            mesh.material = mat;
            mesh.hasVertexAlpha = true;
            mesh.isPickable = false;
            mesh.renderingGroupId = World3D.LAYER.OVERLAY;
            mesh.alwaysSelectAsActiveMesh = true;
            this.trailMesh = mesh;
        }
        const vd = new BABYLON.VertexData();
        vd.positions = positions; vd.colors = colors; vd.indices = indices;
        vd.applyToMesh(mesh, true);
        mesh.isVisible = true;
    }

    // --- Положение и анимация ------------------------------------------------------------------

    place(x, y, h, heading) {
        this.root.position.set(x, h, y);
        this.root.rotation.y = -heading;
    }

    play(name, opts) { return this.rig.play(name, opts); }

    // Постоянный оттенок (заморозка): null — снять.
    tint(color) {
        this._tint = color || null;
        if (this._flash > 0) return;
        for (const m of this.parts.values()) {
            if (m.isDisposed()) continue;
            m.renderOverlay = !!color;
            if (color) { m.overlayColor = color; m.overlayAlpha = 0.4; }
        }
    }

    // Короткая белая вспышка частей (попадание).
    flash() {
        this._flash = 0.09;
        for (const m of this.parts.values()) {
            if (m.isDisposed() || m.parent === null) continue;
            m.renderOverlay = true; m.overlayColor = new BABYLON.Color3(1, 1, 1); m.overlayAlpha = 0.65;
        }
    }

    update(dt) {
        if (this._flash > 0) {
            this._flash -= dt;
            if (this._flash <= 0) {
                for (const m of this.parts.values()) if (!m.isDisposed()) m.renderOverlay = false;
                if (this._tint) this.tint(this._tint);
            }
        }
        this._updateTrail(dt);
    }

    // Мировая точка узла (px): над головой — для полоски здоровья и эффектов.
    nodePos(name) { return this.rig.nodePosition(name); }

    // --- Расчленение ----------------------------------------------------------------------------

    // Грань части: локальный центр грани и размер (оси bbox), axis 'x'|'y'|'z', sign ±1.
    _face(name, axis, sign) {
        const b = this.box.get(name);
        if (!b) return null;
        const c = b.min.add(b.max).scale(0.5);
        const half = b.max.subtract(b.min).scale(0.5);
        c[axis] = sign > 0 ? b.max[axis] : b.min[axis];
        const dims = ['x', 'y', 'z'].filter(a => a !== axis).map(a => half[a] * 2);
        return { c, dims };
    }

    // Крышка-срез цвета краски на грани меша (локальные координаты меша).
    _cap(mesh, local, axis, sign, w, d) {
        const t = 1.6;
        const size = { x: axis === 'x' ? t : w, y: axis === 'y' ? t : (axis === 'x' ? w : d), z: axis === 'z' ? t : d };
        const cap = BABYLON.MeshBuilder.CreateBox('cut', { width: size.x * 0.86, height: size.y * (axis === 'y' ? 1 : 0.86), depth: size.z * 0.86 }, this.scene);
        if (axis === 'y') { cap.scaling.set(1, 1, 1); }
        cap.material = GameCharacter.capMat(this.scene, this.paint);
        cap.parent = mesh;
        cap.position.copyFrom(local);
        cap.position[axis] += sign * 0.9;
        cap.isPickable = false;
        return cap;
    }

    // Точка и направление грани в мире (для струи).
    _faceWorld(mesh, local, axis, sign) {
        if (mesh.isDisposed()) return null;
        mesh.computeWorldMatrix(true);
        const wm = mesh.getWorldMatrix();
        const p = BABYLON.Vector3.TransformCoordinates(local, wm);
        const n = new BABYLON.Vector3(axis === 'x' ? sign : 0, axis === 'y' ? sign : 0, axis === 'z' ? sign : 0);
        const d = BABYLON.Vector3.TransformNormal(n, wm).normalize();
        return { p, d };
    }

    // Меш части -> кусок в мире: отцепить от рига (мировое положение сохраняется) и толкнуть.
    _detach(name, push) {
        const m = this.parts.get(name);
        if (!m || m.isDisposed()) return null;
        m.computeWorldMatrix(true);
        m.setParent(null);
        if (!m.rotationQuaternion) m.rotationQuaternion = BABYLON.Quaternion.FromEulerVector(m.rotation);
        m.renderOverlay = false;
        this.parts.delete(name);
        const rigMeshes = /** @type {any} */ (this.rig)._meshes;
        if (Array.isArray(rigMeshes)) { const k = rigMeshes.indexOf(m); if (k >= 0) rigMeshes.splice(k, 1); }
        this.rig.parts.delete(name);
        const piece = { mesh: m, vel: push.clone(), ang: new BABYLON.Vector3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 20),
            rest: false, t: 0, owner: this, leak: 0.9, color: this.paint, pal: this.pal };
        GameCharacter.pieces.push(piece);
        return piece;
    }

    // Предмет рига (меч, шапка, деталь) уходит с куском part.
    _carry(item, pieceMesh) {
        if (!item || item.isDisposed()) return;
        this.rig.detach(item, false);
        item.setParent(pieceMesh);
    }

    _push(dir, power) {
        const d = new BABYLON.Vector3(dir.x, 0, dir.y);
        if (d.lengthSquared() < 1e-6) d.set(Math.random() - 0.5, 0, Math.random() - 0.5);
        d.normalize();
        return new BABYLON.Vector3(d.x * power * (0.6 + Math.random() * 0.6) + (Math.random() - 0.5) * 160,
            420 + Math.random() * 380, d.z * power * (0.6 + Math.random() * 0.6) + (Math.random() - 0.5) * 160);
    }

    // Отрубить конечность: limb — armL|armR|legL|legR, whole — от плеча/бедра (иначе нижнюю половину).
    // dir — {x, y} направление удара по карте. Возвращает true, если что-то отрублено.
    cut(limb, whole, dir) {
        const L = GameCharacter.LIMBS[limb];
        const st = this.limbs[limb];
        if (!L || st === 'none') return false;
        if (st === 'upper') whole = true;
        const push = this._push(dir, this.dead ? 560 * (this._pw || 1) : 400);
        if (!whole) {
            // нижняя половина: срез — низ верхней части и верх нижней
            const top = this._face(L.lower, 'y', 1), bot = this._face(L.upper, 'y', -1);
            const up = this.parts.get(L.upper);
            if (bot && up) this._cap(up, bot.c, 'y', -1, bot.dims[0], bot.dims[1]);
            const piece = this._detach(L.lower, push);
            if (!piece) return false;
            if (top) this._cap(piece.mesh, top.c, 'y', 1, top.dims[0], top.dims[1]);
            if (L.sword && this.sword) { this._carry(this.sword, piece.mesh); this.sword = null; }
            if (limb === 'armL' && this.leftItem) { this._carry(this.leftItem, piece.mesh); this.leftItem = null; }
            this.limbs[limb] = 'upper';
            if (up && bot) this._jet(up, bot.c, 'y', -1, 0.9);
        } else {
            const up = this.parts.get(L.upper), low = this.parts.get(L.lower);
            if (low && up) { low.setParent(up); this.parts.delete(L.lower); this.rig.parts.delete(L.lower);
                const rm = /** @type {any} */ (this.rig)._meshes; if (Array.isArray(rm)) { const k = rm.indexOf(low); if (k >= 0) rm.splice(k, 1); } }
            const piece = this._detach(L.upper, push);
            if (!piece) return false;
            const topFace = this._face(L.upper, 'y', 1);
            if (topFace) this._cap(piece.mesh, topFace.c, 'y', 1, topFace.dims[0], topFace.dims[1]);
            if (L.sword && this.sword) { this._carry(this.sword, piece.mesh); this.sword = null; }
            if (limb === 'armL' && this.leftItem) { this._carry(this.leftItem, piece.mesh); this.leftItem = null; }
            // обрубок на торсе
            const anchor = this.parts.get(L.anchor);
            if (anchor) {
                const ac = this._anchorPoint(L, anchor);
                if (ac) { this._cap(anchor, ac.c, ac.axis, ac.sign, ac.w, ac.d); this._jet(anchor, ac.c, ac.axis, ac.sign, 1.0); }
            }
            this.limbs[limb] = 'none';
        }
        GameCharacter.updatePieces(0, GamePaint.heightAt);
        return true;
    }

    // Где на якоре (торсе) была конечность: грань со стороны конечности, в локальных осях якоря.
    _anchorPoint(L, anchor) {
        const ab = this.box.get(L.anchor), ub = this.restCenter.get(L.upper), ac = this.restCenter.get(L.anchor);
        if (!ab || !ub || !ac) return null;
        const rel = ub.subtract(ac);   // смещение центра конечности от центра якоря (оси корня, покой; посчитано до масштаба корня)
        const c = ab.min.add(ab.max).scale(0.5);
        if (L.side === 'z') {
            const sign = rel.z > 0 ? 1 : -1;
            c.z = sign > 0 ? ab.max.z : ab.min.z;
            c.y = ab.max.y - (ab.max.y - ab.min.y) * 0.45;
            return { c, axis: 'z', sign, w: (ab.max.x - ab.min.x) * 0.9, d: (ab.max.y - ab.min.y) * 0.8 };
        }
        c.y = ab.min.y;
        c.z += rel.z;
        return { c, axis: 'y', sign: -1, w: (ab.max.x - ab.min.x) * 0.9, d: (ab.max.z - ab.min.z) * 0.45 };
    }

    _jet(mesh, local, axis, sign, seconds) {
        GamePaint.jet(() => this._faceWorld(mesh, local, axis, sign), this.paint, seconds, this.pal, 75, 380, 1);
    }

    // Голова слетает вверх с шапкой, из шеи бьёт фонтан; тело ещё миг стоит (потом collapse).
    behead(dir) {
        if (this.dead) return;
        this.dead = true;
        this.rig.speed = 0.25;
        const head = this.parts.get('Head'), face = this.parts.get('Face');
        if (head && face) { face.setParent(head); this.parts.delete('Face'); this.rig.parts.delete('Face'); }
        const neckT = this._face('Torso_Upper', 'y', 1), neckH = this._face('Head', 'y', -1);
        const hp = this._detach('Head', this._push(dir, 300).add(new BABYLON.Vector3(0, 780, 0)));
        if (hp) {
            if (this.hat) { this._carry(this.hat, hp.mesh); this.hat = null; }
            if (neckH) this._cap(hp.mesh, neckH.c, 'y', -1, neckH.dims[0] * 0.8, neckH.dims[1] * 0.8);
            hp.ang.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 30);
            hp.leak = 1.2;
        }
        const tu = this.parts.get('Torso_Upper');
        if (tu && neckT) {
            this._cap(tu, neckT.c, 'y', 1, neckT.dims[0] * 0.6, neckT.dims[1] * 0.8);
            GamePaint.jet(() => this._faceWorld(tu, neckT.c, 'y', 1), this.paint, 0.9, this.pal, 140, 620, 1.4);   // фонтан из шеи
        }
        this._burst(dir, 0.6);
    }

    // Разруб пополам: верх (торс, руки, голова) улетает одним куском, ноги стоят и брызжут.
    bisect(dir) {
        if (this.dead) return;
        this.dead = true;
        this.rig.speed = 0.25;
        const tu = this.parts.get('Torso_Upper');
        if (!tu) { this.explode(dir); return; }
        tu.computeWorldMatrix(true);
        const ride = ['Head', 'Face', 'Arm_L_Upper', 'Arm_L_Lower', 'Arm_R_Upper', 'Arm_R_Lower'];
        for (const n of ride) {
            const m = this.parts.get(n);
            if (!m || m.isDisposed()) continue;
            m.setParent(tu);
            this.parts.delete(n); this.rig.parts.delete(n);
            const rm = /** @type {any} */ (this.rig)._meshes; if (Array.isArray(rm)) { const k = rm.indexOf(m); if (k >= 0) rm.splice(k, 1); }
        }
        const upF = this._face('Torso_Upper', 'y', -1), lowF = this._face('Torso_Lower', 'y', 1);
        const piece = this._detach('Torso_Upper', this._push(dir, 520).add(new BABYLON.Vector3(0, 300, 0)));
        if (piece) {
            for (const it of [this.sword, this.hat, this.leftItem, ...this.details]) if (it) this._carry(it, piece.mesh);
            this.sword = null; this.hat = null; this.leftItem = null; this.details = [];
            if (upF) this._cap(piece.mesh, upF.c, 'y', -1, upF.dims[0], upF.dims[1]);
            piece.ang.scaleInPlace(1.6);
            piece.leak = 1.2;
        }
        const tl = this.parts.get('Torso_Lower');
        if (tl && lowF) {
            this._cap(tl, lowF.c, 'y', 1, lowF.dims[0], lowF.dims[1]);
            GamePaint.jet(() => this._faceWorld(tl, lowF.c, 'y', 1), this.paint, 0.8, this.pal, 150, 560, 1.5);
        }
        this._burst(dir, 0.7);
        if (this.trailMesh) { this.trailMesh.dispose(); this.trailMesh = null; }
        this._setAura(null);
    }

    // Обрушение: что осталось стоять — падает и раскатывается, лужа под телом.
    collapse(dir) {
        if (this.rig.disposed) return;
        const d = { x: dir.x * 0.3, y: dir.y * 0.3 };
        for (const limb of ['armL', 'armR', 'legL', 'legR']) if (this.limbs[limb] !== 'none' && this.parts.get(GameCharacter.LIMBS[limb].upper)) this.cut(limb, true, d);
        for (const n of ['Head', 'Torso_Upper', 'Torso_Lower']) {
            const pc = this._detach(n, new BABYLON.Vector3((Math.random() - 0.5) * 160, 120 + Math.random() * 160, (Math.random() - 0.5) * 160));
            if (pc && n === 'Head') { const face = this.parts.get('Face'); if (face) face.setParent(pc.mesh); if (this.hat) { this._carry(this.hat, pc.mesh); this.hat = null; } }
            if (pc && n === 'Torso_Upper') { for (const it of [this.sword, this.leftItem, ...this.details]) if (it) this._carry(it, pc.mesh); this.sword = null; this.leftItem = null; this.details = []; }
        }
        const pos = this.root.position;
        GamePaint.puddle(pos.x, pos.z, 170 * this.scale, this.paint, this.pal);
        if (this.trailMesh) { this.trailMesh.dispose(); this.trailMesh = null; }
        this._setAura(null);
        this.rig.dispose();
    }

    // Общий всплеск краски при добивании.
    _burst(dir, k) {
        const pos = this.root.position;
        const center = new BABYLON.Vector3(pos.x, pos.y + 110 * this.scale, pos.z);
        GamePaint.spray(center, new BABYLON.Vector3(dir.x, 0.7, dir.y), this.paint, Math.round(40 * k), 680, this.pal, 0.9);
    }

    // Смерть: всё оставшееся разлетается, голова с шапкой, торс пополам, лужа краски. power — сила разлёта.
    explode(dir, power) {
        if (this.dead) return;
        this.dead = true;
        const pw = power || 1;
        this._pw = pw;
        const pos = this.root.position.clone();
        // голова: лицо и шапка едут с ней
        const head = this.parts.get('Head'), face = this.parts.get('Face');
        if (head && face) { face.setParent(head); this.parts.delete('Face'); this.rig.parts.delete('Face'); }
        const neckT = this._face('Torso_Upper', 'y', 1), neckH = this._face('Head', 'y', -1);
        const tu = this.parts.get('Torso_Upper'), tl = this.parts.get('Torso_Lower');
        // Предметы: шапка — с головой, детали — с торсом
        const headPiece = this._detach('Head', this._push(dir, 420).add(new BABYLON.Vector3(0, 460, 0)));
        if (headPiece) {
            if (this.hat) { this._carry(this.hat, headPiece.mesh); this.hat = null; }
            if (neckH) this._cap(headPiece.mesh, neckH.c, 'y', -1, neckH.dims[0] * 0.8, neckH.dims[1] * 0.8);
            headPiece.ang.scaleInPlace(1.4);
        }
        if (tu && neckT) { this._cap(tu, neckT.c, 'y', 1, neckT.dims[0] * 0.6, neckT.dims[1] * 0.8); }
        for (const limb of ['armL', 'armR', 'legL', 'legR']) if (this.limbs[limb] !== 'none') this.cut(limb, true, { x: dir.x + (Math.random() - 0.5), y: dir.y + (Math.random() - 0.5) });
        const upFace = this._face('Torso_Upper', 'y', -1), lowFace = this._face('Torso_Lower', 'y', 1);
        const upPiece = this._detach('Torso_Upper', this._push(dir, 300));
        if (upPiece) {
            for (const d of this.details) this._carry(d, upPiece.mesh);
            this.details = [];
            if (upFace) this._cap(upPiece.mesh, upFace.c, 'y', -1, upFace.dims[0], upFace.dims[1]);
        }
        const lowPiece = this._detach('Torso_Lower', this._push(dir, 170));
        if (lowPiece && lowFace) this._cap(lowPiece.mesh, lowFace.c, 'y', 1, lowFace.dims[0], lowFace.dims[1]);
        if (this.sword) { const s = this.sword; this.rig.detach(s, false); this.sword = null;
            GameCharacter.pieces.push({ mesh: s, vel: this._push(dir, 300), ang: new BABYLON.Vector3(4, 8, 3), rest: false, t: 0, owner: this, leak: 0, color: this.paint, pal: this.pal }); }
        // краска
        const center = new BABYLON.Vector3(pos.x, pos.y + 100 * this.scale, pos.z);
        GamePaint.spray(center, new BABYLON.Vector3(dir.x, 0.8, dir.y), this.paint, Math.round(52 * pw), 700, this.pal, 0.9);
        GamePaint.spray(center, new BABYLON.Vector3(0, 1, 0), this.paint, Math.round(28 * pw), 600, this.pal, 1.2);
        GamePaint.puddle(pos.x, pos.z, 190 * this.scale, this.paint, this.pal);
        if (this.trailMesh) { this.trailMesh.dispose(); this.trailMesh = null; }
        this._setAura(null);
        this.rig.dispose();
    }

    // Полностью убрать (без кусков): смена уровня, пересборка игрока.
    dispose() {
        this._setAura(null);
        if (this.trailMesh) { this.trailMesh.dispose(); this.trailMesh = null; }
        this._tip.dispose(); this._base.dispose();
        if (!this.rig.disposed) this.rig.dispose();
    }
}
