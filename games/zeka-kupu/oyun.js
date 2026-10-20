// Zekâ Küpü: three.js sahnesi, dokunmatik/fare/klavye kontrolleri ve oyun akışı.
// Küp modeli mantik.js'te (KupMantik), 3×3 çözücü cozucu.js'te (KupCozucu).
import * as THREE from 'three';

const M = window.KupMantik;
const C = window.KupCozucu;

// Yüz renkleri: kemik, sodyum, kor, yaprak, İznik mavisi, turkuaz (DESIGN.md Game Art → 3D).
const RENKLER = ['#e9dcc2', '#ffb23f', '#ff6a48', '#368549', '#2f6fb0', '#2aa198'];
const RENK_ADI = ['kemik', 'sodyum', 'kor', 'yaprak', 'mavi', 'turkuaz'];
const MUREKKEP = '#110f0d';
const YUZEY = '#1b1815';
const SODYUM = '#ffb23f';
const AY = '#9db4ff';
const CEYREK = Math.PI / 2;
const EKSENLER = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

const $ = (id) => document.getElementById(id);
const kap = $('sahne');
const sureEl = $('sure');
const hamleEl = $('hamle');
const durumEl = $('durum');
const izEl = $('iz');
const rehberEl = $('rehber');
const boyutDugmeleri = Array.from(document.querySelectorAll('[data-boyut]'));
const modDugmeleri = Array.from(document.querySelectorAll('[data-mod]'));

const hareketAz = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Oyun durumu ----------
const bugun = new Date();
const gunNo = M.gunNo(bugun);
let N = 3;
let mod = 'gunluk';
let durum = null; // KupMantik durumu
let karistirma = []; // çeyrek hamleler
let gecmis = []; // kullanıcının çeyrek hamleleri
let geriYigini = []; // her hareket: çeyrek hamle listesi
let hamleSayisi = 0;
let asama = 'hazir'; // karisiyor | hazir | oynuyor | cozuldu
let gecenMs = 0;
let baslangicZamani = null; // süre akarken performance.now() referansı
let cozum = null; // { adimlar: [{ad, metin, hamleler}] } (3×3 rehber/ipucu)
let ipucuHamlesi = null;
let rehberAcik = false;
let sembolModu = Depo.oku('kup:sembol', false);

// ---------- Sahne ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(MUREKKEP);
kap.prepend(renderer.domElement);
const canvas = renderer.domElement;
canvas.setAttribute('aria-label', 'Zekâ Küpü oyun alanı');
canvas.setAttribute('role', 'img');

const sahne = new THREE.Scene();
const kamera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
const KAMERA_YUKSEKLIK = THREE.MathUtils.degToRad(28);

sahne.add(new THREE.HemisphereLight('#f3ead8', MUREKKEP, 1.5));
const anaIsik = new THREE.DirectionalLight(SODYUM, 1.5);
anaIsik.position.set(-5, 8, 5);
sahne.add(anaIsik);
const onIsik = new THREE.DirectionalLight('#f3ead8', 1.1);
onIsik.position.set(1, 2, 8);
sahne.add(onIsik);
const dolguIsik = new THREE.DirectionalLight(AY, 0.8);
dolguIsik.position.set(5, -4, 3);
sahne.add(dolguIsik);

const kupGrup = new THREE.Group();
sahne.add(kupGrup);
const BASLANGIC_YONU = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 4, 0));
kupGrup.quaternion.copy(BASLANGIC_YONU);

// Sahte gölge: küpün altında yumuşak sodyum yansıma diski.
function yansimaDokusu() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,178,63,0.42)');
  grad.addColorStop(0.55, 'rgba(255,178,63,0.12)');
  grad.addColorStop(1, 'rgba(255,178,63,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const yansima = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: yansimaDokusu(), transparent: true, depthWrite: false })
);
yansima.rotation.x = -Math.PI / 2;
sahne.add(yansima);

// ---------- Geometri ve malzemeler ----------
function yuvarlakKare(boy, yaricap) {
  const s = new THREE.Shape();
  const y = boy / 2;
  s.moveTo(-y + yaricap, -y);
  s.lineTo(y - yaricap, -y);
  s.quadraticCurveTo(y, -y, y, -y + yaricap);
  s.lineTo(y, y - yaricap);
  s.quadraticCurveTo(y, y, y - yaricap, y);
  s.lineTo(-y + yaricap, y);
  s.quadraticCurveTo(-y, y, -y, y - yaricap);
  s.lineTo(-y, -y + yaricap);
  s.quadraticCurveTo(-y, -y, -y + yaricap, -y);
  return s;
}

const GOVDE = 0.96;
const govdeGeo = (() => {
  const pah = 0.07;
  const ic = GOVDE - pah * 2;
  const g = new THREE.ExtrudeGeometry(yuvarlakKare(ic, 0.06), {
    depth: ic, bevelEnabled: true, bevelThickness: pah, bevelSize: pah, bevelSegments: 2, curveSegments: 3
  });
  g.translate(0, 0, -ic / 2);
  g.computeVertexNormals();
  return g;
})();
const govdeMalzeme = new THREE.MeshStandardMaterial({ color: YUZEY, roughness: 0.55, metalness: 0 });

const CIKARTMA = 0.8;
const cikartmaGeo = (() => {
  const g = new THREE.ShapeGeometry(yuvarlakKare(CIKARTMA, 0.13), 4);
  const uv = g.attributes.uv;
  const poz = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, poz.getX(i) / CIKARTMA + 0.5, poz.getY(i) / CIKARTMA + 0.5);
  return g;
})();

// Renk körlüğü sembolleri: her renge ayrı basit işaret (nokta, çizgi, artı, halka, üçgen, kare).
function sembolDokusu(renkNo) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = RENKLER[renkNo];
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = MUREKKEP;
  g.strokeStyle = MUREKKEP;
  g.lineWidth = 12;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  switch (renkNo) {
    case 0: g.arc(64, 64, 13, 0, Math.PI * 2); g.fill(); break; // nokta
    case 1: g.moveTo(34, 64); g.lineTo(94, 64); g.stroke(); break; // çizgi
    case 2: g.moveTo(64, 34); g.lineTo(64, 94); g.moveTo(34, 64); g.lineTo(94, 64); g.stroke(); break; // artı
    case 3: g.arc(64, 64, 26, 0, Math.PI * 2); g.stroke(); break; // halka
    case 4: g.moveTo(64, 34); g.lineTo(94, 88); g.lineTo(34, 88); g.closePath(); g.stroke(); break; // üçgen
    default: g.rect(38, 38, 52, 52); g.stroke(); // kare
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const sembolDokulari = RENKLER.map((_, i) => sembolDokusu(i));
const renkMalzemeleri = RENKLER.map((r) => new THREE.MeshStandardMaterial({ color: r, roughness: 0.42, metalness: 0 }));

function sembolleriUygula() {
  renkMalzemeleri.forEach((m, i) => {
    m.map = sembolModu ? sembolDokulari[i] : null;
    m.color.set(sembolModu ? '#ffffff' : RENKLER[i]);
    m.needsUpdate = true;
  });
  iste();
}

// ---------- Küp nesneleri ----------
let kupcukler = []; // Object3D; userData.p = [x, y, z] çift koordinat
let govdeler = []; // ışın testi için

function kupuKur() {
  kupcukler.forEach((k) => kupGrup.remove(k));
  kupcukler = [];
  govdeler = [];
  const m = N - 1;
  const cozuk = M.cozulmus(N);
  for (let x = -m; x <= m; x += 2) {
    for (let y = -m; y <= m; y += 2) {
      for (let z = -m; z <= m; z += 2) {
        if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) !== m) continue;
        const k = new THREE.Object3D();
        k.position.set(x / 2, y / 2, z / 2);
        k.userData.p = [x, y, z];
        const govde = new THREE.Mesh(govdeGeo, govdeMalzeme);
        govde.userData.kupcuk = k;
        k.add(govde);
        govdeler.push(govde);
        cozuk.c.filter((s) => s.x === x && s.y === y && s.z === z).forEach((s) => {
          const n = new THREE.Vector3(s.nx, s.ny, s.nz);
          const c = new THREE.Mesh(cikartmaGeo, renkMalzemeleri[s.c]);
          c.position.copy(n).multiplyScalar(GOVDE / 2 + 0.004);
          c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
          k.add(c);
        });
        kupGrup.add(k);
        kupcukler.push(k);
      }
    }
  }
  yansima.scale.setScalar(N * 2.1);
  yansima.position.y = -N / 2 - 0.55;
  boyutlandir();
}

// Rotasyon matrisini en yakın eksen hizasına yuvarlar (birikmiş kayan nokta hatasını siler).
const _m = new THREE.Matrix4();
function hizala(k) {
  _m.makeRotationFromQuaternion(k.quaternion);
  const e = _m.elements;
  for (let i = 0; i < 16; i++) e[i] = Math.round(e[i]);
  k.quaternion.setFromRotationMatrix(_m);
  const p = k.userData.p;
  k.position.set(p[0] / 2, p[1] / 2, p[2] / 2);
}

function katman(a, k) { return kupcukler.filter((c) => c.userData.p[a] === k); }

// Görsel küpçükleri hamle kadar döndürür (animasyonsuz).
function gorselUygula(h) {
  const q = new THREE.Quaternion().setFromAxisAngle(EKSENLER[h.a], h.d * CEYREK);
  katman(h.a, h.k).forEach((c) => {
    const p = c.userData.p;
    c.userData.p = M.dondur(p[0], p[1], p[2], h.a, h.d);
    c.quaternion.premultiply(q);
    hizala(c);
  });
}

// ---------- Kamera ve boyut ----------
function boyutlandir() {
  const en = kap.clientWidth || 1;
  const boy = kap.clientHeight || 1;
  renderer.setSize(en, boy, false);
  kamera.aspect = en / boy;
  // Küp genişliğin ~%80'ini doldursun; dar ekranda yatay sığdırma belirleyici.
  const tanY = Math.tan(THREE.MathUtils.degToRad(kamera.fov / 2));
  const dikey = (N * 0.86) / tanY / 0.78;
  const yatay = (N * 0.74) / (tanY * kamera.aspect) / 0.8;
  const uzaklik = Math.max(dikey, yatay) * (rehberAcik ? 1.4 : 1);
  kamera.position.set(0, Math.sin(KAMERA_YUKSEKLIK) * uzaklik, Math.cos(KAMERA_YUKSEKLIK) * uzaklik);
  kamera.lookAt(0, 0, 0);
  // Üstteki HUD'a yer açmak için küp biraz aşağıda; rehber açıkken çekmecenin üstüne çıkar.
  kamera.setViewOffset(en, boy, 0, rehberAcik ? boy * 0.15 : -boy * 0.04, en, boy);
  kamera.updateProjectionMatrix();
  iste();
}
new ResizeObserver(boyutlandir).observe(kap);

// Ekrana göre yüz eşlemesi: önde, üstte, sağda duran dünya yüzleri (klavye ve notasyon için).
function gorunum() {
  const kameraYonu = kamera.position.clone().normalize();
  const sag = new THREE.Vector3(1, 0, 0);
  const yukari = new THREE.Vector3(0, 1, 0);
  const normaller = M.YUZ_VEKTOR.map((v) => new THREE.Vector3(v[0], v[1], v[2]).applyQuaternion(kupGrup.quaternion));
  const sec = (hedef, haric) => {
    let en = -1, enIyi = -Infinity;
    normaller.forEach((n, f) => {
      if (haric.includes(f)) return;
      const d = n.dot(hedef);
      if (d > enIyi) { enIyi = d; en = f; }
    });
    return en;
  };
  const karsi = (f) => f ^ 1;
  const F = sec(kameraYonu, []);
  const U = sec(yukari, [F, karsi(F)]);
  const R = sec(sag, [F, karsi(F), U, karsi(U)]);
  return { R, L: karsi(R), U, D: karsi(U), F, B: karsi(F) };
}

// ---------- Ok (ipucu ve rehber) ----------
let ok = null;
function okuKaldir() {
  if (!ok) return;
  kupGrup.remove(ok);
  ok.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  ok = null;
  iste();
}

function okGoster(h) {
  okuKaldir();
  if (!h) return;
  const eksen = EKSENLER[h.a];
  // Oku, dönecek katmanın şeridi üzerinde kameraya en çok bakan yüze yatır.
  const kameraYerel = kupGrup.worldToLocal(kamera.position.clone()).normalize();
  let n = null, enIyi = -Infinity;
  M.YUZ_VEKTOR.forEach((v) => {
    const aday = new THREE.Vector3(v[0], v[1], v[2]);
    if (Math.abs(aday.dot(eksen)) > 0.5) return;
    const d = aday.dot(kameraYerel);
    if (d > enIyi) { enIyi = d; n = aday; }
  });
  // Katman bu yüzde t yönünde akar (dönüş yönüyle).
  const t = new THREE.Vector3().crossVectors(eksen, n).multiplyScalar(h.d);
  const b = new THREE.Vector3().crossVectors(n, t);
  const boy = N * 0.78, govdeEn = 0.15, basEn = 0.46, basBoy = 0.4;
  const sekil = new THREE.Shape();
  sekil.moveTo(-boy / 2, -govdeEn / 2);
  sekil.lineTo(boy / 2 - basBoy, -govdeEn / 2);
  sekil.lineTo(boy / 2 - basBoy, -basEn / 2);
  sekil.lineTo(boy / 2, 0);
  sekil.lineTo(boy / 2 - basBoy, basEn / 2);
  sekil.lineTo(boy / 2 - basBoy, govdeEn / 2);
  sekil.lineTo(-boy / 2, govdeEn / 2);
  sekil.closePath();
  const malzeme = new THREE.MeshBasicMaterial({ color: SODYUM, transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(sekil), malzeme);
  mesh.matrixAutoUpdate = false;
  const merkez = n.clone().multiplyScalar(N / 2 + 0.03).add(eksen.clone().multiplyScalar(h.k / 2));
  mesh.matrix.makeBasis(t, b, n).setPosition(merkez);
  mesh.renderOrder = 10;
  const grup = new THREE.Group();
  grup.add(mesh);
  grup.userData.malzeme = malzeme;
  ok = grup;
  kupGrup.add(ok);
  iste();
}

// ---------- Animasyon kuyruğu ----------
let aktif = null; // { pivot, a, k, tur, hedef, bas, sure, t0, bitince, cerceve }
const kuyruk = [];

function pivotKur(a, k, cerceveli) {
  const pivot = new THREE.Group();
  kupGrup.add(pivot);
  katman(a, k).forEach((c) => pivot.attach(c));
  let cerceve = null;
  if (cerceveli) {
    const boyut = [N + 0.06, N + 0.06, N + 0.06];
    boyut[a] = 1.02;
    const kutu = new THREE.BoxGeometry(boyut[0], boyut[1], boyut[2]);
    cerceve = new THREE.LineSegments(new THREE.EdgesGeometry(kutu), new THREE.LineBasicMaterial({ color: SODYUM }));
    kutu.dispose();
    cerceve.position.copy(EKSENLER[a]).multiplyScalar(k / 2);
    pivot.add(cerceve);
  }
  return { pivot, cerceve };
}

function pivotuBitir(pivot, cerceve, a, tur) {
  const d = Math.sign(tur);
  pivot.children.slice().forEach((c) => {
    if (c === cerceve) return;
    kupGrup.attach(c);
    for (let i = 0; i < Math.abs(tur); i++) {
      const p = c.userData.p;
      c.userData.p = M.dondur(p[0], p[1], p[2], a, d);
    }
    hizala(c);
  });
  if (cerceve) { cerceve.geometry.dispose(); cerceve.material.dispose(); }
  kupGrup.remove(pivot);
}

// Bir katman dönüşü sıraya alır. tur: -2..2 çeyrek. hazir: sürüklemeden kalan pivot ve açı.
function donus(a, k, tur, sure, bitince, hazir) {
  kuyruk.push({ a, k, tur, sure, bitince, hazir });
  iste();
}

function kuyruguIslet(simdi) {
  if (!aktif && kuyruk.length) {
    const is = kuyruk.shift();
    const kur = is.hazir || pivotKur(is.a, is.k, false);
    aktif = Object.assign(is, kur, { bas: is.hazir ? is.hazir.aci : 0, hedef: is.tur * CEYREK, t0: simdi });
  }
  if (!aktif) return false;
  const t = aktif.sure > 0 ? Math.min(1, (simdi - aktif.t0) / aktif.sure) : 1;
  const yumusak = 1 - Math.pow(1 - t, 3);
  const aci = aktif.bas + (aktif.hedef - aktif.bas) * yumusak;
  aktif.pivot.quaternion.setFromAxisAngle(EKSENLER[aktif.a], aci);
  if (t >= 1) {
    const bitti = aktif;
    aktif = null;
    pivotuBitir(bitti.pivot, bitti.cerceve, bitti.a, bitti.tur);
    if (bitti.bitince) bitti.bitince();
  }
  return true;
}

// ---------- Kutlama ----------
let kutlama = null; // { t0, q0 }
function kutlamaBaslat() {
  if (hareketAz()) return;
  kutlama = { t0: performance.now(), q0: kupGrup.quaternion.clone() };
  iste();
}
function kutlamaIslet(simdi) {
  if (!kutlama) return false;
  const SURE = 1400;
  const t = Math.min(1, (simdi - kutlama.t0) / SURE);
  const yumusak = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const q = new THREE.Quaternion().setFromAxisAngle(EKSENLER[1], yumusak * Math.PI * 2);
  kupGrup.quaternion.copy(kutlama.q0).premultiply(q);
  // Renkler sırayla parlar.
  renkMalzemeleri.forEach((m, i) => {
    const merkez = 0.12 + i * 0.13;
    const p = Math.max(0, 1 - Math.abs(t - merkez) / 0.12);
    m.emissive.set(sembolModu ? '#ffffff' : RENKLER[i]);
    m.emissiveIntensity = p * 0.7;
  });
  if (t >= 1) {
    renkMalzemeleri.forEach((m) => { m.emissiveIntensity = 0; });
    kupGrup.quaternion.copy(kutlama.q0);
    kutlama = null;
  }
  return true;
}

// ---------- Döngü (yalnızca gerektiğinde çizer) ----------
let dongude = false;
let cizIste = false;
let atalet = null; // { x, y } açısal hız
function iste() {
  cizIste = true;
  if (!dongude && !document.hidden) {
    dongude = true;
    requestAnimationFrame(dongu);
  }
}

function dongu(simdi) {
  let devam = false;
  devam = kuyruguIslet(simdi) || devam;
  devam = kutlamaIslet(simdi) || devam;
  if (atalet) {
    kupuCevir(atalet.x, atalet.y);
    atalet.x *= 0.92; atalet.y *= 0.92;
    if (Math.abs(atalet.x) + Math.abs(atalet.y) < 0.0005) atalet = null;
    devam = true;
  }
  if (ok) {
    ok.userData.malzeme.opacity = 0.6 + 0.35 * (0.5 + 0.5 * Math.sin(simdi / 220));
    devam = true;
  }
  if (cizIste || devam) renderer.render(sahne, kamera);
  cizIste = false;
  if (devam && !document.hidden) requestAnimationFrame(dongu);
  else dongude = false;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    sureyiDurdur();
  } else {
    if (asama === 'oynuyor') sureyiBaslat();
    iste();
  }
});

// ---------- Süre ----------
let sureSayaci = null;
function gecen() { return gecenMs + (baslangicZamani != null ? performance.now() - baslangicZamani : 0); }
function sureyiBaslat() {
  if (baslangicZamani != null) return;
  baslangicZamani = performance.now();
  sureEl.classList.remove('durdu');
  clearInterval(sureSayaci);
  sureSayaci = setInterval(() => { sureEl.textContent = M.sureMetni(gecen()); }, 100);
}
function sureyiDurdur() {
  if (baslangicZamani != null) {
    gecenMs = gecen();
    baslangicZamani = null;
  }
  clearInterval(sureSayaci);
  sureSayaci = null;
  sureEl.textContent = M.sureMetni(gecenMs);
  if (asama !== 'cozuldu') sureEl.classList.add('durdu');
  kaydet();
}

// ---------- Hamle işleme ----------
function mesaj(metin) { durumEl.textContent = metin || ''; }

function izEkle(ad) {
  const li = document.createElement('li');
  li.textContent = ad;
  izEl.append(li);
  while (izEl.children.length > 6) izEl.firstChild.remove();
}

// Tamamlanan bir kullanıcı hareketini modele işler (hamleler: aynı katmanda 1-2 çeyrek).
function hareketIsle(hamleler, gorunumAni) {
  if (!hamleler.length) return;
  hamleler.forEach((h) => { M.uygula(durum, h); gecmis.push(h); });
  geriYigini.push(hamleler);
  hamleSayisi++;
  hamleEl.textContent = hamleSayisi;
  const ad = M.hamleAdi(hamleler[0], N, gorunumAni);
  izEkle(hamleler.length === 2 ? ad.replace("'", '') + '2' : ad);
  if (asama === 'hazir') {
    asama = 'oynuyor';
    mesaj('');
    sureyiBaslat();
  }
  // Rehber izleniyorsa çözümü kaydır, değilse yeniden hesapla.
  if (cozum) {
    hamleler.forEach((h) => {
      if (!cozum) return;
      const adim = cozum.adimlar.find((a) => a.hamleler.length);
      const sira = adim && adim.hamleler[0];
      const ikinci = adim && adim.hamleler[1];
      const ayniKatman = sira && sira.a === h.a && sira.k === h.k;
      if (ayniKatman && sira.d === h.d) adim.hamleler.shift();
      else if (ayniKatman && ikinci && ikinci.a === h.a && ikinci.k === h.k && ikinci.d === sira.d) {
        // Yarım tur ters yönden de yapılabilir: ikinci çeyreği kullanıcının yönüne çevir.
        adim.hamleler.shift();
        adim.hamleler[0] = { a: h.a, k: h.k, d: h.d };
      } else cozum = null;
    });
  }
  if (M.cozulduMu(durum)) {
    cozuldu();
    return;
  }
  kaydet();
  ipucuGuncelle();
}

function cozuldu() {
  sureyiDurdur();
  asama = 'cozuldu';
  sureEl.classList.remove('durdu');
  okuKaldir();
  cozum = null;
  rehberGuncelle();
  mesaj('Çözüldü!');
  const sure = gecenMs;
  const kayit = M.rekorIsle(Depo.oku('kup:rekor:' + N, null), sure, hamleSayisi);
  Depo.yaz('kup:rekor:' + N, kayit.rekor);
  let gunlukIlk = false;
  if (mod === 'gunluk') {
    const onceki = Depo.oku('kup:gunluk:' + N, null);
    if (!onceki || onceki.gun !== gunNo) {
      Depo.yaz('kup:gunluk:' + N, { gun: gunNo, sure, hamle: hamleSayisi });
      gunlukIlk = true;
    }
  }
  Depo.yaz('kup:oyun', null);
  kutlamaBaslat();
  setTimeout(() => sonucGoster(sure, kayit, gunlukIlk), hareketAz() ? 0 : 1500);
}

function sonucGoster(sure, kayit, gunlukIlk) {
  $('sonuc-sure').textContent = M.sureMetni(sure);
  $('sonuc-hamle').textContent = hamleSayisi;
  $('sonuc-damga').hidden = !(kayit.sureRekor || kayit.hamleRekor) || kayit.rekor.cozulen === 1;
  $('sonuc-baslik').textContent = mod === 'gunluk' ? 'Günün küpü çözüldü!' : 'Çözüldü!';
  const notlar = [];
  if (kayit.rekor.cozulen === 1) notlar.push('İlk ' + N + '×' + N + ' çözümün, tebrikler!');
  else if (kayit.sureRekor) notlar.push('Yeni süre rekoru.');
  else notlar.push('En iyi süren: ' + M.sureMetni(kayit.rekor.sure) + '.');
  if (kayit.hamleRekor && kayit.rekor.cozulen > 1) notlar.push('En az hamle rekoru.');
  if (mod === 'gunluk' && !gunlukIlk) notlar.push('Günlük sonuç ilk çözümünle kayıtlı.');
  $('sonuc-not').textContent = notlar.join(' ');
  $('paylas').hidden = mod !== 'gunluk';
  $('sonuc-metin').hidden = true;
  const d = $('sonuc');
  if (!d.open && typeof d.showModal === 'function') d.showModal();
}

// ---------- Karıştırma ve yeni oyun ----------
function yeniOyun(yeniKaristirma) {
  kuyruk.length = 0;
  if (aktif) { pivotuBitir(aktif.pivot, aktif.cerceve, aktif.a, 0); aktif = null; }
  if (surukleme && surukleme.pivot) kupGrup.remove(surukleme.pivot);
  surukleme = null;
  okuKaldir();
  kupuKur();
  durum = M.cozulmus(N);
  karistirma = yeniKaristirma;
  gecmis = [];
  geriYigini = [];
  hamleSayisi = 0;
  hamleEl.textContent = '0';
  gecenMs = 0;
  baslangicZamani = null;
  clearInterval(sureSayaci);
  sureEl.textContent = M.sureMetni(0);
  sureEl.classList.add('durdu');
  izEl.innerHTML = '';
  cozum = null;
  kupGrup.quaternion.copy(BASLANGIC_YONU);
  segmentleriGuncelle();
  M.hepsiniUygula(durum, karistirma);

  const bitir = () => {
    asama = 'hazir';
    mesaj('Başlamak için döndür');
    kaydet();
    ipucuGuncelle();
  };
  if (hareketAz()) {
    karistirma.forEach(gorselUygula);
    bitir();
    iste();
    return;
  }
  asama = 'karisiyor';
  mesaj('Karıştırılıyor…');
  // Yarım dönüşleri tek animasyonda birleştir; toplam ~1 sn.
  const parcalar = [];
  karistirma.forEach((h) => {
    const son = parcalar[parcalar.length - 1];
    if (son && son.a === h.a && son.k === h.k && Math.abs(son.tur) === 1 && son.tur === h.d) son.tur *= 2;
    else parcalar.push({ a: h.a, k: h.k, tur: h.d });
  });
  const sure = Math.max(28, 1000 / parcalar.length);
  parcalar.forEach((p, i) => donus(p.a, p.k, p.tur, sure, i === parcalar.length - 1 ? bitir : null));
}

function karistirmaUret() {
  if (mod === 'gunluk') return M.gununKaristirmasi(gunNo, N);
  return M.karistir(N, M.uretec((Math.random() * 4294967296) >>> 0));
}

function segmentleriGuncelle() {
  boyutDugmeleri.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.boyut) === N)));
  modDugmeleri.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mod === mod)));
}

// ---------- Kayıt (yarım kalan oyun) ----------
const kodla = (liste) => liste.map((h) => h.a + ',' + h.k + ',' + h.d).join(' ');
const coz = (metin) => (metin ? metin.split(' ').map((p) => { const [a, k, d] = p.split(',').map(Number); return { a, k, d }; }) : []);

function kaydet() {
  if (asama === 'cozuldu' || asama === 'karisiyor') return;
  Depo.yaz('kup:oyun', {
    n: N, mod, gun: gunNo, karistirma: kodla(karistirma),
    gecmis: kodla(gecmis), geri: geriYigini.map((g) => g.length), hamle: hamleSayisi, gecen: Math.round(gecen())
  });
}

function geriYukle() {
  const k = Depo.oku('kup:oyun', null);
  if (!k || !M.BOYUTLAR.includes(k.n)) return false;
  if (k.mod === 'gunluk' && k.gun !== gunNo) return false;
  N = k.n;
  mod = k.mod;
  kupuKur();
  durum = M.cozulmus(N);
  karistirma = coz(k.karistirma);
  gecmis = coz(k.gecmis);
  M.hepsiniUygula(durum, karistirma);
  M.hepsiniUygula(durum, gecmis);
  if (M.cozulduMu(durum)) return false;
  karistirma.concat(gecmis).forEach(gorselUygula);
  geriYigini = [];
  let i = 0;
  (k.geri || []).forEach((uz) => { geriYigini.push(gecmis.slice(i, i + uz)); i += uz; });
  hamleSayisi = k.hamle || 0;
  hamleEl.textContent = hamleSayisi;
  gecenMs = k.gecen || 0;
  sureEl.textContent = M.sureMetni(gecenMs);
  sureEl.classList.add('durdu');
  asama = gecmis.length ? 'oynuyor' : 'hazir';
  segmentleriGuncelle();
  mesaj(asama === 'oynuyor' ? 'Kaldığın yerden devam: döndürünce süre akar' : 'Başlamak için döndür');
  if (asama === 'oynuyor') asama = 'hazir-devam';
  ipucuGuncelle();
  iste();
  return true;
}

// ---------- İpucu ve rehber ----------
function siradakiHamle() {
  if (asama === 'cozuldu' || asama === 'karisiyor' || !durum) return null;
  if (N === 3) {
    if (!cozum) {
      const s = C.coz(durum);
      cozum = s.basarili ? s : null;
    }
    const adim = cozum && cozum.adimlar.find((a) => a.hamleler.length);
    return adim ? adim.hamleler[0] : null;
  }
  // 2×2 ve 4×4: karıştırmayı geri sarma.
  const geri = M.tersDizi(M.sadelestir(karistirma.concat(gecmis)));
  return geri[0] || null;
}

function ipucuGuncelle() {
  rehberGuncelle();
  if (rehberAcik || ipucuHamlesi) {
    ipucuHamlesi = siradakiHamle();
    okGoster(ipucuHamlesi);
  } else {
    okuKaldir();
  }
}

function rehberGuncelle() {
  rehberEl.hidden = !rehberAcik;
  $('rehber-ac').textContent = rehberAcik ? 'Rehberi kapat' : 'Adım adım çözüm rehberi';
  if (!rehberAcik) return;
  const baslik = $('rehber-baslik');
  const metin = $('rehber-metin');
  const liste = $('rehber-hamleler');
  const adimEl = $('rehber-adim');
  liste.innerHTML = '';
  if (asama === 'cozuldu') {
    adimEl.textContent = 'Bitti';
    baslik.textContent = 'Küp çözüldü';
    metin.textContent = 'Yeni bir karıştırma için karıştır düğmesine bas.';
    return;
  }
  if (N !== 3) {
    adimEl.textContent = N + '×' + N;
    baslik.textContent = 'Geri sarma ipucu';
    metin.textContent = 'Adım adım rehber 3×3 küp içindir. Bu boyutta ok, karıştırmayı geri saran sıradaki hamleyi gösterir.';
    return;
  }
  siradakiHamle();
  if (!cozum) {
    adimEl.textContent = '';
    baslik.textContent = 'Rehber hazırlanamadı';
    metin.textContent = 'Bir hamle yap, rehber yeniden denesin.';
    return;
  }
  const i = cozum.adimlar.findIndex((a) => a.hamleler.length);
  const adim = cozum.adimlar[i];
  adimEl.textContent = 'Adım ' + (i + 1) + '/' + cozum.adimlar.length;
  baslik.textContent = adim.ad;
  metin.textContent = adim.metin;
  const g = gorunum();
  const gruplar = [];
  adim.hamleler.forEach((h) => {
    const son = gruplar[gruplar.length - 1];
    if (son && son.h.a === h.a && son.h.k === h.k && son.h.d === h.d && son.adet === 1) son.adet = 2;
    else gruplar.push({ h, adet: 1 });
  });
  gruplar.slice(0, 14).forEach((gr, j) => {
    const s = document.createElement('span');
    const ad = M.hamleAdi(gr.h, 3, g);
    s.textContent = gr.adet === 2 ? ad.replace("'", '') + '2' : ad;
    if (j === 0) s.className = 'siradaki';
    liste.append(s, ' ');
  });
  if (gruplar.length > 14) liste.append('…');
}

// ---------- Girdi: sürükleme ----------
const isin = new THREE.Raycaster();
let surukleme = null;
const ESIK = 7;

function ekranNoktasi(v) {
  const r = canvas.getBoundingClientRect();
  const p = v.clone().project(kamera);
  return new THREE.Vector2((p.x + 1) / 2 * r.width, (1 - p.y) / 2 * r.height);
}

function katmanDonebilir() { return asama === 'hazir' || asama === 'oynuyor' || asama === 'hazir-devam'; }

canvas.addEventListener('pointerdown', (e) => {
  if (surukleme || (e.button !== undefined && e.button > 0)) return;
  canvas.setPointerCapture(e.pointerId);
  atalet = null;
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  isin.setFromCamera(ndc, kamera);
  const vurus = isin.intersectObjects(govdeler, false)[0];
  surukleme = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, mod: 'bekle', t: performance.now(), vx: 0, vy: 0 };
  if (vurus && katmanDonebilir() && !kutlama) {
    surukleme.kupcuk = vurus.object.userData.kupcuk;
    surukleme.yerel = kupGrup.worldToLocal(vurus.point.clone());
    surukleme.dunya = vurus.point.clone();
  }
  canvas.classList.add('suruklu');
});

function katmanSec(dx, dy) {
  const s = surukleme;
  const p = s.yerel;
  const mutlak = [Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)];
  const nEksen = mutlak.indexOf(Math.max(...mutlak));
  const surukVek = new THREE.Vector2(dx, dy);
  let enIyi = null;
  for (let b = 0; b < 3; b++) {
    if (b === nEksen) continue;
    const t = new THREE.Vector3().crossVectors(EKSENLER[b], p); // +açı yönünde teğet (yerel)
    const yaricap = Math.max(t.length(), 0.35);
    const tDunya = t.clone().normalize().applyQuaternion(kupGrup.quaternion);
    const eps = 0.05;
    const a0 = ekranNoktasi(s.dunya);
    const a1 = ekranNoktasi(s.dunya.clone().add(tDunya.multiplyScalar(eps)));
    const ekranYon = a1.sub(a0);
    const pikselBirim = ekranYon.length() / eps;
    if (pikselBirim < 1e-3) continue;
    ekranYon.normalize();
    const puan = Math.abs(ekranYon.dot(surukVek)) / surukVek.length();
    if (!enIyi || puan > enIyi.puan) enIyi = { b, puan, ekranYon, pikselRad: pikselBirim * yaricap };
  }
  if (!enIyi) return false;
  const k = s.kupcuk.userData.p[enIyi.b];
  s.mod = 'katman';
  s.a = enIyi.b;
  s.k = k;
  s.ekranYon = enIyi.ekranYon;
  s.pikselRad = enIyi.pikselRad;
  s.gorunum = gorunum();
  const kur = pivotKur(enIyi.b, k, true);
  s.pivot = kur.pivot;
  s.cerceve = kur.cerceve;
  s.aci = 0;
  okuKaldir();
  return true;
}

function kupuCevir(dx, dy) {
  const qY = new THREE.Quaternion().setFromAxisAngle(EKSENLER[1], dx);
  const sag = new THREE.Vector3(1, 0, 0);
  const qX = new THREE.Quaternion().setFromAxisAngle(sag, dy);
  kupGrup.quaternion.premultiply(qY).premultiply(qX).normalize();
  iste();
}

canvas.addEventListener('pointermove', (e) => {
  const s = surukleme;
  if (!s || e.pointerId !== s.id) return;
  const dx = e.clientX - s.sx, dy = e.clientY - s.sy;
  if (s.mod === 'bekle') {
    if (Math.hypot(dx, dy) < ESIK) return;
    if (!(s.kupcuk && !aktif && !kuyruk.length && katmanSec(dx, dy))) s.mod = 'cevir';
  }
  if (s.mod === 'katman') {
    s.aci = new THREE.Vector2(dx, dy).dot(s.ekranYon) / s.pikselRad;
    s.aci = THREE.MathUtils.clamp(s.aci, -Math.PI, Math.PI);
    s.pivot.quaternion.setFromAxisAngle(EKSENLER[s.a], s.aci);
    iste();
  } else if (s.mod === 'cevir') {
    const ax = (e.clientX - s.x) * 0.009, ay = (e.clientY - s.y) * 0.009;
    const simdi = performance.now();
    const dt = Math.max(1, simdi - s.t);
    s.vx = ax / dt * 16; s.vy = ay / dt * 16;
    s.t = simdi;
    kupuCevir(ax, ay);
  }
  s.x = e.clientX; s.y = e.clientY;
});

function suruklemeBitti(e) {
  const s = surukleme;
  if (!s || e.pointerId !== s.id) return;
  surukleme = null;
  canvas.classList.remove('suruklu');
  if (s.mod === 'katman') {
    const q = s.aci / CEYREK;
    let tur = Math.sign(q) * Math.floor(Math.abs(q) + 0.75);
    tur = THREE.MathUtils.clamp(tur, -2, 2);
    const a = s.a, k = s.k, gor = s.gorunum;
    donus(a, k, tur, 150, () => {
      const d = Math.sign(tur);
      const hamleler = [];
      for (let i = 0; i < Math.abs(tur); i++) hamleler.push({ a, k, d });
      if (asama === 'hazir-devam' && hamleler.length) { asama = 'oynuyor'; mesaj(''); sureyiBaslat(); }
      if (hamleler.length) hareketIsle(hamleler, gor);
      else ipucuGuncelle();
    }, { pivot: s.pivot, cerceve: s.cerceve, aci: s.aci });
  } else if (s.mod === 'cevir') {
    if (!hareketAz() && performance.now() - s.t < 80) atalet = { x: s.vx, y: s.vy };
    iste();
    if (rehberAcik) rehberGuncelle();
    if (ok) okGoster(ipucuHamlesi);
  }
}
canvas.addEventListener('pointerup', suruklemeBitti);
canvas.addEventListener('pointercancel', suruklemeBitti);

// ---------- Girdi: klavye ----------
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('dialog[open]')) return;
  if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
  const tus = e.key.toUpperCase();
  if (e.key.startsWith('Arrow')) {
    const adim = 0.25;
    kupuCevir(e.key === 'ArrowLeft' ? -adim : e.key === 'ArrowRight' ? adim : 0, e.key === 'ArrowUp' ? -adim : e.key === 'ArrowDown' ? adim : 0);
    e.preventDefault();
    if (rehberAcik) rehberGuncelle();
    return;
  }
  if (!'RLUDFB'.includes(tus) || tus.length !== 1 || !katmanDonebilir() || kutlama) return;
  e.preventDefault();
  const g = gorunum();
  const f = g[tus];
  const v = M.YUZ_VEKTOR[f];
  const a = v[0] ? 0 : v[1] ? 1 : 2;
  const isaret = v[a];
  const d = -isaret * (e.shiftKey ? -1 : 1);
  const h = { a, k: isaret * (N - 1), d };
  okuKaldir();
  donus(a, h.k, d, hareketAz() ? 60 : 160, () => {
    if (asama === 'hazir-devam') { asama = 'oynuyor'; mesaj(''); sureyiBaslat(); }
    hareketIsle([h], g);
  });
});

// ---------- Düğmeler ----------
$('geri-al').addEventListener('click', () => {
  if (!geriYigini.length || !katmanDonebilir() || aktif || kuyruk.length) return;
  const son = geriYigini.pop();
  gecmis.splice(gecmis.length - son.length, son.length);
  son.forEach((h) => M.uygula(durum, M.ters(h)));
  hamleSayisi = Math.max(0, hamleSayisi - 1);
  hamleEl.textContent = hamleSayisi;
  if (izEl.lastChild) izEl.lastChild.remove();
  cozum = null;
  const h = son[0];
  okuKaldir();
  donus(h.a, h.k, -h.d * son.length, 140, () => { kaydet(); ipucuGuncelle(); });
});

$('karistir').addEventListener('click', () => {
  if (asama === 'karisiyor') return;
  yeniOyun(karistirmaUret());
});

$('ipucu').addEventListener('click', () => {
  if (!katmanDonebilir()) return;
  if (ipucuHamlesi && !rehberAcik) { ipucuHamlesi = null; okuKaldir(); $('ipucu').setAttribute('aria-pressed', 'false'); return; }
  ipucuHamlesi = siradakiHamle();
  $('ipucu').setAttribute('aria-pressed', String(!!ipucuHamlesi));
  okGoster(ipucuHamlesi);
  if (ipucuHamlesi) mesaj('Sıradaki hamle: ' + M.hamleAdi(ipucuHamlesi, N, gorunum()));
  setTimeout(() => { if (durumEl.textContent.startsWith('Sıradaki')) mesaj(''); }, 2200);
});

function rehberDegistir(acik) {
  rehberAcik = acik;
  ipucuHamlesi = null;
  $('ipucu').setAttribute('aria-pressed', 'false');
  boyutlandir();
  ipucuGuncelle();
}
$('rehber-ac').addEventListener('click', () => rehberDegistir(!rehberAcik));
$('rehber-kapat').addEventListener('click', () => rehberDegistir(false));

boyutDugmeleri.forEach((b) => b.addEventListener('click', () => {
  const yeni = Number(b.dataset.boyut);
  if (yeni === N && asama !== 'cozuldu') return;
  N = yeni;
  Depo.yaz('kup:boyut', N);
  yeniOyun(karistirmaUret());
}));
modDugmeleri.forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.mod === mod && asama !== 'cozuldu') return;
  mod = b.dataset.mod;
  yeniOyun(karistirmaUret());
}));

$('ayar-ac').addEventListener('click', () => {
  $('sembol-ayari').checked = sembolModu;
  $('ayarlar').showModal();
});
$('sembol-ayari').addEventListener('change', (e) => {
  sembolModu = e.target.checked;
  Depo.yaz('kup:sembol', sembolModu);
  sembolleriUygula();
});

$('istatistik-ac').addEventListener('click', () => {
  const govde = $('rekor-satirlari');
  govde.innerHTML = '';
  M.BOYUTLAR.forEach((n) => {
    const r = Depo.oku('kup:rekor:' + n, null);
    const tr = document.createElement('tr');
    [n + '×' + n, r && r.sure != null ? M.sureMetni(r.sure) : '–', r && r.hamle != null ? r.hamle : '–', r ? r.cozulen : 0].forEach((deger) => {
      const td = document.createElement('td');
      td.textContent = deger;
      tr.append(td);
    });
    govde.append(tr);
  });
  const bugunkuler = M.BOYUTLAR.map((n) => {
    const g = Depo.oku('kup:gunluk:' + n, null);
    return g && g.gun === gunNo ? n + '×' + n + ' ' + M.sureMetni(g.sure) : null;
  }).filter(Boolean);
  $('gunluk-ozet').textContent = 'Günlük küp #' + gunNo + ': ' + (bugunkuler.length ? bugunkuler.join(', ') : 'bugün henüz çözülmedi') + '.';
  $('istatistik').showModal();
});

$('yeniden').addEventListener('click', () => {
  $('sonuc').close();
  if (mod === 'gunluk') mod = 'serbest';
  yeniOyun(karistirmaUret());
});

$('paylas').addEventListener('click', () => {
  const metin = M.paylasimMetni(gunNo, N, gecenMs, hamleSayisi);
  const satir = $('sonuc-metin');
  const tamam = () => { $('paylas').textContent = 'Kopyalandı'; setTimeout(() => { $('paylas').textContent = 'Sonucu kopyala'; }, 1600); };
  const goster = () => { satir.hidden = false; satir.textContent = metin; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(metin).then(tamam, goster);
  else goster();
});

// ---------- Başlangıç ----------
sembolleriUygula();
if (!geriYukle()) {
  N = Depo.oku('kup:boyut', 3);
  if (!M.BOYUTLAR.includes(N)) N = 3;
  const g = Depo.oku('kup:gunluk:' + N, null);
  mod = g && g.gun === gunNo ? 'serbest' : 'gunluk';
  yeniOyun(karistirmaUret());
}
// Test ve hata ayıklama için küçük bir pencere.
window.__zekaKupu = { durum: () => durum, asama: () => asama, hamle: () => hamleSayisi, cozulduMu: () => M.cozulduMu(durum) };
