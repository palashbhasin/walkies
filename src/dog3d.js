// Walkies 3D: a procedural, joined (metaball) dog with poses, tricks, accessories, chroma VFX, crate and bed.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { MarchingCubes } from './mc.js';
import { BREEDS, CHROMAS, ITEM } from './catalog.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;
const col = h => new THREE.Color(h);
const mixHex = (a, b, t) => '#' + col(a).lerp(col(b), t).getHexString();

/* ---------- 3D proportions per breed ---------- */
export const SHAPE = {
  golden:{size:1, leg:1, body:1, head:1, snout:1, chest:1},
  lab:{size:1, leg:1, body:1, head:1, snout:1, chest:1.05},
  yellowlab:{size:1, leg:1, body:1, head:1, snout:1, chest:1.05},
  choclab:{size:1, leg:1, body:1, head:1, snout:1, chest:1.05},
  husky:{size:1, leg:1.05, body:1, head:.98, snout:1.05, chest:1},
  gsd:{size:1.05, leg:1.08, body:1.12, head:1, snout:1.25, chest:1.05},
  corgi:{size:.92, leg:.5, body:1.18, head:1.05, snout:.95, chest:1.05},
  shiba:{size:.88, leg:.95, body:.95, head:1.02, snout:.9, chest:1},
  dalmatian:{size:1, leg:1.12, body:1, head:.98, snout:1.05, chest:.98},
  beagle:{size:.86, leg:.82, body:1, head:1.06, snout:1, chest:1},
  poodle:{size:.95, leg:1.18, body:.92, head:.95, snout:1.2, chest:.95},
  pug:{size:.74, leg:.72, body:.95, head:1.22, snout:.35, chest:1.1},
  frenchie:{size:.78, leg:.7, body:.95, head:1.22, snout:.35, chest:1.15},
  chihuahua:{size:.6, leg:.9, body:.85, head:1.35, snout:.6, chest:.9},
  collie:{size:1, leg:1, body:1.05, head:.95, snout:1.15, chest:1},
  aussie:{size:1, leg:1, body:1, head:1, snout:1, chest:1},
  bernese:{size:1.15, leg:1, body:1.1, head:1.05, snout:1, chest:1.12},
  samoyed:{size:1.05, leg:1, body:1, head:1, snout:.9, chest:1.05},
  pomeranian:{size:.62, leg:.68, body:.85, head:1.2, snout:.5, chest:1},
  boxer:{size:1.05, leg:1.05, body:1, head:1.05, snout:.45, chest:1.12},
  doberman:{size:1.1, leg:1.2, body:1, head:.95, snout:1.3, chest:1.05},
  rottweiler:{size:1.1, leg:.95, body:1.1, head:1.1, snout:.95, chest:1.15},
  cavalier:{size:.8, leg:.85, body:.95, head:1.1, snout:.6, chest:1},
  greyhound:{size:1.05, leg:1.3, body:1.05, head:.85, snout:1.4, chest:1.08},
  doodle:{size:1, leg:1, body:1, head:1.02, snout:1, chest:1}
};

/* ---------- palette ---------- */
export function palette3(dog){
  const B = BREEDS[dog.look] || BREEDS.golden, P = Object.assign({}, B, SHAPE[dog.look] || SHAPE.golden);
  P.earFill = B.earFill || B.dark; P.tan = B.tan || B.dark; P.spots = B.spots || B.dark;
  const chId = dog.eq && dog.eq.chroma, ch = chId ? CHROMAS[chId] : null;
  if (ch) {
    P.fur = ch.fur; P.dark = ch.dark; P.belly = ch.belly; P.earFill = ch.dark; P.tan = ch.tan || mixHex(ch.dark, '#ffffff', .3); P.spots = ch.spot || ch.dark;
    if (ch.eye) P.eye = ch.eye; if (P.tip) P.tip = ch.belly; P.chroma = ch; P.chromaId = chId;
  }
  return P;
}

/* ---------- textures ---------- */
function canvasTex(w, h, draw){ const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const TEX = {};
function tex(name){
  if (TEX[name]) return TEX[name];
  const T = {
    dot: () => canvasTex(64, 64, (x, w) => { const g = x.createRadialGradient(32,32,0,32,32,32); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(.35,'rgba(255,255,255,.55)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0,0,64,64); }),
    star: () => canvasTex(64, 64, x => { x.translate(32,32); const g = x.createRadialGradient(0,0,0,0,0,30); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(.2,'rgba(255,255,255,.6)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i*Math.PI/4, r = i % 2 ? 6 : 30; x.lineTo(Math.cos(a)*r, Math.sin(a)*r); } x.fill(); x.beginPath(); x.arc(0,0,8,0,7); x.fill(); }),
    heart: () => canvasTex(64, 64, x => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32,54); x.bezierCurveTo(4,36,8,10,32,20); x.bezierCurveTo(56,10,60,36,32,54); x.fill(); }),
    petal: () => canvasTex(64, 64, x => { x.fillStyle = '#fff'; x.beginPath(); x.ellipse(32,32,13,24,.5,0,7); x.fill(); }),
    flake: () => canvasTex(64, 64, x => { x.strokeStyle = '#fff'; x.lineWidth = 4; x.lineCap = 'round'; x.translate(32,32); for (let i = 0; i < 6; i++) { x.rotate(Math.PI/3); x.beginPath(); x.moveTo(0,0); x.lineTo(0,24); x.moveTo(0,14); x.lineTo(7,20); x.moveTo(0,14); x.lineTo(-7,20); x.stroke(); } }),
    bubble: () => canvasTex(64, 64, x => { x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = 3; x.beginPath(); x.arc(32,32,24,0,7); x.stroke(); x.fillStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.arc(24,22,5,0,7); x.fill(); }),
    z: () => canvasTex(64, 64, x => { x.fillStyle = '#fff'; x.font = '700 52px Fredoka, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('z', 32, 34); }),
    floor: () => canvasTex(512, 512, x => { const g = x.createRadialGradient(256,256,0,256,256,256); g.addColorStop(0,'rgba(255,190,110,.22)'); g.addColorStop(.45,'rgba(255,170,90,.08)'); g.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0,0,512,512); x.strokeStyle = 'rgba(255,200,140,.12)'; x.lineWidth = 2; x.beginPath(); x.arc(256,256,232,0,7); x.stroke(); x.setLineDash([6,10]); x.beginPath(); x.arc(256,256,180,0,7); x.stroke(); }),
    party: () => canvasTex(128, 128, x => { x.fillStyle = '#ff6b8b'; x.fillRect(0,0,128,128); x.fillStyle = '#ffe08a'; for (let i = -128; i < 256; i += 32) { x.beginPath(); x.moveTo(i,0); x.lineTo(i+14,0); x.lineTo(i+14-128,128); x.lineTo(i-128,128); x.fill(); } }),
    tennis: () => canvasTex(128, 64, x => { x.fillStyle = '#d7ef3a'; x.fillRect(0,0,128,64); x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); for (let i = 0; i <= 128; i++) x.lineTo(i, 32 + Math.sin(i/128*Math.PI*2)*18); x.stroke(); }),
    dots: () => canvasTex(128, 128, x => { x.fillStyle = '#fff'; x.fillRect(0,0,128,128); x.fillStyle = '#000'; for (let i = 0; i < 16; i++) { x.beginPath(); x.arc((i%4)*32+16+((i>>2)%2)*8, (i>>2)*32+16, 4, 0, 7); x.fill(); } }),
    galaxy: () => canvasTex(256, 256, x => { const g = x.createLinearGradient(0,0,256,256); g.addColorStop(0,'#2a1b5e'); g.addColorStop(.5,'#6b3fd6'); g.addColorStop(1,'#1c3a8a'); x.fillStyle = g; x.fillRect(0,0,256,256); x.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { x.globalAlpha = Math.random(); x.beginPath(); x.arc(Math.random()*256, Math.random()*256, Math.random()*1.8, 0, 7); x.fill(); } }),
    rainbow: () => canvasTex(256, 8, x => { const g = x.createLinearGradient(0,0,256,0); ['#ff5d5d','#ffc94d','#4ade80','#4aa8ff','#b47cff','#ff5d5d'].forEach((c,i,a) => g.addColorStop(i/(a.length-1), c)); x.fillStyle = g; x.fillRect(0,0,256,8); })
  };
  TEX[name] = T[name]();
  if (name === 'party' || name === 'galaxy' || name === 'dots') { TEX[name].wrapS = TEX[name].wrapT = THREE.RepeatWrapping; }
  return TEX[name];
}

/* ---------- fur material with rim light + sparkle VFX ---------- */
function furMaterial(P, opts){
  const ch = P.chroma, fx = ch && ch.fx;
  const gold = fx === 'sparkle', neon = fx === 'neon', galaxy = fx === 'stars', prism = fx === 'prism';
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: !!opts.vertexColors, color: opts.color ? col(opts.color) : 0xffffff,
    roughness: gold ? .28 : neon ? .4 : .62, metalness: gold ? .85 : galaxy ? .25 : 0,
    sheen: gold ? 0 : .9, sheenRoughness: .7, sheenColor: col(mixHex(P.fur, '#ffffff', .45)),
    clearcoat: gold || neon || galaxy ? .6 : .08, clearcoatRoughness: .3
  });
  const rimCol = neon ? '#39f3ff' : galaxy ? '#a98bff' : gold ? '#ffd27a' : prism ? '#ff8ad8' : ch ? mixHex(ch.belly, '#ffffff', .4) : '#ffd9a8';
  const u = {uTime:{value:0}, uRim:{value:col(rimCol)}, uRimStr:{value: neon ? 2.6 : galaxy ? 1.3 : gold ? .9 : prism ? 1.2 : ch ? .7 : .38}, uRimPow:{value: neon ? 2.2 : 3.0}, uStars:{value: galaxy ? 1 : gold ? .6 : prism ? .5 : 0}, uHue:{value: prism ? 1 : 0}};
  m.userData.u = u;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'varying vec3 vObjPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');
    sh.fragmentShader = 'uniform float uTime; uniform vec3 uRim; uniform float uRimStr; uniform float uRimPow; uniform float uStars; uniform float uHue; varying vec3 vObjPos;\n' +
      'float h31(vec3 p){ p = fract(p*0.3183099 + .1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }\n' +
      'vec3 hueShift(vec3 c, float a){ const vec3 k = vec3(0.57735); float ca = cos(a); return c*ca + cross(k,c)*sin(a) + k*dot(k,c)*(1.0-ca); }\n' +
      sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\nif (uHue > 0.5) diffuseColor.rgb = hueShift(diffuseColor.rgb, uTime*0.9 + vObjPos.y*2.0);')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), uRimPow);
          vec3 rimC = uRim; if (uHue > 0.5) rimC = hueShift(uRim, uTime*1.3);
          totalEmissiveRadiance += rimC * rimF * uRimStr;
          if (uStars > 0.0) { vec3 cell = floor(vObjPos * 38.0); float r = h31(cell); if (r > 1.0 - 0.03*uStars) { vec3 f = fract(vObjPos*38.0) - 0.5; float d = 1.0 - smoothstep(0.0, 0.35, length(f)); float tw = 0.5 + 0.5*sin(uTime*3.0 + r*40.0); totalEmissiveRadiance += vec3(1.0, 0.95, 0.8) * d * tw * 2.5; } }`);
  };
  m.customProgramCacheKey = () => 'fur' + (neon ? 'n' : '') + (galaxy ? 'g' : '') + (gold ? 'o' : '') + (prism ? 'p' : '');
  return m;
}

/* ---------- particle emitter ---------- */
class Emitter {
  constructor(parent, {texName, max = 200, blending = THREE.AdditiveBlending, size = .1}){
    this.max = max; this.ps = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max*3); this.colA = new Float32Array(max*4); this.sz = new Float32Array(max); this.rot = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.colA, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.sz, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms:{map:{value:tex(texName)}, uScale:{value:600}},
      vertexShader:'attribute vec4 aCol; attribute float aSize; attribute float aRot; uniform float uScale; varying vec4 vCol; varying float vRot; void main(){ vCol = aCol; vRot = aRot; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = aSize*uScale/max(0.1,-mv.z); gl_Position = projectionMatrix*mv; }',
      fragmentShader:'uniform sampler2D map; varying vec4 vCol; varying float vRot; void main(){ vec2 p = gl_PointCoord - 0.5; float c = cos(vRot), s = sin(vRot); p = vec2(c*p.x - s*p.y, s*p.x + c*p.y) + 0.5; vec4 t = texture2D(map, p); gl_FragColor = vec4(vCol.rgb*t.rgb, vCol.a*t.a); if (gl_FragColor.a < 0.01) discard; }',
      transparent:true, depthWrite:false, blending
    });
    this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; this.points.renderOrder = 5;
    parent.add(this.points); this.geo = g; this.mat = mat;
  }
  emit(p){ if (this.ps.length < this.max) this.ps.push(Object.assign({age:0, life:1, size:.1, rot:0, vr:0, color:col('#ffffff'), alpha:1, vel:V(), acc:V()}, p)); }
  update(dt, scale){
    this.mat.uniforms.uScale.value = scale;
    const ps = this.ps;
    for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; p.age += dt; if (p.age >= p.life) { ps.splice(i, 1); continue; } p.vel.addScaledVector(p.acc, dt); p.pos.addScaledVector(p.vel, dt); p.rot += p.vr*dt; if (p.tick) p.tick(p, dt); }
    for (let i = 0; i < this.max; i++) {
      const p = ps[i];
      if (!p) { this.sz[i] = 0; this.colA[i*4+3] = 0; continue; }
      const k = p.age / p.life, fade = p.fade ? p.fade(k) : Math.min(1, k*6) * (1 - Math.pow(k, 2));
      this.pos[i*3] = p.pos.x; this.pos[i*3+1] = p.pos.y; this.pos[i*3+2] = p.pos.z;
      this.colA[i*4] = p.color.r; this.colA[i*4+1] = p.color.g; this.colA[i*4+2] = p.color.b; this.colA[i*4+3] = p.alpha*fade;
      this.sz[i] = p.size * (p.grow ? 1 + k*p.grow : 1); this.rot[i] = p.rot;
    }
    ['position','aCol','aSize','aRot'].forEach(a => { this.geo.getAttribute(a).needsUpdate = true; });
  }
  clear(){ this.ps.length = 0; }
}

/* ---------- the dog ---------- */
const POSES = ['stand','sit','lie','paw'];
class Dog {
  constructor(dog, {res = 52, thumb = false} = {}){
    this.data = dog; this.P = palette3(dog); this.thumb = thumb;
    this.root = new THREE.Group();          // position + heading
    this.trick = new THREE.Group();          // trick rotations around body centre
    this.trick.position.y = .62;
    this.inner = new THREE.Group(); this.inner.position.y = -.62;
    this.root.add(this.trick); this.trick.add(this.inner);
    this.H = 1.18; this.C = V(0, 1.02, 0);
    this.mat = furMaterial(this.P, {vertexColors:true});
    this.mc = new MarchingCubes(res, this.mat, false, true, thumb ? 30000 : 60000);
    this.mc.isolation = 80; this.mc.position.copy(this.C); this.mc.scale.setScalar(this.H);
    this.mc.castShadow = true; this.mc.frustumCulled = false;
    this.inner.add(this.mc);
    this.head = new THREE.Group(); this.inner.add(this.head);
    this.neck = new THREE.Group(); this.inner.add(this.neck);
    this.mats = [this.mat];
    this.colors = {};
    ['fur','dark','belly','tan','spots','eye','earFill'].forEach(k => { this.colors[k] = col(this.P[k] || this.P.fur); });
    this.colors.paw = col(this.P.mk.indexOf('socks') >= 0 ? '#f4f0ea' : this.P.mk.indexOf('tan') >= 0 ? this.P.tan : this.P.belly);
    this.colors.tip = col(this.P.tip || this.P.fur);
    this.colors.white = col('#f6f2ec');
    this.colors.grey = col(mixHex(this.P.fur, '#000000', .3));
    this.pose = {stand:1, sit:0, lie:0, paw:0}; this.poseTarget = 'sit';
    this.walk = 0; this.walkPhase = 0; this.wag = .45; this.mood = 70; this.sleep = false; this.joy = 0; this.blink = 0; this.nextBlink = 2;
    this.headYaw = 0; this.headPitch = 0; this.lookYaw = 0; this.tongue = 0; this.bark = 0;
    this.buildHeadParts(); this.buildAccessories();
    this.t = 0;
    this.setPose('sit', true);
  }
  setPose(name, instant){ this.poseTarget = name; if (instant) POSES.forEach(p => { this.pose[p] = p === name ? 1 : 0; }); }
  has(m){ return this.P.mk.indexOf(m) >= 0; }

  /* joints for a pose */
  joints(name){
    const P = this.P, L = P.leg, B = P.body, ck = P.chest;
    const bl = .34*B, legH = .58*L, by = .12 + legH + .02, z = .155*Math.max(.85, ck);
    const J = {};
    if (name === 'stand' || name === 'paw0') {
      J.chest = V(bl, by+.05, 0); J.mid = V(0, by, 0); J.hips = V(-bl, by+.04, 0);
      J.FL = [V(bl+.03, by-.2, z), V(bl+.05, .12 + legH*.45, z), V(bl+.08, .11, z)];
      J.FR = [V(bl+.03, by-.2, -z), V(bl+.05, .12 + legH*.45, -z), V(bl+.08, .11, -z)];
      J.BL = [V(-bl-.02, by-.1, z+.01), V(-bl-.12, .12 + legH*.5, z), V(-bl-.04, .11, z)];
      J.BR = [V(-bl-.02, by-.1, -z-.01), V(-bl-.12, .12 + legH*.5, -z), V(-bl-.04, .11, -z)];
      J.neck = [V(bl+.2, by+.24, 0), V(bl+.28, by+.42, 0)];
      J.head = V(bl+.36, by+.6, 0); J.pitch = 0; J.tailBase = V(-bl-.26, by+.16, 0); J.tailAng = 1.0;
    } else if (name === 'sit' || name === 'paw') {
      const sy = .12 + legH*.95;
      J.chest = V(.2, sy+.2, 0); J.mid = V(-.04, sy-.04, 0); J.hips = V(-.24, .36, 0);
      J.FL = [V(.26, sy, z), V(.29, .12 + legH*.45, z), V(.32, .11, z)];
      J.FR = name === 'paw' ? [V(.3, sy+.02, -z), V(.5, sy+.08, -z-.02), V(.66, sy+.2, -z-.03)] : [V(.26, sy, -z), V(.29, .12 + legH*.45, -z), V(.32, .11, -z)];
      J.BL = [V(-.18, .3, z+.07), V(-.04, .15, z+.08), V(.1, .1, z+.06)];
      J.BR = [V(-.18, .3, -z-.07), V(-.04, .15, -z-.08), V(.1, .1, -z-.06)];
      J.neck = [V(.3, sy+.44, 0), V(.34, sy+.62, 0)];
      J.head = V(.4, sy+.82, 0); J.pitch = 0; J.tailBase = V(-.42, .22, 0); J.tailAng = .1;
    } else if (name === 'lie') {
      J.chest = V(bl, .31, 0); J.mid = V(0, .29, 0); J.hips = V(-bl, .3, 0);
      J.FL = [V(bl+.12, .2, z), V(bl+.36, .12, z+.01), V(bl+.58, .1, z)];
      J.FR = [V(bl+.12, .2, -z), V(bl+.36, .12, -z-.01), V(bl+.58, .1, -z)];
      J.BL = [V(-bl+.04, .25, z+.12), V(-bl+.2, .13, z+.16), V(-bl+.36, .1, z+.16)];
      J.BR = [V(-bl+.04, .25, -z-.12), V(-bl+.2, .13, -z-.16), V(-bl+.36, .1, -z-.16)];
      J.neck = [V(bl+.22, .43, 0), V(bl+.32, .5, 0)];
      J.head = V(bl+.46, .44, 0); J.pitch = -.12; J.tailBase = V(-bl-.27, .28, 0); J.tailAng = -.15;
    }
    return J;
  }
  blendJoints(){
    const w = this.pose; let total = 0; const out = {};
    const names = ['stand','sit','lie','paw'];
    names.forEach(n => {
      const k = w[n]; if (k < .001) return; total += k;
      const J = this.joints(n);
      Object.keys(J).forEach(key => {
        const v = J[key];
        if (Array.isArray(v)) { out[key] = out[key] || v.map(() => V()); v.forEach((p, i) => out[key][i].addScaledVector(p, k)); }
        else if (v.isVector3) { out[key] = out[key] || V(); out[key].addScaledVector(v, k); }
        else { out[key] = (out[key] || 0) + v*k; }
      });
    });
    Object.keys(out).forEach(key => { const v = out[key]; if (Array.isArray(v)) v.forEach(p => p.divideScalar(total)); else if (v.isVector3) v.divideScalar(total); else out[key] = v / total; });
    return out;
  }

  /* head parts: eyes, nose, tongue, ears */
  buildHeadParts(){
    const P = this.P, hr = .25*P.head, H = this.head;
    this.hr = hr;
    const eyeR = (P.bigEyes ? .062 : P.smallEyes ? .042 : .052) * P.head;
    const glow = P.chroma && (P.chroma.fx === 'neon' || P.chromaId === 'chroma_midnight');
    const eyeMat = new THREE.MeshPhysicalMaterial({color: col(mixHex(P.eye, '#000000', .45)), roughness:.15, clearcoat:1, clearcoatRoughness:.05, emissive: glow ? col(P.eye) : 0x000000, emissiveIntensity: glow ? 1.4 : 0});
    const hiMat = new THREE.MeshBasicMaterial({color:0xffffff});
    this.eyes = [];
    const snout = P.snout, front = hr*.78;
    [1,-1].forEach(s => {
      const g = new THREE.Group();
      g.position.copy(V(.78, .26, s*.5).normalize().multiplyScalar(hr*.97));
      const e = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 24, 16), eyeMat); e.scale.set(.75, 1, 1);
      const hi = new THREE.Mesh(new THREE.SphereGeometry(eyeR*.3, 10, 8), hiMat); hi.position.set(eyeR*.6, eyeR*.35, -s*eyeR*.15);
      g.add(e, hi); H.add(g); this.eyes.push(g);
    });
    // brows for tan breeds
    if (this.has('tan')) [1,-1].forEach(s => { const b = new THREE.Mesh(new THREE.SphereGeometry(eyeR*.65, 12, 8), new THREE.MeshStandardMaterial({color:col(P.tan), roughness:.7})); b.position.set(front*.82, hr*.45, s*hr*.38); b.scale.set(.6,.7,1); H.add(b); });
    // nose at muzzle tip
    const mlen = .1 + .22*snout, mw = snout < .6 ? 1.25 : 1, m2r = hr*(.36 + .06*(1-snout))*mw;
    this.noseLocal = V(hr*.62 + mlen*.6 + m2r*.88, -hr*.2 - .02*snout + m2r*.25, 0);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(.052*Math.max(.8, P.head), 20, 14), new THREE.MeshPhysicalMaterial({color:0x14100e, roughness:.25, clearcoat:1}));
    nose.scale.set(.85, .75, 1.15); nose.position.copy(this.noseLocal); H.add(nose); this.nose = nose;
    // tongue
    const tg = new THREE.Mesh(new THREE.CapsuleGeometry(.035, .06, 6, 12), new THREE.MeshStandardMaterial({color:0xff7a93, roughness:.4}));
    tg.scale.set(1, 1, 1.4); tg.position.set(this.noseLocal.x - m2r*.7, this.noseLocal.y - m2r*.95, 0); H.add(tg); this.tongueMesh = tg;
    // ears
    const earMat = furMaterial(P, {color: (this.has('cap') || this.has('patches') || this.has('saddle')) ? P.earFill : (P.ear === 'small' && !BREEDS[this.data.look].earFill ? mixHex(P.fur, '#000000', .12) : (P.ear === 'pointy' || P.ear === 'bat' || P.ear === 'fold' || P.ear === 'pompom') ? P.fur : P.earFill)});
    this.mats.push(earMat);
    const innerMat = new THREE.MeshStandardMaterial({color:0xe8a3a3, roughness:.8});
    this.ears = [];
    [1,-1].forEach(s => {
      const pivot = new THREE.Group(); H.add(pivot); this.ears.push(pivot);
      let m;
      if (P.ear === 'floppy' || P.ear === 'small' || P.ear === 'long') {
        const len = P.ear === 'long' ? .44 : P.ear === 'small' ? .2 : .34;
        pivot.position.copy(V(-.15, .72, s*.68).normalize().multiplyScalar(hr*.98));
        m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), earMat);
        m.scale.set(.12*P.head*(P.ear === 'small' ? 1.2 : 1), len*P.head*.5, .045);
        m.position.set(.0, -len*P.head*.42, s*.06);
        pivot.rotation.x = -s*(P.ear === 'small' ? .9 : .16); pivot.rotation.z = P.ear === 'small' ? -.5 : .12;
        if (P.feather) { const f = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), earMat); f.scale.set(.1, .12, .06); f.position.set(.02, -len*.75, s*.04); pivot.add(f); }
      } else if (P.ear === 'pointy' || P.ear === 'bat' || P.ear === 'fold') {
        const big = P.bigEar ? 1.25 : 1, bat = P.ear === 'bat';
        const h = (bat ? .3 : .24) * big * P.head, r = (bat ? .13 : .1) * big * P.head;
        pivot.position.copy(V(-.12, .82, s*.55).normalize().multiplyScalar(hr*.9));
        pivot.rotation.x = s*-(bat ? .55 : .3);
        const geo = new THREE.ConeGeometry(r, h, 24, 1, false); geo.translate(0, h/2, 0); geo.scale(.55, 1, 1);
        m = new THREE.Mesh(geo, earMat);
        const inner = new THREE.Mesh(geo, innerMat); inner.scale.set(.6, .78, .7); inner.position.set(r*.32, h*.06, 0); pivot.add(inner);
        if (P.ear === 'fold') { const tip = new THREE.Mesh(new THREE.ConeGeometry(r*.6, h*.45, 16).translate(0, h*.22, 0), earMat); tip.position.set(.0, h*.72, 0); tip.rotation.z = -1.9; pivot.add(tip); m.scale.y = .78; inner.scale.y = .6; }
      } else if (P.ear === 'pompom') {
        pivot.position.copy(V(-.05, .3, s*.95).normalize().multiplyScalar(hr*1.02));
        m = new THREE.Group();
        [[0,-.05,.13],[0,-.2,.15],[.02,-.34,.13]].forEach(c => { const b = new THREE.Mesh(new THREE.SphereGeometry(c[2]*P.head, 16, 12), earMat); b.position.set(c[0], c[1]*P.head, 0); m.add(b); });
      }
      if (m) { m.castShadow = true; pivot.add(m); }
      pivot.userData.base = pivot.rotation.clone(); pivot.userData.s = s;
    });
  }

  /* accessories */
  buildAccessories(){
    const eq = this.data.eq || {}, P = this.P, hr = this.hr;
    const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({color: col(c), roughness:.5}, o || {}));
    const gold = std('#f2c14e', {metalness:.9, roughness:.25, emissive: col('#3a2400'), emissiveIntensity:.3});
    // hat
    const hatId = eq.hat;
    if (hatId) {
      const g = new THREE.Group(); g.position.set(-hr*.05, hr*.92, 0); g.rotation.z = -.12;
      if (hatId === 'hat_beanie') {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(hr*.78, 32, 16, 0, Math.PI*2, 0, Math.PI/2), std('#e5484d', {roughness:.85})); cap.position.y = -hr*.12;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(hr*.76, hr*.11, 12, 40), std('#f2efe8', {roughness:.9})); rim.rotation.x = Math.PI/2; rim.position.y = -hr*.1;
        const pom = new THREE.Mesh(new THREE.SphereGeometry(hr*.2, 16, 12), std('#f2efe8', {roughness:.95})); pom.position.y = hr*.68;
        g.add(cap, rim, pom);
      } else if (hatId === 'hat_party') {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(hr*.42, hr*1.25, 32), std('#ffffff', {map: tex('party')})); cone.position.y = hr*.55;
        const pom = new THREE.Mesh(new THREE.SphereGeometry(hr*.13, 16, 12), std('#ffe08a', {emissive: col('#ffb547'), emissiveIntensity:.4})); pom.position.y = hr*1.2;
        g.add(cone, pom); g.rotation.z = -.3;
      } else if (hatId === 'hat_cowboy') {
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(hr*1.25, hr*1.25, hr*.06, 40), std('#7c4e24', {roughness:.8})); brim.scale.z = .85;
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(hr*.55, hr*.68, hr*.6, 32), std('#9a6331', {roughness:.8})); crown.position.y = hr*.3;
        const band = new THREE.Mesh(new THREE.CylinderGeometry(hr*.66, hr*.69, hr*.12, 32), std('#3b2412')); band.position.y = hr*.08;
        g.add(brim, crown, band);
      } else if (hatId === 'hat_wizard') {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(hr*.55, hr*1.9, 32), std('#5b3fc4', {roughness:.7})); cone.position.y = hr*.9; cone.rotation.z = -.15;
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(hr*1.05, hr*1.05, hr*.05, 40), std('#4a32a6'));
        const st = new THREE.Mesh(new THREE.OctahedronGeometry(hr*.12), std('#ffe08a', {emissive: col('#ffd36b'), emissiveIntensity:2})); st.position.set(hr*.38, hr*.75, 0);
        g.add(cone, brim, st); this.spinMe = st;
      } else if (hatId === 'hat_crown') {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(hr*.6, hr*.62, hr*.3, 32, 1, true), gold); band.material.side = THREE.DoubleSide;
        for (let i = 0; i < 6; i++) { const a = i/6*Math.PI*2, sp = new THREE.Mesh(new THREE.ConeGeometry(hr*.12, hr*.36, 12), gold); sp.position.set(Math.cos(a)*hr*.6, hr*.3, Math.sin(a)*hr*.6); g.add(sp); }
        ['#ff4d6d','#4aa8ff','#4ade80'].forEach((c, i) => { const gem = new THREE.Mesh(new THREE.OctahedronGeometry(hr*.08), std(c, {emissive: col(c), emissiveIntensity:1.2, roughness:.1})); const a = (i-1)*.6; gem.position.set(Math.cos(a)*hr*.63, 0, Math.sin(a)*hr*.63); g.add(gem); });
        g.add(band);
      }
      this.head.add(g);
    }
    // glasses
    const gl = eq.glasses;
    if (gl) {
      const g = new THREE.Group(), ex = this.eyes[0].position.x + .03;
      const z1 = this.eyes[0].position.z, y1 = this.eyes[0].position.y;
      if (gl === 'glasses_specs') {
        const fm = std('#e2d9c8', {metalness:.6, roughness:.3});
        [z1, -z1].forEach(z => { const r = new THREE.Mesh(new THREE.TorusGeometry(hr*.17, hr*.022, 8, 28), fm); r.position.set(ex, y1, z); r.rotation.y = Math.PI/2; g.add(r); });
        const br = new THREE.Mesh(new THREE.CylinderGeometry(hr*.02, hr*.02, z1*2 - hr*.34, 8), fm); br.rotation.x = Math.PI/2; br.position.set(ex, y1 + hr*.04, 0); g.add(br);
      } else if (gl === 'glasses_sun') {
        const lm = new THREE.MeshPhysicalMaterial({color:0x050505, roughness:.05, clearcoat:1, metalness:.3});
        [z1, -z1].forEach(z => { const l = new THREE.Mesh(new THREE.CylinderGeometry(hr*.2, hr*.2, hr*.04, 28), lm); l.rotation.z = Math.PI/2; l.scale.set(1, 1, .8); l.position.set(ex, y1, z); g.add(l); });
        const br = new THREE.Mesh(new THREE.BoxGeometry(hr*.04, hr*.05, z1*2 - hr*.3), lm); br.position.set(ex, y1 + hr*.06, 0); g.add(br);
      } else if (gl === 'glasses_heart') {
        const s = new THREE.Shape(); const k = hr*.2; s.moveTo(0, -k*.9); s.bezierCurveTo(-k*1.4, -k*.1, -k*.9, k*1.1, 0, k*.35); s.bezierCurveTo(k*.9, k*1.1, k*1.4, -k*.1, 0, -k*.9);
        const geo = new THREE.ExtrudeGeometry(s, {depth: hr*.05, bevelEnabled:true, bevelSize:hr*.02, bevelThickness:hr*.02, bevelSegments:2});
        const hm = std('#ff3d6e', {emissive: col('#ff3d6e'), emissiveIntensity:.6, roughness:.2});
        [z1, -z1].forEach(z => { const h = new THREE.Mesh(geo, hm); h.rotation.y = Math.PI/2; h.position.set(ex, y1, z); g.add(h); });
      }
      this.head.add(g);
    }
    // collar + bandana on neck anchor (neck anchor: local x points along neck, y up-ish)
    const cid = eq.collar, nr = .25*Math.max(.9, P.chest);
    const collarCol = cid ? (ITEM[cid].c || '#f2c14e') : '#7a4b2a';
    const cm = cid === 'collar_gold' ? gold : std(collarCol, {roughness:.4});
    const ring = new THREE.Mesh(new THREE.TorusGeometry(nr, nr*.16, 12, 40), cm); ring.rotation.y = Math.PI/2; this.neck.add(ring);
    const tag = new THREE.Mesh(new THREE.CylinderGeometry(nr*.22, nr*.22, nr*.05, 20), gold); tag.rotation.z = Math.PI/2; tag.position.set(.02, -nr*1.12, 0); this.neck.add(tag);
    if (cid === 'collar_studded') for (let i = 0; i < 12; i++) { const a = i/12*Math.PI*2, st = new THREE.Mesh(new THREE.ConeGeometry(nr*.06, nr*.14, 8), std('#d9dde3', {metalness:.9, roughness:.2})); st.position.set(0, Math.cos(a)*nr*1.12, Math.sin(a)*nr*1.12); st.rotation.x = a; this.neck.add(st); }
    if (cid === 'collar_gold') { const gem = new THREE.Mesh(new THREE.OctahedronGeometry(nr*.22), std('#7fe3ff', {emissive: col('#7fe3ff'), emissiveIntensity:1.5, roughness:.05})); gem.position.set(.03, -nr*1.25, 0); this.neck.add(gem); }
    const bid = eq.bandana;
    if (bid) {
      const bm = bid === 'bandana_galaxy' ? std('#ffffff', {map: tex('galaxy'), emissive: col('#4a2aa0'), emissiveIntensity:.5}) : std(ITEM[bid].c, {roughness:.8});
      const sh = new THREE.Shape(); const w = nr*1.25, hgt = nr*1.45; sh.moveTo(-w, 0); sh.quadraticCurveTo(0, -nr*.2, w, 0); sh.lineTo(0, -hgt); sh.lineTo(-w, 0);
      const geo = new THREE.ExtrudeGeometry(sh, {depth:.012, bevelEnabled:true, bevelSize:.012, bevelThickness:.01, bevelSegments:2}); geo.rotateY(Math.PI/2);
      if (bm.map) { bm.map.repeat.set(3, 3); }
      const b = new THREE.Mesh(geo, bm); b.castShadow = true; this.inner.add(b); this.bandana = b;
    }
    this.toyId = eq.toy || null; this.auraId = eq.aura || null;
  }

  /* build field */
  ball(p, r, c){
    const H = this.H, C = this.C, f = 1 / (2*H);
    const x = (p.x - C.x)*f + .5, y = (p.y - C.y)*f + .5, z = (p.z - C.z)*f + .5, rn = r*f;
    const K = 1.6, Rn = rn*K, s = this.mc.isolation / Math.pow(1 - 1/(K*K), 3);
    this.mc.addBall(x, y, z, s, Rn, c);
  }
  cap(a, b, ra, rb, ca, cb){
    const d = a.distanceTo(b), n = Math.max(1, Math.ceil(d / (Math.min(ra, rb)*.45)));
    for (let i = 0; i <= n; i++) { const k = i/n, p = a.clone().lerp(b, k); this.ball(p, lerp(ra, rb, k), cb && k > .5 ? cb : ca); }
  }
  colorAtY(y){ // sunset gradient
    const ch = this.P.chroma; if (!ch || !ch.grad) return null;
    const t = clamp(1 - y/1.6, 0, 1);
    return t < .5 ? col(ch.grad[0]).lerp(col(ch.grad[1]), t*2) : col(ch.grad[1]).lerp(col(ch.grad[2]), (t-.5)*2);
  }
  updateField(J){
    const P = this.P, c = this.colors, mc = this.mc, has = m => this.has(m);
    mc.reset();
    const fur = p => this.colorAtY(p.y) || c.fur;
    const ck = P.chest, fluffy = P.coat === 'fluffy', curly = P.coat === 'curly';
    // torso
    const midR = .28*(this.data.look === 'greyhound' ? .82 : 1);
    this.cap(J.chest, J.mid, .32*ck, midR, fur(J.chest)); this.cap(J.mid, J.hips, midR, .29, fur(J.hips));
    const bellyP = J.mid.clone().lerp(J.chest, .4); bellyP.y -= .17; this.ball(bellyP, .2, c.belly);
    const bib = J.chest.clone(); bib.x += .2; bib.y -= .03; this.ball(bib, .15*ck, (has('mask') || has('blaze') || has('tan')) ? (has('tan') ? c.tan : c.belly) : fur(bib));
    if (has('saddle') || has('cap')) { const s1 = J.mid.clone(); s1.y += .18; this.ball(s1, .2, c.dark); if (has('saddle')) { const s2 = J.hips.clone(); s2.y += .16; this.ball(s2, .18, c.dark); } }
    // neck
    this.cap(J.chest, J.neck[0], .24*ck, .2*Math.max(.9, ck), fur(J.neck[0])); this.cap(J.neck[0], J.neck[1], .2*Math.max(.9, ck), .18*Math.max(.9, ck), fur(J.neck[1])); this.cap(J.neck[1], J.head, .17, .17, fur(J.head));
    if (fluffy) { for (let i = 0; i < 6; i++) { const a = i/5*Math.PI - Math.PI/2; const p = J.neck[0].clone().add(V(.06, -.05 + Math.sin(a)*.04, Math.cos(a)*.17)); this.ball(p, .17, i === 2 || i === 3 ? c.belly : fur(p)); } }
    // legs
    const legR = [[.14,.095,.105],[.18,.095,.105]];
    ['FL','FR','BL','BR'].forEach((k, li) => {
      const L = J[k], rr = legR[li < 2 ? 0 : 1];
      const lower = has('socks') || has('tan') ? c.paw : fur(L[1]);
      this.cap(L[0], L[1], rr[0], rr[1]*.95, fur(L[0]));
      this.cap(L[1], L[2], rr[1]*.95, rr[1]*.9, lower);
      const pw = L[2].clone(); pw.x += .03; this.ball(pw, rr[2], c.paw);
      if (curly) { const cuff = L[2].clone(); cuff.y += .06; this.ball(cuff, .13, fur(cuff)); }
    });
    // spots / merle
    if (has('spots')) [[J.chest, .7, .3, .6],[J.mid, -.2, .8, .5],[J.hips, -.6, .2, .7],[J.mid, .3, .5, -.7],[J.hips, .2, .7, -.5],[J.chest, .2, .6, -.7],[J.mid, .1, -.2, .95]].forEach(s => { const d = V(s[1], s[2], s[3]).normalize(); const p = s[0].clone().addScaledVector(d, .26); this.ball(p, .075, c.spots); });
    if (has('merle')) [[J.chest, .3, .6, .6, 'dark'],[J.mid, -.3, .7, -.5, 'grey'],[J.hips, -.5, .5, .5, 'dark'],[J.mid, .2, .6, .7, 'grey']].forEach(s => { const d = V(s[1], s[2], s[3]).normalize(); const p = s[0].clone().addScaledVector(d, .22); this.ball(p, .12, c[s[4]]); });
    if (curly) [[J.chest,.3,.7,.5],[J.mid,0,.9,.3],[J.hips,-.4,.7,-.4],[J.mid,.1,.6,-.7],[J.hips,-.3,.4,.8],[J.chest,.4,.5,-.6]].forEach(s => { const d = V(s[1], s[2], s[3]).normalize(); const p = s[0].clone().addScaledVector(d, .27); this.ball(p, .1, fur(p)); });
    // tail
    const tb = J.tailBase, ang = J.tailAng, wagA = this.wagAngle;
    const tailSpec = {wag:[14,.07,.045,.46], thin:[16,.045,.028,.52], bushy:[12,.11,.075,.5], curl:[16,.07,.055,.5], stub:[1,.085,.085,0], pom:[10,.04,.035,.34]}[P.tail] || [14,.07,.045,.46];
    for (let i = 0; i < tailSpec[0]; i++) {
      const k = tailSpec[0] > 1 ? i/(tailSpec[0]-1) : 0; let p;
      if (P.tail === 'curl' && this.pose.lie < .5) { const a = Math.PI*.15 + k*Math.PI*1.25; p = tb.clone().add(V(-.12 + Math.cos(a + Math.PI)*-.12, .14 + Math.sin(a)*.16, 0)); p.z += Math.sin(wagA)*.06*k; }
      else { const len = tailSpec[3]*k, a = ang + k*.5 - .15; p = tb.clone().add(V(-Math.cos(a)*len, Math.sin(a)*len, 0)); p.z += Math.sin(wagA)*len*.8; p.x += (1 - Math.cos(wagA))*len*.3; }
      const tc = i === tailSpec[0]-1 && P.tip ? c.tip : fur(p);
      this.ball(p, lerp(tailSpec[1], tailSpec[2], k), tc);
      if (i === tailSpec[0]-1) this.tailTip = p;
    }
    if (P.tail === 'pom' && this.tailTip) this.ball(this.tailTip.clone().add(V(-.05, .05, 0)), .13, fur(this.tailTip));
    // head (via head anchor transform)
    this.head.position.copy(J.head);
    this.head.rotation.set(0, this.headYaw, J.pitch + this.headPitch);
    this.head.updateMatrix();
    const hm = this.head.matrix, hr = this.hr, toW = (x, y, z) => V(x, y, z).applyMatrix4(hm);
    this.ball(J.head, hr, fur(J.head));
    const back = toW(-hr*.25, hr*.05, 0); this.ball(back, hr*.82, fur(back));
    // markings on head
    if (has('cap')) this.ball(toW(-hr*.1, hr*.42, 0), hr*.62, c.dark);
    if (has('patches')) [1,-1].forEach(s => this.ball(toW(hr*.25, hr*.25, s*hr*.42), hr*.33, c.dark));
    if (has('merle')) { this.ball(toW(0, hr*.55, hr*.35), hr*.3, c.dark); this.ball(toW(hr*.1, hr*.4, -hr*.45), hr*.22, c.grey); }
    if (has('spots')) [[.2,.6,.4],[0,.5,-.6],[.4,.1,.7]].forEach(s => { const d = V(s[0], s[1], s[2]).normalize().multiplyScalar(hr*.95); this.ball(toW(d.x, d.y, d.z), hr*.16, c.spots); });
    if (has('blaze')) { this.ball(toW(hr*.62, hr*.5, 0), hr*.22, c.belly); this.ball(toW(hr*.78, hr*.2, 0), hr*.2, c.belly); }
    const muzC = has('darkmask') ? col(mixHex('#' + c.dark.getHexString(), '#000000', .15)) : has('tan') ? c.tan : (has('mask') ? c.belly : col(mixHex('#' + c.fur.getHexString(), '#' + c.belly.getHexString(), .55)));
    if (has('mask')) { this.ball(toW(hr*.45, -hr*.38, hr*.3), hr*.35, c.belly); this.ball(toW(hr*.45, -hr*.38, -hr*.3), hr*.35, c.belly); this.ball(toW(hr*.2, -hr*.62, 0), hr*.35, c.belly); }
    if (fluffy) [1,-1].forEach(s => this.ball(toW(-hr*.05, -hr*.35, s*hr*.62), hr*.5, fur(J.head)));
    if (curly) { this.ball(toW(-hr*.05, hr*.9, 0), hr*.55, fur(J.head)); this.ball(toW(hr*.2, hr*.8, 0), hr*.4, fur(J.head)); }
    // muzzle
    const sn = P.snout, mlen = .1 + .22*sn;
    const m1 = toW(hr*.6, -hr*.18, 0), m2 = toW(hr*.62 + mlen*.6, -hr*.2 - .02*sn, 0);
    const mw = sn < .6 ? 1.25 : 1;
    this.ball(m1, hr*.52*mw, muzC); this.ball(m2, hr*(.36 + .06*(1-sn))*mw, muzC);
    if (sn < .6) [1,-1].forEach(s => this.ball(toW(hr*.62, -hr*.38, s*hr*.32), hr*.3, muzC));
    const chin = toW(hr*.5, -hr*.5, 0); this.ball(chin, hr*.32, has('darkmask') ? muzC : (has('mask') || has('tan') ? muzC : c.belly));
    mc.update();
    // neck anchor for collar
    const n0 = J.neck[0], n1 = J.neck[1], dir = n1.clone().sub(n0).normalize();
    this.neck.position.copy(n0.clone().lerp(n1, .15)).addScaledVector(dir, -.03);
    this.neck.quaternion.setFromUnitVectors(V(1, 0, 0), dir);
    if (this.bandana) { const nr = .25*Math.max(.9, P.chest); this.bandana.position.copy(n0).add(V(nr*.9, -nr*.15, 0)); this.bandana.rotation.set(0, 0, -.35 + (J.chest.y - J.hips.y)*.9); }
  }

  update(dt, ctx){
    this.t += dt; const t = this.t;
    // pose blend
    POSES.forEach(p => { const tgt = p === this.poseTarget ? 1 : 0; this.pose[p] = lerp(this.pose[p], tgt, 1 - Math.pow(.0008, dt)); });
    const J = this.blendJoints();
    // walk cycle
    const wk = this.walk;
    if (wk > .01) {
      this.walkPhase += dt * 9.5 * (ctx.walkSpeed || 1);
      const ph = this.walkPhase;
      [['FL',0],['BR',0],['FR',Math.PI],['BL',Math.PI]].forEach(([k, o]) => {
        const s = Math.sin(ph + o), lift = Math.max(0, Math.cos(ph + o));
        J[k][2].x += s*.13*wk; J[k][2].y += lift*.08*wk; J[k][1].x += s*.07*wk; J[k][1].y += lift*.05*wk;
      });
      const bob = Math.abs(Math.sin(this.walkPhase))*.025*wk;
      ['chest','mid','hips','head'].forEach(k => { J[k].y += bob; }); J.neck.forEach(n => { n.y += bob; });
    }
    // breathing
    const br = Math.sin(t*(this.sleep ? 1.4 : 2.6))*(this.sleep ? .012 : .008);
    J.chest.y += br; J.mid.y += br*.7;
    // tail wag
    const sad = this.mood < 25 && !this.sleep;
    const wagSpeed = this.sleep ? 0 : (this.joy > 0 ? 22 : 1/Math.max(.12, this.wag)*5.5);
    this.wagAngle = this.sleep ? 0 : Math.sin(t*wagSpeed)*(sad ? .15 : .6);
    if (sad) J.tailAng = Math.min(J.tailAng, -.3);
    // head look
    const lyTarget = this.sleep ? 0 : clamp(ctx.lookYaw || 0, -.7, .7);
    this.headYaw = lerp(this.headYaw, lyTarget, 1 - Math.pow(.02, dt));
    let pitch = this.sleep ? -.1 : sad ? -.25 : Math.sin(t*.7)*.04;
    if (this.bark > 0) { this.bark -= dt; pitch += Math.abs(Math.sin(this.bark*22))*.18; }
    this.headPitch = lerp(this.headPitch, pitch + (ctx.tilt || 0), 1 - Math.pow(.01, dt));
    this.updateField(J);
    // eyes: blink / joy / sleep
    this.nextBlink -= dt; if (this.nextBlink < 0) { this.blink = .15; this.nextBlink = 2.5 + Math.random()*4; }
    if (this.blink > 0) this.blink -= dt;
    this.joy = Math.max(0, this.joy - dt);
    const closed = this.sleep || this.dead ? .08 : this.joy > 0 ? .25 : this.blink > 0 ? .1 : 1;
    this.eyes.forEach(e => { e.scale.y = lerp(e.scale.y, closed, .35); });
    // tongue
    const pant = (this.mood >= 45 || this.joy > 0 || this.bark > 0 || this.dead) && !this.sleep;
    this.tongue = lerp(this.tongue, pant ? 1 : 0, .1);
    this.tongueMesh.visible = this.tongue > .05;
    this.tongueMesh.scale.set(this.tongue, this.tongue*(1 + Math.sin(t*12)*.12), this.tongue*1.4);
    // ears
    this.ears.forEach(e => {
      const b = e.userData.base, s = e.userData.s;
      const flop = Math.sin(t*3 + s)*.04 + (wk > .01 ? Math.sin(this.walkPhase*2)*.1 : 0) + (sad ? s*.25 : 0);
      e.rotation.x = b.x + flop*s; e.rotation.z = b.z + (sad ? .2 : 0);
    });
    if (this.spinMe) this.spinMe.rotation.y += dt*2;
    this.mats.forEach(m => { if (m.userData.u) m.userData.u.uTime.value = t; });
  }
  dispose(){ this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.mats.forEach(m => m.dispose()); }
}

/* ---------- world props ---------- */
function makeToy(id){
  const g = new THREE.Group(), std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({color: col(c), roughness:.5}, o || {}));
  if (id === 'toy_ball') { const b = new THREE.Mesh(new THREE.SphereGeometry(.1, 24, 16), std('#ffffff', {map: tex('tennis'), roughness:.9})); b.position.y = .1; g.add(b); }
  else if (id === 'toy_golden') { const b = new THREE.Mesh(new THREE.SphereGeometry(.1, 32, 20), std('#f2c14e', {metalness:1, roughness:.15, emissive: col('#ffb547'), emissiveIntensity:.35})); b.position.y = .1; g.add(b); g.userData.sparkle = true; }
  else if (id === 'toy_bone') { const m = std('#f1e6cf', {roughness:.7}); const c = new THREE.Mesh(new THREE.CapsuleGeometry(.04, .24, 6, 12), m); c.rotation.z = Math.PI/2; c.position.y = .06; g.add(c); [[-.15,.035],[-.15,-.035],[.15,.035],[.15,-.035]].forEach(p => { const s = new THREE.Mesh(new THREE.SphereGeometry(.05, 16, 12), m); s.position.set(p[0], .06, p[1]); g.add(s); }); g.rotation.y = .6; }
  else if (id === 'toy_rope') { const curve = new THREE.CatmullRomCurve3([V(-.22,.05,0), V(-.08,.09,.06), V(.08,.05,-.05), V(.22,.06,0)]); const t1 = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, .04, 10), std('#e0533f', {roughness:.9})); g.add(t1); [-.22,.22].forEach(x => { const k = new THREE.Mesh(new THREE.SphereGeometry(.065, 14, 10), std('#f2efe8', {roughness:.95})); k.position.set(x, .06, 0); g.add(k); }); }
  else if (id === 'toy_frisbee') { const f = new THREE.Mesh(new THREE.CylinderGeometry(.2, .18, .035, 40), std('#4aa8ff', {roughness:.3, clearcoat:.5})); f.position.y = .02; g.add(f); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function makeCrate(){
  const g = new THREE.Group(), W = 1.95, Hh = 1.3, D = 1.35;
  const wire = new THREE.MeshStandardMaterial({color:0xc6cdd8, metalness:.9, roughness:.32});
  const frame = new THREE.MeshStandardMaterial({color:0x8a93a3, metalness:.85, roughness:.35});
  const bar = (a, b, r, m) => { const d = b.clone().sub(a), len = d.length(); const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), m); c.position.copy(a).add(b).multiplyScalar(.5); c.quaternion.setFromUnitVectors(V(0,1,0), d.normalize()); c.castShadow = true; return c; };
  const x0 = -W/2, x1 = W/2, z0 = -D/2, z1 = D/2, y0 = .06, y1 = Hh;
  // back, sides, top
  for (let x = x0; x <= x1 + .001; x += W/14) { g.add(bar(V(x, y0, z0), V(x, y1, z0), .009, wire)); g.add(bar(V(x, y1, z0), V(x, y1, z1), .009, wire)); }
  for (let z = z0; z <= z1 + .001; z += D/9) { g.add(bar(V(x0, y0, z), V(x0, y1, z), .009, wire)); g.add(bar(V(x1, y0, z), V(x1, y1, z), .009, wire)); }
  [y0 + .02, (y0+y1)/2, y1].forEach(y => { g.add(bar(V(x0, y, z0), V(x1, y, z0), .011, frame)); g.add(bar(V(x0, y, z0), V(x0, y, z1), .011, frame)); g.add(bar(V(x1, y, z0), V(x1, y, z1), .011, frame)); });
  // frame edges
  [[x0,z0],[x1,z0],[x0,z1],[x1,z1]].forEach(([x, z]) => g.add(bar(V(x, y0, z), V(x, y1, z), .018, frame)));
  g.add(bar(V(x0, y1, z1), V(x1, y1, z1), .018, frame)); g.add(bar(V(x0, y0, z1), V(x1, y0, z1), .018, frame));
  // tray
  const tray = new THREE.Mesh(new THREE.BoxGeometry(W + .08, .07, D + .08), new THREE.MeshStandardMaterial({color:0x22262e, roughness:.6})); tray.position.y = .035; tray.receiveShadow = true; g.add(tray);
  // handle
  const hc = new THREE.Mesh(new THREE.TorusGeometry(.16, .015, 8, 24, Math.PI), frame); hc.position.set(0, y1, 0); g.add(hc);
  // door on front (z1), hinge at x0
  const door = new THREE.Group(); door.position.set(x0 + .04, 0, z1 + .02);
  const dw = W - .08;
  for (let x = 0; x <= dw + .001; x += dw/14) door.add(bar(V(x, y0 + .03, 0), V(x, y1 - .03, 0), .01, wire));
  [y0 + .05, (y0+y1)/2, y1 - .05].forEach(y => door.add(bar(V(0, y, 0), V(dw, y, 0), .013, frame)));
  const latch = new THREE.Mesh(new THREE.BoxGeometry(.08, .12, .06), new THREE.MeshStandardMaterial({color:0xffb547, metalness:.6, roughness:.3, emissive:0x553300})); latch.position.set(dw - .02, (y0+y1)/2, .02); door.add(latch);
  g.add(door); g.userData.door = door;
  return g;
}
function makeBed(){
  const g = new THREE.Group();
  const fab = new THREE.MeshPhysicalMaterial({color:0x4a3d7c, roughness:.9, sheen:1, sheenColor:new THREE.Color('#b6a6ff'), sheenRoughness:.6});
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.95, .2, 20, 60), fab); rim.rotation.x = Math.PI/2; rim.scale.set(1.15, 1, 1); rim.position.y = .14;
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(.95, .95, .1, 48), new THREE.MeshPhysicalMaterial({color:0x2b2350, roughness:.95, sheen:1, sheenColor:new THREE.Color('#8f7fe0')})); cushion.scale.set(1.15, 1, 1); cushion.position.y = .06;
  [rim, cushion].forEach(m => { m.receiveShadow = true; m.castShadow = true; }); g.add(rim, cushion);
  return g;
}

/* ---------- the stage ---------- */
export function createStage(container, cb = {}){
  const W = () => container.clientWidth, Hh = () => container.clientHeight;
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(W(), Hh());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block'; renderer.domElement.style.touchAction = 'none';
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000); scene.fog = new THREE.Fog(0x000000, 7, 14);
  const camera = new THREE.PerspectiveCamera(36, W()/Hh(), .1, 60); camera.position.set(1.5, 1.65, 3.9);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, .55, 0); controls.enableDamping = true; controls.dampingFactor = .08; controls.enablePan = false;
  controls.minDistance = 2.4; controls.maxDistance = 8; controls.maxPolarAngle = Math.PI*.49; controls.minPolarAngle = .25;
  controls.autoRotateSpeed = .6;
  // lights
  const hemi = new THREE.HemisphereLight(0xfff1dc, 0x1a1420, .55); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe6c4, 2.2); key.position.set(3, 5, 3.5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 3; key.shadow.camera.bottom = -3; key.shadow.bias = -.0008; key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fb4ff, 1.4); rim.position.set(-3, 2.5, -4); scene.add(rim);
  const fill = new THREE.PointLight(0xffb547, 1.2, 6, 2); fill.position.set(0, .4, 1.6); scene.add(fill);
  // floor
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshStandardMaterial({color:0x0c0d10, roughness:.95})); floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({map: tex('floor'), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending})); glow.rotation.x = -Math.PI/2; glow.position.y = .003; scene.add(glow);
  // stars + dust
  const sky = new Emitter(scene, {texName:'dot', max:160});
  for (let i = 0; i < 160; i++) { const a = Math.random()*Math.PI*2, e = .1 + Math.random()*.9, r = 9 + Math.random()*3; sky.emit({pos: V(Math.cos(a)*r*Math.cos(e), 1 + Math.sin(e)*r*.7, Math.sin(a)*r*Math.cos(e)), life: 1e9, size: .05 + Math.random()*.08, color: col('#dfe8ff'), alpha: .15 + Math.random()*.5, fade: () => 1, tw: Math.random()*6, tick: p => { p.alpha = p.a0 * (.55 + .45*Math.sin(clock.elapsedTime*1.5 + p.tw)); }}); sky.ps[i].a0 = sky.ps[i].alpha; }
  const dust = new Emitter(scene, {texName:'dot', max:70});
  const fx = new Emitter(scene, {texName:'star', max:260});
  const fxSoft = new Emitter(scene, {texName:'dot', max:200});
  const hearts = new Emitter(scene, {texName:'heart', max:60, blending:THREE.NormalBlending});
  const petals = new Emitter(scene, {texName:'petal', max:80, blending:THREE.NormalBlending});
  const flakes = new Emitter(scene, {texName:'flake', max:90});
  const bubbles = new Emitter(scene, {texName:'bubble', max:60});
  const zzz = new Emitter(scene, {texName:'z', max:12, blending:THREE.NormalBlending});
  const emitters = [sky, dust, fx, fxSoft, hearts, petals, flakes, bubbles, zzz];
  // composer
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W(), Hh()), .55, .45, .82); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const clock = new THREE.Clock();

  const HOME = V(0, 0, 0), BED = V(-.05, 0, -.15), CRATE = V(0, 0, -.1), CRATE_DOG = V(-.18, 0, -.12);
  let dog = null, toy = null, crate = null, bed = null, aura = null;
  const S = {mood:70, sleep:false, crated:false, walking:false, night:false, target:null, heading:-Math.PI/2 + .95, idleT:0, trick:null, trickT:0, wander:6, lastSay:0, crateOpen:1};

  function setDog(d){
    if (dog) { dog.root.parent.remove(dog.root); dog.dispose(); }
    if (toy) { scene.remove(toy); toy = null; }
    if (aura) { scene.remove(aura); aura = null; }
    dog = new Dog(d, {res: 52});
    dog.root.position.copy(S.crated ? CRATE_DOG : S.sleep ? BED : HOME); if (S.crated) S.heading = 0;
    dog.root.rotation.y = S.heading;
    dog.root.scale.setScalar(dog.P.size);
    scene.add(dog.root);
    dog.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    if (dog.toyId) { toy = makeToy(dog.toyId); toy.position.set(.95, 0, .9); scene.add(toy); }
    if (dog.auraId === 'aura_rainbow') { aura = new THREE.Mesh(new THREE.TorusGeometry(1.25, .022, 10, 120), new THREE.MeshBasicMaterial({map: tex('rainbow'), color:0xffffff})); aura.rotation.x = Math.PI/2; aura.position.y = .05; scene.add(aura); }
    fx.clear(); fxSoft.clear(); petals.clear(); flakes.clear(); bubbles.clear();
    applyMode();
  }
  function applyMode(){
    const night = S.night;
    hemi.intensity = night ? .25 : .55; key.intensity = night ? .7 : 2.2; key.color.set(night ? 0x9fb4ff : 0xffe6c4);
    fill.color.set(night ? 0x6f8cff : 0xffb547); fill.intensity = night ? .8 : 1.2;
    glow.material.opacity = night ? .5 : 1;
    sky.points.visible = night || true;
    if (S.crated && !crate) { crate = makeCrate(); crate.position.copy(CRATE); scene.add(crate); crate.userData.door.rotation.y = -1.7; S.crateOpen = 1; }
    if (!S.crated && crate && S.crateOpen >= .99 && !S.releasing) { scene.remove(crate); crate = null; }
    if (S.sleep && !S.crated && !bed) { bed = makeBed(); bed.position.copy(BED); scene.add(bed); }
    if ((!S.sleep || S.crated) && bed) { scene.remove(bed); bed = null; }
  }
  function setState(o){
    const was = {crated:S.crated, sleep:S.sleep};
    Object.assign(S, o);
    if (dog) dog.mood = S.mood; if (dog) dog.wag = o.wag ? parseFloat(o.wag) : dog.wag;
    if (S.crated && !was.crated) { if (!crate) { crate = makeCrate(); crate.position.copy(CRATE); scene.add(crate); crate.userData.door.rotation.y = -1.7; } S.trick = null; if (dog) { S.target = CRATE_DOG.clone(); } }
    if (!S.crated && was.crated && crate) { S.releasing = true; }
    if (S.sleep && !was.sleep && dog && !S.crated) S.target = BED.clone();
    applyMode();
  }
  function say(t){ if (cb.say) cb.say(t); }
  function trick(id){
    if (!dog || S.crated) return;
    S.trick = id; S.trickT = 0; S.target = null; dog.walk = 0;
    if (id === 'speak') dog.bark = 1.2;
    dog.joy = 1.2;
  }
  function pet(point){
    if (!dog) return;
    dog.joy = 1.4;
    const at = point || dog.root.position.clone().add(V(0, 1, 0));
    for (let i = 0; i < 7; i++) hearts.emit({pos: at.clone().add(V((Math.random()-.5)*.4, Math.random()*.2, (Math.random()-.5)*.4)), vel: V((Math.random()-.5)*.3, .7 + Math.random()*.5, (Math.random()-.5)*.3), life: 1.2 + Math.random()*.5, size: .16 + Math.random()*.1, color: col(['#ff6b8b','#ff8fa8','#ff4d7a'][i%3]), rot: (Math.random()-.5)*.6});
    if (S.sleep && !S.crated) { S.sleep = false; S.target = HOME.clone(); if (cb.onWake) cb.onWake(); applyMode(); }
  }
  function release(){ // crate door opens and dog hops out
    S.releasing = true;
  }
  // pointer: tap dog to pet, tap floor to walk
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = {x:e.clientX, y:e.clientY, t:performance.now()}; controls.autoRotate = false; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
    if (moved > 7 || dt > 450) return;
    const r = renderer.domElement.getBoundingClientRect(); ndc.set((e.clientX - r.left)/r.width*2 - 1, -(e.clientY - r.top)/r.height*2 + 1);
    ray.setFromCamera(ndc, camera);
    if (dog) {
      // dog hit: test against a bounding sphere around body + head
      const c = V(); dog.mc.getWorldPosition(c); c.y -= .2*dog.P.size;
      const sph = new THREE.Sphere(c, .75*dog.P.size), hit = V();
      if (ray.ray.intersectSphere(sph, hit)) { pet(hit); if (cb.onPet) cb.onPet(); return; }
    }
    const pl = new THREE.Plane(V(0,1,0), 0), p = V();
    if (ray.ray.intersectPlane(pl, p) && p.length() < 2.6 && !S.crated && !S.sleep && !S.walking) { p.z = Math.min(p.z, 1.1); S.target = p; S.trick = null; if (cb.onMove) cb.onMove(); }
  });

  function lookYawToCamera(){
    const d = camera.position.clone().sub(dog.root.position); const a = Math.atan2(-d.z, d.x);
    let rel = a - dog.root.rotation.y; while (rel > Math.PI) rel -= Math.PI*2; while (rel < -Math.PI) rel += Math.PI*2;
    return rel;
  }
  let raf = 0, alive = true, last = 0, frameCount = 0;
  function tick(){
    if (!alive) return; raf = requestAnimationFrame(tick);
    const dt = Math.min(.05, clock.getDelta()), t = clock.elapsedTime;
    controls.update();
    if (dog) {
      const root = dog.root, P = dog.P;
      dog.sleep = S.sleep && !S.trick;
      // movement
      let moving = false;
      if (S.walking && !S.crated) { // pacing loop while on a walk
        const a = t*.45; S.target = V(Math.cos(a)*1.3, 0, Math.sin(a)*.9);
      }
      if (S.target && !S.trick) {
        const d = S.target.clone().sub(root.position); d.y = 0; const dist = d.length();
        if (dist > .06) {
          moving = true;
          const want = Math.atan2(-d.z, d.x); let diff = want - root.rotation.y; while (diff > Math.PI) diff -= Math.PI*2; while (diff < -Math.PI) diff += Math.PI*2;
          root.rotation.y += diff * Math.min(1, dt*6);
          const sp = (S.walking ? 1.05 : .95) * P.size * Math.max(.3, 1 - Math.abs(diff));
          root.position.addScaledVector(d.normalize(), Math.min(dist, sp*dt));
        } else if (!S.walking) { S.target = null; S.idleT = 0; }
      }
      dog.walk = lerp(dog.walk, moving ? 1 : 0, 1 - Math.pow(.002, dt));
      if (!moving && !S.trick) { // turn to show a 3/4 view toward the camera
        const d = camera.position.clone().sub(root.position); let want = S.crated ? 0 : Math.atan2(-d.z, d.x) + .75, diff = want - root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI*2; while (diff < -Math.PI) diff += Math.PI*2;
        if (Math.abs(diff) > .5 || S.turning) { S.turning = Math.abs(diff) > .05; root.rotation.y += diff*Math.min(1, dt*2.2); }
      }
      // pose choice
      let pose = 'stand';
      if (S.crated) pose = moving ? 'stand' : 'lie';
      else if (S.sleep) pose = moving ? 'stand' : 'lie';
      else if (!moving) { S.idleT += dt; pose = S.idleT > 2.5 ? 'sit' : 'stand'; }
      // tricks
      dog.trick.rotation.set(0, 0, 0); dog.trick.position.set(0, .62, 0); dog.dead = false;
      if (S.trick) {
        S.trickT += dt; const k = S.trickT, id = S.trick;
        const dur = {sit:1.6, speak:1.4, paw:1.8, spin:1.1, jump:1, roll:1.6, dead:2.6, flip:1.2}[id] || 1.5;
        if (id === 'sit') pose = 'sit';
        if (id === 'speak') { pose = 'sit'; if (k < .05) say('Woof! Woof!'); }
        if (id === 'paw') pose = 'paw';
        if (id === 'spin') { pose = 'stand'; dog.walk = .8; dog.trick.rotation.y = ease(clamp(k/dur, 0, 1))*Math.PI*2; }
        if (id === 'jump') { pose = k < .15 ? 'sit' : 'stand'; const u = clamp((k - .15)/(dur - .25), 0, 1); dog.trick.position.y += Math.sin(u*Math.PI)*.75; }
        if (id === 'roll') { pose = 'lie'; const u = clamp((k - .3)/1, 0, 1); dog.trick.rotation.x = ease(u)*Math.PI*2; dog.trick.position.y = .62 - .25; }
        if (id === 'dead') { pose = 'lie'; const u = clamp(k/.4, 0, 1)*(k > dur - .4 ? (dur - k)/.4 : 1); dog.trick.rotation.x = -u*1.45; dog.trick.position.y = .62 - .26*u; dog.dead = k > .3 && k < dur - .3; }
        if (id === 'flip') { pose = 'stand'; const u = clamp(k/dur, 0, 1); dog.trick.position.y += Math.sin(u*Math.PI)*.95; dog.trick.rotation.z = ease(u)*Math.PI*2; }
        if (k >= dur) { S.trick = null; S.idleT = 3; }
      }
      dog.setPose(pose);
      // wander
      if (!S.target && !S.trick && !S.crated && !S.sleep && !S.walking && !S.releasing) { S.wander -= dt; if (S.wander < 0) { S.wander = 9 + Math.random()*10; const a = Math.random()*Math.PI*2, r = .3 + Math.random()*.9; S.target = V(Math.cos(a)*r, 0, Math.min(.45, Math.sin(a)*r*.8)); } }
      // crate door
      if (crate) {
        const door = crate.userData.door;
        const want = (S.crated && !S.target && !S.releasing) ? 0 : -1.7;
        door.rotation.y = lerp(door.rotation.y, want, 1 - Math.pow(.02, dt));
        if (S.releasing) {
          if (door.rotation.y < -1.2 && !S.escaped) { S.escaped = true; S.target = V(.5, 0, .95); dog.joy = 1.6; pet(dog.root.position.clone().add(V(0,1,0))); }
          if (S.escaped && !S.target) { S.releasing = false; S.escaped = false; scene.remove(crate); crate = null; }
        }
      }
      // look at camera
      const look = moving ? 0 : lookYawToCamera();
      dog.update(dt, {lookYaw: look, tilt: dog.joy > 0 ? Math.sin(t*4)*.12 : 0});
      // VFX
      vfx(dt, t);
    }
    if (aura) aura.rotation.z += dt*.6;
    if (toy && toy.userData.sparkle && Math.random() < dt*6) fx.emit({pos: toy.position.clone().add(V((Math.random()-.5)*.25, .05 + Math.random()*.2, (Math.random()-.5)*.25)), life:.8, size:.1, color: col('#ffe08a')});
    const scale = renderer.domElement.height / (2*Math.tan(camera.fov*Math.PI/360));
    emitters.forEach(e => e.update(dt, scale));
    composer.render();
    frameCount++;
  }
  function randBody(spread){ const c = V(); dog.mc.getWorldPosition(c); c.y -= .15*dog.P.size; return c.add(V((Math.random()-.5)*spread, (Math.random()-.4)*spread*.8, (Math.random()-.5)*spread)); }
  function vfx(dt, t){
    const ch = dog.P.chroma, id = dog.P.chromaId, root = dog.root.position;
    const rate = (n) => Math.random() < dt*n;
    if (rate(1.5)) dust.emit({pos: V((Math.random()-.5)*4, .1 + Math.random()*1.8, (Math.random()-.5)*3), vel: V((Math.random()-.5)*.05, .03 + Math.random()*.05, 0), life: 6, size: .025 + Math.random()*.03, color: col(S.night ? '#cfdcff' : '#ffd99a'), alpha:.45});
    if (S.sleep && !S.trick && rate(.9)) { const h = V(); dog.head.getWorldPosition(h); zzz.emit({pos: h.add(V(0, .25, 0)), vel: V(.08, .28, 0), life: 2.4, size: .14 + Math.random()*.08, color: col('#cfdcff'), rot: (Math.random()-.5)*.5, grow:.6}); }
    if (ch) {
      if (id === 'chroma_frost' && rate(14)) flakes.emit({pos: root.clone().add(V((Math.random()-.5)*2.4, 2.2, (Math.random()-.5)*2)), vel: V((Math.random()-.5)*.1, -.35 - Math.random()*.2, 0), vr: (Math.random()-.5)*2, life: 6, size: .06 + Math.random()*.05, color: col('#dff3ff'), alpha:.9, tick: p => { p.pos.x += Math.sin(t*2 + p.size*100)*.002; if (p.pos.y < .02) p.age = p.life; }});
      if (id === 'chroma_cherry' && rate(6)) petals.emit({pos: root.clone().add(V((Math.random()-.5)*2.4, 2.2, (Math.random()-.5)*2)), vel: V(.1, -.3, 0), vr: (Math.random()-.5)*3, life: 7, size: .09 + Math.random()*.04, color: col(['#ffb7cc','#ff9fbd','#ffd1de'][Math.floor(Math.random()*3)]), tick: p => { p.vel.x = Math.sin(t*1.5 + p.size*80)*.25; if (p.pos.y < .02) { p.vel.set(0,0,0); } }});
      if (id === 'chroma_mint' && rate(5)) bubbles.emit({pos: randBody(.9), vel: V(0, .3 + Math.random()*.2, 0), life: 2.5, size: .06 + Math.random()*.06, color: col('#bfffe9'), alpha:.8, tick: p => { p.pos.x += Math.sin(t*3 + p.size*90)*.003; }});
      if (id === 'chroma_sunset' && rate(10)) fxSoft.emit({pos: randBody(1), vel: V((Math.random()-.5)*.1, .45 + Math.random()*.3, (Math.random()-.5)*.1), life: 1.8, size: .05 + Math.random()*.05, color: col(['#ffb347','#ff7a59','#ff4d7a'][Math.floor(Math.random()*3)]), alpha: 1});
      if (id === 'chroma_neon' && rate(12)) { const a = Math.random()*Math.PI*2; fxSoft.emit({pos: root.clone().add(V(Math.cos(a)*.9, .2 + Math.random()*1.2, Math.sin(a)*.9)), vel: V(-Math.sin(a)*.3, .05, Math.cos(a)*.3), life: 2, size: .05, color: col(Math.random() < .5 ? '#39f3ff' : '#ff3df2'), alpha: 1}); }
      if (id === 'chroma_gold' && rate(12)) fx.emit({pos: randBody(1), life: .7, size: .09 + Math.random()*.08, color: col('#fff1b8'), rot: Math.random()*3, grow: -.5});
      if (id === 'chroma_galaxy' && rate(10)) { const a = Math.random()*Math.PI*2, r = .9 + Math.random()*.4; fx.emit({pos: root.clone().add(V(Math.cos(a)*r, .3 + Math.random()*1.1, Math.sin(a)*r)), life: 3, size: .05 + Math.random()*.06, color: col(['#ffe08a','#b6a6ff','#ffffff'][Math.floor(Math.random()*3)]), tick: p => { const ang = Math.atan2(p.pos.z - root.z, p.pos.x - root.x) + .25*1/60, rr = Math.hypot(p.pos.z - root.z, p.pos.x - root.x); p.pos.x = root.x + Math.cos(ang)*rr; p.pos.z = root.z + Math.sin(ang)*rr; }}); }
      if (id === 'chroma_midnight' && rate(3)) fxSoft.emit({pos: root.clone().add(V((Math.random()-.5)*2.4, .2 + Math.random()*1.4, (Math.random()-.5)*2)), vel: V((Math.random()-.5)*.1, (Math.random()-.5)*.1, 0), life: 4, size: .05, color: col('#ffd36b'), alpha: 1, fade: k => Math.sin(k*Math.PI)});
      if (id === 'chroma_prism' && rate(10)) fx.emit({pos: randBody(1.1), life: .9, size: .09, color: new THREE.Color().setHSL((t*.2 + Math.random()*.3) % 1, 1, .65), rot: Math.random()*3});
    }
    if (dog.auraId === 'aura_sparkle' && rate(14)) { const a = Math.random()*Math.PI*2; fx.emit({pos: root.clone().add(V(Math.cos(a)*(.8 + Math.random()*.4), Math.random()*1.6, Math.sin(a)*(.8 + Math.random()*.4))), life: 1, size: .1 + Math.random()*.08, color: col('#ffe08a'), rot: Math.random()*3}); }
    if (dog.auraId === 'aura_fire' && rate(30)) { const a = Math.random()*Math.PI*2, r = .5 + Math.random()*.5; fxSoft.emit({pos: root.clone().add(V(Math.cos(a)*r, .05, Math.sin(a)*r)), vel: V(0, .7 + Math.random()*.6, 0), life: 1.1, size: .12 + Math.random()*.1, color: col(['#ffcc4d','#ff6a1f','#ff3d00'][Math.floor(Math.random()*3)]), alpha: .9, grow: -.6}); }
    if (aura) aura.position.set(root.x, .05, root.z);
  }
  function resize(){ const w = W(), h = Hh(); if (!w || !h) return; renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w/h; camera.updateProjectionMatrix(); }
  const ro = new ResizeObserver(resize); ro.observe(container);
  tick();
  return {
    setDog, setState, trick, pet, release,
    headScreen(){ if (!dog) return null; const h = V(); dog.head.getWorldPosition(h); h.y += .45*dog.P.size; h.project(camera); const r = renderer.domElement; return {x:(h.x*.5 + .5)*r.clientWidth, y:(-h.y*.5 + .5)*r.clientHeight}; },
    resetView(){ camera.position.set(1.5, 1.65, 3.9); controls.target.set(0, .55, 0); },
    get frames(){ return frameCount; },
    dispose(){ alive = false; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); if (dog) dog.dispose(); renderer.dispose(); renderer.domElement.remove(); }
  };
}

/* ---------- thumbnails ---------- */
let thumbR = null, thumbScene = null, thumbCam = null;
const thumbCache = new Map();
export function renderThumb(dogLike, size = 128){
  const key = dogLike.look + '|' + ((dogLike.eq && dogLike.eq.chroma) || '') + '|' + size + '|' + JSON.stringify(dogLike.eq && dogLike.eq.hat || '');
  if (thumbCache.has(key)) return thumbCache.get(key);
  if (!thumbR) {
    thumbR = new THREE.WebGLRenderer({antialias:true, alpha:true, preserveDrawingBuffer:true});
    thumbR.outputColorSpace = THREE.SRGBColorSpace; thumbR.toneMapping = THREE.ACESFilmicToneMapping;
    thumbScene = new THREE.Scene();
    thumbScene.add(new THREE.HemisphereLight(0xfff1dc, 0x241c30, .9));
    const k = new THREE.DirectionalLight(0xffe6c4, 2.4); k.position.set(3, 4, 4); thumbScene.add(k);
    const r = new THREE.DirectionalLight(0x8fb4ff, 1.2); r.position.set(-3, 2, -3); thumbScene.add(r);
    thumbCam = new THREE.PerspectiveCamera(30, 1, .1, 20);
  }
  thumbR.setSize(size, size, false); thumbR.setPixelRatio(1);
  const d = new Dog(Object.assign({eq:{}}, dogLike, {eq: {chroma: dogLike.eq && dogLike.eq.chroma, hat: dogLike.eq && dogLike.eq.hat}}), {res: 40, thumb: true});
  d.root.rotation.y = -Math.PI/2 + 1.0; d.root.scale.setScalar(1);
  d.setPose('sit', true); d.wagAngle = .2; d.mood = 80;
  d.update(0.016, {lookYaw: -.55});
  thumbScene.add(d.root);
  thumbCam.position.set(1.2, 1.7, 2.9); thumbCam.lookAt(.15, 1.0, 0);
  thumbR.render(thumbScene, thumbCam);
  const url = thumbR.domElement.toDataURL('image/png');
  thumbScene.remove(d.root); d.dispose();
  thumbCache.set(key, url);
  return url;
}
