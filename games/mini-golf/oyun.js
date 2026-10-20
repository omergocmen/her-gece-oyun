// Mini Golf Türkiye: three.js sahneleri, vuruş kontrolü, kamera, HUD ve tur akışı.
// Fizik fizik.js'te (GolfFizik), parkur verisi parkur.js'te (GolfParkur).
import * as THREE from 'three';

const F = window.GolfFizik;
const P = window.GolfParkur;

// Renkler: DESIGN.md token'ları ve oyun içi ek renk tablosu.
const R = {
  murekkep: '#110f0d', kagit: '#1b1815', kagit2: '#26211c', cizgi: '#3b332b', krem: '#f3ead8',
  sodyum: '#ffb23f', kor: '#ff6a48', yaprak: '#368549', ay: '#9db4ff',
  iznik: '#2f6fb0', turkuaz: '#2aa198', ceviz: '#5a3b24', kemik: '#e9dcc2', cim: '#2c5a3a', kum: '#c9a46a'
};
const MAKS_VURUS = 10;
const DELIK_SAYISI = P.DELIKLER.length;

const $ = (id) => document.getElementById(id);
const kap = $('sahne');
const hareketAz = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Kayıt ----------
function ilerlemeOku() {
  const k = Depo.oku('golf:ilerleme', null);
  const bos = { acik: 1, enIyi: {}, enIyiToplam: null, tur: { delik: 1, skorlar: {} } };
  if (!k || typeof k !== 'object') return bos;
  return Object.assign(bos, k, { tur: Object.assign({ delik: 1, skorlar: {} }, k.tur || {}) });
}
let ilerleme = ilerlemeOku();
const kaydet = () => Depo.yaz('golf:ilerleme', ilerleme);
let sesAcik = Depo.oku('golf:ses', true);

// ---------- Sahne ----------
const renderer = new THREE.WebGLRenderer(Kalite.rendererSecenek({ powerPreference: 'high-performance' }));
const kalite = Kalite.kur(renderer, { azami: 1.75, boyutla: boyutlandir });
renderer.setClearColor(R.murekkep);
kap.prepend(renderer.domElement);
const canvas = renderer.domElement;
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', 'Mini golf sahnesi');

const sahne = new THREE.Scene();
sahne.fog = new THREE.Fog(R.murekkep, 12, 34);
const kamera = new THREE.PerspectiveCamera(50, 1, 0.05, 80);

sahne.add(new THREE.HemisphereLight(R.krem, R.murekkep, 0.55));
const anaIsik = new THREE.DirectionalLight('#ffd9a0', 1.1);
anaIsik.position.set(-4, 9, 4);
sahne.add(anaIsik);
const ayIsigi = new THREE.DirectionalLight(R.ay, 0.75);
ayIsigi.position.set(5, 6, -6);
sahne.add(ayIsigi);

const malzemeler = {};
function mat(renk, ek) {
  const k = renk + JSON.stringify(ek || {});
  if (!malzemeler[k]) malzemeler[k] = new THREE.MeshLambertMaterial(Object.assign({ color: renk, flatShading: true }, ek || {}));
  return malzemeler[k];
}
const temel = (renk) => new THREE.MeshBasicMaterial({ color: renk });

function radyalDoku(renk, ic, dis) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, renk.replace('A', ic));
  grad.addColorStop(1, renk.replace('A', dis));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const isikHavuzuDokusu = radyalDoku('rgba(255,178,63,A)', 0.38, 0);
const golgeDokusu = radyalDoku('rgba(8,6,4,A)', 0.7, 0);

// ---------- Delik nesneleri ----------
let delikGrup = null;
let D = null; // derlenmiş delik
let durum = null; // fizik durumu
let delikNo = 1;
let vurus = 0;
let biriken = 0;
let bitti = false;
let kapiMeshleri = [];
let vapurMeshleri = [];
let balonlar = [];
let bayrak = null;
let sinirlar = null;

function ekle(nesne, x, y, z) {
  nesne.position.set(x, y, z);
  delikGrup.add(nesne);
  return nesne;
}

function zeminKur() {
  const poz = [];
  const renk = [];
  const c = new THREE.Color();
  const H = F.HUCRE;
  const tema = D.veri.sahne;
  let enAlt = 0;
  Object.keys(D.hucreler).forEach((k) => {
    const [i, j] = k.split(',').map(Number);
    const x0 = i * H, z0 = j * H, x1 = x0 + H, z1 = z0 + H;
    const mx = x0 + H / 2, mz = z0 + H / 2;
    if (D.su.some((r) => F.icinde(r, mx, mz))) return;
    const h = (x, z) => F.yukseklik(D, x, z);
    const e = F.egim(D, mx, mz);
    const egimli = Math.abs(e[0]) + Math.abs(e[1]) > 0.01;
    let r = R.cim;
    if (egimli && tema === 'pamukkale') r = R.kemik;
    if (egimli && tema === 'galata') r = (i + j) % 2 ? R.cizgi : '#4a4036';
    c.set(r);
    if (!egimli && (i + j) % 2) c.multiplyScalar(0.93); // hafif çim deseni
    enAlt = Math.min(enAlt, h(mx, mz));
    const a = [x0, h(x0, z0), z0], b = [x1, h(x1, z0), z0], cc = [x1, h(x1, z1), z1], d = [x0, h(x0, z1), z1];
    [a, d, cc, a, cc, b].forEach((p) => { poz.push(p[0], p[1], p[2]); renk.push(c.r, c.g, c.b); });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(renk, 3));
  g.computeVertexNormals();
  delikGrup.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));

  // Zemin altı taban: alanın dışı mürekkep tonunda karanlığa erir.
  const taban = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat(R.kagit));
  taban.rotation.x = -Math.PI / 2;
  ekle(taban, sinirlar.cx, enAlt - 0.07, sinirlar.cz);
}

function duvarlarKur() {
  const malzeme = mat(R.ceviz);
  const govde = new THREE.BoxGeometry(1, 1, 1);
  D.cizgiler.forEach((c) => {
    if (!c.duvar && !c.tampon) return;
    const dx = c.bx - c.ax, dz = c.bz - c.az;
    const uz = Math.hypot(dx, dz);
    const parca = Math.max(1, Math.ceil(uz / F.HUCRE));
    for (let i = 0; i < parca; i++) {
      const t0 = i / parca, t1 = (i + 1) / parca;
      const x0 = c.ax + dx * t0, z0 = c.az + dz * t0, x1 = c.ax + dx * t1, z1 = c.az + dz * t1;
      const h0 = F.yukseklik(D, x0, z0), h1 = F.yukseklik(D, x1, z1);
      const alt = Math.min(h0, h1) - 0.06;
      const ust = Math.max(h0, h1) + (c.tampon ? 0.16 : 0.17);
      const m = new THREE.Mesh(govde, c.tampon ? mat(R.kagit2) : malzeme);
      m.scale.set(uz / parca + (c.tampon ? 0 : F.DUVAR_W * 2), ust - alt, (c.w || 0.04) * 2);
      m.position.set((x0 + x1) / 2, (alt + ust) / 2, (z0 + z1) / 2);
      m.rotation.y = -Math.atan2(dz, dx);
      delikGrup.add(m);
      if (c.tampon) {
        const serit = new THREE.Mesh(govde, temel(R.sodyum));
        serit.scale.set(uz / parca, 0.02, (c.w || 0.04) * 2 + 0.005);
        serit.position.set(m.position.x, ust + 0.01, m.position.z);
        serit.rotation.y = m.rotation.y;
        delikGrup.add(serit);
      }
    }
  });
}

function engellerKur() {
  D.daireler.forEach((c) => {
    const h = F.yukseklik(D, c.x, c.z);
    if (c.tur === 'peri') periBacasi(c.x, h, c.z, c.r, 1.25);
    else if (c.tur === 'sutun') sutun(c.x, h, c.z, c.r, 1.3);
    else if (c.tur === 'bas') nemrutBasi(c.x, h, c.z, c.r);
    else ekle(new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, 0.3, 10), mat(R.kum)), c.x, h + 0.15, c.z);
  });
  const kemerler = [];
  D.kutular.forEach((k) => {
    const [x0, z0, x1, z1] = k.r;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const h = F.yukseklik(D, cx, cz);
    if (k.tur === 'kirik') {
      // Devrilmiş sütun: yatay silindir.
      const uzun = Math.max(x1 - x0, z1 - z0), kalin = Math.min(x1 - x0, z1 - z0);
      const m = ekle(new THREE.Mesh(new THREE.CylinderGeometry(kalin / 2, kalin / 2, uzun, 8), mat(R.kum)), cx, h + kalin / 2, cz);
      if (x1 - x0 > z1 - z0) m.rotation.z = Math.PI / 2; else m.rotation.x = Math.PI / 2;
      return;
    }
    const renk = k.tur === 'teras' ? R.kemik : k.tur === 'tas' ? R.cizgi : k.tur === 'kemer' ? R.kum : R.ceviz;
    const y = k.y || 0.25;
    ekle(new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y, z1 - z0), mat(renk)), cx, h + y / 2, cz);
    if (k.tur === 'kemer') kemerler.push(k);
  });
  // Kemer çiftlerinin üstüne yarım daire kemer.
  for (let i = 0; i + 1 < kemerler.length; i += 2) {
    const a = kemerler[i].r, b = kemerler[i + 1].r;
    const yatayAralik = Math.abs(a[1] - b[1]) < 0.01 && Math.abs(a[3] - b[3]) < 0.01;
    let cx, cz, yaricap, ry;
    if (yatayAralik) { cx = (a[2] + b[0]) / 2; cz = (a[1] + a[3]) / 2; yaricap = (b[2] - a[0]) / 2; ry = 0; }
    else { cx = (a[0] + a[2]) / 2; cz = (Math.max(a[1], b[1]) + Math.min(a[3], b[3])) / 2; yaricap = (Math.max(a[3], b[3]) - Math.min(a[1], b[1])) / 2; ry = Math.PI / 2; }
    const m = ekle(new THREE.Mesh(new THREE.TorusGeometry(yaricap, 0.09, 5, 14, Math.PI), mat(R.kum)), cx, 0.3, cz);
    m.rotation.y = ry;
  }
  kapiMeshleri = D.kapilar.map((k) => {
    const g = new THREE.Group();
    const cubuk = new THREE.Mesh(new THREE.BoxGeometry(k.L * 2, 0.14, (k.kalinlik || 0.06) * 2), mat(R.ceviz));
    cubuk.position.y = 0.09;
    g.add(cubuk);
    [-1, 1].forEach((s) => {
      const uc = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.15, (k.kalinlik || 0.06) * 2 + 0.01), mat(R.kor));
      uc.position.set(s * (k.L - 0.08), 0.095, 0);
      g.add(uc);
    });
    if (k.direk) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(k.direk, k.direk, 0.34, 8), mat(R.kemik));
      d.position.y = 0.17;
      g.add(d);
    }
    ekle(g, k.x, F.yukseklik(D, k.x, k.z), k.z);
    return g;
  });
  vapurMeshleri = D.vapurlar.map((v) => {
    const g = new THREE.Group();
    const govde = new THREE.Mesh(new THREE.BoxGeometry(v.en, 0.26, v.boy), mat(R.kemik));
    govde.position.y = -0.13;
    g.add(govde);
    [-1, 1].forEach((s) => {
      const serit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, v.boy + 0.01), mat(R.kor));
      serit.position.set(s * (v.en / 2 - 0.03), -0.06, 0);
      g.add(serit);
    });
    ekle(g, v.x, 0, v.z);
    return g;
  });
}

function periBacasi(x, y, z, r, boy) {
  const g = new THREE.Group();
  const govde = new THREE.Mesh(new THREE.ConeGeometry(r * 1.05, boy, 7), mat(R.kum));
  govde.position.y = boy / 2;
  g.add(govde);
  const sapka = new THREE.Mesh(new THREE.ConeGeometry(r * 0.9, r * 1.1, 6), mat('#7a5a3a'));
  sapka.position.y = boy + r * 0.3;
  g.add(sapka);
  g.rotation.y = x * 3.1 + z;
  return ekle(g, x, y, z);
}

function sutun(x, y, z, r, boy) {
  const g = new THREE.Group();
  const govde = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, boy, 8), mat(R.kum));
  govde.position.y = boy / 2;
  g.add(govde);
  const baslik = new THREE.Mesh(new THREE.BoxGeometry(r * 2.6, r * 0.7, r * 2.6), mat(R.kemik));
  baslik.position.y = boy + r * 0.35;
  g.add(baslik);
  return ekle(g, x, y, z);
}

function nemrutBasi(x, y, z, r) {
  const g = new THREE.Group();
  const kaide = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.25, 8), mat(R.cizgi));
  kaide.position.y = 0.12;
  g.add(kaide);
  const bas = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.95, 0), mat(R.kum));
  bas.scale.set(1, 1.15, 0.95);
  bas.position.y = 0.25 + r;
  g.add(bas);
  const kulah = new THREE.Mesh(new THREE.ConeGeometry(r * 0.8, r * 1.5, 6), mat('#a88552'));
  kulah.position.y = 0.25 + r * 2.3;
  kulah.rotation.z = 0.25;
  g.add(kulah);
  g.rotation.y = Math.PI + x * 0.3;
  return ekle(g, x, y, z);
}

function tehlikelerKur() {
  const duz = (r, renk, y, opak) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r[2] - r[0], r[3] - r[1]),
      new THREE.MeshLambertMaterial({ color: renk, transparent: opak < 1, opacity: opak, depthWrite: opak >= 1 }));
    m.rotation.x = -Math.PI / 2;
    const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
    return ekle(m, cx, F.yukseklik(D, cx, cz) + y, cz);
  };
  D.su.forEach((r) => duz(r, R.iznik, -0.09, 0.92));
  D.kum.forEach((r) => duz(r, R.kum, 0.006, 1));
  D.sig.forEach((r) => duz(r, R.turkuaz, 0.008, 0.72));
}

function delikVeBayrak() {
  const [hx, hz] = D.delik;
  const h = F.yukseklik(D, hx, hz);
  const cukur = new THREE.Mesh(new THREE.CircleGeometry(F.DELIK_R, 20), temel(R.murekkep));
  cukur.rotation.x = -Math.PI / 2;
  ekle(cukur, hx, h + 0.009, hz);
  const halka = new THREE.Mesh(new THREE.RingGeometry(F.DELIK_R, F.DELIK_R + 0.025, 24), temel(R.krem));
  halka.rotation.x = -Math.PI / 2;
  ekle(halka, hx, h + 0.01, hz);
  const g = new THREE.Group();
  const direk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.05, 6), temel(R.krem));
  direk.position.y = 0.52;
  g.add(direk);
  const sekil = new THREE.Shape();
  sekil.moveTo(0, 0); sekil.lineTo(0.42, -0.13); sekil.lineTo(0, -0.26); sekil.closePath();
  const bez = new THREE.Mesh(new THREE.ShapeGeometry(sekil), new THREE.MeshBasicMaterial({ color: R.sodyum, side: THREE.DoubleSide }));
  bez.position.y = 1.04;
  g.add(bez);
  g.userData.bez = bez;
  bayrak = ekle(g, hx, h, hz);
  // Tee matı
  const [tx, tz] = D.tee;
  const mat0 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.45), mat(R.kagit2));
  ekle(mat0, tx, F.yukseklik(D, tx, tz) + 0.006, tz);
}

function lambalarKur() {
  (D.veri.lambalar || []).forEach(([x, z], i) => {
    const g = new THREE.Group();
    const direk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 2.1, 6), mat(R.cizgi));
    direk.position.y = 1.05;
    g.add(direk);
    const kol = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.04), mat(R.cizgi));
    kol.position.set(x < sinirlar.cx ? 0.22 : -0.22, 2.08, 0);
    g.add(kol);
    const fener = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.14), temel(R.sodyum));
    fener.position.set(x < sinirlar.cx ? 0.42 : -0.42, 2.0, 0);
    g.add(fener);
    ekle(g, x, 0, z);
    const havuz = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2),
      new THREE.MeshBasicMaterial({ map: isikHavuzuDokusu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    havuz.rotation.x = -Math.PI / 2;
    const hx = x + (x < sinirlar.cx ? 0.42 : -0.42);
    ekle(havuz, hx, F.yukseklik(D, hx, z) + 0.02, z);
    if (i < 2) {
      const isik = new THREE.PointLight(R.sodyum, 5, 7, 1.6);
      ekle(isik, hx, 1.9, z);
    }
  });
}

// Tohumlu küçük rastgele: sahne süsleri her açılışta aynı yerde dursun.
function rastgele(tohum) {
  let a = tohum >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Alanın dışında, sınırdan en az `pay` uzakta rastgele noktalar.
function disNoktalar(adet, pay, uzak, tohum) {
  const r = rastgele(tohum);
  const s = [];
  let deneme = 0;
  while (s.length < adet && deneme++ < 600) {
    const x = sinirlar.x0 - uzak + r() * (sinirlar.x1 - sinirlar.x0 + uzak * 2);
    const z = sinirlar.z0 - uzak + r() * (sinirlar.z1 - sinirlar.z0 + uzak * 1.3);
    let yakin = false;
    for (let dx = -pay; dx <= pay && !yakin; dx += 0.5) for (let dz = -pay; dz <= pay && !yakin; dz += 0.5) if (F.alandaMi(D, x + dx, z + dz)) yakin = true;
    if (!yakin) s.push([x, z]);
  }
  return s;
}

function sahneSusleri() {
  const tema = D.veri.sahne;
  const uzak = sinirlar.z0 - 6;
  balonlar = [];
  if (tema === 'kapadokya') {
    disNoktalar(14, 1.2, 6, 7).forEach(([x, z], i) => periBacasi(x, 0, z, 0.3 + (i % 3) * 0.12, 1.4 + (i % 4) * 0.5));
    [[-4, uzak - 2, 5.5], [3.5, uzak - 5, 7]].forEach(([x, z, y]) => {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), mat(R.sodyum));
      top.scale.y = 1.15;
      g.add(top);
      const sepet = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), mat(R.ceviz));
      sepet.position.y = -1.3;
      g.add(sepet);
      balonlar.push(ekle(g, x, y, z));
    });
  } else if (tema === 'pamukkale') {
    for (let i = 0; i < 6; i++) {
      [-1, 1].forEach((s) => {
        const x = s * (2.6 + (i % 2) * 0.8);
        const z = 0.5 - i * 2.2;
        const kat = ekle(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25 + i * 0.12, 1.9), mat(R.kemik)), x, -0.05 + (0.25 + i * 0.12) / 2 - i * 0.1, z);
        kat.rotation.y = s * 0.08 * i;
        const havuz = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.5), mat(R.turkuaz));
        havuz.rotation.x = -Math.PI / 2;
        ekle(havuz, x, kat.position.y + (0.25 + i * 0.12) / 2 + 0.01, z);
      });
    }
  } else if (tema === 'efes') {
    // Celsus Kütüphanesi cephesi
    const cx = sinirlar.cx, z = uzak + 1;
    ekle(new THREE.Mesh(new THREE.BoxGeometry(7, 0.4, 1.2), mat(R.kum)), cx, 0.2, z);
    for (let i = 0; i < 8; i++) sutun(cx - 3.1 + i * 0.88, 0.4, z + 0.3, 0.16, 2.6);
    ekle(new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.4, 1.3), mat(R.kemik)), cx, 3.3, z);
    const alin = ekle(new THREE.Mesh(new THREE.CylinderGeometry(0, 1.3, 7.4, 3, 1), mat(R.kum)), cx, 4.0, z);
    alin.rotation.z = Math.PI / 2;
    alin.scale.set(0.6, 1, 0.5);
    disNoktalar(6, 1, 4, 3).forEach(([x, zz], i) => sutun(x, 0, zz, 0.18, 0.6 + (i % 3) * 0.7));
  } else if (tema === 'galata') {
    const g = new THREE.Group();
    const govde = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 6.5, 10), mat(R.cizgi));
    govde.position.y = 3.25;
    g.add(govde);
    const balkon = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.25, 10), mat(R.kagit2));
    balkon.position.y = 6.2;
    g.add(balkon);
    const cati = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.2, 10), mat(R.iznik));
    cati.position.y = 7.6;
    g.add(cati);
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 0.05), temel(R.sodyum));
      const a = (i / 6) * Math.PI * 2;
      p.position.set(Math.sin(a) * 1.12, 5.6, Math.cos(a) * 1.12);
      p.rotation.y = a;
      g.add(p);
    }
    ekle(g, sinirlar.cx + 1.5, F.yukseklik(D, 0, uzak), uzak - 1);
    evler(16, 11);
  } else if (tema === 'kizkulesi') {
    const deniz = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat(R.iznik));
    deniz.rotation.x = -Math.PI / 2;
    ekle(deniz, 0, -0.065, sinirlar.cz);
    const ada = ekle(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 0.4, 9), mat(R.cizgi)), 6, 0, -8);
    ada.position.y = 0.05;
    const kule = ekle(new THREE.Mesh(new THREE.BoxGeometry(1, 2.4, 1), mat(R.kemik)), 6, 1.45, -8);
    kule.rotation.y = 0.3;
    ekle(new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.1, 8), mat(R.cizgi)), 6, 3.2, -8);
    ekle(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.05), temel(R.sodyum)), 6, 2.2, -7.48);
  } else if (tema === 'sultanahmet') {
    const g = new THREE.Group();
    const govde = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 4), mat(R.cizgi));
    govde.position.y = 0.8;
    g.add(govde);
    const kubbe = new THREE.Mesh(new THREE.SphereGeometry(1.7, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(R.kagit2));
    kubbe.position.y = 1.6;
    g.add(kubbe);
    [-2.2, 2.2].forEach((x) => {
      const y = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(R.kagit2));
      y.position.set(x, 1.6, 0);
      g.add(y);
    });
    [[-3.6, -2.4], [3.6, -2.4], [-3.6, 2.4], [3.6, 2.4], [-4.6, 0], [4.6, 0]].forEach(([x, z]) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 5, 6), mat(R.cizgi));
      m.position.set(x, 2.5, z);
      g.add(m);
      const u = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.9, 6), mat(R.kagit2));
      u.position.set(x, 5.45, z);
      g.add(u);
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 6), temel(R.sodyum));
      s.position.set(x, 3.8, z);
      g.add(s);
    });
    ekle(g, sinirlar.cx, 0, uzak - 4);
  } else if (tema === 'kapalicarsi') {
    // Çarşı tonozları: koridor boyunca seyrek kemerler.
    D.veri.alan.forEach((r0, i) => {
      const r = [Math.min(r0[0], r0[2]), Math.min(r0[1], r0[3]), Math.max(r0[0], r0[2]), Math.max(r0[1], r0[3])];
      const yatay = r[2] - r[0] > r[3] - r[1];
      const uz = yatay ? r[2] - r[0] : r[3] - r[1];
      for (let t = 1.2; t < uz - 0.6; t += 2.4) {
        const x = yatay ? r[0] + t : (r[0] + r[2]) / 2;
        const z = yatay ? (r[1] + r[3]) / 2 : r[3] - t;
        const gen = yatay ? r[3] - r[1] : r[2] - r[0];
        const k = ekle(new THREE.Mesh(new THREE.TorusGeometry(gen / 2 + 0.1, 0.07, 4, 16, Math.PI), mat(i % 2 ? R.kum : R.ceviz)), x, 0.6, z);
        k.rotation.y = yatay ? Math.PI / 2 : 0;
      }
    });
    evler(10, 21);
  } else if (tema === 'safranbolu') {
    evler(14, 5);
  } else if (tema === 'nemrut') {
    ekle(new THREE.Mesh(new THREE.ConeGeometry(9, 6, 7), mat('#4a3c2c')), sinirlar.cx, 2.6, uzak - 9);
    disNoktalar(5, 1.4, 4, 13).forEach(([x, z]) => nemrutBasi(x, 0, z, 0.55));
  }
}

function evler(adet, tohum) {
  disNoktalar(adet, 1.4, 5, tohum).forEach(([x, z], i) => {
    const g = new THREE.Group();
    const boy = 0.9 + (i % 3) * 0.45;
    const govde = new THREE.Mesh(new THREE.BoxGeometry(1.2, boy, 1), mat(R.kemik));
    govde.position.y = boy / 2;
    g.add(govde);
    const cati = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.6, 4), mat(R.ceviz));
    cati.position.y = boy + 0.3;
    cati.rotation.y = Math.PI / 4;
    g.add(cati);
    if (i % 2 === 0) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28), temel(R.sodyum));
      p.position.set(0, boy * 0.55, 0.51);
      g.add(p);
    }
    g.rotation.y = Math.round(x * 7) * 0.4;
    ekle(g, x, 0, z);
  });
}

// ---------- Top, iz, nişan çizgisi ----------
const top = new THREE.Mesh(new THREE.IcosahedronGeometry(F.TOP_R, 1), mat(R.krem));
sahne.add(top);
const topGolgesi = new THREE.Mesh(new THREE.PlaneGeometry(F.TOP_R * 3.2, F.TOP_R * 3.2),
  new THREE.MeshBasicMaterial({ map: golgeDokusu, transparent: true, depthWrite: false }));
topGolgesi.rotation.x = -Math.PI / 2;
sahne.add(topGolgesi);

const IZ_UZUNLUK = 26;
const izGeo = new THREE.BufferGeometry();
izGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(IZ_UZUNLUK * 3), 3));
const izMalzeme = new THREE.LineBasicMaterial({ color: R.sodyum, transparent: true, opacity: 0 });
const iz = new THREE.Line(izGeo, izMalzeme);
iz.frustumCulled = false;
sahne.add(iz);
let izNoktalari = [];

const nisanGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const nisan = new THREE.Line(nisanGeo, new THREE.LineDashedMaterial({ color: R.krem, dashSize: 0.14, gapSize: 0.1 }));
nisan.visible = false;
nisan.frustumCulled = false;
sahne.add(nisan);

// ---------- Delik yükleme ----------
function sinirHesapla() {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  D.veri.alan.forEach((r) => {
    x0 = Math.min(x0, r[0], r[2]); x1 = Math.max(x1, r[0], r[2]);
    z0 = Math.min(z0, r[1], r[3]); z1 = Math.max(z1, r[1], r[3]);
  });
  return { x0, z0, x1, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
}

function temizle(nesne) {
  nesne.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && !Object.values(malzemeler).includes(o.material)) o.material.dispose();
  });
}

let kamYaw = -Math.PI / 2;
let ustten = false;
let dusus = null; // deliğe düşme animasyonu

function delikYukle(no) {
  if (delikGrup) { sahne.remove(delikGrup); temizle(delikGrup); }
  delikNo = no;
  const veri = P.DELIKLER[no - 1];
  D = F.derle(veri);
  sinirlar = sinirHesapla();
  delikGrup = new THREE.Group();
  sahne.add(delikGrup);
  zeminKur();
  duvarlarKur();
  engellerKur();
  tehlikelerKur();
  delikVeBayrak();
  lambalarKur();
  sahneSusleri();
  durum = F.yeniDurum(D, 0);
  vurus = 0;
  biriken = 0;
  bitti = false;
  dusus = null;
  izNoktalari = [];
  top.scale.setScalar(1);
  kamYaw = veri.bakis != null ? veri.bakis : Math.atan2(D.delik[1] - D.tee[1], D.delik[0] - D.tee[0]);
  hudGuncelle();
  haritaCiz();
  topKonumla(0);
  kameraGuncelle(1, true);
  ilerleme.tur.delik = no;
  kaydet();
}

// ---------- HUD ----------
function hudGuncelle() {
  const v = D.veri;
  $('hud-delik').textContent = 'Delik ' + v.no + '/' + DELIK_SAYISI + ' · Par ' + v.par;
  $('hud-yer').textContent = v.ad;
  $('hud-vurus').textContent = vurus;
}

function haritaCiz() {
  const ol = $('harita');
  ol.innerHTML = '';
  P.DELIKLER.forEach((d) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'delik-karti';
    const acik = d.no <= ilerleme.acik;
    b.disabled = !acik;
    if (d.no === delikNo) b.setAttribute('aria-current', 'true');
    const enIyi = ilerleme.enIyi[d.no];
    b.innerHTML = '<span class="no"></span><span class="yer"></span><span class="bilgi"></span>';
    b.querySelector('.no').textContent = d.no;
    b.querySelector('.yer').textContent = d.ad;
    b.querySelector('.bilgi').textContent = 'Par ' + d.par + ' · ' + (acik ? 'En iyi ' + (enIyi || '–') : 'Kilitli');
    b.setAttribute('aria-label', d.no + '. delik, ' + d.ad + ', par ' + d.par + (acik ? (enIyi ? ', en iyi ' + enIyi : '') : ', kilitli'));
    b.addEventListener('click', () => {
      if (d.no === delikNo && !bitti) return;
      delete ilerleme.tur.skorlar[d.no];
      delikYukle(d.no);
    });
    li.append(b);
    ol.append(li);
  });
  const aktif = ol.querySelector('[aria-current="true"]');
  if (aktif && aktif.scrollIntoView) aktif.parentElement.parentElement.parentElement.scrollLeft = aktif.parentElement.offsetLeft - 16;
}

let cezaZamanlayici = null;
function cezaGoster(metin) {
  const e = $('ceza');
  e.textContent = metin;
  e.classList.add('goster');
  clearTimeout(cezaZamanlayici);
  cezaZamanlayici = setTimeout(() => e.classList.remove('goster'), 1500);
}

function kutlamaGoster(metin, damga) {
  const e = $('kutlama');
  e.textContent = metin;
  e.className = 'golf-kutlama' + (damga ? ' damga' : '');
  if (hareketAz()) { e.style.opacity = 1; setTimeout(() => { e.style.opacity = 0; }, 1400); return; }
  e.style.opacity = '';
  void e.offsetWidth;
  e.classList.add('goster');
}

// ---------- Ses (WebAudio ile üretilir, dosya yok) ----------
let ses = null;
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
function ton(frekans, sure, hacim, tip, bitis) {
  const s = sesHazirla();
  if (!s) return;
  const o = s.createOscillator();
  const g = s.createGain();
  o.type = tip || 'sine';
  o.frequency.setValueAtTime(frekans, s.currentTime);
  if (bitis) o.frequency.exponentialRampToValueAtTime(bitis, s.currentTime + sure);
  g.gain.setValueAtTime(hacim, s.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, s.currentTime + sure);
  o.connect(g).connect(s.destination);
  o.start();
  o.stop(s.currentTime + sure + 0.02);
}
function gurultu(sure, hacim, frekans) {
  const s = sesHazirla();
  if (!s) return;
  const n = Math.floor(s.sampleRate * sure);
  const b = s.createBuffer(1, n, s.sampleRate);
  const v = b.getChannelData(0);
  for (let i = 0; i < n; i++) v[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const kaynak = s.createBufferSource();
  kaynak.buffer = b;
  const f = s.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = frekans;
  const g = s.createGain();
  g.gain.value = hacim;
  kaynak.connect(f).connect(g).connect(s.destination);
  kaynak.start();
}
const sesler = {
  vurus: (guc) => { ton(1250, 0.06, 0.12 + guc * 0.15, 'triangle', 600); gurultu(0.04, 0.15, 3000); },
  sekme: (guc) => ton(380, 0.07, 0.04 + guc * 0.2, 'triangle', 220),
  delik: () => { ton(520, 0.08, 0.15, 'triangle', 300); setTimeout(() => ton(420, 0.08, 0.12, 'triangle', 250), 90); setTimeout(() => { ton(880, 0.35, 0.08); ton(1320, 0.45, 0.05); }, 220); },
  su: () => gurultu(0.45, 0.35, 700)
};

// ---------- Kamera ----------
const kamHedef = new THREE.Vector3();
const kamKonum = new THREE.Vector3();
let nisanGuc = 0;

function kameraGuncelle(dt, aninda) {
  const bx = top.position.x, by = top.position.y, bz = top.position.z;
  let hedefKonum, hedefBakis;
  if (ustten) {
    const gen = sinirlar.x1 - sinirlar.x0 + 2, der = sinirlar.z1 - sinirlar.z0 + 2;
    const tan = Math.tan(THREE.MathUtils.degToRad(kamera.fov / 2));
    const yukseklik = Math.max(der / 2 / tan, gen / 2 / (tan * kamera.aspect)) * 0.95;
    hedefBakis = new THREE.Vector3(sinirlar.cx, 0, sinirlar.cz);
    hedefKonum = new THREE.Vector3(sinirlar.cx, yukseklik, sinirlar.cz + yukseklik * 0.32);
  } else {
    const uzak = 2.9 + nisanGuc * 1.2;
    const lx = Math.cos(kamYaw), lz = Math.sin(kamYaw);
    hedefKonum = new THREE.Vector3(bx - lx * uzak, by + uzak * 0.6, bz - lz * uzak);
    hedefBakis = new THREE.Vector3(bx + lx * 2.6, by, bz + lz * 2.6);
  }
  const k = aninda ? 1 : 1 - Math.exp(-dt * 4.5);
  kamKonum.lerp(hedefKonum, k);
  kamHedef.lerp(hedefBakis, k);
  if (aninda) { kamKonum.copy(hedefKonum); kamHedef.copy(hedefBakis); }
  kamera.position.copy(kamKonum);
  kamera.lookAt(kamHedef);
}

function boyutlandir() {
  const en = kap.clientWidth || 1, boy = kap.clientHeight || 1;
  renderer.setSize(en, boy, false);
  kamera.aspect = en / boy;
  kamera.fov = kamera.aspect < 0.8 ? 58 : 48;
  kamera.updateProjectionMatrix();
}
new ResizeObserver(boyutlandir).observe(kap);

// ---------- Top görseli ----------
const _eksen = new THREE.Vector3();
function topKonumla(dt) {
  const x = durum.x, z = durum.z;
  const h = F.yukseklik(D, x, z);
  if (dusus) {
    const t = Math.min(1, (performance.now() - dusus.t0) / 260);
    top.position.set(x + (D.delik[0] - x) * t, h + F.TOP_R - t * 0.2, z + (D.delik[1] - z) * t);
    top.scale.setScalar(1 - t * 0.4);
  } else {
    top.position.set(x, h + F.TOP_R, z);
    const hiz = Math.hypot(durum.vx - (durum.platformVx || 0), durum.vz);
    if (hiz > 0.01 && dt > 0) {
      _eksen.set(durum.vz, 0, -(durum.vx - (durum.platformVx || 0))).normalize();
      top.rotateOnWorldAxis(_eksen, hiz * dt / F.TOP_R);
    }
  }
  topGolgesi.position.set(x + 0.03, h + 0.012, z + 0.03);
  topGolgesi.visible = !dusus;
}

function izGuncelle(dt) {
  if (durum.hareket && Math.hypot(durum.vx, durum.vz) > 0.6) {
    izNoktalari.push(top.position.clone());
    if (izNoktalari.length > IZ_UZUNLUK) izNoktalari.shift();
    izMalzeme.opacity = Math.min(0.75, izMalzeme.opacity + dt * 4);
  } else {
    izMalzeme.opacity = Math.max(0, izMalzeme.opacity - dt * 2.5);
    if (izMalzeme.opacity === 0) izNoktalari = [];
  }
  const p = izGeo.attributes.position;
  for (let i = 0; i < IZ_UZUNLUK; i++) {
    const n = izNoktalari[Math.min(i, izNoktalari.length - 1)] || top.position;
    p.setXYZ(i, n.x, n.y - F.TOP_R * 0.6, n.z);
  }
  p.needsUpdate = true;
  izGeo.setDrawRange(0, Math.max(0, izNoktalari.length));
}

// ---------- Vuruş girdisi ----------
const isaretciler = new Map();
let nisanAl = null; // { id }
let kamCevir = null; // { x }
const isin = new THREE.Raycaster();
const duzlem = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _v = new THREE.Vector3();

function ekranda(v) {
  const r = canvas.getBoundingClientRect();
  const p = v.clone().project(kamera);
  return { x: (p.x + 1) / 2 * r.width, y: (1 - p.y) / 2 * r.height };
}

function vurabilir() { return !durum.hareket && !durum.dustu && !bitti; }

function nisanHesapla(e) {
  const r = canvas.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  const topEkran = ekranda(top.position);
  const cekX = px - topEkran.x, cekY = py - topEkran.y;
  const uz = Math.hypot(cekX, cekY);
  const guc = Math.min(1, uz / (Math.min(r.width, r.height) * 0.32));
  // Parmağın zemindeki karşılığından topa doğru yön (top yüksekliğindeki düzlemde).
  isin.setFromCamera(new THREE.Vector2(px / r.width * 2 - 1, -(py / r.height) * 2 + 1), kamera);
  duzlem.constant = -top.position.y;
  let dx, dz;
  const vurdu = isin.ray.intersectPlane(duzlem, _v);
  if (vurdu && _v.distanceTo(top.position) > 0.02 && _v.distanceTo(kamera.position) < 60) {
    dx = top.position.x - _v.x; dz = top.position.z - _v.z;
  } else {
    const ileri = new THREE.Vector3().subVectors(kamHedef, kamera.position).setY(0).normalize();
    const sag = new THREE.Vector3(-ileri.z, 0, ileri.x);
    dx = -(cekX * sag.x - cekY * ileri.x); dz = -(cekX * sag.z - cekY * ileri.z);
  }
  const l = Math.hypot(dx, dz) || 1;
  return { yx: dx / l, yz: dz / l, guc, topEkran };
}

function nisanGoster(n) {
  const boy = 0.5 + n.guc * 3.2;
  const p = nisanGeo.attributes.position;
  p.setXYZ(0, top.position.x, top.position.y - F.TOP_R * 0.5, top.position.z);
  p.setXYZ(1, top.position.x + n.yx * boy, top.position.y - F.TOP_R * 0.5, top.position.z + n.yz * boy);
  p.needsUpdate = true;
  nisan.computeLineDistances();
  nisan.visible = true;
  const g = $('guc');
  g.hidden = false;
  const sol = Math.min(kap.clientWidth - 20, n.topEkran.x + 44);
  g.style.left = sol + 'px';
  g.style.top = Math.max(60, n.topEkran.y - 30) + 'px';
  $('guc-dolgu').style.height = (n.guc * 100) + '%';
  nisanGuc = n.guc;
}

function nisanGizle() {
  nisan.visible = false;
  $('guc').hidden = true;
  nisanGuc = 0;
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  isaretciler.set(e.pointerId, { x: e.clientX, y: e.clientY });
  sesHazirla();
  if (isaretciler.size > 1) {
    // İki parmak: nişanı bırak, kamerayı döndür.
    if (nisanAl) { nisanAl = null; nisanGizle(); }
    kamCevir = { orta: ortaNokta() };
    return;
  }
  const r = canvas.getBoundingClientRect();
  const topEkran = ekranda(top.position);
  const uz = Math.hypot(e.clientX - r.left - topEkran.x, e.clientY - r.top - topEkran.y);
  if (vurabilir() && uz < Math.max(64, Math.min(r.width, r.height) * 0.12)) {
    nisanAl = { id: e.pointerId };
  } else if (!ustten) {
    kamCevir = { orta: { x: e.clientX, y: e.clientY } };
  }
});

function ortaNokta() {
  let x = 0, y = 0;
  isaretciler.forEach((p) => { x += p.x; y += p.y; });
  return { x: x / isaretciler.size, y: y / isaretciler.size };
}

canvas.addEventListener('pointermove', (e) => {
  if (!isaretciler.has(e.pointerId)) return;
  isaretciler.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (nisanAl && nisanAl.id === e.pointerId) {
    const n = nisanHesapla(e);
    nisanAl.son = n;
    if (n.guc > 0.03) nisanGoster(n); else nisanGizle();
  } else if (kamCevir) {
    const o = isaretciler.size > 1 ? ortaNokta() : { x: e.clientX, y: e.clientY };
    kamYaw += (o.x - kamCevir.orta.x) * 0.008;
    kamCevir.orta = o;
  }
});

function birak(e) {
  if (!isaretciler.has(e.pointerId)) return;
  isaretciler.delete(e.pointerId);
  if (nisanAl && nisanAl.id === e.pointerId) {
    const n = nisanAl.son;
    nisanAl = null;
    nisanGizle();
    if (n && n.guc >= 0.05 && vurabilir() && e.type !== 'pointercancel') vurusYap(Math.atan2(n.yz, n.yx), n.guc);
  }
  if (isaretciler.size === 0) kamCevir = null;
  else if (kamCevir) kamCevir.orta = ortaNokta();
}
canvas.addEventListener('pointerup', birak);
canvas.addEventListener('pointercancel', birak);

function vurusYap(aci, guc) {
  F.vur(durum, aci, guc);
  vurus++;
  hudGuncelle();
  sesler.vurus(guc);
  kamYaw = aci;
  $('ipucu').classList.add('gizli');
}

// ---------- Olaylar ----------
function olaylariIsle() {
  const olaylar = durum.olaylar.splice(0);
  olaylar.forEach((o) => {
    if (o.tur === 'sekme') sesler.sekme(o.guc);
    else if (o.tur === 'ceza') {
      vurus++;
      hudGuncelle();
      cezaGoster('+1 ceza · suya düştü');
      sesler.su();
    } else if (o.tur === 'delik') {
      sesler.delik();
      dusus = { t0: performance.now() };
      delikBitti(vurus);
    } else if (o.tur === 'durdu') {
      if (vurus >= MAKS_VURUS) delikBitti(MAKS_VURUS, true);
    }
  });
}

function delikBitti(skor, kapandi) {
  if (bitti) return;
  bitti = true;
  const v = D.veri;
  if (kapandi) kutlamaGoster(MAKS_VURUS + ' vuruş · delik kapandı', false);
  else kutlamaGoster(F.skorAdi(skor, v.par), skor === 1);
  if (bayrak) bayrak.userData.salla = performance.now();
  ilerleme.tur.skorlar[v.no] = skor;
  if (!ilerleme.enIyi[v.no] || skor < ilerleme.enIyi[v.no]) ilerleme.enIyi[v.no] = skor;
  ilerleme.acik = Math.max(ilerleme.acik, Math.min(DELIK_SAYISI, v.no + 1));
  kaydet();
  Depo.ozetYaz('mini-golf', Object.keys(ilerleme.enIyi).length + '/' + DELIK_SAYISI + ' delik');
  haritaCiz();
  setTimeout(() => {
    if (v.no < DELIK_SAYISI) delikYukle(v.no + 1);
    else skorKartiGoster(true);
  }, hareketAz() ? 1000 : 1700);
}

// ---------- Skor kartı ----------
function skorKartiGoster(sonunda) {
  const skorlar = ilerleme.tur.skorlar;
  const kutu = $('kart-tablolar');
  kutu.innerHTML = '';
  [[1, 5], [6, 9]].forEach(([a, b]) => {
    const tablo = document.createElement('table');
    tablo.className = 'skor-tablo';
    const satir = (baslik, hucre, th) => {
      const tr = document.createElement('tr');
      const ilk = document.createElement('th');
      ilk.scope = th ? 'col' : 'row';
      ilk.textContent = baslik;
      tr.append(ilk);
      for (let n = a; n <= b; n++) {
        const c = document.createElement(th ? 'th' : 'td');
        if (th) c.scope = 'col';
        hucre(c, n);
        tr.append(c);
      }
      return tr;
    };
    const thead = document.createElement('thead');
    thead.append(satir('Delik', (c, n) => { c.textContent = n; }, true));
    const tbody = document.createElement('tbody');
    tbody.append(satir('Par', (c, n) => { c.textContent = P.DELIKLER[n - 1].par; }));
    tbody.append(satir('Vuruş', (c, n) => {
      const s = skorlar[n];
      c.textContent = s == null ? '–' : s;
      if (s != null) c.className = s < P.DELIKLER[n - 1].par ? 'alti' : s > P.DELIKLER[n - 1].par ? 'ustu' : '';
    }));
    tablo.append(thead, tbody);
    kutu.append(tablo);
  });
  const oynanan = P.DELIKLER.filter((d) => skorlar[d.no] != null);
  const toplam = oynanan.reduce((t, d) => t + skorlar[d.no], 0);
  const parToplam = oynanan.reduce((t, d) => t + d.par, 0);
  const fark = toplam - parToplam;
  const ozet = document.createElement('div');
  ozet.className = 'skor-toplam';
  const tamam = oynanan.length === DELIK_SAYISI;
  let rekor = false;
  if (tamam && sonunda) {
    rekor = ilerleme.enIyiToplam == null || toplam < ilerleme.enIyiToplam;
    if (rekor) { ilerleme.enIyiToplam = toplam; kaydet(); }
  }
  ozet.innerHTML = '<span>Toplam <span class="fark"></span></span><strong></strong>';
  ozet.querySelector('strong').textContent = oynanan.length ? toplam : '–';
  ozet.querySelector('.fark').textContent = oynanan.length ? '(' + (fark > 0 ? '+' : fark < 0 ? '−' : '±') + Math.abs(fark) + ')' : '';
  if (rekor) {
    const d = document.createElement('span');
    d.className = 'rekor-damga';
    d.textContent = 'Rekor';
    ozet.firstChild.append(d);
  }
  kutu.append(ozet);
  $('kart-baslik').textContent = sonunda ? 'Parkur bitti!' : 'Skor kartı';
  $('kart-not').textContent = ilerleme.enIyiToplam != null ? 'En iyi 9 delik: ' + ilerleme.enIyiToplam + ' vuruş.' : (tamam ? '' : 'Dokuz deliği bitirince toplam rekorun kaydedilir.');
  const d = $('skor-karti');
  if (!d.open) d.showModal();
}

// ---------- Düğmeler ----------
$('kamera').addEventListener('click', () => {
  ustten = !ustten;
  $('kamera').setAttribute('aria-pressed', String(ustten));
  $('kamera').setAttribute('aria-label', ustten ? 'Topu takip et' : 'Üstten görünüm');
});
function sesDugmesi() {
  $('ses').setAttribute('aria-pressed', String(sesAcik));
  $('ses').setAttribute('aria-label', sesAcik ? 'Sesi kapat' : 'Sesi aç');
}
$('ses').addEventListener('click', () => {
  sesAcik = !sesAcik;
  Depo.yaz('golf:ses', sesAcik);
  sesDugmesi();
  if (sesAcik) sesHazirla();
});
$('menu').addEventListener('click', () => $('menu-dialog').showModal());
$('delik-bastan').addEventListener('click', () => {
  $('menu-dialog').close();
  delete ilerleme.tur.skorlar[delikNo];
  delikYukle(delikNo);
});
$('kart-ac').addEventListener('click', () => { $('menu-dialog').close(); skorKartiGoster(false); });
function turBastan() {
  ilerleme.tur = { delik: 1, skorlar: {} };
  kaydet();
  delikYukle(1);
}
$('tur-bastan').addEventListener('click', () => { $('menu-dialog').close(); turBastan(); });
$('yeniden').addEventListener('click', () => { $('skor-karti').close(); turBastan(); });
$('haritaya').addEventListener('click', () => {
  $('skor-karti').close();
  document.querySelector('.parkur-haritasi').scrollIntoView({ behavior: hareketAz() ? 'auto' : 'smooth', block: 'center' });
});

// ---------- Döngü ----------
let onceki = performance.now();
let atla = false;
function dongu(simdi) {
  kalite.kare(simdi);
  const dt = Math.min(0.1, (simdi - onceki) / 1000);
  onceki = simdi;
  if (D) {
    biriken = F.ilerlet(D, durum, biriken, dt);
    olaylariIsle();
    const t = durum.t * F.DT;
    D.kapilar.forEach((k, i) => { kapiMeshleri[i].rotation.y = -F.kapiDurumu(k, durum.t).aci; });
    D.vapurlar.forEach((v, i) => {
      const vd = F.vapurDurumu(v, durum.t);
      vapurMeshleri[i].position.x = vd.x;
      vapurMeshleri[i].position.y = Math.sin(t * 2.1) * 0.012;
    });
    if (!hareketAz()) balonlar.forEach((b, i) => { b.position.y += Math.sin(t * 0.6 + i * 2) * 0.002; });
    if (bayrak) {
      const s = bayrak.userData.salla;
      const bez = bayrak.userData.bez;
      if (s && !hareketAz()) {
        const g = (simdi - s) / 1000;
        bez.rotation.y = g < 1.2 ? Math.sin(g * 18) * 0.5 * (1 - g / 1.2) : 0;
      } else bez.rotation.y = Math.sin(t * 1.3) * 0.08;
    }
    topKonumla(dt);
    izGuncelle(dt);
    kameraGuncelle(dt, false);
  }
  // Top durgunken sahnede yalnızca süs hareketi var (bayrak, vapur, balon): 30 fps yeter, maliyet yarıya iner.
  atla = !!durum && !durum.hareket && !nisanAl ? !atla : false;
  if (!atla) renderer.render(sahne, kamera);
  requestAnimationFrame(dongu);
}

// ---------- Başlangıç ----------
sesDugmesi();
Kalite.dugmeEkle($('ses'), kalite);
boyutlandir();
const baslangic = Math.min(Math.max(1, ilerleme.tur.delik || 1), ilerleme.acik, DELIK_SAYISI);
delikYukle(baslangic);
if (ilerleme.tur && Object.keys(ilerleme.tur.skorlar).length) $('ipucu').classList.add('gizli');
requestAnimationFrame(dongu);

// Test ve hata ayıklama için küçük bir pencere.
window.__golf = {
  durum: () => durum, delik: () => delikNo, vurus: () => vurus, bitti: () => bitti,
  vur: (aci, guc) => { if (vurabilir()) vurusYap(aci, guc); },
  yukle: (no) => delikYukle(no)
};
