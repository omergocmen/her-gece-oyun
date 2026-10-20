// Marmaray Koşusu: three.js sahnesi (tünel ve Boğaz modülleri, trenler, engeller, jetonlar, karakterler, efektler).
// Oyun kuralları mantik.js'tedir; bu dosya yalnızca çizer. Renkler yalnızca DESIGN.md paletinden.
// Koordinat: oyuncu hep z = 0'dadır, dünya ona doğru akar. Şerit l → x = l * SERIT, ray üstü y = 0, ileri -z.
// Bellek sabit kalsın diye her şey havuzdan gelir: kare içinde yeni nesne, geometri ya da malzeme yaratılmaz.
import * as THREE from '../../assets/vendor/three/three.module.min.js';

export const RENK = {
  murekkep: 0x110f0d, kagit: 0x1b1815, kagit2: 0x26211c, cizgi: 0x3b332b,
  krem: 0xf3ead8, soluk: 0xb4a78f, sodyum: 0xffb23f, sodyumKoyu: 0x1d1307,
  sodyumGolge: 0xb8741a, sodyumAcik: 0xffc266, kor: 0xff6a48, yaprak: 0x368549,
  tasKoyu: 0x2e2822, tasAcik: 0xa89c88, ay: 0x9db4ff,
  iznik: 0x2f6fb0, turkuaz: 0x2aa198, ceviz: 0x5a3b24, kemik: 0xe9dcc2, cim: 0x2c5a3a, kum: 0xc9a46a
};

const SERIT = 2.4;
const MODUL = 6;
const MODUL_SAYISI = 24;      // 2 arkada + 22 önde ≈ 132 m
const GERI_MODUL = 2;
const TUNEL_YARI = 5.2;       // tünel iç yarı genişliği
const TAVAN = 6.1;
const VAGON = 15;
const VAGON_ARA = 0;   // vagonlar arka arkaya; gövde boyu VAGON - 0.4 olduğu için arada körük boşluğu görünür
const TREN_HAVUZU = 8;
const JETON_HAVUZU = 120;
const PARCACIK = 260;

function karistir(a, b, oran) { return new THREE.Color(a).lerp(new THREE.Color(b), oran).getHex(); }
const DUVAR = karistir(RENK.murekkep, RENK.kagit2, 0.75);
const BETON = karistir(RENK.kagit2, RENK.tasAcik, 0.22);
const SU_RENGI = karistir(RENK.murekkep, RENK.iznik, 0.3);
const TEPE = karistir(RENK.kagit, RENK.cim, 0.35);

function rnd(tohum) {
  let a = tohum >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Voksel geometri: kutuları tek tampon geometride birleştirir ----------
const BIRIM = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const _mat = new THREE.Matrix4(), _nm = new THREE.Matrix3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _v = new THREE.Vector3(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();

// k(w, h, d, x, y, z, renk, [dönüş x], [dönüş z]) → tek kutu
function k(w, h, d, x, y, z, renk, rx, rz) { return { b: [w, h, d], p: [x, y, z], r: renk, rx: rx || 0, rz: rz || 0 }; }

function birlestir(parcalar) {
  const n = BIRIM.attributes.position.count;
  const poz = new Float32Array(parcalar.length * n * 3);
  const nor = new Float32Array(parcalar.length * n * 3);
  const renk = new Float32Array(parcalar.length * n * 3);
  const bp = BIRIM.attributes.position.array, bn = BIRIM.attributes.normal.array;
  parcalar.forEach((pr, i) => {
    _q.setFromEuler(_e.set(pr.rx, 0, pr.rz));
    _mat.compose(_p.set(pr.p[0], pr.p[1], pr.p[2]), _q, _s.set(pr.b[0], pr.b[1], pr.b[2]));
    _nm.getNormalMatrix(_mat);
    _c.setHex(pr.r);
    for (let j = 0; j < n; j++) {
      const o = (i * n + j) * 3;
      _v.set(bp[j * 3], bp[j * 3 + 1], bp[j * 3 + 2]).applyMatrix4(_mat);
      poz[o] = _v.x; poz[o + 1] = _v.y; poz[o + 2] = _v.z;
      _v.set(bn[j * 3], bn[j * 3 + 1], bn[j * 3 + 2]).applyMatrix3(_nm).normalize();
      nor[o] = _v.x; nor[o + 1] = _v.y; nor[o + 2] = _v.z;
      renk[o] = _c.r; renk[o + 1] = _c.g; renk[o + 2] = _c.b;
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(poz, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(renk, 3));
  g.computeBoundingSphere();
  return g;
}

// Toplanır ışık lekesi (lamba havuzu, far huzmesi): iç dikdörtgen parlak, dışa doğru söner.
// lekeler: [cx, cz, içX, içZ, dışX, dışZ, y, güç]
function isikLekesi(lekeler, renkHex) {
  const poz = [], renk = [];
  const r0 = new THREE.Color(renkHex);
  function dortgen(a, b, c, d, ra, rb, rc, rd) {
    for (const [v, r] of [[a, ra], [b, rb], [c, rc], [a, ra], [c, rc], [d, rd]]) {
      poz.push(v[0], v[1], v[2]);
      renk.push(r0.r * r, r0.g * r, r0.b * r);
    }
  }
  for (const [cx, cz, ix, iz, dx, dz, y, g] of lekeler) {
    const ic = [[cx - ix, y, cz - iz], [cx + ix, y, cz - iz], [cx + ix, y, cz + iz], [cx - ix, y, cz + iz]];
    const dis = [[cx - dx, y, cz - dz], [cx + dx, y, cz - dz], [cx + dx, y, cz + dz], [cx - dx, y, cz + dz]];
    dortgen(ic[0], ic[1], ic[2], ic[3], g, g, g, g);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; dortgen(ic[i], dis[i], dis[j], ic[j], g, 0, 0, g); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(renk, 3));
  geo.computeBoundingSphere();
  return geo;
}

// Yumuşak ışıma dokusu (far, güçlendirici parıltısı): beyaz merkez, siyah kenar (toplanır karışımda siyah = ışık yok).
function parlamaDokusu() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, '#ffffff'); g.addColorStop(0.4, '#5a5a5a'); g.addColorStop(1, '#000000');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Yazılı levha dokusu: tabela ("DİKKAT"), ×2 plakası, istasyon tabelası.
const YAZI_TIPI = '"Bricolage", ui-sans-serif, system-ui, sans-serif';
function yaziDokusu(en, boy, ciz) {
  const c = document.createElement('canvas');
  c.width = en; c.height = boy;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const yeniden = () => { ciz(c.getContext('2d'), en, boy); t.needsUpdate = true; };
  yeniden();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(yeniden).catch(() => {});
  return { doku: t, yeniden, tuval: c };
}
function hex(n) { return '#' + n.toString(16).padStart(6, '0'); }

// ---------- Modeller ----------
// Tren vagonu: +z ucunda sodyum farlar, -z ucunda kor stop lambaları. Merkez z = 0, alt y = 0.
function vagonTarifi() {
  const L = VAGON - 0.4, g = [], isik = [];
  g.push(k(1.7, 0.42, L - 0.6, 0, 0.42, 0, RENK.murekkep));
  for (const bz of [-L / 2 + 2.6, L / 2 - 2.6]) {
    g.push(k(1.9, 0.5, 2.6, 0, 0.32, bz, RENK.cizgi));
    for (const sx of [-1, 1]) for (const dz of [-0.75, 0.75]) g.push(k(0.12, 0.5, 0.5, sx * 0.72, 0.25, bz + dz, RENK.tasKoyu));
  }
  g.push(k(2.1, 2.45, L, 0, 1.85, 0, RENK.krem));
  g.push(k(2.13, 0.3, L + 0.02, 0, 1.12, 0, RENK.kor));
  g.push(k(2.13, 0.08, L + 0.02, 0, 0.7, 0, RENK.kor));
  g.push(k(2.12, 0.8, L - 1.2, 0, 2.3, 0, RENK.kagit2));
  g.push(k(1.86, 0.28, L - 0.2, 0, 3.18, 0, karistir(RENK.krem, RENK.soluk, 0.45)));
  g.push(k(1.0, 0.24, 2.4, 0, 3.42, -3.2, RENK.soluk), k(1.0, 0.24, 2.4, 0, 3.42, 3.2, RENK.soluk));
  // Kapılar (krem gövdede kemik panel, ortasında pencere)
  for (const dz of [-4.4, 0, 4.4]) g.push(k(2.14, 2.0, 1.3, 0, 1.68, dz, RENK.kemik));
  // Sıcak iç ışıklı pencereler
  for (const dz of [-6.0, -2.2, 2.2, 6.0]) isik.push(k(2.15, 0.56, 2.4, 0, 2.32, dz, RENK.sodyumAcik));
  for (const dz of [-4.4, 0, 4.4]) isik.push(k(2.16, 0.5, 0.6, 0, 2.3, dz, RENK.sodyumAcik));
  // Uç yüzler: ön cam, farlar ve stop lambaları
  for (const s of [1, -1]) {
    const z = s * (L / 2 + 0.02);
    g.push(k(1.7, 0.9, 0.06, 0, 2.35, z, RENK.murekkep));
    g.push(k(0.9, 0.12, 0.06, 0, 0.92, z, RENK.cizgi));
    g.push(k(2.0, 0.22, 0.12, 0, 0.55, z, RENK.cizgi));
    for (const sx of [-0.66, 0.66]) isik.push(k(0.36, 0.2, 0.08, sx, 1.02, z, s > 0 ? RENK.sodyumAcik : RENK.kor));
  }
  // Pantograf
  g.push(k(0.06, 0.5, 0.06, 0, 3.7, 1.2, RENK.cizgi, 0.6), k(0.06, 0.5, 0.06, 0, 3.7, 0.4, RENK.cizgi, -0.6), k(1.3, 0.05, 0.12, 0, 3.92, 0.8, RENK.cizgi));
  return { govde: g, isik };
}

// Bariyer: kor-krem çizgili pano, iki ayak, üstte küçük sodyum lamba. Merkez şerit ortası.
function bariyerTarifi() {
  const g = [], isik = [];
  for (const sx of [-0.88, 0.88]) {
    g.push(k(0.12, 0.92, 0.12, sx, 0.46, 0, RENK.cizgi));
    g.push(k(0.5, 0.06, 0.5, sx, 0.03, 0, RENK.cizgi));
  }
  for (let i = 0; i < 6; i++) {
    const renk = i % 2 ? RENK.krem : RENK.kor;
    g.push(k(0.34, 0.34, 0.1, -0.85 + 0.34 * i, 0.7, 0, renk));
    g.push(k(0.34, 0.16, 0.1, -0.85 + 0.34 * i, 0.32, 0, i % 2 ? RENK.kor : RENK.krem));
  }
  isik.push(k(0.16, 0.12, 0.16, -0.88, 0.98, 0, RENK.sodyum), k(0.16, 0.12, 0.16, 0.88, 0.98, 0, RENK.sodyum));
  return { govde: g, isik };
}
function tabelaDirekTarifi() {
  return { govde: [
    k(0.12, 2.75, 0.12, -1.06, 1.37, 0, RENK.cizgi), k(0.12, 2.75, 0.12, 1.06, 1.37, 0, RENK.cizgi),
    k(2.3, 0.1, 0.12, 0, 2.72, 0, RENK.cizgi), k(2.06, 0.8, 0.06, 0, 1.76, 0.05, RENK.murekkep)
  ] };
}

// Tünel modülü: duvarlar, servis yolu, kaburgalar, tavan; tavan ortasında lamba şeridi.
function tunelTarifi() {
  const g = [], isik = [];
  for (const s of [-1, 1]) {
    g.push(k(0.6, 6.4, MODUL, s * (TUNEL_YARI + 0.3), 3.0, 0, DUVAR));
    g.push(k(0.9, 0.55, MODUL, s * (TUNEL_YARI - 0.45), 0.02, 0, BETON));
    g.push(k(0.92, 0.05, MODUL, s * (TUNEL_YARI - 0.45), 0.31, 0, karistir(BETON, RENK.krem, 0.15)));
    g.push(k(0.14, 0.12, MODUL, s * (TUNEL_YARI - 0.07), 3.3, 0, RENK.cizgi));
    g.push(k(0.14, 0.12, MODUL, s * (TUNEL_YARI - 0.07), 3.0, 0, RENK.cizgi));
    // Kaburga ve köşe pahları
    g.push(k(0.42, 6.4, 0.55, s * (TUNEL_YARI - 0.12), 3.0, -MODUL / 2 + 0.3, RENK.cizgi));
    g.push(k(1.4, 0.9, MODUL, s * (TUNEL_YARI - 0.5), TAVAN - 0.3, 0, DUVAR, 0, s * 0.55));
    isik.push(k(0.05, 0.16, 0.24, s * (TUNEL_YARI - 0.01), 1.05, 1.2, RENK.sodyum));
  }
  g.push(k(TUNEL_YARI * 2 + 1, 0.4, MODUL, 0, TAVAN + 0.2, 0, DUVAR));
  g.push(k(TUNEL_YARI * 2, 0.4, 0.55, 0, TAVAN - 0.1, -MODUL / 2 + 0.3, RENK.cizgi));
  g.push(k(0.6, 0.14, 2.9, 0, TAVAN - 0.07, 0.6, RENK.kagit2));
  isik.push(k(0.36, 0.06, 2.6, 0, TAVAN - 0.16, 0.6, RENK.sodyumAcik));
  return { govde: g, isik, leke: isikLekesi([[0, 0.6, 1.4, 1.2, 5.2, 4.2, 0.012, 0.55]], RENK.sodyum) };
}

// Açık (Boğaz) modülü: korkuluk, dolgu şevi, katener direği ve sodyum lamba.
function acikTarifi() {
  const g = [], isik = [];
  for (const s of [-1, 1]) {
    g.push(k(0.32, 0.8, MODUL, s * (TUNEL_YARI - 0.2), 0.4, 0, BETON));
    g.push(k(0.4, 0.08, MODUL, s * (TUNEL_YARI - 0.2), 0.82, 0, karistir(BETON, RENK.krem, 0.2)));
    g.push(k(2.2, 1.6, MODUL, s * (TUNEL_YARI + 0.9), -0.85, 0, RENK.tasKoyu, 0, s * 0.5));
    g.push(k(0.18, 5.6, 0.18, s * (TUNEL_YARI - 0.25), 2.8, -1.5, RENK.cizgi));
    g.push(k(1.9, 0.1, 0.1, s * (TUNEL_YARI - 1.1), 5.5, -1.5, RENK.cizgi));
    g.push(k(0.6, 0.16, 0.34, s * (TUNEL_YARI - 1.9), 5.45, -1.5, RENK.cizgi));
    isik.push(k(0.44, 0.05, 0.24, s * (TUNEL_YARI - 1.9), 5.36, -1.5, RENK.sodyumAcik));
  }
  return { govde: g, isik, leke: isikLekesi([[-3.3, -1.5, 0.8, 0.8, 3.6, 3.4, 0.012, 0.42], [3.3, -1.5, 0.8, 0.8, 3.6, 3.4, 0.012, 0.42]], RENK.sodyum) };
}

// Traversler: her modülde üç şerit için.
function traversTarifi() {
  const g = [];
  for (const l of [-1, 0, 1]) for (let i = 0; i < 8; i++) g.push(k(1.9, 0.12, 0.26, l * SERIT, -0.13, -MODUL / 2 + 0.375 + i * 0.75, RENK.kagit2));
  return { govde: g };
}

// Tünel ağzı: kalın beton duvar, ray açıklığı, üstte istasyon tabelası, tepede toprak. Ön yüz z = 0, duvar -z yönüne.
function portalTarifi() {
  const g = [], isik = [];
  const D = 1.6, Y = 16;
  for (const s of [-1, 1]) {
    g.push(k(30, Y, D, s * (TUNEL_YARI + 15), Y / 2 - 1.5, -D / 2, BETON));
    g.push(k(0.5, TAVAN + 0.8, 0.3, s * (TUNEL_YARI + 0.25), (TAVAN + 0.8) / 2 - 0.4, 0.1, RENK.cizgi));
    isik.push(k(0.3, 0.3, 0.1, s * (TUNEL_YARI + 1.4), TAVAN + 1.1, 0.06, RENK.sodyumAcik));
  }
  g.push(k(TUNEL_YARI * 2 + 0.6, Y - TAVAN - 1.5, D, 0, TAVAN + (Y - TAVAN - 1.5) / 2, -D / 2, BETON));
  g.push(k(TUNEL_YARI * 2 + 1, 0.4, 0.3, 0, TAVAN + 0.2, 0.1, RENK.cizgi));
  g.push(k(80, 0.5, D + 0.4, 0, Y - 1.3, -D / 2, karistir(BETON, RENK.krem, 0.12)));
  g.push(k(90, 8, 40, 0, Y + 1.5, -D - 20, TEPE));
  g.push(k(40, 5, 30, -18, Y + 6, -D - 26, karistir(TEPE, RENK.murekkep, 0.3)));
  return { govde: g, isik };
}

// Karakterler: gövde + iki bacak + iki kol (kanat/ön ayak). Uzuvların pivotu kalça/omuz; -z'ye bakar.
const KARAKTER_TARIF = {
  marti: () => ({
    olcek: 1.55,
    govde: [
      k(0.36, 0.34, 0.52, 0, 0.42, 0.02, RENK.krem),
      k(0.28, 0.26, 0.28, 0, 0.7, -0.14, RENK.krem),
      k(0.1, 0.07, 0.18, 0, 0.67, -0.36, RENK.sodyum), k(0.04, 0.04, 0.04, 0, 0.64, -0.43, RENK.kor),
      k(0.05, 0.05, 0.01, -0.09, 0.74, -0.285, RENK.murekkep), k(0.05, 0.05, 0.01, 0.09, 0.74, -0.285, RENK.murekkep),
      k(0.24, 0.07, 0.2, 0, 0.42, 0.34, RENK.soluk), k(0.2, 0.06, 0.1, 0, 0.44, 0.45, RENK.murekkep)
    ],
    bacak: { pivot: [0.09, 0.28, 0.04], parca: [k(0.06, 0.26, 0.06, 0, -0.13, 0, RENK.sodyum), k(0.12, 0.03, 0.16, 0, -0.27, -0.04, RENK.sodyum)] },
    kol: { pivot: [0.2, 0.52, 0.02], parca: [k(0.07, 0.24, 0.44, 0.02, -0.08, 0.06, RENK.soluk), k(0.075, 0.1, 0.14, 0.02, -0.14, 0.26, RENK.murekkep)] }
  }),
  kedi: () => ({
    olcek: 1.6,
    govde: [
      k(0.34, 0.26, 0.5, 0, 0.36, 0.02, RENK.sodyum),
      k(0.35, 0.27, 0.05, 0, 0.36, -0.04, RENK.sodyumGolge), k(0.35, 0.27, 0.05, 0, 0.36, 0.14, RENK.sodyumGolge),
      k(0.32, 0.28, 0.28, 0, 0.6, -0.26, RENK.sodyum),
      k(0.33, 0.04, 0.29, 0, 0.69, -0.26, RENK.sodyumGolge),
      k(0.08, 0.1, 0.06, -0.1, 0.79, -0.26, RENK.sodyum), k(0.08, 0.1, 0.06, 0.1, 0.79, -0.26, RENK.sodyum),
      k(0.05, 0.03, 0.02, 0, 0.56, -0.405, RENK.kor),
      k(0.08, 0.08, 0.36, 0, 0.5, 0.42, RENK.sodyum, 0.7), k(0.085, 0.085, 0.12, 0, 0.66, 0.56, RENK.sodyumGolge, 0.7)
    ],
    isik: [k(0.06, 0.06, 0.01, -0.08, 0.63, -0.405, RENK.yaprak), k(0.06, 0.06, 0.01, 0.08, 0.63, -0.405, RENK.yaprak)],
    bacak: { pivot: [0.1, 0.26, 0.2], parca: [k(0.09, 0.26, 0.1, 0, -0.13, 0, RENK.sodyum)] },
    kol: { pivot: [0.11, 0.3, -0.14], parca: [k(0.09, 0.3, 0.1, 0, -0.15, 0, RENK.sodyum)] }
  }),
  hamal: () => ({
    olcek: 1.3,
    govde: [
      k(0.44, 0.4, 0.3, 0, 0.66, 0, RENK.kemik),
      k(0.45, 0.16, 0.31, 0, 0.74, 0, RENK.cizgi),
      k(0.46, 0.1, 0.32, 0, 0.5, 0, RENK.ceviz),
      k(0.32, 0.28, 0.3, 0, 1.0, -0.02, RENK.kum),
      k(0.18, 0.04, 0.02, 0, 0.94, -0.175, RENK.murekkep),
      k(0.06, 0.06, 0.01, -0.08, 1.03, -0.175, RENK.murekkep), k(0.06, 0.06, 0.01, 0.08, 1.03, -0.175, RENK.murekkep),
      k(0.34, 0.09, 0.32, 0, 1.16, -0.02, RENK.cizgi),
      k(0.5, 0.48, 0.16, 0, 0.78, 0.22, RENK.kum),
      k(0.56, 0.4, 0.42, 0, 1.18, 0.32, RENK.ceviz),
      k(0.58, 0.05, 0.44, 0, 1.18, 0.32, RENK.kum),
      k(0.4, 0.28, 0.34, 0.03, 1.5, 0.32, RENK.kemik)
    ],
    bacak: { pivot: [0.11, 0.46, 0], parca: [k(0.15, 0.44, 0.17, 0, -0.22, 0, RENK.ceviz), k(0.16, 0.06, 0.24, 0, -0.43, -0.03, RENK.murekkep)] },
    kol: { pivot: [0.28, 0.82, 0], parca: [k(0.1, 0.34, 0.13, 0, -0.16, 0, RENK.kemik), k(0.1, 0.08, 0.12, 0, -0.36, 0, RENK.kum)] }
  }),
  kaykay: () => ({
    olcek: 1.3,
    kaykay: true,
    govde: [
      k(0.42, 0.38, 0.28, 0, 0.82, 0, RENK.iznik),
      k(0.43, 0.08, 0.29, 0, 0.66, 0, RENK.cizgi),
      k(0.3, 0.28, 0.28, 0, 1.15, -0.02, RENK.kum),
      k(0.06, 0.06, 0.01, -0.07, 1.18, -0.165, RENK.murekkep), k(0.06, 0.06, 0.01, 0.07, 1.18, -0.165, RENK.murekkep),
      k(0.34, 0.1, 0.34, 0, 1.33, 0, RENK.kor), k(0.3, 0.04, 0.16, 0, 1.3, -0.22, RENK.kor),
      // Kaykay
      k(0.36, 0.05, 1.0, 0, 0.11, 0, RENK.ceviz), k(0.37, 0.02, 1.01, 0, 0.14, 0, RENK.murekkep),
      k(0.36, 0.04, 0.16, 0, 0.14, -0.55, RENK.ceviz, -0.4), k(0.36, 0.04, 0.16, 0, 0.14, 0.55, RENK.ceviz, 0.4),
      k(0.3, 0.06, 0.06, 0, 0.06, -0.34, RENK.cizgi), k(0.3, 0.06, 0.06, 0, 0.06, 0.34, RENK.cizgi)
    ],
    isik: [k(0.08, 0.08, 0.08, -0.16, 0.04, -0.34, RENK.sodyumAcik), k(0.08, 0.08, 0.08, 0.16, 0.04, -0.34, RENK.sodyumAcik),
      k(0.08, 0.08, 0.08, -0.16, 0.04, 0.34, RENK.sodyumAcik), k(0.08, 0.08, 0.08, 0.16, 0.04, 0.34, RENK.sodyumAcik)],
    bacak: { pivot: [0.12, 0.62, 0], parca: [k(0.15, 0.46, 0.17, 0, -0.23, 0, RENK.cizgi), k(0.16, 0.06, 0.26, 0, -0.46, -0.04, RENK.krem)] },
    kol: { pivot: [0.27, 0.98, 0], parca: [k(0.1, 0.34, 0.13, 0, -0.16, 0, RENK.iznik), k(0.1, 0.08, 0.12, 0, -0.36, 0, RENK.kum)] }
  })
};

// Güçlendirici modelleri (merkez y = 0)
const GUC_TARIF = {
  miknatis: () => ({ govde: [
    k(0.2, 0.62, 0.2, -0.28, 0.06, 0, RENK.kor), k(0.2, 0.62, 0.2, 0.28, 0.06, 0, RENK.kor),
    k(0.76, 0.2, 0.2, 0, -0.32, 0, RENK.kor),
    k(0.22, 0.18, 0.22, -0.28, 0.44, 0, RENK.krem), k(0.22, 0.18, 0.22, 0.28, 0.44, 0, RENK.krem)
  ] }),
  jetpack: () => ({ govde: [
    k(0.24, 0.62, 0.24, -0.16, 0.05, 0, RENK.krem), k(0.24, 0.62, 0.24, 0.16, 0.05, 0, RENK.krem),
    k(0.2, 0.1, 0.2, -0.16, 0.4, 0, RENK.kor), k(0.2, 0.1, 0.2, 0.16, 0.4, 0, RENK.kor),
    k(0.56, 0.1, 0.28, 0, 0.12, 0, RENK.cizgi), k(0.14, 0.12, 0.14, -0.16, -0.32, 0, RENK.cizgi), k(0.14, 0.12, 0.14, 0.16, -0.32, 0, RENK.cizgi)
  ], isik: [k(0.1, 0.06, 0.1, -0.16, -0.4, 0, RENK.sodyumAcik), k(0.1, 0.06, 0.1, 0.16, -0.4, 0, RENK.sodyumAcik)] }),
  x2: () => ({ govde: [k(0.86, 0.62, 0.08, 0, 0, 0, RENK.sodyumGolge)] })
};

// ---------- Sahne ----------
export function sahneOlustur(tuval, ayar) {
  const hareketAz = !!ayar.hareketAz;
  const renderer = new THREE.WebGLRenderer({ canvas: tuval, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(RENK.murekkep, 1);
  let pikselOrani = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pikselOrani);

  const sahne = new THREE.Scene();
  const SIS_SON = ayar.gorus || 95;
  sahne.fog = new THREE.Fog(RENK.murekkep, 16, SIS_SON);

  // Ortak malzemeler
  const M = {
    govde: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    isik: new THREE.MeshBasicMaterial({ vertexColors: true }),
    leke: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    golge: new THREE.MeshBasicMaterial({ color: RENK.murekkep, transparent: true, opacity: 0.5, depthWrite: false })
  };
  const parlama = parlamaDokusu();

  // Işık: sıcak sodyum ana ışık, soğuk ay dolgu ışığı, düşük ortam; lambalarla yürüyen noktasal ışıklar.
  const ortam = new THREE.AmbientLight(RENK.kemik, 0.28);
  const ay = new THREE.HemisphereLight(RENK.ay, RENK.murekkep, 0.6);
  const ana = new THREE.DirectionalLight(RENK.sodyumAcik, 0.7);
  ana.position.set(3, 9, 5);
  sahne.add(ortam, ay, ana, ana.target);
  const lambaIsiklari = [];
  for (let i = 0; i < 3; i++) {
    const l = new THREE.PointLight(RENK.sodyum, 0, 16, 1.4);
    sahne.add(l);
    lambaIsiklari.push(l);
  }
  const farIsigi = new THREE.PointLight(RENK.sodyumAcik, 0, 34, 1.2);
  sahne.add(farIsigi);
  const korIsigi = new THREE.PointLight(RENK.kor, 0, 12, 1.5);
  sahne.add(korIsigi);

  const kamera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  const kameraKonum = new THREE.Vector3(0, 3.4, 6.6), kameraBakis = new THREE.Vector3(0, 1.3, -8);
  let fovHedef = 60, tekme = 0, tekmeHiz = 0;

  function boyutla() {
    const en = tuval.clientWidth || 1, boy = tuval.clientHeight || 1;
    renderer.setSize(en, boy, false);
    kamera.aspect = en / boy;
    // Dar ekranda üç şerit sığsın diye kamera biraz geri çekilir.
    kameraUzak = kamera.aspect < 0.85 ? 1.25 : 1;
    kamera.updateProjectionMatrix();
  }
  let kameraUzak = 1;

  // ---------- Statik zemin: balast, raylar, katener telleri ----------
  {
    const p = [];
    p.push(k(TUNEL_YARI * 2, 0.3, 260, 0, -0.38, -110, karistir(RENK.murekkep, RENK.kagit, 0.6)));
    for (const l of [-1, 0, 1]) {
      p.push(k(2.3, 0.22, 260, l * SERIT, -0.24, -110, RENK.tasKoyu));
      for (const s of [-0.72, 0.72]) {
        p.push(k(0.12, 0.14, 260, l * SERIT + s, -0.03, -110, RENK.cizgi));
        p.push(k(0.06, 0.02, 260, l * SERIT + s, 0.045, -110, karistir(RENK.cizgi, RENK.tasAcik, 0.55)));
      }
      p.push(k(0.04, 0.04, 260, l * SERIT, 5.35, -110, RENK.cizgi));
    }
    const m = new THREE.Mesh(birlestir(p), M.govde);
    sahne.add(m);
  }

  // ---------- Modüller (instanced, kaydırılarak yeniden kullanılır) ----------
  function anlik(geo, malzeme, adet) {
    const m = new THREE.InstancedMesh(geo, malzeme, adet);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    sahne.add(m);
    return m;
  }
  const tunel = tunelTarifi(), acik = acikTarifi(), travers = traversTarifi();
  const IM = {
    travers: anlik(birlestir(travers.govde), M.govde, MODUL_SAYISI),
    tunel: anlik(birlestir(tunel.govde), M.govde, MODUL_SAYISI),
    tunelIsik: anlik(birlestir(tunel.isik), M.isik, MODUL_SAYISI),
    tunelLeke: anlik(tunel.leke, M.leke, MODUL_SAYISI),
    acik: anlik(birlestir(acik.govde), M.govde, MODUL_SAYISI),
    acikIsik: anlik(birlestir(acik.isik), M.isik, MODUL_SAYISI),
    acikLeke: anlik(acik.leke, M.leke, MODUL_SAYISI)
  };
  IM.tunelLeke.renderOrder = IM.acikLeke.renderOrder = 2;
  const _m4 = new THREE.Matrix4(), _sifir = new THREE.Matrix4().makeScale(0, 0, 0), _rot = new THREE.Quaternion(), _bir = new THREE.Vector3(1, 1, 1);
  function koy(im, i, x, y, z, ry, olcek) {
    _rot.setFromAxisAngle(_yukari, ry || 0);
    _m4.compose(_p.set(x, y, z), _rot, olcek ? _s.setScalar(olcek) : _bir);
    im.setMatrixAt(i, _m4);
  }
  const _yukari = new THREE.Vector3(0, 1, 0);

  // ---------- Tünel ağızları ----------
  const portalGeo = birlestir(portalTarifi().govde), portalIsikGeo = birlestir(portalTarifi().isik);
  const portallar = [0, 1].map(() => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(portalGeo, M.govde), new THREE.Mesh(portalIsikGeo, M.isik));
    const ad = { metin: '' };
    const yazi = yaziDokusu(512, 96, (x, en, boy) => {
      x.fillStyle = hex(RENK.kagit); x.fillRect(0, 0, en, boy);
      x.fillStyle = hex(RENK.sodyum); x.fillRect(0, boy - 10, en, 10);
      x.fillStyle = hex(RENK.krem);
      x.font = '800 52px ' + YAZI_TIPI;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(ad.metin, en / 2, boy / 2 - 4, en - 30);
    });
    const levha = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.2), new THREE.MeshBasicMaterial({ map: yazi.doku }));
    levha.position.set(0, TAVAN + 1.4, 0.06);
    g.add(levha);
    g.visible = false;
    sahne.add(g);
    return { g, ad, yazi };
  });

  // ---------- Uzak manzara: Boğaz, köprü, karşı kıyı, ay ve yıldızlar ----------
  const uzak = new THREE.Group();
  const uzakMalzemeler = [];
  function uzakMalzeme(m) { m.fog = false; m.transparent = true; uzakMalzemeler.push(m); return m; }
  {
    // Su
    const su = new THREE.Mesh(new THREE.PlaneGeometry(900, 700), new THREE.MeshLambertMaterial({ color: SU_RENGI }));
    su.rotation.x = -Math.PI / 2;
    su.position.set(0, -1.7, -300);
    uzak.add(su);
    // Ayın suya düşen ışık yolu
    const yol = new THREE.Mesh(isikLekesi([[0, 0, 3, 90, 18, 140, 0, 0.5]], RENK.ay), uzakMalzeme(new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    yol.position.set(-70, -1.6, -230);
    yol.rotation.y = 0.28;
    uzak.add(yol);
    // Karşı kıyı silueti: tepeler, kubbeler, minareler (düz koyu kâğıt)
    const r = rnd(1453), kiyi = [];
    for (let x = -330; x < 330; x += 14 + r() * 18) kiyi.push(k(16 + r() * 26, 6 + r() * 16, 20, x, 0, -330, karistir(RENK.murekkep, RENK.kagit2, 0.8)));
    for (const [cx, olc] of [[-120, 1], [-40, 1.3], [95, 0.9], [190, 1.1]]) {
      kiyi.push(k(18 * olc, 10 * olc, 14, cx, 8, -322, RENK.kagit2));
      kiyi.push(k(12 * olc, 6 * olc, 12, cx, 14 * olc, -322, RENK.kagit2));
      kiyi.push(k(6 * olc, 4 * olc, 6, cx, 18 * olc, -322, RENK.kagit2));
      for (const s of [-1, 1]) kiyi.push(k(1.6, 30 * olc, 1.6, cx + s * 12 * olc, 15 * olc, -322, RENK.kagit2));
    }
    const kiyiM = new THREE.Mesh(birlestir(kiyi), uzakMalzeme(new THREE.MeshBasicMaterial({ vertexColors: true })));
    uzak.add(kiyiM);
    // Köprü: iki kule, tabliye, sarkan kablo; sodyum ışık çizgisi
    const kopru = [];
    const kx0 = -40, kz = -260, aci = -0.12;
    for (const kx of [-120, 140]) {
      kopru.push(k(3, 62, 3, kx0 + kx, 31, kz, RENK.kagit2), k(3, 62, 3, kx0 + kx, 31, kz - 6, RENK.kagit2));
      kopru.push(k(3, 3, 9, kx0 + kx, 48, kz - 3, RENK.kagit2));
    }
    kopru.push(k(560, 2.4, 6, kx0, 20, kz - 3, RENK.kagit2));
    for (let i = -70; i <= 70; i++) {
      const x = i * 4, u = Math.max(-1, Math.min(1, (x - 10) / 130));
      const y = 21.5 + 39 * u * u;
      if (x > -125 && x < 145) kopru.push(k(4.1, 0.5, 0.5, kx0 + x, y, kz - 3, RENK.cizgi));
    }
    const kopruM = new THREE.Mesh(birlestir(kopru), uzakMalzeme(new THREE.MeshBasicMaterial({ vertexColors: true })));
    uzak.add(kopruM);
    // Işık noktaları: köprü çizgisi, kıyı ışıkları, kule ikaz lambaları, yıldızlar
    const noktalar = [], renkler = [];
    const ekle = (x, y, z, renk, guc) => { noktalar.push(x, y, z); _c.setHex(renk).multiplyScalar(guc); renkler.push(_c.r, _c.g, _c.b); };
    for (let x = -260; x <= 260; x += 4.5) ekle(kx0 + x, 21.6, kz + 0.2, RENK.sodyum, 0.9);
    for (let i = 0; i < 46; i++) { const x = -40 + (i - 23) * 5.6; const u = Math.max(-1, Math.min(1, (x - 10) / 130)); if (x > -122 && x < 142) ekle(kx0 + x, 22 + 39 * u * u, kz + 0.2, RENK.krem, 0.5); }
    for (const kx of [-120, 140]) ekle(kx0 + kx, 63, kz, RENK.kor, 1);
    for (let i = 0; i < 260; i++) ekle(-330 + r() * 660, 1 + r() * r() * 22, -316, r() < 0.7 ? RENK.sodyum : RENK.krem, 0.35 + r() * 0.5);
    const isikGeo = new THREE.BufferGeometry();
    isikGeo.setAttribute('position', new THREE.Float32BufferAttribute(noktalar, 3));
    isikGeo.setAttribute('color', new THREE.Float32BufferAttribute(renkler, 3));
    uzak.add(new THREE.Points(isikGeo, uzakMalzeme(new THREE.PointsMaterial({ size: 2.6, map: parlama, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }))));
    const yildiz = [], yRenk = [];
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI - Math.PI / 2, b = 0.12 + r() * 0.9;
      yildiz.push(Math.sin(a) * 340, 40 + Math.sin(b) * 200, -Math.cos(a) * 340 - 60);
      _c.setHex(i % 5 ? RENK.krem : RENK.ay).multiplyScalar(0.3 + r() * 0.6); yRenk.push(_c.r, _c.g, _c.b);
    }
    const yGeo = new THREE.BufferGeometry();
    yGeo.setAttribute('position', new THREE.Float32BufferAttribute(yildiz, 3));
    yGeo.setAttribute('color', new THREE.Float32BufferAttribute(yRenk, 3));
    uzak.add(new THREE.Points(yGeo, uzakMalzeme(new THREE.PointsMaterial({ size: 1.6, vertexColors: true, sizeAttenuation: false, blending: THREE.AdditiveBlending, depthWrite: false }))));
    // Ay ve halesi
    const ayDisk = new THREE.Mesh(new THREE.CircleGeometry(9, 24), uzakMalzeme(new THREE.MeshBasicMaterial({ color: karistir(RENK.ay, RENK.krem, 0.5) })));
    ayDisk.position.set(-150, 95, -300);
    ayDisk.lookAt(0, 3, 0);
    uzak.add(ayDisk);
    const hale = new THREE.Sprite(uzakMalzeme(new THREE.SpriteMaterial({ map: parlama, color: karistir(RENK.murekkep, RENK.ay, 0.45), blending: THREE.AdditiveBlending, depthWrite: false })));
    hale.position.copy(ayDisk.position);
    hale.scale.setScalar(80);
    uzak.add(hale);
    sahne.add(uzak);
  }
  // Uzaktaki su yüzündeki ay pırıltıları: kayarak akar.
  const DALGA = 140;
  const dalgaGeo = new THREE.BufferGeometry();
  const dalgaPoz = new Float32Array(DALGA * 3), dalgaTaban = new Float32Array(DALGA * 2);
  { const r = rnd(7); for (let i = 0; i < DALGA; i++) { const s = r() < 0.5 ? -1 : 1; dalgaTaban[i * 2] = s * (8 + r() * 70); dalgaTaban[i * 2 + 1] = r() * 160; } }
  dalgaGeo.setAttribute('position', new THREE.BufferAttribute(dalgaPoz, 3));
  const dalgaMat = new THREE.PointsMaterial({ color: karistir(RENK.murekkep, RENK.ay, 0.7), size: 0.35, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const dalgalar = new THREE.Points(dalgaGeo, dalgaMat);
  dalgalar.frustumCulled = false;
  sahne.add(dalgalar);

  // ---------- Trenler ----------
  const vagonT = vagonTarifi();
  const vagonGeo = birlestir(vagonT.govde), vagonIsikGeo = birlestir(vagonT.isik);
  const huzmeGeo = isikLekesi([[0, 9, 1.1, 8.5, 2.2, 10, 0.03, 0.5]], RENK.sodyumAcik);
  const trenler = [];
  for (let i = 0; i < TREN_HAVUZU; i++) {
    const g = new THREE.Group();
    const vagonlar = [];
    for (let v = 0; v < 3; v++) {
      const vg = new THREE.Group();
      vg.add(new THREE.Mesh(vagonGeo, M.govde), new THREE.Mesh(vagonIsikGeo, M.isik));
      g.add(vg);
      vagonlar.push(vg);
    }
    const huzme = new THREE.Mesh(huzmeGeo, M.leke);
    huzme.renderOrder = 2;
    g.add(huzme);
    g.visible = false;
    sahne.add(g);
    trenler.push({ g, vagonlar, huzme, engel: null });
  }
  // Far parıltıları: sisin ötesinden de görünür (erken uyarı).
  const FAR = TREN_HAVUZU * 2;
  const farGeo = new THREE.BufferGeometry();
  const farPoz = new Float32Array(FAR * 3), farRenk = new Float32Array(FAR * 3);
  farGeo.setAttribute('position', new THREE.BufferAttribute(farPoz, 3));
  farGeo.setAttribute('color', new THREE.BufferAttribute(farRenk, 3));
  const farlar = new THREE.Points(farGeo, new THREE.PointsMaterial({ size: 2.4, map: parlama, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  farlar.frustumCulled = false;
  farlar.renderOrder = 3;
  sahne.add(farlar);

  // ---------- Bariyer ve tabelalar ----------
  const BARIYER_HAVUZU = 14, TABELA_HAVUZU = 10;
  const bT = bariyerTarifi();
  const IMb = { govde: anlik(birlestir(bT.govde), M.govde, BARIYER_HAVUZU), isik: anlik(birlestir(bT.isik), M.isik, BARIYER_HAVUZU) };
  const dikkat = yaziDokusu(256, 96, (x, en, boy) => {
    x.fillStyle = hex(RENK.sodyum); x.fillRect(0, 0, en, boy);
    x.fillStyle = hex(RENK.sodyumKoyu);
    for (let i = -2; i < 3; i++) { x.beginPath(); x.moveTo(i * 22, 0); x.lineTo(i * 22 + 12, 0); x.lineTo(i * 22 + 12 - 30, boy); x.lineTo(i * 22 - 30, boy); x.fill(); }
    for (let i = -2; i < 3; i++) { const b = en - 46 + i * 22; x.beginPath(); x.moveTo(b, 0); x.lineTo(b + 12, 0); x.lineTo(b + 42, boy); x.lineTo(b + 30, boy); x.fill(); }
    x.fillStyle = hex(RENK.sodyum); x.fillRect(44, 0, en - 88, boy);
    x.fillStyle = hex(RENK.sodyumKoyu);
    x.font = '800 50px ' + YAZI_TIPI; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('DİKKAT', en / 2, boy / 2 + 2, en - 96);
  });
  const levhaGeo = new THREE.PlaneGeometry(2.0, 0.76);
  levhaGeo.translate(0, 1.76, 0.09);
  const IMt = { direk: anlik(birlestir(tabelaDirekTarifi().govde), M.govde, TABELA_HAVUZU), levha: anlik(levhaGeo, new THREE.MeshBasicMaterial({ map: dikkat.doku }), TABELA_HAVUZU) };

  // ---------- Jetonlar (İstanbulkart jetonu: sodyum kenar, krem yüz) ----------
  const kenarGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.09, 14); kenarGeo.rotateX(Math.PI / 2);
  const yuzGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.11, 14); yuzGeo.rotateX(Math.PI / 2);
  const IMj = {
    kenar: anlik(kenarGeo, new THREE.MeshLambertMaterial({ color: RENK.sodyum, emissive: RENK.sodyumGolge, emissiveIntensity: 0.55, flatShading: true }), JETON_HAVUZU),
    yuz: anlik(yuzGeo, new THREE.MeshLambertMaterial({ color: RENK.krem, emissive: RENK.soluk, emissiveIntensity: 0.25, flatShading: true }), JETON_HAVUZU)
  };

  // ---------- Güçlendiriciler ----------
  const x2Yazi = yaziDokusu(128, 96, (x, en, boy) => {
    x.fillStyle = hex(RENK.sodyum); x.fillRect(0, 0, en, boy);
    x.fillStyle = hex(RENK.sodyumKoyu); x.font = '800 64px ' + YAZI_TIPI; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('×2', en / 2, boy / 2 + 3);
  });
  function gucModeli(tur) {
    const t = GUC_TARIF[tur](), g = new THREE.Group();
    g.add(new THREE.Mesh(birlestir(t.govde), M.govde));
    if (t.isik) g.add(new THREE.Mesh(birlestir(t.isik), M.isik));
    if (tur === 'x2') {
      const yuz = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.56), new THREE.MeshBasicMaterial({ map: x2Yazi.doku, side: THREE.DoubleSide }));
      yuz.position.z = 0.045;
      const arka = yuz.clone(); arka.position.z = -0.045; arka.rotation.y = Math.PI;
      g.add(yuz, arka);
    }
    return g;
  }
  const halkaGeo = new THREE.RingGeometry(0.55, 0.9, 24); halkaGeo.rotateX(-Math.PI / 2);
  const halkaMat = new THREE.MeshBasicMaterial({ color: RENK.sodyumGolge, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const gucler = {};
  for (const tur of ['miknatis', 'jetpack', 'x2']) {
    const g = new THREE.Group();
    const m = gucModeli(tur);
    m.position.y = 1.1;
    const halka = new THREE.Mesh(halkaGeo, halkaMat);
    halka.position.y = 0.03;
    const isilti = new THREE.Sprite(new THREE.SpriteMaterial({ map: parlama, color: karistir(RENK.murekkep, RENK.sodyum, 0.6), blending: THREE.AdditiveBlending, depthWrite: false }));
    isilti.position.y = 1.1; isilti.scale.setScalar(2.4);
    g.add(m, halka, isilti);
    g.visible = false;
    sahne.add(g);
    gucler[tur] = { g, m };
  }
  // Oyuncunun üstünde etkin güçlendirici simgeleri (sırt çantası jetpack, başın üstünde mıknatıs)
  const sirtJetpack = gucModeli('jetpack'); sirtJetpack.scale.setScalar(0.8);
  const basMiknatis = gucModeli('miknatis'); basMiknatis.scale.setScalar(0.3);

  // ---------- Oyuncu ----------
  const oyuncu = new THREE.Group();
  const govdeKap = new THREE.Group();
  oyuncu.add(govdeKap);
  const golge = new THREE.Mesh(new THREE.CircleGeometry(0.55, 18), M.golge);
  golge.rotation.x = -Math.PI / 2;
  sahne.add(oyuncu, golge);
  const modelOnbellek = new Map();
  function karakterModeli(id) {
    if (modelOnbellek.has(id)) return modelOnbellek.get(id);
    const t = KARAKTER_TARIF[id]();
    const g = new THREE.Group();
    g.add(new THREE.Mesh(birlestir(t.govde), M.govde));
    if (t.isik) g.add(new THREE.Mesh(birlestir(t.isik), M.isik));
    const uzuv = (tarif, s) => {
      const piv = new THREE.Group();
      piv.position.set(s * tarif.pivot[0], tarif.pivot[1], tarif.pivot[2]);
      const parcalar = tarif.parca.map((p) => k(p.b[0], p.b[1], p.b[2], p.p[0] * s, p.p[1], p.p[2], p.r, p.rx, p.rz));
      piv.add(new THREE.Mesh(birlestir(parcalar), M.govde));
      g.add(piv);
      return piv;
    };
    const model = { g, olcek: t.olcek, kaykay: !!t.kaykay, bacakL: uzuv(t.bacak, -1), bacakR: uzuv(t.bacak, 1), kolL: uzuv(t.kol, -1), kolR: uzuv(t.kol, 1) };
    // Kaykayda bacaklar sabit duruşta
    if (model.kaykay) { model.bacakL.position.z = -0.18; model.bacakR.position.z = 0.2; }
    g.scale.setScalar(t.olcek);
    modelOnbellek.set(id, model);
    return model;
  }
  let aktif = null;
  function karakterAyarla(id) {
    if (aktif) govdeKap.remove(aktif.g);
    aktif = karakterModeli(id);
    govdeKap.add(aktif.g);
    aktif.g.add(sirtJetpack, basMiknatis);
    sirtJetpack.position.set(0, aktif.kaykay || id === 'hamal' ? 0.7 : 0.45, 0.32);
    basMiknatis.position.set(0, id === 'hamal' ? 1.95 : id === 'kaykay' ? 1.65 : 1.05, 0);
  }

  // ---------- Parçacıklar (tek Points, toplanır karışım; söndükçe kararır) ----------
  const pPoz = new Float32Array(PARCACIK * 3), pRenk = new Float32Array(PARCACIK * 3);
  const pHiz = new Float32Array(PARCACIK * 3), pOmur = new Float32Array(PARCACIK), pTaban = new Float32Array(PARCACIK * 3), pYer = new Uint8Array(PARCACIK);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPoz, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pRenk, 3));
  const parcaciklar = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.42, map: parlama, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  parcaciklar.frustumCulled = false;
  sahne.add(parcaciklar);
  let pSira = 0;
  for (let i = 0; i < PARCACIK; i++) pPoz[i * 3 + 1] = -50;
  // dunyada: parçacık dünyayla birlikte akar (kıvılcım, toz); değilse oyuncuya bağlı (duman havada kalır gibi akar).
  function parcacikSac(x, y, z, renkler, adet, guc, yukari, dunyada) {
    if (hareketAz) adet = Math.ceil(adet / 3);
    for (let n = 0; n < adet; n++) {
      const i = pSira; pSira = (pSira + 1) % PARCACIK;
      const a = Math.random() * Math.PI * 2, h = guc * (0.4 + Math.random() * 0.6);
      pPoz[i * 3] = x; pPoz[i * 3 + 1] = y; pPoz[i * 3 + 2] = z;
      pHiz[i * 3] = Math.cos(a) * h; pHiz[i * 3 + 1] = (yukari != null ? yukari : 0.6) * h + Math.random() * guc * 0.5; pHiz[i * 3 + 2] = Math.sin(a) * h;
      _c.setHex(renkler[n % renkler.length]);
      pTaban[i * 3] = _c.r; pTaban[i * 3 + 1] = _c.g; pTaban[i * 3 + 2] = _c.b;
      pOmur[i] = 0.5 + Math.random() * 0.5;
      pYer[i] = dunyada ? 1 : 0;
    }
  }
  function parcaciklariGuncelle(dt, akis) {
    for (let i = 0; i < PARCACIK; i++) {
      if (pOmur[i] <= 0) continue;
      pOmur[i] -= dt * 1.4;
      const o = i * 3;
      if (pOmur[i] <= 0) { pPoz[o + 1] = -50; pRenk[o] = pRenk[o + 1] = pRenk[o + 2] = 0; continue; }
      pHiz[o + 1] -= dt * 6;
      pPoz[o] += pHiz[o] * dt; pPoz[o + 1] += pHiz[o + 1] * dt; pPoz[o + 2] += pHiz[o + 2] * dt + (pYer[i] ? akis : akis * 0.6);
      if (pPoz[o + 1] < 0.02) { pPoz[o + 1] = 0.02; pHiz[o + 1] *= -0.3; }
      const f = Math.min(1, pOmur[i] * 1.6);
      pRenk[o] = pTaban[o] * f; pRenk[o + 1] = pTaban[o + 1] * f; pRenk[o + 2] = pTaban[o + 2] * f;
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }

  // ---------- Kare çizimi ----------
  // d: { p, t, dt, hiz, uretici, oyuncu: {...}, cekilen: Map(jeton → 0..1), acikOrani, olum }
  const _hedef = new THREE.Vector3();
  let sonP = 0, korTon = 0, dalgaT = 0;
  function kare(d) {
    const { p, t, dt, uretici } = d;
    const akis = Math.max(0, p - sonP); // bu karede dünyanın oyuncuya doğru aktığı mesafe
    sonP = p;

    // Modüller ve bölümler
    const ilk = Math.floor(p / MODUL) - GERI_MODUL;
    let lambaSayisi = 0;
    for (let i = 0; i < MODUL_SAYISI; i++) {
      const mp = (ilk + i) * MODUL;
      const z = -(mp + MODUL / 2 - p);
      const tur = uretici.bolum(mp + MODUL / 2).tur;
      koy(IM.travers, i, 0, 0, z);
      if (tur === 'tunel') {
        koy(IM.tunel, i, 0, 0, z); koy(IM.tunelIsik, i, 0, 0, z); koy(IM.tunelLeke, i, 0, 0, z);
        IM.acik.setMatrixAt(i, _sifir); IM.acikIsik.setMatrixAt(i, _sifir); IM.acikLeke.setMatrixAt(i, _sifir);
      } else {
        koy(IM.acik, i, 0, 0, z); koy(IM.acikIsik, i, 0, 0, z); koy(IM.acikLeke, i, 0, 0, z);
        IM.tunel.setMatrixAt(i, _sifir); IM.tunelIsik.setMatrixAt(i, _sifir); IM.tunelLeke.setMatrixAt(i, _sifir);
      }
      // Oyuncunun hemen önündeki lambalara gerçek ışık
      if (z < 4 && lambaSayisi < lambaIsiklari.length) {
        const l = lambaIsiklari[lambaSayisi++];
        if (tur === 'tunel') { l.position.set(0, TAVAN - 0.6, z + 0.6); l.intensity = 9; }
        else { l.position.set((lambaSayisi % 2 ? -1 : 1) * 3.3, 5, z - 1.5); l.intensity = 7; }
      }
    }
    for (const im of Object.values(IM)) im.instanceMatrix.needsUpdate = true;

    // Tünel ağızları
    const bolumler = uretici.bolumler(p + 200);
    let pi = 0, cikisUzak = Infinity;
    for (let i = 1; i < bolumler.length && pi < portallar.length; i++) {
      const b = bolumler[i].bas, z = -(b - p);
      if (z > 20 || z < -200) continue;
      const giris = bolumler[i].tur === 'tunel';
      const pr = portallar[pi++];
      pr.g.visible = true;
      pr.g.position.set(0, 0, z);
      pr.g.rotation.y = giris ? 0 : Math.PI;
      const metin = bolumler[giris ? i : i - 1].istasyon;
      if (pr.ad.metin !== metin) { pr.ad.metin = metin; pr.yazi.yeniden(); }
      if (!giris && b > p) cikisUzak = Math.min(cikisUzak, b - p);
    }
    for (; pi < portallar.length; pi++) portallar[pi].g.visible = false;

    // Uzak manzara: açıkta tam, tünelde yalnızca çıkışa yaklaşırken ağızdan görünür.
    const simdiki = uretici.bolum(p);
    const acikOrani = simdiki.tur === 'acik' ? 1 : Math.max(0, Math.min(1, 1 - (cikisUzak - 30) / 110));
    uzak.visible = acikOrani > 0.001;
    for (const m of uzakMalzemeler) m.opacity = acikOrani;
    ay.intensity = 0.45 + 0.5 * (simdiki.tur === 'acik' ? 1 : acikOrani * 0.4);
    ortam.intensity = simdiki.tur === 'acik' ? 0.24 : 0.3;
    // Su pırıltıları yalnızca açıkta
    dalgalar.visible = simdiki.tur === 'acik' || acikOrani > 0.2;
    if (dalgalar.visible) {
      dalgaT += akis * 0.5 + dt * 0.4;
      for (let i = 0; i < DALGA; i++) {
        const zz = -((dalgaTaban[i * 2 + 1] - dalgaT) % 160 + 160) % 160;
        dalgaPoz[i * 3] = dalgaTaban[i * 2] + Math.sin(t * 0.7 + i) * 0.4;
        dalgaPoz[i * 3 + 1] = -1.55;
        dalgaPoz[i * 3 + 2] = zz - 10;
      }
      dalgaGeo.attributes.position.needsUpdate = true;
      dalgaMat.opacity = (0.5 + 0.5 * Math.sin(t * 2.1)) * 0.4 + 0.5;
    }

    // Engeller
    let ti = 0, bi = 0, si = 0, fi = 0, enYakinFar = Infinity;
    const engeller = uretici.engeller();
    for (const e of engeller) {
      const uz = (e.bas - p) * (e.gelen ? 1.55 : 1);
      if (e.tur === 'tren') {
        const boy = e.vagon * (VAGON + VAGON_ARA);
        if (uz > 180 || uz + boy < -12 || ti >= trenler.length) continue;
        const tr = trenler[ti++];
        tr.g.visible = true;
        tr.g.position.set(e.serit * SERIT, 0, -uz);
        for (let v = 0; v < 3; v++) {
          const vg = tr.vagonlar[v];
          vg.visible = v < e.vagon;
          vg.position.z = -VAGON / 2 - v * (VAGON + VAGON_ARA);
          vg.rotation.y = e.gelen ? 0 : Math.PI;
        }
        tr.huzme.visible = !!e.gelen;
        tr.huzme.position.z = 0;
        if (e.gelen && fi < FAR - 1 && uz > 3) {
          for (const sx of [-0.66, 0.66]) {
            const o = fi * 3;
            farPoz[o] = e.serit * SERIT + sx; farPoz[o + 1] = 1.02; farPoz[o + 2] = -uz + 0.3;
            const g = Math.min(1, uz / 25) * (0.9 + 0.1 * Math.sin(t * 30 + ti));
            _c.setHex(RENK.sodyumAcik).multiplyScalar(g);
            farRenk[o] = _c.r; farRenk[o + 1] = _c.g; farRenk[o + 2] = _c.b;
            fi++;
          }
          if (uz < enYakinFar) { enYakinFar = uz; farIsigi.position.set(e.serit * SERIT, 1.4, -uz + 2.5); }
          // Raylarda kıvılcım
          if (!hareketAz && uz < 50 && Math.random() < dt * 6) parcacikSac(e.serit * SERIT + (Math.random() < 0.5 ? -0.72 : 0.72), 0.08, -uz - 2.6, [RENK.sodyumAcik, RENK.sodyum, RENK.krem], 3, 1.8, 0.8, true);
        }
      } else if (e.tur === 'bariyer') {
        if (uz > 140 || uz < -8 || bi >= BARIYER_HAVUZU) continue;
        koy(IMb.govde, bi, e.serit * SERIT, 0, -uz - 0.25); koy(IMb.isik, bi, e.serit * SERIT, 0, -uz - 0.25);
        bi++;
      } else {
        if (uz > 140 || uz < -8 || si >= TABELA_HAVUZU) continue;
        koy(IMt.direk, si, e.serit * SERIT, 0, -uz - 0.2); koy(IMt.levha, si, e.serit * SERIT, 0, -uz - 0.2);
        si++;
      }
    }
    for (; ti < trenler.length; ti++) trenler[ti].g.visible = false;
    for (let i = fi; i < FAR; i++) { farRenk[i * 3] = farRenk[i * 3 + 1] = farRenk[i * 3 + 2] = 0; farPoz[i * 3 + 1] = -50; }
    farGeo.attributes.position.needsUpdate = true; farGeo.attributes.color.needsUpdate = true;
    farIsigi.intensity = enYakinFar < 70 ? 40 * (1 - enYakinFar / 70) : 0;
    IMb.govde.count = IMb.isik.count = bi;
    IMt.direk.count = IMt.levha.count = si;
    IMb.govde.instanceMatrix.needsUpdate = IMb.isik.instanceMatrix.needsUpdate = true;
    IMt.direk.instanceMatrix.needsUpdate = IMt.levha.instanceMatrix.needsUpdate = true;

    // Jetonlar
    const oy = d.oyuncu;
    let ji = 0;
    for (const j of uretici.jetonlar()) {
      if (j.alindi || ji >= JETON_HAVUZU) continue;
      const uz = j.p - p;
      if (uz > 120 || uz < -6) continue;
      let x = j.serit * SERIT, y = j.y, z = -uz;
      const c = d.cekilen && d.cekilen.get(j);
      if (c != null) { const e = c * c; x += (oy.x - x) * e; y += (oy.y + 0.9 - y) * e; z += (0 - z) * e; }
      const don = t * 4 + j.p * 0.35;
      _rot.setFromAxisAngle(_yukari, don);
      _m4.compose(_p.set(x, y + Math.sin(t * 3 + j.p) * 0.06, z), _rot, _bir);
      IMj.kenar.setMatrixAt(ji, _m4); IMj.yuz.setMatrixAt(ji, _m4);
      ji++;
    }
    IMj.kenar.count = IMj.yuz.count = ji;
    IMj.kenar.instanceMatrix.needsUpdate = IMj.yuz.instanceMatrix.needsUpdate = true;

    // Güçlendiriciler
    for (const tur in gucler) gucler[tur].g.visible = false;
    for (const g of uretici.guclendiriciler()) {
      const uz = g.p - p;
      if (g.alindi || uz > 120 || uz < -6) continue;
      const m = gucler[g.tur];
      m.g.visible = true;
      m.g.position.set(g.serit * SERIT, Math.sin(t * 2.6) * 0.12, -uz);
      m.m.rotation.y = t * 2.2;
    }

    // Oyuncu
    oyuncuCiz(oy, dt, t);
    // Çarpmada sahne kor tonuna kayar (korIsigi + ortam)
    korTon = Math.max(0, korTon - dt * 2.2);
    korIsigi.intensity = korTon * 30;
    korIsigi.position.set(oy.x, 1.5, 1.5);

    parcaciklariGuncelle(dt, akis);

    // Kamera: arkadan ve biraz yukarıdan, yumuşak takip; hızla FOV açılır.
    const jet = oy.jetpack ? 1 : 0;
    const yuk = 3.3 * kameraUzak + oy.y * (jet ? 0.92 : 0.42);
    const geri = 6.4 * kameraUzak + jet * 1.2;
    const yumusak = Math.min(1, dt * 7);
    kameraKonum.x += (oy.x * 0.62 - kameraKonum.x) * yumusak;
    kameraKonum.y += (yuk - kameraKonum.y) * Math.min(1, dt * 5);
    kameraKonum.z += (geri - kameraKonum.z) * yumusak;
    kameraBakis.x += (oy.x * 0.8 - kameraBakis.x) * yumusak;
    kameraBakis.y += (1.25 + oy.y * (jet ? 0.8 : 0.55) - kameraBakis.y) * Math.min(1, dt * 5);
    // Kamera tekmesi: yaylı sönüm (iniş, çarpma); azaltılmış harekette yok.
    tekmeHiz += (-tekme * 120 - tekmeHiz * 14) * dt;
    tekme += tekmeHiz * dt;
    kamera.position.set(kameraKonum.x, kameraKonum.y + tekme, kameraKonum.z);
    _hedef.set(kameraBakis.x, kameraBakis.y + tekme * 0.4, -8);
    kamera.lookAt(_hedef);
    fovHedef = hareketAz ? 62 : 60 + 10 * Math.max(0, Math.min(1, (d.hiz - 14) / 18));
    if (Math.abs(kamera.fov - fovHedef) > 0.01) { kamera.fov += (fovHedef - kamera.fov) * Math.min(1, dt * 3); kamera.updateProjectionMatrix(); }
    ana.position.set(kameraKonum.x + 3, 9, 5);
    ana.target.position.set(kameraKonum.x, 0, -6);
  }

  function oyuncuCiz(oy, dt, t) {
    oyuncu.visible = oy.gorunur !== false;
    oyuncu.position.set(oy.x, oy.y, 0);
    if (!aktif) return;
    // Koşu canlandırması
    const faz = oy.faz;
    const salinim = oy.kosuyor ? Math.sin(faz) : 0;
    if (aktif.kaykay) {
      aktif.bacakL.rotation.x = 0.25; aktif.bacakR.rotation.x = -0.25;
      aktif.kolL.rotation.x = -0.3 + salinim * 0.1; aktif.kolR.rotation.x = 0.3 - salinim * 0.1;
      aktif.kolL.rotation.z = -0.5; aktif.kolR.rotation.z = 0.5;
    } else {
      const havada = oy.y > 0.05 && !oy.jetpack;
      aktif.bacakL.rotation.x = havada ? 0.7 : salinim * 0.95;
      aktif.bacakR.rotation.x = havada ? -0.4 : -salinim * 0.95;
      const kolGenlik = aktif === modelOnbellek.get('marti') ? 0 : 0.8;
      aktif.kolL.rotation.x = -salinim * kolGenlik;
      aktif.kolR.rotation.x = salinim * kolGenlik;
      // Martı kanat çırpar
      const kanat = kolGenlik === 0 ? (havada || oy.jetpack ? Math.sin(t * 22) * 0.9 - 0.4 : Math.sin(faz * 2) * 0.25) : 0;
      aktif.kolL.rotation.z = -kanat - (oy.kayma > 0 ? 0.8 : 0);
      aktif.kolR.rotation.z = kanat + (oy.kayma > 0 ? 0.8 : 0);
      if (kolGenlik) { aktif.kolL.rotation.z = -0.08; aktif.kolR.rotation.z = 0.08; }
    }
    // Ezilme-esneme, eğilme ve kayma duruşu
    const kay = oy.kayma;
    govdeKap.scale.set(oy.sx, oy.sy * (1 - 0.48 * kay), oy.sz || 1);
    govdeKap.rotation.set(-0.35 * kay + (oy.devrilme || 0), 0, oy.egim);
    govdeKap.position.y = oy.kosuyor && oy.y < 0.05 && !aktif.kaykay ? Math.abs(Math.sin(faz)) * 0.07 : 0;
    sirtJetpack.visible = !!oy.jetpack;
    basMiknatis.visible = !!oy.miknatis;
    if (oy.miknatis) basMiknatis.rotation.y = t * 3;
    golge.visible = oyuncu.visible;
    golge.position.set(oy.x, 0.03, 0.05);
    const gol = Math.max(0.25, 1 - oy.y * 0.18);
    golge.scale.set(gol * (1 + kay * 0.4), gol * (1 + kay * 0.6), 1);
    M.golge.opacity = 0.5 * gol;
    if (oy.jetpack && !hareketAz && Math.random() < 0.9) {
      parcacikSac(oy.x + (Math.random() - 0.5) * 0.3, oy.y + 0.3, 0.5, [RENK.krem, RENK.kemik, RENK.soluk], 2, 0.8, -0.6, false);
    }
  }

  // Dünya konumunu tuval pikseline çevirir (jetonun HUD'a uçuşu için).
  const _ekran = new THREE.Vector3();
  function ekranKonumu(x, y, z) {
    _ekran.set(x, y, z).project(kamera);
    return { x: (_ekran.x + 1) / 2 * tuval.clientWidth, y: (1 - _ekran.y) / 2 * tuval.clientHeight };
  }

  function ciz() { renderer.render(sahne, kamera); }

  // Karakter seçim kartları için küçük önizlemeler (aynı WebGL bağlamıyla, makas testiyle).
  function onizlemeler(idler, boyut) {
    const kamOn = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    kamOn.position.set(2.0, 2.0, -3.4);
    kamOn.lookAt(0, 0.8, 0);
    const s = new THREE.Scene();
    s.add(new THREE.AmbientLight(RENK.kemik, 0.7), new THREE.HemisphereLight(RENK.ay, RENK.murekkep, 0.8));
    const dl = new THREE.DirectionalLight(RENK.sodyumAcik, 1.5);
    dl.position.set(2, 4, -3);
    s.add(dl);
    const tuval2 = document.createElement('canvas');
    tuval2.width = tuval2.height = boyut;
    const ctx = tuval2.getContext('2d');
    const sonuc = {};
    const pr = renderer.getPixelRatio();
    const tam = renderer.getSize(new THREE.Vector2());
    const kenar = boyut / pr;
    if (tuval.height < boyut || tuval.width < boyut) return sonuc;
    renderer.setClearColor(RENK.murekkep, 0);
    renderer.setScissorTest(true);
    renderer.setViewport(0, 0, kenar, kenar);
    renderer.setScissor(0, 0, kenar, kenar);
    for (const id of idler) {
      const m = karakterModeli(id);
      const ebeveyn = m.g.parent;
      const olcek = m.g.scale.x;
      m.g.scale.setScalar(1.75 / (id === 'hamal' || id === 'kaykay' ? 1.75 : 1.15));
      m.g.position.y = id === 'kedi' ? 0.25 : 0;
      s.add(m.g);
      renderer.clear();
      renderer.render(s, kamOn);
      ctx.clearRect(0, 0, boyut, boyut);
      ctx.drawImage(tuval, 0, tuval.height - boyut, boyut, boyut, 0, 0, boyut, boyut);
      sonuc[id] = tuval2.toDataURL('image/png');
      s.remove(m.g);
      m.g.scale.setScalar(olcek);
      m.g.position.y = 0;
      if (ebeveyn) ebeveyn.add(m.g);
    }
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, tam.x, tam.y);
    renderer.setClearColor(RENK.murekkep, 1);
    return sonuc;
  }

  function kaliteAyarla(ortalamaKare) {
    if (ortalamaKare > 24 && pikselOrani > 1) {
      pikselOrani = Math.max(1, pikselOrani - 0.25);
      renderer.setPixelRatio(pikselOrani);
      boyutla();
      return true;
    }
    return false;
  }

  function temizle() {
    for (let i = 0; i < PARCACIK; i++) { pOmur[i] = 0; pPoz[i * 3 + 1] = -50; pRenk[i * 3] = pRenk[i * 3 + 1] = pRenk[i * 3 + 2] = 0; }
    sonP = 0; korTon = 0; tekme = 0; tekmeHiz = 0;
  }

  boyutla();
  return {
    renderer, kamera, boyutla, kare, ciz, karakterAyarla, parcacikSac, ekranKonumu, onizlemeler, kaliteAyarla, temizle,
    tekme(guc) { if (!hareketAz) tekmeHiz += guc; },
    korTonu() { if (!hareketAz) korTon = 1; },
    sifirla(p) { sonP = p; },
    pikselOrani: () => pikselOrani
  };
}
