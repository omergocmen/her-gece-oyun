// Smaç: three.js sahnesi, kaydır-at kontrolü, HUD, ses ve kayıt. Fizik, atış hesabı ve puan mantik.js'te (SmacMantik).
import * as THREE from 'three';

const M = window.SmacMantik;

// Render kalitesi (piksel oranı üst sınırı, adaptif çözünürlük, Düşük grafik) ortak assets/js/kalite.js'tedir.

// Renkler: DESIGN.md token'ları ve oyun içi ek renk tablosu (Kum, Ceviz, Kemik).
const R = {
  murekkep: '#110f0d', kagit: '#1b1815', kagit2: '#26211c', cizgi: '#3b332b', krem: '#f3ead8', soluk: '#b4a78f',
  sodyum: '#ffb23f', kor: '#ff6a48', ay: '#9db4ff', kum: '#c9a46a', ceviz: '#5a3b24', kemik: '#e9dcc2'
};

const $ = (id) => document.getElementById(id);
const kap = $('sahne');
const hareketAz = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Kayıt ----------
const bugun = M.gunAnahtari();
const MODLAR = ['sure', 'sonsuz', 'gunluk'];
const kayit = Object.assign({ sure: 0, sonsuz: 0, gunluk: 0, enSeri: 0 }, Depo.oku('smac:enIyi', {}));
let gunlukKayit = Depo.oku('smac:gunluk', null);
if (!gunlukKayit || gunlukKayit.tarih !== bugun) gunlukKayit = { tarih: bugun, enIyi: 0 };
kayit.gunluk = gunlukKayit.enIyi;
let mod = Depo.oku('smac:mod', 'sure');
if (!MODLAR.includes(mod)) mod = 'sure';
let kolay = Depo.oku('smac:kolay', false) === true;
let sesAcik = Depo.oku('smac:ses', true) !== false;
function kayitYaz() {
  Depo.yaz('smac:enIyi', { sure: kayit.sure, sonsuz: kayit.sonsuz, gunluk: 0, enSeri: kayit.enSeri });
  Depo.yaz('smac:gunluk', gunlukKayit);
  Depo.ozetYaz('smac', 'En iyi ' + Math.max(kayit.sure, kayit.sonsuz, kayit.gunluk));
}

// ---------- Sahne ----------
const renderer = new THREE.WebGLRenderer(Kalite.rendererSecenek({ powerPreference: 'high-performance' }));
const kalite = Kalite.kur(renderer, { azami: 2, boyutla: () => boyutlandir() });
renderer.setClearColor(R.murekkep);
kap.prepend(renderer.domElement);
const canvas = renderer.domElement;
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', 'Gece mahalle sahasında basketbol potası ve top');

const sahne = new THREE.Scene();
sahne.background = new THREE.Color(R.murekkep);
sahne.fog = new THREE.Fog(R.murekkep, 16, 46);
const kamera = new THREE.PerspectiveCamera(50, 1, 0.1, 80);

// Işık: sodyum anahtar (sokak lambası, üstten) + ay mavisi dolgu + düşük ortam
const anahtar = new THREE.DirectionalLight(R.sodyum, 1.5);
anahtar.position.set(-3, 9, 1);
const dolgu = new THREE.DirectionalLight(R.ay, 0.9);
dolgu.position.set(4, 3, 7);
sahne.add(anahtar, dolgu, new THREE.AmbientLight(R.ay, 0.5));

const kutu = new THREE.BoxGeometry(1, 1, 1);
const duz = (renk, ek) => new THREE.MeshLambertMaterial(Object.assign({ color: renk, flatShading: true }, ek));
const temiz = (renk, opak) => new THREE.MeshBasicMaterial({ color: renk, transparent: opak !== undefined, opacity: opak === undefined ? 1 : opak });
function olcekle(ata, m, x, y, z) { m.scale.set(x, y, z); ata.add(m); return m; }
function parca(geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }

// Zemin: karanlığa çekilmiş Kum
const betonRenk = new THREE.Color(R.kum).multiplyScalar(0.46);
const zemin = parca(new THREE.PlaneGeometry(11, 36), duz(betonRenk), 0, 0, -10);
zemin.rotation.x = -Math.PI / 2;
const cevre = parca(new THREE.PlaneGeometry(120, 120), duz(R.kagit), 0, -0.02, -10);
cevre.rotation.x = -Math.PI / 2;
sahne.add(zemin, cevre);
// Saha çizgileri (krem, yarı saydam)
const cizgiMat = temiz(R.krem, 0.4);
function zeminCizgi(x, z, en, boy) {
  const m = parca(new THREE.PlaneGeometry(en, boy), cizgiMat, x, 0.012, z);
  m.rotation.x = -Math.PI / 2;
  sahne.add(m);
}
zeminCizgi(-4.9, -10, 0.1, 36); zeminCizgi(4.9, -10, 0.1, 36); zeminCizgi(0, -12.6, 9.9, 0.1); zeminCizgi(0, -5, 0.07, 14);
const atisHalka = parca(new THREE.RingGeometry(0.85, 0.93, 32), cizgiMat, M.BASLANGIC.x, 0.014, M.BASLANGIC.z);
atisHalka.rotation.x = -Math.PI / 2;
sahne.add(atisHalka);

// Tel örgü: yan ve arka çit, yalnızca çizgi geometrisi
(() => {
  const p = [];
  const hat = (x0, z0, x1, z1) => {
    const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.6);
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; p.push(x, 0, z, x, 4, z); }
    for (const y of [1.3, 2.6, 4]) p.push(x0, y, z0, x1, y, z1);
  };
  hat(-5.3, 4, -5.3, -12.8); hat(5.3, 4, 5.3, -12.8); hat(-5.3, -12.8, 5.3, -12.8);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  sahne.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: R.soluk, transparent: true, opacity: 0.4 })));
})();

// Apartman silüetleri ve sodyum pencereler
(() => {
  const binalar = [[-8.5, 7.5, -17, 5, 12], [-3.6, 10, -19, 4.5, 9], [2.8, 8.5, -18, 5, 7.5], [8, 6.6, -16, 4.2, 12], [-13, 9, -20, 5, 6], [13, 7, -19, 5, 7]];
  const bina = duz(R.kagit2);
  const pencereler = [];
  const rnd = M.rng(53);
  for (const [x, h, z, en, der] of binalar) {
    olcekle(sahne, parca(kutu, bina, x, h / 2, z), en, h, der);
    const pen = Math.floor(en / 1.2), kat = Math.floor(h / 1.8);
    for (let a = 0; a < pen; a++) for (let b = 1; b < kat; b++) {
      if (rnd() < 0.42) pencereler.push([x - en / 2 + 0.7 + a * 1.2, b * 1.8, z + der / 2 + 0.02]);
    }
  }
  const pg = new THREE.PlaneGeometry(0.4, 0.55);
  const pm = new THREE.InstancedMesh(pg, temiz(R.sodyum), pencereler.length);
  const m4 = new THREE.Matrix4();
  pencereler.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); pm.setMatrixAt(i, m4); });
  sahne.add(pm);
})();

// Sokak lambası: direk, kafa ve ışık konisi
(() => {
  const g = new THREE.Group();
  olcekle(g, parca(kutu, duz(R.cizgi), 0, 3.4, 0), 0.12, 6.8, 0.12);
  const kol = parca(kutu, duz(R.cizgi), 0.55, 6.75, 0); kol.scale.set(1.2, 0.1, 0.1); g.add(kol);
  g.add(parca(new THREE.SphereGeometry(0.22, 8, 6), temiz(R.sodyum), 1.1, 6.62, 0));
  const koni = parca(new THREE.ConeGeometry(2.4, 6.4, 16, 1, true), temiz(R.sodyum, 0.045), 1.1, 3.4, 0);
  koni.material.depthWrite = false;
  koni.material.side = THREE.DoubleSide;
  g.add(koni);
  g.position.set(-4.6, 0, -3.2);
  sahne.add(g);
})();

// Yumuşak blob gölge dokusu (üretilmiş, harici dosya yok)
const golgeDoku = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
function golgeYap() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: golgeDoku, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  sahne.add(m);
  return m;
}
const topGolge = golgeYap(), potaGolge = golgeYap();

// ---------- Pota ----------
const pota3 = new THREE.Group();     // x,z ile hareket eder
const halkaGrubu = new THREE.Group(); // çember titreşimi
const fileGrubu = new THREE.Group();  // file sallanması
(() => {
  const zf = -M.TABELA_ARKA; // tabelanın ön yüzü (pota grubuna göre)
  const yMerkez = (M.TABELA_ALT + M.TABELA_UST) / 2;
  const levha = parca(kutu, new THREE.MeshBasicMaterial({ color: R.krem, transparent: true, opacity: 0.4 }),
    0, yMerkez, zf - 0.03);
  levha.scale.set(M.TABELA_YARI_EN * 2, M.TABELA_UST - M.TABELA_ALT, 0.06);
  pota3.add(levha);
  // Tabela üstündeki kor kare
  const kare = new THREE.Group();
  const cm = temiz(R.kor);
  for (const [x, y, w, h] of [[0, 0.3, 0.7, 0.05], [0, -0.1, 0.7, 0.05], [-0.35, 0.1, 0.05, 0.45], [0.35, 0.1, 0.05, 0.45]]) {
    const c = parca(kutu, cm, x, y, 0); c.scale.set(w, h, 0.02); kare.add(c);
  }
  kare.position.set(0, M.HY + 0.0, zf + 0.002);
  pota3.add(kare);
  // Direk ve kol
  olcekle(pota3, parca(kutu, duz(R.cizgi), 0, (M.HY + 0.4) / 2, zf - 0.9), 0.18, M.HY + 0.4, 0.18);
  const kol = parca(kutu, duz(R.cizgi), 0, M.HY + 0.9, zf - 0.45); kol.scale.set(0.12, 0.12, 0.9); pota3.add(kol);
  // Çember (kor) ve file
  const halka = parca(new THREE.TorusGeometry(M.RR, M.TUP * 1.3, 6, 24), new THREE.MeshLambertMaterial({ color: R.kor, emissive: R.kor, emissiveIntensity: 0.35, flatShading: true }), 0, 0, 0);
  halka.rotation.x = Math.PI / 2;
  halkaGrubu.add(halka);
  const baglanti = parca(kutu, temiz(R.kor), 0, 0, zf / 2 + 0.05); baglanti.scale.set(0.08, 0.04, Math.abs(zf) - M.RR + 0.02);
  baglanti.position.z = -(M.RR + (Math.abs(zf) - M.RR) / 2);
  halkaGrubu.add(baglanti);
  const file = parca(new THREE.CylinderGeometry(M.RR * 0.97, 0.2, 0.5, 12, 1, true), new THREE.MeshBasicMaterial({ color: R.krem, wireframe: true, transparent: true, opacity: 0.8 }), 0, -0.25, 0);
  fileGrubu.add(file);
  halkaGrubu.add(fileGrubu);
  halkaGrubu.position.y = M.HY;
  pota3.add(halkaGrubu);
  // Uyarı çerçevesi: pota kaymadan önce soluk sodyum
  const uyari = new THREE.Group();
  const um = temiz(R.sodyum, 0.55);
  const w = M.TABELA_YARI_EN * 2 + 0.2, h = M.TABELA_UST - M.TABELA_ALT + 0.2;
  for (const [x, y, ww, hh] of [[0, h / 2, w, 0.08], [0, -h / 2, w, 0.08], [-w / 2, 0, 0.08, h], [w / 2, 0, 0.08, h]]) {
    const c = parca(kutu, um, x, y, 0); c.scale.set(ww, hh, 0.04); uyari.add(c);
  }
  uyari.position.set(0, yMerkez, zf - 0.04);
  uyari.visible = false;
  pota3.add(uyari);
  pota3.userData.uyari = uyari;
})();
sahne.add(pota3);

// ---------- Top ----------
const topGeo = (() => {
  // Dikiş: iki büyük daire (x=0 ve y=0) üzerindeki köşeler koyu, aradaki yüzeylere yumuşakça karışır.
  const g = new THREE.SphereGeometry(M.R, 24, 16).toNonIndexed();
  const pos = g.attributes.position;
  const renk = new Float32Array(pos.count * 3);
  const a = new THREE.Color(R.kor), b = new THREE.Color(R.murekkep).lerp(new THREE.Color(R.kor), 0.15);
  for (let i = 0; i < pos.count; i++) {
    const c = (Math.abs(pos.getX(i)) < 1e-4 || Math.abs(pos.getY(i)) < 1e-4) ? b : a;
    renk[i * 3] = c.r; renk[i * 3 + 1] = c.g; renk[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(renk, 3));
  return g;
})();
const top = new THREE.Mesh(topGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: R.kor, emissiveIntensity: 0.12 }));
sahne.add(top);

// Önizleme noktaları (yalnızca kolay modda)
const onizleme = [];
for (let i = 0; i < 6; i++) {
  const n = parca(new THREE.SphereGeometry(0.055, 6, 4), temiz(R.sodyum, 0.9 - i * 0.12), 0, 0, 0);
  n.visible = false;
  sahne.add(n);
  onizleme.push(n);
}
// Klavye nişan çizgisi
const nisanCizgi = parca(new THREE.PlaneGeometry(0.06, 2), temiz(R.sodyum, 0.7), 0, 0.03, 0);
nisanCizgi.rotation.x = -Math.PI / 2;
nisanCizgi.visible = false;
sahne.add(nisanCizgi);

// ---------- Ses: kısa efektler (kapatılabilir) ----------
let ses = null;
function sesHazirla() {
  if (!sesAcik) return null;
  if (!ses) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ses = new AC(); } catch (e) { return null; }
  }
  if (ses.state === 'suspended') ses.resume();
  return ses;
}
let gurultuTampon = null;
function gurultu(c, t0, sure, hacim, tip, frekans, bitisFrekans) {
  if (!gurultuTampon) {
    gurultuTampon = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const v = gurultuTampon.getChannelData(0);
    for (let i = 0; i < v.length; i++) v[i] = Math.random() * 2 - 1;
  }
  const k = c.createBufferSource();
  k.buffer = gurultuTampon;
  const f = c.createBiquadFilter();
  f.type = tip; f.frequency.setValueAtTime(frekans, t0);
  if (bitisFrekans) f.frequency.exponentialRampToValueAtTime(bitisFrekans, t0 + sure);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(hacim, t0 + Math.min(0.05, sure / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
  k.connect(f).connect(g).connect(c.destination);
  k.start(t0, Math.random() * 0.5);
  k.stop(t0 + sure + 0.02);
}
function ton(c, t0, f, sure, hacim, tip, bitis) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = tip || 'sine';
  o.frequency.setValueAtTime(f, t0);
  if (bitis) o.frequency.exponentialRampToValueAtTime(bitis, t0 + sure);
  g.gain.setValueAtTime(hacim, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + sure + 0.02);
}
const efekt = {
  firlat: () => { const c = sesHazirla(); if (c) gurultu(c, c.currentTime, 0.25, 0.08, 'bandpass', 500, 1800); },
  rim: (s) => { const c = sesHazirla(); if (c) { const h = Math.min(0.2, 0.05 + s * 0.02); ton(c, c.currentTime, 880, 0.35, h, 'triangle', 760); ton(c, c.currentTime, 1320, 0.2, h * 0.5, 'sine'); } },
  tabela: (s) => { const c = sesHazirla(); if (c) { ton(c, c.currentTime, 150, 0.16, Math.min(0.3, 0.1 + s * 0.02), 'square', 70); gurultu(c, c.currentTime, 0.08, 0.1, 'lowpass', 900); } },
  zemin: (s) => { const c = sesHazirla(); if (c) ton(c, c.currentTime, 110, 0.14, Math.min(0.32, 0.05 + s * 0.04), 'sine', 55); },
  file: () => { const c = sesHazirla(); if (c) gurultu(c, c.currentTime, 0.35, 0.16, 'highpass', 3000, 6500); },
  kalabalik: (guclu) => {
    const c = sesHazirla(); if (!c) return;
    gurultu(c, c.currentTime + 0.1, guclu ? 1.3 : 0.8, guclu ? 0.16 : 0.1, 'bandpass', 900, 1500);
    if (guclu) { ton(c, c.currentTime + 0.1, 330, 0.5, 0.05, 'triangle', 660); ton(c, c.currentTime + 0.25, 495, 0.5, 0.05, 'triangle', 990); }
  },
  hava: () => { const c = sesHazirla(); if (c) ton(c, c.currentTime + 0.1, 200, 0.4, 0.1, 'sawtooth', 90); }
};

// ---------- Oyun durumu ----------
const ORIJIN = M.BASLANGIC;
let durum = 'menu';           // menu | oyun | durak | bitti
let tur = null, pota = null, potaT = 0, atis = null, atisIslendi = false;
let topBeklemeSuresi = 0;     // yeni top belirmeden önceki kısa bekleme
let popSuresi = 0;            // pota belirme animasyonu
let rimTitresim = 0, fileSalla = 0, fileYon = 1;
let kameraGecikmesi = 0;
const klavye = { nisan: 0, sol: false, sag: false, guc: null, kullanildi: false };

function tohumUret() { return mod === 'gunluk' ? M.gunTohumu(bugun) : (Math.random() * 4294967296) >>> 0; }
function yeniPota() {
  pota = M.sonrakiPota(tur);
  potaT = 0;
  popSuresi = 0.28;
  topBeklemeSuresi = 0;
  atis = null; atisIslendi = false;
  klavye.guc = null;
  kamerayiHedefle(true);
}

// ---------- HUD ----------
let damgaZaman = 0;
function damgaGoster(yazi, kor) {
  const e = $('damga');
  e.textContent = yazi;
  e.classList.toggle('kor', !!kor);
  e.classList.remove('goster');
  void e.offsetWidth;
  e.classList.add('goster');
  clearTimeout(damgaZaman);
  damgaZaman = setTimeout(() => e.classList.remove('goster'), 1150);
}
function sureGoster() {
  const s = $('sure'), n = Math.ceil(tur.kalan);
  if (s.textContent !== String(n)) { s.textContent = n; s.classList.toggle('az-kaldi', tur.kalan <= 10); }
}
function hudGuncelle(vurgu) {
  $('skor').textContent = tur.puan;
  const c = M.carpan(tur.seri);
  const r = $('carpan');
  r.textContent = 'x' + c;
  r.classList.toggle('aktif', c > 1);
  r.previousElementSibling.textContent = 'Seri ' + tur.seri;
  if (vurgu) { r.classList.remove('vurgu'); void r.offsetWidth; r.classList.add('vurgu'); }
  const s = $('sure'), e = $('sure-etiket');
  if (tur.mod === 'sure') { e.textContent = 'Süre'; s.textContent = Math.ceil(tur.kalan); s.classList.toggle('az-kaldi', tur.kalan <= 10); }
  else if (tur.mod === 'sonsuz') { e.textContent = 'Iska'; s.textContent = tur.iska + '/' + M.MOD.sonsuz.maksIska; s.classList.toggle('az-kaldi', tur.iska >= 2); }
  else { e.textContent = 'Atış'; s.textContent = Math.min(tur.atis + 1, M.MOD.gunluk.atis) + '/' + M.MOD.gunluk.atis; s.classList.remove('az-kaldi'); }
  $('en-iyi').textContent = 'En iyi ' + (mod === 'gunluk' ? gunlukKayit.enIyi : kayit[mod]);
}
const ACIKLAMA = {
  sure: '60 saniyede en çok sayıyı at. Seri çarpanı puanı katlar.',
  sonsuz: 'Üç ıskada tur biter. Ne kadar uzun gidersin?',
  gunluk: 'On atış, o günün pota dizisi herkes için aynı.'
};
function menuGuncelle() {
  document.querySelectorAll('[data-mod]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mod === mod)));
  $('mod-aciklama').textContent = ACIKLAMA[mod];
  const k = $('kolay');
  k.setAttribute('aria-pressed', String(kolay));
  k.textContent = kolay ? 'Kolay: önizleme açık' : 'Kolay: önizleme kapalı';
  $('en-iyi').textContent = 'En iyi ' + (mod === 'gunluk' ? gunlukKayit.enIyi : kayit[mod]);
}
function sesDugmesi() {
  const b = $('ses');
  b.setAttribute('aria-pressed', String(sesAcik));
  b.setAttribute('aria-label', sesAcik ? 'Sesi kapat' : 'Sesi aç');
}

// ---------- Akış ----------
function gunlukBildir(bitti) {
  if (tur.mod !== 'gunluk') return;
  try {
    if (window.Gunluk && typeof window.Gunluk.kaydet === 'function') {
      window.Gunluk.kaydet('smac', { durum: bitti ? 'bitti' : 'yarim', ozet: tur.puan + ' puan' });
    }
  } catch (e) { /* günlük yardımcı yoksa ya da hata verirse oyun etkilenmez */ }
}
function basla() {
  tur = M.yeniTur(mod, tohumUret());
  durum = 'oyun';
  $('perde').hidden = true; $('sonuc').hidden = true; $('duraklama').hidden = true;
  $('damga').classList.remove('goster');
  yeniPota();
  hudGuncelle();
  sesHazirla();
}
function duraklat() {
  if (durum !== 'oyun') return;
  durum = 'durak';
  surukleme = null;
  klavye.guc = null;
  $('duraklama').hidden = false;
  $('devam').focus({ preventScroll: true });
}
function devam() {
  if (durum !== 'durak') return;
  durum = 'oyun';
  $('duraklama').hidden = true;
  onceki = performance.now();
}
function menuyeDon() {
  durum = 'menu';
  $('sonuc').hidden = true; $('duraklama').hidden = true;
  $('perde').hidden = false;
  tur = tur || M.yeniTur(mod, 1);
  menuGuncelle();
  $('basla').focus({ preventScroll: true });
}
function bitir() {
  durum = 'bitti';
  const yeniRekor = mod === 'gunluk' ? tur.puan > gunlukKayit.enIyi : tur.puan > kayit[mod];
  if (mod === 'gunluk') { if (tur.puan > gunlukKayit.enIyi) gunlukKayit.enIyi = tur.puan; kayit.gunluk = gunlukKayit.enIyi; }
  else if (tur.puan > kayit[mod]) kayit[mod] = tur.puan;
  if (tur.enSeri > kayit.enSeri) kayit.enSeri = tur.enSeri;
  kayitYaz();
  gunlukBildir(true);
  $('sonuc-baslik').textContent = mod === 'sure' ? 'Süre bitti' : mod === 'sonsuz' ? 'Üç ıska' : 'Günün atışları bitti';
  $('sonuc-skor').textContent = tur.puan;
  $('sonuc-eniyi').textContent = mod === 'gunluk' ? gunlukKayit.enIyi : kayit[mod];
  $('sonuc-seri').textContent = tur.enSeri;
  $('sonuc-sayi').textContent = tur.sayi;
  $('rekor').hidden = !(yeniRekor && tur.puan > 0);
  $('sonuc').hidden = false;
  hudGuncelle();
  $('tekrar').focus({ preventScroll: true });
}

// Atış sonucu: puan, geri bildirim ve çember/file tepkisi
function atisSonucu() {
  atisIslendi = true;
  const o = M.atisKaydet(tur, { sonuc: atis.sonuc, temiz: atis.temiz });
  if (o.tur === 'sayi' || o.tur === 'smac') {
    damgaGoster(o.tur === 'smac' ? 'Smaç!' : 'Sayı!', false);
    efekt.kalabalik(o.tur === 'smac');
  } else {
    damgaGoster(o.tur === 'iska' ? 'Ucu ucuna!' : 'Hava topu!', true);
    efekt.hava();
  }
  hudGuncelle(o.tur === 'sayi' || o.tur === 'smac');
  if (!tur.bitti) gunlukBildir(false);
}
function atisIsle(dt) {
  // Sabit adımlı fizik; olaylar ses ve görsel tepki üretir
  topBeklemeSuresi = 0;
  const onceSayi = atis.sonuc;
  atisBirikim = M.ilerlet(atis, atisBirikim, dt);
  potaT = atis.t;
  for (const o of atis.olaylar) {
    if (o.tur === 'rim') { efekt.rim(o.siddet); if (!hareketAz()) rimTitresim = 0.06; fileSalla = Math.max(fileSalla, 0.25); }
    else if (o.tur === 'tabela') efekt.tabela(o.siddet);
    else if (o.tur === 'zemin') efekt.zemin(o.siddet);
    else if (o.tur === 'sayi') { efekt.file(); if (!hareketAz()) { fileSalla = 0.7; } }
  }
  atis.olaylar.length = 0;
  if (!onceSayi && atis.sonuc && !atisIslendi) atisSonucu();
}
let atisBirikim = 0;

// ---------- Girdi: kaydır-at ----------
let surukleme = null;
let sonGirdiHizi = null;
function sahneBoyu() { return kap.clientHeight || 1; }
// Son ~80 ms'lik hız (ekran yüksekliği/sn); duran parmak sıfır hız verir
function kaydirmaHizi(ornekler, simdi) {
  if (ornekler.length < 2) return null;
  const son = ornekler[ornekler.length - 1];
  if (simdi - son.t > 140) return { vx: 0, yukari: 0 };
  let ilk = son;
  for (let i = ornekler.length - 2; i >= 0; i--) { if (son.t - ornekler[i].t > 80) break; ilk = ornekler[i]; }
  if (ilk === son) ilk = ornekler[ornekler.length - 2];
  const dt = Math.max(1, son.t - ilk.t) / 1000;
  const H = sahneBoyu();
  return { vx: (son.x - ilk.x) / dt / H, yukari: -(son.y - ilk.y) / dt / H };
}
function topBekliyor() { return durum === 'oyun' && !atis && topBeklemeSuresi <= 0; }
function firlat(girdi) {
  const a = M.atisHesapla(girdi, ORIJIN, pota, { yardim: kolay ? 'kolay' : 'normal', t: potaT });
  if (!a) { damgaGoster('Yukarı kaydır!', true); return false; }
  atis = M.atisBaslat(a, ORIJIN, pota, potaT);
  atisBirikim = 0;
  atisIslendi = false;
  efekt.firlat();
  kameraGecikmesi = 0;
  for (const n of onizleme) n.visible = false;
  nisanCizgi.visible = false;
  return true;
}
function onizlemeGuncelle(girdi) {
  const gorunur = kolay && girdi && topBekliyor();
  let a = null;
  if (gorunur) a = M.atisHesapla(girdi, ORIJIN, pota, { yardim: 'kolay', t: potaT });
  if (!a) { for (const n of onizleme) n.visible = false; return; }
  const nok = M.yorunge(a, ORIJIN, onizleme.length);
  nok.forEach((p, i) => { onizleme[i].visible = true; onizleme[i].position.set(p.x, p.y, p.z); });
}
canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  sesHazirla();
  klavye.kullanildi = false;
  if (!topBekliyor() || surukleme) return;
  surukleme = { id: ev.pointerId, ornekler: [{ x: ev.clientX, y: ev.clientY, t: ev.timeStamp }], x0: ev.clientX, y0: ev.clientY };
  kap.classList.add('suruklenir');
  try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* yakalama yoksa da çalışır */ }
});
canvas.addEventListener('pointermove', (ev) => {
  if (!surukleme || ev.pointerId !== surukleme.id) return;
  const o = surukleme.ornekler;
  o.push({ x: ev.clientX, y: ev.clientY, t: ev.timeStamp });
  while (o.length > 2 && ev.timeStamp - o[0].t > 250) o.shift();
  sonGirdiHizi = kaydirmaHizi(o, ev.timeStamp);
  onizlemeGuncelle(sonGirdiHizi);
});
function birak(ev, iptal) {
  if (!surukleme || ev.pointerId !== surukleme.id) return;
  const girdi = kaydirmaHizi(surukleme.ornekler, ev.timeStamp);
  surukleme = null;
  sonGirdiHizi = null;
  kap.classList.remove('suruklenir');
  for (const n of onizleme) n.visible = false;
  if (!iptal && topBekliyor() && girdi) firlat(girdi);
}
canvas.addEventListener('pointerup', (ev) => birak(ev, false));
canvas.addEventListener('pointercancel', (ev) => birak(ev, true));
canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

// Klavye: ← → nişan, boşluk basılı tut + bırak = at; P / Esc duraklat
const GUC_SURE = 0.9;
function gucDegeri(simdi) {
  const f = ((simdi - klavye.guc) / 1000 / GUC_SURE) % 2;
  return f < 1 ? f : 2 - f;
}
document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (e.repeat && (k === ' ' || k === 'enter')) { e.preventDefault(); return; }
  if (k === 'arrowleft' || k === 'a') { klavye.sol = true; klavye.kullanildi = true; e.preventDefault(); }
  else if (k === 'arrowright' || k === 'd') { klavye.sag = true; klavye.kullanildi = true; e.preventDefault(); }
  else if (k === 'p' || k === 'escape') { if (durum === 'oyun') duraklat(); else if (durum === 'durak') devam(); }
  else if (k === ' ' || k === 'enter') {
    if (durum === 'oyun') {
      if (document.activeElement && document.activeElement !== document.body && document.activeElement.tagName === 'BUTTON') return;
      e.preventDefault();
      sesHazirla();
      if (topBekliyor() && klavye.guc === null) { klavye.guc = performance.now(); klavye.kullanildi = true; }
    } else if (document.activeElement === document.body) {
      e.preventDefault();
      if (durum === 'menu') basla(); else if (durum === 'bitti') basla(); else if (durum === 'durak') devam();
    }
  }
});
document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') klavye.sol = false;
  if (k === 'arrowright' || k === 'd') klavye.sag = false;
  if ((k === ' ' || k === 'enter') && klavye.guc !== null) {
    const g = gucDegeri(performance.now());
    klavye.guc = null;
    if (topBekliyor()) firlat(M.kaydirmaGirdisi(g, klavye.nisan));
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) duraklat(); });
window.addEventListener('blur', () => { klavye.sol = klavye.sag = false; });

$('basla').addEventListener('click', basla);
$('devam').addEventListener('click', devam);
$('tekrar').addEventListener('click', basla);
$('menu').addEventListener('click', menuyeDon);
$('duraklat').addEventListener('click', () => (durum === 'oyun' ? duraklat() : durum === 'durak' ? devam() : null));
$('ses').addEventListener('click', () => {
  sesAcik = !sesAcik;
  Depo.yaz('smac:ses', sesAcik);
  sesDugmesi();
  if (sesAcik) sesHazirla();
});
$('kolay').addEventListener('click', () => { kolay = !kolay; Depo.yaz('smac:kolay', kolay); menuGuncelle(); });
document.querySelectorAll('[data-mod]').forEach((b) => b.addEventListener('click', () => {
  mod = b.dataset.mod;
  Depo.yaz('smac:mod', mod);
  menuGuncelle();
}));

// ---------- Kamera ----------
function boyutlandir() {
  const en = kap.clientWidth || 1, boy = kap.clientHeight || 1;
  renderer.setSize(en, boy, false);
  kamera.aspect = en / boy;
  kamera.fov = kamera.aspect < 0.8 ? 64 : 50;
  kamera.updateProjectionMatrix();
}
new ResizeObserver(boyutlandir).observe(kap);
const kamTaban = new THREE.Vector3(), kamBak = new THREE.Vector3(), kamNokta = new THREE.Vector3(), kamBakNokta = new THREE.Vector3();
function kamerayiHedefle(hemen) {
  if (!pota) return;
  kamTaban.set(0, 1.9, 1.9);
  kamBak.set(pota.x * 0.3, 1.45, -8.1);
  if (hemen) { kamNokta.copy(kamTaban); kamBakNokta.copy(kamBak); }
}
function kameraGuncelle(dt) {
  const f = 1 - Math.exp(-dt * 5);
  const hedefPos = kamTaban.clone(), hedefBak = kamBak.clone();
  if (atis && !hareketAz()) { // uçuşta hafifçe takip
    hedefPos.x += atis.x * 0.12;
    hedefPos.y += Math.max(0, atis.y - 1.5) * 0.06;
    hedefBak.x += atis.x * 0.2;
    hedefBak.y += (atis.y - 2.5) * 0.12;
  }
  kamNokta.lerp(hedefPos, f);
  kamBakNokta.lerp(hedefBak, f);
  kamera.position.copy(kamNokta);
  kamera.lookAt(kamBakNokta);
}

// ---------- Döngü ----------
let onceki = performance.now();
function kare(simdi) {
  const ham = simdi - onceki;
  const dt = Math.min(0.1, Math.max(0, ham / 1000));
  onceki = simdi;
  if (durum === 'oyun') {
    if (tur.mod === 'sure') M.sureDus(tur, dt);
    if (atis) {
      atisIsle(dt);
      if (atis.bitti) {
        if (tur.bitti) bitir();
        else { yeniPota(); hudGuncelle(); }
      }
    } else {
      potaT += dt;
      if (tur.bitti && durum === 'oyun') bitir();
    }
    if (durum === 'oyun' && tur.mod === 'sure') sureGoster();
  }
  // Pota konumu ve uyarı
  if (pota) {
    const hx = M.potaX(pota, potaT);
    pota3.position.set(hx, 0, pota.z);
    const kayiyor = !!pota.kayma;
    pota3.userData.uyari.visible = kayiyor && potaT < pota.kayma.gecikme && Math.floor(potaT * 6) % 2 === 0 && durum === 'oyun';
    $('uyari').hidden = !(kayiyor && potaT < pota.kayma.gecikme && durum === 'oyun');
    if (popSuresi > 0) popSuresi = Math.max(0, popSuresi - dt);
    const pop = hareketAz() ? 1 : 1 - Math.pow(popSuresi / 0.28, 2) * 0.5;
    pota3.scale.setScalar(pop);
    // çember titreşimi ve file sallanması
    if (rimTitresim > 0) rimTitresim = Math.max(0, rimTitresim - dt);
    halkaGrubu.position.y = M.HY + (rimTitresim > 0 ? Math.sin(simdi * 0.12) * 0.025 : 0);
    if (fileSalla > 0) fileSalla = Math.max(0, fileSalla - dt);
    const sallan = hareketAz() ? 0 : fileSalla;
    fileGrubu.rotation.z = Math.sin(simdi * 0.03) * sallan * 0.35;
    fileGrubu.scale.set(1 + sallan * 0.12 * Math.sin(simdi * 0.04), 1 + sallan * 0.15, 1);
    potaGolge.position.set(hx, 0.02, pota.z);
    potaGolge.scale.set(1.5, 1.5, 1);
  }
  // Top
  if (atis) {
    top.position.set(atis.x, atis.y, atis.z);
    top.rotation.x -= atis.vz * dt * 3;
    top.rotation.z -= atis.vx * dt * 3;
    top.visible = true;
  } else {
    // Elde: sürüklerken parmağı izler (küçük ofset), değilse başlangıç noktasında
    let ox = 0, oy = 0, oz = 0;
    if (surukleme) {
      const son = surukleme.ornekler[surukleme.ornekler.length - 1];
      ox = Math.max(-0.35, Math.min(0.35, (son.x - surukleme.x0) / kap.clientWidth * 1.6));
      oy = Math.max(0, Math.min(0.4, -(son.y - surukleme.y0) / sahneBoyu() * 1.0));
      oz = -oy * 0.5;
    }
    top.position.set(ORIJIN.x + ox, ORIJIN.y + oy, ORIJIN.z + oz);
    top.visible = true;
    topGuncelleKlavye(dt);
  }
  // Gölgeler
  topGolge.position.set(top.position.x, 0.02, top.position.z);
  const yuk = Math.max(0, top.position.y - M.R);
  const gs = (0.5 + yuk * 0.09);
  topGolge.scale.set(gs, gs, 1);
  topGolge.material.opacity = Math.max(0.25, 1 - yuk * 0.12);
  // Klavye gücü göstergesi
  const gucKutu = $('guc');
  const klavyeGoster = klavye.kullanildi && durum === 'oyun';
  gucKutu.hidden = !klavyeGoster;
  if (klavyeGoster) {
    $('nisan').textContent = 'Nişan ' + Math.round(klavye.nisan * 57.3) + '°';
    $('guc-dolgu').style.width = (klavye.guc !== null ? gucDegeri(simdi) * 100 : 0) + '%';
  }
  nisanCizgi.visible = klavyeGoster && topBekliyor();
  if (nisanCizgi.visible) {
    nisanCizgi.position.set(ORIJIN.x + Math.sin(klavye.nisan) * 1.1, 0.03, ORIJIN.z - Math.cos(klavye.nisan) * 1.1);
    nisanCizgi.rotation.z = -klavye.nisan;
  }
  if (klavyeGoster && kolay && topBekliyor()) onizlemeGuncelle(M.kaydirmaGirdisi(klavye.guc !== null ? gucDegeri(simdi) : 0.5, klavye.nisan));
  else if (!surukleme && !atis) for (const n of onizleme) n.visible = false;

  kameraGuncelle(dt);
  renderer.render(sahne, kamera);

  kalite.kare(simdi);
  requestAnimationFrame(kare);
}
function topGuncelleKlavye(dt) {
  if (durum !== 'oyun') return;
  const d = (klavye.sag ? 1 : 0) - (klavye.sol ? 1 : 0);
  if (d) klavye.nisan = Math.max(-0.5, Math.min(0.5, klavye.nisan + d * dt * 0.5));
}

// ---------- Başlangıç ----------
sesDugmesi();
Kalite.dugmeEkle($('ses'), kalite);
menuGuncelle();
boyutlandir();
tur = M.yeniTur(mod, 1);
pota = M.potaKonum(M.gunTohumu(bugun), 0, 0);
kamerayiHedefle(true);
hudGuncelle();
$('perde').hidden = false;
Depo.ozetYaz('smac', kayit.sure || kayit.sonsuz || kayit.gunluk ? 'En iyi ' + Math.max(kayit.sure, kayit.sonsuz, kayit.gunluk) : '');
requestAnimationFrame(kare);

// Tarayıcı testleri için küçük kanca
window.__smac = {
  get durum() { return durum; },
  get tur() { return tur; },
  get pota() { return pota; },
  get atis() { return atis; },
  kalite
};
