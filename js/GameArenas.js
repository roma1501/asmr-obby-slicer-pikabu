// GameArenas.js — оформление арен по id карты (js/Maps.js): название и свет (World3D.setLighting).
// Формат — docs/DESIGN.md §3, карты и их маркеры — docs/MAPS.md. Пишет агент карт.
// lighting — переопределения World3D.cfg(): только числа, цвета 0xRRGGBB. Игра применяет
// World3D.setLighting(arena.lighting) при загрузке карты, сбрасывая ключи прошлой арены.
// Свет у всех арен держит сумму sunIntensity + skyIntensity около 1.2–1.27: персонажи и краска
// читаются, земля не выбеливается; настроение — цветом неба, солнца и подсветки снизу.
/** @type {Record<string, { name: { ru: string, en: string }, lighting: Record<string, number>, music?: string }>} */
const GAME_ARENAS = {
    'arena-training': {
        name: { ru: 'Тренировочный зал', en: 'Training Hall' },
        lighting: { sky: 0xd5dde6, fog: 0.00022, sunIntensity: 0.72, sunColor: 0xfff7ee, skyIntensity: 0.55,
                    skyLight: 0xf0f1f4, groundLight: 0xcfd0d2, sunAz: -75, sunEl: 42 },
        music: 'level',
    },
    'arena-meadow': {
        name: { ru: 'Луг', en: 'Meadow' },
        lighting: { sky: 0x92cff2, fog: 0.00028, sunIntensity: 0.82, sunColor: 0xffefcf, skyIntensity: 0.44,
                    skyLight: 0xc9e6ff, groundLight: 0xb9c99a, sunAz: -55, sunEl: 48 },
        music: 'level',
    },
    'arena-ice': {
        name: { ru: 'Льдина', en: 'Ice Floe' },
        lighting: { sky: 0xa9dcf5, fog: 0.0003, sunIntensity: 0.76, sunColor: 0xf4f8ff, skyIntensity: 0.48,
                    skyLight: 0xd8eeff, groundLight: 0xc6dceb, sunAz: -65, sunEl: 42 },
        music: 'level',
    },
    'arena-desert': {
        name: { ru: 'Пустыня', en: 'Desert' },
        lighting: { sky: 0xe8d8b4, fog: 0.0003, sunIntensity: 0.8, sunColor: 0xfff0d2, skyIntensity: 0.38,
                    skyLight: 0xf2e6cc, groundLight: 0xd8bf8e, sunAz: -50, sunEl: 58 },
        music: 'level',
    },
    'arena-lava': {
        name: { ru: 'Вулкан', en: 'Volcano' },
        lighting: { sky: 0x6e4a40, fog: 0.00034, sunIntensity: 0.74, sunColor: 0xffd2a6, skyIntensity: 0.5,
                    skyLight: 0xdcc6bd, groundLight: 0xff8a4a, sunAz: -70, sunEl: 46 },
        music: 'level',
    },
    'arena-castle': {
        name: { ru: 'Двор замка', en: 'Castle Yard' },
        lighting: { sky: 0xa3c9e6, fog: 0.00028, sunIntensity: 0.8, sunColor: 0xffe9c4, skyIntensity: 0.45,
                    skyLight: 0xc9def3, groundLight: 0xc2b8a5, sunAz: -80, sunEl: 48 },
        music: 'level',
    },
    'arena-candy': {
        name: { ru: 'Сладкая страна', en: 'Candy Land' },
        lighting: { sky: 0xffd6ec, fog: 0.00028, sunIntensity: 0.78, sunColor: 0xfff4f8, skyIntensity: 0.48,
                    skyLight: 0xffe6f3, groundLight: 0xe9b7cc, sunAz: -60, sunEl: 52 },
        music: 'level',
    },
    'arena-beach': {
        name: { ru: 'Пляж', en: 'Beach' },
        lighting: { sky: 0x86d2f2, fog: 0.00026, sunIntensity: 0.84, sunColor: 0xfff2d6, skyIntensity: 0.42,
                    skyLight: 0xe8f2ff, groundLight: 0xe2d2a6, sunAz: -50, sunEl: 54 },
        music: 'level',
    },
    'arena-graveyard': {
        name: { ru: 'Кладбище', en: 'Graveyard' },
        lighting: { sky: 0x4f5280, fog: 0.00034, sunIntensity: 0.66, sunColor: 0xffbf94, skyIntensity: 0.6,
                    skyLight: 0xaab3f0, groundLight: 0x5e6856, sunAz: -105, sunEl: 28 },
        music: 'level',
    },
    'arena-snow': {
        name: { ru: 'Зимний лес', en: 'Winter Forest' },
        lighting: { sky: 0xc8ddef, fog: 0.00036, sunIntensity: 0.7, sunColor: 0xfff1dd, skyIntensity: 0.48,
                    skyLight: 0xdbe9ff, groundLight: 0xd3dde9, sunAz: -65, sunEl: 36 },
        music: 'level',
    },
};

// Без красного в мире (не похоже на кровь): лава — оранжевая, грунт тропинок — коричневый.
// Terrain3D красит зоны paint-<тип> при загрузке карты; скрипт игры выполняется раньше первой карты.
Terrain3D.PAINT_COLORS.lava = 0xff8a1a;
Terrain3D.PAINT_COLORS.dirt = 0x8a5a2e;
