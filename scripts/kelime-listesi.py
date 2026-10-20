# games/gunun-kelimesi/kelimeler.js dosyasını üretir.
#   python3 scripts/kelime-listesi.py games/gunun-kelimesi/kelimeler.js [sozluk.dict]
# CEVAPLAR: günün kelimesi olabilecek yaygın sözcükler (sabit tohumla karıştırılmış sırada).
# GECERLI: tahmin olarak kabul edilen tüm sözcükler (cevaplar dahil).
#
# GECERLI'nin kaynağı Zemberek-NLP projesinin sözlüğüdür:
#   https://raw.githubusercontent.com/ahmetaa/zemberek-nlp/master/morphology/src/main/resources/tr/master-dictionary.dict
#   Lisans: Apache-2.0, Copyright 2018 Ahmet A. Akın, Mehmet D. Akın
# Sözlük yalnızca bu betik çalışırken indirilir (ya da ikinci argümanla yerel dosya verilir);
# oyun çalışma zamanında hiçbir sözlüğe bağlanmaz. Dosya düz metin olarak okunur, çalıştırılmaz.
import hashlib, json, random, re, sys, urllib.request

SOZLUK_URL = ("https://raw.githubusercontent.com/ahmetaa/zemberek-nlp/master/"
              "morphology/src/main/resources/tr/master-dictionary.dict")
# Listenin üretildiği sözlük sürümü; farklıysa uyarı verilir (kaynak değişmiş olabilir).
SOZLUK_SHA256 = "c539e12904d1ccac4792073f05deeae2babe692249dc4a359da254f1bd338f6f"

HARFLER = set("ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ")

def buyuk(s):
    # Şapkalı harfler klavyede olmadığından düz harfe indirilir (âdet → ADET).
    s = s.replace("â", "a").replace("î", "i").replace("û", "u")
    return s.replace("i", "İ").replace("ı", "I").upper()

CEVAP_HAM = """
kalem kitap araba deniz güneş bulut çiçek armut kiraz limon kavun incir biber soğan havuç marul bamya nohut
ekmek şeker reçel kahve çorba tatlı helva lokum simit börek pilav kebap köfte dolma sarma mantı ayran
köpek tavuk horoz ördek şahin serçe balık yunus aslan tilki zebra katır geyik kirpi yılan akrep böcek sinek
karga manda koyun domuz nehir orman çayır tarla bahçe çakıl kayık vapur sahil ırmak dünya duman buhar gölge
sabah öğlen akşam hafta zaman bahar kulak burun dudak boyun bacak kalça göğüs karın kemik beyin damar sakal
bıyık yanak perde duvar tavan yatak kilim dolap lamba banyo tabak kaşık çatal bıçak fırın kömür silgi çanta
kilit şapka ceket çorap kemer düğme iplik makas çekiç kürek balta halat torba sepet kağıt resim tablo müzik
şarkı türkü davul zurna gitar keman bilye sevgi barış hayal mutlu korku cesur güzel büyük küçük geniş derin
sıcak soğuk hızlı yavaş kolay temiz kirli yeşil beyaz siyah pembe bilgi fikir sabır huzur saygı hukuk kanun
şehir köprü sokak cadde çarşı pazar manav sınıf sınav cümle masal roman yazar polis asker pilot terzi teyze
kuzen torun evlat komşu metro taksi motor yolcu bilet durak liman sınır tarih bilim deney fizik kimya rakam
hesap kesir üçgen daire nokta çizgi yüzük kolye elmas altın gümüş bakır demir çelik kumaş pamuk tahta mısır
ceviz badem çilek vişne kekik defne sucuk salam hamur krema düğün nişan parti tören şafak çınar kavak söğüt
tohum filiz fidan çimen yosun diken güreş yüzme kayak tenis hakem takım rekor özlem hüzün merak heves gurur
utanç keder radyo video ekran kablo robot roket insan kadın erkek çocuk bebek yaşlı görev kuruş fiyat ödeme
kredi banka hasta hayat doğum yaşam evren yalan doğru cevap sorun çözüm sonuç hedef proje şeref inanç melek
savaş silah kılıç zafer saray devir sekiz dokuz yirmi nisan mayıs şubat eylül kasım bugün yarın sonra bütün
kimse neden nasıl bazen artık henüz belki çünkü ancak fakat hangi aşağı ileri tuzlu dalga kumru yayla
tepe vadi
kaşar gazoz şalgam lahmacun pide
bulmaca
""".split()

EK_HAM = """
almak atmak itmek ölmek yemek demek olmak geldi gitti aldım bakın yazdı okudu koştu evler atlar sular hemen
şimdi hepsi niçin daima lakin yahut orada içeri sekiz altıncı nerde burda hangi oysa ayrıca kadar gibi daha
pişti tavla okey zarlı kartı ovası oyunu zarlar kumar çamur balçık bataklık kumul dere çeşme kuyu havuz sulak ağaçlı dallı yapraklı
tavuğu kedim evimiz anlam mesaj imza ilan haber gazete dergi kanal sahne perdeli film dizi oyun oyuncu konser
salon odası mutfak kiler bodrum avlu teras balkon kapısı camlı kepenk tente çadır kulübe ahır kümes ağıl
sürü çoban çiftlik orak tırpan saban tarım hasat buğday arpa çavdar yulaf mercimek fasulye bezelye kabak
patlıcan domates salatalık turşu sirke yağlı tuzsuz acılı ekşili tatlıyı lezzet koku tadı aroma baharat
kimyon nane fesleğen safran zencefil hindistan
tilkiler kurtlar kuzular aslanı ayılar
konuk davet sofra yemeği ikram kahvaltı akşamı öğlesi gece gündüz sabahı yarıyıl
mevsim kışlık yazlık güzlük baharı
yıllık aylık günlük saatlik dakika saniye anlık
kaçak kaçış yarış koşu atlet sporcu antren kondisyon
çabuk acele sakin yorgun dinç uykulu uyanık
gülmek ağlamak sevmek kızmak
ağabey abla kardeş anne baba dede nine amca dayı hala
eniş enişte yenge gelin damat kayın
bacı hanım beyim efendi ağa paşa bey
yolcu yollar yolda yoldan
abide anıt heykel müze sergi galeri
kalıp şablon model örnek taslak çizim boyama boyalı fırça tuval
iskele rıhtım feribot kano yelken kürekçi denizci kaptan tayfa
kuşlar kuşu kuşak kuşku kuşet
bilgin bilge alim usta çırak kalfa
dikiş örgü nakış yamalı yama
kâse kase çömlek testi ibrik cezve demlik semaver
adres posta kargo paket koli kutu
kural yasak izin onay kabul ret
tatil gezi turlar seyahat valiz bavul
haklı haksız hakkı hakim
çanak yemek kaşığı tepsi sini
dümen pusula çapa yelek
çizme bot terlik sandalet
nakit çeklik senet faiz kâr zarar
mimar inşaat yapı bina kat daire site
ayakta oturak masada
""".split()

def temizle(liste):
    sonuc = []
    for k in liste:
        b = buyuk(k)
        if len(b) == 5 and set(b) <= HARFLER and b not in sonuc:
            sonuc.append(b)
    return sonuc

# Günün kelimesi olunca keyifsiz olan bağlaç, zarf, zamir, belirteç ve sayılar (#29).
# CEVAP_HAM'dan silinmez, karıştırmadan SONRA çıkarılır: böylece kalan kelimelerin sırası
# aynen korunur. Çıkarılanların ilki (NEDEN) 37. indekste olduğundan #1-#37 bulmacaları
# (20 Ekim - 25 Kasım 2026) ve liste sonu (#0) eskisiyle aynıdır; yalnızca henüz gelmemiş
# günlerin kelimeleri öne kayar. İstatistik bulmaca numarasıyla tutulduğu için etkilenmez.
CIKARILAN = set(temizle("""
nasıl çünkü ancak fakat hangi belki bazen artık henüz neden kimse bütün sonra bugün yarın
aşağı ileri sekiz dokuz yirmi
""".split()))
# Bu numaraya kadarki (dahil) bulmacalar eski listeyle aynı kalmalıdır: liste değiştiğinde
# oynanmış günlerin kayıtlı tahminleri başka bir cevapla renklenmesin.
KORUNAN_GUN = 37  # #37 = 25 Kasım 2026

def sozluk_oku(yol):
    if yol:
        with open(yol, "rb") as f:
            veri = f.read()
    else:
        with urllib.request.urlopen(SOZLUK_URL, timeout=60) as yanit:
            veri = yanit.read()
    if hashlib.sha256(veri).hexdigest() != SOZLUK_SHA256:
        print("uyarı: sözlük sürümü değişmiş, yeni listeyi gözden geçirin", file=sys.stderr)
    kelimeler = []
    for satir in veri.decode("utf-8").splitlines():
        satir = satir.strip()
        if not satir or satir.startswith("#"):
            continue
        kok, _, ozellik = satir.partition(" ")
        # Büyük harfle başlayanlar özel isimdir; kısaltma ve noktalama da alınmaz.
        if kok[0].isupper() or re.search(r"Prop|Abbrv|Punc", ozellik):
            continue
        kelimeler.append(kok)
    return temizle(kelimeler)

eski_cevaplar = temizle(CEVAP_HAM)
random.Random(2026).shuffle(eski_cevaplar)
cevaplar = [k for k in eski_cevaplar if k not in CIKARILAN]
assert cevaplar[:KORUNAN_GUN] == eski_cevaplar[:KORUNAN_GUN], "geçmiş bulmacalar değişiyor"
assert cevaplar[-1] == eski_cevaplar[-1], "#0 bulmacası değişiyor"

sozluk = sozluk_oku(sys.argv[2] if len(sys.argv) > 2 else None)
# Eski elle yazılmış listedeki her kelime geçerli kalır; liste yalnızca büyür.
gecerli = sorted(set(sozluk) | set(eski_cevaplar) | set(temizle(EK_HAM)))

with open(sys.argv[1], "w", encoding="utf-8") as f:
    f.write("// Bu dosya otomatik üretilir: python3 scripts/kelime-listesi.py games/gunun-kelimesi/kelimeler.js\n")
    f.write("// GECERLI kaynağı: Zemberek-NLP sözlüğü (Apache-2.0), ayrıntı scripts/kelime-listesi.py içinde.\n")
    f.write("(function (kok) {\n")
    f.write("  var CEVAPLAR = " + json.dumps(cevaplar, ensure_ascii=False) + ";\n")
    # Boyutu küçük tutmak için boşlukla ayrılmış tek metin olarak yazılır.
    f.write("  var GECERLI = " + json.dumps(" ".join(gecerli), ensure_ascii=False) + ".split(' ');\n")
    f.write("  var Kelimeler = { CEVAPLAR: CEVAPLAR, GECERLI: GECERLI };\n")
    f.write("  if (typeof module !== 'undefined' && module.exports) module.exports = Kelimeler;\n")
    f.write("  else kok.Kelimeler = Kelimeler;\n")
    f.write("})(this);\n")
print(len(cevaplar), "cevap,", len(gecerli), "geçerli")
