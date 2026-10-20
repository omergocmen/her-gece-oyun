(function () {
  var form = document.getElementById('tahmin-formu');
  var girdi = document.getElementById('tahmin');
  var mesaj = document.getElementById('mesaj');
  var rekor = document.getElementById('rekor');
  var yeniden = document.getElementById('yeniden');
  var denemeSayisi = document.getElementById('deneme-sayisi');
  var altSinir = document.getElementById('alt-sinir');
  var ustSinir = document.getElementById('ust-sinir');
  var dolgu = document.getElementById('aralik-dolgu');
  var gizli, deneme, alt, ust;

  // Kalan olası aralığı çubukta gösterir; her tahmin çubuğu daraltır.
  function araligiCiz() {
    altSinir.textContent = alt;
    ustSinir.textContent = ust;
    dolgu.style.left = (alt - 1) + '%';
    dolgu.style.width = (ust - alt + 1) + '%';
    denemeSayisi.textContent = deneme + ' deneme';
  }

  function rekoruGoster() {
    var enIyi = Depo.oku('sayi-tahmin:rekor', null);
    rekor.textContent = enIyi ? 'En iyi skorun: ' + enIyi + ' deneme' : '';
  }

  function basla() {
    gizli = Math.floor(Math.random() * 100) + 1;
    deneme = 0;
    alt = 1;
    ust = 100;
    araligiCiz();
    mesaj.textContent = 'Aklımdan 1 ile 100 arasında bir sayı tuttum.';
    form.hidden = false;
    yeniden.hidden = true;
    girdi.value = '';
    girdi.focus();
    rekoruGoster();
  }

  form.addEventListener('submit', function (olay) {
    olay.preventDefault();
    var sayi = parseInt(girdi.value, 10);
    if (!(sayi >= 1 && sayi <= 100)) {
      mesaj.textContent = 'Lütfen 1 ile 100 arasında bir sayı yaz.';
      return;
    }
    deneme++;
    if (sayi < gizli) alt = Math.max(alt, sayi + 1);
    else if (sayi > gizli) ust = Math.min(ust, sayi - 1);
    else alt = ust = sayi;
    araligiCiz();
    if (sayi === gizli) {
      mesaj.textContent = 'Tebrikler! ' + deneme + ' denemede buldun.';
      var enIyi = Depo.oku('sayi-tahmin:rekor', null);
      if (!enIyi || deneme < enIyi) Depo.yaz('sayi-tahmin:rekor', deneme);
      form.hidden = true;
      yeniden.hidden = false;
      rekoruGoster();
    } else {
      mesaj.textContent = sayi < gizli ? sayi + ' çok küçük, daha büyük bir sayı dene.' : sayi + ' çok büyük, daha küçük bir sayı dene.';
      girdi.select();
    }
  });

  yeniden.addEventListener('click', basla);
  basla();
})();
