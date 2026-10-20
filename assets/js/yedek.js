// İlerleme yedeği: yalnızca hgo: önekli localStorage kayıtlarını tek JSON dosyasına yazar ve geri yükler.
// Saf fonksiyonlar (yedekOlustur, yedekDogrula, dosyaAdi) Node'da test edilir; arayüz altbilgideki düğmelere bağlanır.
(function (kok) {
  var ONEK = 'hgo:';
  var SURUM = 1;
  var KAYNAK = 'her-gece-oyun';
  var BOYUT_SINIRI = 5 * 1024 * 1024;

  function iki(n) { return (n < 10 ? '0' : '') + n; }
  function dosyaAdi(simdi) {
    var d = simdi || new Date();
    return 'her-gece-oyun-yedek-' + d.getFullYear() + '-' + iki(d.getMonth() + 1) + '-' + iki(d.getDate()) + '.json';
  }

  // kayitlar: { anahtar: metin } (localStorage'ın ham değerleri). hgo: dışındakiler yedeğe girmez.
  function yedekOlustur(kayitlar, simdi) {
    var veri = {};
    Object.keys(kayitlar || {}).forEach(function (k) {
      if (k.indexOf(ONEK) === 0 && typeof kayitlar[k] === 'string') veri[k] = kayitlar[k];
    });
    return { kaynak: KAYNAK, surum: SURUM, tarih: (simdi || new Date()).toISOString(), veri: veri };
  }

  // Metni çözer ve doğrular. Dönüş: { tamam: true, veri, sayi } ya da { tamam: false, hata: '<Türkçe mesaj>' }.
  function yedekDogrula(metin) {
    var obj;
    if (typeof metin !== 'string' || !metin.trim()) return { tamam: false, hata: 'Dosya boş görünüyor.' };
    if (metin.length > BOYUT_SINIRI) return { tamam: false, hata: 'Dosya çok büyük, bu bir oyun yedeği olmayabilir.' };
    try { obj = JSON.parse(metin); } catch (e) { return { tamam: false, hata: 'Dosya okunamadı: geçerli bir yedek dosyası değil.' }; }
    if (!obj || typeof obj !== 'object' || obj.kaynak !== KAYNAK) return { tamam: false, hata: 'Bu dosya Her Gece Oyun yedeği değil.' };
    if (obj.surum !== SURUM) return { tamam: false, hata: 'Yedek sürümü desteklenmiyor (sürüm ' + obj.surum + ').' };
    if (!obj.veri || typeof obj.veri !== 'object' || Array.isArray(obj.veri)) return { tamam: false, hata: 'Yedek dosyasının içeriği bozuk.' };
    var veri = {};
    var anahtarlar = Object.keys(obj.veri);
    for (var i = 0; i < anahtarlar.length; i++) {
      var k = anahtarlar[i];
      var v = obj.veri[k];
      if (k.indexOf(ONEK) !== 0 || typeof v !== 'string') continue; // hgo: dışı anahtarlara dokunulmaz
      try { JSON.parse(v); } catch (e) { return { tamam: false, hata: 'Yedek dosyasındaki "' + k + '" kaydı bozuk.' }; }
      veri[k] = v;
    }
    var sayi = Object.keys(veri).length;
    if (!sayi) return { tamam: false, hata: 'Yedekte yüklenecek kayıt yok.' };
    return { tamam: true, veri: veri, sayi: sayi };
  }

  var Yedek = { ONEK: ONEK, SURUM: SURUM, dosyaAdi: dosyaAdi, olustur: yedekOlustur, dogrula: yedekDogrula };
  kok.Yedek = Yedek;
  if (typeof module !== 'undefined' && module.exports) module.exports = Yedek;

  // ---------- Arayüz ----------
  var doc = kok.document;
  if (!doc || !doc.getElementById) return;

  function mesaj(metin, hata) {
    var el = doc.getElementById('yedek-mesaj');
    if (!el) return;
    el.textContent = metin;
    el.classList.toggle('yedek-hata', !!hata);
  }
  function mevcutKayitlar() {
    var depo = kok.localStorage, k = {};
    for (var i = 0; i < depo.length; i++) {
      var ad = depo.key(i);
      if (ad && ad.indexOf(ONEK) === 0) k[ad] = depo.getItem(ad);
    }
    return k;
  }
  function indir() {
    try {
      var yedek = yedekOlustur(mevcutKayitlar());
      var sayi = Object.keys(yedek.veri).length;
      if (!sayi) { mesaj('Yedeklenecek bir ilerleme yok; önce bir oyun oyna.', true); return; }
      var blob = new kok.Blob([JSON.stringify(yedek)], { type: 'application/json' });
      var url = kok.URL.createObjectURL(blob);
      var a = doc.createElement('a');
      a.href = url; a.download = dosyaAdi();
      doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
      setTimeout(function () { kok.URL.revokeObjectURL(url); }, 1000);
      mesaj(sayi + ' kayıt yedeklendi. Dosyayı güvenli bir yerde sakla.', false);
    } catch (e) { mesaj('Yedek alınamadı: tarayıcı depolamasına erişilemiyor.', true); }
  }
  function yukle(dosya) {
    if (!dosya) return;
    var okuyucu = new kok.FileReader();
    okuyucu.onerror = function () { mesaj('Dosya okunamadı.', true); };
    okuyucu.onload = function () {
      var s = yedekDogrula(String(okuyucu.result));
      if (!s.tamam) { mesaj(s.hata, true); return; }
      if (!kok.confirm(s.sayi + ' kayıt yüklenecek. Bu cihazdaki aynı kayıtların üzerine yazılır. Devam edilsin mi?')) { mesaj('Yükleme iptal edildi.', false); return; }
      try {
        Object.keys(s.veri).forEach(function (k) { kok.localStorage.setItem(k, s.veri[k]); });
      } catch (e) { mesaj('Yedek yazılamadı: tarayıcı depolaması dolu ya da kapalı.', true); return; }
      mesaj(s.sayi + ' kayıt yüklendi. Sayfa yenileniyor…', false);
      setTimeout(function () { kok.location.reload(); }, 900);
    };
    okuyucu.readAsText(dosya);
  }

  var indirDugme = doc.getElementById('yedek-indir');
  var yukleDugme = doc.getElementById('yedek-yukle');
  var girdi = doc.getElementById('yedek-dosya');
  if (!indirDugme || !yukleDugme || !girdi) return;
  indirDugme.addEventListener('click', indir);
  yukleDugme.addEventListener('click', function () { girdi.value = ''; girdi.click(); });
  girdi.addEventListener('change', function () { yukle(girdi.files && girdi.files[0]); });
})(this);
