# Yeni oyun ekleme

Site derleme gerektirmez; düz HTML, CSS ve JavaScript'ten oluşur. İlke: her oyun ücretsiz, girişsiz ve internetsiz oynanır. Harici CDN, API ya da hesap kullanılmaz; ilerleme yalnızca `localStorage`'da tutulur (`assets/js/depo.js`).

## Adımlar

Görsel kimlik (renkler, yazı tipi, bileşenler, kapak tarifi) `DESIGN.md` dosyasındadır; yeni oyun sayfası ve kapağı bu rehbere uymalıdır.

1. `games/<slug>/` klasörünü oluşturun. Slug küçük harf ve tire içerir (ör. `mayin-tarlasi`).
2. `games/<slug>/index.html` yazın. `games/sayi-tahmin/index.html` örnek alınabilir. Sayfada şunlar olmalı:
   - `<html lang="tr">` ve `<head>` içinde boş bir `<!-- SEO:BASLA -->` / `<!-- SEO:BITIS -->` bloğu (title, description, canonical, Open Graph ve JSON-LD bu bloğa otomatik yazılır)
   - `<meta name="site-kok" content="../../">` ve `../../assets/js/sw-kayit.js` (çevrimdışı çalışma için)
   - `<h2>Nasıl oynanır?</h2>` başlığı ve altında en az bir paragraf Türkçe açıklama
3. Oyunun tüm dosyalarını (JS, görsel, ses) aynı klasöre koyun; dış bağlantı kullanmayın.
4. `games.json`'a kayıt ekleyin: `slug`, `ad`, `aciklama`, `kategori`, `boyut` (`"2D"` ya da `"3D"`; three.js kullanan oyun `"3D"`), `eklenme` (YYYY-AA-GG), `gorsel` ve oyunun tüm dosyalarını listeleyen `dosyalar` (sayfa için `games/<slug>/`). En yeni tarihli oyun ana sayfada "Bu gecenin oyunu" olur; diğerleri "Tüm oyunlar" ızgarasında kart olarak görünür. Ana sayfadaki kategori süzgeci `kategori` ve `boyut` alanlarından kendiliğinden türetilir; yeni kategori için kod değişmez. Oyun sayfası `depo.js`'yi yüklediği sürece "Kaldığın yerden" şeridine kendiliğinden eklenir.
   - Ana sayfa kartının özet satırı için oyun, skor ya da ilerleme değişince tek satır yazar: `Depo.ozetYaz('<slug>', 'En iyi 1240')` (kısa tutun: "Seri 4", "3/9 delik"). Özet yazılmamışsa kartta satır görünmez.
5. `npm run build` çalıştırın: SEO bloklarını, sayfa sonundaki "Benzer oyunlar" bağlantılarını (aynı kategori ya da boyuttan 3 oyun; `</main>` önüne kendiliğinden eklenir), `sitemap.xml`, `robots.txt` ve çevrimdışı önbellek listesini günceller.
   - Oyunun sosyal paylaşım görseli `games/<slug>/paylasim.png` (1200×630; kapak + oyun adı) Playwright ile çizilir. Playwright depo bağımlılığı değildir: kurulu değilse `npm run build` yalnızca uyarır. Kurulu bir makinede `npm run paylasim` (ya da `PLAYWRIGHT_YOLU=/yol/node_modules/playwright npm run paylasim`) çalıştırıp PNG'yi depoya ekleyin. Kapak, ad ya da kategori değişince görsel eskir ve test hatırlatır. Görsel yalnızca sosyal ağlar içindir; `dosyalar` listesine eklemeyin.
6. `npm test` ile kontrolleri çalıştırın. Eksik ya da güncel olmayan meta, sitemap veya önbellek listesi testleri başarısız eder.

Sitenin yayın adresi `site.json` içindeki `url` alanındadır; alan adı değişirse yalnızca burayı güncelleyip `npm run build` çalıştırmak yeterlidir.

## Yerelde çalıştırma

Service worker `file://` ile çalışmaz; bir yerel sunucu kullanın:

```sh
python3 -m http.server 8000
```

Ardından http://localhost:8000 adresini açın.

Yeni bir 3D oyun `assets/js/kalite.js`'i kullanmalıdır (oyun başına kalite kodu yazılmaz): sayfada `depo.js`'den sonra yükleyin, `new THREE.WebGLRenderer(Kalite.rendererSecenek({...}))` ile kurun, `Kalite.kur(renderer, { azami, boyutla })` döndürdüğü nesnenin `kare(zaman)` işlevini her animasyon karesinde çağırın ve `Kalite.dugmeEkle(sesDugmesi, kalite)` ile "Düşük grafik" düğmesini ekleyin; dosyayı `games.json` `dosyalar` listesine de yazın. Göreli sahne maliyetini (kare/sn, çizim çağrısı) görmek için sunucu açıkken `node scripts/kalite-olc.js` çalıştırın.

Service worker yeni sürümde yalnızca içerik özeti değişen dosyaları indirir; özetler `npm run precache` ile `precache-manifest.js` içine yazılır. Güncelleme akışını (yalnızca değişen dosyaların inmesi, "Yenile" bildirimi, uçak modu) tarayıcıda denemek için Playwright kuruluyken `node scripts/sw-guncelleme-incele.js` çalıştırın.
