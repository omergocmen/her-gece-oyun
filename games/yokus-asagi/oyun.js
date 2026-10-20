// Yokuş Aşağı: three.js pist çizimi, takip kamerası, kontroller, HUD ve müzik.
// Pist üretici ve fizik mantik.js'te (YokusMantik).
import * as THREE from 'three';

const Y = window.YokusMantik;

// Renkler: DESIGN.md token'ları ve oyun içi ek renk tablosu.
const R = {
  murekkep: '#110f0d', kagit: '#1b1815', kagit2: '#26211c', cizgi: '#3b332b', krem: '#f3ead8', soluk: '#b4a78f',
  sodyum: '#ffb23f', kor: '#ff6a48', kemik: '#e9dcc2'
};
const ONDE = 90, GERIDE = 8;
const EGIM_ACI = Math.atan(Y.EGIM);
const KALINLIK = 0.4;

const $ = (id) => document.getElementById(id);
const kap = $('sahne');
const hareketAz = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Kayıt ----------
const bugun = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
let enIyi = Number(Depo.oku('yokus:enIyi', 0)) || 0;
let gunluk = Depo.oku('yokus:gunluk', null);
if (!gunluk || gunluk.tarih !== bugun) gunluk = { tarih: bugun, enIyi: 0 };
let mod = Depo.oku('yokus:mod', 'sonsuz') === 'gunluk' ? 'gunluk' : 'sonsuz';
let sesAcik = Depo.oku('yokus:ses', true);

// ---------- Sahne ----------
const renderer = new THREE.WebGLRenderer(Kalite.rendererSecenek({ powerPreference: 'high-performance' }));
const kalite = Kalite.kur(renderer, { azami: 1.75, boyutla: boyutlandir });
renderer.setClearColor(R.murekkep);
kap.prepend(renderer.domElement);
const canvas = renderer.domElement;
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', 'Gece yokuşunda yuvarlanan top');

const sahne = new THREE.Scene();
sahne.fog = new THREE.Fog(R.murekkep, 22, 84);
const kamera = new THREE.PerspectiveCamera(62, 1, 0.1, 160);
sahne.add(new THREE.HemisphereLight(R.kemik, R.murekkep, 0.7));
const isik = new THREE.DirectionalLight(R.sodyum, 0.9);
isik.position.set(-3, 8, 4);
sahne.add(isik, isik.target);

// ---------- Pist (örneklenmiş, her karede yeniden dizilir) ----------
const kutu = new THREE.BoxGeometry(1, 1, 1);
function ornek(malzeme, adet, renkli) {
  const m = new THREE.InstancedMesh(kutu, malzeme, adet);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if (renkli) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(adet * 3), 3);
  m.frustumCulled = false;
  m.count = 0;
  sahne.add(m);
  return m;
}
const zeminler = ornek(new THREE.MeshLambertMaterial({ color: R.kagit }), 200);
const kenarlar = ornek(new THREE.MeshBasicMaterial({ color: '#ffffff' }), 400, true);
const izgara = ornek(new THREE.MeshBasicMaterial({ color: R.krem, transparent: true, opacity: 0.22 }), 60);
const engeller = ornek(new THREE.MeshLambertMaterial({ color: R.kor, emissive: R.kor, emissiveIntensity: 0.35 }), 260);
const engelKenar = ornek(new THREE.MeshBasicMaterial({ color: R.kor }), 260);
// Rampa okları: sodyum ok dokulu düzlemler
const okDoku = (() => {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = R.sodyum; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const y of [22, 44]) { g.beginPath(); g.moveTo(12, y + 12); g.lineTo(32, y - 6); g.lineTo(52, y + 12); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const oklar = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: okDoku, transparent: true, depthWrite: false }), 30);
oklar.frustumCulled = false; oklar.count = 0;
sahne.add(oklar);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const SODYUM = new THREE.Color(R.sodyum), KEMIK = new THREE.Color(R.kemik);
_e.set(-EGIM_ACI, 0, 0);
const egimQ = new THREE.Quaternion().setFromEuler(_e);
const okQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 - EGIM_ACI, 0, 0));
function koy(m, x, y, z, sx, sy, sz, q) {
  _p.set(x, y, z); _s.set(sx, sy, sz);
  _m.compose(_p, q || egimQ, _s);
  m.setMatrixAt(m.count++, _m);
}
function pistiCiz() {
  zeminler.count = kenarlar.count = izgara.count = engeller.count = engelKenar.count = oklar.count = 0;
  const bas = Math.max(0, Math.floor(durum.d) - GERIDE), son = Math.floor(durum.d) + ONDE;
  for (let i = bas; i < son; i++) {
    const sat = Y.satir(durum.p, i);
    const zc = -(i + 0.5), h = Y.yukseklik(i + 0.5);
    const k = Y.kayma(sat.kayma, durum.t);
    const renk = sat.kayma ? KEMIK : SODYUM;
    for (const z of sat.zeminler) {
      const x0 = z[0] + k, x1 = z[1] + k, w = x1 - x0, cx = (x0 + x1) / 2;
      if (zeminler.count < 200) koy(zeminler, cx, h - KALINLIK / 2, zc, w, KALINLIK, 1.01);
      if (kenarlar.count < 398) {
        kenarlar.setColorAt(kenarlar.count, renk); koy(kenarlar, x0 + 0.03, h + 0.015, zc, 0.06, 0.05, 1.01);
        kenarlar.setColorAt(kenarlar.count, renk); koy(kenarlar, x1 - 0.03, h + 0.015, zc, 0.06, 0.05, 1.01);
      }
      if (i % 4 === 0 && izgara.count < 60) koy(izgara, cx, h + 0.005, zc + 0.5, w - 0.2, 0.01, 0.03);
      if (sat.rampa && oklar.count < 30) koy(oklar, cx, h + 0.02, zc, 1.1, 1.1, 1, okQ);
    }
    for (const e of sat.engeller) {
      if (engeller.count >= 258) break;
      const w = e[1] - e[0], cx = (e[0] + e[1]) / 2;
      koy(engeller, cx, h + Y.ENGEL_Y / 2, zc, w, Y.ENGEL_Y, 0.9);
      koy(engelKenar, cx, h + Y.ENGEL_Y + 0.02, zc + 0.45, w + 0.02, 0.05, 0.05);
    }
  }
  for (const m of [zeminler, kenarlar, izgara, engeller, engelKenar, oklar]) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  tabelalariCiz(bas, son);
}

// ---------- 500 m tabelaları ----------
const tabelalar = new Map();
function tabelaYap(yazi) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = R.kagit; g.fillRect(0, 0, 512, 96);
  g.strokeStyle = R.sodyum; g.lineWidth = 4; g.strokeRect(2, 2, 508, 92);
  g.fillStyle = R.krem;
  g.font = '700 34px Bricolage, system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (g.letterSpacing !== undefined) g.letterSpacing = '4px';
  g.fillText(yazi, 256, 50, 480);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const grup = new THREE.Group();
  const levha = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.64), new THREE.MeshBasicMaterial({ map: t }));
  levha.position.y = 2.2;
  const direk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2, 0.06), new THREE.MeshLambertMaterial({ color: R.kagit2 }));
  direk.position.y = 1;
  grup.add(levha, direk);
  return grup;
}
function tabelalariCiz(bas, son) {
  for (let i = Math.ceil(bas / 500) * 500; i < son; i += 500) {
    if (i <= 0 || tabelalar.has(i)) continue;
    const sat = Y.satir(durum.p, i);
    if (!sat.tabela) continue;
    const t = tabelaYap(sat.tabela);
    t.position.set(sat.merkez + Y.GEN + 1.9, Y.yukseklik(i), -i);
    t.rotation.y = -0.35;
    sahne.add(t);
    tabelalar.set(i, t);
  }
  for (const [i, t] of tabelalar) {
    if (i < bas || i >= son) {
      sahne.remove(t);
      t.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
      tabelalar.delete(i);
    }
  }
}

// ---------- Uzak İstanbul: köprü ışıkları ve minare siluetleri ----------
const uzak = new THREE.Group();
(() => {
  const siluet = new THREE.MeshBasicMaterial({ color: R.kagit2, fog: false });
  const isikM = new THREE.MeshBasicMaterial({ color: R.sodyum, fog: false });
  // Köprü: iki kule, sodyum yol çizgisi ve sarkan kablo noktaları
  const yolCizgi = new THREE.Mesh(new THREE.BoxGeometry(70, 0.18, 0.1), isikM);
  yolCizgi.position.set(14, 2, 0);
  uzak.add(yolCizgi);
  for (const x of [-4, 32]) {
    const kule = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9, 0.3), siluet);
    kule.position.set(x, 5.5, -0.1);
    uzak.add(kule);
  }
  const nokta = new THREE.SphereGeometry(0.12, 6, 4);
  for (let i = 0; i <= 36; i++) {
    const x = -4 + i;
    const y = 2.4 + 7.4 * Math.pow((x - 14) / 18, 2);
    if (y > 10) continue;
    const n = new THREE.Mesh(nokta, isikM);
    n.position.set(x, y, 0);
    uzak.add(n);
  }
  // Tarihi yarımada: kubbe ve minareler
  for (const [x, h, r] of [[-30, 7, 2.6], [-14, 5, 1.8], [44, 6, 2.2]]) {
    const kubbe = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), siluet);
    kubbe.position.set(x, h - r * 0.4, -1);
    const govde = new THREE.Mesh(new THREE.BoxGeometry(r * 2.6, h - r * 0.4, 0.5), siluet);
    govde.position.set(x, (h - r * 0.4) / 2, -1);
    uzak.add(kubbe, govde);
    for (const dx of [-r * 1.6, r * 1.6]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, h + 4, 6), siluet);
      m.position.set(x + dx, (h + 4) / 2, -1);
      const k = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.4, 6), siluet);
      k.position.set(x + dx, h + 4.7, -1);
      uzak.add(m, k);
    }
  }
  uzak.traverse((o) => { if (o.isMesh) o.renderOrder = -1; });
  sahne.add(uzak);
})();

// ---------- Top ve iz ----------
const topMalz = new THREE.MeshPhongMaterial({ color: R.krem, shininess: 80, specular: '#ffffff', emissive: R.krem, emissiveIntensity: 0.15 });
const top = new THREE.Mesh(new THREE.SphereGeometry(Y.TOP_R, 20, 14), topMalz);
sahne.add(top);
const topIsik = new THREE.PointLight(R.sodyum, 2.2, 6, 1.6);
sahne.add(topIsik);
const IZ = 6;
const izGeo = new THREE.BufferGeometry();
izGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(IZ * 3), 3));
const iz = new THREE.Line(izGeo, new THREE.LineBasicMaterial({ color: R.sodyum, transparent: true, opacity: 0.7 }));
iz.frustumCulled = false;
sahne.add(iz);
let izNoktalari = [];

// ---------- Ses: basit elektronik döngü ve kısa efektler ----------
let ses = null, muzik = null;
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
let gurultuTampon = null;
function gurultu(c, t0, sure, hacim, tip, frekans, hedef) {
  if (!gurultuTampon) {
    gurultuTampon = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const v = gurultuTampon.getChannelData(0);
    for (let i = 0; i < v.length; i++) v[i] = Math.random() * 2 - 1;
  }
  const k = c.createBufferSource();
  k.buffer = gurultuTampon;
  const f = c.createBiquadFilter();
  f.type = tip; f.frequency.value = frekans;
  const g = c.createGain();
  g.gain.setValueAtTime(hacim, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
  k.connect(f).connect(g).connect(hedef || c.destination);
  k.start(t0, Math.random() * 0.5);
  k.stop(t0 + sure + 0.02);
}
function ton(c, t0, f, sure, hacim, tip, bitis, hedef) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = tip || 'sine';
  o.frequency.setValueAtTime(f, t0);
  if (bitis) o.frequency.exponentialRampToValueAtTime(bitis, t0 + sure);
  g.gain.setValueAtTime(hacim, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
  o.connect(g).connect(hedef || c.destination);
  o.start(t0); o.stop(t0 + sure + 0.02);
}
const efekt = {
  zipla: () => { const c = sesHazirla(); if (c) ton(c, c.currentTime, 260, 0.25, 0.12, 'triangle', 720); },
  kondu: () => { const c = sesHazirla(); if (c) { ton(c, c.currentTime, 120, 0.12, 0.18, 'sine', 60); gurultu(c, c.currentTime, 0.06, 0.1, 'lowpass', 700); } },
  oldu: () => { const c = sesHazirla(); if (c) { ton(c, c.currentTime, 220, 0.6, 0.18, 'sawtooth', 40); gurultu(c, c.currentTime, 0.5, 0.25, 'lowpass', 1600); } },
  tabela: () => { const c = sesHazirla(); if (c) { ton(c, c.currentTime, 880, 0.5, 0.06); ton(c, c.currentTime + 0.1, 1320, 0.6, 0.05); } }
};
// 120 BPM, la minör: dört vuruşlu davul, ara vuruşta zil, sekizliklerle bas
const BAS = [110, 110, 110, 110, 87.3, 87.3, 98, 98, 110, 110, 130.8, 110, 87.3, 87.3, 98, 82.4];
function muzikBaslat() {
  const c = sesHazirla();
  if (!c || muzik) return;
  const ana = c.createGain();
  ana.gain.value = 0.5;
  ana.connect(c.destination);
  const basSuzgec = c.createBiquadFilter();
  basSuzgec.type = 'lowpass'; basSuzgec.frequency.value = 520; basSuzgec.Q.value = 6;
  basSuzgec.connect(ana);
  const sekizlik = 0.25;
  let sonraki = c.currentTime + 0.05, adim = 0;
  const zamanla = () => {
    while (sonraki < c.currentTime + 0.2) {
      if (adim % 2 === 0) ton(c, sonraki, 150, 0.22, 0.32, 'sine', 45, ana);
      else gurultu(c, sonraki, 0.05, 0.05, 'highpass', 7000, ana);
      ton(c, sonraki, BAS[adim % BAS.length], sekizlik * 0.9, 0.09, 'sawtooth', null, basSuzgec);
      sonraki += sekizlik;
      adim++;
    }
  };
  zamanla();
  muzik = { ana, zaman: setInterval(zamanla, 60) };
}
function muzikDurdur() {
  if (!muzik) return;
  clearInterval(muzik.zaman);
  const m = muzik;
  muzik = null;
  if (ses) {
    m.ana.gain.setValueAtTime(m.ana.gain.value, ses.currentTime);
    m.ana.gain.exponentialRampToValueAtTime(0.0001, ses.currentTime + 0.3);
    setTimeout(() => m.ana.disconnect(), 400);
  }
}

// ---------- Akış ----------
let durum = null;
let biriken = 0;
let calisiyor = false, durakli = false, oldu = false, sonucAcik = false;
let olumZamani = 0;
const basili = { sol: false, sag: false };
const parmaklar = new Map();

function tohum() { return mod === 'gunluk' ? Y.gunTohumu(bugun) : (Math.random() * 4294967296) >>> 0; }
function yeniOyun() {
  for (const [, t] of tabelalar) sahne.remove(t);
  tabelalar.clear();
  durum = Y.yeniOyun(tohum());
  biriken = 0;
  oldu = false;
  sonucAcik = false;
  izNoktalari = [];
  topMalz.color.set(R.krem);
  topMalz.emissiveIntensity = 0.15;
  topIsik.intensity = 2.2;
  $('sonuc').hidden = true;
  hudGuncelle();
  kameraKonumla(0, true);
}
function basla() {
  if (!durum || oldu) yeniOyun();
  $('perde').hidden = true;
  calisiyor = true;
  durakli = false;
  muzikBaslat();
  if (!Depo.oku('yokus:ipucu', false)) {
    Depo.yaz('yokus:ipucu', true);
    const o = $('oklar');
    o.hidden = false;
    setTimeout(() => { o.hidden = true; }, 2000);
  }
}
function duraklat() {
  if (!calisiyor || oldu) return;
  calisiyor = false;
  durakli = true;
  muzikDurdur();
  $('perde-baslik').textContent = 'Duraklatıldı · ' + Math.floor(durum.d) + ' m';
  $('basla').textContent = 'Devam et';
  $('perde').hidden = false;
}
function olum() {
  oldu = true;
  calisiyor = false;
  olumZamani = performance.now();
  efekt.oldu();
  muzikDurdur();
  topMalz.color.set(R.kagit2);
  topMalz.emissiveIntensity = 0;
  topIsik.intensity = 0;
  const m = Math.floor(durum.d);
  const onceki = mod === 'gunluk' ? gunluk.enIyi : enIyi;
  const rekor = m > onceki;
  if (mod === 'gunluk') { if (rekor) gunluk.enIyi = m; Depo.yaz('yokus:gunluk', gunluk); }
  else if (rekor) { enIyi = m; Depo.yaz('yokus:enIyi', enIyi); }
  if (enIyi > 0) Depo.ozetYaz('yokus-asagi', 'En iyi ' + enIyi + ' m');
  setTimeout(() => {
    $('sonuc-mesafe').textContent = m + ' m';
    $('sonuc-eniyi').textContent = Math.max(m, onceki) + ' m';
    $('rekor').hidden = !(rekor && onceki > 0);
    $('kopyala').hidden = mod !== 'gunluk';
    $('kopyala').textContent = 'Sonucu kopyala';
    $('sonuc').hidden = false;
    sonucAcik = true;
    hudGuncelle();
  }, 400);
}
function tekrar() {
  yeniOyun();
  basla();
}

function hudGuncelle() {
  $('mesafe').textContent = Math.floor(durum.d) + ' m';
  $('en-iyi').innerHTML = (mod === 'gunluk' ? 'Günün en iyisi ' : 'En iyi ') + '<span class="birim">' + (mod === 'gunluk' ? gunluk.enIyi : enIyi) + ' m</span>';
}

// ---------- Kamera ----------
let yatma = 0;
const bakis = new THREE.Vector3();
function kameraKonumla(dt, aninda) {
  if (oldu && !aninda) return; // düşünce kamera durur
  const v = Y.hiz(durum.d), hf = (v - Y.V0) / (Y.VMAX - Y.V0);
  const zx = -durum.d;
  const hedef = new THREE.Vector3(durum.x * 0.7, durum.y + 2.3 + hf * 0.5, zx + 4.4 + hf * 1.6);
  if (aninda) kamera.position.copy(hedef);
  else kamera.position.lerp(hedef, 1 - Math.exp(-dt * 10));
  bakis.set(durum.x * 0.9, durum.y + 0.1, zx - 7);
  kamera.lookAt(bakis);
  const hedefYatma = hareketAz() ? 0 : -(durum.vx / Y.VX) * THREE.MathUtils.degToRad(6);
  yatma += (hedefYatma - yatma) * (aninda ? 1 : 1 - Math.exp(-dt * 6));
  kamera.rotateZ(yatma);
  // Uzak siluet kamerayla gelir, çok yavaş yana kayar
  uzak.position.set(-durum.x * 0.05 - 10, kamera.position.y - 7, kamera.position.z - 96);
}
function boyutlandir() {
  const en = kap.clientWidth || 1, boy = kap.clientHeight || 1;
  renderer.setSize(en, boy, false);
  kamera.aspect = en / boy;
  kamera.fov = kamera.aspect < 0.8 ? 70 : 60;
  kamera.updateProjectionMatrix();
}
new ResizeObserver(boyutlandir).observe(kap);

// ---------- Döngü ----------
let onceki = performance.now();
function girdi() { return (basili.sag ? 1 : 0) - (basili.sol ? 1 : 0); }
function kare(simdi) {
  kalite.kare(simdi);
  const dt = Math.min(0.1, (simdi - onceki) / 1000);
  onceki = simdi;
  if (calisiyor && !oldu) {
    biriken = Y.ilerlet(durum, biriken, dt, girdi());
    for (const o of durum.olaylar) {
      if (o.tur === 'zipla') efekt.zipla();
      else if (o.tur === 'kondu') efekt.kondu();
      else if (o.tur === 'tabela') tabelaGoster(o.yazi);
      else if (o.tur === 'oldu') olum();
    }
    durum.olaylar.length = 0;
    hudGuncelle();
  }
  if (durum) {
    pistiCiz();
    top.position.set(durum.x, durum.y + Y.TOP_R, -durum.d);
    top.rotation.x = -durum.d / Y.TOP_R;
    top.rotation.z = -durum.x / Y.TOP_R;
    topIsik.position.set(durum.x, durum.y + 0.8, -durum.d + 0.4);
    if (oldu && !hareketAz()) top.position.y -= Math.min(2, (simdi - olumZamani) / 300);
    izGuncelle();
    kameraKonumla(dt, false);
  }
  renderer.render(sahne, kamera);
  requestAnimationFrame(kare);
}
function izGuncelle() {
  iz.visible = !hareketAz() && !oldu;
  if (!iz.visible) return;
  izNoktalari.unshift([top.position.x, top.position.y, top.position.z]);
  if (izNoktalari.length > IZ) izNoktalari.length = IZ;
  const a = izGeo.attributes.position;
  for (let i = 0; i < IZ; i++) {
    const p = izNoktalari[Math.min(i, izNoktalari.length - 1)];
    // İz yalnızca kısa bir kuyruk: noktaları topa doğru sıkıştır
    a.setXYZ(i, p[0], p[1], p[2]);
  }
  a.needsUpdate = true;
}
let tabelaZaman = 0;
function tabelaGoster(yazi) {
  efekt.tabela();
  const e = $('tabela');
  e.textContent = yazi;
  e.classList.remove('goster');
  void e.offsetWidth;
  e.classList.add('goster');
  clearTimeout(tabelaZaman);
  tabelaZaman = setTimeout(() => e.classList.remove('goster'), 2300);
}

// ---------- Girdi ----------
function yarim(ev) {
  const r = kap.getBoundingClientRect();
  return ev.clientX - r.left < r.width / 2 ? 'sol' : 'sag';
}
function parmakGuncelle() {
  basili.sol = basili.sag = false;
  for (const y of parmaklar.values()) basili[y] = true;
  basili.sol = basili.sol || klavye.sol;
  basili.sag = basili.sag || klavye.sag;
}
const klavye = { sol: false, sag: false };
canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  sesHazirla();
  if (oldu) { if (sonucAcik || performance.now() - olumZamani > 400) tekrar(); return; }
  if (!calisiyor) { if (!durakli) basla(); return; }
  parmaklar.set(ev.pointerId, yarim(ev));
  canvas.setPointerCapture(ev.pointerId);
  parmakGuncelle();
});
canvas.addEventListener('pointermove', (ev) => {
  if (!parmaklar.has(ev.pointerId)) return;
  parmaklar.set(ev.pointerId, yarim(ev));
  parmakGuncelle();
});
const birak = (ev) => { parmaklar.delete(ev.pointerId); parmakGuncelle(); };
canvas.addEventListener('pointerup', birak);
canvas.addEventListener('pointercancel', birak);
// Sonuç kartının kendisine dokunmak da yeniden başlatır (kopyala düğmesi hariç)
$('sonuc').addEventListener('pointerdown', (ev) => {
  if (ev.target.closest('#kopyala')) return;
  ev.preventDefault();
  tekrar();
});
document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') { klavye.sol = true; parmakGuncelle(); e.preventDefault(); }
  else if (k === 'arrowright' || k === 'd') { klavye.sag = true; parmakGuncelle(); e.preventDefault(); }
  else if (k === 'p' || k === 'escape') { calisiyor ? duraklat() : durakli && basla(); }
  else if ((k === ' ' || k === 'enter') && document.activeElement === document.body) {
    e.preventDefault();
    if (oldu) tekrar(); else if (!calisiyor) basla();
  }
  if ((k === 'arrowleft' || k === 'arrowright' || k === 'a' || k === 'd') && !calisiyor && !oldu && !durakli && durum) basla();
});
document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') klavye.sol = false;
  if (k === 'arrowright' || k === 'd') klavye.sag = false;
  parmakGuncelle();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) duraklat(); });
window.addEventListener('blur', () => { klavye.sol = klavye.sag = false; parmaklar.clear(); parmakGuncelle(); });

$('basla').addEventListener('click', basla);
$('duraklat').addEventListener('click', () => (calisiyor ? duraklat() : durakli ? basla() : null));
$('kopyala').addEventListener('click', async () => {
  const t = new Date();
  const metin = 'Yokuş Aşağı · ' + t.toLocaleDateString('tr-TR') + ' · ' + Math.floor(durum.d) + ' m\n' + location.href.split('#')[0];
  try { await navigator.clipboard.writeText(metin); $('kopyala').textContent = 'Kopyalandı'; }
  catch (e) { $('kopyala').textContent = 'Kopyalanamadı'; }
});

function sesDugmesi() {
  const b = $('ses');
  b.setAttribute('aria-pressed', String(sesAcik));
  b.setAttribute('aria-label', sesAcik ? 'Sesi kapat' : 'Sesi aç');
}
$('ses').addEventListener('click', () => {
  sesAcik = !sesAcik;
  Depo.yaz('yokus:ses', sesAcik);
  sesDugmesi();
  if (sesAcik) { if (calisiyor) muzikBaslat(); } else muzikDurdur();
});
function modDugmeleri() {
  document.querySelectorAll('[data-mod]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mod === mod)));
}
document.querySelectorAll('[data-mod]').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.mod === mod) return;
  mod = b.dataset.mod;
  Depo.yaz('yokus:mod', mod);
  modDugmeleri();
  calisiyor = false; durakli = false;
  muzikDurdur();
  yeniOyun();
  $('perde-baslik').textContent = mod === 'gunluk' ? 'Günün pisti · ' + new Date().toLocaleDateString('tr-TR') : 'Gece İstanbul yokuşları';
  $('basla').textContent = 'Başla';
  $('perde').hidden = false;
}));

sesDugmesi();
Kalite.dugmeEkle($('ses'), kalite);
modDugmeleri();
boyutlandir();
yeniOyun();
if (mod === 'gunluk') $('perde-baslik').textContent = 'Günün pisti · ' + new Date().toLocaleDateString('tr-TR');
requestAnimationFrame(kare);

// Tarayıcı testleri için küçük kanca
window.__yokus = {
  get durum() { return durum; },
  get oldu() { return oldu; },
  get calisiyor() { return calisiyor; },
  tus: (sol, sag) => { klavye.sol = sol; klavye.sag = sag; parmakGuncelle(); }
};
