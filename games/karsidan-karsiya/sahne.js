// Gece Yarısı Karşıdan Karşıya: three.js sahnesi (ışık, kamera, voksel modeller, şeritler, efektler).
// Oyun kuralları mantik.js'tedir; bu dosya yalnızca çizer. Renkler yalnızca DESIGN.md paletinden.
// Koordinat: sütun c → x = c, satır r → z = -r, zemin üstü y.
import * as THREE from '../../assets/vendor/three/three.module.min.js';

// DESIGN.md token'ları ve oyun içi ek renkler.
export const RENK = {
  murekkep: 0x110f0d, kagit: 0x1b1815, kagit2: 0x26211c, cizgi: 0x3b332b,
  krem: 0xf3ead8, soluk: 0xb4a78f, sodyum: 0xffb23f, sodyumKoyu: 0x1d1307,
  sodyumGolge: 0xb8741a, sodyumAcik: 0xffc266, kor: 0xff6a48, yaprak: 0x368549,
  tasKoyu: 0x2e2822, tasAcik: 0xa89c88, ay: 0x9db4ff,
  iznik: 0x2f6fb0, turkuaz: 0x2aa198, ceviz: 0x5a3b24, kemik: 0xe9dcc2, cim: 0x2c5a3a, kum: 0xc9a46a
};

// Şerit üst yüzeylerinin yüksekliği ve tekne güverteleri.
export const ZEMIN = { kaldirim: 0.32, yol: 0.04, ray: 0.08, su: -0.22 };
const GUVERTE = { sandal: 0.12, vapur: 0.5 };
const TABAN = -1.2;
// Su: gece Boğaz'ı, kâğıt zemine karışmış İznik mavisi.
const SU_RENGI = karistir(RENK.kagit, RENK.iznik, 0.38);
const OYUNCU_OLCEK = 1.3; // karakterler okunur olsun diye hücreye göre biraz büyük
const BORDUR = karistir(RENK.tasAcik, RENK.cizgi, 0.4); // bordür taşı: soluk taş, kaldırıma yakın
const GENIS = 18;  // şerit zemininin yarım genişliği (ekran kenarlarını doldurur)

// İki palet rengini karıştırır (ör. krem %40 + asfalt). Sonuç yine paletten türetilmiştir.
function karistir(a, b, oran) {
  return new THREE.Color(a).lerp(new THREE.Color(b), oran).getHex();
}

// Tohumlu küçük rastgele (süs yerleşimi her açılışta aynı olsun diye).
function rnd(tohum) {
  let a = tohum >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Voksel geometri: kutuları tek bir tampon geometrisinde birleştirir ----------
const BIRIM = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const _mat = new THREE.Matrix4(), _nm = new THREE.Matrix3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _v = new THREE.Vector3(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();

// k(w, h, d, x, y, z, renk, [dönüş y]) → tek kutu tarifi
function k(w, h, d, x, y, z, renk, ry) { return { b: [w, h, d], p: [x, y, z], r: renk, ry: ry || 0 }; }

function birlestir(parcalar) {
  const n = BIRIM.attributes.position.count;
  const poz = new Float32Array(parcalar.length * n * 3);
  const nor = new Float32Array(parcalar.length * n * 3);
  const renk = new Float32Array(parcalar.length * n * 3);
  const bp = BIRIM.attributes.position.array, bn = BIRIM.attributes.normal.array;
  parcalar.forEach((pr, i) => {
    _q.setFromEuler(_e.set(0, pr.ry, 0));
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

// Ortak malzemeler: ışık alan gövde, kendi ışığı olan parçalar (far, pencere) ve toplanır ışık (huzme, havuz).
const MALZEME = {
  govde: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  isik: new THREE.MeshBasicMaterial({ vertexColors: true }),
  huzme: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  dalga: new THREE.MeshBasicMaterial({ color: RENK.ay, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
  havuz: new THREE.MeshBasicMaterial({ color: RENK.sodyum, transparent: true, opacity: 0.075, blending: THREE.AdditiveBlending, depthWrite: false }),
  golge: new THREE.MeshBasicMaterial({ color: RENK.murekkep, transparent: true, opacity: 0.55, depthWrite: false })
};

// Model: { govde: [...], isik: [...], huzme: [...] } → Group (geometriler önbellekte paylaşılır).
const modelOnbellek = new Map();
function model(ad, tarif) {
  let geo = modelOnbellek.get(ad);
  if (!geo) {
    const t = tarif();
    geo = {};
    for (const tur of ['govde', 'isik']) if (t[tur] && t[tur].length) geo[tur] = birlestir(t[tur]);
    if (t.huzme) geo.huzme = t.huzme;
    modelOnbellek.set(ad, geo);
  }
  const grup = new THREE.Group();
  for (const tur of Object.keys(geo)) {
    const m = new THREE.Mesh(geo[tur], MALZEME[tur]);
    if (tur === 'huzme') m.renderOrder = 2;
    grup.add(m);
  }
  return grup;
}

// Toplanır ışık geometrisi (far huzmesi, tekne ışığının suya yansıması). İç kenarda sodyum, dışta siyah.
// huzmeler: [x0, yarımGenişlik0, x1, yarımGenişlik1, y]  ·  yayilmalar: [cx, cz, içX, içZ, dışX, dışZ, y]
const _acik = new THREE.Color(RENK.sodyumAcik);
function isikGeo(huzmeler, yayilmalar) {
  const poz = [], renk = [];
  function dortgen(a, b, c, d, ra, rb, rc, rd) {
    for (const [v, r] of [[a, ra], [b, rb], [c, rc], [a, ra], [c, rc], [d, rd]]) {
      poz.push(v[0], v[1], v[2]);
      renk.push(_acik.r * r, _acik.g * r, _acik.b * r);
    }
  }
  for (const [x0, g0, x1, g1, y] of huzmeler) dortgen([x0, y, g0], [x1, y, g1], [x1, y, -g1], [x0, y, -g0], 1, 0, 0, 1);
  for (const [cx, cz, ix, iz, dx, dz, y] of yayilmalar) {
    const ic = [[cx - ix, y, cz - iz], [cx + ix, y, cz - iz], [cx + ix, y, cz + iz], [cx - ix, y, cz + iz]];
    const dis = [[cx - dx, y, cz - dz], [cx + dx, y, cz - dz], [cx + dx, y, cz + dz], [cx - dx, y, cz + dz]];
    dortgen(ic[0], ic[1], ic[2], ic[3], 1, 1, 1, 1);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; dortgen(ic[i], dis[i], dis[j], ic[j], 1, 0, 0, 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(renk, 3));
  g.computeBoundingSphere();
  return g;
}

// ---------- Araçlar (+x yönüne bakar) ----------
function tekerler(uzunluk, gen, aralik) {
  const p = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(k(0.3, 0.2, 0.08, sx * aralik, 0.1, sz * gen / 2, RENK.murekkep));
  return p;
}
function farlar(onX, yukseklik, gen, huzmeBoyu) {
  const isik = [], huzme = [];
  for (const sz of [-1, 1]) {
    isik.push(k(0.04, 0.08, 0.14, onX, yukseklik, sz * gen, RENK.sodyumAcik));
    isik.push(k(0.04, 0.08, 0.14, -onX, yukseklik, sz * gen, RENK.kor));
  }
  // Önde yola düşen sıcak far huzmesi: farda parlak, uzakta söner (toplanır karışımda siyah = ışık yok).
  return { isik, huzme: isikGeo([[onX, 0.32, onX + huzmeBoyu, 0.62, 0.02]], []) };
}
const ARAC_TARIF = {
  taksi: () => {
    const f = farlar(0.76, 0.3, 0.26, 1.7);
    return {
      govde: [
        k(1.5, 0.32, 0.78, 0, 0.26, 0, RENK.sodyum),
        k(0.8, 0.28, 0.72, -0.08, 0.55, 0, RENK.sodyum),
        k(0.82, 0.15, 0.74, -0.08, 0.56, 0, RENK.kagit2),
        k(0.32, 0.1, 0.24, -0.08, 0.74, 0, RENK.sodyumKoyu),
        k(1.52, 0.05, 0.8, 0, 0.16, 0, RENK.sodyumGolge),
        k(0.06, 0.1, 0.8, 0.76, 0.17, 0, RENK.cizgi), k(0.06, 0.1, 0.8, -0.76, 0.17, 0, RENK.cizgi)
      ].concat(tekerler(1.5, 0.78, 0.45)),
      isik: f.isik.concat([k(1.8, 0.005, 1.0, 0, 0.008, 0, RENK.murekkep), k(0.2, 0.03, 0.12, -0.08, 0.8, 0, RENK.sodyumAcik)]),
      huzme: f.huzme
    };
  },
  dolmus: () => {
    const f = farlar(1.11, 0.32, 0.28, 1.9);
    return {
      govde: [
        k(2.2, 0.62, 0.82, 0, 0.43, 0, RENK.krem),
        k(2.0, 0.06, 0.76, -0.05, 0.77, 0, RENK.kemik),
        k(1.7, 0.2, 0.84, -0.15, 0.6, 0, RENK.kagit2),
        k(0.03, 0.22, 0.7, 1.1, 0.6, 0, RENK.kagit2),
        k(2.22, 0.08, 0.84, 0, 0.33, 0, RENK.kor),
        k(0.06, 0.1, 0.86, 1.11, 0.18, 0, RENK.cizgi), k(0.06, 0.1, 0.86, -1.11, 0.18, 0, RENK.cizgi)
      ].concat(tekerler(2.2, 0.82, 0.7)),
      isik: f.isik.concat([k(2.4, 0.005, 1.04, 0, 0.008, 0, RENK.murekkep)]),
      huzme: f.huzme
    };
  },
  tramvay: () => {
    const g = [], isik = [];
    for (const cx of [-1.8, 1.8]) {
      g.push(k(3.4, 0.86, 0.9, cx, 0.6, 0, RENK.krem));
      g.push(k(3.42, 0.12, 0.92, cx, 0.3, 0, RENK.kor));
      g.push(k(3.42, 0.06, 0.92, cx, 1.0, 0, RENK.kor));
      g.push(k(3.2, 0.08, 0.8, cx, 1.07, 0, RENK.kagit2));
      g.push(k(0.9, 0.14, 0.5, cx - 0.8, 1.15, 0, RENK.soluk));
      g.push(k(0.5, 0.12, 0.7, cx - 1, 0.12, 0, RENK.murekkep), k(0.5, 0.12, 0.7, cx + 1, 0.12, 0, RENK.murekkep));
      // Sıcak iç ışıklı pencereler
      for (let i = 0; i < 4; i++) isik.push(k(0.6, 0.26, 0.92, cx - 1.2 + i * 0.8, 0.72, 0, RENK.sodyumAcik));
    }
    g.push(k(0.24, 0.6, 0.7, 0, 0.55, 0, RENK.cizgi));
    g.push(k(0.06, 0.34, 0.06, 1.8, 1.27, 0, RENK.cizgi), k(0.7, 0.04, 0.34, 1.8, 1.45, 0, RENK.cizgi));
    const f = farlar(3.51, 0.42, 0.28, 2.6);
    return { govde: g, isik: isik.concat(f.isik, [k(7.4, 0.005, 1.1, 0, 0.008, 0, RENK.murekkep)]), huzme: f.huzme };
  },
  vapur: () => ({
    govde: [
      k(4, 0.3, 0.95, 0, -0.02, 0, RENK.cizgi),
      k(0.4, 0.22, 0.66, 2.1, 0.0, 0, RENK.cizgi),
      k(3.6, 0.34, 0.86, 0, 0.3, 0, RENK.krem),
      k(3.86, 0.04, 0.95, 0, 0.48, 0, RENK.kemik),
      k(3.4, 0.05, 0.1, 0, 0.52, 0.4, RENK.ceviz), k(3.4, 0.05, 0.1, 0, 0.52, -0.4, RENK.ceviz),
      k(0.16, 0.06, 0.06, -1.2, 0.36, 0.48, RENK.kor), k(0.16, 0.06, 0.06, 1.2, 0.36, 0.48, RENK.kor),
      k(0.32, 0.42, 0.24, 0.25, 0.7, -0.34, RENK.murekkep),
      k(0.33, 0.07, 0.25, 0.25, 0.82, -0.34, RENK.krem),
      k(0.04, 0.4, 0.04, 1.8, 0.7, 0.36, RENK.cizgi), k(0.04, 0.4, 0.04, -1.8, 0.7, 0.36, RENK.cizgi)
    ],
    isik: [
      k(3.2, 0.1, 0.88, 0, 0.32, 0, RENK.sodyumAcik),
      k(0.08, 0.08, 0.08, 1.8, 0.92, 0.36, RENK.sodyum), k(0.08, 0.08, 0.08, -1.8, 0.92, 0.36, RENK.kor),
      k(4.3, 0.005, 1.15, 0, 0.0, 0, RENK.murekkep)
    ],
    huzme: isikGeo([], [[0, 0, 1.7, 0.42, 2.5, 1.05, 0.01]])
  }),
  sandal: () => ({
    govde: [
      k(1.8, 0.2, 0.7, 0, 0.0, 0, RENK.ceviz),
      k(0.3, 0.16, 0.46, 1.0, 0.02, 0, RENK.ceviz), k(0.2, 0.14, 0.4, -0.98, 0.02, 0, RENK.ceviz),
      k(1.6, 0.02, 0.52, 0, 0.1, 0, karistir(RENK.ceviz, RENK.murekkep, 0.35)),
      k(0.1, 0.04, 0.62, 0.45, 0.12, 0, RENK.kemik), k(0.1, 0.04, 0.62, -0.45, 0.12, 0, RENK.kemik),
      k(0.03, 0.22, 0.03, -0.85, 0.22, 0.2, RENK.cizgi)
    ],
    isik: [k(0.09, 0.1, 0.09, -0.85, 0.36, 0.2, RENK.sodyum), k(2.1, 0.005, 0.9, 0, 0.0, 0, RENK.murekkep)],
    huzme: isikGeo([], [[-0.85, 0.2, 0.05, 0.05, 0.75, 0.75, 0.01]])
  })
};

// ---------- Karakterler (-z yönüne bakar, ayaklar y=0) ----------
const KARAKTER_TARIF = {
  simitci: () => ({
    govde: [
      k(0.14, 0.22, 0.16, -0.09, 0.11, 0, RENK.cizgi), k(0.14, 0.22, 0.16, 0.09, 0.11, 0, RENK.cizgi),
      k(0.42, 0.3, 0.28, 0, 0.37, 0, RENK.krem),
      k(0.09, 0.26, 0.12, -0.255, 0.38, 0, RENK.krem), k(0.09, 0.26, 0.12, 0.255, 0.38, 0, RENK.krem),
      k(0.09, 0.07, 0.1, -0.255, 0.22, 0, RENK.kum), k(0.09, 0.07, 0.1, 0.255, 0.22, 0, RENK.kum),
      k(0.3, 0.26, 0.28, 0, 0.65, 0, RENK.kum),
      k(0.32, 0.07, 0.3, 0, 0.79, 0.01, RENK.murekkep),
      k(0.05, 0.05, 0.01, -0.07, 0.67, -0.145, RENK.murekkep), k(0.05, 0.05, 0.01, 0.07, 0.67, -0.145, RENK.murekkep),
      k(0.62, 0.04, 0.5, 0, 0.845, 0, RENK.ceviz),
      k(0.17, 0.06, 0.17, -0.15, 0.895, -0.11, RENK.sodyumGolge), k(0.17, 0.06, 0.17, 0.15, 0.895, -0.11, RENK.sodyumGolge),
      k(0.17, 0.06, 0.17, -0.15, 0.895, 0.11, RENK.sodyumGolge), k(0.17, 0.06, 0.17, 0.15, 0.895, 0.11, RENK.sodyumGolge),
      k(0.17, 0.06, 0.17, 0, 0.955, 0, RENK.sodyumGolge)
    ]
  }),
  kedi: () => ({
    govde: [
      k(0.08, 0.1, 0.08, -0.1, 0.05, -0.12, RENK.sodyum), k(0.08, 0.1, 0.08, 0.1, 0.05, -0.12, RENK.sodyum),
      k(0.08, 0.1, 0.08, -0.1, 0.05, 0.2, RENK.sodyum), k(0.08, 0.1, 0.08, 0.1, 0.05, 0.2, RENK.sodyum),
      k(0.32, 0.24, 0.5, 0, 0.2, 0.04, RENK.sodyum),
      k(0.33, 0.25, 0.05, 0, 0.2, 0.0, RENK.sodyumGolge), k(0.33, 0.25, 0.05, 0, 0.2, 0.16, RENK.sodyumGolge),
      k(0.3, 0.26, 0.26, 0, 0.42, -0.24, RENK.sodyum),
      k(0.31, 0.04, 0.27, 0, 0.5, -0.24, RENK.sodyumGolge),
      k(0.07, 0.09, 0.05, -0.09, 0.59, -0.24, RENK.sodyum), k(0.07, 0.09, 0.05, 0.09, 0.59, -0.24, RENK.sodyum),
      k(0.04, 0.03, 0.02, 0, 0.39, -0.375, RENK.kor),
      k(0.07, 0.32, 0.07, 0, 0.4, 0.3, RENK.sodyum), k(0.075, 0.08, 0.075, 0, 0.56, 0.3, RENK.sodyumGolge)
    ],
    isik: [k(0.05, 0.05, 0.01, -0.07, 0.45, -0.375, RENK.yaprak), k(0.05, 0.05, 0.01, 0.07, 0.45, -0.375, RENK.yaprak)]
  }),
  marti: () => ({
    govde: martiParcalari(true)
  }),
  hamal: () => ({
    govde: [
      k(0.14, 0.22, 0.16, -0.09, 0.11, 0, RENK.ceviz), k(0.14, 0.22, 0.16, 0.09, 0.11, 0, RENK.ceviz),
      k(0.42, 0.3, 0.28, 0, 0.37, 0, RENK.kemik),
      k(0.43, 0.16, 0.29, 0, 0.44, 0, RENK.cizgi),
      k(0.09, 0.26, 0.12, -0.255, 0.38, 0, RENK.kemik), k(0.09, 0.26, 0.12, 0.255, 0.38, 0, RENK.kemik),
      k(0.09, 0.07, 0.1, -0.255, 0.22, 0, RENK.kum), k(0.09, 0.07, 0.1, 0.255, 0.22, 0, RENK.kum),
      k(0.3, 0.26, 0.28, 0, 0.65, -0.02, RENK.kum),
      k(0.16, 0.04, 0.02, 0, 0.6, -0.165, RENK.murekkep),
      k(0.05, 0.05, 0.01, -0.07, 0.68, -0.165, RENK.murekkep), k(0.05, 0.05, 0.01, 0.07, 0.68, -0.165, RENK.murekkep),
      k(0.32, 0.08, 0.3, 0, 0.8, -0.02, RENK.cizgi),
      k(0.46, 0.44, 0.14, 0, 0.47, 0.21, RENK.kum),
      k(0.52, 0.36, 0.38, 0, 0.86, 0.3, RENK.ceviz),
      k(0.54, 0.04, 0.4, 0, 0.86, 0.3, RENK.kum),
      k(0.36, 0.24, 0.3, 0.03, 1.16, 0.3, RENK.kemik)
    ]
  })
};

function martiParcalari(kanatlarla) {
  const p = [
    k(0.05, 0.14, 0.05, -0.08, 0.07, 0, RENK.sodyum), k(0.05, 0.14, 0.05, 0.08, 0.07, 0, RENK.sodyum),
    k(0.32, 0.3, 0.48, 0, 0.3, 0.02, RENK.krem),
    k(0.24, 0.22, 0.24, 0, 0.55, -0.14, RENK.krem),
    k(0.08, 0.06, 0.16, 0, 0.52, -0.33, RENK.sodyum), k(0.03, 0.03, 0.03, 0, 0.5, -0.38, RENK.kor),
    k(0.04, 0.04, 0.01, -0.07, 0.58, -0.265, RENK.murekkep), k(0.04, 0.04, 0.01, 0.07, 0.58, -0.265, RENK.murekkep),
    k(0.2, 0.06, 0.16, 0, 0.3, 0.32, RENK.soluk)
  ];
  if (kanatlarla) {
    p.push(k(0.06, 0.2, 0.4, -0.19, 0.33, 0.04, RENK.soluk), k(0.06, 0.2, 0.4, 0.19, 0.33, 0.04, RENK.soluk));
    p.push(k(0.065, 0.08, 0.12, -0.19, 0.3, 0.24, RENK.murekkep), k(0.065, 0.08, 0.12, 0.19, 0.3, 0.24, RENK.murekkep));
  }
  return p;
}

// ---------- Kaldırım engelleri (hücre merkezinde, kaldırım üstünde) ----------
const ENGEL_TARIF = {
  tezgah: () => ({
    govde: [
      k(0.1, 0.18, 0.1, -0.3, 0.09, 0.22, RENK.murekkep), k(0.1, 0.18, 0.1, 0.3, 0.09, 0.22, RENK.murekkep),
      k(0.1, 0.18, 0.1, -0.3, 0.09, -0.22, RENK.murekkep), k(0.1, 0.18, 0.1, 0.3, 0.09, -0.22, RENK.murekkep),
      k(0.8, 0.26, 0.56, 0, 0.3, 0, RENK.ceviz),
      k(0.72, 0.32, 0.48, 0, 0.6, 0, RENK.kagit2),
      k(0.03, 0.34, 0.03, -0.36, 0.6, -0.24, RENK.krem), k(0.03, 0.34, 0.03, 0.36, 0.6, -0.24, RENK.krem),
      k(0.03, 0.34, 0.03, -0.36, 0.6, 0.24, RENK.krem), k(0.03, 0.34, 0.03, 0.36, 0.6, 0.24, RENK.krem),
      k(0.18, 0.06, 0.18, -0.16, 0.5, 0, RENK.sodyumGolge), k(0.18, 0.06, 0.18, 0.16, 0.5, 0, RENK.sodyumGolge),
      k(0.18, 0.06, 0.18, 0, 0.56, 0.05, RENK.sodyumGolge),
      k(0.03, 0.3, 0.03, -0.36, 0.92, 0, RENK.cizgi), k(0.03, 0.3, 0.03, 0.36, 0.92, 0, RENK.cizgi),
      k(0.96, 0.06, 0.7, 0, 1.08, 0, RENK.kor), k(0.96, 0.08, 0.04, 0, 1.03, -0.34, RENK.krem)
    ],
    isik: [k(0.08, 0.08, 0.08, 0, 1.0, 0, RENK.sodyumAcik)]
  }),
  cop: () => ({
    govde: [
      k(0.38, 0.5, 0.38, 0, 0.25, 0, RENK.cim),
      k(0.42, 0.06, 0.42, 0, 0.53, 0, RENK.cizgi),
      k(0.39, 0.04, 0.39, 0, 0.36, 0, karistir(RENK.cim, RENK.murekkep, 0.4))
    ]
  }),
  agac: () => ({
    govde: [
      k(0.64, 0.28, 0.64, 0, 0.14, 0, RENK.tasKoyu),
      k(0.56, 0.03, 0.56, 0, 0.29, 0, RENK.ceviz),
      k(0.14, 0.6, 0.14, 0, 0.55, 0, RENK.ceviz),
      k(0.8, 0.5, 0.8, 0, 1.0, 0, RENK.cim),
      k(0.56, 0.36, 0.56, 0.06, 1.38, -0.04, RENK.yaprak)
    ]
  }),
  bank: () => ({
    govde: [
      k(0.06, 0.2, 0.3, -0.36, 0.1, 0, RENK.murekkep), k(0.06, 0.2, 0.3, 0.36, 0.1, 0, RENK.murekkep),
      k(0.86, 0.04, 0.12, 0, 0.22, -0.08, RENK.ceviz), k(0.86, 0.04, 0.12, 0, 0.22, 0.07, RENK.ceviz),
      k(0.06, 0.3, 0.06, -0.36, 0.36, 0.14, RENK.murekkep), k(0.06, 0.3, 0.06, 0.36, 0.36, 0.14, RENK.murekkep),
      k(0.86, 0.1, 0.04, 0, 0.4, 0.15, RENK.ceviz)
    ]
  }),
  kedi: () => ({
    govde: [
      k(0.5, 0.26, 0.42, 0, 0.13, 0, RENK.kum),
      k(0.52, 0.02, 0.44, 0, 0.27, 0, karistir(RENK.kum, RENK.ceviz, 0.4)),
      k(0.36, 0.14, 0.26, 0, 0.35, 0.02, RENK.sodyum),
      k(0.37, 0.15, 0.05, 0, 0.35, 0.06, RENK.sodyumGolge),
      k(0.2, 0.15, 0.18, -0.2, 0.36, -0.06, RENK.sodyum),
      k(0.05, 0.06, 0.04, -0.25, 0.46, -0.1, RENK.sodyum), k(0.05, 0.06, 0.04, -0.15, 0.46, -0.1, RENK.sodyum),
      k(0.3, 0.06, 0.06, 0.12, 0.31, -0.14, RENK.sodyum, 0.3)
    ]
  })
};

// Sokak lambası: direk, kol ve sodyum lamba başlığı; ışık havuzu ayrı.
const LAMBA_TARIF = (yon) => ({
  govde: [
    k(0.22, 0.12, 0.22, 0, 0.06, 0, RENK.cizgi),
    k(0.1, 2.4, 0.1, 0, 1.2, 0, RENK.cizgi),
    k(0.95, 0.07, 0.07, yon * 0.45, 2.36, 0, RENK.cizgi),
    k(0.4, 0.12, 0.26, yon * 0.88, 2.32, 0, RENK.cizgi)
  ],
  isik: [k(0.32, 0.04, 0.18, yon * 0.88, 2.25, 0, RENK.sodyumAcik)]
});

// ---------- Sahne ----------
export function sahneOlustur(tuval, ayar) {
  const hareketAz = !!ayar.hareketAz;
  const renderer = new THREE.WebGLRenderer(Kalite.rendererSecenek({ canvas: tuval, powerPreference: 'high-performance' }));
  renderer.setClearColor(RENK.murekkep, 1);
  const kalite = Kalite.kur(renderer, { azami: 2, boyutla: () => boyutla() });

  const sahne = new THREE.Scene();
  sahne.fog = new THREE.Fog(RENK.murekkep, 17, 27);

  // Işık: sıcak sodyum ana ışık sağ üstten, soğuk ay dolgu ışığı, düşük ortam.
  const ortam = new THREE.AmbientLight(RENK.kemik, 0.4);
  const ay = new THREE.HemisphereLight(RENK.ay, RENK.murekkep, 0.95);
  const gunes = new THREE.DirectionalLight(RENK.sodyumAcik, 1.25);
  gunes.position.set(5, 10, 3);
  sahne.add(ortam, ay, gunes, gunes.target);
  const ortamRengi = new THREE.Color(RENK.kemik), korRengi = new THREE.Color(RENK.kor);

  // Sokak lambalarının gerçek ışığı: en yakın lambalara taşınan birkaç noktasal ışık.
  const lambaIsiklari = [];
  for (let i = 0; i < 3; i++) {
    const l = new THREE.PointLight(RENK.sodyum, 0, 5.5, 1.2);
    sahne.add(l);
    lambaIsiklari.push(l);
  }

  // Ortografik izometrik kamera.
  const kamera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 60);
  const KAMERA_OFSET = new THREE.Vector3(2.3, 11, 7.6);
  const kameraHedef = new THREE.Vector3(0, 0, -3);
  let gorusGenisligi = 11;
  function boyutla() {
    const en = tuval.clientWidth || 1, boy = tuval.clientHeight || 1;
    renderer.setSize(en, boy, false);
    const oran = en / boy;
    // Dar ekranda daha az, geniş ekranda daha çok sütun görünür.
    gorusGenisligi = oran < 1 ? 9.6 : Math.min(15, 8.6 * oran);
    const yaris = gorusGenisligi / 2;
    kamera.left = -yaris; kamera.right = yaris;
    kamera.top = yaris / oran; kamera.bottom = -yaris / oran;
    kamera.updateProjectionMatrix();
  }

  // ---------- Şerit grafikleri ----------
  const seritler = new Map(); // satır → { grup, dinamik: [...], ... }

  function zeminParcalari(serit, onceki, sonraki) {
    const tur = serit ? serit.tur : 'kaldirim';
    const ust = ZEMIN[tur], h = ust - TABAN, y = TABAN + h / 2;
    const anaRenk = { kaldirim: RENK.cizgi, yol: RENK.kagit2, ray: RENK.kagit2, su: SU_RENGI }[tur];
    const kenarRenk = karistir(anaRenk, RENK.murekkep, 0.45);
    const p = [], isik = [];
    const ic = 2 * 4 + 1, dis = GENIS - ic / 2;
    p.push(k(ic, h, 1, 0, y, 0, anaRenk));
    p.push(k(dis, h, 1, -(ic / 2 + dis / 2), y, 0, kenarRenk), k(dis, h, 1, ic / 2 + dis / 2, y, 0, kenarRenk));
    const ilerisiAyni = sonraki && sonraki.tur === tur, gerisiAyni = onceki && onceki.tur === tur;
    if (tur === 'kaldirim') {
      // Kaldırım taşı derzleri ve bordür taşları
      for (let c = -10; c <= 9; c++) p.push(k(0.03, 0.01, 0.97, c + 0.5, ust + 0.003, 0, Math.abs(c) < 5 ? RENK.kagit2 : karistir(RENK.kagit2, RENK.murekkep, 0.4)));
      if (!ilerisiAyni) p.push(k(2 * GENIS, 0.05, 0.1, 0, ust + 0.02, -0.45, BORDUR));
      if (!gerisiAyni) p.push(k(2 * GENIS, 0.05, 0.1, 0, ust + 0.02, 0.45, BORDUR));
      if (ilerisiAyni) p.push(k(2 * GENIS, 0.006, 0.03, 0, ust + 0.003, -0.5, RENK.kagit2));
    } else if (tur === 'yol') {
      // Kesik şerit çizgisi: krem %40
      if (ilerisiAyni) {
        const cizgi = karistir(RENK.kagit2, RENK.krem, 0.4);
        for (let x = -GENIS + 0.5; x < GENIS; x += 1.6) p.push(k(0.7, 0.012, 0.07, x, ust + 0.006, -0.5, cizgi));
      }
      const r = rnd(serit.satir * 7919 + 3);
      if (r() < 0.3) p.push(k(0.42, 0.01, 0.42, Math.floor(r() * 9) - 4, ust + 0.005, (r() - 0.5) * 0.3, RENK.tasKoyu));
    } else if (tur === 'ray') {
      p.push(k(2 * GENIS, 0.03, 0.8, 0, ust + 0.015, 0, RENK.tasKoyu));
      for (let x = -GENIS + 0.3; x < GENIS; x += 0.5) p.push(k(0.18, 0.05, 0.74, x, ust + 0.04, 0, RENK.ceviz));
      p.push(k(2 * GENIS, 0.08, 0.07, 0, ust + 0.1, -0.24, RENK.soluk), k(2 * GENIS, 0.08, 0.07, 0, ust + 0.1, 0.24, RENK.soluk));
      // Katener direkleri ve tel
      p.push(k(0.1, 2.5, 0.1, -5.6, ust + 1.25, 0.42, RENK.cizgi), k(0.1, 2.5, 0.1, 5.6, ust + 1.25, 0.42, RENK.cizgi));
    } else if (tur === 'su') {
      if (!ilerisiAyni) p.push(k(2 * GENIS, 0.012, 0.06, 0, ust + 0.006, -0.47, RENK.iznik));
      if (!gerisiAyni) p.push(k(2 * GENIS, 0.012, 0.06, 0, ust + 0.006, 0.47, RENK.iznik));
    }
    return { govde: p, isik };
  }

  // Sınır dışındaki kaldırım süsleri: ağaç, bank, çöp kutusu (oyunu etkilemez).
  function susParcalari(serit) {
    const r = rnd(serit.satir * 2654435761 + 11);
    const parcalar = [];
    for (const taraf of [-1, 1]) {
      for (let c = 6; c <= 12; c++) {
        if (r() > 0.32) continue;
        const sec = r();
        const tip = sec < 0.55 ? 'agac' : sec < 0.8 ? 'bank' : 'cop';
        parcalar.push({ tip, x: taraf * c });
      }
    }
    return parcalar;
  }

  function seritKur(satir, serit, onceki, sonraki) {
    const grup = new THREE.Group();
    grup.position.z = -satir;
    const kayit = { satir, serit, grup, dinamik: [], simitler: new Map(), lamba: null, sinyaller: [] };
    const zemin = zeminParcalari(serit, onceki, sonraki);
    const zeminGeo = { govde: birlestir(zemin.govde) };
    kayit.geometriler = [zeminGeo.govde];
    grup.add(new THREE.Mesh(zeminGeo.govde, MALZEME.govde));
    const tur = serit ? serit.tur : 'kaldirim';
    const ust = ZEMIN[tur];

    if (tur === 'kaldirim') {
      const engeller = serit ? serit.engeller : [];
      for (const e of engeller) {
        const m = model('engel-' + e.tip, ENGEL_TARIF[e.tip]);
        m.position.set(e.sutun, ust, 0);
        if (e.tip === 'bank' || e.tip === 'kedi') m.rotation.y = (e.sutun * 37 % 2) ? Math.PI : 0;
        grup.add(m);
      }
      for (const s of susParcalari(serit || { satir })) {
        const m = model('engel-' + s.tip, ENGEL_TARIF[s.tip]);
        m.position.set(s.x, ust, 0);
        grup.add(m);
      }
      if (satir < 0) {
        // Başlangıcın arkası: alçak taş duvar ve ağaç sırası (geri gidilemez).
        if (satir === -1) {
          const duvar = birlestir([k(2 * GENIS, 0.4, 0.4, 0, ust + 0.2, 0.1, RENK.tasKoyu), k(2 * GENIS, 0.05, 0.46, 0, ust + 0.42, 0.1, RENK.tasAcik)]);
          kayit.geometriler.push(duvar);
          grup.add(new THREE.Mesh(duvar, MALZEME.govde));
        }
        if (satir === -2) for (let c = -10; c <= 10; c += 2) {
          const m = model('engel-agac', ENGEL_TARIF.agac);
          m.position.set(c + (satir % 2), ust, 0);
          grup.add(m);
        }
      }
      if (serit && serit.lamba != null) {
        const yon = serit.lamba < 0 ? 1 : -1;
        const m = model('lamba' + yon, () => LAMBA_TARIF(yon));
        m.position.set(serit.lamba, ust, 0.2);
        grup.add(m);
        // Sahte ışık havuzu: üst üste üç toplanır disk, ortası daha parlak.
        const merkezX = serit.lamba + yon * 0.88;
        for (const [r, o] of [[2.6, 0], [1.7, 0.01], [0.95, 0.02]]) {
          const disk = new THREE.Mesh(HAVUZ_GEO, MALZEME.havuz);
          disk.scale.set(r, r, 1);
          disk.rotation.x = -Math.PI / 2;
          disk.position.set(merkezX, ust + 0.02 + o, 0.2);
          disk.renderOrder = 1;
          grup.add(disk);
        }
        kayit.lamba = new THREE.Vector3(merkezX, ust + 2.1, -satir + 0.2);
      }
    }

    if (serit && (tur === 'yol' || tur === 'ray' || tur === 'su')) {
      serit.nesneler.forEach((n, i) => {
        const m = model('arac-' + n.tip, ARAC_TARIF[n.tip]);
        m.rotation.y = serit.yon > 0 ? 0 : Math.PI;
        m.position.y = ust;
        grup.add(m);
        kayit.dinamik.push({ mesh: m, nesne: n, faz: i * 1.7 + satir });
      });
    }
    if (tur === 'su') {
      const dalga = new THREE.Mesh(DALGA_GEO, MALZEME.dalga);
      dalga.position.y = ust + 0.004;
      dalga.renderOrder = 1;
      grup.add(dalga);
      kayit.dalga = dalga;
    }
    if (tur === 'ray') {
      // Hemzemin geçit uyarı lambaları: tramvay yaklaşınca kor yanıp söner.
      for (const x of [-5.2, 5.2]) {
        const direk = model('sinyal-direk', () => ({ govde: [k(0.08, 0.9, 0.08, 0, 0.45, 0, RENK.cizgi), k(0.26, 0.2, 0.1, 0, 0.92, 0, RENK.murekkep)] }));
        direk.position.set(x, ust, -0.42);
        grup.add(direk);
        const lamba = new THREE.Mesh(SINYAL_GEO, new THREE.MeshBasicMaterial({ color: RENK.tasKoyu }));
        lamba.position.set(x, ust + 0.92, -0.36);
        grup.add(lamba);
        const parilti = new THREE.Mesh(HAVUZ_GEO, new THREE.MeshBasicMaterial({ color: RENK.kor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        parilti.rotation.x = -Math.PI / 2;
        parilti.scale.set(1.3, 1.3, 1);
        parilti.position.set(x, ust + 0.02, -0.1);
        grup.add(parilti);
        kayit.sinyaller.push({ lamba, parilti });
      }
    }
    if (serit) for (const c of serit.simitler) {
      const s = simitYap();
      s.position.set(c, ust + 0.32, 0);
      grup.add(s);
      kayit.simitler.set(c, s);
    }
    sahne.add(grup);
    return kayit;
  }

  const HAVUZ_GEO = new THREE.CircleGeometry(1, 20);
  const SINYAL_GEO = new THREE.BoxGeometry(0.1, 0.1, 0.03);
  // Dalga çizgileri 4 birimde bir tekrar eder; böylece kaydırma dikişsizdir.
  const DALGA_GEO = (() => {
    const p = [];
    for (let x = -GENIS - 4; x < GENIS + 4; x += 4) {
      p.push(k(1.3, 0.004, 0.06, x + 0.4, 0, -0.26, RENK.ay), k(0.7, 0.004, 0.05, x + 2.2, 0, 0.06, RENK.ay), k(1.0, 0.004, 0.06, x + 3.1, 0, 0.32, RENK.ay));
    }
    return birlestir(p);
  })();
  const SIMIT_GEO = new THREE.TorusGeometry(0.2, 0.085, 6, 14);
  const SIMIT_MAT = new THREE.MeshLambertMaterial({ color: RENK.sodyumGolge, flatShading: true, emissive: RENK.sodyumGolge, emissiveIntensity: 0.35 });
  const SUSAM_GEO = (() => {
    const p = [];
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2;
      p.push(k(0.035, 0.035, 0.035, Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.08, RENK.kemik));
    }
    return birlestir(p);
  })();
  function simitYap() {
    const g = new THREE.Group();
    const halka = new THREE.Mesh(SIMIT_GEO, SIMIT_MAT);
    halka.rotation.order = 'YXZ';
    halka.rotation.x = -0.75; // kameraya doğru yatık: deliği görünsün
    halka.add(new THREE.Mesh(SUSAM_GEO, MALZEME.govde));
    g.add(halka);
    const disk = new THREE.Mesh(HAVUZ_GEO, MALZEME.havuz);
    disk.rotation.x = -Math.PI / 2;
    disk.scale.set(0.55, 0.55, 1);
    disk.position.y = -0.3;
    g.add(disk);
    g.userData.halka = halka;
    return g;
  }

  function seritSil(kayit) {
    sahne.remove(kayit.grup);
    for (const g of kayit.geometriler) g.dispose();
    for (const s of kayit.sinyaller) { s.lamba.material.dispose(); s.parilti.material.dispose(); }
  }

  let uretici = null;
  function dunyaKur(yeniUretici) {
    for (const kayit of seritler.values()) seritSil(kayit);
    seritler.clear();
    uretici = yeniUretici;
  }

  // Görünür satır aralığını kurar, aralık dışını siler.
  function seritleriAyarla(alt, ust) {
    for (const [satir, kayit] of seritler) if (satir < alt || satir > ust) { seritSil(kayit); seritler.delete(satir); }
    for (let s = alt; s <= ust; s++) {
      if (seritler.has(s)) continue;
      const serit = s >= 0 ? uretici.seritAl(s) : null;
      seritler.set(s, seritKur(s, serit, s > 0 ? uretici.seritAl(s - 1) : null, s >= -1 ? uretici.seritAl(s + 1) : null));
    }
  }

  function seritKaydi(satir) { return seritler.get(satir); }

  // Hareketli nesneleri, dalgaları, simitleri ve sinyalleri zamana göre yerleştirir.
  function nesneleriGuncelle(t, M, uyarilar) {
    for (const kayit of seritler.values()) {
      const serit = kayit.serit;
      if (!serit) continue;
      for (const d of kayit.dinamik) {
        d.mesh.position.x = M.nesneKonumu(serit, d.nesne, t);
        if (serit.tur === 'su') {
          const sallanti = hareketAz ? 0 : Math.sin(t * 2.2 + d.faz) * 0.025;
          d.mesh.position.y = ZEMIN.su + sallanti;
          d.sallanti = sallanti;
          d.mesh.rotation.x = hareketAz ? 0 : Math.sin(t * 1.7 + d.faz) * 0.03;
        }
      }
      if (kayit.dalga && !hareketAz) kayit.dalga.position.x = ((t * serit.yon * serit.hiz * 0.35) % 4 + 4) % 4;
      for (const s of kayit.simitler.values()) {
        if (s.userData.toplandi) continue;
        s.userData.halka.rotation.y = Math.sin(t * 2.2 + serit.satir) * 0.7;
        s.position.y = ZEMIN[serit.tur] + 0.34 + (hareketAz ? 0 : Math.sin(t * 3 + serit.satir) * 0.05);
      }
      if (kayit.sinyaller.length) {
        const yaklasiyor = uyarilar && uyarilar.has(serit.satir);
        const yanik = yaklasiyor && Math.floor(t * 4) % 2 === 0;
        for (const s of kayit.sinyaller) {
          s.lamba.material.color.setHex(yanik ? RENK.kor : RENK.tasKoyu);
          s.parilti.material.opacity = yanik ? 0.22 : 0;
        }
      }
    }
  }

  // Bir satırdaki teknenin anlık sallantısı (oyuncu da onunla sallanır).
  function tekneSallantisi(satir, idx) {
    const kayit = seritler.get(satir);
    const d = kayit && kayit.dinamik[idx];
    return d && d.sallanti ? d.sallanti : 0;
  }

  // Noktasal lamba ışıklarını oyuncuya en yakın lambalara taşır.
  function lambalariYerlestir(z) {
    const lambalar = [];
    for (const kayit of seritler.values()) if (kayit.lamba) lambalar.push(kayit.lamba);
    lambalar.sort((a, b) => Math.abs(a.z - z) - Math.abs(b.z - z));
    lambaIsiklari.forEach((l, i) => {
      const lamba = lambalar[i];
      if (lamba) { l.position.copy(lamba); l.intensity = 9; } else l.intensity = 0;
    });
  }

  // ---------- Oyuncu ----------
  const oyuncuKap = new THREE.Group();   // konum
  const oyuncuGovde = new THREE.Group(); // dönüş ve ezilme-esneme
  oyuncuKap.add(oyuncuGovde);
  const oyuncuGolge = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), MALZEME.golge);
  oyuncuGolge.rotation.x = -Math.PI / 2;
  sahne.add(oyuncuKap, oyuncuGolge);
  let oyuncuModel = null;

  function karakterModeli(id) { return model('karakter-' + id, KARAKTER_TARIF[id]); }
  function oyuncuyuAyarla(id) {
    if (oyuncuModel) oyuncuGovde.remove(oyuncuModel);
    oyuncuModel = karakterModeli(id);
    oyuncuGovde.add(oyuncuModel);
  }

  // durum: { x, y, z, zeminY, yonAci, sx, sy, gorunur }
  function oyuncuyuCiz(d) {
    oyuncuKap.position.set(d.x, d.y, d.z);
    oyuncuKap.visible = d.gorunur !== false;
    oyuncuGovde.rotation.y = d.yonAci;
    oyuncuGovde.rotation.z = d.egim || 0;
    oyuncuGovde.scale.set(d.sx * OYUNCU_OLCEK, d.sy * OYUNCU_OLCEK, d.sx * OYUNCU_OLCEK);
    const yukseklik = Math.max(0, d.y - d.zeminY);
    oyuncuGolge.position.set(d.x, d.zeminY + 0.012, d.z);
    const g = Math.max(0.4, 1 - yukseklik * 0.6);
    oyuncuGolge.scale.set(g * d.sx, g * d.sx, 1);
    oyuncuGolge.visible = oyuncuKap.visible && d.golge !== false;
  }

  // ---------- Koca martı (bekleyeni kapan) ----------
  const koca = new THREE.Group();
  const kocaGovde = new THREE.Mesh(birlestir(martiParcalari(false)), MALZEME.govde);
  const kanatGeo = birlestir([k(0.7, 0.06, 0.4, 0.35, 0, 0, RENK.krem), k(0.45, 0.06, 0.32, 0.9, 0, 0.03, RENK.soluk), k(0.22, 0.062, 0.26, 1.18, 0, 0.05, RENK.murekkep)]);
  const kanatSol = new THREE.Mesh(kanatGeo, MALZEME.govde), kanatSag = new THREE.Mesh(kanatGeo, MALZEME.govde);
  kanatSol.position.set(-0.15, 0.38, 0.02); kanatSag.position.set(0.15, 0.38, 0.02);
  kanatSol.scale.x = -1;
  koca.add(kocaGovde, kanatSol, kanatSag);
  koca.scale.setScalar(1.9);
  koca.rotation.order = 'YXZ';
  koca.visible = false;
  const kocaGolge = new THREE.Mesh(HAVUZ_GEO, MALZEME.golge);
  kocaGolge.rotation.x = -Math.PI / 2;
  kocaGolge.visible = false;
  sahne.add(koca, kocaGolge);

  // durum: { gorunur, x, y, z, kanat, golgeX, golgeZ, golgeY, golgeBoyu, aci }
  function kocaMartiCiz(d) {
    koca.visible = !!d.gorunur;
    if (d.gorunur) {
      koca.position.set(d.x, d.y, d.z);
      koca.rotation.y = d.aci || 0;
      koca.rotation.x = -0.45;
      kanatSol.rotation.z = -d.kanat; kanatSag.rotation.z = d.kanat;
    }
    kocaGolge.visible = d.golgeBoyu > 0.05;
    if (kocaGolge.visible) {
      kocaGolge.position.set(d.golgeX, d.golgeY + 0.015, d.golgeZ);
      kocaGolge.scale.set(d.golgeBoyu * 1.4, d.golgeBoyu, 1);
    }
  }

  // ---------- Parçacıklar ----------
  const PARCACIK_GEO = new THREE.BoxGeometry(0.09, 0.09, 0.09);
  const parcaMalzeme = {};
  const parcaciklar = [];
  function parcacikMalzemesi(renk) {
    if (!parcaMalzeme[renk]) parcaMalzeme[renk] = new THREE.MeshBasicMaterial({ color: renk, transparent: true });
    return parcaMalzeme[renk];
  }
  function parcacikSac(x, y, z, renkler, adet, guc) {
    if (hareketAz) return;
    for (let i = 0; i < adet; i++) {
      const m = new THREE.Mesh(PARCACIK_GEO, parcacikMalzemesi(renkler[i % renkler.length]).clone());
      m.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const h = guc * (0.4 + Math.random() * 0.6);
      sahne.add(m);
      parcaciklar.push({ m, vx: Math.cos(a) * h, vz: Math.sin(a) * h, vy: guc * (1 + Math.random() * 1.2), omur: 0.5 + Math.random() * 0.4, yas: 0, zeminY: y - 0.05 });
    }
  }
  function parcaciklariGuncelle(dt) {
    for (let i = parcaciklar.length - 1; i >= 0; i--) {
      const p = parcaciklar[i];
      p.yas += dt;
      p.vy -= 9 * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      if (p.m.position.y < p.zeminY) { p.m.position.y = p.zeminY; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.m.rotation.x += dt * 6; p.m.rotation.y += dt * 4;
      p.m.material.opacity = Math.max(0, 1 - p.yas / p.omur);
      if (p.yas >= p.omur) { sahne.remove(p.m); p.m.material.dispose(); parcaciklar.splice(i, 1); }
    }
  }

  // Suya düşüşte genişleyen halka.
  const HALKA_GEO = new THREE.RingGeometry(0.8, 1, 24);
  const halkalar = [];
  function halkaAc(x, y, z) {
    const m = new THREE.Mesh(HALKA_GEO, new THREE.MeshBasicMaterial({ color: RENK.ay, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y + 0.01, z);
    m.scale.setScalar(0.2);
    sahne.add(m);
    halkalar.push({ m, yas: 0 });
  }
  function halkalariGuncelle(dt) {
    for (let i = halkalar.length - 1; i >= 0; i--) {
      const h = halkalar[i];
      h.yas += dt;
      h.m.scale.setScalar(0.2 + h.yas * 1.6);
      h.m.material.opacity = Math.max(0, 0.6 - h.yas * 0.8);
      if (h.yas > 0.75) { sahne.remove(h.m); h.m.material.dispose(); halkalar.splice(i, 1); }
    }
  }

  // Toplanan simit yukarı fırlayıp küçülür.
  const ucanSimitler = [];
  function simitTopla(satir, sutun) {
    const kayit = seritler.get(satir);
    const s = kayit && kayit.simitler.get(sutun);
    if (!s || s.userData.toplandi) return;
    s.userData.toplandi = true;
    ucanSimitler.push({ s, yas: 0 });
    const p = new THREE.Vector3();
    s.getWorldPosition(p);
    parcacikSac(p.x, p.y, p.z, [RENK.sodyum, RENK.kemik, RENK.sodyumAcik], 8, 1.6);
  }
  function ucanSimitleriGuncelle(dt) {
    for (let i = ucanSimitler.length - 1; i >= 0; i--) {
      const u = ucanSimitler[i];
      u.yas += dt;
      u.s.position.y += dt * 3;
      u.s.userData.halka.rotation.y += dt * 18;
      u.s.scale.setScalar(Math.max(0.01, 1 + u.yas * 1.5 - u.yas * u.yas * 9));
      if (u.yas > 0.4) { u.s.visible = false; ucanSimitler.splice(i, 1); }
    }
  }

  // Simitleri yeniden göster (yeni turda aynı dünya kurulursa).
  function efektleriTemizle() {
    for (const p of parcaciklar) { sahne.remove(p.m); p.m.material.dispose(); }
    parcaciklar.length = 0;
    for (const h of halkalar) { sahne.remove(h.m); h.m.material.dispose(); }
    halkalar.length = 0;
    ucanSimitler.length = 0;
  }

  // ---------- Kamera takibi, sarsıntı ve çarpma tonu ----------
  const sarsinti = { guc: 0 };
  let kor = 0;
  function kameraGuncelle(hedefX, hedefZ, dt, aniden) {
    const a = aniden ? 1 : 1 - Math.exp(-dt * 4.5);
    kameraHedef.x += (hedefX - kameraHedef.x) * a;
    kameraHedef.z += (hedefZ - kameraHedef.z) * a;
    kamera.position.copy(kameraHedef).add(KAMERA_OFSET);
    if (sarsinti.guc > 0.001 && !hareketAz) {
      kamera.position.x += (Math.random() - 0.5) * sarsinti.guc;
      kamera.position.y += (Math.random() - 0.5) * sarsinti.guc;
      sarsinti.guc *= Math.exp(-dt * 9);
    }
    kamera.lookAt(kameraHedef);
    gunes.position.copy(kameraHedef).add(new THREE.Vector3(5, 10, 3));
    gunes.target.position.copy(kameraHedef);
    // Çarpma anında sahne kısa süre kor tonuna kayar.
    if (kor > 0) kor = Math.max(0, kor - dt * 2.2);
    ortam.color.copy(ortamRengi).lerp(korRengi, kor * 0.85);
    ortam.intensity = 0.4 + kor * 0.9;
  }
  function sars(guc) { if (!hareketAz) sarsinti.guc = guc; }
  function korTonu() { if (!hareketAz) kor = 1; }

  function ciz() { renderer.render(sahne, kamera); }

  // ---------- Karakter önizlemeleri (seçim şeridi için küçük resimler) ----------
  // Her karakter ana tuvalin sol alt köşesine çizilir ve aynı görevde 2D tuvale kopyalanır
  // (çizim tamponu korunmadan; ayrı bir WebGL bağlamı ya da piksel okuma gerekmez).
  function onizlemeler(idler, boyut) {
    const kamOn = new THREE.OrthographicCamera(-0.62, 0.62, 0.62, -0.62, 0.1, 20);
    kamOn.position.set(1.6, 1.6, -2.2);
    kamOn.lookAt(0, 0.48, 0);
    const s = new THREE.Scene();
    s.add(new THREE.AmbientLight(RENK.kemik, 0.6), new THREE.HemisphereLight(RENK.ay, RENK.murekkep, 0.8));
    const d = new THREE.DirectionalLight(RENK.sodyumAcik, 1.4);
    d.position.set(2, 4, -3);
    s.add(d);
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
      if (id === 'hamal') { m.scale.setScalar(0.72); m.position.y = -0.08; }
      s.add(m);
      renderer.clear();
      renderer.render(s, kamOn);
      ctx.clearRect(0, 0, boyut, boyut);
      ctx.drawImage(tuval, 0, tuval.height - boyut, boyut, boyut, 0, 0, boyut, boyut);
      sonuc[id] = tuval2.toDataURL('image/png');
      s.remove(m);
    }
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, tam.x, tam.y);
    renderer.setClearColor(RENK.murekkep, 1);
    return sonuc;
  }

  boyutla();
  return {
    renderer, boyutla, dunyaKur, seritleriAyarla, seritKaydi, nesneleriGuncelle, tekneSallantisi, lambalariYerlestir,
    oyuncuyuAyarla, oyuncuyuCiz, kocaMartiCiz, parcacikSac, parcaciklariGuncelle, halkaAc, halkalariGuncelle,
    simitTopla, ucanSimitleriGuncelle, efektleriTemizle, kameraGuncelle, sars, korTonu, ciz, onizlemeler,
    GUVERTE, kalite
  };
}
