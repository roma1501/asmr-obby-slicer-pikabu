// GameShopData.js — данные магазина Paint Blade: вкладки, предметы с ценами, награды Daily Gift и секторы колеса.
// Каталоги берутся из GameData (скины, краска, следы, победа), GAME_SWORDS и GAME_HATS (js/GameModels*.js);
// предметы строятся ПРИ ВЫЗОВЕ GameShopData.items() — то есть из того, что есть к моменту GameShopUI.init.
// Логика — Shop.js / DailyGift.js / Wheel.js, интерфейс — GameShopUI.js.
//
// Распределение «монеты / реклама» детерминированное (без Math.random): в каждой вкладке предметы (кроме
// стартового и эксклюзивов) упорядочены по редкости; доля SHOP_COINS_SHARE (≈35%) уходит под монеты ровным
// шагом (Брезенхэм), первый и самый дешёвый предмет вкладки — всегда за монеты (первая покупка после 2–3
// уровней). Цены — «лесенка» внутри редкости (дешёвый -> дорогой), диапазоны в RARITY_BANDS.
// Заработок: ~40–90 монет за уровень (Game.js), поэтому 150 монет — 2–3 уровня, 2000–3000 — долгая цель.

/** Вкладки магазина. slot — куда надевается; color/color2 — цвет вкладки и шапки магазина; glyph — значок вкладки. */
const SHOP_TABS = [
    { id: 'skins', slot: 'skin', name: { ru: 'Скины', en: 'Skins' }, color: '#2f9bff', color2: '#1667d9', glyph: 'skin' },
    { id: 'hats', slot: 'hat', name: { ru: 'Шапки', en: 'Hats' }, color: '#9b4dff', color2: '#6c22e0', glyph: 'hat' },
    { id: 'swords', slot: 'sword', name: { ru: 'Мечи', en: 'Swords' }, color: '#ff5ca8', color2: '#d62c86', glyph: 'sword' },
    { id: 'paints', slot: 'paint', name: { ru: 'Краска', en: 'Paint' }, color: '#ff8a1f', color2: '#ff5d1f', glyph: 'paint' },
    { id: 'trails', slot: 'trail', name: { ru: 'Следы', en: 'Trails' }, color: '#2fd36b', color2: '#11a84e', glyph: 'trail' },
    { id: 'victory', slot: 'victory', name: { ru: 'Победа', en: 'Victory' }, color: '#ffc61a', color2: '#e8960c', glyph: 'victory' },
];

/**
 * Daily Gift: награды дней 1–6 (7-й день — эксклюзивный скин из очереди Shop.exclusiveIds('daily')).
 * Нарастают; на 3-м и 5-м днях — предмет магазина (след и шапка). Предмет 5-го дня — шапка среднего
 * класса из GAME_HATS, а пока шапок нет — эффект победы (так награда всегда есть в каталоге).
 * @type {Array<{ coins: number, item?: string }>}
 */
const DAILY_REWARDS = (() => {
    const hats = typeof GAME_HATS !== 'undefined' ? GAME_HATS : [];
    const hat = hats.find((h) => h.rarity === 'rare') || hats.find((h) => h.rarity === 'common') || hats[0] || null;
    return [
        { coins: 50 },
        { coins: 80 },
        { coins: 100, item: 'trail_sparks' },
        { coins: 150 },
        { coins: 200, item: hat ? hat.id : 'win_hearts' },
        { coins: 300 },
    ];
})();

/**
 * Колесо фортуны: 8 секторов (по часовой от указателя). weight — вес выпадения; color/color2 — краска сектора.
 * Монеты 25…250 + джекпот 500 (редкий) + один сектор «случайный предмет» (не выше epic, эксклюзивы Daily не выпадают).
 * Ожидание ≈ 69 монет за вращение + предмет раз в ~9 вращений.
 */
const WHEEL_SECTORS = [
    { coins: 25, weight: 22, color: '#1ec8e8', color2: '#0f98c0' },
    { coins: 100, weight: 12, color: '#ff8a1f', color2: '#e0600a' },
    { coins: 50, weight: 20, color: '#2fd36b', color2: '#11a84e' },
    { randomItem: true, maxRarity: 'epic', weight: 9, color: '#9b4dff', color2: '#6c22e0' },
    { coins: 75, weight: 14, color: '#ff5fa2', color2: '#d92f7a' },
    { coins: 250, weight: 3, color: '#ff5ca8', color2: '#d62c86' },
    { coins: 150, weight: 7, color: '#2f9bff', color2: '#1667d9' },
    { coins: 500, weight: 1, color: '#ffcf33', color2: '#e8a400', jackpot: true },
];

/** @satisfies {Record<string, any>} */
const GameShopData = {
    /** Порядок редкостей (как Shop.RARITIES). */
    RARITY_ORDER: ['common', 'uncommon', 'rare', 'epic', 'legendary'],

    /** Цены по редкости: coins — [от, до] для «лесенки», ads — [от, до] просмотров рекламы (1..5). */
    RARITY_BANDS: {
        common: { coins: [150, 300], ads: [1, 2] },
        uncommon: { coins: [250, 450], ads: [2, 2] },
        rare: { coins: [400, 700], ads: [2, 3] },
        epic: { coins: [900, 1400], ads: [3, 4] },
        legendary: { coins: [2000, 3000], ads: [5, 5] },
    },

    /** Предмет вкладки, выданный с начала и надетый (у шапок такого нет — шапку можно снять). */
    DEFAULTS: { skins: 'skin_noob', hats: '', swords: 'sword_basic', paints: 'paint_classic', trails: 'trail_white', victory: 'win_cheer' },

    /** Вкладки, в которых уже есть предметы (пока каталог мечей или шапок пуст, вкладка не показывается). */
    tabs() { return SHOP_TABS.filter((t) => this.catalog(t.id).length > 0).map((t) => ({ ...t })); },
    daily() { return DAILY_REWARDS.map((r) => ({ ...r })); },
    wheel() { return WHEEL_SECTORS.map((s) => ({ ...s })); },

    /** Каталог вкладки — записи GameData / GAME_SWORDS / GAME_HATS (пустой массив, пока модели не готовы). */
    catalog(tab) {
        switch (tab) {
            case 'skins': return GameData.SKINS;
            case 'paints': return GameData.PAINTS;
            case 'trails': return GameData.TRAILS;
            case 'victory': return GameData.VICTORIES;
            case 'swords': return typeof GAME_SWORDS !== 'undefined' ? GAME_SWORDS : [];
            case 'hats': return typeof GAME_HATS !== 'undefined' ? GAME_HATS : [];
            default: return [];
        }
    },

    /** Запись каталога по id предмета: { tab, data } или null. */
    find(id) {
        for (const t of SHOP_TABS) {
            const data = this.catalog(t.id).find((e) => e && e.id === id);
            if (data) return { tab: t.id, data };
        }
        return null;
    },

    _rank(rarity) { return Math.max(0, this.RARITY_ORDER.indexOf(rarity)); },

    /** Значение «лесенки» от lo до hi: j-й из m (при m = 1 — точка single между границами), округление step. */
    _ladder(lo, hi, j, m, single) {
        const t = m > 1 ? j / (m - 1) : single;
        const v = lo + (hi - lo) * t;
        const step = v >= 1000 ? 50 : 10;
        return Math.round(v / step) * step;
    },

    /**
     * Предметы всех вкладок для Shop.init (SHOP_ITEMS). Порядок в вкладке: стартовый предмет, затем по
     * редкости (внутри — как в каталоге), в конце эксклюзивы Daily. Цена: { coins } или { ads }.
     */
    items() {
        const share = (typeof SHOP_COINS_SHARE !== 'undefined' ? SHOP_COINS_SHARE : 35) / 100;
        const out = [];
        SHOP_TABS.forEach((tab, ti) => {
            const list = this.catalog(tab.id).filter((e) => e && e.id);
            if (!list.length) return;
            // Стартовый предмет: из DEFAULTS; если его нет в каталоге — первый не-эксклюзив (вкладки со стартовым предметом).
            let defId = this.DEFAULTS[tab.id] || '';
            if (defId && !list.some((e) => e.id === defId)) {
                const first = list.find((e) => !e.exclusive);
                defId = first ? first.id : '';
            }
            const mk = (e, extra) => {
                const it = {
                    id: e.id, tab: tab.id, slot: tab.slot,
                    name: { ru: (e.name && e.name.ru) || e.id, en: (e.name && e.name.en) || (e.name && e.name.ru) || e.id },
                    rarity: this.RARITY_ORDER.indexOf(e.rarity) >= 0 ? e.rarity : 'common',
                    ...extra,
                };
                if (e.icon) it.icon = e.icon;
                return it;
            };
            const priced = list
                .map((e, i) => ({ e, i }))
                .filter((x) => x.e.id !== defId && !x.e.exclusive)
                .sort((a, b) => this._rank(a.e.rarity) - this._rank(b.e.rarity) || a.i - b.i)
                .map((x) => x.e);
            const n = priced.length;
            const c = Math.round(n * share);
            const k = n ? c / n : 0;
            // Фаза: первый (самый дешёвый) предмет — всегда за монеты; у каждой вкладки свой сдвиг узора.
            const ph = n ? (1 - k) + ((ti * 0.37) % 1) * 0.9 * k : 0;
            const isCoin = priced.map((_, i) => Math.floor((i + 1) * k + ph) - Math.floor(i * k + ph) >= 1);
            // «Лесенки» цен — отдельно для монет и рекламы, внутри каждой редкости.
            const groups = { coins: {}, ads: {} };
            priced.forEach((e, i) => {
                const g = groups[isCoin[i] ? 'coins' : 'ads'];
                const r = this.RARITY_ORDER.indexOf(e.rarity) >= 0 ? e.rarity : 'common';
                (g[r] = g[r] || []).push(e.id);
            });
            const priceOf = (e, i) => {
                const r = this.RARITY_ORDER.indexOf(e.rarity) >= 0 ? e.rarity : 'common';
                const band = this.RARITY_BANDS[r];
                const kind = isCoin[i] ? 'coins' : 'ads';
                const ids = groups[kind][r];
                const j = ids.indexOf(e.id);
                if (kind === 'coins') return { coins: this._ladder(band.coins[0], band.coins[1], j, ids.length, r === 'common' ? 0 : 0.25 + ((ti * 0.37) % 1) * 0.5) };
                const t = ids.length > 1 ? j / (ids.length - 1) : 0;
                return { ads: Math.max(1, Math.min(5, Math.round(band.ads[0] + (band.ads[1] - band.ads[0]) * t))) };
            };
            const def = list.find((e) => e.id === defId);
            if (def) out.push(mk(def, { default: true }));
            priced.forEach((e, i) => out.push(mk(e, { price: priceOf(e, i) })));
            for (const e of list) if (e.exclusive) out.push(mk(e, { exclusive: e.exclusive }));
        });
        return out;
    },
};
