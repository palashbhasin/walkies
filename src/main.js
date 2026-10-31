import { createClient } from '@supabase/supabase-js';
import { createStage, renderThumb } from './dog3d.js';
import {
  $, RM, esc, dayKey, addDays, keyDate, uid, clone, lsGet, lsSet, lsDel, fmtTime, fmtDay, hashStr,
  icon, BREEDS, BREED_KEYS, RAR, RAR_LABEL, CHROMAS, SLOTS, ITEMS, ITEM, CHROMA_PRICE, PACKS, DUPE, UPGRADES,
  QUESTIONS, WALK_W, TRICKS, QUEST_POOL, CHEST, ACH, TITLES, GCOL, TABS, itemSVG
} from './catalog.js';

/* ---------- config ---------- */
const SB_URL = 'https://oeaglkibntsovfezpqgo.supabase.co';
const SB_KEY = 'sb_publishable_cosOE2Xj-LxEQS8xC1Pd4Q_WleAWW1V';
const params = new URLSearchParams(location.search);
const FORCE_DEMO = typeof __FORCE_DEMO__ !== 'undefined' && __FORCE_DEMO__;
const DEMO = FORCE_DEMO || params.has('demo');
const sb = DEMO ? null : createClient(SB_URL, SB_KEY, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:'pkce'}});
if (params.get('join')) lsSet('walkies-join', params.get('join').toUpperCase());
const thumb = (d, size) => { try { return renderThumb(d, size || 128); } catch(e){ return ''; } };

/* ---------- state ---------- */
const HOUSE_KEYS = ['v','dogs','active','family','links','bones','inv','upgrades','ach','packs','legendaries','chest','quests','questsDone','games'];
function migrate(s){
  s = s && typeof s === 'object' ? s : {};
  const d = {v:4, dogs:[], active:null, family:[], links:{}, bones:0, inv:[], upgrades:{}, walks:[], checkins:{}, ach:{}, packs:0, legendaries:0, chest:{last:'', streak:0, seven:0}, quests:{day:'', claimed:[]}, questsDone:0, games:{day:'', plays:0, best:{}, top:0}};
  Object.keys(d).forEach(k => { if (s[k] === undefined || s[k] === null) s[k] = d[k]; });
  s.games = Object.assign({day:'', plays:0, best:{}, top:0}, s.games);
  s.chest = Object.assign({last:'', streak:0, seven:0}, s.chest);
  s.quests = Object.assign({day:'', claimed:[]}, s.quests);
  s.dogs.forEach(dg => { if (!BREEDS[dg.look]) dg.look = dg.look === 'choc' ? 'choclab' : 'golden'; dg.eq = dg.eq || {}; });
  return s;
}
let S = migrate({});
let HH = null;               // {id, name, invite_code}
let MEMBERS = [];            // [{user_id, display_name, avatar_url}]
let ME = {id:null, name:'', avatar:''};
let MYPACKS = [];
const houseOf = () => { const o = {}; HOUSE_KEYS.forEach(k => { o[k] = S[k]; }); return o; };

/* ---------- persistence ---------- */
let houseTimer = null, houseDirty = false, houseWriting = false, saving = 0;
function setSaving(d){ saving = Math.max(0, saving + d); const dot = $('#save-dot'); if (dot) dot.classList.toggle('busy', saving > 0); }
function saveDemo(){ lsSet('walkies-demo', JSON.stringify(S)); }
function saveHouse(){
  if (DEMO) return saveDemo();
  if (!HH) return;
  houseDirty = true; clearTimeout(houseTimer); houseTimer = setTimeout(writeHouse, 450);
}
async function writeHouse(){
  if (houseWriting) { clearTimeout(houseTimer); houseTimer = setTimeout(writeHouse, 300); return; }
  houseWriting = true; houseDirty = false; setSaving(1);
  const { error } = await sb.from('households').update({state: clone(houseOf())}).eq('id', HH.id);
  houseWriting = false; setSaving(-1);
  if (error) { toast('Saving failed. Trying again.'); houseDirty = true; }
  if (houseDirty) { clearTimeout(houseTimer); houseTimer = setTimeout(writeHouse, error ? 3000 : 300); }
}
const walkRowOut = w => ({id:w.id, household_id:HH.id, dog_id:w.dogId, user_id:w.by || null, who:w.who || null, t:w.t, min:w.min, pee:!!w.pee, poo:!!w.poo, note:w.note || '', xp:w.xp, bones:w.bones, pts:w.pts});
const walkRowIn = r => ({id:r.id, dogId:r.dog_id, by:r.user_id, who:r.who || '', t:Number(r.t), min:r.min, pee:r.pee, poo:r.poo, note:r.note || '', xp:r.xp, bones:r.bones, pts:r.pts});
const ciRowOut = (k, dogId, c) => ({id:k + '_' + dogId, household_id:HH.id, dog_id:dogId, day:k, user_id:c.by || null, who:c.who || null, answers:c.answers, score:c.score, walk_pts:c.walkPts, xp:c.xp, bones:c.bones, note:c.note || '', t:c.t});
const ciRowIn = r => ({t:Number(r.t), by:r.user_id, who:r.who || '', answers:r.answers || {}, score:r.score, walkPts:r.walk_pts, xp:r.xp, bones:r.bones, note:r.note || ''});
async function putWalk(w){ if (DEMO) return saveDemo(); setSaving(1); const { error } = await sb.from('walks').upsert(walkRowOut(w)); setSaving(-1); if (error) toast('That walk could not be saved: ' + error.message); }
async function delWalkDoc(id){ if (DEMO) return saveDemo(); setSaving(1); await sb.from('walks').delete().eq('id', id); setSaving(-1); }
async function putCheckin(k, dogId, c){ if (DEMO) return saveDemo(); setSaving(1); const { error } = await sb.from('checkins').upsert(ciRowOut(k, dogId, c)); setSaving(-1); if (error) toast('The check-in could not be saved: ' + error.message); }

let channel = null;
async function loadHousehold(id){
  setSplash('Fetching your pack…');
  const [h, m, w, c] = await Promise.all([
    sb.from('households').select('id,name,invite_code,state').eq('id', id).single(),
    sb.from('members').select('user_id,display_name,avatar_url').eq('household_id', id),
    sb.from('walks').select('*').eq('household_id', id).order('t', {ascending:false}).limit(1000),
    sb.from('checkins').select('*').eq('household_id', id).order('day', {ascending:false}).limit(1000)
  ]);
  if (h.error) { toast('Could not open that pack.'); lsDel('walkies-hh'); return renderPackChoice(); }
  HH = {id:h.data.id, name:h.data.name, invite_code:h.data.invite_code};
  lsSet('walkies-hh', HH.id);
  S = migrate(clone(h.data.state || {}));
  MEMBERS = m.data || [];
  S.walks = (w.data || []).map(walkRowIn);
  S.checkins = {}; (c.data || []).forEach(r => { S.checkins[r.day + '|' + r.dog_id] = ciRowIn(r); });
  subscribe(id);
  renderAll();
}
function subscribe(id){
  if (channel) sb.removeChannel(channel);
  channel = sb.channel('pack-' + id)
    .on('postgres_changes', {event:'*', schema:'public', table:'walks', filter:'household_id=eq.' + id}, p => {
      if (p.eventType === 'DELETE') { const before = S.walks.length; S.walks = S.walks.filter(x => x.id !== p.old.id); if (S.walks.length !== before) scheduleRender(); return; }
      const w = walkRowIn(p.new), i = S.walks.findIndex(x => x.id === w.id);
      if (i >= 0) { if (JSON.stringify(S.walks[i]) === JSON.stringify(Object.assign({}, S.walks[i], w))) return; S.walks[i] = Object.assign(S.walks[i], w); } else S.walks.push(w);
      scheduleRender();
    })
    .on('postgres_changes', {event:'*', schema:'public', table:'checkins', filter:'household_id=eq.' + id}, p => {
      if (p.eventType === 'DELETE') return;
      const k = p.new.day + '|' + p.new.dog_id; const had = !!S.checkins[k];
      S.checkins[k] = ciRowIn(p.new); if (!had) scheduleRender();
    })
    .on('postgres_changes', {event:'UPDATE', schema:'public', table:'households', filter:'id=eq.' + id}, p => {
      if (houseDirty || houseWriting) return;
      const before = JSON.stringify(houseOf()), d = p.new.state || {};
      HOUSE_KEYS.forEach(k => { if (d[k] !== undefined) S[k] = d[k]; });
      S = migrate(S);
      if (JSON.stringify(houseOf()) !== before) scheduleRender();
    })
    .on('postgres_changes', {event:'*', schema:'public', table:'members', filter:'household_id=eq.' + id}, async () => {
      const { data } = await sb.from('members').select('user_id,display_name,avatar_url').eq('household_id', id);
      MEMBERS = data || MEMBERS; scheduleRender();
    })
    .subscribe();
}
let renderQueued = false;
function scheduleRender(){
  if (renderQueued) return; renderQueued = true;
  setTimeout(() => { renderQueued = false; if (!S.dogs.length) { if (!$('#setup-form')) renderAll(); } else renderMain(); }, 80);
}
function setSplash(msg){ shell.innerHTML = '<div class="splash"><b>Walkies</b><span>' + esc(msg) + '</span></div>'; }

/* ---------- local daily counters (this device) ---------- */
function dayLocal(){ const k = 'walkies-day-' + dayKey(); let o; try { o = JSON.parse(lsGet(k) || '{}'); } catch(e){ o = {}; } return Object.assign({pets:0, tricks:0, style:0, gameBest:0, moves:0, crate:0}, o); }
function bumpLocal(field, v){ const o = dayLocal(); o[field] = v == null ? (o[field] || 0) + 1 : Math.max(o[field] || 0, v); lsSet('walkies-day-' + dayKey(), JSON.stringify(o)); return o; }

/* ---------- game math ---------- */
const up = id => S.upgrades[id] || 0;
function level(xp){ let L = 1; while (xp >= 50*L*(L+1)) L++; return L; }
const xpFloor = L => 50*(L-1)*L, xpNext = L => 50*L*(L+1);
const title = L => TITLES[Math.min(L-1, TITLES.length-1)];
const grade = s => s >= 95 ? 'S' : s >= 80 ? 'A' : s >= 65 ? 'B' : s >= 50 ? 'C' : s >= 30 ? 'D' : 'F';
const upCost = (u, l) => Math.round(u.base * Math.pow(1.7, l) / 10) * 10;
const bedBoost = () => 1 + .05*up('bed');
function walkReward(min, pee, poo){
  const m = Math.max(0, Math.min(min, 90));
  const xp = 20 + m, bones = 10 + Math.floor(m/3) + (pee?2:0) + (poo?2:0), lm = 1 + .15*up('leash');
  return {xp: Math.round(xp*lm*(1+.1*up('clicker'))*bedBoost()), bones: Math.round(bones*lm*(1+.1*up('jar'))*bedBoost()), pts: 10 + Math.floor(m/3)};
}
function checkinReward(score){
  const bones = Math.round(score/2) + (score >= 100 ? 30 : 0);
  return {xp: Math.round(score*(1+.1*up('clicker'))*bedBoost()), bones: Math.round(bones*(1+.1*up('jar'))*bedBoost())};
}
const walksOn = (dogId, k) => S.walks.filter(w => (!dogId || w.dogId === dogId) && dayKey(new Date(w.t)) === k);
const walkPts = n => n >= 2 ? WALK_W : n === 1 ? 15 : 0;
function scoreFor(dog, k, answers){
  const wp = walkPts(walksOn(dog.id, k).length); let s = wp;
  QUESTIONS.forEach(q => { if (answers[q.id] === true) s += q.w; });
  return {score:s, walkPts:wp};
}
const ci = (dogId, k) => S.checkins[k + '|' + dogId];
function careScore(dog){
  const t = dayKey(), start = dayKey(new Date(dog.created)); let sum = 0, n = 0;
  for (let i = 0; i < 7; i++) { const k = addDays(t, -i); if (k < start) break; const c = ci(dog.id, k); if (i === 0 && !c) continue; sum += c ? c.score : 0; n++; }
  return n ? Math.round(sum/n) : null;
}
function curStreak(id){
  const ok = k => { const c = ci(id, k); return c && c.score >= 50; };
  let k = dayKey(); if (!ok(k)) k = addDays(k, -1);
  let n = 0; while (ok(k)) { n++; k = addDays(k, -1); }
  return n;
}
function bestStreak(id){
  const ks = Object.keys(S.checkins).filter(k => k.split('|')[1] === id && S.checkins[k].score >= 50).map(k => k.split('|')[0]).sort();
  let best = 0, run = 0, prev = null;
  ks.forEach(k => { run = (prev && addDays(prev,1) === k) ? run + 1 : 1; best = Math.max(best, run); prev = k; });
  return best;
}
function stats(){
  const byDay = {}; let maxMin = 0, early = 0, late = 0, perfect = 0, checks = 0;
  S.walks.forEach(w => { const k = w.dogId + dayKey(new Date(w.t)); byDay[k] = (byDay[k]||0) + 1; maxMin = Math.max(maxMin, w.min); const h = new Date(w.t).getHours(); if (h < 7) early = 1; if (h >= 21) late = 1; });
  Object.values(S.checkins).forEach(c => { checks++; if (c.score >= 100) perfect = 1; });
  return {
    walks:S.walks.length, maxMin, maxDay:Math.max(0, ...Object.values(byDay)), early, late, perfect, checks:Math.min(checks,1),
    best:Math.max(0, ...S.dogs.map(d => bestStreak(d.id))), packs:S.packs, leg:S.legendaries,
    owned:S.inv.filter(i => ITEM[i] && ITEM[i].slot !== 'chroma').length, chromas:S.inv.filter(i => ITEM[i] && ITEM[i].slot === 'chroma').length,
    lvl:Math.max(1, ...S.dogs.map(d => level(d.xp))),
    worn:Math.max(0, ...S.dogs.map(d => Object.keys(d.eq||{}).filter(k => d.eq[k] && k !== 'chroma').length)),
    quests:S.questsDone, chest7:S.chest.seven ? 1 : 0, game:S.games.top || 0
  };
}
function checkAch(){
  const st = stats(), out = [];
  ACH.forEach(a => { if (S.ach[a.id]) return; const p = a.p(st); if (p[0] >= p[1]) { S.ach[a.id] = Date.now(); S.bones += a.reward; out.push(a); } });
  return out;
}
function grant(dog, r){ const b = level(dog.xp); dog.xp += r.xp; S.bones += r.bones; const a = level(dog.xp); return a > b ? a : 0; }
const activeDog = () => S.dogs.find(d => d.id === S.active) || S.dogs[0];
const pron = dog => dog.pronoun === 'she' ? {sub:'she', obj:'her'} : {sub:'he', obj:'him'};
let wakeUntil = 0;
const isNight = () => { const h = new Date().getHours(); return (h >= 22 || h < 6) && Date.now() > wakeUntil; };
const walkStart = dog => dog && dog.walk && dog.walk.since ? dog.walk.since : 0;
const crateMins = dog => dog.crate && dog.crate.since ? (Date.now() - dog.crate.since) / 60000 : 0;
function moodOf(dog){
  const now = Date.now(); let last = dog.created;
  S.walks.forEach(w => { if (w.dogId === dog.id && w.t > last) last = w.t; });
  const hrs = (now - last) / 36e5, today = walksOn(dog.id, dayKey()).length, c = ci(dog.id, dayKey()), night = isNight(), cm = crateMins(dog);
  let v = 55 + Math.min(today,2)*18 + (c ? c.score*.15 : 0) - Math.max(0, hrs-6)*5 + (walkStart(dog) ? 20 : 0) - (night ? 0 : Math.max(0, cm/60 - 2)*12);
  v = Math.round(Math.max(3, Math.min(100, v)));
  const m = v >= 85 ? ['ecstatic','Over the moon','.17s'] : v >= 65 ? ['happy','Happy','.26s'] : v >= 45 ? ['content','Content','.45s'] : v >= 25 ? ['restless','Restless','.8s'] : ['sad','Missing you','1.4s'];
  const sleep = night && !walkStart(dog), crated = !!(dog.crate && dog.crate.since), long = crated && !night && cm > 120;
  return {v, k: sleep ? 'sleep' : long ? 'sad' : m[0], label: sleep ? (crated ? 'Asleep in crate' : 'Sleeping') : long ? 'Wants out' : crated ? 'In the crate' : m[1], wag:m[2], sleep, crated, long};
}

/* ---------- people ---------- */
const recKey = r => r.by ? 'u:' + r.by : (S.links && S.links[r.who] ? 'u:' + S.links[r.who] : 'n:' + (r.who || 'Me'));
const memberOf = id => MEMBERS.find(m => m.user_id === id);
function personName(key){
  if (key.indexOf('u:') === 0) { const id = key.slice(2), m = memberOf(id); return (m && m.display_name) || (id === ME.id ? (ME.name || 'You') : 'Family member'); }
  return key.slice(2);
}
function personAvatar(key){
  if (key.indexOf('u:') === 0) { const m = memberOf(key.slice(2)); const src = (m && m.avatar_url) || (key.slice(2) === ME.id ? ME.avatar : ''); if (src) return '<img class="avatar" src="'+esc(src)+'" alt="" referrerpolicy="no-referrer">'; }
  const n = personName(key), cl = ['#ffb547','#ff6b8b','#4ade80','#4aa8ff','#b47cff','#5ec8f2'][hashStr(n) % 6];
  return '<span class="avatar" style="background:'+cl+'">'+esc(n.slice(0,1).toUpperCase())+'</span>';
}
function peopleKeys(){
  const out = [];
  if (ME.id) out.push('u:' + ME.id);
  MEMBERS.forEach(m => { if (m.user_id !== ME.id) out.push('u:' + m.user_id); });
  S.family.forEach(n => { if (!(S.links && S.links[n])) out.push('n:' + n); });
  if (!out.length) out.push('n:Me');
  return out;
}
const lastWho = () => { const w = lsGet('walkies-who3'), ks = peopleKeys(); return ks.indexOf(w) >= 0 ? w : ks[0]; };
const whoOptions = sel => peopleKeys().map(k => '<option value="'+esc(k)+'" '+(k === sel ? 'selected' : '')+'>'+esc(personName(k) + (k === 'u:' + ME.id ? ' (you)' : ''))+'</option>').join('');
const whoFields = key => key.indexOf('u:') === 0 ? {by:key.slice(2), who:''} : {by:null, who:key.slice(2)};
const isMe = key => !!ME.id && key === 'u:' + ME.id;

/* ---------- quests and chest ---------- */
function todayQuests(){
  const t = dayKey(); let h = hashStr(t + (S.dogs[0] ? S.dogs[0].id : ''));
  const walkQ = QUEST_POOL.filter(q => q.walk), other = QUEST_POOL.filter(q => !q.walk), out = [walkQ[h % walkQ.length]], pool = other.slice();
  for (let i = 0; i < 2; i++) { h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0; out.push(pool.splice(h % pool.length, 1)[0]); }
  return out;
}
function questProg(q){
  const t = dayKey(), ws = walksOn(null, t), loc = dayLocal(), cis = S.dogs.map(d => ci(d.id, t)).filter(Boolean);
  switch (q.id) {
    case 'walk2': return ws.length;
    case 'mins45': return ws.reduce((a,w) => a + w.min, 0);
    case 'ci': return cis.length ? 1 : 0;
    case 'ci80': return Math.max(0, ...cis.map(c => c.score));
    case 'pet25': return loc.pets;
    case 'game300': return loc.gameBest;
    case 'tricks3': return loc.tricks;
    case 'style': return loc.style;
    case 'crate': return loc.crate;
    case 'move': return loc.moves;
  }
  return 0;
}
const questClaimed = id => S.quests.day === dayKey() && S.quests.claimed.indexOf(id) >= 0;
function chestState(){
  const c = S.chest, t = dayKey(), claimed = c.last === t, cont = c.last === addDays(t, -1);
  return {claimed, next: claimed ? c.streak : (cont ? (c.streak % 7) + 1 : 1), streak: claimed || cont ? c.streak : 0};
}

/* ---------- UI helpers ---------- */
const shell = $('#app-shell'), layer = $('#modal-layer');
let onModalClose = null;
function toast(msg){ const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3400); }
const modalOpen = () => layer.classList.contains('open');
function openModal(html, cls, onClose){
  layer.innerHTML = '<div class="backdrop" data-act="close-modal"></div><div class="modal '+(cls||'')+'" role="dialog" aria-modal="true">'+html+'</div>';
  layer.classList.add('open'); onModalClose = onClose || null;
  const f = layer.querySelector('[autofocus]') || layer.querySelector('.modal button, .modal input'); if (f) setTimeout(() => f.focus(), 30);
}
function closeModal(){ layer.classList.remove('open'); layer.innerHTML = ''; const f = onModalClose; onModalClose = null; if (f) f(); }
let tab = 'today';
function readHash(){ const h = location.hash.slice(1); if (TABS.some(t => t[0] === h)) tab = h; }
function setHash(){ try { if (location.hash.slice(1) !== tab) history.replaceState(null, '', location.pathname + location.search + '#' + tab); } catch(e){} }

/* ---------- confetti ---------- */
let parts = [], fxRun = false;
function confetti(n){
  if (RM) return;
  const c = $('#fx'), W = innerWidth, H = innerHeight, cols = ['#ffb547','#ff6b8b','#4ade80','#4aa8ff','#b47cff','#ffe08a'];
  for (let i = 0; i < (n||120); i++) parts.push({x:W/2 + (Math.random()-.5)*120, y:H*.38, vx:(Math.random()-.5)*14, vy:-Math.random()*13-4, r:Math.random()*6+4, c:cols[i%cols.length], a:Math.random()*6, va:(Math.random()-.5)*.3, life:1});
  if (fxRun) return; fxRun = true;
  const ctx = c.getContext('2d');
  (function loop(){
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== innerWidth*dpr) { c.width = innerWidth*dpr; c.height = innerHeight*dpr; }
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,innerWidth,innerHeight);
    parts.forEach(p => { p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; p.life -= .006; ctx.save(); ctx.globalAlpha = Math.max(0,p.life); ctx.translate(p.x,p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r/2,-p.r/4,p.r,p.r/2); ctx.restore(); });
    parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 40);
    if (parts.length) requestAnimationFrame(loop); else { ctx.clearRect(0,0,innerWidth,innerHeight); fxRun = false; }
  })();
}

/* ---------- the 3D stage (one instance, kept across renders) ---------- */
let STAGE = null, stageHost = null, stageSig = '', bubbleUntil = 0, bubbleText = '';
function ensureStage(){
  if (STAGE) return;
  stageHost = document.createElement('div'); stageHost.id = 'stage-host';
  STAGE = createStage(stageHost, {
    say: t => say(t),
    onPet: () => { bumpLocal('pets'); refreshQuests(); const d = activeDog(); if (d && Math.random() < .5) say(thought(d)); },
    onWake: () => { wakeUntil = Date.now() + 90000; say('*yawn* Oh! You’re here!'); setTimeout(renderStageChrome, 50); },
    onMove: () => { bumpLocal('moves'); refreshQuests(); }
  });
  (function follow(){
    requestAnimationFrame(follow);
    const b = $('#bubble'); if (!b || !STAGE) return;
    const p = STAGE.headScreen(); if (!p) return;
    b.style.left = p.x + 'px'; b.style.top = p.y + 'px';
    b.classList.toggle('hide', Date.now() > bubbleUntil);
  })();
}
function say(t, ms){ bubbleText = t; bubbleUntil = Date.now() + (ms || 2600); const b = $('#bubble'); if (b) { b.textContent = t; b.classList.remove('hide'); } }
function syncStage(){
  const dog = activeDog(); if (!dog || !STAGE) return;
  const sig = dog.id + dog.look + JSON.stringify(dog.eq || {});
  if (sig !== stageSig) { stageSig = sig; STAGE.setDog(dog); }
  const m = moodOf(dog);
  STAGE.setState({mood:m.v, wag:m.wag, sleep:m.sleep, crated:m.crated, walking:!!walkStart(dog), night:isNight()});
}

/* ---------- thoughts ---------- */
function thought(dog){
  const h = new Date().getHours(), m = moodOf(dog), today = walksOn(dog.id, dayKey()).length, pick = a => a[Math.floor(Math.random()*a.length)];
  if (m.long) return pick(['Woof! WOOF! Let me out!','Hellooo? Crate door, please!','Arf arf arf!!']);
  if (m.crated && !m.sleep) return pick(['Crate time…','I can see you from here.','Is it time yet?']);
  if (m.sleep) return pick(['Zzz… dreaming of squirrels.','Zzz… five more minutes.']);
  if (walkStart(dog)) return pick(['Sniff. Sniff. Sniff.','This is the best walk ever.','Squirrel!!']);
  if (!today && h >= 8) return pick(['Walk? Walk?? WALK???','I heard the leash jingle.','Is it walk o’clock yet?']);
  if (h >= 18 && !ci(dog.id, dayKey())) return pick(['How did we do today?','Check-in time! Tell them I was good.']);
  if (m.v >= 75) return pick(['Best. Day. Ever.','I love you this much.','Belly rub please.']);
  return pick(['Hi! Hi! Hi!','Is that a treat?','Throw the ball. Throw it.','Teach me a new trick?']);
}

/* ---------- auth and pack screens ---------- */
function renderSignIn(){
  shell.innerHTML = '<div class="auth"><div class="auth-card">' +
    '<div class="brand">'+icon('paw',22)+'<span>Walkies</span></div>' +
    '<h1>Look after your dog together</h1><p>Sign in, create your pack, then invite your family. Everyone’s walks and check-ins count toward who treats the dog best.</p>' +
    '<button class="gbtn" data-act="google"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Continue with Google</button>' +
    '<div class="or">or</div>' +
    '<form id="email-form" class="field" style="gap:8px"><label for="em">Email me a sign-in link</label><div class="inline-form" style="margin:0"><input id="em" type="email" required placeholder="you@gmail.com" autocomplete="email"><button class="btn ghost" type="submit">Send</button></div></form>' +
    '<p style="font-size:13px">Just looking? <a href="?demo#today" style="color:var(--accent);font-weight:800">Try the demo</a> (saves on this device only).</p>' +
  '</div></div>';
}
function renderPackChoice(){
  const code = lsGet('walkies-join') || '';
  shell.innerHTML = '<div class="auth"><div class="auth-card">' +
    '<div class="brand">'+icon('paw',22)+'<span>Walkies</span></div>' +
    '<h1>Hi '+esc((ME.name || '').split(' ')[0] || 'there')+'!</h1><p>Join your family’s pack with their code, or start a new pack for your dog.</p>' +
    '<form id="join-form" class="field" style="gap:8px"><label for="jc">Pack code</label><div class="inline-form" style="margin:0"><input id="jc" maxlength="12" placeholder="e.g. CAMPER" value="'+esc(code)+'" style="text-transform:uppercase;letter-spacing:.1em;font-weight:800"><button class="btn primary" type="submit">Join</button></div></form>' +
    '<div class="or">or</div>' +
    '<button class="btn ghost big" data-act="new-pack">'+icon('plus',18)+' Start a new pack</button>' +
    '<p style="font-size:13px"><a href="#" data-act="sign-out" style="color:var(--muted)">Sign out</a></p>' +
  '</div></div>';
}

/* ---------- render ---------- */
function renderAll(){ if (!S.dogs.length) renderSetup(); else renderMain(); }
let setupDraft = null;
function renderSetup(){
  setupDraft = setupDraft || {name:'', look:'golden', pronoun:'he'};
  shell.innerHTML =
    '<div class="setup"><div class="setup-card">' +
      '<div class="setup-stage" id="setup-stage" style="display:grid;place-items:center"><img id="setup-dog" class="thumb3d" style="width:300px" src="'+thumb({look:setupDraft.look, eq:{}}, 300)+'" alt=""></div>' +
      '<form class="setup-form" id="setup-form">' +
        '<div class="brand">' + icon('paw',22) + '<span>Walkies</span></div>' +
        '<h1>Meet your walking buddy</h1>' +
        '<p>Log walks, answer a short check-in every night, and earn bones for packs, chromas, upgrades and trophies.</p>' +
        dogFields(setupDraft) +
        '<button class="btn primary big" type="submit">' + icon('paw',20) + ' Start the adventure</button>' +
      '</form>' +
    '</div></div>';
}
function dogFields(d){
  return '<div class="row2"><div class="field"><label for="df-name">Dog’s name</label><input id="df-name" maxlength="20" required placeholder="e.g. Biscuit" value="'+esc(d.name)+'"></div>' +
    '<div class="field"><span class="flabel">Pronoun</span><div class="chips">'+pronChips(d.pronoun)+'</div></div></div>' +
    '<div class="field"><span class="flabel">Breed · ' + BREED_KEYS.length + ' to choose from</span><div class="looks" id="looks">' + BREED_KEYS.map(k => '<button type="button" class="look '+(d.look === k ? 'on' : '')+'" data-act="pick-look" data-look="'+k+'"><img alt="" data-thumb="'+k+'">'+BREEDS[k].name+'</button>').join('') + '</div></div>';
}
function fillLookThumbs(){
  const imgs = Array.from(document.querySelectorAll('img[data-thumb]'));
  let i = 0;
  (function next(){ if (i >= imgs.length) return; const im = imgs[i++]; if (im.isConnected) im.src = thumb({look: im.dataset.thumb, eq:{}}, 112); setTimeout(next, 0); })();
}
const pronChips = p => [['he','He / him'],['she','She / her']].map(x => '<button type="button" class="chip '+(p === x[0] ? 'on' : '')+'" data-act="pick-pron" data-p="'+x[0]+'">'+x[1]+'</button>').join('');

const gamesAllowed = () => 3 + up('arcade');
const gamesLeft = () => Math.max(0, gamesAllowed() - (S.games.day === dayKey() ? S.games.plays : 0));
function renderMain(){
  const dog = activeDog(); if (!dog) return renderSetup();
  S.active = dog.id;
  const y = window.scrollY, streak = curStreak(dog.id), cs = chestState();
  const qReady = todayQuests().some(q => !questClaimed(q.id) && questProg(q) >= q.goal);
  ensureStage();
  shell.innerHTML =
    '<header class="topbar">' +
      '<div class="brand">' + icon('paw',22) + '<span>Walkies</span></div>' +
      (S.dogs.length > 1 ? '<div class="dog-switch">' + S.dogs.map(d => '<button class="chip '+(d.id === dog.id ? 'on' : '')+'" data-act="switch-dog" data-id="'+d.id+'">'+esc(d.name)+'</button>').join('') + '</div>' : '') +
      '<div class="wallet"><span class="stat" id="bones-stat" title="Bones to spend">' + icon('bone',18) + '<b>' + S.bones + '</b></span><span class="stat streak" title="Check-in streak in days">' + icon('flame',18) + '<b>' + streak + '</b></span></div>' +
    '</header>' +
    '<div class="layout"><aside class="stage-card" id="stage-card"></aside>' +
      '<main><nav class="tabs" role="tablist" aria-label="Sections">' + TABS.map(t => {
        const dot = (t[0] === 'today' && (!cs.claimed || qReady)) || (t[0] === 'checkin' && new Date().getHours() >= 17 && !ci(dog.id, dayKey())) || (t[0] === 'packs' && S.bones >= PACKS[0].cost) || (t[0] === 'play' && gamesLeft() > 0);
        return '<button class="tab '+(tab === t[0] ? 'on' : '')+'" role="tab" aria-selected="'+(tab === t[0])+'" data-act="tab" data-tab="'+t[0]+'">'+t[1]+(dot ? '<i class="dot"></i>' : '')+'</button>';
      }).join('') + '</nav><section class="panel" id="panel"></section></main></div>' +
    '<footer class="foot" id="foot"></footer>';
  renderStageChrome(); renderPanel(); renderFoot();
  window.scrollTo(0, y);
}
function renderFoot(){
  const f = $('#foot'); if (!f) return;
  f.innerHTML = DEMO ? (FORCE_DEMO ? '<span class="save-dot local" id="save-dot"></span> Test version: saved in this browser only. Sign-in and family sync work on the Vercel version.' : '<span class="save-dot local" id="save-dot"></span> Demo mode: saved on this device only. <a href="./" style="color:var(--accent);font-weight:800;margin-left:6px">Sign in to share with family</a>')
    : '<span class="save-dot" id="save-dot"></span> ' + esc(HH ? HH.name : '') + ' · saves automatically and syncs live with your family.' + '<span style="margin-left:auto" class="person">'+personAvatar('u:'+ME.id)+'<span>'+esc(ME.name)+'</span></span><button class="btn ghost small" data-act="sign-out" style="margin-left:0">Sign out</button>';
}
function renderStageChrome(){
  const card = $('#stage-card'); if (!card) return;
  const dog = activeDog(), m = moodOf(dog), L = level(dog.xp), care = careScore(dog), ws = walkStart(dog);
  const pct = Math.round((dog.xp - xpFloor(L)) / (xpNext(L) - xpFloor(L)) * 100);
  const careG = care == null ? null : grade(care), chId = dog.eq && dog.eq.chroma;
  card.innerHTML =
    '<div class="stage-top"><div><h1 class="dog-name">'+esc(dog.name)+'</h1><div class="lvl">Level '+L+' · '+title(L)+'</div><div class="breed-line">'+BREEDS[dog.look].name+(chId ? ' · '+CHROMAS[chId].name+' chroma' : '')+'</div></div>' +
      '<div class="ring" title="7-day care score" style="--p:'+(care||0)+';--ring-c:'+(careG ? GCOL[careG] : 'var(--line)')+'"><div><b>'+(care == null ? '–' : care)+'</b><small>Care</small></div></div></div>' +
    '<div class="stage3d" id="stage3d"><div class="bubble hide" id="bubble"></div>' +
      '<div class="pet-hint">Drag to spin · tap '+esc(dog.name)+' to pet · tap the floor to walk</div>' +
      '<button class="view-btn" data-act="reset-view">Reset view</button>' +
      (ws ? '<div class="walk-pill">On a walk · <span data-timer="'+ws+'">0:00</span></div>' : '') +
      (m.crated ? '<div class="crate-pill'+(m.long ? ' long' : '')+'">In crate · <span data-timer="'+dog.crate.since+'">0:00</span></div>' : '') +
      '<div class="mood-pill mood-'+m.k+'">'+m.label+'</div></div>' +
    '<div class="stage-actions">' + (m.crated
      ? '<button class="btn good" data-act="crate-out">'+icon('heart',16)+' Let '+esc(dog.name)+' out</button>'
      : '<button class="btn ghost" data-act="crate-in">'+icon('lock',15)+' Put in crate</button>') + '</div>' +
    '<div class="tricks" aria-label="Tricks">' + TRICKS.map(tr => L >= tr.lvl
      ? '<button class="trick" data-act="trick" data-id="'+tr.id+'"'+(m.crated ? ' disabled title="Let '+esc(dog.name)+' out first"' : '')+'>'+tr.name+'</button>'
      : '<button class="trick" disabled title="Unlocks at level '+tr.lvl+'">'+icon('lock',11)+tr.name+' <small>Lv '+tr.lvl+'</small></button>').join('') + '</div>' +
    '<div class="bar-row"><div class="bar-label"><span>XP</span><span>'+(dog.xp - xpFloor(L))+' / '+(xpNext(L) - xpFloor(L))+' to Lv '+(L+1)+'</span></div><div class="bar"><i style="width:'+pct+'%"></i></div></div>' +
    '<div class="bar-row"><div class="bar-label"><span>Mood</span><span>'+m.v+'%</span></div><div class="bar mood"><i style="width:'+m.v+'%"></i></div></div>';
  $('#stage3d').prepend(stageHost);
  syncStage(); tickTimers();
  if (Date.now() > bubbleUntil && Math.random() < .6) setTimeout(() => say(thought(dog), 3500), 600);
  else if (Date.now() < bubbleUntil) say(bubbleText, bubbleUntil - Date.now());
}
function renderPanel(){
  const el = $('#panel'); if (!el) return;
  const fn = {today:pToday, checkin:pCheckin, walks:pWalks, play:pPlay, closet:pCloset, packs:pPacks, shop:pShop, trophies:pTrophies, family:pFamily}[tab] || pToday;
  el.innerHTML = fn(activeDog());
  tickTimers(); fillLookThumbs();
}

/* ---------- panels ---------- */
function walkRow(w){
  const tags = (w.pee ? '<span class="tag">Pee</span>' : '') + (w.poo ? '<span class="tag">Poo</span>' : '');
  return '<div class="walk-row" style="grid-template-columns:64px minmax(0,1fr) auto auto"><div class="w-time">'+fmtTime(w.t)+'</div><div class="w-main"><b>'+w.min+' min</b> <span class="muted">· '+esc(personName(recKey(w)))+'</span>'+tags+(w.note ? '<div class="muted">'+esc(w.note)+'</div>' : '')+'</div>' +
    '<div class="w-reward">+'+w.bones+icon('bone',14)+'</div><button class="icon-btn" data-act="del-walk" data-id="'+w.id+'" aria-label="Remove walk">'+icon('x',16)+'</button></div>';
}
function fmtDur(min){ min = Math.round(min); return min >= 60 ? Math.floor(min/60) + 'h ' + (min % 60) + 'm' : min + 'm'; }
function crateToday(dog){
  const start = keyDate(dayKey()).getTime(); let total = 0;
  (dog.crateLog || []).forEach(s => { if (s.e > start) total += (s.e - Math.max(s.s, start)) / 60000; });
  if (dog.crate && dog.crate.since) total += (Date.now() - Math.max(dog.crate.since, start)) / 60000;
  return total;
}
function chestCard(){
  const cs = chestState(); let days = '';
  for (let i = 1; i <= 7; i++) { const got = cs.claimed ? i <= cs.next : i < cs.next; days += '<span class="'+(got ? 'got' : '')+(!cs.claimed && i === cs.next ? ' next' : '')+'">'+(i === 7 ? icon('gift',13) : 'D'+i)+'</span>'; }
  return '<div class="card chest"><div class="chest-art '+(cs.claimed ? 'done' : 'ready')+'">'+icon('gift',34)+'</div><div><h3>Daily treat chest</h3><p>'+(cs.claimed ? 'Claimed today. Come back tomorrow to keep your streak.' : 'Day '+cs.next+' of 7: '+CHEST[cs.next - 1]+' bones'+(cs.next === 7 ? ' plus a free Good Dog Pack' : '')+'. Miss a day and it resets to day 1.')+'</p><div class="chest-days">'+days+'</div></div>' +
    '<button class="btn '+(cs.claimed ? 'ghost' : 'primary')+'" data-act="chest" '+(cs.claimed ? 'disabled' : '')+'>'+(cs.claimed ? 'Claimed' : 'Open chest')+'</button></div>';
}
function questsCard(){
  return '<div class="card" id="quests-card"><h3>Daily quests <small>New quests at midnight</small></h3><div class="quests">' + todayQuests().map(q => {
    const pr = Math.min(questProg(q), q.goal), done = pr >= q.goal, cl = questClaimed(q.id);
    return '<div class="quest '+(cl ? 'claimed' : done ? 'ready' : '')+'"><div class="q-ic">'+icon(q.ic,20)+'</div><div><b>'+q.text+'</b><div class="bar thin"><i style="width:'+Math.round(pr/q.goal*100)+'%"></i></div><small>'+pr+' / '+q.goal+'</small></div>' +
      (cl ? '<span class="muted" style="font-weight:800;font-size:13px">'+icon('check',14)+' Done</span>' : '<button class="btn small '+(done ? 'primary' : 'ghost')+'" data-act="claim-quest" data-id="'+q.id+'" '+(done ? '' : 'disabled')+'>'+icon('bone',13)+' '+q.reward+'</button>') + '</div>';
  }).join('') + '</div></div>';
}
function refreshQuests(){ const q = $('#quests-card'); if (q) { const tmp = document.createElement('div'); tmp.innerHTML = questsCard(); q.replaceWith(tmp.firstChild); } }
function pToday(dog){
  const t = dayKey(), ws = walksOn(dog.id, t), mins = ws.reduce((a,w) => a + w.min, 0), c = ci(dog.id, t), care = careScore(dog), run = walkStart(dog), h = new Date().getHours(), ct = crateToday(dog);
  let html = '<div class="panel-head"><div><h2>Today</h2><p>'+new Date().toLocaleDateString(undefined, {weekday:'long', day:'numeric', month:'long'})+'</p></div></div>';
  if (!c && h >= 17) html += '<button class="banner" data-act="tab" data-tab="checkin">'+icon('report',22)+'Tonight’s check-in is ready. Score up to 100 points for '+esc(dog.name)+'.<span>Start →</span></button>';
  html += '<div class="tiles">' +
    '<div class="tile"><span class="k">Walks</span><span class="v">'+ws.length+'<span class="muted" style="font-size:16px"> / 2</span></span><span class="s">'+(ws.length >= 2 ? 'Daily goal done' : (2 - ws.length)+' more for full points')+'</span></div>' +
    '<div class="tile"><span class="k">Minutes</span><span class="v">'+mins+'</span><span class="s">Walked today'+(ct >= 1 ? ' · crate '+fmtDur(ct) : '')+'</span></div>' +
    '<div class="tile"><span class="k">Check-in</span>'+(c ? '<span class="v" style="color:'+GCOL[grade(c.score)]+'">'+grade(c.score)+' <span style="font-size:16px">'+c.score+'</span></span><span class="s">Done by '+esc(personName(recKey(c)))+'</span>' : '<span class="v" style="color:var(--love)">Due</span><span class="s">Fill it in tonight</span>')+'</div>' +
    '<div class="tile"><span class="k">Care score</span><span class="v" style="color:'+(care == null ? 'inherit' : GCOL[grade(care)])+'">'+(care == null ? '–' : care)+'</span><span class="s">7-day average</span></div>' +
  '</div>';
  html += '<div class="card walk-card">' + (run
    ? '<h3>Walk in progress <small>started by '+esc(personName(dog.walk.by ? 'u:' + dog.walk.by : 'n:' + (dog.walk.who || 'Me')))+'</small></h3><div class="timer" data-timer="'+run+'">0:00</div><div class="btn-row"><button class="btn good big" data-act="end-walk">'+icon('check',20)+' Finish walk</button></div><button class="btn ghost small" data-act="cancel-walk">Cancel this walk</button>'
    : '<h3>Walk time</h3><button class="btn primary big" data-act="start-walk">'+icon('play',20)+' Start a walk with '+esc(dog.name)+'</button><button class="btn ghost" data-act="log-walk">'+icon('plus',16)+' Log a walk that already happened</button>') + '</div>';
  html += chestCard() + questsCard();
  html += '<div class="two"><div class="card"><h3>Last 5 weeks</h3>'+heatmap(dog)+'</div>';
  html += '<div class="card"><h3>Today’s walks</h3>'+(ws.length ? '<div class="list">'+ws.slice().sort((a,b) => b.t - a.t).map(walkRow).join('')+'</div>' : '<div class="empty">No walks yet today. '+esc(dog.name)+' is waiting by the door.</div>')+'</div></div>';
  return html;
}
function heatmap(dog){
  const t = dayKey(), td = keyDate(t), dow = (td.getDay() + 6) % 7, start = addDays(t, -dow - 28); let cells = '';
  for (let i = 0; i < 35; i++) {
    const k = addDays(start, i), c = ci(dog.id, k);
    if (k > t) { cells += '<i class="future"></i>'; continue; }
    const g = c ? grade(c.score) : null;
    cells += '<i class="'+(k === t ? 'today' : '')+'" style="'+(g ? 'background:'+GCOL[g] : '')+'" title="'+fmtDay(k)+': '+(c ? c.score+' points ('+g+')' : 'no check-in')+'"></i>';
  }
  return '<div class="heat-wrap"><div class="heat-days"><span>M</span><span></span><span>W</span><span></span><span>F</span><span></span><span>S</span></div><div class="heat">'+cells+'</div></div>' +
    '<div class="legend">'+['S','A','B','C','D','F'].map(g => '<span><i style="background:'+GCOL[g]+'"></i>'+g+'</span>').join('')+'<span><i style="background:var(--surface-2)"></i>None</span></div>';
}
let ciDraft = null;
const ciDayKey = () => (ciDraft && ciDraft.day === 'yesterday') ? addDays(dayKey(), -1) : dayKey();
function ensureDraft(dog){ if (!ciDraft || ciDraft.dog !== dog.id) ciDraft = {dog:dog.id, day:'today', answers:{}, who:lastWho(), note:''}; return ciDraft; }
function pCheckin(dog){
  const d = ensureDraft(dog), k = ciDayKey(), done = ci(dog.id, k), p = pron(dog), yk = addDays(dayKey(), -1);
  let html = '<div class="panel-head"><div><h2>Daily check-in</h2><p>Answer honestly at the end of the day. This runs on trust: every yes earns points.</p></div>' +
    '<div class="daypick"><button class="chip '+(d.day === 'today' ? 'on' : '')+'" data-act="ci-day" data-day="today">Today</button><button class="chip '+(d.day === 'yesterday' ? 'on' : '')+'" data-act="ci-day" data-day="yesterday">Yesterday'+(ci(dog.id, yk) ? '' : ' •')+'</button></div></div>';
  if (done) {
    const g = grade(done.score);
    html += '<div class="card"><div class="result-hero"><div class="grade" style="background:'+GCOL[g]+'">'+g+'</div><div><h3 style="margin:0">'+done.score+' / 100 for '+fmtDay(k).toLowerCase()+'</h3><div class="muted">Filled in by '+esc(personName(recKey(done)))+' at '+fmtTime(done.t)+'. Earned '+done.bones+' bones and '+done.xp+' XP.</div></div></div></div>';
    html += '<div class="card"><div class="ans">'+icon(done.walkPts ? 'check' : 'x', 18, done.walkPts ? 'y' : 'n')+'<span>Walks: '+done.walkPts+' / '+WALK_W+' points</span></div>' +
      QUESTIONS.map(q => { const a = done.answers[q.id] === true; return '<div class="ans">'+icon(a ? 'check' : 'x', 18, a ? 'y' : 'n')+'<span>'+esc(q.t(p))+'</span></div>'; }).join('') +
      (done.note ? '<div class="ans muted">Note: '+esc(done.note)+'</div>' : '') + '</div>';
    if (d.day === 'today' && !ci(dog.id, yk) && keyDate(yk) >= new Date(new Date(dog.created).toDateString())) html += '<button class="banner" data-act="ci-day" data-day="yesterday">'+icon('report',22)+'Yesterday has no check-in yet.<span>Fill it in →</span></button>';
    return html;
  }
  const nW = walksOn(dog.id, k).length, wp = walkPts(nW);
  html += '<div class="field" style="max-width:260px"><label for="ci-who">Who is filling this in?</label><select id="ci-who">'+whoOptions(d.who)+'</select></div>';
  html += '<div class="q auto-q '+(wp ? 'yes' : 'no')+'"><div class="q-text"><span class="q-pts">'+wp+' / '+WALK_W+' pts · automatic</span><b>Walks '+(d.day === 'today' ? 'today' : 'yesterday')+': '+nW+'</b><small>One walk earns 15 points, two or more earn 25. Log walks first to raise this.</small></div><button class="btn ghost small" data-act="log-walk">'+icon('plus',14)+' Log walk</button></div>';
  html += QUESTIONS.map(q => {
    const a = d.answers[q.id], cls = a === true ? 'yes' : a === false ? 'no' : '';
    return '<div class="q '+cls+'"><div class="q-text"><span class="q-pts">'+q.w+' pts</span><b>'+esc(q.t(p))+'</b><small>'+esc(q.h)+'</small></div>' +
      '<div class="yn"><button class="'+(a === true ? 'on-yes' : '')+'" data-act="ans" data-q="'+q.id+'" data-v="1" aria-pressed="'+(a === true)+'">Yes</button><button class="'+(a === false ? 'on-no' : '')+'" data-act="ans" data-q="'+q.id+'" data-v="0" aria-pressed="'+(a === false)+'">No</button></div></div>';
  }).join('');
  html += '<div class="field"><label for="ci-note">Anything else? (optional)</label><input id="ci-note" maxlength="140" placeholder="e.g. Met a new friend at the park" value="'+esc(d.note)+'"></div>';
  const sc = scoreFor(dog, k, d.answers).score, g2 = grade(sc), left = QUESTIONS.filter(q => d.answers[q.id] == null).length;
  html += '<div class="ci-foot"><div class="grade" style="background:'+GCOL[g2]+'">'+g2+'</div><div><b style="font-size:18px">'+sc+' / 100</b><div class="muted" style="font-size:13px">'+(left ? left+' question'+(left > 1 ? 's' : '')+' left' : 'All answered')+'</div></div><button class="btn primary" data-act="submit-ci" '+(left ? 'disabled' : '')+'>Submit check-in</button></div>';
  return html;
}
function pWalks(dog){
  const t = dayKey(), wk = addDays(t, -6), all = S.walks.filter(w => w.dogId === dog.id).sort((a,b) => b.t - a.t);
  const week = all.filter(w => dayKey(new Date(w.t)) >= wk), mins = week.reduce((a,w) => a + w.min, 0), allMins = all.reduce((a,w) => a + w.min, 0);
  let html = '<div class="panel-head"><div><h2>Walks</h2><p>Every walk earns bones and XP for '+esc(dog.name)+'.</p></div><button class="btn primary" data-act="log-walk">'+icon('plus',16)+' Log a walk</button></div>';
  html += '<div class="tiles"><div class="tile"><span class="k">This week</span><span class="v">'+week.length+'</span><span class="s">walks</span></div><div class="tile"><span class="k">Minutes</span><span class="v">'+mins+'</span><span class="s">last 7 days</span></div><div class="tile"><span class="k">Average</span><span class="v">'+(week.length ? Math.round(mins/week.length) : 0)+'</span><span class="s">min per walk</span></div><div class="tile"><span class="k">All time</span><span class="v">'+all.length+'</span><span class="s">'+fmtDur(allMins)+' walked</span></div></div>';
  if (!all.length) return html + '<div class="empty">No walks logged for '+esc(dog.name)+' yet. Start one from the Today tab.</div>';
  let out = '', last = null;
  all.slice(0, 80).forEach(w => { const k = dayKey(new Date(w.t)); if (k !== last) { out += '<div class="day-label">'+fmtDay(k)+'</div>'; last = k; } out += walkRow(w); });
  return html + '<div class="card"><h3>History</h3><div class="list">'+out+'</div></div>';
}
function pPlay(dog){
  const best = Object.entries(S.games.best || {}).sort((a,b) => b[1] - a[1]);
  const L = level(dog.xp), next = TRICKS.find(tr => tr.lvl > L);
  let html = '<div class="panel-head"><div><h2>Play</h2><p>Mini-games and tricks. Treat Catch pays bones for your first '+gamesAllowed()+' games each day.</p></div></div>';
  html += '<div class="card play-hero"><div class="mini"><img alt="" src="'+thumb(dog, 240)+'"></div><div><h3>Treat Catch</h3><p class="muted" style="margin:0 0 12px">Move '+esc(dog.name)+' to catch bones, biscuits and golden bones. Dodge chocolate and grapes: both are toxic to real dogs. You have 3 lives and 45 seconds.</p>' +
    '<div class="btn-row"><button class="btn primary" data-act="game-open">'+icon('game',18)+' Play</button></div><p class="muted" style="margin:10px 0 0;font-size:13px">'+(gamesLeft() ? gamesLeft()+' rewarded game'+(gamesLeft() > 1 ? 's' : '')+' left today. Up to 60 bones each.' : 'No rewarded games left today. You can still play for a high score.')+'</p></div></div>';
  html += '<div class="two"><div class="card"><h3>High scores</h3>'+(best.length ? '<div class="lb">'+best.map((r,i) => '<div class="lb-row"><span class="rank '+(i === 0 ? 'first' : '')+'">#'+(i+1)+'</span><span class="n person">'+personAvatar(r[0])+'<span>'+esc(personName(r[0]))+'</span></span><div class="bar"><i style="width:'+Math.round(r[1]/best[0][1]*100)+'%"></i></div><span class="p">'+r[1]+'</span></div>').join('')+'</div>' : '<div class="empty">No scores yet. Be the first.</div>')+'</div>';
  html += '<div class="card"><h3>Tricks</h3><p class="muted" style="margin:0 0 10px">'+esc(dog.name)+' learns a new trick as '+pron(dog).sub+' levels up. Tap a trick under the dog to watch it in 3D.</p><div class="list">'+TRICKS.map(tr => '<div class="ans">'+icon(L >= tr.lvl ? 'check' : 'lock', 16, L >= tr.lvl ? 'y' : '')+'<span><b>'+tr.name+'</b> <span class="muted">· level '+tr.lvl+'</span></span></div>').join('')+'</div>'+(next ? '<p class="muted" style="margin:10px 0 0;font-size:13px">Next: '+next.name+' at level '+next.lvl+'.</p>' : '')+'</div></div>';
  return html;
}
function pCloset(dog){
  const eq = dog.eq || {};
  let html = '<div class="panel-head"><div><h2>Closet</h2><p>'+S.inv.length+' of '+ITEMS.length+' items collected. Tap an item to put it on '+esc(dog.name)+'; tap again to take it off. Change breed in the Family tab.</p></div></div>';
  html += '<div><div class="slot-title">Chromas <span>Recolour '+esc(dog.name)+' with its own effects. Find them in packs or buy them here.</span></div><div class="item-grid">';
  html += '<button class="item chroma r-common'+(!eq.chroma ? ' on' : '')+'" data-act="equip-chroma" data-id="">'+(!eq.chroma ? '<span class="wear">Wearing</span>' : '')+'<img alt="" src="'+thumb({look:dog.look, eq:{}}, 112)+'"><span>Classic</span><span class="rar">Default</span></button>';
  html += ITEMS.filter(i => i.slot === 'chroma').map(i => {
    const own = S.inv.indexOf(i.id) >= 0, on = eq.chroma === i.id, price = CHROMA_PRICE[i.rarity];
    const im = '<img alt="" src="'+thumb({look:dog.look, eq:{chroma:i.id}}, 112)+'">';
    if (!own) return '<div class="item chroma locked r-'+i.rarity+'">'+im+'<span>'+CHROMAS[i.id].name+'</span><span class="rar">'+RAR_LABEL[i.rarity]+'</span><button class="btn small '+(S.bones >= price ? 'primary' : 'ghost')+'" data-act="buy-chroma" data-id="'+i.id+'" '+(S.bones >= price ? '' : 'disabled')+'>'+icon('bone',12)+' '+price+'</button></div>';
    return '<button class="item chroma r-'+i.rarity+(on ? ' on' : '')+'" data-act="equip-chroma" data-id="'+i.id+'">'+(on ? '<span class="wear">Wearing</span>' : '')+im+'<span>'+CHROMAS[i.id].name+'</span><span class="rar">'+RAR_LABEL[i.rarity]+'</span></button>';
  }).join('') + '</div></div>';
  SLOTS.forEach(sl => {
    html += '<div><div class="slot-title">'+sl[1]+'</div><div class="item-grid">' + ITEMS.filter(i => i.slot === sl[0]).map(i => {
      const own = S.inv.indexOf(i.id) >= 0, on = eq[i.slot] === i.id;
      if (!own) return '<div class="item locked r-'+i.rarity+'">'+itemSVG(i)+'<span>???</span><span class="rar">'+RAR_LABEL[i.rarity]+'</span></div>';
      return '<button class="item r-'+i.rarity+(on ? ' on' : '')+'" data-act="equip" data-id="'+i.id+'" aria-pressed="'+on+'">'+(on ? '<span class="wear">Wearing</span>' : '')+itemSVG(i)+'<span>'+i.name+'</span><span class="rar">'+RAR_LABEL[i.rarity]+'</span></button>';
    }).join('') + '</div></div>';
  });
  return html;
}
function pPacks(){
  let html = '<div class="panel-head"><div><h2>Packs</h2><p>Spend bones on packs of gear and chromas. Duplicates turn back into bones. You have <b style="color:var(--accent)">'+S.bones+'</b> bones.</p></div></div>';
  return html + '<div class="packs">' + PACKS.map(pk => {
    const can = S.bones >= pk.cost;
    return '<div class="pack r-'+pk.rarity+'"><div class="pack-art">'+icon(pk.id === 'kennel' ? 'crown' : pk.id === 'good' ? 'star' : 'gift', 64)+'</div><h3>'+pk.name+'</h3>' +
      '<div class="odds"><span>'+pk.count+' items'+(pk.guarantee ? ', at least one Rare or better' : '')+'</span>'+RAR.filter(r => pk.odds[r]).map(r => '<span><b style="color:var(--r-'+r+')">'+RAR_LABEL[r]+'</b> '+Math.round(pk.odds[r]*100)+'%</span>').join('')+'</div>' +
      '<button class="btn '+(can ? 'primary' : 'ghost')+'" data-act="open-pack" data-id="'+pk.id+'" '+(can ? '' : 'disabled')+'>'+icon('bone',16)+' '+pk.cost+(can ? ' · Open' : ' · Need '+(pk.cost - S.bones)+' more')+'</button></div>';
  }).join('') + '</div>';
}
function pShop(){
  let html = '<div class="panel-head"><div><h2>Upgrades</h2><p>Permanent boosts for the whole pack. You have <b style="color:var(--accent)">'+S.bones+'</b> bones.</p></div></div>';
  return html + '<div class="shop">' + UPGRADES.map(u => {
    const l = up(u.id), max = l >= u.max, cost = upCost(u, l), can = !max && S.bones >= cost; let pips = '';
    for (let i = 0; i < u.max; i++) pips += '<i class="'+(i < l ? 'on' : '')+'"></i>';
    return '<div class="card up"><div class="up-head"><div class="up-ic">'+icon(u.icon, 24)+'</div><div><b>'+u.name+'</b><small>'+u.desc+'</small></div></div><div class="pips" aria-label="Level '+l+' of '+u.max+'">'+pips+'</div>' +
      '<button class="btn '+(can ? 'primary' : 'ghost')+'" data-act="buy-up" data-id="'+u.id+'" '+(can ? '' : 'disabled')+'>'+(max ? 'Maxed out' : icon('bone',16)+' '+cost+' · Level '+(l+1))+'</button></div>';
  }).join('') + '</div>';
}
function pTrophies(){
  const st = stats(), got = ACH.filter(a => S.ach[a.id]).length;
  let html = '<div class="panel-head"><div><h2>Trophies</h2><p>'+got+' of '+ACH.length+' unlocked. Each trophy pays out bones once.</p></div></div>';
  return html + '<div class="achs">' + ACH.map(a => {
    const g = S.ach[a.id], p = a.p(st);
    return '<div class="ach '+(g ? 'got' : 'locked')+'"><div class="medal">'+icon(g ? a.ic : 'lock', 22)+'</div><div style="flex:1;min-width:0"><b>'+esc(a.name)+'</b><small>'+esc(a.desc)+'</small>' +
      (g ? '<small style="color:var(--accent)">Unlocked '+new Date(g).toLocaleDateString(undefined,{day:'numeric',month:'short'})+' · +'+a.reward+' bones</small>' : '<div class="prog"><i style="width:'+Math.min(100, Math.round(p[0]/p[1]*100))+'%"></i></div><small>'+Math.min(p[0],p[1])+' / '+p[1]+' · +'+a.reward+' bones</small>') + '</div></div>';
  }).join('') + '</div>';
}
function carers(){
  const since = addDays(dayKey(), -6), m = {};
  const get = k => m[k] || (m[k] = {k, walks:0, mins:0, cis:0, ciSum:0, pts:0});
  peopleKeys().forEach(get);
  S.walks.forEach(w => { if (dayKey(new Date(w.t)) >= since) { const r = get(recKey(w)); r.walks++; r.mins += w.min; r.pts += (w.pts||0); } });
  Object.keys(S.checkins).forEach(k => { const c = S.checkins[k]; if (k.split('|')[0] >= since) { const r = get(recKey(c)); r.cis++; r.ciSum += c.score; r.pts += c.score; } });
  return Object.values(m).sort((a,b) => b.pts - a.pts);
}
function inviteLink(){ return location.origin + location.pathname + '?join=' + (HH ? HH.invite_code : ''); }
function pFamily(){
  const cs = carers();
  let html = '<div class="panel-head"><div><h2>Family</h2><p>Everyone in your pack signs in with their own account. Their walks and check-ins count toward the weekly ranking.</p></div></div>';
  html += '<div class="card"><h3>Who treats the dogs best <small>Last 7 days</small></h3>' +
    '<div class="carer head"><span>#</span><span>Person</span><span class="hide-sm">Walks</span><span class="hide-sm">Minutes</span><span class="hide-sm">Check-ins</span><span style="text-align:right">Points</span></div>' +
    cs.map((r, i) => '<div class="carer'+(i === 0 && r.pts ? ' top' : '')+'"><span class="rank">'+(i === 0 && r.pts ? icon('crown',16) : '#'+(i+1))+'</span><span class="person">'+personAvatar(r.k)+'<span>'+esc(personName(r.k))+(isMe(r.k) ? ' <span class="muted">(you)</span>' : '')+'</span></span><span class="hide-sm">'+r.walks+'</span><span class="hide-sm">'+r.mins+'</span><span class="hide-sm">'+r.cis+(r.cis ? ' <span class="muted">· avg '+Math.round(r.ciSum/r.cis)+'</span>' : '')+'</span><span class="pts">'+r.pts+'</span></div>').join('') +
    '<p class="muted" style="margin:10px 0 0;font-size:13px">Points: walk points plus check-in scores.</p></div>';
  if (!DEMO && HH) {
    const link = inviteLink(), mail = 'mailto:?subject=' + encodeURIComponent('Join our Walkies pack') + '&body=' + encodeURIComponent('Help look after ' + activeDog().name + '! Open ' + link + ' and sign in with Google. Our pack code is ' + HH.invite_code + '.');
    html += '<div class="two"><div class="card"><h3>Invite family</h3><p class="muted" style="margin:0 0 10px">Send this link. They sign in with Google and land in your pack.</p><div class="code-big">'+esc(HH.invite_code)+'</div>' +
      '<div class="invite-row" style="margin-top:10px"><input id="invite-link" readonly value="'+esc(link)+'"><button class="btn primary" data-act="copy-invite">Copy link</button></div>' +
      '<div class="btn-row" style="margin-top:10px"><a class="btn ghost" href="'+esc(mail)+'">'+icon('heart',15)+' Email an invite</a></div></div>';
    html += '<div class="card"><h3>Pack members <small>'+MEMBERS.length+'</small></h3><div class="list">'+MEMBERS.map(m => '<div class="ans">'+personAvatar('u:'+m.user_id)+'<span><b>'+esc(m.display_name || 'Family member')+'</b>'+(m.user_id === ME.id ? ' <span class="muted">(you)</span>' : '')+'</span></div>').join('')+'</div>' +
      (MYPACKS.length > 1 ? '<div class="field" style="margin-top:12px"><label for="pack-switch">Switch pack</label><select id="pack-switch">'+MYPACKS.map(p => '<option value="'+p.id+'" '+(p.id === HH.id ? 'selected' : '')+'>'+esc(p.name)+'</option>').join('')+'</select></div>' : '') + '</div></div>';
  }
  const manual = S.family;
  html += '<div class="card"><h3>People without an account <small>For kids or anyone not signing in</small></h3><div class="member-chips">' + (manual.length ? manual.map((n,i) => {
    const linked = S.links && S.links[n];
    return '<span class="member">'+esc(n)+(linked ? ' <span class="muted" style="font-weight:700">→ '+esc(personName('u:'+linked))+'</span>' : (ME.id ? ' <button class="btn ghost small" style="width:auto;height:auto;border-radius:99px;padding:3px 8px" data-act="link-me" data-n="'+esc(n)+'">That’s me</button>' : ''))+'<button data-act="rm-member" data-i="'+i+'" aria-label="Remove '+esc(n)+'">'+icon('x',12)+'</button></span>';
  }).join('') : '<span class="muted">None yet.</span>') + '</div>' +
    '<form class="inline-form" id="member-form"><input id="member-name" maxlength="20" placeholder="Add a name, e.g. Little sister" aria-label="New name"><button class="btn primary" type="submit">Add</button></form>' +
    (ME.id && manual.some(n => !(S.links && S.links[n])) ? '<p class="muted" style="margin:10px 0 0;font-size:13px">Logged things under your own name before accounts? Click “That’s me” to move them to your account.</p>' : '') + '</div>';
  html += '<div class="card"><h3>Dogs</h3><div class="dog-list">'+S.dogs.map(d => '<div class="dog-li"><div class="mini"><img alt="" src="'+thumb(d, 112)+'"></div><div><b>'+esc(d.name)+'</b><span class="muted" style="font-size:13px">Level '+level(d.xp)+' · '+BREEDS[d.look].name+'</span></div><button class="btn ghost small" data-act="edit-dog" data-id="'+d.id+'">Edit breed and name</button>'+(d.id !== S.active ? '<button class="btn ghost small" data-act="switch-dog" data-id="'+d.id+'">Switch</button>' : '')+'</div>').join('')+'</div><div style="margin-top:12px"><button class="btn ghost" data-act="add-dog">'+icon('plus',16)+' Add another dog</button></div></div>';
  return html;
}

/* ---------- modals ---------- */
const localInput = t => { const d = new Date(t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,16); };
function openWalkModal(pre){
  pre = pre || {};
  const dog = activeDog(), t = pre.t || Date.now();
  openModal('<form id="walk-form" class="field" style="gap:14px"><h2>Log a walk with '+esc(dog.name)+'</h2>' +
    '<div class="row2"><div class="field"><label for="wf-who">Who walked?</label><select id="wf-who">'+whoOptions(pre.who || lastWho())+'</select></div>' +
    '<div class="field"><label for="wf-min">Minutes</label><input id="wf-min" type="number" min="1" max="300" required value="'+(pre.min || 20)+'"></div></div>' +
    '<div class="field"><label for="wf-when">Started at</label><input id="wf-when" type="datetime-local" required value="'+localInput(t)+'" max="'+localInput(Date.now() + 60000)+'"></div>' +
    '<div class="field"><span class="flabel">Business done</span><div class="chips"><label class="chip" id="pee-chip"><input type="checkbox" id="wf-pee">Pee</label><label class="chip" id="poo-chip"><input type="checkbox" id="wf-poo">Poo</label></div></div>' +
    '<div class="field"><label for="wf-note">Note (optional)</label><input id="wf-note" maxlength="120" placeholder="e.g. Loop around the lake"></div>' +
    '<div class="est" id="wf-est"></div>' +
    '<div class="modal-actions"><button type="button" class="btn ghost" data-act="close-modal">Cancel</button><button type="submit" class="btn primary" id="wf-save">Save walk</button></div></form>');
  updateWalkEst();
}
function updateWalkEst(){
  const m = Number(($('#wf-min')||{}).value) || 0, r = walkReward(m, $('#wf-pee') && $('#wf-pee').checked, $('#wf-poo') && $('#wf-poo').checked);
  const e = $('#wf-est'); if (e) e.innerHTML = 'This walk earns <b>'+r.bones+' bones</b> and <b>'+r.xp+' XP</b>.';
  ['pee','poo'].forEach(x => { const c = $('#'+x+'-chip'); if (c) c.classList.toggle('on', $('#wf-'+x).checked); });
}
function showReward(o){
  const tr = o.levelUp ? TRICKS.find(t => t.lvl === o.levelUp) : null;
  const html = '<div class="reward" style="display:grid;gap:14px;justify-items:center">' +
    '<div class="big-ic">'+icon(o.icon || 'star', 36)+'</div><h2>'+esc(o.title)+'</h2>'+(o.sub ? '<p>'+esc(o.sub)+'</p>' : '') +
    '<div class="gains">'+(o.bones ? '<div class="gain"><b>+'+o.bones+'</b><small>Bones</small></div>' : '')+(o.xp ? '<div class="gain xp"><b>+'+o.xp+'</b><small>XP</small></div>' : '')+'</div>' +
    (o.levelUp ? '<div class="levelup">'+esc(o.dogName)+' reached level '+o.levelUp+': '+title(o.levelUp)+'!</div>' + (tr ? '<div class="unlock">'+icon('target',24)+'<div><b>New trick: '+tr.name+'</b><div class="muted" style="font-size:13px">Find it under the dog.</div></div></div>' : '') : '') +
    (o.achs || []).map(a => '<div class="unlock">'+icon(a.ic, 24)+'<div><b>Trophy unlocked: '+esc(a.name)+'</b><div class="muted" style="font-size:13px">'+esc(a.desc)+' · +'+a.reward+' bones</div></div></div>').join('') +
    '<button class="btn primary big" data-act="close-modal" autofocus>Nice!</button></div>';
  openModal(html, '', o.onClose);
  if (o.levelUp || (o.achs && o.achs.length) || o.party) confetti(o.levelUp ? 180 : 110);
}
let confirmFn = null;
function confirmModal(text, okLabel, fn){
  openModal('<h2>Are you sure?</h2><p class="muted" style="margin:0">'+esc(text)+'</p><div class="modal-actions"><button class="btn ghost" data-act="close-modal">Keep it</button><button class="btn love" data-act="confirm-ok">'+esc(okLabel)+'</button></div>');
  confirmFn = fn;
}
let dogDraft = null;
function dogModal(d){
  dogDraft = d ? {id:d.id, name:d.name, look:d.look, pronoun:d.pronoun} : {name:'', look:'golden', pronoun:'he'};
  openModal('<form id="dog-form" style="display:grid;gap:14px"><h2>'+(d ? 'Edit '+esc(d.name) : 'Add a dog')+'</h2><div class="setup-stage" style="min-height:220px;display:grid;place-items:center"><img id="setup-dog" class="thumb3d" style="width:220px" alt="" src="'+thumb({look:dogDraft.look, eq: d ? {chroma: d.eq && d.eq.chroma} : {}}, 220)+'"></div>'+dogFields(dogDraft) +
    '<div class="modal-actions"><button type="button" class="btn ghost" data-act="close-modal">Cancel</button><button class="btn primary" type="submit">'+(d ? 'Save changes' : 'Add dog')+'</button></div></form>', 'wide');
  fillLookThumbs();
}

/* ---------- Treat Catch ---------- */
let game = null;
function openGame(){
  const dog = activeDog();
  openModal('<h2>Treat Catch</h2><div class="game-wrap"><canvas id="game" width="360" height="480" aria-label="Treat Catch game. Use arrow keys or drag to move."></canvas>' +
    '<div class="game-legend"><span><i style="background:#f1e6cf"></i>Bone 10</span><span><i style="background:#c98b4a"></i>Biscuit 5</span><span><i style="background:#ffc94d"></i>Golden 50</span><span><i style="background:#5a3420"></i>Chocolate</span><span><i style="background:#8b5cf6"></i>Grapes</span></div>' +
    '<div class="btn-row" style="width:100%;max-width:380px"><button class="btn ghost" data-act="close-modal">Close</button><button class="btn primary" id="g-start" data-act="game-start">'+icon('play',16)+' Start</button></div></div>', 'game-modal', () => { if (game) game.stop = true; game = null; });
  const img = new Image(); img.src = thumb(dog, 200);
  game = {img, idle:true, stop:false};
  drawGameIdle(); img.onload = drawGameIdle;
}
function drawGameIdle(){
  const c = $('#game'); if (!c || !game) return; const x = c.getContext('2d');
  gameBg(x); if (game.img.complete) x.drawImage(game.img, 125, 345, 110, 110);
  x.fillStyle = '#f4efe6'; x.textAlign = 'center'; x.font = '600 28px Fredoka, sans-serif'; x.fillText(game.over ? 'Score: ' + game.score : 'Treat Catch', 180, 180);
  x.font = '700 14px Nunito, sans-serif'; x.fillStyle = '#9097a3';
  if (game.over) { x.fillText(game.earned ? '+' + game.earned + ' bones earned' : 'No bones this time', 180, 210); if (game.newBest) { x.fillStyle = '#ffb547'; x.fillText('New personal best!', 180, 236); } }
  else { x.fillText('Drag, tap, or use the arrow keys.', 180, 210); x.fillText('Catch treats. Dodge chocolate and grapes.', 180, 232); }
}
function gameBg(x){ const g = x.createLinearGradient(0,0,0,480); g.addColorStop(0,'#05060a'); g.addColorStop(1,'#120d06'); x.fillStyle = g; x.fillRect(0,0,360,480); x.fillStyle = 'rgba(255,181,71,.12)'; x.beginPath(); x.ellipse(180, 450, 170, 18, 0, 0, 7); x.fill(); }
function drawTreat(x, it){
  x.save(); x.translate(it.x, it.y); x.rotate(it.r);
  if (it.k === 'bone' || it.k === 'gold') { x.fillStyle = it.k === 'gold' ? '#ffc94d' : '#f1e6cf'; if (it.k === 'gold') { x.shadowColor = '#ffc94d'; x.shadowBlur = 16; } x.fillRect(-12,-4,24,8); [[-12,-4],[-12,4],[12,-4],[12,4]].forEach(p => { x.beginPath(); x.arc(p[0],p[1],5,0,7); x.fill(); }); }
  else if (it.k === 'biscuit') { x.fillStyle = '#c98b4a'; x.beginPath(); x.arc(0,0,11,0,7); x.fill(); x.fillStyle = '#8a5a2b'; [[-4,-3],[4,-2],[0,4]].forEach(p => { x.beginPath(); x.arc(p[0],p[1],1.8,0,7); x.fill(); }); }
  else if (it.k === 'choc') { x.fillStyle = '#5a3420'; x.fillRect(-14,-9,28,18); x.strokeStyle = '#3a2214'; x.lineWidth = 1.5; x.strokeRect(-14,-9,28,18); x.beginPath(); x.moveTo(0,-9); x.lineTo(0,9); x.moveTo(-14,0); x.lineTo(14,0); x.stroke(); }
  else { x.fillStyle = '#8b5cf6'; [[-5,-6],[5,-6],[0,0],[-6,4],[6,4],[0,9]].forEach(p => { x.beginPath(); x.arc(p[0],p[1],5,0,7); x.fill(); }); x.fillStyle = '#4ade80'; x.fillRect(-1,-14,2,6); }
  x.restore();
}
function startGame(){
  const c = $('#game'); if (!c || !game) return;
  const btn = $('#g-start'); if (btn) btn.hidden = true;
  Object.assign(game, {idle:false, over:false, x:180, tx:180, items:[], pops:[], score:0, lives:3, t0:performance.now(), last:performance.now(), spawn:0, keys:{}, flash:0});
  const pos = e => { const r = c.getBoundingClientRect(); game.tx = Math.max(30, Math.min(330, (e.clientX - r.left) * 360 / r.width)); };
  c.onpointerdown = e => { pos(e); try { c.setPointerCapture(e.pointerId); } catch(err){} };
  c.onpointermove = e => { if (e.pointerType === 'mouse' || e.buttons) pos(e); };
  const ctx = c.getContext('2d');
  (function loop(now){
    if (!game || game.stop || game.over) return;
    const dt = Math.min(.05, (now - game.last) / 1000); game.last = now;
    const el = now - game.t0, left = Math.max(0, 45 - el/1000);
    if (game.keys.ArrowLeft) game.tx = Math.max(30, game.tx - 460*dt);
    if (game.keys.ArrowRight) game.tx = Math.min(330, game.tx + 460*dt);
    game.x += (game.tx - game.x) * Math.min(1, dt*14);
    game.spawn -= dt*1000;
    if (game.spawn <= 0) {
      game.spawn = Math.max(260, 760 - el/55);
      const r = Math.random(), hz = Math.min(.34, .16 + el/200000);
      const k = r < hz*.6 ? 'choc' : r < hz ? 'grape' : r < hz + .05 ? 'gold' : r < hz + .3 ? 'biscuit' : 'bone';
      game.items.push({k, x:24 + Math.random()*312, y:-20, v:(150 + el/110) * (k === 'gold' ? 1.35 : 1) * (.85 + Math.random()*.3), r:Math.random()*6, vr:(Math.random()-.5)*4});
    }
    game.items.forEach(it => { it.y += it.v*dt; it.r += it.vr*dt; });
    game.items = game.items.filter(it => {
      if (it.y > 380 && it.y < 440 && Math.abs(it.x - game.x) < 46) {
        if (it.k === 'choc' || it.k === 'grape') { game.lives--; game.flash = 1; game.pops.push({x:it.x, y:it.y, t:it.k === 'choc' ? 'Chocolate! -1 life' : 'Grapes! -1 life', c:'#f87171', life:1}); }
        else { const v = it.k === 'gold' ? 50 : it.k === 'bone' ? 10 : 5; game.score += v; game.pops.push({x:it.x, y:it.y, t:'+' + v, c:it.k === 'gold' ? '#ffc94d' : '#4ade80', life:1}); }
        return false;
      }
      return it.y < 500;
    });
    gameBg(ctx);
    if (game.flash > 0) { ctx.fillStyle = 'rgba(248,113,113,' + (game.flash*.25) + ')'; ctx.fillRect(0,0,360,480); game.flash -= dt*2.5; }
    game.items.forEach(it => drawTreat(ctx, it));
    if (game.img.complete) ctx.drawImage(game.img, game.x - 55, 345, 110, 110);
    game.pops.forEach(p => { p.y -= 40*dt; p.life -= dt*1.3; ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c; ctx.font = '800 16px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.t, p.x, p.y); ctx.globalAlpha = 1; });
    game.pops = game.pops.filter(p => p.life > 0);
    ctx.fillStyle = '#f4efe6'; ctx.font = '600 22px Fredoka, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(String(game.score), 16, 34);
    ctx.textAlign = 'right'; ctx.fillStyle = '#9097a3'; ctx.font = '800 15px Nunito, sans-serif'; ctx.fillText(Math.ceil(left) + 's', 344, 32);
    ctx.fillStyle = '#ff6b8b'; ctx.textAlign = 'center'; for (let i = 0; i < 3; i++) { ctx.globalAlpha = i < game.lives ? 1 : .2; ctx.font = '18px sans-serif'; ctx.fillText('♥', 160 + i*20, 32); } ctx.globalAlpha = 1;
    if (game.lives <= 0 || left <= 0) return endGame();
    requestAnimationFrame(loop);
  })(performance.now());
}
function endGame(){
  game.over = true;
  const who = lastWho(), t = dayKey();
  if (S.games.day !== t) { S.games.day = t; S.games.plays = 0; }
  const rewarded = S.games.plays < gamesAllowed();
  S.games.plays++;
  game.earned = rewarded ? Math.min(60, Math.floor(game.score/10)) : 0;
  S.bones += game.earned;
  game.newBest = game.score > (S.games.best[who] || 0);
  if (game.newBest) S.games.best[who] = game.score;
  S.games.top = Math.max(S.games.top || 0, game.score);
  bumpLocal('gameBest', game.score);
  const achs = checkAch(); saveHouse();
  drawGameIdle();
  const btn = $('#g-start'); if (btn) { btn.hidden = false; btn.innerHTML = icon('play',16) + ' Play again'; }
  if (game.earned) bumpBones();
  if (achs.length) { toast('Trophy unlocked: ' + achs.map(a => a.name).join(', ')); confetti(90); }
  if (game.newBest) confetti(60);
}
function bumpBones(){ const s = $('#bones-stat'); if (s) { s.querySelector('b').textContent = S.bones; s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump'); } }

/* ---------- actions ---------- */
function doTrick(id){
  const dog = activeDog(), tr = TRICKS.find(x => x.id === id); if (!tr) return;
  if (dog.crate) { toast('Let ' + dog.name + ' out of the crate first.'); return; }
  if (isNight()) { wakeUntil = Date.now() + 90000; syncStage(); }
  STAGE.trick(id); say(tr.say[Math.floor(Math.random()*tr.say.length)], 2200);
  bumpLocal('tricks'); refreshQuests();
}
function openPack(id, free){
  const pk = PACKS.find(p => p.id === id); if (!pk || (!free && S.bones < pk.cost)) return;
  if (!free) S.bones -= pk.cost;
  S.packs++;
  const pulls = [], newSet = {};
  const roll = () => { const r = Math.random(); let acc = 0, out = null; RAR.some(k => { if (!pk.odds[k]) return false; acc += pk.odds[k]; if (r < acc) { out = k; return true; } return false; }); return out || RAR.filter(k => pk.odds[k]).pop(); };
  for (let i = 0; i < pk.count; i++) {
    let rar = roll();
    if (pk.guarantee && i === pk.count - 1 && !pulls.some(x => RAR.indexOf(x.item.rarity) >= 1) && RAR.indexOf(rar) < 1) rar = 'rare';
    const pool = ITEMS.filter(it => it.rarity === rar), item = pool[Math.floor(Math.random()*pool.length)];
    const dupe = S.inv.indexOf(item.id) >= 0 || newSet[item.id];
    if (dupe) S.bones += DUPE[rar]; else { S.inv.push(item.id); newSet[item.id] = 1; }
    if (rar === 'legendary') S.legendaries++;
    pulls.push({item, dupe:!!dupe, refund:DUPE[rar]});
  }
  pulls.sort((a,b) => RAR.indexOf(a.item.rarity) - RAR.indexOf(b.item.rarity));
  const achs = checkAch(); saveHouse();
  openPack.pulls = pulls;
  const dog = activeDog();
  openModal('<h2 style="text-align:center">'+pk.name+(free ? ' · Free!' : '')+'</h2><p class="muted" style="margin:0;text-align:center">Tap each card to flip it.</p><div class="pack-cards">' + pulls.map((x, i) =>
    '<button class="pcard r-'+x.item.rarity+'" data-act="flip" data-i="'+i+'" aria-label="Flip card '+(i+1)+'"><div class="pc-inner"><div class="pc-back">'+icon('paw', 46)+'</div><div class="pc-front">'+itemSVG(x.item, dog, thumb)+'<div class="pc-name">'+x.item.name+'</div><div class="pc-rar">'+RAR_LABEL[x.item.rarity]+'</div>'+(x.dupe ? '<span class="pc-tag pc-dupe">Duplicate · +'+x.refund+' bones</span>' : '<span class="pc-tag pc-new">New!</span>')+'</div></div></button>'
  ).join('') + '</div>' + achs.map(a => '<div class="unlock">'+icon(a.ic, 24)+'<div><b>Trophy unlocked: '+esc(a.name)+'</b><div class="muted" style="font-size:13px">+'+a.reward+' bones</div></div></div>').join('') +
  '<div class="modal-actions" style="justify-content:center"><button class="btn ghost" data-act="flip-all" id="flip-all">Reveal all</button><button class="btn primary" data-act="close-modal" id="collect" hidden>Collect and go to Closet</button></div>', 'wide', () => { tab = 'closet'; setHash(); renderMain(); });
}
function flipCard(btn){
  if (!btn || btn.classList.contains('flipped')) return;
  btn.classList.add('flipped');
  const x = openPack.pulls[Number(btn.dataset.i)];
  if (x && x.item.rarity === 'legendary') setTimeout(() => confetti(160), 300); else if (x && x.item.rarity === 'epic') setTimeout(() => confetti(60), 300);
  if (!layer.querySelector('.pcard:not(.flipped)')) { const c = $('#collect'), f = $('#flip-all'); if (c) c.hidden = false; if (f) f.hidden = true; }
}
function setDogPreview(look){
  const sd = $('#setup-dog'); if (!sd) return;
  const d = layer.querySelector('#dog-form') && dogDraft && dogDraft.id ? S.dogs.find(x => x.id === dogDraft.id) : null;
  sd.src = thumb({look, eq: d ? {chroma: d.eq && d.eq.chroma} : {}}, 300);
}
async function signInGoogle(){
  const { error } = await sb.auth.signInWithOAuth({provider:'google', options:{redirectTo: location.origin + location.pathname}});
  if (error) toast('Google sign-in is not set up yet: ' + error.message);
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, dog = S.dogs.length ? activeDog() : null;
  switch (act) {
    case 'close-modal': closeModal(); break;
    case 'google': signInGoogle(); break;
    case 'sign-out': e.preventDefault(); if (DEMO) { location.href = './'; break; } await sb.auth.signOut(); lsDel('walkies-hh'); location.href = location.pathname; break;
    case 'new-pack': S = migrate({}); setupDraft = null; renderSetup(); break;
    case 'tab': tab = el.dataset.tab; setHash(); renderMain(); window.scrollTo({top:0, behavior: RM ? 'auto' : 'smooth'}); break;
    case 'reset-view': STAGE && STAGE.resetView(); break;
    case 'trick': doTrick(el.dataset.id); break;
    case 'pick-look': {
      const tgt = layer.querySelector('#dog-form') ? dogDraft : setupDraft; tgt.look = el.dataset.look;
      el.parentNode.querySelectorAll('.look').forEach(b => b.classList.toggle('on', b === el));
      setDogPreview(tgt.look); break;
    }
    case 'pick-pron': {
      const tg = layer.querySelector('#dog-form') ? dogDraft : setupDraft; tg.pronoun = el.dataset.p;
      el.parentNode.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b === el)); break;
    }
    case 'switch-dog': S.active = el.dataset.id; ciDraft = null; saveHouse(); renderMain(); break;
    case 'start-walk': { const w = whoFields(lastWho()); dog.walk = {since:Date.now(), by:w.by, who:w.who}; saveHouse(); renderMain(); toast('Walk started. Everyone in the pack can see it. Tap Finish walk when you get home.'); break; }
    case 'end-walk': { const st = walkStart(dog); if (st) openWalkModal({t:st, min:Math.max(1, Math.round((Date.now() - st)/60000)), who: dog.walk.by ? 'u:' + dog.walk.by : 'n:' + (dog.walk.who || 'Me')}); break; }
    case 'cancel-walk': delete dog.walk; saveHouse(); renderMain(); break;
    case 'log-walk': openWalkModal(); break;
    case 'crate-in': {
      if (walkStart(dog)) { toast('Finish the walk first.'); break; }
      dog.crate = {since:Date.now(), by:ME.id || null}; saveHouse(); renderStageChrome(); say('Okay… crate time.'); break;
    }
    case 'crate-out': {
      if (!dog.crate) break;
      const s = dog.crate.since, mins = (Date.now() - s) / 60000;
      dog.crateLog = (dog.crateLog || []).concat({s, e:Date.now(), by:ME.id || null}).slice(-40);
      delete dog.crate; saveHouse(); bumpLocal('crate'); renderStageChrome(); refreshQuests();
      say(mins > 120 ? 'FINALLY! Freedom!' : 'Freedom! Thank you!'); break;
    }
    case 'del-walk': {
      const id = el.dataset.id;
      confirmModal('Removing this walk also takes back the bones and XP it earned.', 'Remove walk', () => {
        const w = S.walks.find(x => x.id === id); if (!w) return;
        S.walks = S.walks.filter(x => x.id !== id);
        S.bones = Math.max(0, S.bones - (w.bones||0));
        const d = S.dogs.find(x => x.id === w.dogId); if (d) d.xp = Math.max(0, d.xp - (w.xp||0));
        delWalkDoc(id); saveHouse(); renderMain();
      });
      break;
    }
    case 'confirm-ok': { const fn = confirmFn; confirmFn = null; closeModal(); if (fn) fn(); break; }
    case 'ci-day': { const w = ensureDraft(dog).who; ciDraft = {dog:dog.id, day:el.dataset.day, answers:{}, who:w, note:''}; tab = 'checkin'; setHash(); renderMain(); break; }
    case 'ans': ensureDraft(dog).answers[el.dataset.q] = el.dataset.v === '1'; renderPanel(); break;
    case 'submit-ci': submitCheckin(el); break;
    case 'equip': {
      const it = ITEM[el.dataset.id]; dog.eq = dog.eq || {};
      dog.eq[it.slot] = dog.eq[it.slot] === it.id ? null : it.id;
      bumpLocal('style'); const na = checkAch(); saveHouse(); syncStage(); renderPanel();
      if (na.length) showReward({title:'Looking sharp!', icon:'star', bones:na.reduce((a,x) => a + x.reward, 0), achs:na});
      break;
    }
    case 'equip-chroma': { dog.eq = dog.eq || {}; dog.eq.chroma = el.dataset.id || null; bumpLocal('style'); saveHouse(); renderStageChrome(); renderPanel(); break; }
    case 'buy-chroma': {
      const it = ITEM[el.dataset.id], price = CHROMA_PRICE[it.rarity];
      if (S.bones < price || S.inv.indexOf(it.id) >= 0) break;
      S.bones -= price; S.inv.push(it.id); dog.eq = dog.eq || {}; dog.eq.chroma = it.id;
      if (it.rarity === 'legendary') S.legendaries++;
      bumpLocal('style'); const na = checkAch(); saveHouse(); renderMain();
      showReward({title: CHROMAS[it.id].name + ' chroma unlocked', icon:'palette', sub:dog.name + ' is wearing it now. Switch back any time in the Closet.', achs:na, bones:na.reduce((a,x) => a + x.reward, 0), party:true});
      break;
    }
    case 'open-pack': openPack(el.dataset.id); break;
    case 'flip': flipCard(el); break;
    case 'flip-all': layer.querySelectorAll('.pcard:not(.flipped)').forEach((b, i) => setTimeout(() => flipCard(b), i*260)); break;
    case 'buy-up': {
      const u = UPGRADES.find(x => x.id === el.dataset.id), l = up(u.id), cost = upCost(u, l);
      if (l >= u.max || S.bones < cost) break;
      S.bones -= cost; S.upgrades[u.id] = l + 1; saveHouse(); renderMain(); toast(u.name + ' upgraded to level ' + (l+1) + '.'); break;
    }
    case 'chest': {
      const cs = chestState(); if (cs.claimed) break;
      const day = cs.next, b = CHEST[day - 1];
      S.chest = {last:dayKey(), streak:day, seven: S.chest.seven || (day === 7 ? 1 : 0)};
      S.bones += b; const na = checkAch(); saveHouse(); renderMain();
      showReward({title:'Day ' + day + ' chest', icon:'gift', sub: day === 7 ? 'Full week! A free Good Dog Pack is next.' : 'Come back tomorrow for day ' + (day + 1) + '.', bones:b, achs:na, party: day === 7, onClose: day === 7 ? () => setTimeout(() => openPack('good', true), 50) : null});
      break;
    }
    case 'claim-quest': {
      const q = QUEST_POOL.find(x => x.id === el.dataset.id); if (!q || questClaimed(q.id) || questProg(q) < q.goal) break;
      if (S.quests.day !== dayKey()) S.quests = {day:dayKey(), claimed:[]};
      S.quests.claimed.push(q.id); S.questsDone++; S.bones += q.reward;
      const na = checkAch(); saveHouse(); renderMain();
      if (na.length) showReward({title:'Quest complete', icon:'target', bones:q.reward, achs:na}); else { toast('Quest complete: +' + q.reward + ' bones'); bumpBones(); }
      break;
    }
    case 'game-open': openGame(); break;
    case 'game-start': startGame(); break;
    case 'rm-member': { const n = S.family[Number(el.dataset.i)]; S.family.splice(Number(el.dataset.i), 1); if (S.links) delete S.links[n]; saveHouse(); renderPanel(); break; }
    case 'link-me': { const n = el.dataset.n; if (!ME.id || !n) break; S.links = S.links || {}; S.links[n] = ME.id; saveHouse(); renderPanel(); toast('Everything logged as ' + n + ' now counts for you.'); break; }
    case 'add-dog': dogModal(null); break;
    case 'edit-dog': dogModal(S.dogs.find(d => d.id === el.dataset.id)); break;
    case 'copy-invite': try { await navigator.clipboard.writeText(inviteLink()); toast('Invite link copied.'); } catch(err){ $('#invite-link').select(); toast('Press Ctrl+C to copy.'); } break;
  }
});
document.addEventListener('keydown', e => {
  if (game && !game.idle && !game.over && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { game.keys[e.key] = true; e.preventDefault(); return; }
  if (e.key === 'Escape' && modalOpen()) closeModal();
});
document.addEventListener('keyup', e => { if (game && game.keys) game.keys[e.key] = false; });
document.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'df-name') (layer.querySelector('#dog-form') ? dogDraft : setupDraft).name = e.target.value;
  if (id === 'wf-min') updateWalkEst();
  if (id === 'ci-note' && ciDraft) ciDraft.note = e.target.value;
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'wf-pee' || t.id === 'wf-poo') updateWalkEst();
  if (t.id === 'ci-who' && ciDraft) ciDraft.who = t.value;
  if (t.id === 'pack-switch') loadHousehold(t.value);
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'setup-form') createFirstDog();
  if (f.id === 'walk-form') saveWalk();
  if (f.id === 'member-form') { const n = $('#member-name').value.trim(); if (n && S.family.indexOf(n) < 0) { S.family.push(n); saveHouse(); renderPanel(); } }
  if (f.id === 'dog-form') saveDogForm();
  if (f.id === 'email-form') {
    const em = $('#em').value.trim(); if (!em) return;
    const { error } = await sb.auth.signInWithOtp({email: em, options:{emailRedirectTo: location.origin + location.pathname}});
    toast(error ? 'Could not send the link: ' + error.message : 'Check your inbox for a sign-in link.');
  }
  if (f.id === 'join-form') {
    const code = $('#jc').value.trim().toUpperCase(); if (!code) return;
    const { data, error } = await sb.rpc('join_household', {p_code: code});
    if (error) { toast(error.message.indexOf('No pack') >= 0 ? 'No pack found with that code.' : 'Could not join: ' + error.message); return; }
    lsDel('walkies-join'); await refreshPacks(); loadHousehold(data.id);
  }
});

async function createFirstDog(){
  const d = setupDraft, name = (d.name || '').trim(); if (!name) { toast('Give your dog a name first.'); return; }
  const dog = {id:uid('d'), name, look:d.look, pronoun:d.pronoun, xp:0, eq:{collar:'collar_red'}, created:Date.now()};
  if (!HH && !DEMO) {
    const state = migrate({dogs:[dog], active:dog.id, inv:['collar_red'], bones:100});
    const { data, error } = await sb.rpc('create_household', {p_name: name + '’s pack', p_state: Object.fromEntries(HOUSE_KEYS.map(k => [k, state[k]]))});
    if (error) { toast('Could not create the pack: ' + error.message); return; }
    await refreshPacks(); await loadHousehold(data.id);
  } else {
    S.dogs.push(dog); S.active = dog.id;
    if (S.inv.indexOf('collar_red') < 0) S.inv.push('collar_red');
    S.bones += 100; saveHouse(); renderMain();
  }
  tab = 'today'; setHash();
  showReward({title:'Welcome, ' + name + '!', icon:'gift', sub:'Starter gift: a red collar and 100 bones. Open the daily chest, then start your first walk.' + (DEMO ? '' : ' Invite your family from the Family tab.'), bones:100, party:true});
}
function saveDogForm(){
  const d = dogDraft, name = (d.name || '').trim(); if (!name) { toast('Give your dog a name first.'); return; }
  if (d.id) { const dog = S.dogs.find(x => x.id === d.id); dog.name = name; dog.look = d.look; dog.pronoun = d.pronoun; }
  else { const nd = {id:uid('d'), name, look:d.look, pronoun:d.pronoun, xp:0, eq:{}, created:Date.now()}; S.dogs.push(nd); S.active = nd.id; ciDraft = null; }
  saveHouse(); closeModal(); renderMain();
}
function saveWalk(){
  const dog = activeDog(), btn = $('#wf-save');
  const min = Math.round(Number($('#wf-min').value)); let when = new Date($('#wf-when').value).getTime();
  if (!(min >= 1)) { toast('Enter how many minutes the walk took.'); return; }
  if (!when || isNaN(when)) when = Date.now();
  if (when > Date.now() + 60000) { toast('The start time is in the future. Pick an earlier time.'); return; }
  const who = $('#wf-who').value, pee = $('#wf-pee').checked, poo = $('#wf-poo').checked, note = $('#wf-note').value.trim();
  lsSet('walkies-who3', who); btn.disabled = true;
  const r = walkReward(min, pee, poo);
  const w = Object.assign({id:uid('w'), dogId:dog.id, t:when, min, pee, poo, note, xp:r.xp, bones:r.bones, pts:r.pts}, whoFields(who));
  S.walks.push(w);
  const lv = grant(dog, r), achs = checkAch();
  delete dog.walk;
  putWalk(w); saveHouse(); closeModal(); renderMain();
  showReward({title:'Walk logged!', icon:'paw', sub:min + ' minutes with ' + dog.name + '. ' + (walksOn(dog.id, dayKey(new Date(when))).length >= 2 ? 'Daily walk goal reached.' : 'One more walk today gets full check-in points.'), bones:r.bones, xp:r.xp, levelUp:lv, dogName:dog.name, achs});
}
function submitCheckin(btn){
  const dog = activeDog(), d = ensureDraft(dog), k = ciDayKey();
  if (ci(dog.id, k)) return;
  if (QUESTIONS.some(q => d.answers[q.id] == null)) { toast('Answer every question first.'); return; }
  btn.disabled = true;
  const sc = scoreFor(dog, k, d.answers), r = checkinReward(sc.score);
  const who = $('#ci-who') ? $('#ci-who').value : d.who; lsSet('walkies-who3', who);
  const c = Object.assign({t:Date.now(), answers:Object.assign({}, d.answers), score:sc.score, walkPts:sc.walkPts, xp:r.xp, bones:r.bones, note:d.note}, whoFields(who));
  S.checkins[k + '|' + dog.id] = c;
  const lv = grant(dog, r), achs = checkAch(), g = grade(sc.score);
  putCheckin(k, dog.id, c); saveHouse(); ciDraft = null; renderMain();
  const msg = {S:'Flawless. ' + dog.name + ' had the perfect day.', A:'Great care today. ' + dog.name + ' is one happy dog.', B:'Solid day. A couple of small wins left on the table.', C:'Okay day. Tomorrow, aim for two walks and more play.', D:'Rough day for ' + dog.name + '. Tomorrow is a fresh start.', F:dog.name + ' needs more attention tomorrow. Start with a walk.'}[g];
  showReward({title:'Grade ' + g + ' · ' + sc.score + ' / 100', icon: g === 'S' ? 'crown' : 'report', sub:msg, bones:r.bones, xp:r.xp, levelUp:lv, dogName:dog.name, achs, party: sc.score >= 95});
}

/* ---------- timers ---------- */
function tickTimers(){
  document.querySelectorAll('[data-timer]').forEach(el => {
    const s = Math.max(0, Math.floor((Date.now() - Number(el.dataset.timer))/1000)), h = Math.floor(s/3600), m = Math.floor(s/60) % 60, sec = s % 60;
    el.textContent = (h ? h + ':' + String(m).padStart(2,'0') : m) + ':' + String(sec).padStart(2,'0');
  });
}
setInterval(tickTimers, 1000);
setInterval(() => { if (S.dogs.length && $('#stage-card')) syncStage(); }, 30000);
window.addEventListener('hashchange', () => { const before = tab; readHash(); if (tab !== before && S.dogs.length) renderMain(); });

/* ---------- boot ---------- */
async function refreshPacks(){
  const { data } = await sb.from('members').select('household_id, households(id,name)').eq('user_id', ME.id);
  MYPACKS = (data || []).map(r => r.households).filter(Boolean);
}
async function afterSignIn(session){
  const u = session.user, md = u.user_metadata || {};
  ME = {id:u.id, name: md.full_name || md.name || (u.email || '').split('@')[0], avatar: md.avatar_url || md.picture || ''};
  const join = lsGet('walkies-join');
  if (join) {
    const { data, error } = await sb.rpc('join_household', {p_code: join});
    lsDel('walkies-join');
    if (!error && data) { await refreshPacks(); return loadHousehold(data.id); }
    toast('That invite code did not work. Ask for a new link.');
  }
  await refreshPacks();
  if (!MYPACKS.length) return renderPackChoice();
  const last = lsGet('walkies-hh'), pick = MYPACKS.find(p => p.id === last) || MYPACKS[0];
  loadHousehold(pick.id);
}
async function boot(){
  readHash();
  if (DEMO) {
    ME = {id:null, name:'You', avatar:''};
    try { S = migrate(JSON.parse(lsGet('walkies-demo') || '{}')); } catch(e){ S = migrate({}); }
    return renderAll();
  }
  setSplash('Loading…');
  const { data } = await sb.auth.getSession();
  let started = false;
  if (data.session) { started = true; afterSignIn(data.session); } else renderSignIn();
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'SIGNED_IN' && session && !started) { started = true; afterSignIn(session); }
    if (ev === 'SIGNED_OUT') { started = false; HH = null; renderSignIn(); }
  });
}
boot();
