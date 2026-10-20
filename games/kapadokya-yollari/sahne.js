// Kapadokya Yolları'nın three.js sahnesi: gökyüzü, parça parça arazi, yol, peribacaları, balonlar, araç,
// hayalet, kontrol noktaları ve toz parçacıkları. Oyun mantığı mantik.js'te; burası yalnızca çizer.
import * as THREE from '../../assets/vendor/three/three.module.min.js';

const M = window.KapadokyaMantik;

// DESIGN.md paleti ve "Oyun içi ek renkler"
const P = {
  murekkep: 0x110f0d, kagit: 0x1b1815, kagit2: 0x26211c, cizgi: 0x3b332b, krem: 0xf3ead8, soluk: 0xb4a78f,
  sodyum: 0xffb23f, sodyumGolge: 0xb8741a, kor: 0xff6a48, yaprak: 0x368549, ay: 0x9db4ff,
  kemik: 0xe9dcc2, ceviz: 0x5a3b24, cim: 0x2c5a3a, kum: 0xc9a46a, bos: 0x2e2822
};
const R = {};
for (const ad in P) R[ad] = new THREE.Color(P[ad]);

const YUKLE_YARICAP = 340;   // sis 300 m'de tamamen kapanır; parçalar onun ötesinde yüklenir
const BOSALT_YARICAP = 430;
const SIS_YAKIN = 50, SIS_UZAK = 300;
const GUNES_YON = new THREE.Vector3(-0.42, 0.11, 0.9).normalize();
const AY_YON = new THREE.Vector3(0.42, 0.42, 0.8).normalize();

function karisim(a, b, t) { return a.clone().lerp(b, t); }

// Birden çok küçük geometriyi tek düz gölgeli, köşe renkli geometriye toplar (parça başına tek çizim çağrısı).
class Birlestirici {
  constructor() { this.p = []; this.c = []; }
  ekle(geo, matris, renk) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matris);
    const pos = g.attributes.position.array;
    for (let i = 0; i < pos.length; i++) this.p.push(pos[i]);
    for (let i = 0; i < pos.length / 3; i++) this.c.push(renk.r, renk.g, renk.b);
    g.dispose();
  }
  bosMu() { return this.p.length === 0; }
  geometri() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function matris(x, y, z, ry, sx, sy, sz, rx, rz) {
  _e.set(rx || 0, ry || 0, rz || 0, 'YXZ');
  _q.setFromEuler(_e);
  return _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy == null ? sx : sy, sz == null ? sx : sz));
}

// Yuvarlak, yumuşak kenarlı bir parıltı dokusu (farlar, ay, balon ateşi, gölge).
function parilti(ic, dis) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, ic); g.addColorStop(0.35, ic); g.addColorStop(1, dis);
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function yaziDokusu(metin, zemin, yazi, dama) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = zemin; x.fillRect(0, 0, 512, 64);
  if (dama) {
    x.fillStyle = dama;
    for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) x.fillRect(i * 16, j * 16, 16, 16);
    x.fillStyle = zemin; x.fillRect(150, 6, 212, 52);
  }
  x.fillStyle = yazi;
  x.font = '800 40px system-ui, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(metin, 256, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const GOK_VS = `
varying vec3 vYon;
void main() {
  vYon = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const GOK_FS = `
uniform vec3 zirve; uniform vec3 orta; uniform vec3 alt; uniform vec3 sis;
uniform vec3 bant1; uniform vec3 bant2; uniform float bantGuc; uniform vec3 gunes;
varying vec3 vYon;
void main() {
  vec3 d = normalize(vYon);
  float h = d.y;
  float az = max(0.0, dot(normalize(d.xz + vec2(1e-5)), normalize(gunes.xz)));
  float yakin = pow(az, 4.0);
  vec3 renk = mix(alt, orta, smoothstep(0.0, 0.16, h));
  renk = mix(renk, zirve, smoothstep(0.14, 0.62, h));
  float kalinlik = 0.05 + 0.1 * yakin;
  float bant = (1.0 - smoothstep(0.0, kalinlik, h)) * bantGuc * (0.22 + 0.78 * yakin);
  vec3 bantRenk = mix(bant1, bant2, smoothstep(0.0, kalinlik * 0.9, h));
  renk = mix(renk, bantRenk, bant);
  renk += bant1 * pow(az, 40.0) * bantGuc * 0.35 * (1.0 - smoothstep(0.0, 0.25, h));
  renk = mix(renk, sis, 1.0 - smoothstep(-0.035, 0.004, h));
  gl_FragColor = vec4(renk, 1.0);
  #include <colorspace_fragment>
}`;

const TOZ_VS = `
attribute float boyut; attribute float alfa; attribute vec3 renk;
uniform float olcek;
varying float vAlfa; varying vec3 vRenk;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = boyut * olcek / max(0.5, -mv.z);
  vAlfa = alfa * smoothstep(2.0, 5.0, -mv.z); vRenk = renk;
}`;
const TOZ_FS = `
uniform float isik;
varying float vAlfa; varying vec3 vRenk;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = (1.0 - smoothstep(0.08, 0.5, d)) * vAlfa;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vRenk * isik, a);
  #include <colorspace_fragment>
}`;

export class Sahne {
  constructor(tuval, secenek) {
    this.azHareket = !!(secenek && secenek.azHareket);
    const dpr = window.devicePixelRatio || 1;
    this.renderer = new THREE.WebGLRenderer({ canvas: tuval, antialias: dpr < 1.5, powerPreference: 'high-performance' });
    this.azamiOran = Math.min(dpr, 1.75);
    this.oran = Math.min(dpr, 1.5);
    this.renderer.setPixelRatio(this.oran);
    this.sahne = new THREE.Scene();
    this.sahne.fog = new THREE.Fog(P.kagit2, SIS_YAKIN, SIS_UZAK);
    this.kamera = new THREE.PerspectiveCamera(62, 1, 0.3, 1400);
    this.kamera.position.set(0, 6, -10);
    this.temelFov = 62;

    this._isiklar();
    this._gokyuzu();
    this._malzemeler();
    this._arac();
    this._hayalet();
    this._toz();
    this._balonlar();

    this.parcalar = new Map();
    this.yolBloklari = new Map();
    this.kapilar = [];
    this.gece = 0;
    this.kamHedef = new THREE.Vector3();
    this.kamBakis = new THREE.Vector3();
    this.kamIlk = true;
    this.zaman = 0;
  }

  // ---------- Kurulum ----------

  _isiklar() {
    this.yarimKure = new THREE.HemisphereLight(P.ay, P.ceviz, 0.9);
    this.gunes = new THREE.DirectionalLight(P.sodyum, 2.6);
    this.gunes.position.copy(GUNES_YON).multiplyScalar(100);
    this.ayIsigi = new THREE.DirectionalLight(P.ay, 0.4);
    this.ayIsigi.position.copy(AY_YON).multiplyScalar(100);
    this.sahne.add(this.yarimKure, this.gunes, this.ayIsigi);
  }

  _gokyuzu() {
    this.gokU = {
      zirve: { value: R.murekkep.clone() }, orta: { value: R.kagit2.clone() }, alt: { value: R.cizgi.clone() },
      sis: { value: R.kagit2.clone() }, bant1: { value: R.sodyum.clone() }, bant2: { value: R.kor.clone() },
      bantGuc: { value: 1 }, gunes: { value: GUNES_YON.clone() }
    };
    const gok = new THREE.Mesh(
      new THREE.SphereGeometry(1000, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.gokU, vertexShader: GOK_VS, fragmentShader: GOK_FS, side: THREE.BackSide, depthWrite: false, fog: false })
    );
    gok.renderOrder = -2;
    gok.frustumCulled = false;
    this.gok = gok;
    this.sahne.add(gok);

    // Yıldızlar: yalnızca gece görünür
    const r = M.uretec(7), pos = [];
    for (let i = 0; i < 700; i++) {
      const a = r() * Math.PI * 2, h = 0.08 + Math.pow(r(), 0.8) * 0.92;
      const yat = Math.sqrt(1 - h * h);
      pos.push(Math.cos(a) * yat * 900, h * 900, Math.sin(a) * yat * 900);
    }
    const yg = new THREE.BufferGeometry();
    yg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.yildizMalz = new THREE.PointsMaterial({ color: P.krem, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.yildizlar = new THREE.Points(yg, this.yildizMalz);
    this.yildizlar.renderOrder = -1;
    this.yildizlar.frustumCulled = false;
    this.sahne.add(this.yildizlar);

    // Ay: kemik rengi disk ve soğuk hale
    this.ayMalz = new THREE.MeshBasicMaterial({ color: P.kemik, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.ay = new THREE.Mesh(new THREE.CircleGeometry(16, 24), this.ayMalz);
    this.ayHaleMalz = new THREE.SpriteMaterial({ map: parilti('rgba(157,180,255,0.55)', 'rgba(157,180,255,0)'), transparent: true, opacity: 0, fog: false, depthWrite: false, blending: THREE.AdditiveBlending });
    this.ayHale = new THREE.Sprite(this.ayHaleMalz);
    this.ayHale.scale.set(150, 150, 1);
    this.ay.renderOrder = this.ayHale.renderOrder = -1;
    this.sahne.add(this.ay, this.ayHale);
  }

  _malzemeler() {
    this.araziMalz = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.yolMalz = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.reflektorMalz = new THREE.MeshBasicMaterial({ color: P.sodyum });
    this.pencereMalz = new THREE.MeshBasicMaterial({ color: P.sodyum });

    // Tekrar kullanılan ilkel şekiller
    this.sekil = {
      kutu: new THREE.BoxGeometry(1, 1, 1),
      kaya: new THREE.IcosahedronGeometry(1, 0),
      koni: new THREE.ConeGeometry(1, 1, 7, 1),
      kavak: new THREE.ConeGeometry(1, 1, 6, 1),
      govde: new THREE.CylinderGeometry(1, 1, 1, 5, 1),
      peri: []
    };
    // Dört farklı, hafif çarpık peribacası gövdesi (aynı köşeler aynı kaydırmayı alır, delik açılmaz)
    for (let k = 0; k < 4; k++) {
      const g = new THREE.CylinderGeometry(0.42, 1, 1, 7, 4);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const h = M.karistir(Math.round(x * 100), Math.round(y * 100), Math.round(z * 100) + k * 7919) / 4294967296;
        const yan = 1 + (h - 0.5) * 0.28 * (y < 0.45 ? 1 : 0.3);
        p.setXYZ(i, x * yan, y + 0.5, z * yan);
      }
      g.computeVertexNormals();
      this.sekil.peri.push(g);
    }
  }

  _arac() {
    const grup = new THREE.Group();
    grup.rotation.order = 'YXZ';
    const govde = new THREE.Group();
    grup.add(govde);
    const krem = new THREE.MeshPhongMaterial({ color: P.krem, flatShading: true, shininess: 60, specular: P.ceviz });
    const cam = new THREE.MeshPhongMaterial({ color: P.murekkep, flatShading: true, shininess: 90, specular: P.soluk });
    const kor = new THREE.MeshLambertMaterial({ color: P.kor, flatShading: true });
    const koyu = new THREE.MeshLambertMaterial({ color: P.kagit2, flatShading: true });
    this.farMalz = new THREE.MeshBasicMaterial({ color: P.sodyum });
    this.stopMalz = new THREE.MeshBasicMaterial({ color: P.kor });
    this.aracMalz = [krem, cam, kor, koyu];

    const yan = (noktalar, genislik) => {
      const sekil = new THREE.Shape();
      noktalar.forEach(([z, y], i) => (i ? sekil.lineTo(z, y) : sekil.moveTo(z, y)));
      const g = new THREE.ExtrudeGeometry(sekil, { depth: genislik, bevelEnabled: false });
      g.rotateY(-Math.PI / 2);
      g.translate(genislik / 2, 0, 0);
      return g;
    };
    // Yandan profil (z ileri, y yukarı)
    const alt = yan([[-1.95, 0.32], [1.95, 0.32], [1.98, 0.66], [1.0, 0.92], [-1.6, 0.98], [-1.98, 0.86]], 1.78);
    const kabin = yan([[-1.45, 0.96], [0.92, 0.94], [0.28, 1.36], [-1.05, 1.38]], 1.5);
    const tavan = new THREE.BoxGeometry(1.36, 0.06, 1.2); tavan.translate(0, 1.39, -0.38);
    const parcalar = [
      [alt, krem], [kabin, cam], [tavan, krem]
    ];
    // Kor ralli şeridi: kaput, tavan ve bagaj boyunca
    const serit1 = new THREE.BoxGeometry(0.34, 0.03, 1.02); serit1.translate(0, 0.8, 1.45);
    const serit1b = new THREE.BoxGeometry(0.34, 0.03, 0.62); serit1b.rotateX(0.24); serit1b.translate(0, 0.91, 0.95);
    const serit2 = new THREE.BoxGeometry(0.34, 0.03, 1.2); serit2.translate(0, 1.43, -0.38);
    const serit3 = new THREE.BoxGeometry(1.82, 0.12, 3.2); serit3.translate(0, 0.52, 0.05);
    const tampon = new THREE.BoxGeometry(1.84, 0.2, 0.2); tampon.translate(0, 0.36, 1.95);
    const tampon2 = tampon.clone(); tampon2.translate(0, 0, -3.9);
    const kanat = new THREE.BoxGeometry(1.6, 0.06, 0.4); kanat.translate(0, 1.42, -1.62);
    const ayak = new THREE.BoxGeometry(0.08, 0.3, 0.12);
    const ayak1 = ayak.clone(); ayak1.translate(0.6, 1.2, -1.62);
    const ayak2 = ayak.clone(); ayak2.translate(-0.6, 1.2, -1.62);
    parcalar.push([serit1, kor], [serit1b, kor], [serit2, kor], [serit3, kor], [tampon, koyu], [tampon2, koyu], [kanat, koyu], [ayak1, koyu], [ayak2, koyu]);
    for (const [g, m] of parcalar) govde.add(new THREE.Mesh(g, m));

    const far = new THREE.BoxGeometry(0.42, 0.14, 0.06);
    for (const x of [-0.58, 0.58]) {
      const f = new THREE.Mesh(far, this.farMalz); f.position.set(x, 0.62, 1.97); govde.add(f);
      const s = new THREE.Mesh(far, this.stopMalz); s.position.set(x, 0.72, -1.98); govde.add(s);
    }
    // Far parıltısı (gece)
    this.farParilti = [];
    const pm = new THREE.SpriteMaterial({ map: parilti('rgba(255,178,63,0.9)', 'rgba(255,178,63,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    this.farParMalz = pm;
    for (const x of [-0.58, 0.58]) {
      const sp = new THREE.Sprite(pm); sp.scale.set(0.9, 0.9, 1); sp.position.set(x, 0.62, 2.08);
      govde.add(sp); this.farParilti.push(sp);
    }

    // Tekerlekler
    const lastik = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10); lastik.rotateZ(Math.PI / 2);
    const jant = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 6); jant.rotateZ(Math.PI / 2);
    const lastikM = new THREE.MeshLambertMaterial({ color: P.murekkep, flatShading: true });
    const jantM = new THREE.MeshLambertMaterial({ color: P.soluk, flatShading: true });
    this.tekerler = [];
    for (const [x, z] of [[0.82, 1.28], [-0.82, 1.28], [0.82, -1.25], [-0.82, -1.25]]) {
      const pivot = new THREE.Group(); pivot.position.set(x, 0.36, z);
      const t = new THREE.Group();
      t.add(new THREE.Mesh(lastik, lastikM), new THREE.Mesh(jant, jantM));
      pivot.add(t); grup.add(pivot);
      this.tekerler.push({ pivot, t, on: z > 0 });
    }

    // Altındaki yumuşak gölge
    const golge = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 4.8),
      new THREE.MeshBasicMaterial({ map: parilti('rgba(17,15,13,0.85)', 'rgba(17,15,13,0)'), transparent: true, depthWrite: false })
    );
    golge.rotation.x = -Math.PI / 2;
    golge.position.y = 0.04;
    grup.add(golge);

    // Farlar: gece gerçek spot ışık, yalnızca ileri
    this.far = new THREE.SpotLight(P.sodyum, 0, 150, 0.5, 0.5, 1);
    this.far.position.set(0, 0.8, 1.9);
    this.far.target.position.set(0, -0.6, 24);
    grup.add(this.far, this.far.target);

    this.aracGrup = grup;
    this.aracGovde = govde;
    this.sahne.add(grup);
  }

  _hayalet() {
    const malz = new THREE.MeshBasicMaterial({ color: P.krem, transparent: true, opacity: 0.3, depthWrite: false });
    const g = new THREE.Group();
    g.rotation.order = 'YXZ';
    this.aracGovde.traverse((o) => {
      if (o.isMesh) { const k = new THREE.Mesh(o.geometry, malz); k.position.copy(o.position); k.rotation.copy(o.rotation); g.add(k); }
    });
    this.hayaletGrup = g;
    this.hayaletMalz = malz;
    g.visible = false;
    this.sahne.add(g);
  }

  _toz() {
    const N = 220;
    this.tozN = N;
    this.tozBilgi = Array.from({ length: N }, () => ({ yas: 1, omur: 1, vx: 0, vy: 0, vz: 0, b0: 1, b1: 3, a0: 0.5 }));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('boyut', new THREE.BufferAttribute(new Float32Array(N), 1));
    g.setAttribute('alfa', new THREE.BufferAttribute(new Float32Array(N), 1));
    g.setAttribute('renk', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.tozU = { olcek: { value: 400 }, isik: { value: 1 } };
    const m = new THREE.ShaderMaterial({ uniforms: this.tozU, vertexShader: TOZ_VS, fragmentShader: TOZ_FS, transparent: true, depthWrite: false });
    this.toz = new THREE.Points(g, m);
    this.toz.frustumCulled = false;
    this.tozSira = 0;
    this.sahne.add(this.toz);
  }

  tozSac(x, y, z, vx, vz, renk, guc) {
    const i = this.tozSira = (this.tozSira + 1) % this.tozN;
    const b = this.tozBilgi[i];
    const g = this.toz.geometry;
    g.attributes.position.setXYZ(i, x, y, z);
    b.yas = 0; b.omur = 0.8 + Math.random() * 0.9;
    b.vx = vx * 0.25 + (Math.random() - 0.5) * 2.2; b.vy = 0.6 + Math.random() * 1.4; b.vz = vz * 0.25 + (Math.random() - 0.5) * 2.2;
    b.b0 = 0.6 + guc * 0.5; b.b1 = 1.8 + guc * 2.5 + Math.random() * 1.2; b.a0 = 0.16 + guc * 0.26;
    const c = renk || R.kum;
    g.attributes.renk.setXYZ(i, c.r, c.g, c.b);
    g.attributes.renk.needsUpdate = true;
  }

  _tozGuncelle(dt) {
    const g = this.toz.geometry, pos = g.attributes.position, boy = g.attributes.boyut, alfa = g.attributes.alfa;
    for (let i = 0; i < this.tozN; i++) {
      const b = this.tozBilgi[i];
      if (b.yas >= b.omur) { if (alfa.getX(i) !== 0) alfa.setX(i, 0); continue; }
      b.yas += dt;
      const t = Math.min(1, b.yas / b.omur);
      b.vy -= dt * 0.4; b.vx *= 1 - dt * 1.5; b.vz *= 1 - dt * 1.5;
      pos.setXYZ(i, pos.getX(i) + b.vx * dt, pos.getY(i) + b.vy * dt, pos.getZ(i) + b.vz * dt);
      boy.setX(i, b.b0 + (b.b1 - b.b0) * t);
      alfa.setX(i, b.a0 * (1 - t) * Math.min(1, t * 8));
    }
    pos.needsUpdate = boy.needsUpdate = alfa.needsUpdate = true;
  }

  _balonlar() {
    // Torna profili: yuvarlak tepe, sepete doğru daralan gövde; dikey dilimler sodyum/kor/kemik
    const profil = [[0.01, -1.15], [0.32, -1.0], [0.62, -0.62], [0.92, -0.1], [1.0, 0.35], [0.86, 0.78], [0.5, 1.05], [0.01, 1.14]].map(([x, y]) => new THREE.Vector2(x, y));
    const dilim = 12;
    const g = new THREE.LatheGeometry(profil, dilim).toNonIndexed();
    g.computeVertexNormals();
    const renkler = [R.sodyum, R.kor, R.kemik, R.kor];
    const pos = g.attributes.position, nor = g.attributes.normal, c = [];
    for (let i = 0; i < pos.count; i += 3) {
      // Üçgenin açısal dilimi -> renk; arkadan aydınlatma: güneşe bakan kenar parlar
      const mx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, mz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const a = (Math.atan2(mz, mx) + Math.PI * 2) % (Math.PI * 2);
      const renk = renkler[Math.floor(a / (Math.PI * 2) * dilim) % renkler.length];
      const n = new THREE.Vector3(nor.getX(i), nor.getY(i), nor.getZ(i));
      const isik = 0.42 + 0.5 * Math.max(0, n.dot(GUNES_YON)) + 0.16 * Math.max(0, n.y);
      for (let k = 0; k < 3; k++) c.push(renk.r * isik, renk.g * isik, renk.b * isik);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    this.balonMalz = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    const sepetMalz = new THREE.MeshBasicMaterial({ color: P.ceviz, fog: false });
    this.atesMalz = new THREE.SpriteMaterial({ map: parilti('rgba(255,178,63,1)', 'rgba(255,106,72,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const sepet = new THREE.BoxGeometry(0.34, 0.26, 0.34);
    this.balonListe = [];
    const r = M.uretec(4242);
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Group();
      // Her balonun kendi malzemesi: yeniden yerleşince ufukta yavaşça belirir (ani "pop-in" yok)
      const zarfMalz = this.balonMalz.clone(), sepetM = sepetMalz.clone(), atesM = this.atesMalz.clone();
      for (const m of [zarfMalz, sepetM]) m.transparent = true;
      const zarf = new THREE.Mesh(g, zarfMalz);
      const s = new THREE.Mesh(sepet, sepetM); s.position.y = -1.5;
      const ates = new THREE.Sprite(atesM); ates.position.y = -1.18; ates.scale.set(0.5, 0.5, 1);
      b.add(zarf, s, ates);
      const olcek = 9 + r() * 6;
      b.scale.setScalar(olcek);
      b.userData = { ates, faz: r() * 10, hiz: 0.5 + r() * 0.6, kurulu: false, malz: [zarfMalz, sepetM, atesM], gorunum: 0 };
      b.rotation.y = r() * Math.PI;
      this.balonListe.push(b);
      this.sahne.add(b);
    }
  }

  // ---------- Dünya ----------

  dunyaKur(dunya) {
    for (const p of this.parcalar.values()) this._parcaSil(p);
    for (const b of this.yolBloklari.values()) this._yolSil(b);
    this.parcalar.clear();
    this.yolBloklari.clear();
    this.kapilariKur(null);
    this.dunya = dunya;
    this.balonListe.forEach((b) => (b.userData.kurulu = false));
    this.kamIlk = true;
  }

  _parcaKur(cx, cz) {
    const d = this.dunya, N = M.PARCA_KAFES, K = M.KAFES;
    const ix0 = cx * N, iz0 = cz * N;
    const h = new Float32Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) h[j * (N + 1) + i] = d.kafesY(ix0 + i, iz0 + j);
    const pos = new Float32Array(N * N * 18), col = new Float32Array(N * N * 18);
    const renk = new THREE.Color();
    let p = 0;
    const tohum = d.tohum;
    const ucgen = (ax, ay, az, bx, by, bz, cx2, cy, cz2) => {
      // yüz normali (yalnızca y bileşeni gerekli: eğim)
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx2 - ax, vy = cy - ay, vz = cz2 - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const ey = ny / Math.hypot(nx, ny, nz);
      const mx = (ax + bx + cx2) / 3, mz = (az + bz + cz2) / 3, my = (ay + by + cy) / 3;
      const vadi = M.vadiDegeri(mx, mz, tohum);
      const titre = M.karistir(Math.floor(mx * 3), Math.floor(mz * 3), tohum) / 4294967296;
      const leke = M.gurultu2(mx / 45, mz / 45, tohum + 5);
      if (ey < 0.78) renk.copy(R.kum).lerp(R.kagit2, 0.35 + titre * 0.2);           // kayalık yamaç
      else if (ey < 0.9) renk.copy(R.kum).lerp(R.ceviz, 0.25 + titre * 0.15);       // kumlu eğim
      else if (vadi < 0.16 || my < -14) renk.copy(R.kum).lerp(R.ceviz, titre * 0.18); // vadi tabanı kum
      else renk.copy(R.cim).lerp(R.ceviz, leke * 0.55 + titre * 0.12);              // gece çimi
      const k = 0.94 + titre * 0.12;
      for (const [x, y, z] of [[ax, ay, az], [bx, by, bz], [cx2, cy, cz2]]) {
        pos[p] = x; pos[p + 1] = y; pos[p + 2] = z;
        col[p] = renk.r * k; col[p + 1] = renk.g * k; col[p + 2] = renk.b * k;
        p += 3;
      }
    };
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x0 = (ix0 + i) * K, z0 = (iz0 + j) * K, x1 = x0 + K, z1 = z0 + K;
        const ha = h[j * (N + 1) + i], hb = h[j * (N + 1) + i + 1], hc = h[(j + 1) * (N + 1) + i], hd = h[(j + 1) * (N + 1) + i + 1];
        // mantik.araziY ile aynı bölme: a-d köşegeni
        ucgen(x0, ha, z0, x1, hd, z1, x1, hb, z0);
        ucgen(x0, ha, z0, x0, hc, z1, x1, hd, z1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const arazi = new THREE.Mesh(g, this.araziMalz);
    arazi.matrixAutoUpdate = false;
    this.sahne.add(arazi);

    const nesneler = d.parcaNesneleri(cx, cz);
    const { nesne, pencere } = this._nesneGeometrisi(nesneler);
    const kayit = { arazi, nesneler, cx, cz };
    if (nesne) { kayit.nesne = new THREE.Mesh(nesne, this.araziMalz); kayit.nesne.matrixAutoUpdate = false; this.sahne.add(kayit.nesne); }
    if (pencere) { kayit.pencere = new THREE.Mesh(pencere, this.pencereMalz); kayit.pencere.matrixAutoUpdate = false; this.sahne.add(kayit.pencere); }
    return kayit;
  }

  _nesneGeometrisi(nesneler) {
    const b = new Birlestirici(), w = new Birlestirici();
    const renk = new THREE.Color(), sapka = new THREE.Color();
    for (const n of nesneler) {
      const r = M.uretec(n.tohum);
      const tit = 0.92 + r() * 0.16;
      if (n.tur === 'peri') {
        // Kümeler halinde 1-3 bacadan oluşan bir grup
        const adet = 1 + Math.floor(r() * 3);
        for (let k = 0; k < adet; k++) {
          const ox = k ? (r() - 0.5) * 5 * n.olcek : 0, oz = k ? (r() - 0.5) * 5 * n.olcek : 0;
          const gen = (1.9 + r() * 0.9) * n.olcek * (k ? 0.75 : 1), boy = (8 + r() * 11) * n.olcek * (k ? 0.7 : 1);
          const y = n.y - 0.6;
          renk.copy(R.kum).lerp(R.kemik, r() * 0.25).multiplyScalar(tit);
          b.ekle(this.sekil.peri[Math.floor(r() * 4)], matris(n.x + ox, y, n.z + oz, r() * 6, gen, boy, gen), renk);
          // boyun ve koyu bazalt şapka
          sapka.copy(R.kagit2).lerp(R.ceviz, 0.4 + r() * 0.3);
          const sy = y + boy * 0.97;
          b.ekle(this.sekil.koni, matris(n.x + ox, sy + boy * 0.07, n.z + oz, r() * 6, gen * 0.78, boy * 0.16, gen * 0.78, (r() - 0.5) * 0.2, (r() - 0.5) * 0.2), sapka);
          // oyma kapı/pencere: bazıları gece sodyumla yanar
          if (boy > 9 && r() < 0.55) {
            const a = r() * Math.PI * 2, yy = y + boy * (0.25 + r() * 0.3);
            const yar = gen * (1 - (yy - y) / boy * 0.58) * 0.98;
            const px = n.x + ox + Math.sin(a) * yar, pz = n.z + oz + Math.cos(a) * yar;
            const hedef = r() < 0.5 ? w : b;
            hedef.ekle(this.sekil.kutu, matris(px, yy, pz, a, 0.7, 1.0, 0.3), R.murekkep);
          }
        }
      } else if (n.tur === 'kaya') {
        renk.copy(R.kum).lerp(R.kagit2, 0.4 + r() * 0.25);
        b.ekle(this.sekil.kaya, matris(n.x, n.y + 0.2, n.z, n.aci, n.r * 1.1, n.r * (0.5 + r() * 0.4), n.r * 0.9, r() * 0.4, r() * 0.4), renk);
      } else if (n.tur === 'kavak') {
        const boy = 6 + r() * 5;
        b.ekle(this.sekil.govde, matris(n.x, n.y + 0.7, n.z, 0, 0.16, 1.6, 0.16), R.ceviz);
        renk.copy(R.cim).lerp(R.yaprak, r() * 0.35).multiplyScalar(tit);
        b.ekle(this.sekil.kavak, matris(n.x, n.y + 1.3 + boy / 2, n.z, n.aci, 1.05 + r() * 0.4, boy, 1.05 + r() * 0.4), renk);
      } else if (n.tur === 'ev') {
        const gx = 4.5 * n.olcek, gz = 3.8 * n.olcek, gy = 2.6 + r() * 1.4;
        renk.copy(R.kemik).lerp(R.kum, 0.3 + r() * 0.5);
        b.ekle(this.sekil.kutu, matris(n.x, n.y + gy / 2 - 0.3, n.z, n.aci, gx, gy + 0.6, gz), renk);
        b.ekle(this.sekil.kutu, matris(n.x, n.y + gy + 0.12, n.z, n.aci, gx + 0.5, 0.3, gz + 0.5), R.kagit2);
        // pencereler: ön ve arka yüzde
        const s = Math.sin(n.aci), c = Math.cos(n.aci);
        for (const yon of [1, -1]) {
          for (const ofs of [-gx * 0.25, gx * 0.25]) {
            const lx = ofs, lz = yon * (gz / 2 + 0.03);
            const px = n.x + lx * c + lz * s, pz = n.z - lx * s + lz * c;
            (r() < 0.7 ? w : b).ekle(this.sekil.kutu, matris(px, n.y + gy * 0.55, pz, n.aci, 0.7, 0.8, 0.08), R.murekkep);
          }
        }
      }
    }
    return { nesne: b.bosMu() ? null : b.geometri(), pencere: w.bosMu() ? null : w.geometri() };
  }

  _parcaSil(p) {
    for (const ad of ['arazi', 'nesne', 'pencere']) {
      if (!p[ad]) continue;
      this.sahne.remove(p[ad]);
      p[ad].geometry.dispose();
    }
  }

  _yolKur(b) {
    const yol = this.dunya.yol, BL = M.BLOK, Y = M.YOL_YARI, O = M.OMUZ;
    const pos = [], col = [], idx = [];
    const asfalt = karisim(R.kagit2, R.cizgi, 0.25), omuz = karisim(R.kum, R.kagit2, 0.55), krem = R.krem;
    const kesitler = [-Y - O, -Y, Y, Y + O];
    let n = 0;
    for (let j = 0; j <= BL; j++) {
      const o = yol.ornek(b * BL + j);
      const rx = -Math.cos(o.yon), rz = Math.sin(o.yon);
      for (let k = 0; k < 4; k++) {
        const u = kesitler[k], y = k === 0 || k === 3 ? o.y - M.YOL_ALTI - 0.08 : o.y;
        pos.push(o.x + rx * u, y, o.z + rz * u);
      }
      if (j < BL) {
        const a = j * 4, c = a + 4;
        // sol omuz, asfalt, sağ omuz (u ekseni +x yönünün tersi olduğundan sıralama buna göre)
        for (let k = 0; k < 3; k++) idx.push(a + k, a + k + 1, c + k, a + k + 1, c + k + 1, c + k);
      }
    }
    // Düz gölgeleme için indekssiz: her şeridin rengi ayrı
    const g = new THREE.BufferGeometry();
    const p2 = [], c2 = [];
    for (let i = 0; i < idx.length; i += 3) {
      const serit = Math.floor((i / 3) % 6 / 2); // 0 omuz, 1 asfalt, 2 omuz
      const renk = serit === 1 ? asfalt : omuz;
      for (let k = 0; k < 3; k++) { const v = idx[i + k]; p2.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); c2.push(renk.r, renk.g, renk.b); }
    }
    // Krem kesikli orta çizgi ve reflektörler
    const refl = new Birlestirici();
    const s0 = b * BL * M.ADIM, s1 = (b + 1) * BL * M.ADIM;
    for (let s = Math.ceil(s0 / 10) * 10; s < s1; s += 10) {
      const a = yol.noktaS(s), e = yol.noktaS(s + 3);
      const ra = [-Math.cos(a.yon), Math.sin(a.yon)], re = [-Math.cos(e.yon), Math.sin(e.yon)], w = 0.09;
      const q = [
        [a.x - ra[0] * w, a.y + 0.03, a.z - ra[1] * w], [a.x + ra[0] * w, a.y + 0.03, a.z + ra[1] * w],
        [e.x + re[0] * w, e.y + 0.03, e.z + re[1] * w], [e.x - re[0] * w, e.y + 0.03, e.z - re[1] * w]
      ];
      for (const v of [q[0], q[2], q[1], q[0], q[3], q[2]]) { p2.push(v[0], v[1], v[2]); c2.push(krem.r, krem.g, krem.b); }
    }
    for (let s = Math.ceil(s0 / 24) * 24; s < s1; s += 24) {
      const a = yol.noktaS(s), rx = -Math.cos(a.yon), rz = Math.sin(a.yon);
      for (const u of [-(Y + 0.9), Y + 0.9]) {
        refl.ekle(this.sekil.kutu, matris(a.x + rx * u, a.y + 0.25, a.z + rz * u, a.yon, 0.12, 0.5, 0.12), R.sodyum);
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(c2, 3));
    // Yukarı bakan yüzler: sarım düzeltmesi için normali hesapla, aşağı bakıyorsa üçgeni çevir
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i += 3) {
      const ax = pa.getX(i), az = pa.getZ(i), bx = pa.getX(i + 1), bz = pa.getZ(i + 1), cx = pa.getX(i + 2), cz = pa.getZ(i + 2);
      const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      if (ny < 0) {
        const tx = pa.getX(i + 1), ty = pa.getY(i + 1), tz = pa.getZ(i + 1);
        pa.setXYZ(i + 1, cx, pa.getY(i + 2), cz);
        pa.setXYZ(i + 2, tx, ty, tz);
      }
    }
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, this.yolMalz);
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = 1;
    this.sahne.add(mesh);
    const r = new THREE.Mesh(refl.geometri(), this.reflektorMalz);
    r.matrixAutoUpdate = false;
    this.sahne.add(r);
    return { mesh, r };
  }

  _yolSil(k) {
    this.sahne.remove(k.mesh, k.r);
    k.mesh.geometry.dispose(); k.r.geometry.dispose();
  }

  // Araca yakın parçaları ve yol bloklarını yükler, uzakları boşaltır. butce: bu karede kurulacak en fazla parça.
  dunyaGuncelle(x, z, s, butce) {
    const gerekli = M.gerekliParcalar(x, z, YUKLE_YARICAP);
    let kurulan = 0;
    for (const p of gerekli) {
      if (this.parcalar.has(p.anahtar)) continue;
      if (kurulan >= butce) break;
      this.parcalar.set(p.anahtar, this._parcaKur(p.cx, p.cz));
      kurulan++;
    }
    for (const [anahtar, p] of this.parcalar) {
      const nx = Math.max(p.cx * M.PARCA, Math.min(x, (p.cx + 1) * M.PARCA)), nz = Math.max(p.cz * M.PARCA, Math.min(z, (p.cz + 1) * M.PARCA));
      if (Math.hypot(nx - x, nz - z) > BOSALT_YARICAP) { this._parcaSil(p); this.parcalar.delete(anahtar); }
    }
    const bs = M.BLOK * M.ADIM;
    const b0 = Math.max(0, Math.floor((s - 380) / bs)), b1 = Math.floor((s + 520) / bs);
    for (let b = b0; b <= b1; b++) {
      if (!this.yolBloklari.has(b) && kurulan < butce + 1) { this.yolBloklari.set(b, this._yolKur(b)); kurulan++; }
    }
    for (const [b, k] of this.yolBloklari) if (b < b0 - 1 || b > b1 + 1) { this._yolSil(k); this.yolBloklari.delete(b); }
    this.dunya.yol.buda(Math.floor(s / bs), 6);
    return kurulan;
  }

  bekleyenVar(x, z) {
    return M.gerekliParcalar(x, z, YUKLE_YARICAP).some((p) => !this.parcalar.has(p.anahtar));
  }

  // Aracın çevresindeki 3x3 parçanın engelleri
  engeller(x, z) {
    const cx = Math.floor(x / M.PARCA), cz = Math.floor(z / M.PARCA), liste = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const p = this.parcalar.get(M.parcaAnahtari(cx + i, cz + j));
      if (p) for (const n of p.nesneler) if (Math.abs(n.x - x) < 30 && Math.abs(n.z - z) < 30) liste.push(n);
    }
    return liste;
  }

  // ---------- Ralli kapıları ----------

  kapilariKur(parkur) {
    for (const k of this.kapilar) { this.sahne.remove(k.grup); k.bant.material.map.dispose(); k.bant.material.dispose(); }
    this.kapilar = [];
    if (!parkur) return;
    const direk = new THREE.CylinderGeometry(0.16, 0.22, 5.6, 6);
    const direkM = this.direkMalz || (this.direkMalz = new THREE.MeshLambertMaterial({ color: P.kemik, flatShading: true }));
    const bantG = this.bantGeo || (this.bantGeo = new THREE.BoxGeometry(M.KN_GENISLIK * 2, 1.3, 0.14));
    parkur.kn.forEach((s, i) => {
      const o = this.dunya.yol.noktaS(s);
      const grup = new THREE.Group();
      grup.position.set(o.x, o.y, o.z);
      grup.rotation.y = o.yon;
      const son = i === parkur.kn.length - 1;
      for (const u of [-M.KN_GENISLIK, M.KN_GENISLIK]) { const d = new THREE.Mesh(direk, direkM); d.position.set(u, 2.8, 0); grup.add(d); }
      const doku = yaziDokusu(son ? 'BİTİŞ' : 'KN ' + (i + 1), '#ffb23f', '#1d1307', son ? '#1d1307' : null);
      const bant = new THREE.Mesh(bantG, new THREE.MeshBasicMaterial({ map: doku }));
      bant.position.set(0, 5.0, 0);
      grup.add(bant);
      this.sahne.add(grup);
      this.kapilar.push({ grup, bant, son });
    });
  }

  kapiGecildi(i) {
    const k = this.kapilar[i];
    if (!k) return;
    k.bant.material.map.dispose();
    k.bant.material.map = yaziDokusu(k.son ? 'BİTİŞ' : 'KN ' + (i + 1), '#f3ead8', '#1d1307', k.son ? '#1d1307' : null);
    k.bant.material.needsUpdate = true;
  }

  // ---------- Kare güncellemesi ----------

  boyutla(en, boy) {
    this.renderer.setSize(en, boy, false);
    this.kamera.aspect = en / Math.max(1, boy);
    // Dikey ekranda yatay görüş çok daralmasın
    this.temelFov = this.kamera.aspect < 1 ? 70 : 60;
    this.kamera.updateProjectionMatrix();
    this.en = en; this.boy = boy;
  }

  kaliteAyarla(oran) {
    const yeni = Math.round(Math.max(0.6, Math.min(this.azamiOran, oran)) * 100) / 100;
    if (yeni === this.oran) return;
    this.oran = yeni;
    this.renderer.setPixelRatio(this.oran);
    this.renderer.setSize(this.en, this.boy, false);
  }

  gokAyarla(gece) {
    this.gece = gece;
    const u = this.gokU;
    const sis = karisim(R.kagit2, R.kagit, gece);
    u.sis.value.copy(sis);
    this.sahne.fog.color.copy(sis);
    u.alt.value.copy(karisim(R.cizgi, R.kagit, gece));
    u.orta.value.copy(karisim(R.kagit2, R.murekkep, gece));
    u.zirve.value.copy(R.murekkep);
    u.bantGuc.value = Math.max(0, 1 - gece * 1.15);
    this.renderer.setClearColor(sis);
    this.gunes.intensity = 2.7 * (1 - gece);
    this.ayIsigi.intensity = 0.35 + gece * 1.5;
    this.yarimKure.intensity = 1.1 - gece * 0.2;
    this.yarimKure.color.copy(karisim(R.kum, R.ay, M.adimYumusak(0.1, 0.7, gece)));
    this.yildizMalz.opacity = M.adimYumusak(0.3, 0.8, gece);
    this.ayMalz.opacity = M.adimYumusak(0.35, 0.8, gece);
    this.ayHaleMalz.opacity = this.ayMalz.opacity * 0.5;
    const farGuc = M.adimYumusak(0.2, 0.6, gece);
    this.far.intensity = farGuc * 260;
    this.farParMalz.opacity = farGuc * 0.85;
    this.pencereMalz.color.copy(karisim(R.kagit2, R.sodyum, M.adimYumusak(0.05, 0.45, gece)));
    for (const b of this.balonListe) b.userData.malz[0].color.setScalar(1 - gece * 0.62);
    this.tozU.isik.value = 1.15 - gece * 0.6;
  }

  // durum: arac {x,y,z,yon,egim,yalpa,cokme,direksiyon,tekerDonus,hiz,fren}, kamera modu, dt
  guncelle(d, dt) {
    this.zaman += dt;
    const a = d.arac;
    const g = this.aracGrup;
    g.position.set(a.x, a.y, a.z);
    g.rotation.set(a.egim, a.yon, a.yalpa);
    this.aracGovde.position.y = a.cokme;
    this.aracGovde.rotation.set(a.susEgim, 0, a.susYalpa);
    for (const t of this.tekerler) {
      t.t.rotation.x = a.tekerDonus;
      t.pivot.rotation.y = t.on ? -a.direksiyon * 0.5 : 0;
    }
    this.stopMalz.color.setHex(a.fren ? P.kor : P.ceviz).lerp(R.kor, a.fren ? 0 : 0.5);

    if (d.hayalet) {
      const h = this.hayaletGrup;
      h.visible = true;
      h.position.set(d.hayalet.x, d.hayalet.y, d.hayalet.z);
      h.rotation.set(d.hayalet.egim || 0, d.hayalet.yon, 0);
      // Hayalet kameraya çok yaklaşınca solar (görüşü kapatmasın)
      const uz = h.position.distanceTo(this.kamera.position);
      this.hayaletMalz.opacity = 0.3 * M.adimYumusak(3, 9, uz);
    } else this.hayaletGrup.visible = false;

    this._kamera(d, dt);
    this._tozGuncelle(dt);
    this._balonGuncelle(a, dt);

    // Gökyüzü, yıldız ve ay kamerayı izler
    const k = this.kamera.position;
    this.gok.position.copy(k);
    this.yildizlar.position.copy(k);
    this.ay.position.copy(AY_YON).multiplyScalar(880).add(k);
    this.ay.lookAt(k);
    this.ayHale.position.copy(this.ay.position);
    this.tozU.olcek.value = this.boy * this.oran / (2 * Math.tan(this.kamera.fov * Math.PI / 360));
  }

  _kamera(d, dt) {
    const a = d.arac, kam = this.kamera;
    const hizOran = Math.min(1, Math.abs(a.hiz) / 40);
    if (d.kameraModu === 'yörünge') {
      // Menü ve ekran görüntüsü modu: aracın çevresinde ağır bir tur
      const aci = a.yon + Math.PI * 0.8 + (this.azHareket ? 0 : this.zaman * 0.07);
      const r = d.yorungeYaricap || 9;
      this.kamHedef.set(a.x + Math.sin(aci) * r, a.y + 2.2, a.z + Math.cos(aci) * r);
      // Dikey ekranda araç alt üçte birde kalsın, peribacaları ve gökyüzü görünsün
      this.kamBakis.set(a.x, a.y + (this.kamera.aspect < 1 ? 2.6 : 1.2), a.z);
      if (this.kamIlk) { kam.position.copy(this.kamHedef); this.kamIlk = false; }
      kam.position.lerp(this.kamHedef, 1 - Math.exp(-dt * 2));
      kam.lookAt(this.kamBakis);
      if (kam.fov !== this.temelFov) { kam.fov = this.temelFov; kam.updateProjectionMatrix(); }
      this.gecis = 0;
    } else {
      // Kovalama kamerası: araca sabit uzaklıkta, yalnızca yön ve yükseklik yumuşak izlenir (hızda geride kalmaz)
      let yon = a.yon;
      if (a.hiz > 3) {
        const hizYon = Math.atan2(a.vx, a.vz);
        let fark = hizYon - a.yon;
        while (fark > Math.PI) fark -= Math.PI * 2;
        while (fark < -Math.PI) fark += Math.PI * 2;
        yon += fark * 0.5;
      }
      if (this.kamIlk || this.kamYon == null) { this.kamYon = yon; this.kamY = a.y; }
      let fark = yon - this.kamYon;
      while (fark > Math.PI) fark -= Math.PI * 2;
      while (fark < -Math.PI) fark += Math.PI * 2;
      this.kamYon += fark * (1 - Math.exp(-dt * (this.azHareket ? 7 : 4.5)));
      this.kamY += (a.y - this.kamY) * (1 - Math.exp(-dt * 6));
      const geri = 6.4 + hizOran * 1.2, yuk = 2.4 + hizOran * 0.3;
      this.kamHedef.set(a.x - Math.sin(this.kamYon) * geri, this.kamY + yuk, a.z - Math.cos(this.kamYon) * geri);
      const zeminY = this.dunya.araziY(this.kamHedef.x, this.kamHedef.z) + 1.2;
      if (this.kamHedef.y < zeminY) this.kamHedef.y = zeminY;
      if (this.kamIlk) { kam.position.copy(this.kamHedef); this.kamIlk = false; }
      // Menüden geçişte yumuşak, sürüşte sıkı takip
      this.gecis = Math.min(1, (this.gecis || 0) + dt * 0.8);
      kam.position.lerp(this.kamHedef, 1 - Math.exp(-dt * (3 + this.gecis * this.gecis * 60)));
      this.kamBakis.set(a.x + Math.sin(a.yon) * 4, a.y + 1.15, a.z + Math.cos(a.yon) * 4);
      kam.lookAt(this.kamBakis);
      const fov = this.azHareket ? this.temelFov : this.temelFov + hizOran * hizOran * 12;
      if (Math.abs(kam.fov - fov) > 0.05) { kam.fov += (fov - kam.fov) * Math.min(1, dt * 3); kam.updateProjectionMatrix(); }
    }
  }

  _balonGuncelle(a, dt) {
    const fx = Math.sin(a.yon), fz = Math.cos(a.yon);
    for (const b of this.balonListe) {
      const u = b.userData;
      const dx = b.position.x - a.x, dz = b.position.z - a.z;
      if (!u.kurulu || dx * dx + dz * dz > 560 * 560) {
        // İleriye, ufka yakın bir yere yeniden yerleştir
        const r = Math.random;
        const aci = Math.atan2(fx, fz) + (r() - 0.5) * (u.kurulu ? 1.6 : 4.4);
        const uz = (u.kurulu ? 360 : 140) + r() * 220;
        const x = a.x + Math.sin(aci) * uz, z = a.z + Math.cos(aci) * uz;
        b.position.set(x, M.hamYukseklik(x, z, this.dunya.tohum) + 45 + r() * 90, z);
        u.gorunum = u.kurulu ? 0 : 1;
        u.kurulu = true;
      }
      u.faz += dt;
      if (!this.azHareket) {
        b.position.x += dt * 0.9 * u.hiz;
        b.position.y += Math.sin(u.faz * 0.4) * dt * 0.5;
      }
      const titre = this.azHareket ? 1 : 0.85 + Math.sin(u.faz * 13) * 0.08 + Math.sin(u.faz * 7.3) * 0.07;
      const s = (0.35 + this.gece * 0.35) * titre;
      u.ates.scale.set(s, s, 1);
      if (u.gorunum < 1) {
        u.gorunum = Math.min(1, u.gorunum + dt / 4);
        for (const m of u.malz) m.opacity = u.gorunum;
      }
    }
  }

  ciz() { this.renderer.render(this.sahne, this.kamera); }

  bilgi() {
    const i = this.renderer.info;
    return { parca: this.parcalar.size, yolBlok: this.yolBloklari.size, geometri: i.memory.geometries, doku: i.memory.textures, cagri: i.render.calls, ucgen: i.render.triangles };
  }
}

export const RENKLER = R;
