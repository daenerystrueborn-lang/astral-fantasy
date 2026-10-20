/* ============================================================
   ASTRAL FANTASY — data tables
   ============================================================ */
const AF = {};

AF.TIPS = [
  'Tip: attack combos — the third strike in a chain hits hardest.',
  'Tip: your class skill costs mana but ignores part of enemy armor.',
  'Tip: dashing has a brief invulnerability window. Use it.',
  'Tip: rooms seal their gate until every foe inside has fallen.',
  'Tip: gems from chests persist between runs. Spend them in the shop.',
  'Tip: potions refill when you clear a floor — hoard them wisely.',
  'Tip: bosses telegraph their attacks with a red glow. Move!'
];

AF.CLASSES = {
  ronin: {
    id:'ronin', name:'Kaito', title:'Ronin', role:'Blade Duelist',
    dir:'assets/heroes/samurai', fw:128, fh:128, cx:0.26, scale:0.76,
    anims:{ idle:'Idle', run:'Run', walk:'Walk', atk:['Attack_1','Attack_2','Attack_3'], cast:null, hurt:'Hurt', dead:'Dead' },
    base:{ hp:150, mp:55, atk:19, def:12, spd:98, crit:0.09 },
    skill:{ name:'Crescent Wave', cost:18, cd:2.4, dmg:2.1, desc:'A sweeping arc of steel that cleaves every foe in front of you for 210% weapon damage.' },
    blurb:'A masterless blade who reads a fight like a scroll. Fast, precise, unforgiving.',
    weapon:'Katana', accent:'#ffd79a'
  },
  kunoichi: {
    id:'kunoichi', name:'Sayo', title:'Kunoichi', role:'Shadow Dancer',
    dir:'assets/heroes/kunoichi', fw:128, fh:128, cx:0.47, scale:0.8,
    anims:{ idle:'Idle', run:'Run', walk:'Walk', atk:['Attack_1','Attack_2'], cast:'Cast', hurt:'Hurt', dead:'Dead' },
    base:{ hp:120, mp:80, atk:16, def:9, spd:124, crit:0.18 },
    skill:{ name:'Shadow Step', cost:22, cd:3, dmg:1.7, desc:'Blink through the shadows and strike twice, leaving bleeding wounds behind.' },
    blurb:'Silk and steel. She ends fights before the enemy knows one began.',
    weapon:'Twin Tanto', accent:'#ff9ad2'
  },
  monk: {
    id:'monk', name:'Ash', title:'Warrior Monk', role:'Iron Fist',
    dir:'assets/heroes/monk', fw:96, fh:96, cx:0.53, scale:0.78,
    anims:{ idle:'Idle', run:'Run', walk:'Walk', atk:['Attack_1','Attack_2'], cast:'Cast', hurt:'Hurt', dead:'Dead' },
    base:{ hp:190, mp:50, atk:17, def:18, spd:86, crit:0.06 },
    skill:{ name:'Gale Spin', cost:16, cd:2.8, dmg:1.5, desc:'Whirl the staff in a full circle, knocking back everything nearby.' },
    blurb:'A quiet mountain of a man. The staff he carries has broken sieges.',
    weapon:'Bo Staff', accent:'#9fe8b0'
  },
  wanderer: {
    id:'wanderer', name:'Yui', title:'Field Wanderer', role:'Trickster',
    dir:'assets/heroes/peasant', fw:96, fh:96, cx:0.46, scale:0.8,
    anims:{ idle:'Idle', run:'Run', walk:'Walk', atk:['Attack_1','Attack_2'], cast:'Shot', hurt:'Hurt', dead:'Dead' },
    base:{ hp:130, mp:70, atk:15, def:10, spd:112, crit:0.12 },
    skill:{ name:'Dart Volley', cost:14, cd:2.2, dmg:1.2, desc:'Hurl a fan of weighted darts that pierce every enemy in a wide cone.' },
    blurb:'A farmer who took up arms when the rifts opened. Surprisingly deadly.',
    weapon:'Weighted Darts', accent:'#ffe08a'
  },
  commander: {
    id:'commander', name:'Rhea', title:'Banner Commander', role:'Vanguard',
    dir:'assets/heroes/commander', fw:128, fh:128, cx:0.47, scale:0.57,
    anims:{ idle:'Idle', run:'Run', walk:'Walk', atk:['Attack_1','Attack_2','Attack_3'], cast:'Protect', hurt:'Hurt', dead:'Dead' },
    base:{ hp:210, mp:60, atk:18, def:22, spd:78, crit:0.05 },
    skill:{ name:'Rallying Banner', cost:20, cd:5, dmg:0, desc:'Plant the banner: restore 28% health and gain a shield that absorbs the next hits.' },
    blurb:'She carried the last banner out of the burning keep. It has never fallen since.',
    weapon:'Great Spear', accent:'#ffb45c'
  },
  archer: {
    id:'archer', name:'Ren', title:'Ashen Archer', role:'Marksman',
    dir:'assets/heroes/archer', fw:128, fh:128, cx:0.5, scale:0.52,
    anims:{ idle:'Idle', run:'Run', walk:'Walk', atk:['Attack_1','Attack_2','Shot'], cast:'Shot', hurt:'Hurt', dead:'Dead' },
    base:{ hp:125, mp:75, atk:20, def:8, spd:106, crit:0.15 },
    skill:{ name:'Rain of Arrows', cost:24, cd:3.4, dmg:1.1, desc:'Loose a volley skyward. Arrows fall across the room, striking every foe.' },
    blurb:'Eyes like a hawk, patience like stone. Nothing survives the third volley.',
    weapon:'Warbow', accent:'#a9d4ff'
  }
};
AF.CLASS_ORDER = ['ronin','kunoichi','monk','wanderer','commander','archer'];

AF.DUNGEONS = [
  {
    id:'forest', name:'Forest Ruins', tier:'Common', tierClass:'',
    lvl:[5,10], floors:3, rooms:[4,5], boss:'warden',
    enemies:['slime','bat','skeleton'],
    art:'assets/dungeons/forest.jpg',
    lootLabel:'Common Loot', lootClass:'',
    desc:'Ancient ruins swallowed by the canopy. Moss-choked halls, sunken shrines and something old that still keeps watch.',
    bossName:'Forest Warden',
    palette:{
      floor:['#4a6250','#55705b','#435a49'], floorAlt:['#3f5546','#4c6653'],
      wall:'#1b2a20', wallTop:'#6d8e6a', wallSide:'#0d1611',
      accent:'#9ff0a6', accent2:'#f6e0a8', fog:'#0b1a10', dust:'#d6f5b6'
    }
  },
  {
    id:'ash', name:'Cave of Ash', tier:'Rare', tierClass:'t2',
    lvl:[10,15], floors:3, rooms:[5,6], boss:'tyrant',
    enemies:['bat','shaman','skeleton'],
    art:'assets/dungeons/ash.jpg',
    lootLabel:'Rare Loot', lootClass:'rare',
    desc:'A collapsed caldera where the stone still bleeds fire. Breath it long enough and you start hearing it speak.',
    bossName:'Cinder Tyrant',
    palette:{
      floor:['#5a4038','#664a3f','#4f382f'], floorAlt:['#573e36','#63463d'],
      wall:'#221615', wallTop:'#8d5340', wallSide:'#120a0a',
      accent:'#ff9455', accent2:'#ffd699', fog:'#1c0a06', dust:'#ffbf7a'
    }
  },
  {
    id:'frost', name:'Frost Cavern', tier:'Epic', tierClass:'t3',
    lvl:[15,20], floors:3, rooms:[5,6], boss:'revenant',
    enemies:['slime','shaman','sentinel'],
    art:'assets/dungeons/frost.jpg',
    lootLabel:'Epic Loot', lootClass:'epic',
    desc:'Glacier halls older than the kingdom. Runes glow under the ice, and the cold remembers every intruder.',
    bossName:'Frost Revenant',
    palette:{
      floor:['#3f5872','#49647f','#385068'], floorAlt:['#3c546d','#465f79'],
      wall:'#16222e', wallTop:'#6f92b8', wallSide:'#0a1119',
      accent:'#9beaff', accent2:'#e4faff', fog:'#08131f', dust:'#d2f6ff'
    }
  },
  {
    id:'lair', name:"Dragon's Lair", tier:'Legendary', tierClass:'t4',
    lvl:[25,99], floors:3, rooms:[5,6], boss:'wyrm',
    enemies:['skeleton','sentinel','shaman'],
    art:'assets/dungeons/lair.jpg',
    lootLabel:'Legendary Loot', lootClass:'legend',
    desc:'The hoard at the bottom of the world. Every coin here was paid for with a kingdom.',
    bossName:'Crimson Wyrm',
    palette:{
      floor:['#5b4638','#675040','#503c31'], floorAlt:['#584335','#644c3d'],
      wall:'#221614', wallTop:'#9a5d46', wallSide:'#120a09',
      accent:'#ffbf6a', accent2:'#ffe3a0', fog:'#190806', dust:'#ffd98a'
    }
  }
];
AF.dungeonById = id => AF.DUNGEONS.find(d => d.id === id);

/* ── items ─────────────────────────────────────────────── */
AF.RARITY = {
  common:{ label:'Common', cls:'common', mult:1 },
  rare:{ label:'Rare', cls:'rare', mult:1.6 },
  epic:{ label:'Epic', cls:'epic', mult:2.4 },
  legend:{ label:'Legendary', cls:'legend', mult:3.4 }
};

AF.ITEMS = {
  sword_iron:   { name:'Iron Sword',      slot:'weapon', rarity:'common', icon:'assets/items/sword_iron.png',   price:320,  stats:{atk:6},  desc:'Standard issue. Heavy, honest, dependable.', flavor:'The smith stamped his mark on the pommel.' },
  sword_ice:    { name:'Frostfang Blade', slot:'weapon', rarity:'epic',   icon:'assets/items/sword_ice.png',    price:2600, stats:{atk:19,crit:0.05}, desc:'Blue fire sleeps along the edge.', flavor:'Pulled from a lake that never thawed.' },
  sword_dark:   { name:'Umbral Greatsword',slot:'weapon', rarity:'legend', icon:'assets/items/sword_dark.png',   price:6400, stats:{atk:32,spd:-4}, desc:'It drinks the light and asks for more.', flavor:'Forged in the rift; one swing hums for hours.' },
  bow_gold:     { name:'Gilded Warbow',   slot:'weapon', rarity:'rare',   icon:'assets/items/bow_gold.png',     price:1500, stats:{atk:13,crit:0.07}, desc:'Draws smooth as silk, hits like a hammer.', flavor:'Every arrow feels lighter than the last.' },
  staff_blue:   { name:'Tideglass Staff', slot:'weapon', rarity:'rare',   icon:'assets/items/staff_blue_crystal.png', price:1650, stats:{atk:11,mp:25}, desc:'The crystal hums when danger is near.', flavor:'Wizards argue about which sea it came from.' },
  shield_royal: { name:'Royal Bulwark',   slot:'shield', rarity:'rare',   icon:'assets/items/shield_royal.png',  price:1400, stats:{def:12,hp:20}, desc:'A kite of gilded oak and stubborn faith.', flavor:'Sworn to a house that no longer exists.' },
  helmet_steel: { name:'Steel Sallet',    slot:'helm',   rarity:'common', icon:'assets/items/helmet_steel.png',  price:420,  stats:{def:5},  desc:'Keeps the rain and most swords out.', flavor:'Dented in three places; all three are stories.' },
  armor_red:    { name:'Crimson Cuirass', slot:'armor',  rarity:'epic',   icon:'assets/items/armor_red_gold.png',price:2800, stats:{def:18,hp:45}, desc:'Scale plate lacquered in dragon red.', flavor:'The lacquer is said to be earned, not painted.' },
  boots_leather:{ name:'Trail Boots',     slot:'boots',  rarity:'common', icon:'assets/items/boots_leather.png', price:360,  stats:{spd:8,def:2}, desc:'Broken in across a hundred ridges.', flavor:'Lighter than they look after rain.' },
  ring_gem:     { name:'Astral Ring',     slot:'ring',   rarity:'legend', icon:'assets/items/gem_purple.png',    price:5600, stats:{atk:9,mp:30,crit:0.08}, desc:'A sky-shard set in cold silver.', flavor:'It turns to face constellations you cannot see.' },
  potion_hp:    { name:'Healing Draught', slot:'potion', rarity:'common', icon:'assets/items/health_potion.png', price:120,  stats:{}, desc:'Tastes of iron and berries. Restores 45 health.', flavor:'Every adventurer carries three. They always want five.', stack:true },
  gem_red:      { name:'Ember Gem',       slot:'gem',    rarity:'common', icon:'assets/items/gem_red.png',       price:180, stats:{}, desc:'Warm to the touch. Sells well in any market.' },
  gem_blue:     { name:'Tide Gem',        slot:'gem',    rarity:'rare',   icon:'assets/items/gem_blue.png',      price:320, stats:{}, desc:'A drop of ocean, frozen mid-fall.' }
};

AF.SHOP = [
  ['sword_iron','potion_hp','helmet_steel','boots_leather'],
  ['bow_gold','shield_royal'],
  ['staff_blue','sword_ice','armor_red'],
  ['ring_gem','sword_dark']
];

AF.SLOT_LABEL = { weapon:'Weapon', shield:'Off-hand', helm:'Helm', armor:'Armor', boots:'Boots', ring:'Ring' };
AF.SLOT_ORDER = ['weapon','shield','helm','armor','boots','ring'];

AF.SEED_BOARD = [
  { name:'Sable',    hero:'kunoichi', floor:14, score:24800, gold:9100, kills:186 },
  { name:'Orin',     hero:'commander',floor:12, score:21400, gold:7400, kills:164 },
  { name:'Wren',     hero:'archer',   floor:11, score:18950, gold:6100, kills:141 },
  { name:'Bao',      hero:'monk',     floor:9,  score:15200, gold:4800, kills:118 },
  { name:'Ilse',     hero:'ronin',    floor:8,  score:12600, gold:3900, kills:96 },
  { name:'Tam',      hero:'wanderer', floor:6,  score:8700,  gold:2100, kills:64 }
];
