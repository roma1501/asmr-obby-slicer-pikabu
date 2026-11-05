// GameData.js — данные Paint Blade: типы врагов, уровни, скины, палитры краски, следы клинка,
// эффекты победы, лица. Числа баланса, которые крутят в редакторе, — Constants.js (PB_*);
// здесь таблицы, которые описывают содержимое. Модели мечей/шапок/деталей — GameModels*.js.

/** @typedef {{ skin: string, shirt: string, pants: string, waist?: string, armsUpper?: string, armsLower?: string,
 *              legsUpper?: string, legsLower?: string, head?: string, face: string, details?: string[], glow?: string }} PbLook */

/** @satisfies {Record<string, any>} */
const GameData = {
    // --- Враги -------------------------------------------------------------------------
    // hp — ударов до смерти; speed/damage — множители PB_ENEMY_*; scale — рост; cut — шанс отрубить часть при
    // не смертельном ударе; coins — множитель награды; rate — множитель паузы между ударами.
    // ai — особая механика (GameEnemies.js); skin — постоянный вид типа (узнаётся с первого взгляда);
    // sword: false — без меча (метатель, бомбер). name — для подсказки при первой встрече.
    ENEMIES: {
        noob:     { hp: 2, speed: 1.0, damage: 1.0, scale: 1.0, cut: 1, coins: 1, rate: 1.0 },
        fighter:  { hp: 3, speed: 1.12, damage: 1.15, scale: 1.0, cut: 1, coins: 1.5, rate: 0.85 },
        speedy:   { hp: 1, speed: 1.55, damage: 0.7, scale: 0.82, cut: 1, coins: 1, rate: 0.75 },
        brute:    { hp: 5, speed: 0.78, damage: 1.9, scale: 1.32, cut: 0.7, coins: 2.5, rate: 1.3 },
        dasher:   { hp: 3, speed: 1.0, damage: 1.6, scale: 1.0, cut: 1, coins: 2, rate: 1.0, ai: 'dasher', skin: 'skin_athlete',
            name: { ru: 'Рывун: целится и делает рывок — отойди с линии!', en: 'Dasher: aims, then charges — step off the line!' } },
        shield:   { hp: 4, speed: 0.9, damage: 1.2, scale: 1.08, cut: 1, coins: 2.5, rate: 1.1, ai: 'shield', skin: 'skin_knight',
            name: { ru: 'Щитоносец: щит держит удары спереди — заходи сбоку или сзади', en: 'Shieldbearer: blocks from the front — strike from the side or back' } },
        thrower:  { hp: 2, speed: 0.95, damage: 1.4, scale: 0.95, cut: 1, coins: 2, rate: 1.0, ai: 'thrower', skin: 'skin_chef', sword: false,
            name: { ru: 'Метатель: кидает бомбы краски — уходи из кругов', en: 'Thrower: lobs paint bombs — leave the circles' } },
        jumper:   { hp: 3, speed: 1.05, damage: 1.5, scale: 0.95, cut: 1, coins: 2, rate: 1.0, ai: 'jumper', skin: 'skin_frost',
            name: { ru: 'Прыгун: прыгает сверху — следи за кругом на земле', en: 'Jumper: leaps on you — watch the ground circle' } },
        bomber:   { hp: 1, speed: 1.3, damage: 2.4, scale: 0.92, cut: 1, coins: 2, rate: 1.0, ai: 'bomber', skin: 'skin_punk', sword: false,
            name: { ru: 'Бомбер: взрывается рядом — руби издалека или убегай. Взрыв ранит и врагов!', en: 'Bomber: explodes up close — and hurts other enemies too!' } },
        healer:   { hp: 3, speed: 1.0, damage: 0.8, scale: 1.0, cut: 1, coins: 3, rate: 1.2, ai: 'healer', skin: 'skin_doctor',
            name: { ru: 'Лекарь: лечит врагов — руби его первым', en: 'Healer: heals enemies — take him out first' } },
        splitter: { hp: 4, speed: 0.95, damage: 1.2, scale: 1.15, cut: 1, coins: 2, rate: 1.0, ai: 'splitter', skin: 'skin_candy',
            name: { ru: 'Делитель: павший делится на двух малышей', en: 'Splitter: splits into two minis when defeated' } },
        mini:     { hp: 1, speed: 1.6, damage: 0.6, scale: 0.6, cut: 1, coins: 1, rate: 0.7, skin: 'skin_candy' },
        boss:     { hp: 12, speed: 0.85, damage: 2.4, scale: 1.85, cut: 0.4, coins: 8, rate: 1.2 },
    },

    // Боссы — по главам по кругу, у каждого свои механики (GameEnemies.js).
    BOSSES: [
        { id: 'giant', name: { ru: 'Великан Громила', en: 'Giant Smasher' }, skin: 'skin_viking', hat: 'viking', scale: 2.15, hp: 14, speed: 0.75, damage: 2.6,
            mech: ['slam'], tip: { ru: 'Удар по земле — выйди из оранжевого круга!', en: 'Ground slam — get out of the orange circle!' } },
        { id: 'paintking', name: { ru: 'Король Краски', en: 'Paint King' }, skin: 'skin_king', hat: 'crown', scale: 1.85, hp: 12, speed: 0.8, damage: 2.2,
            mech: ['barrage', 'summon'], tip: { ru: 'Град бомб краски и слуги — двигайся!', en: 'Paint bomb barrages and minions — keep moving!' } },
        { id: 'ninja', name: { ru: 'Теневой Ниндзя', en: 'Shadow Ninja' }, skin: 'skin_ninja', hat: 'ninja', scale: 1.5, hp: 11, speed: 1.45, damage: 2.0,
            mech: ['dashchain'], tip: { ru: 'Три рывка подряд — уклоняйся вбок', en: 'Three dashes in a row — dodge sideways' } },
        { id: 'knight', name: { ru: 'Железный Рыцарь', en: 'Iron Knight' }, skin: 'skin_knight', hat: 'knight', scale: 1.95, hp: 15, speed: 0.8, damage: 2.8,
            mech: ['shield', 'charge'], tip: { ru: 'Щит спереди и таран — бей со спины', en: 'Front shield and a charge — hit him from behind' } },
        { id: 'bombbaron', name: { ru: 'Бомбо-Барон', en: 'Bomb Baron' }, skin: 'skin_robot', hat: 'astronaut', scale: 1.85, hp: 13, speed: 0.85, damage: 2.4,
            mech: ['bombs', 'slam'], tip: { ru: 'Выпускает бомберов — их взрыв ранит и босса!', en: 'Releases bombers — their blasts hurt the boss too!' } },
    ],
    boss(chapter) {
        const i = (Math.max(1, chapter) - 1) % this.BOSSES.length, cycle = Math.floor((Math.max(1, chapter) - 1) / this.BOSSES.length);
        return Object.assign({}, this.BOSSES[i], { hp: this.BOSSES[i].hp + cycle * 5, cycle });
    },

    // Уровень n (1, 2, …): карта по кругу, состав врагов, сундук на 5-м уровне главы.
    level(n) {
        const maps = typeof GAME_MAPS !== 'undefined' ? GAME_MAPS : [];
        const stage = ((n - 1) % 5) + 1, chapter = Math.ceil(n / 5);
        const map = maps.length ? maps[(n - 1) % maps.length] : null;
        const list = [];
        const add = (type, k) => { for (let i = 0; i < k; i++) list.push(type); };
        const base = Math.min(9, 2 + Math.floor(n * 0.55));
        if (n === 1) { add('noob', 2); }
        else if (n === 2) { add('noob', 3); }
        else {
            let rest = base;
            // новые типы открываются по уровням; у каждого уровня — 1–2 «особых» врага
            const unlock = [[3, 'fighter'], [4, 'speedy'], [6, 'brute'], [6, 'thrower'], [7, 'dasher'], [8, 'shield'],
                [9, 'bomber'], [11, 'jumper'], [12, 'healer'], [13, 'splitter']];
            const open = unlock.filter(u => n >= u[0]).map(u => u[1]);
            const special = open.filter(t => GameData.ENEMIES[t].ai);
            const pick = () => {
                const r = GameData._rand(n * 97 + rest * 13);
                if (special.length && r < Math.min(0.45, 0.12 + n * 0.015)) return special[Math.floor(GameData._rand(n * 31 + rest * 7) * special.length)];
                const basic = open.filter(t => !GameData.ENEMIES[t].ai);
                if (basic.length && r < 0.8) return basic[Math.floor(GameData._rand(n * 53 + rest * 11) * basic.length)];
                return 'noob';
            };
            while (rest-- > 0) list.push(pick());
            // самый новый тип — хотя бы один на уровне, где он открылся
            const fresh = unlock.filter(u => u[0] === n).map(u => u[1]);
            fresh.forEach((t, i) => { if (!list.includes(t)) list[i % list.length] = t; });
        }
        const boss = stage === 5;
        if (boss) { list.length = Math.min(list.length, 3 + Math.min(3, chapter)); list.push('boss'); }
        return {
            n, stage, chapter, boss, chest: stage === 5,
            mapId: map ? map.id : '',
            enemies: list,
            hpBonus: Math.floor((chapter - 1) / 2),          // +1 удар живучести каждые 2 главы
        };
    },

    _rand(seed) {
        let h = Math.imul(seed | 0, 2654435761) >>> 0;
        h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
        return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
    },

    // --- Лица (рисуются на текстуре пластины Face) ----------------------------------------
    FACES: ['smile', 'grin', 'cool', 'happy', 'wink', 'cute', 'surprised', 'robot', 'ninja', 'zombie', 'angry', 'mad', 'evil', 'king'],
    ENEMY_FACES: ['angry', 'mad', 'evil', 'grin'],

    // --- Скины ---------------------------------------------------------------------------
    // Скин = цвета частей R6 + лицо + детали (GAME_DETAILS по ключевому слову id). price/ads — для магазина.
    /** @type {Array<{ id: string, name: { ru: string, en: string }, rarity: string, look: PbLook, exclusive?: string }>} */
    SKINS: [
        // Стандартный скин — свой «Маляр»: персиковая кожа, ярко-розовая футболка, фиолетовые штаны, жёлтый пояс
        // (не жёлто-сине-зелёный «нуб» и не бирюзово-синий кубический шахтёр).
        { id: 'skin_noob', name: { ru: 'Маляр', en: 'Painter' }, rarity: 'common', look: { skin: '#ffcfa6', shirt: '#ff4f8b', pants: '#5b2ea6', waist: '#ffd23f', legsLower: '#3d1f73', face: 'smile' } },
        { id: 'skin_shadow', name: { ru: 'Тень', en: 'Shadow' }, rarity: 'common', look: { skin: '#d8d8d8', shirt: '#2b2b30', pants: '#595e66', face: 'cool' } },
        { id: 'skin_ninja', name: { ru: 'Ниндзя', en: 'Ninja' }, rarity: 'rare', look: { skin: '#e8c39e', shirt: '#1d1f26', pants: '#1d1f26', armsLower: '#1d1f26', face: 'ninja', details: ['bandana'] } },
        { id: 'skin_knight', name: { ru: 'Рыцарь', en: 'Knight' }, rarity: 'epic', look: { skin: '#f0c8a0', shirt: '#9aa4ad', pants: '#6b737b', armsLower: '#9aa4ad', face: 'smile', details: ['armor', 'shoulder'] } },
        { id: 'skin_pirate', name: { ru: 'Пират', en: 'Pirate' }, rarity: 'rare', look: { skin: '#f0c08a', shirt: '#f2efe6', pants: '#2c2a33', waist: '#7a3dd6', face: 'grin', details: ['belt'] } },
        { id: 'skin_robot', name: { ru: 'Робот', en: 'Robot' }, rarity: 'epic', look: { skin: '#b8c2cc', shirt: '#7d8a96', pants: '#55606b', armsLower: '#b8c2cc', face: 'robot', details: ['jetpack'] } },
        { id: 'skin_zombie', name: { ru: 'Зомби', en: 'Zombie' }, rarity: 'rare', look: { skin: '#7fbf5a', shirt: '#3d6e9e', pants: '#6e4b2e', armsLower: '#7fbf5a', face: 'zombie' } },
        { id: 'skin_astro', name: { ru: 'Космонавт', en: 'Astronaut' }, rarity: 'epic', look: { skin: '#f2f2f2', shirt: '#f2f2f2', pants: '#e2e6ea', waist: '#ff8a1f', face: 'cool', details: ['jetpack'] } },
        { id: 'skin_hero', name: { ru: 'Супергерой', en: 'Superhero' }, rarity: 'rare', look: { skin: '#f3c99d', shirt: '#2457d6', pants: '#2457d6', waist: '#e8c21f', legsLower: '#e8c21f', face: 'happy', details: ['cape'] } },
        { id: 'skin_police', name: { ru: 'Полицейский', en: 'Cop' }, rarity: 'common', look: { skin: '#e9b98f', shirt: '#24345c', pants: '#1a1a22', face: 'smile', details: ['tie'] } },
        { id: 'skin_doctor', name: { ru: 'Доктор', en: 'Doctor' }, rarity: 'common', look: { skin: '#f6d2b0', shirt: '#f7fbff', pants: '#7fc7e8', face: 'happy' } },
        { id: 'skin_farmer', name: { ru: 'Фермер', en: 'Farmer' }, rarity: 'common', look: { skin: '#f0c08a', shirt: '#e8822a', pants: '#3e6fb0', waist: '#3e6fb0', face: 'grin' } },
        { id: 'skin_chef', name: { ru: 'Повар', en: 'Chef' }, rarity: 'common', look: { skin: '#f3c99d', shirt: '#ffffff', pants: '#2b2b30', face: 'happy', details: ['scarf'] } },
        { id: 'skin_king', name: { ru: 'Король', en: 'King' }, rarity: 'legendary', look: { skin: '#f3c99d', shirt: '#6a2fb5', pants: '#3a1a6e', waist: '#f2c21f', face: 'king', details: ['cape', 'belt'] } },
        { id: 'skin_viking', name: { ru: 'Викинг', en: 'Viking' }, rarity: 'rare', look: { skin: '#f0c08a', shirt: '#7a5232', pants: '#4e3a26', armsLower: '#f0c08a', face: 'grin', details: ['belt', 'armor'] } },
        { id: 'skin_archer', name: { ru: 'Лучник', en: 'Archer' }, rarity: 'rare', look: { skin: '#f3c99d', shirt: '#3d8b3d', pants: '#6b4a2b', face: 'smile', details: ['quiver'] } },
        { id: 'skin_boss', name: { ru: 'Офисный босс', en: 'Office Boss' }, rarity: 'common', look: { skin: '#e9b98f', shirt: '#55595f', pants: '#3a3d42', armsLower: '#55595f', face: 'cool', details: ['tie', 'vest'] } },
        { id: 'skin_punk', name: { ru: 'Панк', en: 'Punk' }, rarity: 'rare', look: { skin: '#f6d2b0', shirt: '#151519', pants: '#c2185b', face: 'grin', details: ['vest'] } },
        { id: 'skin_angel', name: { ru: 'Ангел', en: 'Angel' }, rarity: 'epic', look: { skin: '#fbe3cc', shirt: '#ffffff', pants: '#f3f0ff', face: 'cute', details: ['wings'], glow: '#fff3b0' } },
        { id: 'skin_demon', name: { ru: 'Демон', en: 'Demon' }, rarity: 'epic', look: { skin: '#8e44d9', shirt: '#1b1014', pants: '#1b1014', face: 'evil', details: ['wings'] } },
        { id: 'skin_explorer', name: { ru: 'Путешественник', en: 'Explorer' }, rarity: 'common', look: { skin: '#f0c08a', shirt: '#c9a86a', pants: '#8b6d3f', face: 'happy', details: ['backpack'] } },
        { id: 'skin_athlete', name: { ru: 'Спортсмен', en: 'Athlete' }, rarity: 'common', look: { skin: '#e9b98f', shirt: '#ff8a1f', pants: '#fafafa', legsLower: '#e9b98f', armsLower: '#e9b98f', face: 'grin' } },
        { id: 'skin_frost', name: { ru: 'Морозный', en: 'Frosty' }, rarity: 'rare', look: { skin: '#bfe7ff', shirt: '#ffffff', pants: '#8fcfff', face: 'cute', details: ['scarf'] } },
        { id: 'skin_candy', name: { ru: 'Конфетка', en: 'Candy' }, rarity: 'rare', look: { skin: '#ffd6e8', shirt: '#ff5fa2', pants: '#ffffff', waist: '#7fd8ff', face: 'cute' } },
        { id: 'skin_gold', name: { ru: 'Золотой', en: 'Golden' }, rarity: 'legendary', look: { skin: '#ffcf33', shirt: '#e8b21c', pants: '#c99512', face: 'cool', glow: '#ffe680' } },
        // Эксклюзивы 7-го дня Daily Gift (нет в магазине и на колесе)
        { id: 'skin_rainbow', exclusive: 'daily', name: { ru: 'Радужный', en: 'Rainbow' }, rarity: 'legendary', look: { skin: '#ffd23f', shirt: '#ff3d7f', pants: '#3dc1ff', waist: '#7cff6b', armsUpper: '#ff8a1f', armsLower: '#ffd23f', legsLower: '#a15cff', face: 'happy', details: ['wings'] } },
        { id: 'skin_galaxy', exclusive: 'daily', name: { ru: 'Галактика', en: 'Galaxy' }, rarity: 'legendary', look: { skin: '#3a2a7a', shirt: '#1d1640', pants: '#2b1f5c', armsLower: '#5a3fd0', face: 'cool', details: ['cape'], glow: '#9f7bff' } },
        { id: 'skin_diamond', exclusive: 'daily', name: { ru: 'Алмазный', en: 'Diamond' }, rarity: 'legendary', look: { skin: '#9ff3ff', shirt: '#5fd8f0', pants: '#3cb8d8', face: 'king', details: ['armor', 'shoulder'], glow: '#c8fbff' } },
    ],

    // --- Краска врагов (вкладка «Краска») --------------------------------------------------
    // colors — из чего выбирается цвет каждого врага; glow — светится; sparkle — блёстки на брызгах;
    // perDrop — каждая капля своего цвета (радуга).
    /** @type {Array<{ id: string, name: { ru: string, en: string }, rarity: string, colors: string[], glow?: boolean, sparkle?: boolean, perDrop?: boolean }>} */
    PAINTS: [
        { id: 'paint_classic', name: { ru: 'Яркая', en: 'Bright' }, rarity: 'common', colors: ['#ffd400', '#ff3d9a', '#2f80ff', '#22c55e', '#ff7a00', '#c026d3'] },
        { id: 'paint_lemon', name: { ru: 'Лимонная', en: 'Lemon' }, rarity: 'common', colors: ['#ffe600', '#fff04d', '#ffd000'] },
        { id: 'paint_cherry', name: { ru: 'Малиновая', en: 'Raspberry' }, rarity: 'common', colors: ['#ff3d9a', '#ff7ac2', '#e0179a'] },
        { id: 'paint_ocean', name: { ru: 'Океан', en: 'Ocean' }, rarity: 'common', colors: ['#0077ff', '#00b4ff', '#1f4fff'] },
        { id: 'paint_slime', name: { ru: 'Слизь', en: 'Slime' }, rarity: 'common', colors: ['#7dff3a', '#3dff7a', '#b6ff00'] },
        { id: 'paint_grape', name: { ru: 'Виноградная', en: 'Grape' }, rarity: 'common', colors: ['#8b2bff', '#b04dff', '#6a00d4'] },
        { id: 'paint_orange', name: { ru: 'Апельсин', en: 'Orange' }, rarity: 'common', colors: ['#ff8a00', '#ffa31a', '#ff6a00'] },
        { id: 'paint_pastel', name: { ru: 'Пастель', en: 'Pastel' }, rarity: 'rare', colors: ['#ffb3d1', '#b3e5ff', '#c8ffb3', '#fff1a8', '#d9c2ff'] },
        { id: 'paint_candy', name: { ru: 'Сахарная', en: 'Candy' }, rarity: 'rare', colors: ['#ff4fa3', '#ff8fd0', '#ffffff'], sparkle: true },
        { id: 'paint_mint', name: { ru: 'Мятная', en: 'Mint' }, rarity: 'rare', colors: ['#3dffc5', '#9affe0', '#00d9a0'] },
        { id: 'paint_sunset', name: { ru: 'Закат', en: 'Sunset' }, rarity: 'rare', colors: ['#ff8a3d', '#ff4fa3', '#ffc23a'] },
        { id: 'paint_milk', name: { ru: 'Молочная', en: 'Milky' }, rarity: 'rare', colors: ['#ffffff', '#f4f1ea'] },
        { id: 'paint_ink', name: { ru: 'Чернила', en: 'Ink' }, rarity: 'rare', colors: ['#1a1a2e', '#2d1b4e', '#0f0f14'] },
        { id: 'paint_chocolate', name: { ru: 'Шоколад', en: 'Chocolate' }, rarity: 'rare', colors: ['#6b3a1f', '#8a4b26', '#4a2612'] },
        { id: 'paint_neon', name: { ru: 'Неон', en: 'Neon' }, rarity: 'epic', colors: ['#39ff14', '#ff8a00', '#00f0ff', '#fffb00', '#ff00e6'], glow: true },
        { id: 'paint_toxic', name: { ru: 'Токсичная', en: 'Toxic' }, rarity: 'epic', colors: ['#a6ff00', '#d4ff3d'], glow: true },
        { id: 'paint_lava', name: { ru: 'Лава', en: 'Lava' }, rarity: 'epic', colors: ['#ff6a00', '#ff9a1a', '#ffd000'], glow: true },
        { id: 'paint_glitter', name: { ru: 'Блёстки', en: 'Glitter' }, rarity: 'epic', colors: ['#ffd700', '#ff69b4', '#40e0d0'], sparkle: true },
        { id: 'paint_gold', name: { ru: 'Золото', en: 'Gold' }, rarity: 'legendary', colors: ['#ffcf33', '#ffb300', '#ffe680'], sparkle: true, glow: true },
        { id: 'paint_rainbow', name: { ru: 'Радуга', en: 'Rainbow' }, rarity: 'legendary', colors: ['#ff4fa3', '#ff8a00', '#ffe600', '#22e55e', '#00b4ff', '#3d3dff', '#b000ff'], perDrop: true },
    ],

    // --- Следы клинка (вкладка «Следы») ----------------------------------------------------
    // from/to — цвет ленты у меча и на хвосте; width — ширина, px; fx — частицы на взмахе (spark | star | smoke | soft | null).
    /** @type {Array<{ id: string, name: { ru: string, en: string }, rarity: string, from: string, to: string, width: number, fx?: string | null, glow?: boolean, rainbow?: boolean }>} */
    TRAILS: [
        { id: 'trail_white', name: { ru: 'Свист', en: 'Swish' }, rarity: 'common', from: '#ffffff', to: '#bfe6ff', width: 26 },
        { id: 'trail_sky', name: { ru: 'Небо', en: 'Sky' }, rarity: 'common', from: '#8fd8ff', to: '#2f80ff', width: 30 },
        { id: 'trail_leaf', name: { ru: 'Листва', en: 'Leaf' }, rarity: 'common', from: '#b6ff6b', to: '#1fae4b', width: 30 },
        { id: 'trail_rose', name: { ru: 'Роза', en: 'Rose' }, rarity: 'common', from: '#ffc2dc', to: '#ff3d8b', width: 30 },
        { id: 'trail_sun', name: { ru: 'Солнце', en: 'Sun' }, rarity: 'common', from: '#fff3a0', to: '#ffb000', width: 32 },
        { id: 'trail_wide', name: { ru: 'Широкий', en: 'Wide' }, rarity: 'common', from: '#ffffff', to: '#9aa4ff', width: 52 },
        { id: 'trail_thin', name: { ru: 'Тонкий', en: 'Thin' }, rarity: 'common', from: '#e8f6ff', to: '#5ad1ff', width: 14 },
        { id: 'trail_sparks', name: { ru: 'Искры', en: 'Sparks' }, rarity: 'rare', from: '#ffe08a', to: '#ff7a00', width: 28, fx: 'spark' },
        { id: 'trail_stars', name: { ru: 'Звёзды', en: 'Stars' }, rarity: 'rare', from: '#fff6c2', to: '#ffd000', width: 30, fx: 'star' },
        { id: 'trail_smoke', name: { ru: 'Дымок', en: 'Smoke' }, rarity: 'rare', from: '#d8d8d8', to: '#5a5a66', width: 40, fx: 'smoke' },
        { id: 'trail_ice', name: { ru: 'Лёд', en: 'Ice' }, rarity: 'rare', from: '#ffffff', to: '#66e0ff', width: 34, fx: 'soft', glow: true },
        { id: 'trail_poison', name: { ru: 'Яд', en: 'Poison' }, rarity: 'rare', from: '#d4ff3d', to: '#2e9e00', width: 34, fx: 'soft', glow: true },
        { id: 'trail_blood_moon', name: { ru: 'Луна', en: 'Moon' }, rarity: 'rare', from: '#f1ebff', to: '#7a4dff', width: 34 },
        { id: 'trail_fire', name: { ru: 'Огонь', en: 'Fire' }, rarity: 'epic', from: '#fff3a0', to: '#ff6a00', width: 40, fx: 'spark', glow: true },
        { id: 'trail_magic', name: { ru: 'Магия', en: 'Magic' }, rarity: 'epic', from: '#f0c2ff', to: '#7a2bff', width: 38, fx: 'star', glow: true },
        { id: 'trail_electric', name: { ru: 'Молния', en: 'Lightning' }, rarity: 'epic', from: '#ffffff', to: '#00e5ff', width: 24, fx: 'spark', glow: true },
        { id: 'trail_shadow', name: { ru: 'Тьма', en: 'Darkness' }, rarity: 'epic', from: '#5a3a8a', to: '#0a0a12', width: 44, fx: 'smoke' },
        { id: 'trail_gold', name: { ru: 'Золотой', en: 'Golden' }, rarity: 'legendary', from: '#fff6c2', to: '#ffb300', width: 42, fx: 'star', glow: true },
        { id: 'trail_rainbow', name: { ru: 'Радуга', en: 'Rainbow' }, rarity: 'legendary', from: '#ff4fa3', to: '#b000ff', width: 44, fx: 'star', rainbow: true, glow: true },
        { id: 'trail_galaxy', name: { ru: 'Галактика', en: 'Galaxy' }, rarity: 'legendary', from: '#ff9bf5', to: '#2b1aff', width: 46, fx: 'star', glow: true },
    ],

    // --- Победа (вкладка «Победа») -------------------------------------------------------
    // dance — клип победы; fx — салют: confetti | fireworks | paintRain | stars | coins | hearts | bubbles | sparkles.
    /** @type {Array<{ id: string, name: { ru: string, en: string }, rarity: string, dance: string, fx: string, colors?: string[] }>} */
    VICTORIES: [
        { id: 'win_cheer', name: { ru: 'Ура!', en: 'Hooray!' }, rarity: 'common', dance: 'dance_1', fx: 'confetti' },
        { id: 'win_floss', name: { ru: 'Флосс', en: 'Floss' }, rarity: 'common', dance: 'dance_2', fx: 'confetti' },
        { id: 'win_spin', name: { ru: 'Карусель', en: 'Spinner' }, rarity: 'common', dance: 'dance_3', fx: 'confetti' },
        { id: 'win_robot', name: { ru: 'Робот', en: 'Robot' }, rarity: 'common', dance: 'dance_4', fx: 'confetti' },
        { id: 'win_paint_rain', name: { ru: 'Красочный дождь', en: 'Paint Rain' }, rarity: 'common', dance: 'dance_1', fx: 'paintRain' },
        { id: 'win_stars', name: { ru: 'Звездопад', en: 'Starfall' }, rarity: 'common', dance: 'dance_3', fx: 'stars' },
        { id: 'win_bubbles', name: { ru: 'Пузыри', en: 'Bubbles' }, rarity: 'common', dance: 'dance_2', fx: 'bubbles' },
        { id: 'win_hearts', name: { ru: 'Сердечки', en: 'Hearts' }, rarity: 'rare', dance: 'dance_1', fx: 'hearts' },
        { id: 'win_coins', name: { ru: 'Монетки', en: 'Coin Shower' }, rarity: 'rare', dance: 'dance_4', fx: 'coins' },
        { id: 'win_fireworks', name: { ru: 'Салют', en: 'Fireworks' }, rarity: 'rare', dance: 'dance_3', fx: 'fireworks' },
        { id: 'win_sparkles', name: { ru: 'Блеск', en: 'Sparkle' }, rarity: 'rare', dance: 'dance_2', fx: 'sparkles' },
        { id: 'win_robot_paint', name: { ru: 'Робо-краска', en: 'Robo Paint' }, rarity: 'rare', dance: 'dance_4', fx: 'paintRain' },
        { id: 'win_floss_stars', name: { ru: 'Звёздный флосс', en: 'Star Floss' }, rarity: 'rare', dance: 'dance_2', fx: 'stars' },
        { id: 'win_cheer_fire', name: { ru: 'Праздник', en: 'Party' }, rarity: 'epic', dance: 'dance_1', fx: 'fireworks' },
        { id: 'win_spin_coins', name: { ru: 'Богач', en: 'Rich Spin' }, rarity: 'epic', dance: 'dance_3', fx: 'coins' },
        { id: 'win_hearts_floss', name: { ru: 'Любовь', en: 'Love' }, rarity: 'epic', dance: 'dance_2', fx: 'hearts' },
        { id: 'win_neon', name: { ru: 'Неон', en: 'Neon' }, rarity: 'epic', dance: 'dance_4', fx: 'sparkles', colors: ['#39ff14', '#ff00e6', '#00f0ff'] },
        { id: 'win_gold', name: { ru: 'Чемпион', en: 'Champion' }, rarity: 'legendary', dance: 'dance_3', fx: 'fireworks', colors: ['#ffd700', '#fff3a0', '#ffb300'] },
        { id: 'win_rainbow', name: { ru: 'Радуга', en: 'Rainbow' }, rarity: 'legendary', dance: 'dance_1', fx: 'paintRain', colors: ['#ff4fa3', '#ff8a00', '#ffe600', '#22e55e', '#00b4ff', '#b000ff'] },
        { id: 'win_galaxy', name: { ru: 'Космос', en: 'Cosmos' }, rarity: 'legendary', dance: 'dance_2', fx: 'stars', colors: ['#ff9bf5', '#9f7bff', '#5ad1ff'] },
    ],

    // Цвета R6 для врагов, если скинов не хватит (классические сочетания).
    ENEMY_SKIN_POOL: ['skin_shadow', 'skin_zombie', 'skin_police', 'skin_farmer', 'skin_athlete', 'skin_punk',
        'skin_explorer', 'skin_doctor', 'skin_chef', 'skin_pirate', 'skin_viking', 'skin_archer', 'skin_boss'],
    BOSS_SKINS: ['skin_knight', 'skin_demon', 'skin_robot', 'skin_viking'],


    // --- Характеристики мечей (по просьбе пользователя мечи различаются в бою) ----------------------
    // dmg — урон удара (враг: noob 2, fighter 3…), speed — множитель ПАУЗЫ между ударами (меньше — быстрее),
    // reach — дальность, arc — ширина взмаха, knock — отброс. ability — особое свойство (редкие — пассивное,
    // эпические и легендарные — способность с эффектом и аурой на клинке, см. GameFighters).
    SWORD_STATS: {
        sword_basic:    { dmg: 1.0, speed: 1.0, reach: 1.0, arc: 1.0, knock: 1.0 },
        sword_katana:   { dmg: 1.0, speed: 0.78, reach: 1.0, arc: 0.95, knock: 0.9 },
        sword_saber:    { dmg: 1.1, speed: 0.9, reach: 0.95, arc: 1.05, knock: 1.0 },
        sword_cleaver:  { dmg: 1.6, speed: 1.25, reach: 0.82, arc: 1.0, knock: 1.3 },
        sword_rapier:   { dmg: 0.9, speed: 0.8, reach: 1.22, arc: 0.8, knock: 0.8 },
        sword_machete:  { dmg: 1.2, speed: 0.95, reach: 0.9, arc: 1.05, knock: 1.0 },
        sword_cutlass:  { dmg: 1.1, speed: 0.85, reach: 0.95, arc: 1.1, knock: 1.0 },
        sword_claymore: { dmg: 1.8, speed: 1.35, reach: 1.3, arc: 1.15, knock: 1.5 },
        sword_sickle:   { dmg: 1.0, speed: 0.9, reach: 0.9, arc: 1.4, knock: 0.9 },
        sword_bat:      { dmg: 1.4, speed: 1.1, reach: 0.9, arc: 1.0, knock: 1.9 },
        sword_jagged:   { dmg: 1.2, speed: 1.0, reach: 1.0, arc: 1.0, knock: 1.0, ability: 'bleed',
            name: { ru: 'Подтёки краски', en: 'Paint Drip' }, desc: { ru: 'Раненый враг 2 с теряет краску и здоровье', en: 'Wounded enemies leak paint and health for 2 s' } },
        sword_bone:     { dmg: 1.3, speed: 1.0, reach: 1.0, arc: 1.0, knock: 1.0, ability: 'lifesteal',
            name: { ru: 'Вампир', en: 'Vampire' }, desc: { ru: 'Каждая победа над врагом лечит 8 здоровья', en: 'Each defeated enemy heals you for 8 HP' } },
        sword_saw:      { dmg: 1.0, speed: 0.75, reach: 0.95, arc: 1.0, knock: 0.8, ability: 'multi',
            name: { ru: 'Двойной рез', en: 'Double Cut' }, desc: { ru: '30% шанс ударить дважды', en: '30% chance to hit twice' } },
        sword_lollipop: { dmg: 1.1, speed: 0.9, reach: 1.0, arc: 1.05, knock: 1.0, ability: 'candy',
            name: { ru: 'Сладкая награда', en: 'Sweet Loot' }, desc: { ru: '+3 монеты за каждого врага', en: '+3 coins for every enemy' } },
        sword_ice:      { dmg: 1.1, speed: 0.95, reach: 1.05, arc: 1.0, knock: 1.0, ability: 'freeze',
            name: { ru: 'Заморозка', en: 'Freeze' }, desc: { ru: 'Удар замедляет врага вдвое на 2 с', en: 'Hits slow enemies by half for 2 s' } },
        sword_fish:     { dmg: 1.0, speed: 0.95, reach: 1.1, arc: 1.05, knock: 2.6, ability: 'slap',
            name: { ru: 'Шлепок', en: 'Slap' }, desc: { ru: 'Огромный отброс и короткое оглушение', en: 'Huge knockback and a short stun' } },
        sword_trident:  { dmg: 1.2, speed: 1.05, reach: 1.35, arc: 0.8, knock: 1.1, ability: 'pierce',
            name: { ru: 'Пронзание', en: 'Pierce' }, desc: { ru: 'Пробивает врагов в линию на большую дальность', en: 'Pierces enemies in a long line' } },
        sword_crystal:  { dmg: 1.4, speed: 0.95, reach: 1.05, arc: 1.0, knock: 1.0, ability: 'crit', aura: '#c48bff',
            name: { ru: 'Кристальный крит', en: 'Crystal Crit' }, desc: { ru: '25% шанс критического удара ×2.5 с взрывом осколков', en: '25% chance of a ×2.5 critical hit with a shard burst' } },
        sword_fire:     { dmg: 1.4, speed: 1.0, reach: 1.05, arc: 1.05, knock: 1.0, ability: 'burn', aura: '#ff7a1f',
            name: { ru: 'Поджог', en: 'Ignite' }, desc: { ru: 'Враги горят 3 с и теряют здоровье', en: 'Enemies burn for 3 s, losing health' } },
        sword_guitar:   { dmg: 1.3, speed: 1.0, reach: 1.0, arc: 1.1, knock: 1.2, ability: 'shockwave', aura: '#ff5fa2',
            name: { ru: 'Рок-волна', en: 'Rock Wave' }, desc: { ru: 'Каждый 3-й удар — звуковая волна по всем врагам рядом', en: 'Every 3rd hit releases a sound wave around you' } },
        sword_pixel:    { dmg: 1.5, speed: 0.9, reach: 1.0, arc: 1.0, knock: 1.0, ability: 'shatter', aura: '#5ad1ff',
            name: { ru: 'Пиксельный распад', en: 'Pixel Shatter' }, desc: { ru: 'Каждый удар что-то отрубает, павшие рассыпаются взрывом', en: 'Every hit chops something off, fallen foes burst apart' } },
        sword_gold:     { dmg: 1.4, speed: 0.95, reach: 1.05, arc: 1.0, knock: 1.0, ability: 'midas', aura: '#ffd23f',
            name: { ru: 'Царь Мидас', en: 'Midas Touch' }, desc: { ru: 'Монеты за врагов ×2 и золотой дождь', en: 'Double coins from enemies and a golden shower' } },
        sword_light:    { dmg: 2.0, speed: 0.8, reach: 1.15, arc: 1.05, knock: 1.1, ability: 'chain', aura: '#3fe8ff',
            name: { ru: 'Цепная молния', en: 'Chain Lightning' }, desc: { ru: 'Удар бьёт молнией ещё двух ближайших врагов', en: 'Hits arc lightning to two more nearby enemies' } },
        sword_rainbow:  { dmg: 2.0, speed: 0.85, reach: 1.2, arc: 1.1, knock: 1.2, ability: 'nova', aura: 'rainbow',
            name: { ru: 'Радужный взрыв', en: 'Rainbow Nova' }, desc: { ru: 'Павший враг взрывается радугой и ранит всех вокруг', en: 'Fallen enemies explode in a rainbow, hurting everyone nearby' } },
    },
    SWORD_STAT_MAX: { dmg: 2.0, speed: 1 / 0.75, reach: 1.35 },

    // Прокачка за монеты: шаг за уровень и цена уровня (растёт), «Вихрь» — легендарный навык.
    UPGRADE_MAX: 10,
    UPGRADES: {
        dmg: { step: 0.12, base: 80 },       // урон +12% за уровень
        hp: { step: 0.12, base: 80 },        // здоровье +12%
        shield: { step: 7, base: 100 },      // щит +7 очков (поглощает урон, восстанавливается)
        speed: { step: 0.04, base: 90 },     // бег +4%, удары чаще на 3%
        reach: { step: 0.06, base: 90 },     // дальность удара +6%
        vamp: { step: 1, base: 110 },        // вампиризм: +1 здоровья за каждый удар
    },
    SPIN_PRICE: 4000,
    upgradePrice(key, level) {
        const u = this.UPGRADES[key];
        return u ? Math.round(u.base * Math.pow(1.48, level) / 10) * 10 : 0;
    },

    swordStats(id) {
        const s = this.SWORD_STATS[id] || this.SWORD_STATS.sword_basic;
        return Object.assign({ dmg: 1, speed: 1, reach: 1, arc: 1, knock: 1, ability: null, name: null, desc: null, aura: null }, s);
    },

    // --- Здоровье скинов: по редкости и характеру скина --------------------------------------------
    SKIN_HP: { common: 1.1, rare: 1.25, epic: 1.4, legendary: 1.55, daily: 1.7 },
    SKIN_SPEED: { skin_ninja: 1.1, skin_athlete: 1.12, skin_hero: 1.06, skin_robot: 0.95, skin_knight: 0.94 },

    skinStats(id) {
        const s = this.SKINS.find(k => k.id === id);
        const hp = !s || id === 'skin_noob' ? 1 : (s.exclusive === 'daily' ? this.SKIN_HP.daily : (this.SKIN_HP[s.rarity] || 1));
        const speed = this.SKIN_SPEED[id] || 1;
        const pct = Math.round((hp - 1) * 100);
        return { hp, speed, label: { ru: (pct ? 'Здоровье +' + pct + '%' : 'Здоровье') + (speed !== 1 ? ', бег ' + (speed > 1 ? '+' : '') + Math.round((speed - 1) * 100) + '%' : ''),
            en: (pct ? 'Health +' + pct + '%' : 'Health') + (speed !== 1 ? ', speed ' + (speed > 1 ? '+' : '') + Math.round((speed - 1) * 100) + '%' : '') } };
    },

    skin(id) { return this.SKINS.find(s => s.id === id) || this.SKINS[0]; },
    paint(id) { return this.PAINTS.find(p => p.id === id) || this.PAINTS[0]; },
    trail(id) { return this.TRAILS.find(t => t.id === id) || this.TRAILS[0]; },
    victory(id) { return this.VICTORIES.find(v => v.id === id) || this.VICTORIES[0]; },
};
