// GamePaint.js — краска вместо крови: кляксы на земле, капли в полёте, струи из обрубков, растущие лужи.
// Это ВИД (Babylon): решения игры от него не зависят. Кляксы — thin instances плоского квадрата по
// текстурам-маскам assets/fx/splat_XX.webp (белые с alpha, цвет — у экземпляра), капли — thin instances
// маленькой сферы. Всё живёт в сцене текущей карты; GamePaint.reset(view) — после смены карты.

/** @typedef {{ x: number, y: number, z: number, vx: number, vy: number, vz: number, r: number, c: number[], t: number, splat: number, life: number }} PaintDrop */

/** @satisfies {Record<string, any>} */
const GamePaint = {
    /** @type {any} */
    view: null,
    /** @type {BABYLON.Scene | null} */
    scene: null,
    /** @type {Array<{ mesh: BABYLON.Mesh, mats: Float32Array, cols: Float32Array, cap: number, next: number, count: number, dirty: boolean }>} */
    splats: [],
    /** @type {{ mesh: BABYLON.Mesh, mats: Float32Array, cols: Float32Array, cap: number } | null} */
    dropSet: null,
    /** @type {PaintDrop[]} */
    drops: [],
    /** @type {Array<{ src: () => ({ p: BABYLON.Vector3, d: BABYLON.Vector3 } | null), c: number[] | null, pal: any, t: number, rate: number, speed: number, acc: number, size: number }>} */
    jets: [],
    /** @type {Array<{ set: any, i: number, t: number, dur: number, s0: number, s1: number, x: number, y: number, z: number, rot: number, st?: number }>} */
    growing: [],
    /** Временные кляксы (примерка в магазине): через life секунд сжимаются и исчезают. */
    /** @type {Array<{ set: any, i: number, t: number, life: number, size: number, x: number, y: number, z: number, rot: number, stamp: number }>} */
    temp: [],
    _m: null,
    _q: null,
    _v: null,
    _s: null,
    heightAt: /** @type {(x: number, z: number) => number} */ ((x, z) => 0),

    // Маски клякс: пути литералами (сканер сборщика). Нет файла — техническая круглая маска.
    TEXTURES: ['assets/fx/splat_01.webp', 'assets/fx/splat_02.webp', 'assets/fx/splat_03.webp', 'assets/fx/splat_04.webp',
        'assets/fx/splat_05.webp', 'assets/fx/splat_06.webp', 'assets/fx/splat_07.webp', 'assets/fx/splat_08.webp'],

    cfg() {
        const U = 'undefined';
        return {
            splats: typeof PB_PAINT_SPLATS_MAX !== U ? PB_PAINT_SPLATS_MAX : 1100,
            drops: typeof PB_PAINT_DROPS_MAX !== U ? PB_PAINT_DROPS_MAX : 360,
            g: typeof PB_GRAVITY !== U ? PB_GRAVITY : 1900,
        };
    },

    // Новая сцена/карта: старые меши умерли со сценой или снимаются здесь.
    reset(view, heightAt) {
        this.dispose();
        this.view = view;
        this.scene = view.scene;
        this.heightAt = heightAt || ((x, z) => 0);
        this._m = new BABYLON.Matrix();
        this._q = new BABYLON.Quaternion();
        this._v = new BABYLON.Vector3();
        this._s = new BABYLON.Vector3();
        const c = this.cfg();
        const mobile = typeof IS_MOBILE !== 'undefined' && IS_MOBILE;
        const per = Math.max(16, Math.ceil(c.splats * (mobile ? 0.6 : 1) / this.TEXTURES.length));
        this.TEXTURES.forEach((url, i) => {
            const mesh = this._quad('paintSplat' + i);
            const mat = new BABYLON.StandardMaterial('paintSplatMat' + i, this.scene);
            const tex = new BABYLON.Texture(url, this.scene, { invertY: true, samplingMode: BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
                onError: () => { mat.diffuseTexture = this._fallbackTexture(); } });
            tex.hasAlpha = true;
            mat.diffuseTexture = tex;
            mat.alphaCutOff = 0.42;
            mat.specularColor = new BABYLON.Color3(0, 0, 0);
            mat.emissiveColor = new BABYLON.Color3(0.16, 0.16, 0.16);
            mat.disableDepthWrite = true;
            mat.zOffset = -2;
            mat.metadata = { toonGroup: 'ground' };
            mesh.material = mat;
            mesh.receiveShadows = true;
            const set = this._instances(mesh, per);
            this.splats.push(Object.assign(set, { next: 0, count: 0, dirty: false }));
        });
        const drop = BABYLON.MeshBuilder.CreateIcoSphere('paintDrop', { radius: 1, subdivisions: 2, flat: false }, this.scene);
        const dm = new BABYLON.StandardMaterial('paintDropMat', this.scene);
        dm.specularColor = new BABYLON.Color3(0.25, 0.25, 0.25);
        dm.emissiveColor = new BABYLON.Color3(0.22, 0.22, 0.22);
        drop.material = dm;
        this.dropSet = this._instances(drop, Math.max(32, Math.round(c.drops * (mobile ? 0.6 : 1))));
        this.drops = [];
        this.jets = [];
        this.growing = [];
        this.temp = [];
    },

    dispose() {
        for (const s of this.splats) if (s.mesh && !s.mesh.isDisposed()) { if (s.mesh.material) s.mesh.material.dispose(true, true); s.mesh.dispose(); }
        if (this.dropSet && !this.dropSet.mesh.isDisposed()) { this.dropSet.mesh.material.dispose(); this.dropSet.mesh.dispose(); }
        this.splats = [];
        this.dropSet = null;
        this.drops = [];
        this.jets = [];
        this.growing = [];
    },

    // Плоский квадрат 1×1 в плоскости XZ, нормаль вверх, UV 0..1.
    _quad(name) {
        const m = new BABYLON.Mesh(name, this.scene);
        const vd = new BABYLON.VertexData();
        vd.positions = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5];
        vd.indices = [0, 1, 2, 0, 2, 3];   // лицом вверх (сцена правосторонняя)
        vd.normals = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
        vd.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
        vd.applyToMesh(m);
        m.isPickable = false;
        return m;
    },

    // Буферы thin instances. Экземпляров всегда ≥ 1 (нулевой — вырожденная матрица): если шейдер
    // впервые соберётся при 0 экземпляров, цвет экземпляра (INSTANCESCOLOR) потом не включится.
    _instances(mesh, cap) {
        const mats = new Float32Array(cap * 16), cols = new Float32Array(cap * 4);
        mesh.thinInstanceSetBuffer('matrix', mats, 16, false);
        mesh.thinInstanceSetBuffer('color', cols, 4, false);
        mesh.thinInstanceCount = 1;
        mesh.alwaysSelectAsActiveMesh = true;
        mesh.isPickable = false;
        return { mesh, mats, cols, cap };
    },

    _fallback: /** @type {BABYLON.DynamicTexture | null} */ (null),
    _fallbackTexture() {
        if (this._fallback && this._fallback.getScene() === this.scene) return this._fallback;
        const t = new BABYLON.DynamicTexture('paintSplatFallback', { width: 128, height: 128 }, this.scene, true);
        const g = /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ (t.getContext()));
        g.clearRect(0, 0, 128, 128);
        g.fillStyle = '#fff';
        g.beginPath();
        for (let i = 0; i <= 24; i++) {
            const a = i / 24 * Math.PI * 2, r = 44 + (i % 2 ? 10 : -4);
            if (i) g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); else g.moveTo(64 + r, 64);
        }
        g.fill();
        t.hasAlpha = true;
        t.update();
        this._fallback = t;
        return t;
    },

    // '#rrggbb' -> [r, g, b] 0..1, без красного (safe)
    rgb(hex) {
        const n = parseInt(String(hex).replace('#', ''), 16) || 0;
        return this.safe([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]);
    },

    // Краска не похожа на кровь: насыщенный красный -> розовый (малиновые) или оранжевый (алые), яркий.
    safe(c) {
        const r = c[0], g = c[1], b = c[2], mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
        if (d < 0.25 || mx !== r) return c;
        let h = (g - b) / d * 60;
        if (h < 0) h += 360;
        if (h > 14 && h < 336) return c;
        const H = (h >= 336 || h < 4 ? 326 : 28) / 60, S = 0.82, V = Math.max(mx, 0.94);
        const i = Math.floor(H), f = H - i, p = V * (1 - S), q = V * (1 - S * f), t = V * (1 - S * (1 - f));
        return [[V, q, p, p, t, V][i % 6], [t, V, V, q, p, p][i % 6], [p, p, t, V, V, q][i % 6]];
    },

    // Цвет капли/кляксы по палитре врага: perDrop — каждый раз свой цвет палитры.
    pick(pal, base) {
        if (pal && pal.perDrop && pal.colors && pal.colors.length) return this.rgb(pal.colors[(Math.random() * pal.colors.length) | 0]);
        return base;
    },

    // --- Кляксы на земле -------------------------------------------------------------------------

    // Клякса в точке карты (x — вправо, z — вниз по карте), size — px поперёк. grow — секунд роста (лужа).
    // life > 0 — временная: через life секунд сжимается и пропадает (примерка краски в магазине).
    splat(x, z, size, color, grow, life, rot, stretch) {
        if (!this.splats.length || !this.scene) return;
        const set = this.splats[(Math.random() * this.splats.length) | 0];
        const i = set.next;
        set.next = (set.next + 1) % set.cap;
        set.count = Math.min(set.cap, set.count + 1);
        const y = this.heightAt(x, z) + 0.6 + Math.random() * 0.4;
        if (rot == null) rot = Math.random() * Math.PI * 2;
        const st = stretch || 1;
        if (grow > 0) {
            this.growing.push({ set, i, t: 0, dur: grow, s0: size * 0.25, s1: size, x, y, z, rot, st });
            this._writeSplat(set, i, x, y, z, size * 0.25, rot, st);
        } else this._writeSplat(set, i, x, y, z, size, rot, st);
        const o = i * 4;
        set.cols[o] = color[0]; set.cols[o + 1] = color[1]; set.cols[o + 2] = color[2]; set.cols[o + 3] = 1;
        set.dirty = true;
        set.stamp = (set.stamp || 0) + 1;
        if (!set.stamps) set.stamps = new Int32Array(set.cap);
        set.stamps[i] = set.stamp;
        if (life > 0) this.temp.push({ set, i, t: 0, life, size, x, y, z, rot, stamp: set.stamp });
    },

    _writeSplat(set, i, x, y, z, size, rot, stretch) {
        BABYLON.Quaternion.RotationYawPitchRollToRef(rot, 0, 0, this._q);
        this._s.set(size * (stretch || 1), 1, size);
        this._v.set(x, y, z);
        BABYLON.Matrix.ComposeToRef(this._s, this._q, this._v, this._m);
        this._m.copyToArray(set.mats, i * 16);
        set.dirty = true;
    },

    // Полоса брызг по направлению удара (dir — {x, y} по карте): кляксы уменьшаются и вытягиваются.
    streak(x, z, dir, color, pal, len) {
        const l = Math.hypot(dir.x, dir.y) || 1, dx = dir.x / l, dz = dir.y / l;
        const rot = -Math.atan2(dz, dx), n = 7;
        for (let i = 1; i <= n; i++) {
            const u = i / n, d = 40 + u * (len || 320);
            const side = (Math.random() - 0.5) * 50 * u;
            this.splat(x + dx * d - dz * side, z + dz * d + dx * side, (90 - 60 * u) * (0.7 + Math.random() * 0.6), this.pick(pal, color), 0.06 + u * 0.12, 0, rot, 1.8 + u);
        }
    },

    // Лужа под телом: растущая большая клякса и пара спутников.
    puddle(x, z, size, color, pal) {
        this.splat(x, z, size, this.pick(pal, color), 0.35);
        const n = 2 + ((Math.random() * 3) | 0);
        for (let k = 0; k < n; k++) {
            const a = Math.random() * Math.PI * 2, d = size * (0.35 + Math.random() * 0.45);
            this.splat(x + Math.cos(a) * d, z + Math.sin(a) * d, size * (0.25 + Math.random() * 0.3), this.pick(pal, color), 0.25);
        }
    },

    // --- Капли ---------------------------------------------------------------------------------

    // Одна капля: позиция и скорость в px мира (Babylon: y — вверх).
    drop(x, y, z, vx, vy, vz, r, color, splat, life) {
        const cap = this.dropSet ? this.dropSet.cap : 0;
        if (!cap) return;
        if (this.drops.length >= cap) this.drops.shift();
        this.drops.push({ x, y, z, vx, vy, vz, r, c: color, t: 0, splat: splat == null ? 1 : splat, life: life || 0 });
    },

    // Веер капель из точки p в сторону d (Vector3, не обязательно единичный), power — скорость px/с.
    spray(p, d, color, count, power, pal, spread, life) {
        const len = Math.hypot(d.x, d.y, d.z) || 1;
        const dx = d.x / len, dy = d.y / len, dz = d.z / len;
        const sp = spread == null ? 0.55 : spread;
        const mobile = typeof IS_MOBILE !== 'undefined' && IS_MOBILE;
        const n = Math.max(1, Math.round(count * (mobile ? 0.65 : 1)));
        for (let k = 0; k < n; k++) {
            const s = power * (0.45 + Math.random() * 0.75);
            const rx = (Math.random() - 0.5) * 2 * sp, ry = Math.random() * sp, rz = (Math.random() - 0.5) * 2 * sp;
            this.drop(p.x, p.y, p.z, (dx + rx) * s, (dy + ry) * s + 120, (dz + rz) * s,
                3 + Math.random() * 6.5, this.pick(pal, color), Math.random() < 0.4 ? 1 : 0, life);
        }
    },

    // Струя из обрубка: src() каждый кадр отдаёт { p, d } (точка и направление среза) или null — струя кончилась.
    jet(src, color, seconds, pal, rate, speed, size) {
        this.jets.push({ src, c: color, pal, t: seconds, rate: rate || 70, speed: speed || 420, acc: 0, size: size || 1 });
    },

    // --- Кадр ----------------------------------------------------------------------------------

    update(dt) {
        if (!this.scene || !this.dropSet) return;
        const g = this.cfg().g;
        // струи
        for (let k = this.jets.length - 1; k >= 0; k--) {
            const j = this.jets[k];
            j.t -= dt;
            const s = j.t > 0 ? j.src() : null;
            if (!s) { this.jets.splice(k, 1); continue; }
            j.acc += dt * j.rate * Math.min(1, 0.35 + j.t);
            while (j.acc >= 1) {
                j.acc -= 1;
                const sp = j.speed * (0.55 + Math.random() * 0.6) * Math.min(1, 0.4 + j.t);
                const d = s.d;
                this.drop(s.p.x, s.p.y, s.p.z,
                    d.x * sp + (Math.random() - 0.5) * 90, d.y * sp + 80 + Math.random() * 90, d.z * sp + (Math.random() - 0.5) * 90,
                    (2.5 + Math.random() * 4) * j.size, this.pick(j.pal, j.c), Math.random() < 0.3 ? 1 : 0);
            }
        }
        // капли
        const set = this.dropSet, mats = set.mats, cols = set.cols;
        let w = 0;
        for (let k = 0; k < this.drops.length; k++) {
            const d = this.drops[k];
            d.t += dt;
            d.vy -= g * dt;
            d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
            const gy = this.heightAt(d.x, d.z);
            if (d.y - d.r * 0.5 <= gy || d.t > 3) {
                if (d.splat && d.t <= 3) this.splat(d.x, d.z, d.r * (6 + Math.random() * 6), d.c, 0.08, d.life);
                continue;
            }
            this.drops[w++] = d;
        }
        this.drops.length = w;
        const n = Math.min(w, set.cap);
        for (let k = 0; k < n; k++) {
            const d = this.drops[k], o = k * 16;
            // капля вытягивается по скорости — читается как брызги, а не шарики
            const sp = Math.hypot(d.vx, d.vy, d.vz), st = 1 + Math.min(1.6, sp / 900);
            mats[o] = d.r; mats[o + 1] = 0; mats[o + 2] = 0; mats[o + 3] = 0;
            mats[o + 4] = 0; mats[o + 5] = d.r * st; mats[o + 6] = 0; mats[o + 7] = 0;
            mats[o + 8] = 0; mats[o + 9] = 0; mats[o + 10] = d.r; mats[o + 11] = 0;
            mats[o + 12] = d.x; mats[o + 13] = d.y; mats[o + 14] = d.z; mats[o + 15] = 1;
            const c = k * 4;
            cols[c] = d.c[0]; cols[c + 1] = d.c[1]; cols[c + 2] = d.c[2]; cols[c + 3] = 1;
        }
        if (!n) mats.fill(0, 0, 16);
        set.mesh.thinInstanceCount = Math.max(1, n);
        set.mesh.thinInstanceBufferUpdated('matrix'); set.mesh.thinInstanceBufferUpdated('color');
        // растущие лужи
        for (let k = this.growing.length - 1; k >= 0; k--) {
            const gr = this.growing[k];
            gr.t += dt;
            const u = Math.min(1, gr.t / gr.dur), e = 1 - Math.pow(1 - u, 3);
            this._writeSplat(gr.set, gr.i, gr.x, gr.y, gr.z, gr.s0 + (gr.s1 - gr.s0) * e, gr.rot, gr.st);
            if (u >= 1) this.growing.splice(k, 1);
        }
        // временные кляксы: держатся life секунд, потом сжимаются за 0.5 с (если слот не занят новой)
        for (let k = this.temp.length - 1; k >= 0; k--) {
            const tp = this.temp[k];
            tp.t += dt;
            if (tp.set.stamps && tp.set.stamps[tp.i] !== tp.stamp) { this.temp.splice(k, 1); continue; }
            if (tp.t < tp.life) continue;
            const u = Math.min(1, (tp.t - tp.life) / 0.5);
            this._writeSplat(tp.set, tp.i, tp.x, tp.y, tp.z, Math.max(0.001, tp.size * (1 - u)), tp.rot);
            if (u >= 1) { tp.set.mats.fill(0, tp.i * 16, tp.i * 16 + 16); tp.set.dirty = true; this.temp.splice(k, 1); }
        }
        for (const s of this.splats) {
            if (!s.dirty) continue;
            s.dirty = false;
            s.mesh.thinInstanceCount = Math.max(1, s.count);
            s.mesh.thinInstanceBufferUpdated('matrix');
            s.mesh.thinInstanceBufferUpdated('color');
        }
    },

    // Сколько клякс сейчас на земле (для отладки).
    count() { let n = 0; for (const s of this.splats) n += s.count; return n; },
};
