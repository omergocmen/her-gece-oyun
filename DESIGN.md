# Tasarım rehberi: "Gece Baskısı"

Her Gece Oyun, gece yarısı çıkan bir gazete gibi görünür: sıcak mürekkep siyahı zemin, krem kâğıt yazısı ve sodyum sokak lambası turuncusu. Her oyun gazetenin bir sayısıdır (No. 001, No. 002 …), en yeni oyun manşettir. Yeni sayfa, oyun ya da bileşen eklerken bu rehbere uyun; jenerik "mor gradyan + yuvarlak kart + emoji" görünümünden kaçının.

## Renkler

Tümü `assets/css/style.css` içindeki `:root` değişkenleridir; sabit renk yazmak yerine değişkeni kullanın.

| Değişken | Değer | Kullanım |
| --- | --- | --- |
| `--murekkep` | `#110f0d` | Sayfa zemini, oyun içi boş kutular |
| `--kagit` | `#1b1815` | Panel, oyun alanı, hover zemini |
| `--kagit-2` | `#26211c` | Klavye tuşu, ikincil yüzey |
| `--cizgi` | `#3b332b` | Ayraç çizgileri, kenarlıklar |
| `--krem` | `#f3ead8` | Ana yazı |
| `--soluk` | `#b4a78f` | İkincil yazı, meta bilgi |
| `--sodyum` | `#ffb23f` | Tek vurgu rengi: buton, etiket, aktif durum |
| `--sodyum-koyu` | `#1d1307` | Sodyum üstündeki yazı |
| `--kor` | `#ff6a48` | Uyarı (çevrimdışı rozeti, hata) |
| `--yaprak` | `#5aa86a` | Başarı / doğru cevap |

Kurallar: sayfada tek vurgu rengi sodyumdur. Site karanlık temalıdır (`color-scheme: dark`, `theme-color` `#110f0d`). Kontrast: krem/soluk yazı zeminde AA'yı geçer; sodyum yalnızca kısa etiket ve buton için kullanılır.

## Tipografi

- Tek aile: **Bricolage Grotesque** (değişken; ağırlık 200–800, genişlik 75–100%). Dosyalar `assets/fonts/` altında yereldir; Google Fonts ya da CDN kullanılmaz (çevrimdışı ilke). Türkçe harfler `latin` + `latin-ext` alt kümelerindedir.
- Bayrak (site adı): 800 ağırlık, `font-stretch: 75%`, büyük harf.
- Başlıklar: 750 ağırlık, `font-stretch` 82–88%, hafif negatif harf aralığı.
- Üst başlık / etiket: `.78rem`, 700, büyük harf, `letter-spacing: .14em`, sodyum renk.
- Sayılar her yerde `font-variant-numeric: tabular-nums`.
- Büyük harf dönüşümü doğru çalışsın diye her sayfa `<html lang="tr">` olmalı (i → İ).

## Yerleşim

- Mobil önce: 390 px genişlikte yatay kaydırma olmamalı, kenar boşluğu 16 px. İçerik genişliği en fazla 1040 px (`--genislik`).
- Bölümler kart ızgarası yerine gazete gibi ince çizgilerle (`--cizgi`) ve çift çizgiyle (`4px double`) ayrılır.
- Dokunma hedefleri en az 40–48 px.

## Bileşenler

- **Künye** (ana sayfa üstü): tarih şeridi, "Sayı" sayacı, dev bayrak, slogan.
- **Bu gecenin oyunu**: nabız atan damga, büyük başlık, `No. · kategori · tarih` meta satırı, sodyum buton, hafif eğik vitrin görseli.
- **Arşiv satırı** (`.oyun-karti`): kapak küçük resmi, `No. 00X · KATEGORİ`, başlık, iki satırlık açıklama, ok düğmesi. Hover'da kapak hafifçe döner, ok sodyum olur.
- **Oyun sayfası başlığı**: `.site-header` (logo + `← Tüm oyunlar`), `<main class="container oyun-sayfasi">`, `<span class="ust-baslik">Kategori</span>`, `<h1>`.
- **Oyun alanı**: `.oyun-alani` paneli. Butonlar `.buton` (birincil) ve `.buton.ikincil`.
- **Logo**: CSS ile çizilen hilal (`.logo::before`), emoji kullanılmaz.

## Oyun kapakları (`games/<slug>/kapak.svg`)

320×180 SVG, zemin `#1b1815`, 2–3 küçük yıldız noktası, oyunun özünü anlatan tek bir sembol (ör. kelime kutuları, "42" ve oklar). Yalnızca rehberdeki renkler; yazı tipi `system-ui` (SVG `<img>` içinde web fontu yüklenmez).

## Hareket

- Kısa ve anlamlı: buton basılma (3 px), kutu çevirme, kapak eğilmesi, aralık çubuğunun daralması.
- `prefers-reduced-motion` açıkken tüm animasyonlar kapanır (style.css sonunda).

## Kontrol listesi (her tasarım PR'ı)

1. `npm run build` ve `npm test` geçer.
2. `node scripts/ekran-goruntusu.js <klasor>` ile mobil ve masaüstü görüntüleri alınıp gözle kontrol edildi.
3. Harici kaynak yok, yeni dosyalar `precache` listesinde (`games.json` → `dosyalar` ya da `scripts/precache-olustur.js` → `KABUK`).
4. Türkçe karakterler (ı, İ, ğ, ş) doğru görünüyor.
