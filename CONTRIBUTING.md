# Yeni oyun ekleme

Site derleme gerektirmez; düz HTML, CSS ve JavaScript'ten oluşur. İlke: her oyun ücretsiz, girişsiz ve internetsiz oynanır. Harici CDN, API ya da hesap kullanılmaz; ilerleme yalnızca `localStorage`'da tutulur (`assets/js/depo.js`).

## Adımlar

1. `games/<slug>/` klasörünü oluşturun. Slug küçük harf ve tire içerir (ör. `mayin-tarlasi`).
2. `games/<slug>/index.html` yazın. `games/sayi-tahmin/index.html` örnek alınabilir. Sayfada şunlar olmalı:
   - `<html lang="tr">`, benzersiz `<title>` ve `<meta name="description">`
   - `<meta name="site-kok" content="../../">` ve `../../assets/js/sw-kayit.js` (çevrimdışı çalışma için)
   - Kısa bir "Nasıl oynanır?" bölümü
3. Oyunun tüm dosyalarını (JS, görsel, ses) aynı klasöre koyun; dış bağlantı kullanmayın.
4. `games.json`'a kayıt ekleyin: `slug`, `ad`, `aciklama`, `kategori`, `eklenme` (YYYY-AA-GG), `gorsel` ve oyunun tüm dosyalarını listeleyen `dosyalar` (sayfa için `games/<slug>/`). En yeni tarihli oyun ana sayfada "Bu gecenin oyunu" olur.
5. `npm run precache` ile çevrimdışı önbellek listesini güncelleyin.
6. `npm test` ile kontrolleri çalıştırın.

## Yerelde çalıştırma

Service worker `file://` ile çalışmaz; bir yerel sunucu kullanın:

```sh
python3 -m http.server 8000
```

Ardından http://localhost:8000 adresini açın.
