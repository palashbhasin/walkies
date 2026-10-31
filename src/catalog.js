const $ = (s, el) => (el || document).querySelector(s);
const RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => (n < 10 ? '0' : '') + n;
const dayKey = d => { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); };
const addDays = (k, n) => { const p = k.split('-').map(Number); return dayKey(new Date(p[0], p[1]-1, p[2]+n)); };
const keyDate = k => { const p = k.split('-').map(Number); return new Date(p[0], p[1]-1, p[2]); };
const uid = p => (p||'') + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const rnd = () => Math.random().toString(36).slice(2,8);
const clone = o => JSON.parse(JSON.stringify(o));
const lsGet = k => { try { return localStorage.getItem(k); } catch(e){ return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch(e){ return false; } };
const lsDel = k => { try { localStorage.removeItem(k); } catch(e){} };
const fmtTime = t => new Date(t).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
const fmtDay = k => { const t = dayKey(); if (k === t) return 'Today'; if (k === addDays(t,-1)) return 'Yesterday'; return keyDate(k).toLocaleDateString(undefined, {weekday:'short', day:'numeric', month:'short'}); };
function hashStr(s){ let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------- color ---------- */
const h2r = h => { h = h.replace('#',''); return [0,2,4].map(i => parseInt(h.substr(i,2),16)); };
function mix(a, b, t){ const A = h2r(a), B = h2r(b); return '#' + A.map((v,i) => Math.round(v + (B[i]-v)*t).toString(16).padStart(2,'0')).join(''); }
const light = (c,t) => mix(c,'#ffffff',t), shade = (c,t) => mix(c,'#000000',t);
const lum = c => { const r = h2r(c); return (0.2126*r[0] + 0.7152*r[1] + 0.0722*r[2]) / 255; };

/* ---------- icons ---------- */
const ICONS = {
  paw:'<ellipse cx="12" cy="16" rx="5" ry="4.2"/><circle cx="5.6" cy="10.2" r="2.3"/><circle cx="9.6" cy="6.4" r="2.3"/><circle cx="14.4" cy="6.4" r="2.3"/><circle cx="18.4" cy="10.2" r="2.3"/>',
  bone:'<g transform="rotate(-35 12 12)"><rect x="5" y="10" width="14" height="4" rx="2"/><circle cx="5" cy="10.2" r="2.6"/><circle cx="5" cy="13.8" r="2.6"/><circle cx="19" cy="10.2" r="2.6"/><circle cx="19" cy="13.8" r="2.6"/></g>',
  flame:'<path d="M12 2c.8 3.6 5.6 5.8 5.6 11.4A5.6 5.6 0 0 1 6.4 14c0-2.6 1.5-4.4 2.8-5.6.1 1.8.9 3 2 3.4C11 8.6 10.4 5.4 12 2z"/>',
  star:'<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21.1l1.5-7L2 9.3l7-.8z"/>',
  camera:'<path d="M4 7h3l1.6-2h6.8L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6" fill="rgba(0,0,0,.55)"/>',
  gift:'<rect x="3" y="10" width="18" height="11" rx="1.5"/><rect x="2" y="6.5" width="20" height="4" rx="1"/><path d="M12 6.5c-2-4-6-3-5 0M12 6.5c2-4 6-3 5 0" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="11" y="6.5" width="2" height="14.5" fill="rgba(0,0,0,.35)"/>',
  crown:'<path d="M3 18h18l-1.2-10-5 4L12 5l-2.8 7-5-4z"/><rect x="3" y="19" width="18" height="2" rx="1"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke="rgba(0,0,0,.6)" stroke-width="2" fill="none" stroke-linecap="round"/>',
  sun:'<circle cx="12" cy="12" r="4.5"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  x:'<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  heart:'<path d="M12 21s-8.5-5.2-8.5-11.2A4.6 4.6 0 0 1 12 7.3a4.6 4.6 0 0 1 8.5 2.5C20.5 15.8 12 21 12 21z"/>',
  trophy:'<path d="M7 3h10v5a5 5 0 0 1-10 0z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="10.8" y="12" width="2.4" height="5"/><rect x="7.5" y="17" width="9" height="3" rx="1"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/>',
  play:'<path d="M7 4.5v15l13-7.5z"/>',
  plus:'<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  report:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5" stroke="rgba(0,0,0,.55)" stroke-width="1.8" stroke-linecap="round"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18c1.3 0 2-.8 2-1.8 0-1.3-1-1.6-1-2.7 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.5" fill="rgba(0,0,0,.5)"/><circle cx="10" cy="7" r="1.5" fill="rgba(0,0,0,.5)"/><circle cx="15" cy="7.5" r="1.5" fill="rgba(0,0,0,.5)"/>',
  game:'<rect x="2" y="7" width="20" height="11" rx="5.5"/><path d="M7 10.5v4M5 12.5h4" stroke="rgba(0,0,0,.6)" stroke-width="1.8" stroke-linecap="round"/><circle cx="15.5" cy="11" r="1.3" fill="rgba(0,0,0,.6)"/><circle cx="17.8" cy="13.6" r="1.3" fill="rgba(0,0,0,.6)"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5" fill="rgba(0,0,0,.45)"/><circle cx="12" cy="12" r="2.4"/>'
};
const icon = (n, s, cls) => '<svg class="ic ' + (cls||'') + '" width="' + (s||18) + '" height="' + (s||18) + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + (ICONS[n]||'') + '</svg>';

/* ---------- breeds ----------
   ear: floppy | small | long | pointy | bat | fold | pompom
   coat: smooth | fluffy | curly ; muzzle: normal | short | long
   tail: wag | thin | bushy | curl | stub | pom ; mk = markings */
const BREEDS = {
  golden:   {name:'Golden Retriever', fur:'#e3a857', dark:'#c4873a', belly:'#f6dcae', eye:'#5a3416', ear:'floppy', coat:'smooth', muzzle:'normal', tail:'bushy', mk:[]},
  lab:      {name:'Black Lab',        fur:'#34302c', dark:'#24201d', belly:'#4a433e', eye:'#6b3f1d', ear:'small',  coat:'smooth', muzzle:'normal', tail:'wag',   mk:[]},
  yellowlab:{name:'Yellow Lab',       fur:'#efce8f', dark:'#d7ae67', belly:'#f8e7c3', eye:'#5a3416', ear:'small',  coat:'smooth', muzzle:'normal', tail:'wag',   mk:[]},
  choclab:  {name:'Chocolate Lab',    fur:'#7b4a2c', dark:'#5a331d', belly:'#9a6340', eye:'#c08a3e', ear:'small',  coat:'smooth', muzzle:'normal', tail:'wag',   mk:[]},
  husky:    {name:'Husky',            fur:'#8a919c', dark:'#5f6670', belly:'#f2f2f2', eye:'#6ec6ff', ear:'pointy', coat:'smooth', muzzle:'normal', tail:'bushy', mk:['mask','blaze'], tip:'#f2f2f2'},
  gsd:      {name:'German Shepherd',  fur:'#c88a46', dark:'#2a221c', belly:'#dcae6e', eye:'#4a2a12', ear:'pointy', bigEar:true, coat:'smooth', muzzle:'long', tail:'bushy', mk:['darkmask','cap','saddle']},
  corgi:    {name:'Corgi',            fur:'#e08a3c', dark:'#b9692a', belly:'#fff3e3', eye:'#4a2a12', ear:'pointy', bigEar:true, coat:'smooth', muzzle:'normal', tail:'stub', mk:['mask','blaze']},
  shiba:    {name:'Shiba Inu',        fur:'#d9893c', dark:'#b06a28', belly:'#fbf0df', eye:'#3a2010', ear:'pointy', coat:'smooth', muzzle:'normal', tail:'curl', mk:['mask'], smallEyes:true},
  dalmatian:{name:'Dalmatian',        fur:'#f4f1ea', dark:'#d6d0c4', belly:'#ffffff', eye:'#5a3416', ear:'floppy', earFill:'#2a2a2a', coat:'smooth', muzzle:'normal', tail:'thin', mk:['spots'], spots:'#1d1d1d'},
  beagle:   {name:'Beagle',           fur:'#c98b4a', dark:'#3b2b21', belly:'#fbf3e6', eye:'#4a2a12', ear:'long', earFill:'#b5733a', coat:'smooth', muzzle:'normal', tail:'wag', mk:['mask','blaze','cap'], tip:'#fbf3e6'},
  poodle:   {name:'Poodle',           fur:'#f2e8da', dark:'#d9c7ae', belly:'#f8f1e7', eye:'#2a1a10', ear:'pompom', coat:'curly', muzzle:'long', tail:'pom', mk:[]},
  pug:      {name:'Pug',              fur:'#e6c79c', dark:'#2a2420', belly:'#efd6b0', eye:'#2a1a10', ear:'small', earFill:'#2a2420', coat:'smooth', muzzle:'short', tail:'curl', mk:['darkmask'], bigEyes:true},
  frenchie: {name:'French Bulldog',   fur:'#e7d9c4', dark:'#b9a487', belly:'#f5ece0', eye:'#2a1a10', ear:'bat', coat:'smooth', muzzle:'short', tail:'stub', mk:[], bigEyes:true},
  chihuahua:{name:'Chihuahua',        fur:'#e3b47c', dark:'#c99257', belly:'#f6e2c6', eye:'#2a1a10', ear:'bat', coat:'smooth', muzzle:'normal', tail:'thin', mk:['blaze'], bigEyes:true},
  collie:   {name:'Border Collie',    fur:'#1f1d1c', dark:'#121111', belly:'#f5f3ef', eye:'#6b3f1d', ear:'fold', coat:'fluffy', muzzle:'long', tail:'bushy', mk:['mask','blaze','socks'], tip:'#f5f3ef'},
  aussie:   {name:'Australian Shepherd', fur:'#9aa3ad', dark:'#353a41', belly:'#f4f2ee', eye:'#6ec6ff', ear:'fold', coat:'fluffy', muzzle:'normal', tail:'stub', mk:['merle','mask','blaze','tan','socks'], tan:'#c0702f'},
  bernese:  {name:'Bernese Mountain Dog', fur:'#1c1a19', dark:'#121111', belly:'#f6f2ec', eye:'#4a2a12', ear:'floppy', coat:'fluffy', muzzle:'normal', tail:'bushy', mk:['blaze','mask','tan','socks'], tan:'#b8662f'},
  samoyed:  {name:'Samoyed',          fur:'#fbfaf7', dark:'#e2ddd4', belly:'#ffffff', eye:'#1e140c', ear:'pointy', coat:'fluffy', muzzle:'normal', tail:'curl', mk:[]},
  pomeranian:{name:'Pomeranian',      fur:'#f0953a', dark:'#c8721f', belly:'#f9c58a', eye:'#1e140c', ear:'pointy', coat:'fluffy', muzzle:'short', tail:'curl', mk:[], bigEyes:true},
  boxer:    {name:'Boxer',            fur:'#c27a3e', dark:'#2b211b', belly:'#f7efe5', eye:'#3a2010', ear:'fold', coat:'smooth', muzzle:'short', tail:'stub', mk:['darkmask','blaze','socks']},
  doberman: {name:'Doberman',         fur:'#1e1a18', dark:'#121010', belly:'#2c2623', eye:'#7a4a22', ear:'pointy', bigEar:true, coat:'smooth', muzzle:'long', tail:'stub', mk:['tan'], tan:'#a8562a'},
  rottweiler:{name:'Rottweiler',      fur:'#1c1917', dark:'#100e0d', belly:'#27221f', eye:'#5a3416', ear:'small', coat:'smooth', muzzle:'normal', tail:'stub', mk:['tan'], tan:'#9b4f22'},
  cavalier: {name:'Cavalier King Charles', fur:'#f6f1ea', dark:'#b0542a', belly:'#ffffff', eye:'#1e140c', ear:'long', feather:true, coat:'smooth', muzzle:'short', tail:'wag', mk:['patches','blaze'], bigEyes:true},
  greyhound:{name:'Greyhound',        fur:'#9a9ea6', dark:'#7a7e86', belly:'#cfd2d8', eye:'#3a2010', ear:'fold', coat:'smooth', muzzle:'long', tail:'thin', mk:[]},
  doodle:   {name:'Goldendoodle',     fur:'#e6b77a', dark:'#c99657', belly:'#f3d8ad', eye:'#2a1a10', ear:'floppy', coat:'curly', muzzle:'normal', tail:'bushy', mk:[]}
};
const BREED_KEYS = Object.keys(BREEDS);

/* ---------- catalogs ---------- */
const RAR = ['common','rare','epic','legendary'];
const RAR_LABEL = {common:'Common', rare:'Rare', epic:'Epic', legendary:'Legendary'};
const CHROMAS = {
  chroma_frost:   {name:'Frost',     rarity:'rare',      fur:'#dbe7f5', dark:'#93abcb', belly:'#ffffff', spot:'#6f8fbd', eye:'#5fb8ff'},
  chroma_midnight:{name:'Midnight',  rarity:'rare',      fur:'#26324f', dark:'#141c33', belly:'#46598a', spot:'#9fc0ff', tan:'#7aa2ff', eye:'#ffd36b'},
  chroma_cherry:  {name:'Cherry Blossom', rarity:'rare', fur:'#eba3b8', dark:'#c66984', belly:'#fde4ec', spot:'#a8435f'},
  chroma_mint:    {name:'Mint',      rarity:'rare',      fur:'#93dcc3', dark:'#4ea58a', belly:'#e6fbf3', spot:'#2f7d66'},
  chroma_sunset:  {name:'Sunset',    rarity:'epic',      fur:'#ff8a5c', dark:'#b8355e', belly:'#ffe6c9', spot:'#8f2347', grad:['#ffd36b','#ff7a59','#d9406f']},
  chroma_neon:    {name:'Neon',      rarity:'epic',      fur:'#15171c', dark:'#0a0b0e', belly:'#22252d', spot:'#39f3ff', tan:'#ff3df2', eye:'#39f3ff', fx:'neon'},
  chroma_gold:    {name:'Solid Gold',rarity:'legendary', fur:'#f2c14e', dark:'#a8700f', belly:'#fff4cf', spot:'#a8700f', eye:'#7a3d00', grad:['#fff0b3','#f2c14e','#b7801a'], fx:'sparkle'},
  chroma_galaxy:  {name:'Galaxy',    rarity:'legendary', fur:'#3c2a8a', dark:'#1a1240', belly:'#8a74f0', spot:'#ffe08a', eye:'#ffe08a', grad:['#7a5af0','#2b1a66','#0f1b4d'], fx:'stars'},
  chroma_prism:   {name:'Prismatic', rarity:'legendary', fur:'#ff8a5c', dark:'#c44a7a', belly:'#ffd9b8', spot:'#c44a7a', fx:'prism'}
};
const SLOTS = [['hat','Hats'],['glasses','Glasses'],['collar','Collars'],['bandana','Bandanas'],['toy','Toys'],['aura','Auras']];
const ITEMS = [
  {id:'collar_red',    slot:'collar', name:'Red Collar',     rarity:'common', c:'#e5484d'},
  {id:'collar_blue',   slot:'collar', name:'Blue Collar',    rarity:'common', c:'#3b82f6'},
  {id:'collar_green',  slot:'collar', name:'Green Collar',   rarity:'common', c:'#22c55e'},
  {id:'collar_studded',slot:'collar', name:'Studded Collar', rarity:'rare',   c:'#1b1b1e'},
  {id:'collar_gold',   slot:'collar', name:'Gold Chain',     rarity:'legendary'},
  {id:'hat_beanie',    slot:'hat',    name:'Beanie',         rarity:'common', c:'#e5484d'},
  {id:'hat_party',     slot:'hat',    name:'Party Hat',      rarity:'rare'},
  {id:'hat_cowboy',    slot:'hat',    name:'Cowboy Hat',     rarity:'rare'},
  {id:'hat_wizard',    slot:'hat',    name:'Wizard Hat',     rarity:'epic'},
  {id:'hat_crown',     slot:'hat',    name:'Royal Crown',    rarity:'legendary'},
  {id:'glasses_specs', slot:'glasses',name:'Reading Specs',  rarity:'common'},
  {id:'glasses_sun',   slot:'glasses',name:'Sunglasses',     rarity:'rare'},
  {id:'glasses_heart', slot:'glasses',name:'Heart Shades',   rarity:'epic'},
  {id:'bandana_red',   slot:'bandana',name:'Red Bandana',    rarity:'common', c:'#d93b3b'},
  {id:'bandana_blue',  slot:'bandana',name:'Blue Bandana',   rarity:'common', c:'#2f6fdf'},
  {id:'bandana_galaxy',slot:'bandana',name:'Galaxy Bandana', rarity:'epic'},
  {id:'toy_ball',      slot:'toy',    name:'Tennis Ball',    rarity:'common'},
  {id:'toy_bone',      slot:'toy',    name:'Chew Bone',      rarity:'common'},
  {id:'toy_rope',      slot:'toy',    name:'Rope Tug',       rarity:'rare'},
  {id:'toy_frisbee',   slot:'toy',    name:'Frisbee',        rarity:'rare'},
  {id:'toy_golden',    slot:'toy',    name:'Golden Ball',    rarity:'legendary'},
  {id:'aura_sparkle',  slot:'aura',   name:'Sparkle Aura',   rarity:'epic'},
  {id:'aura_rainbow',  slot:'aura',   name:'Rainbow Ring',   rarity:'legendary'},
  {id:'aura_fire',     slot:'aura',   name:'Fire Aura',      rarity:'legendary'}
];
Object.keys(CHROMAS).forEach(id => ITEMS.push({id, slot:'chroma', name:CHROMAS[id].name + ' Chroma', rarity:CHROMAS[id].rarity}));
const ITEM = {}; ITEMS.forEach(i => { ITEM[i.id] = i; });
const CHROMA_PRICE = {rare:150, epic:350, legendary:900};
const PACKS = [
  {id:'pup',    name:'Pup Pack',         cost:60,  count:3, rarity:'common',    odds:{common:.70, rare:.24, epic:.05, legendary:.01}},
  {id:'good',   name:'Good Dog Pack',    cost:180, count:3, rarity:'rare',      odds:{common:.34, rare:.43, epic:.18, legendary:.05}, guarantee:'rare'},
  {id:'kennel', name:'Legendary Kennel', cost:480, count:2, rarity:'legendary', odds:{epic:.7, legendary:.3}}
];
const DUPE = {common:8, rare:25, epic:70, legendary:180};
const UPGRADES = [
  {id:'jar',     name:'Treat Jar',        desc:'+10% bones from walks and check-ins', max:5, icon:'bone',   base:150},
  {id:'clicker', name:'Training Clicker', desc:'+10% XP for every activity',          max:5, icon:'star',   base:150},
  {id:'leash',   name:'Pro Leash',        desc:'+15% bones and XP from walks',        max:3, icon:'paw',    base:220},
  {id:'bed',     name:'Memory Foam Bed',  desc:'+5% bones and XP per level, a good sleep pays off', max:3, icon:'heart', base:180},
  {id:'arcade',  name:'Arcade Pass',      desc:'+1 rewarded Treat Catch game per day',max:3, icon:'game',   base:200}
];
const QUESTIONS = [
  {id:'play',  w:15, t:p => 'Did you play with ' + p.obj + ' for at least 15 minutes?', h:'Fetch, tug, chase or puzzle toys all count.'},
  {id:'crate', w:15, t:p => 'Did you let ' + p.obj + ' out of the crate on the first bark?', h:'First bark, not the fifth.'},
  {id:'food',  w:10, t:() => 'Fed on time, with fresh water all day?', h:'Breakfast and dinner at the usual times.'},
  {id:'potty', w:10, t:p => 'Did ' + p.sub + ' get a potty break every few hours?', h:'No long stretches stuck inside.'},
  {id:'groom', w:10, t:p => 'Did you groom or brush ' + p.obj + '?', h:'Brushing, paw check, ear wipe or teeth.'},
  {id:'train', w:10, t:() => 'Did you practise a trick or command?', h:'Five minutes of sit, stay, paw or recall.'},
  {id:'love',  w:5,  t:() => 'Calm cuddle time together?', h:'Couch time, belly rubs, quiet company.'}
];
const WALK_W = 25;
const TRICKS = [
  {id:'sit',   name:'Sit',       lvl:1,  say:['Sitting pretty.','Like this?']},
  {id:'speak', name:'Speak',     lvl:2,  say:['Woof! Woof!','ARF!','Bork bork!']},
  {id:'paw',   name:'Paw',       lvl:3,  say:['High five!','Shake on it.']},
  {id:'spin',  name:'Spin',      lvl:4,  say:['Wheee!','Round and round.']},
  {id:'jump',  name:'Jump',      lvl:6,  say:['Boing!','Higher!']},
  {id:'roll',  name:'Roll over', lvl:7,  say:['Belly rub next?','Ta-da!']},
  {id:'dead',  name:'Play dead', lvl:8,  say:['Bang! …', 'I am a pancake.']},
  {id:'flip',  name:'Backflip',  lvl:10, say:['Did you see that?!','Ten out of ten.']}
];
const QUEST_POOL = [
  {id:'walk2',   text:'Log 2 walks today',             goal:2,   reward:40, ic:'paw',    walk:true},
  {id:'mins45',  text:'Walk 45 minutes in total',      goal:45,  reward:50, ic:'clock',  walk:true},
  {id:'crate',   text:'Let your dog out of the crate',  goal:1,   reward:20, ic:'lock'},
  {id:'move',    text:'Tap the floor to walk your dog around 5 times', goal:5, reward:20, ic:'paw'},
  {id:'ci',      text:'Finish tonight’s check-in',goal:1,   reward:30, ic:'report'},
  {id:'ci80',    text:'Score 80+ on the check-in',     goal:80,  reward:50, ic:'star'},
  {id:'pet25',   text:'Pet your dog 25 times',         goal:25,  reward:25, ic:'heart'},
  {id:'game300', text:'Score 300 in Treat Catch',      goal:300, reward:40, ic:'game'},
  {id:'tricks3', text:'Do 3 tricks',                   goal:3,   reward:20, ic:'target'},
  {id:'style',   text:'Change your dog’s outfit or chroma', goal:1, reward:15, ic:'palette'}
];
const CHEST = [20, 30, 40, 50, 70, 90, 120];
const ACH = [
  {id:'first_walk', name:'First Steps',         desc:'Log your first walk',           reward:20,  ic:'paw',    p:s => [s.walks,1]},
  {id:'walks10',    name:'Trail Regular',       desc:'Log 10 walks',                  reward:60,  ic:'paw',    p:s => [s.walks,10]},
  {id:'walks50',    name:'Neighbourhood Legend',desc:'Log 50 walks',                  reward:200, ic:'paw',    p:s => [s.walks,50]},
  {id:'walks100',   name:'Century Club',        desc:'Log 100 walks',                 reward:400, ic:'trophy', p:s => [s.walks,100]},
  {id:'long',       name:'Long Haul',           desc:'One walk of 60+ minutes',       reward:60,  ic:'clock',  p:s => [Math.min(s.maxMin,60),60]},
  {id:'triple',     name:'Triple Walk Day',     desc:'3 walks for one dog in a day',  reward:80,  ic:'paw',    p:s => [Math.min(s.maxDay,3),3]},
  {id:'early',      name:'Early Bird',          desc:'Start a walk before 7 am',      reward:40,  ic:'sun',    p:s => [s.early,1]},
  {id:'first_ci',   name:'Report Card',         desc:'Finish your first check-in',    reward:30,  ic:'report', p:s => [s.checks,1]},
  {id:'perfect',    name:'Perfect Day',         desc:'Score 100 on a check-in',       reward:100, ic:'star',   p:s => [s.perfect,1]},
  {id:'streak3',    name:'On a Roll',           desc:'3-day check-in streak (50+)',   reward:50,  ic:'flame',  p:s => [Math.min(s.best,3),3]},
  {id:'streak7',    name:'Week Warrior',        desc:'7-day check-in streak',         reward:150, ic:'flame',  p:s => [Math.min(s.best,7),7]},
  {id:'streak30',   name:'Unbreakable',         desc:'30-day check-in streak',        reward:600, ic:'flame',  p:s => [Math.min(s.best,30),30]},
  {id:'nightowl',   name:'Night Owl',           desc:'Log a walk after 9 pm',         reward:40,  ic:'star',   p:s => [s.late,1]},
  {id:'first_pack', name:'Unboxer',             desc:'Open your first pack',          reward:20,  ic:'gift',   p:s => [Math.min(s.packs,1),1]},
  {id:'golden_pull',name:'Golden Pull',         desc:'Pull a legendary item',         reward:150, ic:'crown',  p:s => [Math.min(s.leg,1),1]},
  {id:'collector',  name:'Collector',           desc:'Own 15 different items',        reward:200, ic:'gift',   p:s => [Math.min(s.owned,15),15]},
  {id:'chromas3',   name:'Colour Theory',       desc:'Own 3 chromas',                 reward:120, ic:'palette',p:s => [Math.min(s.chromas,3),3]},
  {id:'fashion',    name:'Fashion Icon',        desc:'Wear 4 items at once',          reward:40,  ic:'star',   p:s => [Math.min(s.worn,4),4]},
  {id:'quests10',   name:'Quest Hound',         desc:'Complete 10 daily quests',      reward:120, ic:'target', p:s => [Math.min(s.quests,10),10]},
  {id:'chest7',     name:'Full Week Chest',     desc:'Reach day 7 of the treat chest',reward:100, ic:'gift',   p:s => [s.chest7,1]},
  {id:'gamer',      name:'Treat Catcher',       desc:'Score 500 in Treat Catch',      reward:80,  ic:'game',   p:s => [Math.min(s.game,500),500]},
  {id:'lvl5',       name:'Best Buddies',        desc:'Reach level 5',                 reward:100, ic:'heart',  p:s => [Math.min(s.lvl,5),5]},
  {id:'lvl10',      name:'Soulmates',           desc:'Reach level 10 and learn every trick', reward:300, ic:'heart', p:s => [Math.min(s.lvl,10),10]}
];
const TITLES = ['Puppy','Sidekick','Walk Buddy','Good Dog','Best Friend','Pack Leader','Top Dog','Legend','Mythic Pup'];
const GCOL = {S:'#ffc94d', A:'#4ade80', B:'#5ec8f2', C:'#b49cff', D:'#fb923c', F:'#f87171'};
const TABS = [['today','Today'],['checkin','Check-in'],['walks','Walks'],['play','Play'],['closet','Closet'],['packs','Packs'],['shop','Upgrades'],['trophies','Trophies'],['family','Family']];

/* ---------- SVG item icons ---------- */
const star4 = (x, y, s) => { const a = s*.28; return 'M'+x+' '+(y-s)+'L'+(x+a)+' '+(y-a)+'L'+(x+s)+' '+y+'L'+(x+a)+' '+(y+a)+'L'+x+' '+(y+s)+'L'+(x-a)+' '+(y+a)+'L'+(x-s)+' '+y+'L'+(x-a)+' '+(y-a)+'Z'; };
const heartPath = (cx, cy, s) => 'M'+cx+' '+(cy+s*.9)+'C'+(cx-s*1.4)+' '+(cy+s*.1)+','+(cx-s*.9)+' '+(cy-s*1.1)+','+cx+' '+(cy-s*.35)+'C'+(cx+s*.9)+' '+(cy-s*1.1)+','+(cx+s*1.4)+' '+(cy+s*.1)+','+cx+' '+(cy+s*.9)+'Z';
function itemDefs(u){
  return '<radialGradient id="'+u+'f" cx="50%" cy="62%" r="50%"><stop offset="0" stop-color="#ffcc4d" stop-opacity=".55"/><stop offset=".55" stop-color="#ff6a1f" stop-opacity=".28"/><stop offset="1" stop-color="#ff3d00" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="'+u+'r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5d5d"/><stop offset=".25" stop-color="#ffc94d"/><stop offset=".5" stop-color="#4ade80"/><stop offset=".75" stop-color="#4aa8ff"/><stop offset="1" stop-color="#b47cff"/></linearGradient>' +
    '<linearGradient id="'+u+'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1b5e"/><stop offset=".5" stop-color="#6b3fd6"/><stop offset="1" stop-color="#1c3a8a"/></linearGradient>' +
    '<linearGradient id="'+u+'au" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#e09a1a"/></linearGradient>';
}

function drawItem(it, u){
  if (!it) return '';
  const c = it.c;
  switch (it.id) {
    case 'collar_red': case 'collar_blue': case 'collar_green':
      return '<rect x="64" y="111" width="72" height="10" rx="5" fill="'+c+'"/><rect x="66" y="112" width="68" height="3" rx="1.5" fill="rgba(255,255,255,.25)"/><circle cx="100" cy="126" r="6" fill="url(#'+u+'au)" stroke="#b8860b"/>';
    case 'collar_studded': {
      let st = ''; for (let x = 70; x <= 130; x += 8) st += '<circle cx="'+x+'" cy="116" r="1.8" fill="#d9dde3"/>';
      return '<rect x="64" y="111" width="72" height="10" rx="5" fill="'+c+'"/>' + st + '<circle cx="100" cy="126" r="6" fill="#c8ccd3" stroke="#8a8f98"/>';
    }
    case 'collar_gold': {
      let lk = ''; for (let x = 68; x <= 132; x += 7) lk += '<ellipse cx="'+x+'" cy="116" rx="4" ry="5" fill="none" stroke="#b07a10" stroke-width="1.2"/>';
      return '<rect x="64" y="111" width="72" height="10" rx="5" fill="url(#'+u+'au)"/>' + lk + '<path d="M100 120 l7 9 -7 7 -7 -7z" fill="#7fe3ff" stroke="#e6f9ff"/>';
    }
    case 'bandana_red': case 'bandana_blue':
      return '<path d="M66 117 L134 117 L100 153Z" fill="'+c+'" stroke="rgba(0,0,0,.25)"/><g fill="rgba(255,255,255,.75)"><circle cx="88" cy="125" r="1.8"/><circle cx="112" cy="125" r="1.8"/><circle cx="100" cy="133" r="1.8"/><circle cx="94" cy="142" r="1.5"/><circle cx="106" cy="142" r="1.5"/></g>';
    case 'bandana_galaxy':
      return '<path d="M66 117 L134 117 L100 153Z" fill="url(#'+u+'g)" stroke="#8e6bff"/><g fill="#fff"><circle cx="86" cy="124" r="1.2"/><circle cx="114" cy="127" r="1"/><circle cx="101" cy="137" r="1.4"/><circle cx="95" cy="129" r=".8"/></g><path d="'+star4(108,133,3.5)+'" fill="#ffe08a"/>';
    case 'hat_beanie':
      return '<path d="M60 58 Q62 22 100 20 Q138 22 140 58Z" fill="'+c+'"/><path d="M70 50 Q72 30 88 26" stroke="rgba(255,255,255,.25)" stroke-width="4" fill="none" stroke-linecap="round"/><rect x="56" y="51" width="88" height="13" rx="6.5" fill="#f2efe8"/><circle cx="100" cy="18" r="8" fill="#f2efe8"/>';
    case 'hat_party':
      return '<path d="M80 47 L100 0 L120 47Z" fill="#ff6b8b"/><path d="M85 35 L115 35 M90 23 L110 23 M95 11 L105 11" stroke="#ffe08a" stroke-width="4"/><circle cx="100" cy="1" r="5.5" fill="#ffe08a"/>';
    case 'hat_cowboy':
      return '<ellipse cx="100" cy="47" rx="60" ry="9" fill="#7c4e24"/><path d="M70 47 Q72 14 88 16 Q100 25 112 16 Q128 14 130 47Z" fill="#9a6331"/><rect x="71" y="38" width="58" height="6" fill="#3b2412"/>';
    case 'hat_wizard':
      return '<path d="M70 49 L106 -12 L130 49Z" fill="#5b3fc4"/><ellipse cx="100" cy="49" rx="42" ry="7.5" fill="#4a32a6"/><path d="'+star4(102,22,6)+'" fill="#ffe08a"/><circle cx="92" cy="38" r="2" fill="#ffe08a"/><circle cx="113" cy="8" r="1.6" fill="#ffe08a"/>';
    case 'hat_crown':
      return '<path d="M68 47 L72 17 L86 33 L100 10 L114 33 L128 17 L132 47Z" fill="url(#'+u+'au)" stroke="#c48612" stroke-width="1.5"/><circle cx="100" cy="36" r="4.5" fill="#ff4d6d"/><circle cx="82" cy="40" r="3" fill="#4aa8ff"/><circle cx="118" cy="40" r="3" fill="#4ade80"/>';
    case 'glasses_specs':
      return '<g fill="rgba(255,255,255,.07)" stroke="#e2d9c8" stroke-width="2.6"><circle cx="82" cy="76" r="11"/><circle cx="118" cy="76" r="11"/></g><path d="M93 75 Q100 70 107 75 M71 74 L56 70 M129 74 L144 70" stroke="#e2d9c8" stroke-width="2.6" fill="none"/>';
    case 'glasses_sun':
      return '<rect x="67" y="67" width="29" height="19" rx="8" fill="#0b0b0b" stroke="#3a3a3a" stroke-width="1.5"/><rect x="104" y="67" width="29" height="19" rx="8" fill="#0b0b0b" stroke="#3a3a3a" stroke-width="1.5"/><path d="M96 73 L104 73 M67 72 L55 69 M133 72 L145 69" stroke="#2a2a2a" stroke-width="3"/><path d="M72 72 L80 70 M109 72 L117 70" stroke="rgba(255,255,255,.55)" stroke-width="2" stroke-linecap="round"/>';
    case 'glasses_heart':
      return '<path d="'+heartPath(82,76,10.5)+'" fill="#ff3d6e" stroke="#ffb3c3" stroke-width="1"/><path d="'+heartPath(118,76,10.5)+'" fill="#ff3d6e" stroke="#ffb3c3" stroke-width="1"/><path d="M95 72 L105 72 M70 71 L56 68 M130 71 L144 68" stroke="#ff3d6e" stroke-width="2.6"/>';
    case 'toy_ball':
      return '<g class="toy"><circle cx="34" cy="195" r="11" fill="#d7ef3a"/><path d="M24 190 Q34 197 44 190 M24 200 Q34 193 44 200" stroke="#fff" stroke-width="1.8" fill="none" opacity=".85"/></g>';
    case 'toy_bone':
      return '<g class="toy" fill="#f1e6cf"><rect x="21" y="194" width="28" height="7" rx="3.5"/><circle cx="21" cy="193" r="4.6"/><circle cx="21" cy="202" r="4.6"/><circle cx="49" cy="193" r="4.6"/><circle cx="49" cy="202" r="4.6"/></g>';
    case 'toy_rope':
      return '<g class="toy"><path d="M18 200 Q34 186 50 200" stroke="#e0533f" stroke-width="7" fill="none" stroke-dasharray="6 5" stroke-linecap="round"/><path d="M18 200 Q34 186 50 200" stroke="#f2efe8" stroke-width="7" fill="none" stroke-dasharray="5 6" stroke-dashoffset="5.5"/><circle cx="16" cy="201" r="5" fill="#e0533f"/><circle cx="52" cy="201" r="5" fill="#e0533f"/></g>';
    case 'toy_frisbee':
      return '<g class="toy"><ellipse cx="34" cy="199" rx="18" ry="6.5" fill="#4aa8ff"/><ellipse cx="34" cy="197.5" rx="10" ry="3" fill="rgba(255,255,255,.35)"/></g>';
    case 'toy_golden':
      return '<g class="toy"><circle cx="34" cy="195" r="11" fill="url(#'+u+'au)" stroke="#c48612"/><circle cx="30" cy="191" r="3" fill="#fff6d6"/><path class="twinkle" d="'+star4(47,181,5)+'" fill="#ffe08a"/></g>';
    case 'aura_sparkle':
      return [[28,62,6,0],[172,48,7,.5],[18,140,5,1],[180,152,6,1.4],[58,18,5,.8],[150,96,4,1.8],[44,100,4,1.1],[160,10,4,.3]].map(p => '<path class="twinkle" style="animation-delay:'+p[3]+'s" d="'+star4(p[0],p[1],p[2])+'" fill="#ffe08a"/>').join('');
    case 'aura_fire':
      return '<ellipse class="flicker" cx="100" cy="120" rx="96" ry="108" fill="url(#'+u+'f)"/>';
    case 'aura_rainbow':
      return '<g class="spin"><circle cx="100" cy="118" r="96" fill="none" stroke="url(#'+u+'r)" stroke-width="5" stroke-dasharray="16 10" opacity=".8"/></g>';
  }
  return '';
}

function lightF(id, sd, ss){
  return '<filter id="'+id+'" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">' +
    '<feGaussianBlur in="SourceAlpha" stdDeviation="'+sd+'" result="b"/>' +
    '<feDiffuseLighting in="b" surfaceScale="'+ss+'" diffuseConstant="1.22" lighting-color="#ffffff" result="d"><feDistantLight azimuth="230" elevation="52"/></feDiffuseLighting>' +
    '<feSpecularLighting in="b" surfaceScale="'+ss+'" specularConstant=".6" specularExponent="20" lighting-color="#fff4e2" result="s"><feDistantLight azimuth="230" elevation="62"/></feSpecularLighting>' +
    '<feComposite in="d" in2="SourceAlpha" operator="in" result="d2"/><feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>' +
    '<feBlend in="SourceGraphic" in2="d2" mode="multiply" result="l"/>' +
    '<feComposite in="l" in2="s2" operator="arithmetic" k1="0" k2="1" k3=".55" k4="0" result="o"/>' +
    '<feComposite in="o" in2="SourceAlpha" operator="in"/></filter>';
}

const VB = {hat:'40 -16 120 76', glasses:'48 56 104 40', collar:'56 102 88 32', bandana:'58 108 84 50', toy:'10 176 50 34', aura:'-6 -16 212 236'};
function itemSVG(it, dog, thumb){
  if (it.slot === 'chroma') return '<img class="thumb3d" alt="" src="' + (thumb ? thumb({look: dog ? dog.look : 'golden', eq:{chroma: it.id}}) : '') + '">';
  const u = 'i' + rnd();
  const extra = it.slot === 'aura' ? '<ellipse cx="100" cy="130" rx="48" ry="62" fill="rgba(255,255,255,.07)"/>' : '';
  const flt = it.slot === 'aura' || it.slot === 'glasses' ? '' : ' filter="url(#'+u+'3s)"';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+VB[it.slot]+'" aria-hidden="true" class="item-svg"><defs>'+itemDefs(u)+lightF(u+'3s', 2.6, 3.2)+'</defs>'+extra+'<g'+flt+'>'+drawItem(it, u)+'</g></svg>';
}

export {$, RM, esc, pad, dayKey, addDays, keyDate, uid, rnd, clone, lsGet, lsSet, lsDel, fmtTime, fmtDay, hashStr, mix, light, shade, lum, ICONS, icon, BREEDS, BREED_KEYS, RAR, RAR_LABEL, CHROMAS, SLOTS, ITEMS, ITEM, CHROMA_PRICE, PACKS, DUPE, UPGRADES, QUESTIONS, WALK_W, TRICKS, QUEST_POOL, CHEST, ACH, TITLES, GCOL, TABS, star4, heartPath, itemDefs, drawItem, lightF, VB, itemSVG};
