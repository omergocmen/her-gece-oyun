# Her Gece Oyun

Her gece yeni bir tarayıcı oyununun eklendiği Türkçe oyun sitesi. Oyunlar ücretsizdir, kullanıcı girişi gerektirmez ve internet olmadan da oynanabilir.

## Kaynaklar ve lisanslar

- **Günün Kelimesi** geçerli tahmin listesi (`games/gunun-kelimesi/kelimeler.js` içindeki `GECERLI`), [Zemberek-NLP](https://github.com/ahmetaa/zemberek-nlp) projesinin [`master-dictionary.dict`](https://raw.githubusercontent.com/ahmetaa/zemberek-nlp/master/morphology/src/main/resources/tr/master-dictionary.dict) sözlüğünden üretilir (Apache-2.0, Copyright 2018 Ahmet A. Akın, Mehmet D. Akın). Sözlük yalnızca `python3 scripts/kelime-listesi.py games/gunun-kelimesi/kelimeler.js` çalıştırılırken indirilir; oyun çalışma zamanında internete bağlanmaz. Cevap listesi (`CEVAPLAR`) elle seçilmiştir.
