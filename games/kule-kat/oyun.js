// Kule Kat: three.js sahnesi (izometrik ortografik kamera), dokun-bırak kontrolü, HUD, ses ve kayıt.
// Kesme, hizalama, seri ve hız mantığı mantik.js'te (KuleMantik).
import * as THREE from 'three';

const M = window.KuleMantik;

// Render kalitesi (piksel oranı üst sınırı, adaptif çözünürlük, Düşük grafik) ortak assets/js/kalite.js'tedir.

// Renkler: DESIGN.md token'ları ve oyun içi ek renk tablosu (Kum, Ceviz, Kemik, İznik mavisi).
const R = { murekkep: '#110f0d', kagit2: '#26211c', cizgi: '#3b332b', krem: '#f3ead8', sodyum: '#ffb23f', ay: '#9db4ff' };
const H = M.KAT_YUKSEKLIK;

const $ = (id) => document.getElementById(id);
const kap = $('sahne');
const hareketAz = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Kayıt ----------
const bugun = M.gunAnahtari();
const MODLAR = ['normal', 'gunluk'];
const kayit = Object.assign({ normal: 0, enSeri: 0 }, Depo.oku('kule-kat:enIyi', {}));
let gunlukKayit = Depo.oku('kule-kat:gunluk', null);
if (!gunlukKayit || gunlukKayit.tarih !== bugun) gunlukKayit = { tarih: bugun, enIyi: 0 };
let mod = Depo.oku('kule-kat:mod', 'normal');
if (!MODLAR.includes(mod)) mod = 'normal';
let sesAcik = Depo.oku('kule-kat:ses', true) !== false;
const enIyiMod = () => (mod === 'gunluk' ? gunlukKayit.enIyi : kayit.normal);
function kayitYaz() {
  Depo.yaz('kule-kat:enIyi', { normal: kayit.normal, enSeri: kayit.enSeri });
  Depo.yaz('kule-kat:gunluk', gunlukKayit);
  const en = Math.max(kayit.normal, gunlukKayit.enIyi);
  Depo.ozetYaz('kule-kat', en ? 'En iyi ' + en + ' kat' : '');
}

// ---------- Sahne ----------
const renderer = new THREE.WebGLRenderer(Kalite.rendererSecenek({ alpha: true, powerPreference: 'high-performance' }));
const kalite = Kalite.kur(renderer, { azami: 2, boyutla: () => boyutlandir() });
renderer.setClearColor(0x000000, 0);
kap.insertBefore(renderer.domElement, kap.querySelector('.kule-hud'));
const canvas = renderer.domElement;
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', 'İstanbul silüetinin önünde kat kat yükselen kule');

const sahne = new THREE.Scene();
const kamera = new THREE.OrthographicCamera(-4, 4, 6, -6, 0.1, 120);

// Işık: sodyum anahtar (sağ üstten) + ay mavisi dolgu (ön) + düşük ortam
const anahtar = new THREE.DirectionalLight(R.sodyum, 1.5);
anahtar.position.set(6, 10, 3);
const dolgu = new THREE.DirectionalLight(R.ay, 0.45);
dolgu.position.set(1, 3, 8);
sahne.add(anahtar, dolgu, new THREE.AmbientLight(R.krem, 0.72));

const kutu = new THREE.BoxGeometry(1, 1, 1);
const pencereGeo = new THREE.PlaneGeometry(0.16, 0.22);
const pencereMat = new THREE.MeshBasicMaterial({ color: R.sodyum });
const duz = (renk, ek) => new THREE.MeshLambertMaterial(Object.assign({ color: renk, flatShading: true }, ek));

// Taban: alçak taş kaide ve yumuşak blob gölge (gölge haritası yok)
const kaide = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.95, 0.3, 10), duz(R.cizgi));
kaide.position.y = -0.15;
sahne.add(kaide);
const golgeDoku = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 31);
  gr.addColorStop(0, 'rgba(17,15,13,.7)');
  gr.addColorStop(1, 'rgba(17,15,13,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const golge = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: golgeDoku, transparent: true, depthWrite: false }));
golge.rotation.x = -Math.PI / 2;
golge.position.y = 0.004;
sahne.add(golge);

// ---------- Katlar ----------
const katmanlar = []; // { grup, mat, pencere: [], yas, parlama, nabiz, indeks }
const dusenler = [];
const hareketMat = duz('#e9dcc2');
const hareketMesh = new THREE.Mesh(kutu, hareketMat);
sahne.add(hareketMesh);

function katmanOlustur(indeks, k) {
  const mat = duz(M.katRengi(indeks), { emissive: new THREE.Color(R.sodyum), emissiveIntensity: 0 });
  const govde = new THREE.Mesh(kutu, mat);
  govde.scale.set(k.w, H, k.d);
  const grup = new THREE.Group();
  grup.position.set(k.cx, (indeks + 0.5) * H, k.cz);
  grup.add(govde);
  const pencere = [];
  if (!kalite.dusuk) {
    const r = M.rng(indeks * 7919 + 13);
    const toplam = 2 + (r() < 0.5 ? 1 : 0);
    const xs = Math.ceil(toplam / 2), zs = toplam - xs;
    const ekle = (n, genis, yerlestir) => {
      if (genis < 0.4) return;
      for (let i = 0; i < n; i++) {
        const u = ((i + 0.5) / n - 0.5) * genis * 0.62 + (r() - 0.5) * 0.1;
        const m = new THREE.Mesh(pencereGeo, pencereMat);
        yerlestir(m, u, (r() - 0.5) * 0.08);
        m.visible = false;
        grup.add(m);
        pencere.push(m);
      }
    };
    ekle(xs, k.d, (m, u, y) => { m.rotation.y = Math.PI / 2; m.position.set(k.w / 2 + 0.004, y, u); });
    ekle(zs, k.w, (m, u, y) => { m.position.set(u, y, k.d / 2 + 0.004); });
  }
  sahne.add(grup);
  const kat = { grup, mat, pencere, yas: 0, parlama: 0, nabiz: 0, indeks };
  katmanlar.push(kat);
  // Kamera altında kalan eski katlar çizilmez ve serbest bırakılır
  while (katmanlar.length > 20) kaldir(katmanlar.shift());
  return kat;
}
function kaldir(kat) {
  sahne.remove(kat.grup);
  kat.mat.dispose();
}

function dusenEkle(k, indeks, yon) {
  const mat = duz(M.katRengi(indeks), { transparent: true, opacity: 1 });
  const m = new THREE.Mesh(kutu, mat);
  m.scale.set(k.w, H, k.d);
  m.position.set(k.cx, (indeks + 0.5) * H, k.cz);
  sahne.add(m);
  dusenler.push({
    m, mat, t: 0, vy: 0.4,
    vx: yon.x * 1.1, vz: yon.z * 1.1,
    rx: (Math.random() - 0.5) * 3 * (yon.z || 1), rz: (Math.random() - 0.5) * 3 * (yon.x || 1)
  });
}
function dusenIsle(dt) {
  for (let i = dusenler.length - 1; i >= 0; i--) {
    const d = dusenler[i];
    d.t += dt;
    d.vy -= 20 * dt;
    d.m.position.x += d.vx * dt;
    d.m.position.y += d.vy * dt;
    d.m.position.z += d.vz * dt;
    d.m.rotation.x += d.rx * dt;
    d.m.rotation.z += d.rz * dt;
    if (d.t > 0.5) d.mat.opacity = Math.max(0, 1 - (d.t - 0.5) / 0.9);
    if (d.t > 1.4) {
      sahne.remove(d.m);
      d.mat.dispose();
      dusenler.splice(i, 1);
    }
  }
}
function katmanAnim(dt) {
  for (const kat of katmanlar) {
    kat.yas += dt;
    if (kat.parlama > 0) {
      kat.parlama = Math.max(0, kat.parlama - dt / 0.45);
      kat.mat.emissiveIntensity = kat.parlama * 0.7;
    }
    if (kat.nabiz > 0) {
      kat.nabiz = Math.max(0, kat.nabiz - dt / 0.16);
      const o = 1 + 0.07 * Math.sin(kat.nabiz * Math.PI);
      kat.grup.scale.set(o, 1, o);
    }
    // pencere ışıkları 80 ms arayla sırayla yanar
    for (let i = 0; i < kat.pencere.length; i++) {
      if (!kat.pencere[i].visible && kat.yas >= 0.1 + i * 0.08) kat.pencere[i].visible = true;
    }
  }
}

// ---------- Oyun durumu ----------
let s = M.yeni();
let durum = 'menu'; // menu | oyun | bitirme | durak | bitti
let temaSira = 0;
let sarsinti = 0;
let bitisT = 0;
let bitisZaman = 0;

function temizle() {
  while (katmanlar.length) kaldir(katmanlar.pop());
  while (dusenler.length) { const d = dusenler.pop(); sahne.remove(d.m); d.mat.dispose(); }
}
function sifirla(secenek) {
  temizle();
  s = M.yeni(secenek);
  katmanOlustur(0, s.katlar[0]).parlama = 0;
  golge.scale.set(s.tabanEn * 1.9, s.tabanEn * 1.9, 1);
  temaSira = 0;
  temaGoster(M.tema(0), true);
  gokAyarla(0, true);
  kamY = hedefY();
  kamZoom = 1;
  sarsinti = 0;
  hareketMesh.visible = true;
  hudGuncelle();
}

// ---------- HUD, damga, ses ----------
let damgaZaman = 0;
function damgaGoster(yazi) {
  const e = $('damga');
  e.textContent = yazi;
  e.classList.remove('goster');
  void e.offsetWidth;
  e.classList.add('goster');
  clearTimeout(damgaZaman);
  damgaZaman = setTimeout(() => e.classList.remove('goster'), 650);
}
function hudGuncelle(vurgu) {
  $('kat').textContent = s.kat;
  $('en-iyi').textContent = 'En iyi ' + enIyiMod();
  const r = $('seri');
  if (s.seri >= 2) {
    r.textContent = 'x' + s.seri;
    r.hidden = false;
    if (vurgu) { r.classList.remove('vurgu'); void r.offsetWidth; r.classList.add('vurgu'); }
  } else r.hidden = true;
}

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
function ton(f0, f1, sure, tip, ses2, gecikme) {
  const a = sesHazirla();
  if (!a) return;
  const t0 = a.currentTime + (gecikme || 0);
  const o = a.createOscillator(), g = a.createGain();
  o.type = tip;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + sure);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(ses2, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
  o.connect(g);
  g.connect(a.destination);
  o.start(t0);
  o.stop(t0 + sure + 0.03);
}
const PENTATONIK = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
function sesYerles(tur, seri) {
  if (!sesAcik) return;
  if (tur === 'mukemmel') {
    const f = 392 * Math.pow(2, PENTATONIK[Math.min(seri - 1, PENTATONIK.length - 1)] / 12);
    ton(f, f, 0.32, 'triangle', 0.16);
    ton(f * 2, f * 2, 0.22, 'sine', 0.07, 0.04);
  } else if (tur === 'kes') {
    ton(150, 80, 0.14, 'sine', 0.22);
  } else {
    ton(260, 60, 0.55, 'sawtooth', 0.1);
  }
}
function sesDugmesi() {
  const d = $('ses');
  d.setAttribute('aria-pressed', sesAcik ? 'true' : 'false');
  d.setAttribute('aria-label', sesAcik ? 'Sesi kapat' : 'Sesi aç');
}

function gunlukBildir(bitti) {
  if (mod !== 'gunluk') return;
  if (window.Gunluk && typeof window.Gunluk.kaydet === 'function') {
    window.Gunluk.kaydet('kule-kat', { durum: bitti ? 'bitti' : 'yarim', ozet: s.kat + ' kat' });
  }
}

// ---------- Gökyüzü ve silüet ----------
let gokOn = $('gok-a'), gokArka = $('gok-b');
function gokAyarla(kat, hemen) {
  const k = M.karanlik(kat);
  if (hemen) {
    gokOn.style.setProperty('--k', k);
    gokOn.classList.remove('gizli');
    gokArka.classList.add('gizli');
    return;
  }
  gokArka.style.setProperty('--k', k);
  gokArka.classList.remove('gizli');
  gokOn.classList.add('gizli');
  [gokOn, gokArka] = [gokArka, gokOn];
}
const temalar = {};
document.querySelectorAll('.siluet.orta .tema').forEach((e) => { temalar[e.dataset.tema] = e; });
let aktifTema = null;
function temaGoster(ad, hemen) {
  if (aktifTema === ad) return;
  const eski = aktifTema && temalar[aktifTema], yeni = temalar[ad];
  aktifTema = ad;
  if (hemen) {
    for (const k in temalar) { temalar[k].style.transition = 'none'; temalar[k].classList.remove('aktif', 'cikti'); }
    yeni.classList.add('aktif');
    void yeni.offsetWidth;
    for (const k in temalar) temalar[k].style.transition = '';
    return;
  }
  yeni.classList.add('aktif');
  if (eski) {
    eski.classList.remove('aktif');
    eski.classList.add('cikti');
    setTimeout(() => {
      eski.style.transition = 'none';
      eski.classList.remove('cikti');
      void eski.offsetWidth;
      eski.style.transition = '';
    }, 700);
  }
}

// ---------- Kamera ----------
let kamY = 0, kamZoom = 1;
let gorunenYukseklik = 12;
const ISO = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(30);
function boyutlandir() {
  const en = kap.clientWidth || 1, boy = kap.clientHeight || 1;
  renderer.setSize(en, boy, false);
  const oran = en / boy;
  // Yatayda en az 8,4 birim görünür (kayan kat dahil); geniş ekranda dikey en az 11 birim
  const yuks = Math.max(8.6 / oran, 11);
  gorunenYukseklik = yuks;
  kamera.left = -yuks * oran / 2; kamera.right = yuks * oran / 2;
  kamera.top = yuks / 2; kamera.bottom = -yuks / 2;
  kamera.updateProjectionMatrix();
}
new ResizeObserver(boyutlandir).observe(kap);
// Kulenin üstü ekranın alt kısmında dursun: bakış noktası üst yüzeyin biraz üstünde
function hedefY() { return (s.kat + 1) * H + gorunenYukseklik * 0.14 / 0.816; }
function kameraGuncelle(dt, simdi) {
  let hy, hz = 1;
  if (durum === 'bitirme' || durum === 'bitti') {
    const kule = (s.kat + 1) * H;
    hz = Math.max(0.34, Math.min(1, 7.5 / (kule * 0.82 + 4)));
    hy = Math.max(hedefY() - gorunenYukseklik / hz * 0.36, kule * 0.5);
    hy = Math.min(hy, hedefY());
  } else hy = hedefY();
  const f = 1 - Math.exp(-dt * (durum === 'bitirme' || durum === 'bitti' ? 2.6 : 5));
  kamY += (hy - kamY) * f;
  kamZoom += (hz - kamZoom) * f;
  if (Math.abs(kamera.zoom - kamZoom) > 0.0005) { kamera.zoom = kamZoom; kamera.updateProjectionMatrix(); }
  let sx = 0, sy = 0;
  if (sarsinti > 0 && !hareketAz()) {
    sarsinti = Math.max(0, sarsinti - dt);
    const g = sarsinti / 0.12;
    sx = Math.sin(simdi * 0.12) * 0.07 * g;
    sy = Math.cos(simdi * 0.15) * 0.07 * g;
  }
  kamera.position.set(ISO.x + sx, kamY + ISO.y + sy, ISO.z);
  kamera.lookAt(0 + sx, kamY + sy, 0);
  // Paralaks: silüet katmanları kule yükseldikçe yavaşça aşağı kayar
  const pxBirim = (kap.clientHeight / gorunenYukseklik) * 0.816 * kamZoom;
  const yuk = Math.max(0, kamY - hedefYTaban());
  const ay = (k) => 'translateY(' + Math.round(yuk * pxBirim * k) + 'px)';
  $('paralaks-uzak').style.transform = ay(0.06);
  $('paralaks-orta').style.transform = ay(0.14);
  $('paralaks-yakin').style.transform = ay(0.26);
}
let tabanY = 0;
function hedefYTaban() { return tabanY; }

// ---------- Oynanış ----------
function katPozisyonlari() {
  const k = M.kayanKat(s);
  const idx = s.kat + 1;
  hareketMesh.scale.set(k.w, H, k.d);
  hareketMesh.position.set(k.cx, (idx + 0.5) * H, k.cz);
  hareketMat.color.set(M.katRengi(idx));
}

function birak() {
  if (durum !== 'oyun') return;
  sesHazirla();
  const idx = s.kat + 1;
  const sag = s.hareket.ofset >= 0 ? 1 : -1;
  const eksen = s.hareket.eksen;
  const r = M.birak(s);
  if (!r) return;
  const yon = { x: eksen === 'x' ? sag : 0, z: eksen === 'z' ? sag : 0 };
  if (r.tur === 'iska') {
    dusenEkle(r.kesilen, idx, yon);
    hareketMesh.visible = false;
    sesYerles('iska', 0);
    sarsinti = 0.12;
    durum = 'bitirme';
    bitisZaman = performance.now();
    hudGuncelle();
    return;
  }
  const kat = katmanOlustur(idx, r.katman);
  if (r.tur === 'mukemmel') {
    kat.parlama = 1;
    kat.nabiz = 1;
    sarsinti = 0.12;
    damgaGoster('Mükemmel!');
    sesYerles('mukemmel', r.seri);
  } else {
    dusenEkle(r.kesilen, idx, yon);
    sesYerles('kes', 0);
  }
  hudGuncelle(r.tur === 'mukemmel');
  // Tema her 10 katta bir değişir
  const ts = M.temaSirasi(s.kat);
  if (ts !== temaSira) {
    temaSira = ts;
    temaGoster(M.tema(s.kat), false);
    gokAyarla(s.kat, false);
  }
  katPozisyonlari();
}

function basla() {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  sifirla({ gunluk: mod === 'gunluk', tarih: bugun });
  $('perde').hidden = true;
  $('sonuc').hidden = true;
  $('duraklama').hidden = true;
  durum = 'oyun';
  sesHazirla();
  gunlukBildir(false);
  katPozisyonlari();
}
function bitir() {
  durum = 'bitti';
  const onceki = enIyiMod();
  const yeniRekor = s.kat > onceki;
  if (mod === 'gunluk') { if (s.kat > gunlukKayit.enIyi) gunlukKayit.enIyi = s.kat; }
  else if (s.kat > kayit.normal) kayit.normal = s.kat;
  if (s.enSeri > kayit.enSeri) kayit.enSeri = s.enSeri;
  kayitYaz();
  gunlukBildir(true);
  $('sonuc-baslik').textContent = mod === 'gunluk' ? 'Günün kulesi bitti' : 'Kule düştü';
  $('sonuc-kat').textContent = s.kat;
  $('sonuc-eniyi').textContent = enIyiMod();
  $('sonuc-seri').textContent = s.enSeri;
  $('sonuc-mukemmel').textContent = s.mukemmel;
  $('rekor').hidden = !(yeniRekor && s.kat > 0);
  $('sonuc').hidden = false;
  hudGuncelle();
  $('tekrar').focus({ preventScroll: true });
}
function menuyeDon() {
  durum = 'menu';
  sifirla({ gunluk: mod === 'gunluk', tarih: bugun });
  $('sonuc').hidden = true;
  $('perde').hidden = false;
  menuGuncelle();
  katPozisyonlari();
}
function duraklat() {
  if (durum !== 'oyun') return;
  durum = 'durak';
  $('duraklama').hidden = false;
  $('devam').focus({ preventScroll: true });
}
function devam() {
  if (durum !== 'durak') return;
  durum = 'oyun';
  $('duraklama').hidden = true;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
function menuGuncelle() {
  document.querySelectorAll('[data-mod]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mod === mod ? 'true' : 'false'));
  $('mod-aciklama').textContent = mod === 'gunluk'
    ? 'Bugün herkes aynı başlangıç genişliği ve hızla başlar.' + (gunlukKayit.enIyi ? ' Günün en iyisi: ' + gunlukKayit.enIyi + ' kat.' : '')
    : 'Hız her katta biraz artar. Rekorun yalnızca bu cihazda saklanır.';
  $('en-iyi').textContent = 'En iyi ' + enIyiMod();
}

// ---------- Girdi ----------
kap.addEventListener('pointerdown', (e) => {
  if (durum !== 'oyun' || e.button > 0) return;
  if (e.target.closest('button, a, .kule-perde')) return;
  birak();
});
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') {
    if (e.repeat) return;
    if (durum === 'oyun') {
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
      e.preventDefault();
      birak();
    } else if (document.activeElement === document.body) {
      e.preventDefault();
      if (durum === 'menu' || durum === 'bitti') basla(); else if (durum === 'durak') devam();
    }
  } else if (k === 'p' || k === 'escape') {
    if (durum === 'oyun') duraklat(); else if (durum === 'durak') devam();
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) duraklat(); });

$('basla').addEventListener('click', basla);
$('devam').addEventListener('click', devam);
$('tekrar').addEventListener('click', basla);
$('menu').addEventListener('click', menuyeDon);
$('ses').addEventListener('click', () => {
  sesAcik = !sesAcik;
  Depo.yaz('kule-kat:ses', sesAcik);
  sesDugmesi();
  if (sesAcik) sesHazirla();
});
document.querySelectorAll('[data-mod]').forEach((b) => b.addEventListener('click', () => {
  mod = b.dataset.mod;
  Depo.yaz('kule-kat:mod', mod);
  sifirla({ gunluk: mod === 'gunluk', tarih: bugun });
  menuGuncelle();
  katPozisyonlari();
}));

// ---------- Döngü ----------
let onceki = performance.now();
function kare(simdi) {
  const dt = Math.min(0.1, Math.max(0, (simdi - onceki) / 1000));
  onceki = simdi;
  if (durum === 'oyun' || durum === 'menu') {
    M.ilerlet(s, dt);
    katPozisyonlari();
  }
  if (durum === 'bitirme' && simdi - bitisZaman > 1100) bitir();
  dusenIsle(dt);
  katmanAnim(dt);
  kap.classList.toggle('dusuk', kalite.dusuk);
  kameraGuncelle(dt, simdi);
  renderer.render(sahne, kamera);
  kalite.kare(simdi);
  requestAnimationFrame(kare);
}

// ---------- Başlangıç ----------
sesDugmesi();
Kalite.dugmeEkle($('ses'), kalite);
boyutlandir();
sifirla({ gunluk: mod === 'gunluk', tarih: bugun });
kamY = hedefY();
menuGuncelle();
katPozisyonlari();
Depo.ozetYaz('kule-kat', Math.max(kayit.normal, gunlukKayit.enIyi) ? 'En iyi ' + Math.max(kayit.normal, gunlukKayit.enIyi) + ' kat' : '');
$('perde').hidden = false;
requestAnimationFrame(kare);

// Tarayıcı testleri için küçük kanca
window.__kule = {
  get durum() { return durum; },
  get s() { return s; },
  get katSayisi() { return katmanlar.length; },
  birak,
  kalite
};
