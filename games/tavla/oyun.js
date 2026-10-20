// Tavla arayüzü: SVG tahta, dokunma/sürükleme, zar, yapay zekâ (Web Worker), maç ve kayıt.
(function () {
  var M = TavlaMantik;
  var NS = 'http://www.w3.org/2000/svg';
  var KAYIT = 'tavla:mac';
  var SURUM = 1;

  // Tahta geometrisi (viewBox 800×500): çerçeve, iki yarım, bar ve sağda toplama şeridi.
  var G = {
    en: 800, boy: 500, cerceve: 10, hane: 57, bar: 44, sol: 10, barX: 352, sagX: 396, sagSon: 738,
    tepsiX: 744, tepsiEn: 48, ust: 10, alt: 490, ucBoy: 200, r: 24, aralik: 44, gorunen: 5
  };
  var KAYMA_MS = 250;

  var svg = document.getElementById('tahta');
  var zarKutusu = document.getElementById('zarlar');
  var zarAdiEl = document.getElementById('zar-adi');
  var durumEl = document.getElementById('durum');
  var anaDugme = document.getElementById('ana-dugme');
  var geriAlDugme = document.getElementById('geri-al');
  var devamBilgi = document.getElementById('devam-bilgi');
  var sesDugme = document.getElementById('ses');
  var ayarDialog = document.getElementById('ayarlar');
  var sonucDialog = document.getElementById('sonuc');
  var istDialog = document.getElementById('istatistik');

  var durum = null;        // kaydedilen maç durumu
  var yasal = null;        // turun başında hesaplanan geçerli tam hamleler (oyuncu için)
  var secili = null;       // seçili kaynak hane (oyuncunun gözünden), 25 = bar
  var hedefler = [];       // seçili kaynaktan gidilebilecek hedefler ({ hedef, adimlar })
  var mesgul = false;      // animasyon ya da bilgisayar hamlesi sürüyor
  var nesil = 0;           // yeni oyun/maç başlayınca eski zamanlayıcı ve işçi yanıtları yok sayılır
  var parlayan = null;     // kırılıp bara giden taş: { p, bitis }
  var surukle = null;
  var sesAcik = Depo.oku('tavla:ses', true);
  var secimTaslak = { seviye: 'orta', mac: 5 };

  function hareketAz() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function el(ad, ozellikler, ebeveyn) {
    var e = document.createElementNS(NS, ad);
    for (var k in ozellikler) e.setAttribute(k, ozellikler[k]);
    if (ebeveyn) ebeveyn.appendChild(e);
    return e;
  }

  // ---------- Geometri ----------

  // Oyuncunun (0) gözünden hane numarasının sütunu (0..11, soldan sağa) ve satırı.
  function haneYeri(h) {
    if (h <= 12) return { sutun: 12 - h, ust: false };
    return { sutun: h - 13, ust: true };
  }
  function sutunX(sutun) {
    return sutun < 6 ? G.sol + sutun * G.hane + G.hane / 2 : G.sagX + (sutun - 6) * G.hane + G.hane / 2;
  }
  // p oyuncusunun kendi hanesini ekranda oyuncu 0'ın hanesine çevirir.
  function ekranHanesi(p, h) { return p === 0 ? h : 25 - h; }

  // p oyuncusunun h hanesindeki k. taşın (0 tabanlı) merkezi.
  function tasYeri(p, h, k) {
    var kat = Math.min(k, G.gorunen - 1);
    if (h === M.BAR) {
      var x = G.barX + G.bar / 2;
      return p === 0 ? { x: x, y: G.boy / 2 - 38 - kat * 34 } : { x: x, y: G.boy / 2 + 38 + kat * 34 };
    }
    if (h === 0) {
      var tx = G.tepsiX + G.tepsiEn / 2;
      return p === 0 ? { x: tx, y: G.alt - 6 - k * 10 } : { x: tx, y: G.ust + 6 + k * 10 };
    }
    var yer = haneYeri(ekranHanesi(p, h));
    var hx = sutunX(yer.sutun);
    return yer.ust ? { x: hx, y: G.ust + G.r + kat * G.aralik } : { x: hx, y: G.alt - G.r - kat * G.aralik };
  }

  // ---------- Çizim ----------

  function tahtaZemini() {
    var defs = el('defs', {}, svg);
    var g = el('radialGradient', { id: 'isik-havuzu', cx: '50%', cy: '48%', r: '60%' }, defs);
    el('stop', { offset: '0', 'stop-color': 'var(--sodyum)', 'stop-opacity': '.16' }, g);
    el('stop', { offset: '.55', 'stop-color': 'var(--sodyum)', 'stop-opacity': '.05' }, g);
    el('stop', { offset: '1', 'stop-color': 'var(--sodyum)', 'stop-opacity': '0' }, g);
    el('rect', { x: 0, y: 0, width: G.en, height: G.boy, rx: 14, class: 'ceviz' }, svg);
    el('rect', { x: G.sol, y: G.ust, width: G.barX - G.sol, height: G.alt - G.ust, rx: 4, class: 'yuzey' }, svg);
    el('rect', { x: G.sagX, y: G.ust, width: G.sagSon - G.sagX, height: G.alt - G.ust, rx: 4, class: 'yuzey' }, svg);
    el('rect', { x: G.tepsiX, y: G.ust, width: G.tepsiEn, height: G.alt - G.ust, rx: 6, class: 'tepsi' }, svg);
    el('line', { x1: G.tepsiX + 6, x2: G.tepsiX + G.tepsiEn - 6, y1: G.boy / 2, y2: G.boy / 2, class: 'tepsi-cizgi' }, svg);
    for (var s = 0; s < 12; s++) {
      var x0 = s < 6 ? G.sol + s * G.hane : G.sagX + (s - 6) * G.hane;
      var cx = x0 + G.hane / 2;
      el('polygon', { points: [x0 + 2, G.ust, x0 + G.hane - 2, G.ust, cx, G.ust + G.ucBoy].join(' '), class: s % 2 ? 'hane-b' : 'hane-a' }, svg);
      el('polygon', { points: [x0 + 2, G.alt, x0 + G.hane - 2, G.alt, cx, G.alt - G.ucBoy].join(' '), class: s % 2 ? 'hane-a' : 'hane-b' }, svg);
    }
    el('rect', { x: G.sol, y: G.ust, width: G.sagSon - G.sol, height: G.alt - G.ust, fill: 'url(#isik-havuzu)', class: 'isik', 'pointer-events': 'none' }, svg);
    // Hane numaraları oyuncunun gözünden (1 sağ alt).
    for (var h = 1; h <= 24; h++) {
      var yer = haneYeri(h);
      el('text', { x: sutunX(yer.sutun), y: yer.ust ? G.boy / 2 - 5 : G.boy / 2 + 14, class: 'hane-no' }, svg).textContent = h;
    }
  }

  function tasCiz(ebeveyn, p, x, y, ek) {
    var g = el('g', { class: 'tas ' + (p === 0 ? 'tas-ben' : 'tas-pc') + (ek ? ' ' + ek : ''), transform: 'translate(' + x + ' ' + y + ')' }, ebeveyn);
    el('circle', { r: G.r - 1, class: 'tas-govde' }, g);
    el('circle', { r: G.r * 0.6, class: 'tas-halka' }, g);
    return g;
  }

  function tepsiTasi(ebeveyn, p, x, y) {
    return el('rect', { x: x - 18, y: y - 4, width: 36, height: 8, rx: 2, class: 'tepsi-tas ' + (p === 0 ? 'tas-ben' : 'tas-pc') }, ebeveyn);
  }

  // Tahtayı durum.t'ye göre yeniden çizer. gizle: { 'p:h': adet } o hanelerin üstteki taşlarını saklar.
  function ciz(gizle) {
    gizle = gizle || {};
    var t = durum.t;
    var katman = svg.querySelector('#taslar');
    if (katman) katman.remove();
    katman = el('g', { id: 'taslar' }, svg);
    var kaynaklar = kaynakHaneleri();
    for (var p = 0; p < 2; p++) {
      for (var h = 0; h <= M.BAR; h++) {
        var adet = t[p][h] - (gizle[p + ':' + h] || 0);
        for (var k = 0; k < adet; k++) {
          var yer = tasYeri(p, h, k);
          if (h === 0) { tepsiTasi(katman, p, yer.x, yer.y); continue; }
          if (k >= G.gorunen && k < adet - 1) continue;
          var ek = '';
          var ust = k === adet - 1;
          if (p === 0 && ust && kaynaklar.indexOf(h) !== -1) ek += ' oynar';
          if (p === 0 && ust && secili === h) ek += ' secili';
          if (h === M.BAR && parlayan && parlayan.p === p && ust && Date.now() < parlayan.bitis) ek += ' kirik';
          var tas = tasCiz(katman, p, yer.x, yer.y, ek.trim());
          if (ust && adet > G.gorunen) el('text', { class: 'yigin', y: 1 }, tas).textContent = adet;
        }
      }
    }
    // Geçerli hedefler: sodyum nokta, taşın konacağı yerde.
    hedefler.forEach(function (hd) {
      var yer;
      if (hd.hedef === 0) yer = { x: G.tepsiX + G.tepsiEn / 2, y: G.alt - 6 - t[0][0] * 10 - 14 };
      else {
        var rakipVar = t[1][25 - hd.hedef] === 1;
        yer = tasYeri(0, hd.hedef, rakipVar ? 0 : t[0][hd.hedef]);
      }
      var nokta = el('g', { class: 'hedef', transform: 'translate(' + yer.x + ' ' + yer.y + ')' }, katman);
      el('circle', { r: 15, class: 'hedef-hale' }, nokta);
      el('circle', { r: 7, class: 'hedef-nokta' }, nokta);
    });
    el('g', { id: 'ucan' }, katman);
    pipGuncelle();
  }

  function pipGuncelle() {
    document.getElementById('pip-sen').textContent = M.pip(durum.t[0]);
    document.getElementById('pip-pc').textContent = M.pip(durum.t[1]);
  }

  // ---------- Zarlar ----------

  var NOKTALAR = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

  function zarEl(deger, kullanildi) {
    var z = document.createElement('span');
    z.className = 'zar' + (kullanildi ? ' kullanildi' : '');
    for (var i = 1; i <= 9; i++) {
      var n = document.createElement('i');
      if (NOKTALAR[deger].indexOf(i) !== -1) n.className = 'dolu';
      z.appendChild(n);
    }
    return z;
  }

  function zarlariCiz(atiliyor) {
    zarKutusu.innerHTML = '';
    zarKutusu.classList.toggle('pc', durum.sira === 1);
    zarKutusu.classList.toggle('cift', !!(durum.zarlar && durum.zarlar[0] === durum.zarlar[1] && durum.asama !== 'acilis'));
    if (durum.acilisZarlari && durum.asama !== 'oyna') {
      var a = durum.acilisZarlari;
      [0, 1].forEach(function (i) {
        var kutu = document.createElement('span');
        kutu.className = 'acilis-zar';
        kutu.appendChild(zarEl(a[i], false));
        var et = document.createElement('small');
        et.textContent = i === 0 ? 'Sen' : 'Bilgisayar';
        kutu.appendChild(et);
        zarKutusu.appendChild(kutu);
      });
      zarAdiEl.textContent = '';
      return;
    }
    if (!durum.zarlar) {
      zarKutusu.appendChild(zarEl(6, true));
      zarKutusu.appendChild(zarEl(5, true));
      zarKutusu.classList.add('bos');
      zarAdiEl.textContent = '';
      return;
    }
    zarKutusu.classList.remove('bos');
    var liste = M.zarListesi(durum.zarlar);
    var kalan = M.kalanZarlar(durum.zarlar, durum.yapilan).slice();
    var kullanilan = liste.map(function (z) {
      var i = kalan.indexOf(z);
      if (i !== -1) { kalan.splice(i, 1); return false; }
      return true;
    });
    // Kullanılmış zarlar sona dizilir; oynanacak zarlar önde.
    var sira = liste.map(function (z, i) { return { z: z, k: kullanilan[i] }; });
    sira.sort(function (x, y) { return x.k - y.k; });
    sira.forEach(function (o) {
      var z = zarEl(o.z, o.k);
      if (atiliyor) z.classList.add('donuyor');
      zarKutusu.appendChild(z);
    });
    zarAdiEl.textContent = M.zarAdi(durum.zarlar);
  }

  // Zar atma animasyonu: yüzler kısa süre karışır, sonra gelen zar görünür.
  function zarAnimasyonu(bitti) {
    sesCal('zar');
    if (hareketAz()) { zarlariCiz(false); bitti(); return; }
    var benim = nesil;
    var adim = 0;
    var gercek = durum.zarlar;
    var acilis = durum.acilisZarlari;
    var zaman = setInterval(function () {
      if (benim !== nesil) { clearInterval(zaman); return; }
      adim++;
      if (adim >= 6) {
        clearInterval(zaman);
        durum.zarlar = gercek;
        durum.acilisZarlari = acilis;
        zarlariCiz(true);
        bitti();
        return;
      }
      var sahte = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
      if (acilis) durum.acilisZarlari = sahte; else durum.zarlar = sahte;
      var yedekYapilan = durum.yapilan;
      durum.yapilan = [];
      zarlariCiz(true);
      durum.yapilan = yedekYapilan;
      zarAdiEl.textContent = '';
    }, 70);
  }

  // ---------- Ses (Web Audio ile üretilir, dosya yok) ----------

  // Tarayıcılar sesi ancak kullanıcı sayfayla etkileştikten sonra açar; o ana kadar ses çalınmaz.
  var sesBaglam = null;
  var etkilesim = false;
  ['pointerdown', 'keydown'].forEach(function (olay) {
    document.addEventListener(olay, function () { etkilesim = true; }, { capture: true, passive: true });
  });
  function sesCal(tur) {
    if (!sesAcik || !etkilesim) return;
    try {
      if (!sesBaglam) {
        var Baglam = window.AudioContext || window.webkitAudioContext;
        if (!Baglam) return;
        sesBaglam = new Baglam();
      }
      if (sesBaglam.state === 'suspended') sesBaglam.resume();
      var simdi = sesBaglam.currentTime;
      var tik = function (bas, frekans, sure, guc, tip) {
        var osc = sesBaglam.createOscillator();
        var kazanc = sesBaglam.createGain();
        osc.type = tip || 'triangle';
        osc.frequency.setValueAtTime(frekans, simdi + bas);
        osc.frequency.exponentialRampToValueAtTime(frekans * 0.55, simdi + bas + sure);
        kazanc.gain.setValueAtTime(0.0001, simdi + bas);
        kazanc.gain.exponentialRampToValueAtTime(guc, simdi + bas + 0.004);
        kazanc.gain.exponentialRampToValueAtTime(0.0001, simdi + bas + sure);
        osc.connect(kazanc).connect(sesBaglam.destination);
        osc.start(simdi + bas);
        osc.stop(simdi + bas + sure + 0.02);
      };
      if (tur === 'zar') { for (var i = 0; i < 5; i++) tik(i * 0.055 + Math.random() * 0.02, 900 + Math.random() * 500, 0.04, 0.06, 'square'); }
      else if (tur === 'tas') tik(0, 420, 0.07, 0.16);
      else if (tur === 'kir') { tik(0, 220, 0.16, 0.22); tik(0.05, 140, 0.18, 0.14); }
      else if (tur === 'kazan') { tik(0, 523, 0.25, 0.12, 'sine'); tik(0.14, 659, 0.25, 0.12, 'sine'); tik(0.28, 784, 0.4, 0.12, 'sine'); }
      else if (tur === 'kaybet') { tik(0, 330, 0.3, 0.1, 'sine'); tik(0.18, 247, 0.45, 0.1, 'sine'); }
    } catch (e) { /* ses çalınamazsa oyun sessiz sürer */ }
  }

  function sesDugmesiGuncelle() {
    sesDugme.setAttribute('aria-pressed', String(sesAcik));
    sesDugme.setAttribute('aria-label', sesAcik ? 'Sesi kapat' : 'Sesi aç');
    sesDugme.classList.toggle('kapali', !sesAcik);
  }

  // ---------- Maç durumu ve kayıt ----------

  function kaydet() { Depo.yaz(KAYIT, durum); }

  function yeniMac(seviye, hedefPuan) {
    nesil++;
    durum = {
      surum: SURUM, seviye: seviye, hedefPuan: hedefPuan, skor: [0, 0], oyunNo: 1, macBitti: false,
      t: M.baslangic(), sira: 0, asama: 'acilis', zarlar: null, acilisZarlari: null, yapilan: [], turBasi: null, sonuc: null
    };
    Depo.yaz('tavla:tercih', { seviye: seviye, mac: hedefPuan });
    devamBilgi.hidden = true;
    turuHazirla();
  }

  function sonrakiOyun() {
    nesil++;
    var baslayan = durum.sonuc ? durum.sonuc.kazanan : 0;
    durum.oyunNo++;
    durum.t = M.baslangic();
    durum.sira = baslayan;
    durum.asama = 'zar';
    durum.zarlar = null;
    durum.acilisZarlari = null;
    durum.yapilan = [];
    durum.turBasi = null;
    durum.sonuc = null;
    devamBilgi.hidden = true;
    turuHazirla();
  }

  function ustBilgi() {
    document.getElementById('skor-sen').textContent = durum.skor[0];
    document.getElementById('skor-pc').textContent = durum.skor[1];
    document.getElementById('mac-tur').textContent = durum.hedefPuan + (durum.hedefPuan === 3 ? "'lük" : "'lik") + ' maç';
    document.getElementById('mac-seviye').textContent = M.SEVIYE_ADI[durum.seviye];
  }

  function kaynakHaneleri() {
    if (!durum || durum.sira !== 0 || durum.asama !== 'oyna' || mesgul || !yasal) return [];
    var liste = [];
    M.sonrakiAdimlar(durum.turBasi, 0, durum.zarlar, durum.yapilan, yasal).forEach(function (a) {
      if (liste.indexOf(a.den) === -1) liste.push(a.den);
    });
    return liste;
  }

  function turBittiMi() {
    if (!yasal || !yasal.length) return true;
    return durum.yapilan.length >= yasal[0].adimlar.length;
  }

  // Duruma göre düğmeleri, metni ve tahtayı günceller; sıra bilgisayardaysa onu oynatır.
  function turuHazirla() {
    secili = null;
    hedefler = [];
    ustBilgi();
    if (durum.asama === 'oyna' && durum.sira === 0) {
      yasal = M.oyunlar(durum.turBasi, 0, durum.zarlar);
      // Tahtada tek bir kaynak varsa (ör. kırık taş) kendiliğinden seçilir.
      otomatikSec();
    } else yasal = null;
    ciz();
    zarlariCiz(false);
    arayuzGuncelle();
    kaydet();
    if (durum.sira === 1 && (durum.asama === 'zar' || durum.asama === 'oyna')) bilgisayarSirasi();
  }

  function otomatikSec() {
    var kaynaklar = kaynakHaneleri();
    if (kaynaklar.length === 1 && kaynaklar[0] === M.BAR) sec(M.BAR, true);
  }

  function arayuzGuncelle() {
    var a = durum.asama;
    geriAlDugme.disabled = !(durum.sira === 0 && a === 'oyna' && durum.yapilan.length > 0 && !mesgul);
    geriAlDugme.hidden = a === 'bitti';
    anaDugme.hidden = false;
    if (a === 'acilis') {
      anaDugme.textContent = 'Zar at';
      anaDugme.disabled = mesgul;
      if (!durum.acilisZarlari) durumEl.textContent = 'Başlangıç zarı: büyük atan başlar.';
    } else if (a === 'zar') {
      anaDugme.textContent = 'Zar at';
      anaDugme.disabled = durum.sira !== 0 || mesgul;
      if (durum.sira === 0 && !mesgul) durumEl.textContent = durum.acilisZarlari ? 'Sen başlıyorsun. Zarları at.' : 'Sıra sende. Zarları at.';
    } else if (a === 'oyna') {
      if (durum.sira === 1) {
        anaDugme.textContent = 'Zar at';
        anaDugme.disabled = true;
      } else {
        var bitti = turBittiMi();
        anaDugme.textContent = 'Sırayı ver';
        anaDugme.disabled = !bitti || mesgul;
        if (!mesgul) {
          if (!yasal.length) durumEl.textContent = 'Oynanacak hamlen yok. Sırayı ver.';
          else if (bitti) durumEl.textContent = 'Hamlen tamam. Sırayı ver ya da geri al.';
          else if (durum.t[0][M.BAR] > 0) durumEl.textContent = 'Önce kırık taşını içeri sok.';
          else durumEl.textContent = secili == null ? 'Oynatacağın taşa dokun.' : 'Gideceği haneye dokun.';
        }
      }
    } else if (a === 'bitti') {
      anaDugme.textContent = durum.macBitti ? 'Yeni maç' : 'Sonraki oyun';
      anaDugme.disabled = false;
    }
  }

  // ---------- Oyuncu hamlesi ----------

  function sec(h, sessiz) {
    secili = h;
    hedefler = h == null ? [] : M.hedefSecenekleri(durum.turBasi, 0, durum.zarlar, durum.yapilan, h, yasal);
    if (!sessiz) { ciz(); arayuzGuncelle(); }
  }

  // Dokunulan noktaya göre en yakın geçerli seçenek; dar ekranda komşu haneye kayan parmak için tolerans.
  function enYakin(nokta, adaylar, yerFn, sinir) {
    var enIyi = null, enAz = Infinity;
    adaylar.forEach(function (a) {
      var y = yerFn(a);
      if (!y) return;
      if ((nokta.y < G.boy / 2) !== y.ust && !y.her) return;
      var d = Math.abs(nokta.x - y.x);
      if (d < enAz && d <= sinir) { enAz = d; enIyi = a; }
    });
    return enIyi;
  }

  function kaynakYeri(h) {
    if (h === M.BAR) return { x: G.barX + G.bar / 2, her: true };
    var yer = haneYeri(h);
    return { x: sutunX(yer.sutun), ust: yer.ust };
  }
  function hedefYeri(hd) {
    if (hd.hedef === 0) return { x: G.tepsiX + G.tepsiEn / 2, her: true };
    var yer = haneYeri(hd.hedef);
    return { x: sutunX(yer.sutun), ust: yer.ust };
  }

  function svgNoktasi(olay) {
    var m = svg.getScreenCTM();
    if (!m) return null;
    var p = svg.createSVGPoint();
    p.x = olay.clientX; p.y = olay.clientY;
    return p.matrixTransform(m.inverse());
  }

  function dokunHedef(nokta) {
    if (!hedefler.length) return null;
    return enYakin(nokta, hedefler, hedefYeri, G.hane * 0.95);
  }
  function dokunKaynak(nokta) {
    return enYakin(nokta, kaynakHaneleri(), kaynakYeri, G.hane * 0.75);
  }

  function hedefeGit(hd) {
    var adimlar = hd.adimlar;
    secili = null;
    hedefler = [];
    adimlariOyna(0, adimlar, function () {
      if (oyunBittiMi()) return;
      otomatikSec();
      ciz();
      arayuzGuncelle();
      kaydet();
    });
  }

  // Dokunulan nokta bir hedef mi, bir kaynak mı? Seçili taşın kendi sütununa dokunmak seçimi bırakır.
  function karar(nokta) {
    var kaynak = dokunKaynak(nokta);
    var kaynakTam = kaynak != null && Math.abs(kaynakYeri(kaynak).x - nokta.x) < G.hane / 2;
    var hd = secili != null ? dokunHedef(nokta) : null;
    if (hd && !(kaynakTam && kaynak === secili)) return { hedef: hd };
    if (kaynak != null) return { kaynak: kaynak };
    return null;
  }

  function oynanabilir() {
    return !mesgul && durum && durum.asama === 'oyna' && durum.sira === 0;
  }

  svg.addEventListener('pointerdown', function (olay) {
    if (!oynanabilir()) return;
    var nokta = svgNoktasi(olay);
    if (!nokta) return;
    var k = karar(nokta);
    surukle = { basla: nokta, karar: k, yeniSecim: false, tasindi: false, id: olay.pointerId, hayalet: null };
    if (k && k.kaynak != null) {
      if (k.kaynak !== secili) { surukle.yeniSecim = true; sesCal('tas'); sec(k.kaynak); }
      try { svg.setPointerCapture(olay.pointerId); } catch (e) { /* yok sayılır */ }
    }
  });

  svg.addEventListener('pointermove', function (olay) {
    if (!surukle || surukle.id !== olay.pointerId || !surukle.karar || surukle.karar.kaynak == null) return;
    var nokta = svgNoktasi(olay);
    if (!nokta) return;
    if (!surukle.tasindi && Math.hypot(nokta.x - surukle.basla.x, nokta.y - surukle.basla.y) > 12) {
      surukle.tasindi = true;
      var gizle = {}; gizle['0:' + surukle.karar.kaynak] = 1;
      ciz(gizle);
      surukle.hayalet = tasCiz(svg.querySelector('#ucan'), 0, nokta.x, nokta.y, 'hayalet');
    }
    if (surukle.hayalet) surukle.hayalet.setAttribute('transform', 'translate(' + nokta.x + ' ' + nokta.y + ') scale(1.08)');
  });

  function surukleBitir(olay, iptal) {
    if (!surukle || surukle.id !== olay.pointerId) return;
    var s = surukle;
    surukle = null;
    if (!oynanabilir()) return;
    if (iptal) { ciz(); return; }
    if (s.tasindi) {
      // Sürükleyip bırakma: bırakılan yere en yakın geçerli hedef; yoksa taş yerine döner.
      var nokta = svgNoktasi(olay) || s.basla;
      var hd = dokunHedef(nokta);
      if (hd) hedefeGit(hd); else { ciz(); arayuzGuncelle(); }
      return;
    }
    var k = s.karar;
    if (!k) sec(null);
    else if (k.hedef) hedefeGit(k.hedef);
    else if (!s.yeniSecim) sec(null);
  }
  svg.addEventListener('pointerup', function (olay) { surukleBitir(olay, false); });
  svg.addEventListener('pointercancel', function (olay) { surukleBitir(olay, true); });

  // ---------- Hamle animasyonu ----------

  // Adımları sırayla, her biri 250 ms kayarak oynatır; kırılan taş bara kayar ve kor parlaması alır.
  function adimlariOyna(p, adimlar, bitti) {
    mesgul = true;
    arayuzGuncelle();
    var benim = nesil;
    var i = 0;
    function sonraki() {
      if (benim !== nesil) return;
      if (i >= adimlar.length) { mesgul = false; bitti(); return; }
      var a = adimlar[i++];
      var once = durum.t;
      var s = M.adim(once, p, a.den, a.zar);
      var kaynakYer = tasYeri(p, a.den, once[p][a.den] - 1);
      var hedefYerT = s.hedef === 0 ? tasYeri(p, 0, once[p][0]) : tasYeri(p, s.hedef, s.vurus ? 0 : once[p][s.hedef]);
      var q = 1 - p;
      var kirikYer = null, barYer = null;
      if (s.vurus) {
        var karsi = 25 - s.hedef;
        kirikYer = tasYeri(q, karsi, 0);
        barYer = tasYeri(q, M.BAR, once[q][M.BAR]);
      }
      durum.t = s.t;
      durum.yapilan = durum.yapilan.concat([a]);
      if (s.vurus) parlayan = { p: q, bitis: Date.now() + 900 };
      if (hareketAz()) {
        sesCal(s.vurus ? 'kir' : 'tas');
        ciz();
        zarlariCiz(false);
        setTimeout(sonraki, p === 1 ? 160 : 0);
        return;
      }
      var gizle = {};
      gizle[p + ':' + s.hedef] = 1;
      if (s.vurus) gizle[q + ':' + M.BAR] = 1;
      ciz(gizle);
      zarlariCiz(false);
      var ucan = svg.querySelector('#ucan');
      var uc = s.hedef === 0 ? null : tasCiz(ucan, p, kaynakYer.x, kaynakYer.y, 'kalkik');
      var tepsi = s.hedef === 0 ? tepsiTasi(ucan, p, kaynakYer.x, kaynakYer.y) : null;
      var kirik = s.vurus ? tasCiz(ucan, q, kirikYer.x, kirikYer.y, 'kirik') : null;
      var bas = performance.now();
      var sesCalindi = false;
      function kare(simdi) {
        if (benim !== nesil) return;
        var u = Math.min(1, (simdi - bas) / KAYMA_MS);
        var e = 1 - Math.pow(1 - u, 3);
        var x = kaynakYer.x + (hedefYerT.x - kaynakYer.x) * e;
        var y = kaynakYer.y + (hedefYerT.y - kaynakYer.y) * e - Math.sin(u * Math.PI) * 18;
        if (uc) uc.setAttribute('transform', 'translate(' + x + ' ' + y + ') scale(' + (1.08 - 0.08 * e) + ')');
        if (tepsi) { tepsi.setAttribute('x', x - 18); tepsi.setAttribute('y', y - 4); }
        if (kirik && u > 0.5) {
          var v = (u - 0.5) * 2;
          var ev = 1 - Math.pow(1 - v, 3);
          kirik.setAttribute('transform', 'translate(' + (kirikYer.x + (barYer.x - kirikYer.x) * ev) + ' ' + (kirikYer.y + (barYer.y - kirikYer.y) * ev) + ')');
          if (!sesCalindi) { sesCalindi = true; sesCal('kir'); }
        }
        if (u < 1) requestAnimationFrame(kare);
        else {
          if (!s.vurus) sesCal('tas');
          if (kirik) {
            // Kırılan taşın bara varması da 250 ms sürer.
            var b2 = performance.now();
            var kare2 = function (n) {
              if (benim !== nesil) return;
              var v2 = Math.min(1, (n - b2) / (KAYMA_MS / 2));
              var ev2 = 1 - Math.pow(1 - (0.5 + v2 / 2), 3);
              kirik.setAttribute('transform', 'translate(' + (kirikYer.x + (barYer.x - kirikYer.x) * ev2) + ' ' + (kirikYer.y + (barYer.y - kirikYer.y) * ev2) + ')');
              if (v2 < 1) requestAnimationFrame(kare2);
              else { ciz(); setTimeout(sonraki, p === 1 ? 140 : 0); }
            };
            requestAnimationFrame(kare2);
            return;
          }
          ciz();
          setTimeout(sonraki, p === 1 ? 140 : 0);
        }
      }
      requestAnimationFrame(kare);
    }
    sonraki();
  }

  function geriAl() {
    if (mesgul || durum.sira !== 0 || durum.asama !== 'oyna' || !durum.yapilan.length) return;
    durum.yapilan = durum.yapilan.slice(0, -1);
    durum.t = M.adimlariUygula(durum.turBasi, 0, durum.yapilan);
    secili = null;
    hedefler = [];
    sesCal('tas');
    otomatikSec();
    ciz();
    zarlariCiz(false);
    arayuzGuncelle();
    kaydet();
  }

  // ---------- Tur akışı ----------

  function zarAt() {
    if (mesgul) return;
    if (durum.asama === 'acilis') {
      var acilis = M.acilisZari(Math.random);
      durum.acilisZarlari = acilis.zarlar;
      mesgul = true;
      arayuzGuncelle();
      zarAnimasyonu(function () {
        mesgul = false;
        durum.sira = acilis.baslayan;
        durum.asama = 'zar';
        durumEl.textContent = acilis.baslayan === 0
          ? 'Sen ' + acilis.zarlar[0] + ', bilgisayar ' + acilis.zarlar[1] + ' attı. Sen başlıyorsun.'
          : 'Sen ' + acilis.zarlar[0] + ', bilgisayar ' + acilis.zarlar[1] + ' attı. Bilgisayar başlıyor.';
        kaydet();
        if (acilis.baslayan === 1) {
          var benim = nesil;
          setTimeout(function () { if (benim === nesil) turuHazirla(); }, 1300);
          arayuzGuncelle();
        } else {
          zarlariCiz(false);
          arayuzGuncelle();
          durumEl.textContent = 'Sen ' + acilis.zarlar[0] + ', bilgisayar ' + acilis.zarlar[1] + ' attı. Sen başlıyorsun: zarları at.';
        }
      });
      return;
    }
    if (durum.asama !== 'zar') return;
    durum.acilisZarlari = null;
    durum.zarlar = M.zarAt(Math.random);
    durum.asama = 'oyna';
    durum.yapilan = [];
    durum.turBasi = M.kopya(durum.t);
    kaydet();
    mesgul = true;
    arayuzGuncelle();
    zarAnimasyonu(function () {
      mesgul = false;
      if (durum.sira === 0) {
        turuHazirla();
        if (!yasal.length) durumEl.textContent = M.zarAdi(durum.zarlar) + ': oynanacak hamlen yok. Sırayı ver.';
      }
    });
  }

  function sirayiVer() {
    durum.sira = 1 - durum.sira;
    durum.asama = 'zar';
    durum.zarlar = null;
    durum.yapilan = [];
    durum.turBasi = null;
    durum.acilisZarlari = null;
    turuHazirla();
  }

  function oyunBittiMi() {
    var sonuc = M.oyunSonucu(durum.t);
    if (!sonuc) return false;
    durum.sonuc = sonuc;
    durum.asama = 'bitti';
    durum.skor[sonuc.kazanan] += sonuc.puan;
    durum.macBitti = durum.skor[sonuc.kazanan] >= durum.hedefPuan;
    var ist = M.istatistikIsle(Depo.oku('tavla:istatistik', null), sonuc, durum.macBitti, durum.macBitti && sonuc.kazanan === 0);
    Depo.yaz('tavla:istatistik', ist);
    Depo.ozetYaz('tavla', ist.mac ? ist.macKazanilan + '/' + ist.mac + ' maç' : ist.oyunKazanilan + '/' + ist.oyun + ' oyun');
    secili = null;
    hedefler = [];
    yasal = null;
    kaydet();
    ciz();
    ustBilgi();
    arayuzGuncelle();
    durumEl.textContent = sonuc.kazanan === 0 ? 'Bütün taşlarını topladın!' : 'Bilgisayar bütün taşlarını topladı.';
    sesCal(sonuc.kazanan === 0 ? 'kazan' : 'kaybet');
    if (sonuc.kazanan === 0 && !hareketAz()) {
      svg.classList.remove('kutlama');
      void svg.getBoundingClientRect();
      svg.classList.add('kutlama');
    }
    var benim = nesil;
    setTimeout(function () { if (benim === nesil) sonucGoster(); }, hareketAz() ? 0 : 900);
    return true;
  }

  function sonucGoster() {
    var s = durum.sonuc;
    if (!s) return;
    var ben = s.kazanan === 0;
    document.getElementById('sonuc-ust').textContent = durum.macBitti ? 'Maç bitti' : durum.oyunNo + '. oyun bitti';
    document.getElementById('sonuc-baslik').textContent = durum.macBitti ? (ben ? 'Maçı kazandın' : 'Maçı kaybettin') : (ben ? 'Kazandın' : 'Kaybettin');
    document.getElementById('sonuc-baslik').className = ben ? 'kazandi' : 'kaybetti';
    document.getElementById('mars-damga').hidden = !s.mars;
    document.getElementById('sonuc-metin').textContent = (ben ? 'Sen ' : 'Bilgisayar ') + s.puan + ' puan aldı' +
      (s.mars ? (ben ? ': bilgisayar hiç taş toplayamadı.' : ': hiç taş toplayamadın.') : '.');
    if (ben) document.getElementById('sonuc-metin').textContent = s.puan + ' puan aldın' + (s.mars ? ': bilgisayar hiç taş toplayamadı.' : '.');
    document.getElementById('sonuc-sen').textContent = durum.skor[0];
    document.getElementById('sonuc-pc').textContent = durum.skor[1];
    var istKutusu = document.getElementById('sonuc-ist');
    istKutusu.hidden = !durum.macBitti;
    var ist = Depo.oku('tavla:istatistik', null) || M.yeniIstatistik();
    document.getElementById('s-mac').textContent = ist.mac;
    document.getElementById('s-kazanilan').textContent = ist.macKazanilan;
    document.getElementById('s-mars').textContent = ist.marsYapilan;
    document.getElementById('sonraki-oyun').hidden = durum.macBitti;
    var yeniMacDugme = document.getElementById('sonuc-yeni-mac');
    yeniMacDugme.className = durum.macBitti ? 'buton' : 'buton ikincil';
    if (!sonucDialog.open && typeof sonucDialog.showModal === 'function') sonucDialog.showModal();
  }

  // ---------- Bilgisayar ----------

  var isci = null;
  var isciNo = 0;
  var bekleyen = {};
  try {
    isci = new Worker('isci.js');
    isci.onmessage = function (olay) {
      var cb = bekleyen[olay.data.no];
      delete bekleyen[olay.data.no];
      if (cb) cb(olay.data.adimlar);
    };
    isci.onerror = function () { isci = null; };
  } catch (e) { isci = null; }

  function hamleIste(t, zarlar, seviye, cb) {
    if (isci) {
      var no = ++isciNo;
      bekleyen[no] = cb;
      isci.postMessage({ no: no, t: t, p: 1, zarlar: zarlar, seviye: seviye });
      // İşçi yanıt vermezse (ör. dosya açılamadı) aynı hesap ana iş parçacığında yapılır.
      setTimeout(function () {
        if (!bekleyen[no]) return;
        delete bekleyen[no];
        var h = M.yapayZekaHamlesi(t, 1, zarlar, seviye, Math.random);
        cb(h ? h.adimlar : []);
      }, 4000);
    } else {
      setTimeout(function () {
        var h = M.yapayZekaHamlesi(t, 1, zarlar, seviye, Math.random);
        cb(h ? h.adimlar : []);
      }, 30);
    }
  }

  function bilgisayarSirasi() {
    var benim = nesil;
    mesgul = true;
    arayuzGuncelle();
    function dusun() {
      durumEl.textContent = 'Düşünüyor…';
      zarKutusu.classList.add('dusunuyor');
      var bas = Date.now();
      hamleIste(durum.turBasi, durum.zarlar, durum.seviye, function (adimlar) {
        if (benim !== nesil) return;
        var bekle = Math.max(0, (hareketAz() ? 200 : 650) - (Date.now() - bas));
        setTimeout(function () {
          if (benim !== nesil) return;
          zarKutusu.classList.remove('dusunuyor');
          if (!adimlar.length) {
            durumEl.textContent = 'Bilgisayarın oynayacak hamlesi yok.';
            setTimeout(function () { if (benim === nesil) { mesgul = false; sirayiVer(); } }, 1200);
            return;
          }
          durum.t = durum.turBasi;
          durum.yapilan = [];
          // Hamle yazımı tahtadaki numaralarla (oyuncunun gözünden): 13/18*, bar/22, 21/çıkış.
          var yazim = adimlar.map(function (a) {
            return (a.den === M.BAR ? 'bar' : 25 - a.den) + '/' + (a.hedef === 0 ? 'çıkış' : 25 - a.hedef) + (a.vurus ? '*' : '');
          }).join(' ');
          durumEl.textContent = 'Bilgisayar oynuyor: ' + yazim;
          adimlariOyna(1, adimlar, function () {
            durum.yapilan = adimlar;
            mesgul = true;
            if (oyunBittiMi()) { mesgul = false; return; }
            var kirdi = adimlar.some(function (a) { return a.vurus; });
            durumEl.textContent = 'Bilgisayar oynadı: ' + yazim + (kirdi ? ' · taşını kırdı!' : '');
            setTimeout(function () {
              if (benim !== nesil) return;
              mesgul = false;
              sirayiVer();
              if (kirdi) durumEl.textContent = 'Taşın kırıldı. Zarları at, önce onu içeri sokmalısın.';
            }, hareketAz() ? 300 : 650);
          });
        }, bekle);
      });
    }
    if (durum.asama === 'zar') {
      setTimeout(function () {
        if (benim !== nesil) return;
        durum.acilisZarlari = null;
        durum.zarlar = M.zarAt(Math.random);
        durum.asama = 'oyna';
        durum.yapilan = [];
        durum.turBasi = M.kopya(durum.t);
        kaydet();
        zarAnimasyonu(function () { if (benim === nesil) dusun(); });
      }, hareketAz() ? 200 : 700);
    } else {
      // Kayıttan dönüldü: aynı zarla, turun başından yeniden hesaplanır.
      durum.t = durum.turBasi;
      ciz();
      zarlariCiz(false);
      dusun();
    }
  }

  // ---------- Pencereler ve düğmeler ----------

  function secimleriGoster() {
    document.querySelectorAll('#seviye-secimi [data-seviye]').forEach(function (d) {
      d.setAttribute('aria-pressed', String(d.dataset.seviye === secimTaslak.seviye));
    });
    document.querySelectorAll('#mac-secimi [data-mac]').forEach(function (d) {
      d.setAttribute('aria-pressed', String(Number(d.dataset.mac) === secimTaslak.mac));
    });
  }

  function ayarlariAc() {
    secimTaslak = { seviye: durum.seviye, mac: durum.hedefPuan };
    secimleriGoster();
    var surmekte = !durum.macBitti && (durum.oyunNo > 1 || durum.asama !== 'acilis');
    document.getElementById('ayar-not').hidden = !surmekte;
    if (typeof ayarDialog.showModal === 'function') ayarDialog.showModal();
  }

  document.querySelectorAll('#seviye-secimi [data-seviye]').forEach(function (d) {
    d.addEventListener('click', function () { secimTaslak.seviye = d.dataset.seviye; secimleriGoster(); });
  });
  document.querySelectorAll('#mac-secimi [data-mac]').forEach(function (d) {
    d.addEventListener('click', function () { secimTaslak.mac = Number(d.dataset.mac); secimleriGoster(); });
  });
  document.getElementById('yeni-mac-baslat').addEventListener('click', function () {
    ayarDialog.close();
    mesgul = false;
    yeniMac(secimTaslak.seviye, secimTaslak.mac);
  });
  document.getElementById('ayar-ac').addEventListener('click', ayarlariAc);
  document.getElementById('sonraki-oyun').addEventListener('click', function () { sonucDialog.close(); sonrakiOyun(); });
  document.getElementById('sonuc-yeni-mac').addEventListener('click', function () {
    sonucDialog.close();
    if (durum.macBitti) yeniMac(durum.seviye, durum.hedefPuan);
    else ayarlariAc();
  });
  document.getElementById('istatistik-ac').addEventListener('click', function () {
    var ist = Depo.oku('tavla:istatistik', null) || M.yeniIstatistik();
    document.getElementById('i-mac').textContent = ist.mac;
    document.getElementById('i-mac-k').textContent = ist.macKazanilan;
    document.getElementById('i-oyun').textContent = ist.oyun;
    document.getElementById('i-oyun-k').textContent = ist.oyunKazanilan;
    document.getElementById('i-mars').textContent = ist.marsYapilan;
    document.getElementById('i-mars-y').textContent = ist.marsYenilen;
    if (typeof istDialog.showModal === 'function') istDialog.showModal();
  });
  sesDugme.addEventListener('click', function () {
    sesAcik = !sesAcik;
    Depo.yaz('tavla:ses', sesAcik);
    sesDugmesiGuncelle();
    if (sesAcik) sesCal('tas');
  });

  anaDugme.addEventListener('click', function () {
    devamBilgi.hidden = true;
    if (durum.asama === 'acilis' || durum.asama === 'zar') zarAt();
    else if (durum.asama === 'oyna' && durum.sira === 0 && turBittiMi() && !mesgul) sirayiVer();
    else if (durum.asama === 'bitti') {
      if (durum.macBitti) yeniMac(durum.seviye, durum.hedefPuan);
      else if (!sonucDialog.open) sonucGoster();
    }
  });
  geriAlDugme.addEventListener('click', geriAl);

  // Fiziksel klavye: Boşluk/Enter ana düğme, Backspace ya da Z geri al.
  document.addEventListener('keydown', function (olay) {
    if (olay.ctrlKey || olay.metaKey || olay.altKey || ayarDialog.open || sonucDialog.open || istDialog.open) return;
    if (olay.target.closest && olay.target.closest('button, a, input')) return;
    if (olay.key === ' ' || olay.key === 'Enter') { olay.preventDefault(); if (!anaDugme.disabled && !anaDugme.hidden) anaDugme.click(); }
    else if (olay.key === 'Backspace' || olay.key === 'z' || olay.key === 'Z') { olay.preventDefault(); geriAl(); }
    else if (olay.key === 'Escape' && secili != null) sec(null);
  });

  // Fare ile basılan düğme odakta kalmasın; Enter tekrar basmasın.
  document.querySelector('.tavla-oyunu').addEventListener('click', function (olay) {
    var dugme = olay.target.closest && olay.target.closest('button');
    if (dugme && olay.detail > 0) dugme.blur();
  });

  // Sekme gizlenip açılınca süren hamle yarım kalmışsa (zamanlayıcılar durmuş olabilir) sorun çıkmaz;
  // her adım kaydedildiği için yenileme de aynı yerden devam eder.

  // ---------- Başlangıç ----------

  function kayitGecerli(k) {
    return k && k.surum === SURUM && Array.isArray(k.t) && k.t.length === 2 && !k.macBitti &&
      M.SEVIYELER.indexOf(k.seviye) !== -1 && M.MAC_UZUNLUKLARI.indexOf(k.hedefPuan) !== -1 &&
      k.t.every(function (d) { return Array.isArray(d) && d.length === 26 && d.reduce(function (a, b) { return a + b; }, 0) === M.TAS; });
  }

  sesDugmesiGuncelle();
  tahtaZemini();
  var kayit = Depo.oku(KAYIT, null);
  var baslamisMi = kayit && (kayit.oyunNo > 1 || kayit.asama !== 'acilis' || kayit.skor[0] + kayit.skor[1] > 0);
  if (kayitGecerli(kayit)) {
    durum = kayit;
    if (durum.asama === 'oyna' && !durum.turBasi) durum.turBasi = M.kopya(durum.t);
    if (durum.asama === 'oyna' && durum.sira === 0) durum.t = M.adimlariUygula(durum.turBasi, 0, durum.yapilan);
    devamBilgi.hidden = !baslamisMi;
    turuHazirla();
    if (durum.asama === 'bitti') sonucGoster();
  } else {
    var tercih = Depo.oku('tavla:tercih', null) || {};
    yeniMac(M.SEVIYELER.indexOf(tercih.seviye) !== -1 ? tercih.seviye : 'orta', tercih.mac === 3 ? 3 : 5);
  }
})();
