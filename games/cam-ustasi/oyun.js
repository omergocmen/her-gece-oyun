// Cam Ustası: three.js koridoru, cam kırılma efektleri, dokunarak atış, HUD ve oyun akışı.
// Kurallar ve simülasyon mantik.js'te (CamMantik); bu dosya yalnızca çizer ve dinler.
import * as THREE from 'three';

const M = window.CamMantik;

// Renkler: DESIGN.md token'ları ve oyun içi ek renk tablosu.
const R = {
  murekkep: '#110f0d', kagit: '#1b1815', kagit2: '#26211c', cizgi: '#3b332b', krem: '#f3ead8', soluk: '#b4a78f',
  sodyum: '#ffb23f', kor: '#ff6a48', ay: '#9db4ff', iznik: '#2f6fb0', turkuaz: '#2aa198', ceviz: '#5a3b24', kemik: '#e9dcc2'
};
const MAKS_PARCA = 120;
const PARCA_OMUR = 0.6;

const $ = (id) => document.getElementById(id);
const kap = $('sahne');
const hareketAz = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Kayıt ----------
function ilerlemeOku() {
  const k = Depo.oku('cam:ilerleme', null);
  const bos = { acik: 1, enIyi: { oda: 0, sonsuz: 0 }, nazarIpucu: false, mod: 'oda', oda: 1 };
  if (!k || typeof k !== 'object') return bos;
  return Object.assign(bos, k, { enIyi: Object.assign({ oda: 0, sonsuz: 0 }, k.enIyi || {}) });
}
const ilerleme = ilerlemeOku();
const kaydet = () => Depo.yaz('cam:ilerleme', ilerleme);
let sesAcik = Depo.oku('cam:ses', true);

// ---------- Sahne ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setClearColor(R.murekkep);
kap.prepend(renderer.domElement);
const canvas = renderer.domElement;
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', 'Cam atölyesi koridoru');

const sahne = new THREE.Scene();
sahne.fog = new THREE.Fog(R.murekkep, 14, 44);
const kamera = new THREE.PerspectiveCamera(66, 1, 0.05, 60);
sahne.add(new THREE.HemisphereLight(R.kemik, R.murekkep, 0.6));

// Kameranın önündeki lambalara taşınan üç sodyum ışığı
const lambaIsiklari = [0, 1, 2].map(() => {
  const l = new THREE.PointLight(R.sodyum, 9, 11, 1.6);
  sahne.add(l);
  return l;
});
const LAMBA_ARALIK = 10;

// ---------- Dokular ----------
function tuvalDoku(en, boy, ciz) {
  const c = document.createElement('canvas');
  c.width = en; c.height = boy;
  ciz(c.getContext('2d'), en, boy);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const havuzDoku = tuvalDoku(128, 128, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.5, 'rgba(255,255,255,.3)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});
// Çeşmibülbül: krem ve kor spiral çizgiler
const bulbulDoku = tuvalDoku(256, 256, (g, w) => {
  g.lineWidth = 5; g.lineCap = 'round';
  for (let k = 0; k < 2; k++) {
    g.strokeStyle = k ? 'rgba(255,106,72,.9)' : 'rgba(243,234,216,.9)';
    g.beginPath();
    for (let a = 0; a < Math.PI * 9; a += 0.05) {
      const r = 6 + a * 3.9;
      const x = w / 2 + Math.cos(a + k * Math.PI) * r, y = w / 2 + Math.sin(a + k * Math.PI) * r;
      a ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
});
// Vitray: kurşun çizgili renkli cam parçaları, arkadan ay ışığıyla
function vitrayDoku(tohum) {
  const r = M.rng(tohum);
  const renkler = [R.iznik, R.turkuaz, R.sodyum, R.kor, R.iznik, R.ay];
  return tuvalDoku(128, 192, (g, w, h) => {
    g.fillStyle = R.murekkep; g.fillRect(0, 0, w, h);
    const sut = 4, sat = 7, pw = (w - 12) / sut, ph = (h - 12) / sat;
    for (let i = 0; i < sut; i++) {
      for (let j = 0; j < sat; j++) {
        g.fillStyle = renkler[Math.floor(r() * renkler.length)];
        g.globalAlpha = 0.65 + r() * 0.35;
        g.fillRect(6 + i * pw + 2, 6 + j * ph + 2, pw - 4, ph - 4);
      }
    }
    g.globalAlpha = 1;
    g.strokeStyle = R.murekkep; g.lineWidth = 5;
    g.beginPath(); g.arc(w / 2, 52, 40, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(w / 2, 12); g.lineTo(w / 2, h - 6); g.stroke();
  });
}

// ---------- Malzemeler ----------
const malz = {
  zemin: new THREE.MeshLambertMaterial({ color: R.kagit }),
  duvar: new THREE.MeshLambertMaterial({ color: R.kagit2 }),
  tavan: new THREE.MeshLambertMaterial({ color: R.murekkep }),
  derz: new THREE.LineBasicMaterial({ color: R.cizgi }),
  lamba: new THREE.MeshBasicMaterial({ color: R.sodyum }),
  kablo: new THREE.LineBasicMaterial({ color: R.cizgi }),
  havuz: new THREE.MeshBasicMaterial({ map: havuzDoku, color: R.sodyum, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }),
  ayHavuz: new THREE.MeshBasicMaterial({ map: havuzDoku, color: R.ay, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }),
  cam: new THREE.MeshBasicMaterial({ color: R.turkuaz, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  bulbul: new THREE.MeshBasicMaterial({ map: bulbulDoku, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
  kenar: new THREE.LineBasicMaterial({ color: R.krem, transparent: true, opacity: 0.9 }),
  catlak: new THREE.LineBasicMaterial({ color: R.krem }),
  kristal: new THREE.MeshLambertMaterial({ color: R.sodyum, emissive: R.sodyum, emissiveIntensity: 0.55, flatShading: true }),
  bilye: new THREE.MeshPhongMaterial({ color: R.krem, shininess: 90, specular: '#ffffff', emissive: R.krem, emissiveIntensity: 0.12 }),
  parilti: new THREE.MeshBasicMaterial({ map: havuzDoku, color: R.sodyum, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
};
const nazarMalz = [R.iznik, R.krem, R.ay, R.murekkep].map((c) => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.25, side: THREE.DoubleSide }));

const geo = {
  duzlem: new THREE.PlaneGeometry(1, 1),
  lamba: new THREE.SphereGeometry(0.14, 12, 8),
  kristal: new THREE.OctahedronGeometry(0.3, 0),
  bilye: new THREE.SphereGeometry(M.TOP_R, 16, 12)
};
geo.kristal.scale(1, 1.35, 1);

// ---------- Koridor (oda başına bir grup) ----------
const odaGruplari = new Map();
function odaKur(n) {
  const g = new THREE.Group();
  const z0 = -(n - 1) * M.L, z1 = -n * M.L, orta = (z0 + z1) / 2, W = M.GEN, H = M.YUK;
  const zemin = new THREE.Mesh(geo.duzlem, malz.zemin);
  zemin.scale.set(2 * W, M.L, 1); zemin.rotation.x = -Math.PI / 2; zemin.position.set(0, 0, orta);
  const tavan = new THREE.Mesh(geo.duzlem, malz.tavan);
  tavan.scale.set(2 * W, M.L, 1); tavan.rotation.x = Math.PI / 2; tavan.position.set(0, H, orta);
  g.add(zemin, tavan);
  for (const s of [-1, 1]) {
    const d = new THREE.Mesh(geo.duzlem, malz.duvar);
    d.scale.set(M.L, H, 1); d.rotation.y = -s * Math.PI / 2; d.position.set(s * W, H / 2, orta);
    g.add(d);
  }
  // Derz çizgileri: zeminde enine ve boyuna, duvarlarda dikey
  const p = [];
  for (let z = z0; z >= z1; z -= 1.5) p.push(-W, 0.005, z, W, 0.005, z);
  for (const x of [-W / 2, 0, W / 2]) p.push(x, 0.005, z0, x, 0.005, z1);
  for (let z = z0; z >= z1; z -= 3) for (const s of [-1, 1]) p.push(s * (W - 0.005), 0, z, s * (W - 0.005), H, z);
  for (const s of [-1, 1]) p.push(s * (W - 0.005), 0.6, z0, s * (W - 0.005), 0.6, z1);
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.add(new THREE.LineSegments(cg, malz.derz));
  // Lambalar ve ışık havuzları
  const kablo = [];
  for (let z = z0 - LAMBA_ARALIK / 2; z > z1; z -= LAMBA_ARALIK) {
    const l = new THREE.Mesh(geo.lamba, malz.lamba);
    l.position.set(0, H - 0.45, z);
    kablo.push(0, H, z, 0, H - 0.4, z);
    const h = new THREE.Mesh(geo.duzlem, malz.havuz);
    h.scale.set(3.6, 3.6, 1); h.rotation.x = -Math.PI / 2; h.position.set(0, 0.01, z);
    g.add(l, h);
  }
  const kg = new THREE.BufferGeometry();
  kg.setAttribute('position', new THREE.Float32BufferAttribute(kablo, 3));
  g.add(new THREE.LineSegments(kg, malz.kablo));
  // Vitray pencereler (odaya göre değişen yerlerde)
  const r = M.rng(n * 31 + 5);
  for (let z = z0 - 8; z > z1 + 6; z -= 14 + r() * 8) {
    const s = r() < 0.5 ? -1 : 1;
    const v = new THREE.Mesh(geo.duzlem, new THREE.MeshBasicMaterial({ map: vitrayDoku(n * 100 + Math.round(-z)) }));
    v.scale.set(1.3, 1.95, 1); v.rotation.y = -s * Math.PI / 2; v.position.set(s * (W - 0.01), 1.65, z);
    const h = new THREE.Mesh(geo.duzlem, malz.ayHavuz);
    h.scale.set(2.4, 2.4, 1); h.rotation.x = -Math.PI / 2; h.position.set(s * (W - 0.9), 0.012, z);
    g.add(v, h);
  }
  sahne.add(g);
  odaGruplari.set(n, g);
}
function odaSil(n) {
  const g = odaGruplari.get(n);
  if (!g) return;
  g.traverse((o) => {
    if (o.geometry && !Object.values(geo).includes(o.geometry)) o.geometry.dispose();
    if (o.material && o.material.map && o.material.map !== havuzDoku) { o.material.map.dispose(); o.material.dispose(); }
  });
  sahne.remove(g);
  odaGruplari.delete(n);
}

// ---------- Engel görselleri ----------
const gorseller = new Map();
function kenarCizgisi(w, h) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-w / 2, -h / 2, 0, w / 2, -h / 2, 0, w / 2, h / 2, 0, -w / 2, h / 2, 0], 3));
  return new THREE.LineLoop(g, malz.kenar);
}
function gorselKur(e) {
  const g = new THREE.Group();
  if (e.tur === 'cam' || e.tur === 'bulbul') {
    const w = e.x1 - e.x0, h = e.y1 - e.y0;
    const m = new THREE.Mesh(geo.duzlem, malz.cam);
    m.scale.set(w, h, 1);
    g.add(m);
    if (e.tur === 'bulbul') {
      const d = new THREE.Mesh(geo.duzlem, malz.bulbul);
      d.scale.set(w, h, 1); d.position.z = 0.005;
      g.add(d);
    }
    g.add(kenarCizgisi(w, h));
    g.position.set((e.x0 + e.x1) / 2, (e.y0 + e.y1) / 2, e.z);
  } else if (e.tur === 'nazar') {
    const halkalar = [[1.12, e.rDis], [0.98, 1.12], [0.86, 0.98], [e.rIc, 0.86]];
    halkalar.forEach((h, i) => g.add(new THREE.Mesh(new THREE.RingGeometry(h[0], h[1], 48), nazarMalz[i])));
    g.position.set(e.cx, e.cy, e.z);
  } else if (e.tur === 'kristal') {
    g.add(new THREE.Mesh(geo.kristal, malz.kristal));
    g.position.set(e.x, e.y, e.z);
  }
  sahne.add(g);
  gorseller.set(e.id, { g, e });
}
function gorselSil(id) {
  const v = gorseller.get(id);
  if (!v) return;
  v.g.traverse((o) => { if (o.geometry && !Object.values(geo).includes(o.geometry)) o.geometry.dispose(); });
  sahne.remove(v.g);
  gorseller.delete(id);
}

// ---------- Bilyeler (havuz) ----------
const bilyeHavuzu = [];
function bilyeleriCiz() {
  while (bilyeHavuzu.length < durum.toplar.length) {
    const m = new THREE.Mesh(geo.bilye, malz.bilye);
    sahne.add(m);
    bilyeHavuzu.push(m);
  }
  bilyeHavuzu.forEach((m, i) => {
    const t = durum.toplar[i];
    m.visible = !!t;
    if (t) m.position.set(t.x, t.y, t.z);
  });
}

// ---------- Kırılma parçaları ----------
// Darbe noktasından kenarlara yıldız biçimli çatlaklar: her dilim iç ve dış parçaya bölünür.
const parcalar = [];
const _v = new THREE.Vector3();
function dikdortgenSiniri(w, h, ix, iy, aci) {
  const dx = Math.cos(aci), dy = Math.sin(aci);
  let t = Infinity;
  if (dx > 1e-6) t = Math.min(t, (w / 2 - ix) / dx);
  if (dx < -1e-6) t = Math.min(t, (-w / 2 - ix) / dx);
  if (dy > 1e-6) t = Math.min(t, (h / 2 - iy) / dy);
  if (dy < -1e-6) t = Math.min(t, (-h / 2 - iy) / dy);
  return [ix + dx * t, iy + dy * t];
}
function parcala(merkez, yerel, sinir, malzeme, yon, sayi) {
  const azami = Math.min(sayi, MAKS_PARCA);
  while (parcalar.length + azami > MAKS_PARCA) parcaSil(0);
  const dilim = Math.max(3, Math.floor(azami / 2));
  const acilar = [];
  for (let i = 0; i < dilim; i++) acilar.push((i + 0.25 + Math.random() * 0.5) / dilim * Math.PI * 2);
  const dis = acilar.map((a) => sinir(a));
  const ic = dis.map((p) => {
    const f = 0.3 + Math.random() * 0.3;
    return [yerel[0] + (p[0] - yerel[0]) * f, yerel[1] + (p[1] - yerel[1]) * f];
  });
  const m = malzeme.clone();
  const kenar = malz.kenar.clone();
  const grup = { malz: m, kenar, adet: 0 };
  for (let i = 0; i < dilim; i++) {
    const j = (i + 1) % dilim;
    const sekiller = [[yerel, ic[i], ic[j]], [ic[i], dis[i], dis[j], ic[j]]];
    for (const s of sekiller) {
      if (parcalar.length >= MAKS_PARCA) break;
      const cx = s.reduce((a, p) => a + p[0], 0) / s.length, cy = s.reduce((a, p) => a + p[1], 0) / s.length;
      const sk = new THREE.Shape(s.map((p) => new THREE.Vector2(p[0] - cx, p[1] - cy)));
      const g = new THREE.ShapeGeometry(sk);
      const mesh = new THREE.Mesh(g, m);
      const cizgi = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(s.map((p) => new THREE.Vector3(p[0] - cx, p[1] - cy, 0))), kenar);
      mesh.add(cizgi);
      mesh.position.set(merkez.x + cx, merkez.y + cy, merkez.z);
      sahne.add(mesh);
      const uz = Math.hypot(cx - yerel[0], cy - yerel[1]) + 0.2;
      parcalar.push({
        mesh, grup, yas: 0,
        v: new THREE.Vector3((cx - yerel[0]) / uz * (1 + Math.random() * 1.5), (cy - yerel[1]) / uz * (1 + Math.random() * 1.5) + 1, yon * (2 + Math.random() * 4)),
        w: new THREE.Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4)
      });
      grup.adet++;
    }
  }
}
function parcaSil(i) {
  const p = parcalar[i];
  sahne.remove(p.mesh);
  p.mesh.geometry.dispose();
  p.mesh.children.forEach((c) => c.geometry.dispose());
  if (--p.grup.adet === 0) { p.grup.malz.dispose(); p.grup.kenar.dispose(); }
  parcalar.splice(i, 1);
}
function parcalariIlerlet(dt) {
  for (let i = parcalar.length - 1; i >= 0; i--) {
    const p = parcalar[i];
    p.yas += dt;
    if (p.yas >= PARCA_OMUR) { parcaSil(i); continue; }
    p.v.y -= 9.8 * dt;
    p.mesh.position.addScaledVector(p.v, dt);
    p.mesh.rotation.x += p.w.x * dt; p.mesh.rotation.y += p.w.y * dt; p.mesh.rotation.z += p.w.z * dt;
    const solma = 1 - Math.max(0, (p.yas - PARCA_OMUR * 0.4) / (PARCA_OMUR * 0.6));
    p.grup.malz.opacity = p.grup.taban * solma;
    p.grup.kenar.opacity = 0.9 * solma;
  }
}
// Hareket azaltıldığında parçalar yerine camın hızla solması
const solanlar = [];
function soldur(id) {
  const v = gorseller.get(id);
  if (!v) return;
  gorseller.delete(id);
  const mlz = [];
  v.g.traverse((o) => { if (o.material) { o.material = o.material.clone(); mlz.push(o.material); } });
  solanlar.push({ g: v.g, mlz, taban: mlz.map((m) => m.opacity), yas: 0 });
}
function solanlariIlerlet(dt) {
  for (let i = solanlar.length - 1; i >= 0; i--) {
    const s = solanlar[i];
    s.yas += dt;
    const k = Math.max(0, 1 - s.yas / 0.2);
    s.mlz.forEach((m, j) => { m.transparent = true; m.opacity = s.taban[j] * k; });
    if (k <= 0) {
      sahne.remove(s.g);
      s.mlz.forEach((m) => m.dispose());
      s.g.traverse((o) => { if (o.geometry && !Object.values(geo).includes(o.geometry)) o.geometry.dispose(); });
      solanlar.splice(i, 1);
    }
  }
}

const parilti = new THREE.Mesh(geo.duzlem, malz.parilti);
parilti.visible = false;
sahne.add(parilti);
let parildama = 0;
function parilda(x, y, z) {
  if (hareketAz()) return;
  parilti.position.set(x, y, z + 0.05);
  parilti.visible = true;
  parildama = 0.25;
}

function kir(e, olay, yon) {
  const v = gorseller.get(e.id);
  if (!v) return;
  if (hareketAz()) { soldur(e.id); return; }
  if (e.tur === 'nazar') {
    gorselSil(e.id);
    const sinir = (a) => [Math.cos(a) * e.rDis, Math.sin(a) * e.rDis];
    const m = nazarMalz[0].clone();
    m.transparent = true;
    parcala(new THREE.Vector3(e.cx, e.cy, e.z), [olay.x - e.cx, olay.y - e.cy], sinir, m, yon, 24);
    parcalar[parcalar.length - 1].grup.taban = 1;
    return;
  }
  const k = M.kayma(e, durum.t);
  const cx = (e.x0 + e.x1) / 2 + k, cy = (e.y0 + e.y1) / 2, w = e.x1 - e.x0, h = e.y1 - e.y0;
  const yerel = [Math.max(-w / 2 + 0.01, Math.min(w / 2 - 0.01, olay.x - cx)), Math.max(-h / 2 + 0.01, Math.min(h / 2 - 0.01, olay.y - cy))];
  gorselSil(e.id);
  const alan = w * h;
  const sayi = Math.round(Math.min(24, 10 + alan * 1.4));
  const m = (e.tur === 'bulbul' ? malz.bulbul : malz.cam).clone();
  m.map = null; m.color.set(R.turkuaz); m.opacity = 0.45;
  parcala(new THREE.Vector3(cx, cy, e.z), yerel, (a) => dikdortgenSiniri(w, h, yerel[0], yerel[1], a), m, yon, sayi);
  parcalar[parcalar.length - 1].grup.taban = 0.45;
  parilda(olay.x, olay.y, e.z);
}

function catlat(e, olay) {
  const v = gorseller.get(e.id);
  if (!v) return;
  const cx = (e.x0 + e.x1) / 2 + M.kayma(e, durum.t), cy = (e.y0 + e.y1) / 2;
  const lx = olay.x - cx, ly = olay.y - cy, w = e.x1 - e.x0, h = e.y1 - e.y0;
  const p = [];
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + Math.random() * 0.4;
    const s = dikdortgenSiniri(w, h, lx, ly, a);
    const f = 0.35 + Math.random() * 0.5;
    p.push(lx, ly, 0.01, lx + (s[0] - lx) * f, ly + (s[1] - ly) * f, 0.01);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  // Grup ölçeklenmediği için çizgiler doğrudan yerel koordinatta
  v.g.add(new THREE.LineSegments(g, malz.catlak));
}

// ---------- Ses (WebAudio ile üretilir, dosya yok) ----------
let ses = null, ortam = null;
function sesHazirla() {
  if (!sesAcik) return null;
  if (!ses) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ses = new AC();
  }
  if (ses.state === 'suspended') ses.resume();
  return ses;
}
function ton(frekans, sure, hacim, tip, bitis, gecikme) {
  const s = sesHazirla();
  if (!s) return;
  const t0 = s.currentTime + (gecikme || 0);
  const o = s.createOscillator();
  const g = s.createGain();
  o.type = tip || 'sine';
  o.frequency.setValueAtTime(frekans, t0);
  if (bitis) o.frequency.exponentialRampToValueAtTime(bitis, t0 + sure);
  g.gain.setValueAtTime(0.0001, s.currentTime);
  g.gain.setValueAtTime(hacim, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
  o.connect(g).connect(s.destination);
  o.start(t0);
  o.stop(t0 + sure + 0.02);
}
let gurultuTampon = null;
function gurultu(sure, hacim, tip, frekans) {
  const s = sesHazirla();
  if (!s) return;
  if (!gurultuTampon) {
    gurultuTampon = s.createBuffer(1, s.sampleRate, s.sampleRate);
    const v = gurultuTampon.getChannelData(0);
    for (let i = 0; i < v.length; i++) v[i] = Math.random() * 2 - 1;
  }
  const k = s.createBufferSource();
  k.buffer = gurultuTampon;
  const f = s.createBiquadFilter();
  f.type = tip; f.frequency.value = frekans;
  const g = s.createGain();
  g.gain.setValueAtTime(hacim, s.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, s.currentTime + sure);
  k.connect(f).connect(g).connect(s.destination);
  k.start(0, Math.random() * 0.5);
  k.stop(s.currentTime + sure + 0.02);
}
const sesler = {
  atis: () => gurultu(0.09, 0.12, 'bandpass', 1400),
  kirilma: (buyuk) => {
    gurultu(buyuk ? 0.35 : 0.25, 0.32, 'highpass', 2600);
    gurultu(0.08, 0.25, 'lowpass', 900);
    // Çınlama: rastgele yüksek ve uyumsuz tonlar
    for (let i = 0; i < 5; i++) ton(2200 + Math.random() * 3200, 0.3 + Math.random() * 0.6, 0.035, 'sine', null, Math.random() * 0.06);
  },
  catlak: () => { gurultu(0.07, 0.25, 'highpass', 3500); ton(1800, 0.12, 0.05, 'triangle', 1200); },
  kristal: () => { [880, 1175, 1568].forEach((f, i) => ton(f, 0.25, 0.08, 'triangle', null, i * 0.06)); },
  carpma: () => { ton(110, 0.3, 0.35, 'sine', 45); gurultu(0.4, 0.35, 'lowpass', 1800); sesler.kirilma(true); },
  nazar: () => { ton(196, 0.6, 0.15, 'sawtooth', 98); ton(207, 0.6, 0.1, 'sawtooth', 104); sesler.kirilma(false); },
  nazarGecti: () => { [659, 988, 1319].forEach((f) => ton(f, 0.9, 0.05)); },
  kombo: (k) => ton(520 + k * 140, 0.18, 0.09, 'triangle', 900 + k * 160),
  oda: () => { ton(392, 0.5, 0.06); ton(587, 0.7, 0.05, 'sine', null, 0.12); }
};
function ortamBaslat() {
  const s = sesHazirla();
  if (!s || ortam) return;
  const ana = s.createGain();
  ana.gain.value = 0.0001;
  ana.gain.exponentialRampToValueAtTime(0.045, s.currentTime + 2);
  const f = s.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 420;
  const lfo = s.createOscillator(), lfoG = s.createGain();
  lfo.frequency.value = 0.07; lfoG.gain.value = 180;
  lfo.connect(lfoG).connect(f.frequency);
  const osc = [55, 82.4, 110.6].map((fr) => {
    const o = s.createOscillator();
    o.type = 'triangle'; o.frequency.value = fr;
    o.connect(f);
    o.start();
    return o;
  });
  f.connect(ana).connect(s.destination);
  lfo.start();
  ortam = { ana, osc: osc.concat([lfo]) };
}
function ortamDurdur() {
  if (!ortam || !ses) return;
  const o = ortam;
  ortam = null;
  o.ana.gain.cancelScheduledValues(ses.currentTime);
  o.ana.gain.setValueAtTime(Math.max(o.ana.gain.value, 0.0001), ses.currentTime);
  o.ana.gain.exponentialRampToValueAtTime(0.0001, ses.currentTime + 0.4);
  o.osc.forEach((x) => x.stop(ses.currentTime + 0.45));
}

// ---------- Durum ve akış ----------
let durum = null;
let biriken = 0;
let calisiyor = false, durakli = false;
let sarsinti = 0;
let mod = ilerleme.mod === 'sonsuz' ? 'sonsuz' : 'oda';
let secilenOda = Math.min(Math.max(1, ilerleme.oda || 1), ilerleme.acik);

function temizle() {
  for (const id of [...gorseller.keys()]) gorselSil(id);
  for (const n of [...odaGruplari.keys()]) odaSil(n);
  while (parcalar.length) parcaSil(parcalar.length - 1);
  solanlariIlerlet(1);
}

function yeniOyun() {
  temizle();
  durum = M.yeniOyun({ mod, oda: mod === 'oda' ? secilenOda : 1 });
  durum.olaylar.length = 0;
  biriken = 0;
  sahneyiEsle();
  hudGuncelle(true);
  kameraKonumla(0);
  renderer.render(sahne, kamera);
}

function basla() {
  if (!durum || durum.bitti) yeniOyun();
  $('perde').hidden = true;
  calisiyor = true;
  durakli = false;
  ortamBaslat();
  if (durum.d === (durum.baslangicOda - 1) * M.L) ipucuGoster('Camlara dokun, yolu aç', 2600);
}

function duraklat() {
  if (!calisiyor || durum.bitti) return;
  durakli = true;
  calisiyor = false;
  ortamDurdur();
  $('perde-baslik').textContent = 'Duraklatıldı';
  $('perde-metin').textContent = 'Oda ' + durum.oda + ' · ' + Math.floor(durum.d) + ' m · ' + durum.bilye + ' bilye';
  $('basla').textContent = 'Devam et';
  $('perde').hidden = false;
}

function oyunBitti() {
  calisiyor = false;
  ortamDurdur();
  const m = Math.floor(durum.d);
  const onceki = ilerleme.enIyi[durum.mod] || 0;
  const rekor = m > onceki;
  if (rekor) ilerleme.enIyi[durum.mod] = m;
  kaydet();
  $('son-baslik').textContent = durum.kazandi ? 'Atölye tamam!' : 'Bilyeler bitti';
  $('son-mesafe').textContent = m + ' m';
  $('son-oda').textContent = String(durum.oda);
  $('son-eniyi').textContent = Math.max(m, onceki) + ' m';
  const notlar = [];
  if (rekor && onceki > 0) notlar.push('Yeni rekor.');
  notlar.push(durum.kirilan + ' cam kırdın, en yüksek kombo ×' + durum.enYuksekKombo + '.');
  if (durum.mod === 'oda' && !durum.kazandi && durum.oda > 1) notlar.push(durum.oda + '. odadan yeniden başlayabilirsin.');
  $('son-not').textContent = notlar.join(' ');
  $('perde-baslik').textContent = durum.kazandi ? 'On oda geride kaldı' : 'Paşabahçe atölyesi';
  $('perde-metin').textContent = 'Camlara dokun, bilye fırlat. Bilyeler bitmeden ilerle.';
  $('basla').textContent = 'Başla';
  odaCipleriniCiz();
  setTimeout(() => { $('perde').hidden = false; $('son').showModal(); }, durum.kazandi ? 600 : 900);
}

// Mantıktaki engellerle sahnedeki görselleri eşle
function sahneyiEsle() {
  const varolan = new Set();
  for (const e of durum.engeller) {
    varolan.add(e.id);
    if (!gorseller.has(e.id) && !e.kirik && !e.toplandi) gorselKur(e);
    if (!odaGruplari.has(e.oda)) odaKur(e.oda);
  }
  for (const id of [...gorseller.keys()]) if (!varolan.has(id)) gorselSil(id);
  for (const n of [...odaGruplari.keys()]) if (-n * M.L > -durum.d + 8) odaSil(n);
}

function olaylariIsle() {
  for (const o of durum.olaylar) {
    const v = gorseller.get(o.id);
    switch (o.tur) {
      case 'atis': sesler.atis(); break;
      case 'kirildi': if (v) kir(v.e, o, -1); sesler.kirilma(false); break;
      case 'catlak': if (v) catlat(v.e, o); sesler.catlak(); break;
      case 'kristal':
        if (v) gorselSil(o.id);
        sesler.kristal();
        mesajGoster('+' + M.KRISTAL_ODUL, 'iyi');
        parilda(o.x, o.y, o.z);
        break;
      case 'carpma':
        if (v) kir(v.e, o, 1);
        sesler.carpma();
        bilyeDusur(M.CARPMA_CEZA);
        if (!hareketAz()) { flas(); sarsinti = 0.35; }
        break;
      case 'nazar':
        if (v) kir(v.e, o, -1);
        sesler.nazar();
        bilyeDusur(M.NAZAR_CEZA);
        mesajGoster('Nazar değdi −' + M.NAZAR_CEZA, 'kotu');
        if (!hareketAz()) flas();
        break;
      case 'nazar-gecti': sesler.nazarGecti(); mesajGoster('Nazar korudu +' + M.NAZAR_ODUL, 'iyi'); break;
      case 'kombo': sesler.kombo(o.kombo); komboVurgula(); break;
      case 'oda':
        sesler.oda();
        mesajGoster('Oda ' + o.oda);
        if (durum.mod === 'oda' && o.oda > ilerleme.acik) { ilerleme.acik = Math.min(M.ODA_SAYISI, o.oda); kaydet(); }
        break;
      case 'bitti': oyunBitti(); break;
    }
  }
  durum.olaylar.length = 0;
}

// ---------- HUD ----------
let sonBilye = -1, sonKombo = 1;
function hudGuncelle(zorla) {
  if (zorla || durum.bilye !== sonBilye) {
    $('bilye').textContent = String(durum.bilye);
    $('bilye-kutu').classList.toggle('az', durum.bilye <= 5);
    sonBilye = durum.bilye;
  }
  if (zorla || durum.kombo !== sonKombo) {
    $('kombo').hidden = durum.kombo <= 1;
    $('kombo').textContent = '×' + durum.kombo;
    sonKombo = durum.kombo;
  }
  $('hud-oda').textContent = 'Oda ' + durum.oda + (durum.mod === 'oda' ? '/' + M.ODA_SAYISI : '') + ' · ' + Math.floor(durum.d) + ' m';
  $('ilerleme').style.width = (M.odaIlerleme(durum) * 100).toFixed(2) + '%';
}
function komboVurgula() {
  const k = $('kombo');
  k.classList.remove('yeni');
  void k.offsetWidth;
  k.classList.add('yeni');
}
function bilyeDusur(n) {
  if (hareketAz()) return;
  const kap2 = $('dusenler');
  for (let i = 0; i < Math.min(n, 10); i++) {
    const d = document.createElement('span');
    d.className = 'dusen';
    d.style.left = (i % 5) * 7 + 'px';
    d.style.animationDelay = i * 0.04 + 's';
    kap2.appendChild(d);
    setTimeout(() => d.remove(), 1200);
  }
}
function flas() {
  const f = $('flas');
  f.classList.remove('goster');
  void f.offsetWidth;
  f.classList.add('goster');
}
let mesajZaman = 0;
function mesajGoster(metin, tur) {
  const e = $('mesaj');
  e.textContent = metin;
  e.className = 'cam-mesaj' + (tur ? ' ' + tur : '');
  void e.offsetWidth;
  e.classList.add('goster');
  clearTimeout(mesajZaman);
  mesajZaman = setTimeout(() => e.classList.remove('goster'), 1400);
}
let ipucuZaman = 0;
function ipucuGoster(metin, sure) {
  const e = $('ipucu');
  e.textContent = metin;
  e.classList.remove('gizli');
  clearTimeout(ipucuZaman);
  ipucuZaman = setTimeout(() => e.classList.add('gizli'), sure);
}
function nazarIpucu() {
  if (ilerleme.nazarIpucu) return;
  const n = durum.engeller.find((e) => e.tur === 'nazar' && !e.gecildi);
  if (n && -durum.d - n.z < 22) {
    ilerleme.nazarIpucu = true;
    kaydet();
    ipucuGoster('Nazar boncuğunu kırma, ortasından geç', 3500);
  }
}

// ---------- Kamera ----------
function kameraKonumla(dt) {
  let sx = 0, sy = 0;
  if (sarsinti > 0) {
    sarsinti = Math.max(0, sarsinti - dt);
    const g = sarsinti * 0.25;
    sx = (Math.random() - 0.5) * g; sy = (Math.random() - 0.5) * g;
  }
  kamera.position.set(sx, M.KAM_Y + sy, -durum.d);
  kamera.lookAt(sx * 0.5, M.KAM_Y, -durum.d - 10);
  // Işıkları kameranın önündeki lambalara taşı
  const ilkLamba = Math.ceil((durum.d - LAMBA_ARALIK / 2) / LAMBA_ARALIK);
  lambaIsiklari.forEach((l, i) => {
    const d = (ilkLamba - 1 + i) * LAMBA_ARALIK + LAMBA_ARALIK / 2;
    l.position.set(0, M.YUK - 0.6, -d);
  });
}
function boyutlandir() {
  const en = kap.clientWidth || 1, boy = kap.clientHeight || 1;
  renderer.setSize(en, boy, false);
  kamera.aspect = en / boy;
  kamera.fov = kamera.aspect < 0.8 ? 74 : 62;
  kamera.updateProjectionMatrix();
  if (durum && !calisiyor) renderer.render(sahne, kamera);
}
new ResizeObserver(boyutlandir).observe(kap);

// ---------- Döngü ----------
let onceki = performance.now();
function kare(simdi) {
  const dt = Math.min(0.1, (simdi - onceki) / 1000);
  onceki = simdi;
  if (calisiyor && durum && !durum.bitti) {
    biriken = M.ilerlet(durum, biriken, dt);
    olaylariIsle();
    sahneyiEsle();
    nazarIpucu();
    hudGuncelle(false);
  }
  if (durum) {
    for (const v of gorseller.values()) {
      if (v.e.kayma) v.g.position.x = (v.e.x0 + v.e.x1) / 2 + M.kayma(v.e, durum.t);
      if (v.e.tur === 'kristal') v.g.rotation.y = durum.t * 2.2;
    }
    bilyeleriCiz();
    kameraKonumla(dt);
  }
  parcalariIlerlet(dt);
  solanlariIlerlet(dt);
  if (parildama > 0) {
    parildama -= dt;
    const k = Math.max(0, parildama / 0.25);
    parilti.material.opacity = k;
    parilti.scale.setScalar(0.6 + (1 - k) * 2.4);
    parilti.visible = k > 0;
  }
  renderer.render(sahne, kamera);
  requestAnimationFrame(kare);
}

// ---------- Girdi ----------
const isin = new THREE.Raycaster();
const ndc = new THREE.Vector2();
canvas.addEventListener('pointerdown', (ev) => {
  if (!calisiyor || !durum || durum.bitti) return;
  ev.preventDefault();
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  isin.setFromCamera(ndc, kamera);
  const kamP = { x: kamera.position.x, y: kamera.position.y, z: kamera.position.z };
  const P = M.nisanNoktasi(durum, kamP, isin.ray.direction);
  // Bilye kameranın biraz altından çıkar; yörünge yine dokunulan noktadan geçer
  if (M.at(durum, { x: kamP.x, y: kamP.y - 0.18, z: kamP.z - 0.1 }, P)) {
    const d = document.createElement('span');
    d.className = 'dokunus';
    d.style.left = ev.clientX - r.left + 'px';
    d.style.top = ev.clientY - r.top + 'px';
    kap.appendChild(d);
    setTimeout(() => d.remove(), 450);
  }
});

$('basla').addEventListener('click', basla);
$('duraklat').addEventListener('click', () => (calisiyor ? duraklat() : (durum && !durum.bitti && durakli ? basla() : null)));
document.addEventListener('visibilitychange', () => { if (document.hidden) duraklat(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P' || (e.key === 'Escape' && calisiyor)) { calisiyor ? duraklat() : (durakli && basla()); }
});

function sesDugmesi() {
  const b = $('ses');
  b.setAttribute('aria-pressed', String(sesAcik));
  b.setAttribute('aria-label', sesAcik ? 'Sesi kapat' : 'Sesi aç');
}
$('ses').addEventListener('click', () => {
  sesAcik = !sesAcik;
  Depo.yaz('cam:ses', sesAcik);
  sesDugmesi();
  if (sesAcik) { if (calisiyor) ortamBaslat(); } else ortamDurdur();
});

// Mod ve başlangıç odası
function modDugmeleri() {
  document.querySelectorAll('[data-mod]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mod === mod)));
  document.querySelector('.oda-secici').hidden = mod !== 'oda';
}
function odaCipleriniCiz() {
  const ol = $('odalar');
  ol.textContent = '';
  for (let n = 1; n <= M.ODA_SAYISI; n++) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'oda-cip';
    b.textContent = String(n);
    b.disabled = n > ilerleme.acik;
    b.setAttribute('aria-pressed', String(n === secilenOda));
    b.setAttribute('aria-label', n + '. odadan başla' + (b.disabled ? ' (kilitli)' : ''));
    b.addEventListener('click', () => { secilenOda = n; ayarDegisti(); });
    li.appendChild(b);
    ol.appendChild(li);
  }
}
function ayarDegisti() {
  ilerleme.mod = mod;
  ilerleme.oda = secilenOda;
  kaydet();
  modDugmeleri();
  odaCipleriniCiz();
  calisiyor = false;
  durakli = false;
  ortamDurdur();
  $('perde-baslik').textContent = mod === 'oda' ? secilenOda + '. oda' : 'Sonsuz koridor';
  $('perde-metin').textContent = mod === 'oda'
    ? 'On odayı bitir. Bilyeler bitmeden ilerle.'
    : 'Koridor bitmez. En iyi: ' + (ilerleme.enIyi.sonsuz || 0) + ' m';
  $('basla').textContent = 'Başla';
  $('perde').hidden = false;
  yeniOyun();
}
document.querySelectorAll('[data-mod]').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.mod === mod) return;
  mod = b.dataset.mod;
  ayarDegisti();
}));
$('yeniden').addEventListener('click', () => { $('son').close(); yeniOyun(); basla(); });
$('oda-sec').addEventListener('click', () => {
  $('son').close();
  mod = 'oda';
  secilenOda = Math.min(durum.oda, ilerleme.acik);
  ayarDegisti();
  document.querySelector('.oda-secici').scrollIntoView({ block: 'nearest', behavior: hareketAz() ? 'auto' : 'smooth' });
  const b = document.querySelector('.oda-cip[aria-pressed="true"]');
  if (b) b.focus();
});

sesDugmesi();
modDugmeleri();
odaCipleriniCiz();
boyutlandir();
yeniOyun();
requestAnimationFrame(kare);

// Tarayıcı testleri için küçük kanca
window.__cam = {
  get durum() { return durum; },
  get calisiyor() { return calisiyor; },
  parcaSayisi: () => parcalar.length,
  basla
};
