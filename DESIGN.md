---
version: alpha
name: Gece Baskısı
description: Her Gece Oyun'un tasarım sistemi. Gece yarısı çıkan bir gazete; mürekkep siyahı zemin, krem kâğıt yazısı, sodyum sokak lambası turuncusu. 2D ve 3D tarayıcı oyunları için de geçerlidir.
colors:
  primary: "#ffb23f"
  on-primary: "#1d1307"
  primary-shadow: "#b8741a"
  primary-hover: "#ffc266"
  neutral: "#110f0d"
  surface: "#1b1815"
  surface-raised: "#26211c"
  outline: "#3b332b"
  on-surface: "#f3ead8"
  on-surface-muted: "#b4a78f"
  error: "#ff6a48"
  on-error: "#1a0703"
  success: "#368549"
  on-success: "#ffffff"
  tile-absent: "#2e2822"
  on-tile-absent: "#a89c88"
  moon: "#9db4ff"
  game-bone: "#e9dcc2"
  game-iznik: "#2f6fb0"
  game-turquoise: "#2aa198"
typography:
  masthead:
    fontFamily: Bricolage Grotesque
    fontSize: 168px
    fontWeight: 800
    lineHeight: 0.86
    letterSpacing: -0.012em
    fontVariation: "'wdth' 75"
  display:
    fontFamily: Bricolage Grotesque
    fontSize: 64px
    fontWeight: 750
    lineHeight: 1.05
    letterSpacing: -0.03em
    fontVariation: "'wdth' 82"
  headline:
    fontFamily: Bricolage Grotesque
    fontSize: 48px
    fontWeight: 750
    lineHeight: 1.08
    letterSpacing: -0.015em
    fontVariation: "'wdth' 85"
  title:
    fontFamily: Bricolage Grotesque
    fontSize: 22px
    fontWeight: 750
    lineHeight: 1.15
    fontVariation: "'wdth' 88"
  body-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.55
  body-md:
    fontFamily: Bricolage Grotesque
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: Bricolage Grotesque
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
  label-caps:
    fontFamily: Bricolage Grotesque
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.14em
  numeric:
    fontFamily: Bricolage Grotesque
    fontSize: 28px
    fontWeight: 800
    lineHeight: 1
    fontFeature: "'tnum' 1"
rounded:
  sm: 6px
  md: 10px
  lg: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  gutter: 16px
  max-width: 1040px
  touch: 44px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.title}"
    rounded: "{rounded.full}"
    padding: 12px
    height: 48px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    padding: 12px
    height: 48px
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 24px
  archive-row:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: 16px
  archive-row-hover:
    backgroundColor: "{colors.surface}"
  eyebrow:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    typography: "{typography.label-caps}"
  key:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    height: 56px
  tile-correct:
    backgroundColor: "{colors.success}"
    textColor: "{colors.on-success}"
    rounded: "{rounded.sm}"
  tile-present:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
  tile-absent:
    backgroundColor: "{colors.tile-absent}"
    textColor: "{colors.on-tile-absent}"
    rounded: "{rounded.sm}"
  meta-text:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface-muted}"
    typography: "{typography.body-sm}"
  button-primary-edge:
    backgroundColor: "{colors.primary-shadow}"
    height: 3px
  scene-fill-light:
    backgroundColor: "{colors.moon}"
  offline-badge:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-error}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.full}"
  game-piece-bone:
    backgroundColor: "{colors.game-bone}"
    rounded: "{rounded.sm}"
  game-piece-iznik:
    backgroundColor: "{colors.game-iznik}"
    rounded: "{rounded.sm}"
  game-piece-turquoise:
    backgroundColor: "{colors.game-turquoise}"
    rounded: "{rounded.sm}"
---

# Her Gece Oyun: Gece Baskısı

Bu dosya sitenin tek tasarım kaynağıdır. Biçimi Google Labs'in açık [DESIGN.md spesifikasyonunu](https://github.com/google-labs-code/design.md) (Apache-2.0) izler: üstteki YAML token'lar bağlayıcı değerlerdir, aşağıdaki metin onların nasıl kullanılacağını anlatır. Bölüm yapısı ve "ajan için hızlı başvuru" fikri [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (MIT) koleksiyonundaki editoryal sistemlerden (The Verge, PlayStation, Nintendo) uyarlanmıştır; oradan değer ya da metin kopyalanmamıştır. Kontrol: `npx @google/design.md lint DESIGN.md`.

Sahibi tasarımcı rolüdür (`.claude/skills/tasarimci`). Rehberi değiştiren her PR bu dosyayı ve `assets/css/style.css` içindeki `:root` değişkenlerini birlikte günceller.

## Overview

Her Gece Oyun, gece yarısı basılan bir gazete gibi hissettirir. Zemin sıcak bir mürekkep siyahıdır, yazılar krem kâğıt rengindedir ve tek vurgu Türkiye sokaklarının sodyum lambası turuncusudur. Her oyun gazetenin bir sayısıdır (No. 001, No. 002 …); en yeni oyun manşete çıkar, eskiler arşive iner.

Kişilik: meraklı, gececi, biraz muzip ama özensiz değil. Oyuncuya "bu gece seni bekleyen bir şey var" duygusu verir. Kalabalık değil, editoryal: büyük tipografi, ince çizgiler, bol nefes. Hedef kitle telefonda, yatmadan önce birkaç dakika oynayan Türkçe konuşan oyuncudur; bu yüzden her şey önce mobil ve tek elle kullanılabilir tasarlanır.

Kaçınılacak görünüm: mor/lacivert gradyan kahraman alanı, aynı boyda yuvarlak kart ızgarası, emoji ikonlar, "oyun portalı" kalabalığı, reklam alanı gibi duran kutular.

Site karanlık temalıdır ve açık tema yoktur; gece kimliğin kendisidir (`color-scheme: dark`, `theme-color` = `neutral`).

## Colors

Palet sıcak nötrler ve tek bir parlak vurgu üzerine kuruludur. CSS'te karşılıkları `assets/css/style.css` içindeki `:root` değişkenleridir; sabit renk yazmak yerine değişken kullanılır.

- **Sodyum (`primary`, `--sodyum`):** Tek vurgu. Birincil buton, üst başlık (eyebrow), aktif durum, "var" harf kutusu. Bir ekranda en önemli tek eyleme ayrılır.
- **Mürekkep (`neutral`, `--murekkep`):** Sayfa zemini ve oyun içindeki boş hücreler.
- **Kâğıt (`surface`, `--kagit`) ve Yükseltilmiş kâğıt (`surface-raised`, `--kagit-2`):** Panel, oyun alanı, hover zemini, klavye tuşu.
- **Çizgi (`outline`, `--cizgi`):** Bölüm ayraçları ve kenarlıklar. Gölgenin yaptığı işi burada çizgi yapar.
- **Krem (`on-surface`, `--krem`) ve Soluk (`on-surface-muted`, `--soluk`):** Ana yazı ve meta bilgi.
- **Kor (`error`, `--kor`):** Çevrimdışı rozeti, hata, tehlike, kaybetme.
- **Yaprak (`success`, `--yaprak`):** Doğru cevap, kazanma.
- **Ay (`moon`):** Yalnızca oyun içi soğuk dolgu ışığı ve 3D sahnelerde gece göğü vurgusu; arayüz metninde kullanılmaz.
- **Oyun renkleri (`game-bone` kemik, `game-iznik` İznik mavisi, `game-turquoise` turkuaz):** Yalnızca oyun nesnelerinde, altı ayrı rengin gerektiği yerlerde (ör. Zekâ Küpü yüzleri: kemik, sodyum, kor, yaprak, İznik mavisi, turkuaz). Arayüzde kullanılmaz.

Renk körlüğü: doğru/yanlış bilgisi hiçbir zaman yalnızca renkle verilmez; şekil, ikon ya da metinle desteklenir.

## Typography

Tek aile: **Bricolage Grotesque** (değişken; ağırlık 200–800, genişlik %75–100, optik boyut). SIL OFL lisanslıdır ve `assets/fonts/` altında yerel olarak sunulur; Google Fonts ya da CDN kullanılmaz çünkü site çevrimdışı çalışmalıdır. Türkçe harfler (ı, İ, ğ, ş) `latin` ve `latin-ext` dosyalarına bölünmüştür, ikisi de önbellektedir.

- **Masthead:** Site adı. %75 genişlik, 800 ağırlık, büyük harf; ekran genişliğini dolduracak kadar büyük (`clamp(3rem, 15.5vw, 10.5rem)`).
- **Display / Headline:** Manşet oyun adı ve sayfa başlıkları. Daraltılmış genişlik (%82–88) ve hafif negatif harf aralığı gazete manşeti hissi verir.
- **Title:** Arşiv satırı başlıkları, butonlar.
- **Body:** 17 px, satır yüksekliği 1.55, satır uzunluğu en fazla 62 karakter.
- **Label caps:** Üst başlık, kategori, tarih şeridi. Büyük harf, geniş harf aralığı.
- **Numeric:** Skor, sayaç, süre. Her zaman tabular rakam (`tnum`), böylece sayılar değişirken titremez.

Büyük harf dönüşümü Türkçe kurala uysun diye her sayfa `<html lang="tr">` ile başlar (i → İ, ı → I).

## Layout

Mobil önce: tasarım 390 px genişlikte başlar, yatay kaydırma yoktur, kenar boşluğu 16 px'tir. Masaüstünde içerik en fazla 1040 px genişliğinde ortalanır. Boşluk ölçeği 4 px tabanlıdır (4, 8, 16, 24, 48).

Sayfalar kart ızgarası yerine gazete sütunu gibi akar: bölümler ince bir çizgiyle (`outline`), ana bölüm geçişleri çift çizgiyle (`4px double`) ayrılır. Ana sayfa sırası: künye (tarih şeridi, masthead, slogan) → bu gecenin oyunu (manşet + eğik vitrin görseli) → arşiv (numaralı satırlar) → alt bilgi (Ücretsiz · Girişsiz · İnternetsiz).

Oyun sayfası sırası: başlık çubuğu (logo + `← Tüm oyunlar` + varsa oyun ikonları) → üst başlık (kategori) → `<h1>` → oyun alanı → `Nasıl oynanır?`. Oyun alanı ilk ekranda tamamen görünmelidir; açıklama metni kaydırınca gelir.

Duyarlı davranış: 420 px altında geri bağlantısı yalnızca oka iner, logo küçülür, arşiv satırındaki ok düğmesi gizlenir. 760 px üstünde manşet iki sütuna açılır. Dokunma hedefleri en az 44 px'tir.

## Elevation & Depth

Derinlik çoğunlukla tonla ve çizgiyle kurulur: mürekkep zemin, onun üstünde kâğıt panel, onun üstünde yükseltilmiş kâğıt. Gölge yalnızca iki yerde kullanılır:

1. **Sodyum parıltısı:** Manşet vitrin görselinin altındaki yumuşak turuncu ışık (`0 24px 60px -24px` sodyum %35), sokak lambasının kâğıda vurması gibi.
2. **Basılabilir buton:** Birincil butonun altında 3 px koyu sodyum kenar (`primary-shadow`); basınca buton bu kenara iner.

Uzak yıldızlar (künyede birkaç piksellik noktalar) dekoratiftir ve içerikle yarışmaz.

## Shapes

Şekil dili "kesilmiş kâğıt"tır: küçük ve orta yarıçaplar (6–16 px), butonlar ve rozetler tam hap. Kapak görselleri ve oyun hücreleri `sm` (6–8 px), paneller `lg` (16 px). Keskin köşe ile tam yuvarlak aynı bileşende karışmaz. Logo bir CSS hilalidir (`.logo::before`); emoji logo ya da ikon olarak kullanılmaz, ikonlar satır içi SVG'dir ve `currentColor` ile boyanır.

## Components

- **Künye:** Tarih şeridi (gün, ay, yıl, gün adı) + "Sayı 00X" sayacı + masthead + slogan. Çevrimdışıyken şeritte `offline-badge` görünür.
- **Bu gecenin oyunu:** Nabız atan damga ("Bu gecenin oyunu"), `display` başlık, `No. · kategori · tarih` meta satırı, açıklama, `button-primary` ("Hemen oyna →"), 1.5° eğik vitrin görseli; hover'da düzleşir ve yükselir.
- **Arşiv satırı (`archive-row`):** Kapak küçük resmi (16:9), `No. 00X · KATEGORİ` üst satırı, başlık, en fazla iki satır açıklama, sağda yuvarlak ok. Hover'da zemin `surface` olur, kapak -2° döner, ok sodyumla dolar.
- **Butonlar:** `button-primary` sayfadaki tek ana eylem; `button-secondary` ikincil eylemler için çizgili hap.
- **Panel (`.oyun-alani`):** Oyunun oynandığı alan.
- **Oyun içi:** Harf kutuları (`tile-correct`, `tile-present`, `tile-absent`), ekran klavyesi tuşu (`key`, en az 56 px yükseklik), sayaç ve skorlar `numeric`. Sonuç ve istatistik pencereleri `<dialog>` + `panel`.
- **Kapak görseli (`games/<slug>/kapak.svg`):** 320×180 SVG, zemin `surface`, iki üç küçük yıldız noktası, oyunun özünü anlatan tek bir sembol (ör. kelime kutuları; "42" ve oklar). Yalnızca bu paletteki renkler; yazı tipi `system-ui` (SVG `<img>` içinde web fontu yüklenmez). 3D oyunlarda kapak sahnenin bir karesinden düz renkli bir çizim olabilir, fotoğraf gerçekçiliği olmaz.

## Do's and Don'ts

- Do: Sodyumu bir ekranda yalnızca en önemli eyleme ve kısa etiketlere ayır.
- Do: Her yeni oyun sayfasını aynı başlık çubuğu, üst başlık ve `Nasıl oynanır?` düzeniyle kur.
- Do: Sayıları tabular rakamla, Türkçe metni `lang="tr"` ile yaz.
- Do: Her yeni dosyayı (font, model, ses, doku) çevrimdışı önbellek listesine ekle.
- Do: Animasyonları `prefers-reduced-motion` açıkken kapat.
- Don't: Harici font, CDN, API ya da analitik betiği ekleme; her şey depoda olmalı.
- Don't: Mor/lacivert gradyan, emoji ikon, aynı boy kart ızgarası kullanma.
- Don't: Paletten başka renk uydurma; gerekiyorsa önce bu dosyaya token olarak ekle.
- Don't: Bilgiyi yalnızca renkle verme.
- Don't: Krem yazıyı sodyum zemin üstüne koyma; sodyum üstünde yalnızca `on-primary`.

## Motion

Hareket kısa ve anlamlıdır, oyunun hissini güçlendirmek içindir; süs değildir.

- Basma: butonlar 3 px iner (120 ms), klavye tuşları 2 px.
- Geri bildirim: harf yazınca kutu 1.08 ölçekle "basılır"; tahmin açılınca kutular sırayla X ekseninde döner (500 ms, 100 ms aralık); yanlış girişte satır sallanır.
- Durum değişimi: aralık çubuğu gibi göstergeler 450 ms `cubic-bezier(.2,.8,.2,1)` ile kayar.
- Kazanma anı her oyunda küçük bir kutlama ister (parıltı, sıçrama ya da konfeti; en fazla 1.5 sn).
- `prefers-reduced-motion: reduce` açıkken tüm animasyon ve geçişler kapanır.

## Game Art: 2D ve 3D

Oyunlar her gece değişir; bazen 2D, bazen 3D olur. Hepsi bu sistemin parçası gibi görünmelidir.

**Ortak:** Oyun alanının zemini `neutral` ya da `surface`, HUD (skor, süre, can) üst kenarda `numeric` tipografiyle ve `label-caps` etiketlerle. Duraklat, ses aç/kapa ve yeniden başlat düğmeleri satır içi SVG ikonlu yuvarlak 40–44 px düğmeler. Oyun başında tek ekranlık "nasıl oynanır" ipucu, sonunda skor + "Yeniden oyna" (`button-primary`) + "Tüm oyunlar".

**2D (canvas/DOM):** Düz renk, ince kontur yok ya da `outline` renginde; oyun nesneleri paletin renkleriyle ayrışır (oyuncu `primary`, tehlike `error`, ödül `success`, nötr nesneler `surface-raised`). Canvas `devicePixelRatio` ile keskin çizilir ve konteynerine göre yeniden boyutlanır. Piksel sanatı seçilirse tek bir piksel ölçeğine sadık kalınır.

**3D:** Kütüphane gerekiyorsa (ör. three.js, MIT) dosya `assets/vendor/` altına konup önbelleğe eklenir; CDN'den yüklenmez. Görsel dil düşük poligonlu ve düz gölgelidir (`flatShading`), dokular yerine paletten düz renkli malzemeler. Işık: sıcak sodyum ana ışık + soğuk `moon` dolgu ışığı + düşük ortam ışığı; sis rengi `neutral` ile sahnenin uzağı sayfa zeminine erir. Kamera yumuşak takip eder, ani sarsıntı yoktur. Performans bütçesi: orta segment telefonda 60 fps hedefi, 30 fps altına düşmez; sekme gizlenince döngü durur; toplam oyun boyutu ~1.5 MB'ı geçmez.

**Dokunmatik:** Her oyun klavyesiz, tek elle oynanabilir; kaydırma/dokunma kontrolleri ekranın alt yarısındadır ve sayfa kaydırmasını engellemek için oyun alanında `touch-action: none` kullanılır.

**Ses (isteğe bağlı):** Kısa, yumuşak, yerel dosyalardan; varsayılan açık ama tek dokunuşla kapanır ve tercih `localStorage`'da saklanır.

## Agent Prompt Guide

Bir ajan bu siteye arayüz eklerken şu kısa başvuruyu kullanır:

- Zemin `#110f0d`, panel `#1b1815`, çizgi `#3b332b`, yazı `#f3ead8`, soluk yazı `#b4a78f`, vurgu `#ffb23f` (üstünde `#1d1307`), hata `#ff6a48`, başarı `#368549`.
- Yazı tipi `var(--font)` (Bricolage, yerel). Başlıklar daraltılmış ve kalın, etiketler büyük harf ve geniş aralıklı.
- Hazır sınıflar: `.site-header`, `.logo`, `.geri`, `.ust-baslik`, `.oyun-sayfasi`, `.oyun-alani`, `.buton`, `.buton.ikincil`, `.oyun-karti`.
- Örnek istem: "Yeni oyun sayfası: `.site-header` + `.ust-baslik` (kategori) + `<h1>` + `.oyun-alani` içinde canvas; HUD üstte tabular rakamla skor; kazanınca `.buton` ile Yeniden oyna. Renkler yalnızca DESIGN.md token'larından."
- Kontrol listesi: `npm run build`, `npm test`, `npx @google/design.md lint DESIGN.md`, `node scripts/ekran-goruntusu.js <klasör>` ile 390 px ve 1280 px görüntüleri gözle kontrol.
