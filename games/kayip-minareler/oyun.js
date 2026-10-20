// Kayıp Minareler: izometrik three.js sahnesi, bekçinin yürüyüşü, döndürme ve kaydırma
// etkileşimleri, bölüm akışı. Bulmaca kuralları mantik.js'te (MinareMantik), bölümler bolumler.json'da.
import * as THREE from 'three';

const M = window.MinareMantik;

// Renkler: DESIGN.md token'ları ve oyun içi ek renk tablosu.
const R = {
  murekkep: '#110f0d', kagit: '#1b1815', kagit2: '#26211c', cizgi: '#3b332b', krem: '#f3ead8', soluk: '#b4a78f',
  sodyum: '#ffb23f', kor: '#ff6a48', yaprak: '#368549', ay: '#9db4ff',
  iznik: '#2f6fb0', turkuaz: '#2aa198', ceviz: '#5a3b24', kemik: '#e9dcc2', kum: '#c9a46a'
};
const ADIM_MS = 220;
const BAKIS = new THREE.Vector3(1, 1, 1).normalize();

const $ = (id) => document.getElementById(id);
const kap = $('sahne');
const hareketAz = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Kayıt ----------
function ilerlemeOku() {
  const k = Depo.oku('minare:ilerleme', null);
  const bos = { tamam: [], son: 1 };
  if (!k || typeof k !== 'object' || !Array.isArray(k.tamam)) return bos;
  return Object.assign(bos, k);
}
const ilerleme = ilerlemeOku();
const kaydet = () => Depo.yaz('minare:ilerleme', ilerleme);
let sesAcik = Depo.oku('minare:ses', true);

// ---------- Sahne ----------
const renderer = new THREE.WebGLRenderer(Kalite.rendererSecenek({ alpha: true, powerPreference: 'high-performance' }));
const kalite = Kalite.kur(renderer, { azami: 2, boyutla: boyutlandir });
renderer.setClearColor(0x000000, 0);
kap.prepend(renderer.domElement);
const canvas = renderer.domElement;
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', 'İzometrik minare bulmacası');

const sahne = new THREE.Scene();
const kamera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 200);
sahne.add(new THREE.HemisphereLight(R.kemik, R.murekkep, 0.5));
const anaIsik = new THREE.DirectionalLight(R.sodyum, 1.6);
anaIsik.position.set(3, 10, 6);
sahne.add(anaIsik, anaIsik.target);
const ayIsigi = new THREE.DirectionalLight(R.ay, 0.9);
ayIsigi.position.set(10, 3, -2);
sahne.add(ayIsigi, ayIsigi.target);

// ---------- Malzemeler ve geometriler ----------
const malzemeOnbellek = new Map();
function mat(renk, ek) {
  const k = renk + JSON.stringify(ek || {});
  if (!malzemeOnbellek.has(k)) malzemeOnbellek.set(k, new THREE.MeshLambertMaterial(Object.assign({ color: renk, flatShading: true }, ek || {})));
  return malzemeOnbellek.get(k);
}
const geo = {
  kup: new THREE.BoxGeometry(1, 1, 1),
  ust: new THREE.PlaneGeometry(1, 1),
  minare: new THREE.CylinderGeometry(0.3, 0.3, 1, 12),
  serefe: new THREE.CylinderGeometry(0.42, 0.36, 0.14, 12),
  kulah: new THREE.ConeGeometry(0.36, 1.2, 12),
  plaka: new THREE.CylinderGeometry(0.28, 0.28, 0.04, 20),
  hale: new THREE.PlaneGeometry(1, 1)
};
function tuvalDoku(boyut, ciz) {
  const c = document.createElement('canvas');
  c.width = c.height = boyut;
  ciz(c.getContext('2d'), boyut);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const yumusakDoku = tuvalDoku(128, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.45, 'rgba(255,255,255,.35)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});
// Çini karo: kemik zemin üstünde düz renkli sekizgen yıldız
const ciniDokulari = {};
function ciniDoku(renk) {
  if (!ciniDokulari[renk]) {
    ciniDokulari[renk] = tuvalDoku(128, (g, w) => {
      g.fillStyle = R.kemik; g.fillRect(0, 0, w, w);
      g.fillStyle = renk;
      const yildiz = (cx, cy, r) => {
        g.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = i * Math.PI / 8, rr = i % 2 ? r * 0.55 : r;
          g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        g.closePath(); g.fill();
      };
      yildiz(w / 2, w / 2, w * 0.36);
      g.fillStyle = R.kemik;
      yildiz(w / 2, w / 2, w * 0.12);
      g.strokeStyle = R.kum; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, w - 4);
    });
  }
  return ciniDokulari[renk];
}

// ---------- Bölüm sahnesi ----------
let bolumler = [];
let B = null; // bölüm verisi
let s = null; // mantık durumu
let anaRenk = R.turkuaz;
const kok = new THREE.Group();
sahne.add(kok);
let grupNesneleri = {}; // id → { nesne, g, gorsel (açı ya da kayma), hedef, tutamaclar }
let plakaNesneleri = [];
let minareIsigi = null, hale = null, kulahMalz = null;
const tiklanabilir = []; // ışın hedefleri

function blokNesnesi(b, yerel) {
  const tur = b[3] || 't';
  const g = new THREE.Group();
  g.position.set(yerel[0], yerel[1], yerel[2]);
  if (tur === 'm' || tur === 'k') {
    // Minare gövdesi; külah ve şerefe bölümün baskın renginde
    const govde = new THREE.Mesh(geo.minare, mat(R.kum));
    g.add(govde);
    if (tur === 'k') {
      govde.scale.y = 0.5; govde.position.y = -0.25;
      const serefe = new THREE.Mesh(geo.serefe, mat(anaRenk));
      serefe.position.y = -0.02;
      const kulah = new THREE.Mesh(geo.kulah, kulahMalz);
      kulah.position.y = 0.55;
      g.add(serefe, kulah);
    }
    return g;
  }
  const yan = mat(R.kagit2);
  const ust = tur === 'c' ? new THREE.MeshLambertMaterial({ map: ciniDoku(anaRenk) }) : mat(tur === 't' ? R.kum : R.kum);
  const malzemeler = tur === 't'
    ? [mat(R.kum), yan, mat(R.kum), yan, mat(R.kum), yan]
    : [yan, yan, ust, yan, mat(R.ceviz), yan];
  const kup = new THREE.Mesh(geo.kup, malzemeler);
  kup.userData.blok = true;
  g.add(kup);
  return g;
}

function bolumKur(no) {
  // Eski sahneyi temizle (paylaşılan geometri ve malzemeler kalır)
  kok.clear();
  tiklanabilir.length = 0;
  grupNesneleri = {};
  plakaNesneleri = [];
  B = bolumler.find((b) => b.no === no) || bolumler[0];
  s = M.kur(B);
  anaRenk = R[B.renk] || R.turkuaz;
  kulahMalz = new THREE.MeshLambertMaterial({ color: anaRenk, emissive: R.sodyum, emissiveIntensity: 0, flatShading: true });

  B.bloklar.forEach((b) => {
    const n = blokNesnesi(b, b);
    n.traverse((o) => { if (o.userData.blok) { o.userData.konum = [b[0], b[1], b[2]]; tiklanabilir.push(o); } });
    kok.add(n);
  });

  (B.gruplar || []).forEach((g) => {
    const nesne = new THREE.Group();
    const pivot = g.tur === 'donen' ? g.pivot : [0, 0, 0];
    nesne.position.set(pivot[0], pivot[1], pivot[2]);
    g.bloklar.forEach((b, i) => {
      const n = blokNesnesi(b, [b[0] - pivot[0], b[1] - pivot[1], b[2] - pivot[2]]);
      n.traverse((o) => { if (o.userData.blok) { o.userData.grup = g.id; o.userData.i = i; tiklanabilir.push(o); } });
      nesne.add(n);
    });
    const kayit = { nesne, g, gorsel: s.durum[g.id], tutamaclar: [] };
    if (g.surekli !== false) tutamacEkle(kayit);
    else if (g.tur === 'kayan' && g.eksen === 'y') {
      // Plakayla yükselen sütun: altında gövde, yükseldikçe uzar
      const govde = new THREE.Mesh(geo.kup, mat(R.kagit2));
      govde.scale.set(0.8, 3, 0.8);
      govde.position.set(g.bloklar[0][0], g.bloklar[0][1] - 2, g.bloklar[0][2]);
      nesne.add(govde);
    }
    kok.add(nesne);
    grupNesneleri[g.id] = kayit;
    grupGorselUygula(kayit);
  });

  (B.plakalar || []).forEach((p) => {
    const m = new THREE.Mesh(geo.plaka, mat(R.kemik));
    m.position.set(p.konum[0], p.konum[1] + 0.49, p.konum[2]);
    kok.add(m);
    plakaNesneleri.push(m);
  });

  // Minare ışığı (bölüm sonunda yanar)
  const k = B.bloklar.find((b) => b[3] === 'k');
  minareIsigi = new THREE.PointLight(R.sodyum, 0, 7, 1.5);
  hale = new THREE.Mesh(geo.hale, new THREE.MeshBasicMaterial({ map: yumusakDoku, color: R.sodyum, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  hale.scale.setScalar(3.2);
  if (k) {
    minareIsigi.position.set(k[0], k[1] + 0.6, k[2]);
    hale.position.set(k[0], k[1] + 0.6, k[2]);
    hale.quaternion.copy(kamera.quaternion);
  }
  kok.add(minareIsigi, hale);

  bekciKur();
  $('ipucu').classList.add('gizli');
  kameraSigdir(true);
  sonGizle();
  bolumAdiGoster();
}

// Döndürme çarkı ya da kayma rayı
function tutamacEkle(kayit) {
  const g = kayit.g;
  const tm = new THREE.MeshLambertMaterial({ color: R.kemik, flatShading: true });
  kayit.tutamacMalz = tm;
  if (g.tur === 'donen') {
    const cark = new THREE.Group();
    const halka = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 24), tm);
    cark.add(halka);
    for (let i = 0; i < 4; i++) {
      const kol = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.06), tm);
      kol.rotation.z = i * Math.PI / 4;
      cark.add(kol);
    }
    const tutac = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.24, 8), tm);
    tutac.rotation.x = Math.PI / 2; tutac.position.set(0.3, 0, 0.12);
    cark.add(tutac);
    // Çark, dönme ekseninin kameraya bakan ucunda durur
    if (g.eksen === 'x') { cark.rotation.y = Math.PI / 2; cark.position.set(0.62, 0, 0); }
    else if (g.eksen === 'z') cark.position.set(0, 0, 0.62);
    else { cark.rotation.x = -Math.PI / 2; cark.position.set(0, -0.5, 0); cark.scale.setScalar(2.1); }
    kayit.nesne.add(cark);
    cark.traverse((o) => { if (o.isMesh) { o.userData.tutamac = g.id; tiklanabilir.push(o); } });
    kayit.tutamaclar.push(cark);
  } else {
    // Ray: kayma aralığı boyunca ince sodyum çizgi (gruba değil sahneye bağlı)
    const e = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[g.eksen];
    const b = g.bloklar[0];
    const yan = g.eksen === 'y' ? [0.52, -0.5, 0.52] : g.eksen === 'z' ? [0.52, -0.5, 0] : [0, -0.5, 0.52];
    const a = new THREE.Vector3(b[0] + e[0] * (g.min || 0) + yan[0], b[1] + e[1] * (g.min || 0) + yan[1], b[2] + e[2] * (g.min || 0) + yan[2]);
    const c = new THREE.Vector3(b[0] + e[0] * g.max + yan[0], b[1] + e[1] * g.max + yan[1], b[2] + e[2] * g.max + yan[2]);
    const uz = a.distanceTo(c) + 1;
    const ray = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, uz), new THREE.MeshBasicMaterial({ color: R.sodyum }));
    ray.position.copy(a).add(c).multiplyScalar(0.5);
    ray.lookAt(c);
    kok.add(ray);
    // Bloğun yanında ray üstünde kayan küçük kemik tutamaç
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), tm);
    t.position.set(b[0] + yan[0], b[1] + yan[1], b[2] + yan[2]);
    kayit.nesne.add(t);
    t.userData.tutamac = g.id;
    tiklanabilir.push(t);
    kayit.tutamaclar.push(t);
  }
  kayit.nesne.traverse((o) => { if (o.userData.blok) o.userData.tutamac = g.id; });
}

function grupGorselUygula(k) {
  const g = k.g;
  if (g.tur === 'donen') {
    const a = k.gorsel * Math.PI / 2;
    k.nesne.rotation.set(g.eksen === 'x' ? a : 0, g.eksen === 'y' ? a : 0, g.eksen === 'z' ? a : 0);
  } else {
    const e = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[g.eksen];
    k.nesne.position.set(e[0] * k.gorsel, e[1] * k.gorsel, e[2] * k.gorsel);
  }
}

// ---------- Bekçi ----------
let bekci = null, fenerIsik = null, fenerHavuz = null;
function bekciKur() {
  bekci = new THREE.Group();
  const kaftan = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.3), mat(R.krem));
  kaftan.position.y = 0.21;
  const etek = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.36), mat(R.krem));
  etek.position.y = 0.06;
  const bas = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mat(R.kemik));
  bas.position.y = 0.53;
  const kulah = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 4), mat(R.ceviz));
  kulah.position.y = 0.74; kulah.rotation.y = Math.PI / 4;
  const fener = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.11), new THREE.MeshBasicMaterial({ color: R.sodyum }));
  fener.position.set(0.24, 0.26, 0.06);
  bekci.add(kaftan, etek, bas, kulah, fener);
  fenerIsik = new THREE.PointLight(R.sodyum, 1.4, 2.6, 1.5);
  fenerIsik.position.set(0.24, 0.3, 0.06);
  bekci.add(fenerIsik);
  fenerHavuz = new THREE.Mesh(geo.hale, new THREE.MeshBasicMaterial({ map: yumusakDoku, color: R.sodyum, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  fenerHavuz.rotation.x = -Math.PI / 2; fenerHavuz.position.y = 0.02; fenerHavuz.scale.setScalar(1.3);
  bekci.add(fenerHavuz);
  bekci.traverse((o) => { if (o.isMesh) o.renderOrder = 2; });
  kok.add(bekci);
  bekciYerlestir();
}
function bekciYerlestir() {
  if (bekci.parent !== kok) kok.attach(bekci);
  bekci.position.set(s.konum[0], s.konum[1] + 0.5, s.konum[2]);
}
function bekciDerinlikSiz(evet) {
  bekci.traverse((o) => { if (o.material) o.material.depthTest = !evet; });
}

// ---------- Kamera ----------
let zoomCarpani = 1, zoomHedef = 1;
const merkez = new THREE.Vector3();
let sigdirma = { yarimEn: 5, yarimBoy: 5, merkezY: 0 };
function kameraSigdir(aninda) {
  // Bölümün bütün olası küp konumlarını (her grup durumu dahil) çerçevele
  const noktalar = [];
  const ekle = (x, y, z) => noktalar.push(new THREE.Vector3(x, y, z));
  B.bloklar.forEach((b) => ekle(b[0], b[1], b[2]));
  (B.gruplar || []).forEach((g) => M.degerler(g).forEach((v) => g.bloklar.forEach((b) => { const k = M.grupKonumu(g, v, b); ekle(k[0], k[1], k[2]); })));
  const kutu = new THREE.Box3().setFromPoints(noktalar);
  kutu.getCenter(merkez);
  kamera.position.copy(merkez).addScaledVector(BAKIS, 60);
  kamera.up.set(0, 1, 0);
  kamera.lookAt(merkez);
  kamera.updateMatrixWorld();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const v = new THREE.Vector3();
  noktalar.forEach((p) => {
    for (const dx of [-0.5, 0.5]) for (const dy of [-0.5, 1.3]) for (const dz of [-0.5, 0.5]) {
      v.set(p.x + dx, p.y + dy, p.z + dz).applyMatrix4(kamera.matrixWorldInverse);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
  });
  sigdirma = { yarimEn: (x1 - x0) / 2, yarimBoy: (y1 - y0) / 2, mx: (x0 + x1) / 2, my: (y0 + y1) / 2 };
  if (aninda) { zoomCarpani = 1; zoomHedef = 1; }
  boyutlandir();
}
function frustumAyarla() {
  const en = kap.clientWidth || 1, boy = kap.clientHeight || 1;
  const aspect = en / boy;
  // Üstte düğmeler, altta metin için pay bırak
  const payliBoy = sigdirma.yarimBoy * 1.38 + 0.6, payliEn = sigdirma.yarimEn * 1.12 + 0.4;
  let yb = Math.max(payliBoy, payliEn / aspect) * zoomCarpani;
  const ye = yb * aspect;
  kamera.left = sigdirma.mx - ye; kamera.right = sigdirma.mx + ye;
  kamera.top = sigdirma.my + yb * 0.92; kamera.bottom = sigdirma.my - yb * 1.08;
  kamera.updateProjectionMatrix();
}
function boyutlandir() {
  const en = kap.clientWidth || 1, boy = kap.clientHeight || 1;
  renderer.setSize(en, boy, false);
  if (B) frustumAyarla();
}
new ResizeObserver(boyutlandir).observe(kap);

function ekranKonumu(v3) {
  const v = v3.clone().project(kamera);
  return { x: (v.x + 1) / 2 * canvas.clientWidth, y: (1 - v.y) / 2 * canvas.clientHeight };
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
function ton(f, sure, hacim, tip, gecikme, vibrato) {
  const c = sesHazirla();
  if (!c) return;
  const t0 = c.currentTime + (gecikme || 0);
  const o = c.createOscillator(), g = c.createGain();
  o.type = tip || 'sine';
  o.frequency.setValueAtTime(f, t0);
  if (vibrato) {
    const l = c.createOscillator(), lg = c.createGain();
    l.frequency.value = 5; lg.gain.value = f * 0.012;
    l.connect(lg).connect(o.frequency); l.start(t0); l.stop(t0 + sure + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(hacim, t0 + (vibrato ? 0.12 : 0.006));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + sure + 0.05);
}
// Kanun benzeri telli çekme: hızlı sönen üçgen dalga ve oktav üstü
const kanun = (f, gecikme) => { ton(f, 0.5, 0.09, 'triangle', gecikme); ton(f * 2, 0.25, 0.03, 'sine', gecikme); };
// Hicaz dizisinden notalar (Re, Mi bemol, Fa diyez, Sol, La, Si bemol, Do)
const HICAZ = [293.7, 311.1, 370, 392, 440, 466.2, 523.3, 587.3];
const sesler = {
  adim: () => ton(180 + Math.random() * 30, 0.06, 0.05, 'triangle'),
  cark: (i) => kanun(HICAZ[(i % 7 + 7) % 7]),
  oturdu: () => { kanun(HICAZ[0] / 2); kanun(HICAZ[4] / 2, 0.05); },
  plaka: () => { ton(98, 0.5, 0.18, 'sine'); kanun(HICAZ[3], 0.08); },
  yok: () => ton(140, 0.12, 0.06, 'square'),
  bitti: () => {
    [0, 2, 3, 4, 7].forEach((n, i) => kanun(HICAZ[n], i * 0.14));
    ton(HICAZ[4], 2.4, 0.06, 'sine', 0.75, true);
  }
};
function ortamBaslat() {
  const c = sesHazirla();
  if (!c || ortam) return;
  // Ney benzeri yumuşak, nefesli bir dem: düşük sinüsler, yavaş açılıp kapanan alçak geçiren süzgeç
  const ana = c.createGain();
  ana.gain.value = 0.0001;
  ana.gain.exponentialRampToValueAtTime(0.04, c.currentTime + 3);
  const f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 600;
  const lfo = c.createOscillator(), lg = c.createGain();
  lfo.frequency.value = 0.05; lg.gain.value = 250;
  lfo.connect(lg).connect(f.frequency);
  const osc = [146.8, 220, 293.7].map((fr, i) => {
    const o = c.createOscillator();
    o.type = i ? 'sine' : 'triangle'; o.frequency.value = fr; o.detune.value = i * 3;
    o.connect(f); o.start();
    return o;
  });
  f.connect(ana).connect(c.destination);
  lfo.start();
  ortam = { ana, osc: osc.concat([lfo]) };
}
function ortamDurdur() {
  if (!ortam || !ses) return;
  const o = ortam;
  ortam = null;
  o.ana.gain.cancelScheduledValues(ses.currentTime);
  o.ana.gain.setValueAtTime(Math.max(o.ana.gain.value, 0.0001), ses.currentTime);
  o.ana.gain.exponentialRampToValueAtTime(0.0001, ses.currentTime + 0.5);
  o.osc.forEach((x) => x.stop(ses.currentTime + 0.55));
}

// ---------- Yürüyüş ----------
let yuruyus = null; // { yol, i, t0, a, b }
function yuruBasla(hedef) {
  const y = M.yol(s, hedef);
  if (!y || !y.length) return false;
  bekciYerlestir();
  yuruyus = { yol: y, i: 0, t0: performance.now(), a: s.konum.slice() };
  adimHazirla();
  return true;
}
function adimHazirla() {
  const b = yuruyus.yol[yuruyus.i];
  yuruyus.b = b;
  yuruyus.t0 = performance.now();
  const d = [b[0] - yuruyus.a[0], b[1] - yuruyus.a[1], b[2] - yuruyus.a[2]];
  // Görsel köprü (derinlik değişen adım): bekçi bu adımda hiçbir şeyin arkasında kalmasın
  bekciDerinlikSiz(Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]) !== 1);
  const yon = Math.abs(d[0]) >= Math.abs(d[2]) ? (d[0] - d[1] > 0 ? 0 : Math.PI) : (d[2] - d[1] > 0 ? -Math.PI / 2 : Math.PI / 2);
  bekci.rotation.y = yon;
  sesler.adim();
}
function yuruyusIlerlet(simdi) {
  if (!yuruyus) return;
  const t = Math.min(1, (simdi - yuruyus.t0) / ADIM_MS);
  const a = yuruyus.a, b = yuruyus.b;
  bekci.position.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + 0.5 + Math.sin(t * Math.PI) * 0.06, a[2] + (b[2] - a[2]) * t);
  if (t < 1) return;
  const olaylar = M.adim(s, b);
  bekciDerinlikSiz(false);
  let dur = false;
  olaylar.forEach((o) => {
    if (o.tur === 'plaka') { plakaBasildi(o); dur = true; }
    if (o.tur === 'bitti') { yuruyus = null; bolumBitti(); }
  });
  if (!yuruyus) return;
  yuruyus.a = b;
  yuruyus.i += 1;
  if (dur || yuruyus.i >= yuruyus.yol.length) { yuruyus = null; bekciYerlestir(); return; }
  adimHazirla();
}
function plakaBasildi(o) {
  plakaNesneleri[o.i].material = mat(R.sodyum);
  sesler.plaka();
  ipucuGoster('Uzakta bir şey kımıldadı', 2200);
}

// ---------- Etkileşim: dokun, döndür, kaydır ----------
const isin = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let surukleme = null;
function isinAt(ev) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  isin.setFromCamera(ndc, kamera);
  return isin.intersectObjects(tiklanabilir, false);
}
function dokunusHalkasi(ev, yok) {
  const r = canvas.getBoundingClientRect();
  const d = document.createElement('span');
  d.className = 'dokunus' + (yok ? ' yok' : '');
  d.style.left = ev.clientX - r.left + 'px';
  d.style.top = ev.clientY - r.top + 'px';
  kap.appendChild(d);
  setTimeout(() => d.remove(), 450);
}
function blokKonumu(o) {
  if (o.userData.konum) return o.userData.konum;
  const g = B.gruplar.find((x) => x.id === o.userData.grup);
  return M.grupKonumu(g, s.durum[g.id], g.bloklar[o.userData.i]);
}

canvas.addEventListener('pointerdown', (ev) => {
  if (!B || s.bitti) return;
  sesHazirla();
  ortamBaslat();
  const vuruslar = isinAt(ev);
  if (!vuruslar.length) { dokunusHalkasi(ev, true); return; }
  const o = vuruslar[0].object;
  const id = o.userData.tutamac;
  // Tutamağa ya da hareketli bir parçanın yürünemeyen yüzüne dokunuş sürüklemeyi başlatır
  if (id && !yuruyus && !M.kilitli(s, id) && (!o.userData.blok || !karoMu(o))) {
    surukleBasla(ev, grupNesneleri[id]);
    return;
  }
  if (o.userData.blok && !yuruyus) {
    const k = blokKonumu(o);
    if (karoMu(o) && yuruBasla(k)) { dokunusHalkasi(ev, false); return; }
    // Yürünemeyen hareketli parça: yine de sürüklenebilsin
    if (id && !M.kilitli(s, id)) { surukleBasla(ev, grupNesneleri[id]); return; }
  }
  dokunusHalkasi(ev, true);
  if (!yuruyus) sesler.yok();
});
function karoMu(o) {
  if (!o.userData.blok) return false;
  const k = blokKonumu(o);
  const t = M.karolar(s).get(M.hucre(k));
  return !!t && M.esit([t.x, t.y, t.z], k);
}

function surukleBasla(ev, kayit) {
  const g = kayit.g;
  const pivot = g.tur === 'donen' ? new THREE.Vector3(...g.pivot) : new THREE.Vector3(...g.bloklar[0]);
  const ek = ekranKonumu(pivot);
  const r = canvas.getBoundingClientRect();
  surukleme = { kayit, ex: ev.clientX - r.left, ey: ev.clientY - r.top, pivotEkran: ek, bas: kayit.gorsel, son: Math.round(kayit.gorsel) };
  if (g.tur === 'donen') {
    surukleme.aci0 = Math.atan2(-(surukleme.ey - ek.y), surukleme.ex - ek.x);
    // Eksen kameraya doğru bakıyorsa ekranda saat yönü tersi pozitif dönüştür
    const eksen = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[g.eksen];
    surukleme.isaret = eksen[0] * BAKIS.x + eksen[1] * BAKIS.y + eksen[2] * BAKIS.z > 0 ? 1 : -1;
  } else {
    const e = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[g.eksen];
    const uc = ekranKonumu(pivot.clone().add(new THREE.Vector3(...e)));
    surukleme.yon = { x: uc.x - ek.x, y: uc.y - ek.y };
  }
  // Bekçi bu grubun üstündeyse onunla birlikte döner
  const alt = M.dunya(s).get(M.anahtar(...s.konum));
  if (alt && alt.grup === g.id) kayit.nesne.attach(bekci);
  kayit.tutamacMalz && kayit.tutamacMalz.color.set(R.sodyum);
  canvas.classList.add('surukle');
  canvas.setPointerCapture(ev.pointerId);
}
canvas.addEventListener('pointermove', (ev) => {
  const r = canvas.getBoundingClientRect();
  if (!surukleme) {
    if (ev.pointerType === 'mouse' && B && !s.bitti) {
      const v = isinAt(ev);
      canvas.classList.toggle('tutamacta', !!(v.length && v[0].object.userData.tutamac && !karoMu(v[0].object)));
    }
    return;
  }
  const x = ev.clientX - r.left, y = ev.clientY - r.top;
  const k = surukleme.kayit, g = k.g;
  if (g.tur === 'donen') {
    let da = Math.atan2(-(y - surukleme.pivotEkran.y), x - surukleme.pivotEkran.x) - surukleme.aci0;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    k.gorsel = surukleme.bas + surukleme.isaret * da / (Math.PI / 2);
    // Döndükçe biriken açıyı koru: tam turları sürdür
    if (Math.abs(da) > Math.PI * 0.75) { surukleme.bas = k.gorsel; surukleme.aci0 += da; }
  } else {
    const yn = surukleme.yon, l2 = yn.x * yn.x + yn.y * yn.y || 1;
    const d = ((x - surukleme.ex) * yn.x + (y - surukleme.ey) * yn.y) / l2;
    k.gorsel = Math.max(g.min || 0, Math.min(g.max, surukleme.bas + d));
  }
  const yuvarlak = Math.round(k.gorsel);
  if (yuvarlak !== surukleme.son) { surukleme.son = yuvarlak; sesler.cark(yuvarlak); }
  grupGorselUygula(k);
});
function surukleBitir() {
  if (!surukleme) return;
  const k = surukleme.kayit, g = k.g;
  const izinli = M.degerler(g);
  let hedef;
  if (g.tur === 'donen') {
    // En yakın izinli dik açı (tam turlar korunarak)
    const tur = Math.floor(k.gorsel / 4) * 4;
    let en = Infinity;
    for (const t of [tur - 4, tur, tur + 4]) for (const v of izinli) {
      const d = Math.abs(t + v - k.gorsel);
      if (d < en) { en = d; hedef = t + v; }
    }
    M.oynat(s, g.id, ((hedef % 4) + 4) % 4);
  } else {
    hedef = izinli.reduce((a, v) => (Math.abs(v - k.gorsel) < Math.abs(a - k.gorsel) ? v : a), izinli[0]);
    M.oynat(s, g.id, hedef);
  }
  k.hedef = hedef;
  k.tutamacMalz && k.tutamacMalz.color.set(R.kemik);
  canvas.classList.remove('surukle');
  surukleme = null;
}
canvas.addEventListener('pointerup', surukleBitir);
canvas.addEventListener('pointercancel', surukleBitir);

// Grupların görselini mantıktaki duruma yaylandır
function gruplariIlerlet(dt) {
  for (const id in grupNesneleri) {
    const k = grupNesneleri[id];
    if (surukleme && surukleme.kayit === k) continue;
    let hedef = k.hedef != null ? k.hedef : s.durum[id];
    if (k.g.tur === 'donen' && k.hedef == null) {
      // Plakadan gelen değişimde en kısa yönden dön
      const v = s.durum[id];
      hedef = Math.round(k.gorsel / 4) * 4 + v;
      if (hedef - k.gorsel > 2) hedef -= 4;
      if (k.gorsel - hedef > 2) hedef += 4;
    }
    const fark = hedef - k.gorsel;
    if (Math.abs(fark) < 0.002) {
      if (k.gorsel !== hedef) {
        k.gorsel = hedef;
        grupGorselUygula(k);
        sesler.oturdu();
        if (bekci.parent === k.nesne) bekciYerlestir();
      }
      if (k.g.tur === 'donen') { k.gorsel = ((Math.round(k.gorsel) % 4) + 4) % 4; grupGorselUygula(k); }
      k.hedef = null;
      continue;
    }
    const hiz = k.g.surekli === false ? 2.2 : 9;
    k.gorsel += hareketAz() ? fark : fark * (1 - Math.exp(-dt * hiz));
    grupGorselUygula(k);
    if (bekci.parent !== k.nesne) {
      const alt = M.dunya(s).get(M.anahtar(...s.konum));
      if (alt && alt.grup === id && !yuruyus) {
        // Plakanın taşıdığı parçanın üstündeyken bekçi onunla gider
        bekci.position.set(s.konum[0], s.konum[1] + 0.5, s.konum[2]);
      }
    }
  }
}

// ---------- Bölüm akışı ----------
let bitisZamani = 0;
function bolumBitti() {
  if (!ilerleme.tamam.includes(B.no)) ilerleme.tamam.push(B.no);
  const sonraki = bolumler.find((b) => b.no === B.no + 1);
  ilerleme.son = sonraki ? sonraki.no : B.no;
  kaydet();
  Depo.ozetYaz('kayip-minareler', ilerleme.tamam.length + '/' + bolumler.length + ' bölüm');
  sesler.bitti();
  bitisZamani = performance.now();
  zoomHedef = 1.08;
  setTimeout(() => {
    $('siir').textContent = B.siir;
    $('sonraki').textContent = sonraki ? 'Sonraki bölüm' : 'Baştan başla';
    $('son').hidden = false;
    $('sonraki').focus({ preventScroll: true });
  }, hareketAz() ? 200 : 1100);
  listeyiCiz();
}
function sonGizle() { $('son').hidden = true; bitisZamani = 0; }
$('sonraki').addEventListener('click', () => {
  const sonraki = bolumler.find((b) => b.no === B.no + 1);
  bolumKur(sonraki ? sonraki.no : 1);
});

function bolumAdiGoster() {
  const e = $('bolum-adi');
  e.textContent = B.rakam + ' · ' + B.ad;
  e.classList.remove('goster');
  void e.offsetWidth;
  e.classList.add('goster');
  clearTimeout(bolumAdiGoster.z);
  bolumAdiGoster.z = setTimeout(() => e.classList.remove('goster'), 2700);
  if (B.no === 1 && !ilerleme.tamam.length) ipucuGoster('Bir taşa dokun; köprüyü rayı boyunca sürükle', 4500);
  else if (B.gruplar && B.gruplar.some((g) => g.tur === 'donen' && g.surekli !== false) && !ilerleme.tamam.includes(B.no) && B.no === 2) ipucuGoster('Kemik çarkı çevirerek parçayı döndür', 4000);
  else if (B.no === 3 && !ilerleme.tamam.includes(3)) ipucuGoster('Burada göz ne görürse ayak oraya basar', 4000);
}
let ipucuZaman = 0;
function ipucuGoster(metin, sure) {
  const e = $('ipucu');
  e.textContent = metin;
  e.classList.remove('gizli');
  clearTimeout(ipucuZaman);
  ipucuZaman = setTimeout(() => e.classList.add('gizli'), sure);
}

// Bölüm seçimi: her bölüm için küçük izometrik minare simgesi
const MINARE_SVG = '<svg class="isik" viewBox="0 0 24 40" width="22" height="36" aria-hidden="true"><path d="M12 2 L16 12 H8 Z" fill="currentColor"/><rect x="8.5" y="12" width="7" height="22" fill="currentColor" opacity=".55"/><rect x="6.5" y="17" width="11" height="2" fill="currentColor"/><path d="M4 34 H20 L17 38 H7 Z" fill="currentColor" opacity=".4"/></svg>';
function listeyiCiz() {
  const ol = $('bolum-listesi');
  ol.textContent = '';
  const acik = Math.max(1, ...ilerleme.tamam.map((n) => n + 1));
  bolumler.forEach((b) => {
    const li = document.createElement('li');
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'bolum-dugme' + (ilerleme.tamam.includes(b.no) ? ' tamam' : b.no === acik ? ' sirada' : '');
    d.disabled = b.no > acik;
    d.setAttribute('aria-current', String(B && b.no === B.no));
    d.setAttribute('aria-label', b.rakam + ', ' + b.ad + (ilerleme.tamam.includes(b.no) ? ', tamamlandı' : d.disabled ? ', kilitli' : ''));
    d.innerHTML = MINARE_SVG + '<span class="rakam">' + b.rakam + '</span>';
    d.addEventListener('click', () => { $('bolumler').close(); bolumKur(b.no); });
    li.appendChild(d);
    ol.appendChild(li);
  });
}
$('menu').addEventListener('click', () => { listeyiCiz(); $('bolumler').showModal(); });

function sesDugmesi() {
  const b = $('ses');
  b.setAttribute('aria-pressed', String(sesAcik));
  b.setAttribute('aria-label', sesAcik ? 'Sesi kapat' : 'Sesi aç');
}
$('ses').addEventListener('click', () => {
  sesAcik = !sesAcik;
  Depo.yaz('minare:ses', sesAcik);
  sesDugmesi();
  if (sesAcik) ortamBaslat(); else ortamDurdur();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) ortamDurdur(); });

// ---------- Döngü ----------
let onceki = performance.now();
function kare(simdi) {
  kalite.kare(simdi);
  const dt = Math.min(0.1, (simdi - onceki) / 1000);
  onceki = simdi;
  if (B) {
    yuruyusIlerlet(simdi);
    gruplariIlerlet(dt);
    if (bitisZamani) {
      const t = Math.min(1, (simdi - bitisZamani) / (hareketAz() ? 1 : 1400));
      minareIsigi.intensity = 6 * t;
      kulahMalz.emissiveIntensity = 0.8 * t;
      hale.material.opacity = 0.55 * t;
    } else {
      minareIsigi.intensity = 0; kulahMalz.emissiveIntensity = 0; hale.material.opacity = 0;
    }
    if (Math.abs(zoomCarpani - zoomHedef) > 0.0005) {
      zoomCarpani += (zoomHedef - zoomCarpani) * (hareketAz() ? 1 : 1 - Math.exp(-dt * 1.5));
      frustumAyarla();
    }
    hale.quaternion.copy(kamera.quaternion);
  }
  renderer.render(sahne, kamera);
  requestAnimationFrame(kare);
}

// ---------- Başlat ----------
sesDugmesi();
Kalite.dugmeEkle(document.getElementById('ses'), kalite);
fetch('bolumler.json').then((r) => r.json()).then((veri) => {
  bolumler = veri;
  const ilk = bolumler.find((b) => !ilerleme.tamam.includes(b.no)) || bolumler[0];
  bolumKur(ilerleme.son && bolumler.some((b) => b.no === ilerleme.son) && !ilerleme.tamam.includes(ilerleme.son) ? ilerleme.son : ilk.no);
  listeyiCiz();
  requestAnimationFrame(kare);
});

// Tarayıcı testleri için küçük kanca
window.__minare = {
  get durum() { return s; },
  get bolum() { return B; },
  get yuruyor() { return !!yuruyus; },
  git: (no) => bolumKur(no),
  oynat: (id, v) => { const ok = M.oynat(s, id, v); if (ok) grupNesneleri[id].hedef = null; return ok; },
  yuru: (k) => yuruBasla(k),
  ekran: (x, y, z) => ekranKonumu(new THREE.Vector3(x, y, z))
};
