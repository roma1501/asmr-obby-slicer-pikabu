// GameModelsDetails.js — детали скинов (плащ, рюкзак, крылья…): assets/models/details/, иконки assets/ui/icons/details/.
// Формат — docs/DESIGN.md §2. Пишет Blender-агент «мечи и детали»: файл генерирует
// art/blender/details/details.py (правки — там, иначе перезапишутся).
// Модель: origin — голова кости bone (rig.attach(bone, mesh) без смещения), оси модели персонажа.
// Материал `Main` — основной цвет детали (вершины белые: перекрашивается цветом материала целиком),
// `Accent` — фиксированные акценты (цвет в вершинах).
/** @type {Array<{ id: string, model: string, icon: string, bone: string, name: { ru: string, en: string } }>} */
const GAME_DETAILS = [
    { id: 'detail_cape', model: 'assets/models/details/detail_cape.glb', icon: 'assets/ui/icons/details/detail_cape.webp',
      bone: 'Back', name: { ru: 'Плащ', en: 'Cape' } },
    { id: 'detail_backpack', model: 'assets/models/details/detail_backpack.glb', icon: 'assets/ui/icons/details/detail_backpack.webp',
      bone: 'Back', name: { ru: 'Рюкзак', en: 'Backpack' } },
    { id: 'detail_wings', model: 'assets/models/details/detail_wings.glb', icon: 'assets/ui/icons/details/detail_wings.webp',
      bone: 'Back', name: { ru: 'Крылья', en: 'Wings' } },
    { id: 'detail_jetpack', model: 'assets/models/details/detail_jetpack.glb', icon: 'assets/ui/icons/details/detail_jetpack.webp',
      bone: 'Back', name: { ru: 'Реактивный ранец', en: 'Jetpack' } },
    { id: 'detail_shoulder_pads', model: 'assets/models/details/detail_shoulder_pads.glb', icon: 'assets/ui/icons/details/detail_shoulder_pads.webp',
      bone: 'Torso', name: { ru: 'Наплечники', en: 'Shoulder Pads' } },
    { id: 'detail_belt', model: 'assets/models/details/detail_belt.glb', icon: 'assets/ui/icons/details/detail_belt.webp',
      bone: 'Hips', name: { ru: 'Пояс с пряжкой', en: 'Buckle Belt' } },
    { id: 'detail_scarf', model: 'assets/models/details/detail_scarf.glb', icon: 'assets/ui/icons/details/detail_scarf.webp',
      bone: 'Torso', name: { ru: 'Шарф', en: 'Scarf' } },
    { id: 'detail_chest_armor', model: 'assets/models/details/detail_chest_armor.glb', icon: 'assets/ui/icons/details/detail_chest_armor.webp',
      bone: 'Torso', name: { ru: 'Нагрудная броня', en: 'Chest Armor' } },
    { id: 'detail_quiver', model: 'assets/models/details/detail_quiver.glb', icon: 'assets/ui/icons/details/detail_quiver.webp',
      bone: 'Back', name: { ru: 'Колчан', en: 'Quiver' } },
    { id: 'detail_tie', model: 'assets/models/details/detail_tie.glb', icon: 'assets/ui/icons/details/detail_tie.webp',
      bone: 'Torso', name: { ru: 'Галстук', en: 'Necktie' } },
    { id: 'detail_vest', model: 'assets/models/details/detail_vest.glb', icon: 'assets/ui/icons/details/detail_vest.webp',
      bone: 'Torso', name: { ru: 'Жилет', en: 'Vest' } },
    { id: 'detail_bandana', model: 'assets/models/details/detail_bandana.glb', icon: 'assets/ui/icons/details/detail_bandana.webp',
      bone: 'Head', name: { ru: 'Маска-бандана', en: 'Bandana Mask' } },
];
