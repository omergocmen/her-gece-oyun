// Mini Golf Türkiye parkuru: 9 delik. Tarayıcıda window.GolfParkur, Node testlerinde module.exports.
//
// Birimler metre. Oyun alanı 0.5 m'lik hücrelere oturan dikdörtgenlerin birleşimidir; duvarlar
// sınırdan otomatik çıkar. Tee'den bakış -z yönündedir. Alanlar:
//   alan, kutular {r, y, tur}, daireler [x, z, r, tür], tamponlar [ax, az, bx, bz],
//   kapilar {x, z, L, w, faz, direk}, vapurlar {x, z, en, boy, genlik, periyot},
//   su / kum / sig dikdörtgenleri, rampalar {eksen, a, b, dh}, lambalar [[x, z]], bakis (ilk kamera açısı).
// Her deliği par'da bitiren geliştirici vuruşları kayit.json'dadır (scripts/golf-par-ara.js üretir,
// testler oynatır). Parkuru değiştirince kaydı yeniden üretin.
(function (kok) {
  var DELIKLER = [
    {
      no: 1, ad: 'Kapadokya', sahne: 'kapadokya', par: 2,
      alan: [[-1, -9, 1, 1]],
      tee: [0, 0], delik: [0, -8],
      daireler: [[-0.4, -3.4, 0.24, 'peri'], [0.45, -5.1, 0.24, 'peri'], [0.05, -6.4, 0.22, 'peri']],
      lambalar: [[-1.6, -2], [1.6, -6.5]]
    },
    {
      no: 2, ad: 'Pamukkale', sahne: 'pamukkale', par: 3,
      alan: [[-1.5, -11, 1.5, 1]],
      tee: [0, 0], delik: [0.7, -10],
      rampalar: [{ eksen: 'z', a: -3, b: -3.5, dh: -0.22 }, { eksen: 'z', a: -6.5, b: -7, dh: -0.22 }],
      sig: [[-1.5, -5.5, 0.25, -4.5], [-0.25, -9, 1.5, -8]],
      kutular: [{ r: [-1.5, -7.5, -0.5, -7.2], y: 0.2, tur: 'teras' }],
      lambalar: [[-2.1, -1.5], [2.1, -8]]
    },
    {
      no: 3, ad: 'Efes', sahne: 'efes', par: 3, bakis: -Math.PI / 2,
      alan: [[-1, -7, 1, 1], [-1, -9, 6, -7]],
      tee: [0, 0], delik: [5.1, -8],
      daireler: [[-0.5, -3.8, 0.17, 'sutun'], [0.5, -3.8, 0.17, 'sutun'], [0, -5.6, 0.17, 'sutun']],
      kutular: [{ r: [2.6, -8.1, 3.1, -7], y: 0.28, tur: 'kirik' }],
      lambalar: [[1.6, -1.5], [3.5, -9.6]]
    },
    {
      no: 4, ad: 'Galata', sahne: 'galata', par: 3,
      alan: [[-1, -12, 1, 1]],
      tee: [0, 0], delik: [0.2, -10.6],
      rampalar: [{ eksen: 'z', a: -4, b: -7, dh: 0.7 }],
      kutular: [{ r: [-1, -9.2, -0.15, -8.85], y: 0.22, tur: 'tas' }],
      lambalar: [[-1.6, -3], [1.6, -9]]
    },
    {
      no: 5, ad: 'Kız Kulesi', sahne: 'kizkulesi', par: 3,
      alan: [[-1, -4, 1, 1], [-3, -5.5, 3, -4], [-1, -10, 1, -5.5]],
      tee: [0, 0], delik: [0, -8.8],
      su: [[-3, -5.5, 3, -4]],
      vapurlar: [{ x: 0, z: -4.75, en: 1.6, boy: 1.5, genlik: 2.2, periyot: 6 }],
      lambalar: [[-1.6, -1.5], [1.6, -7.5]]
    },
    {
      no: 6, ad: 'Sultanahmet', sahne: 'sultanahmet', par: 3,
      alan: [[-1.5, -10, 1.5, 1]],
      tee: [0, 0], delik: [0, -9],
      kapilar: [{ x: 0, z: -5, L: 1.1, w: 1.1, faz: 0, direk: 0.12 }],
      lambalar: [[-2.1, -2.5], [2.1, -7.5]]
    },
    {
      no: 7, ad: 'Kapalıçarşı', sahne: 'kapalicarsi', par: 4, bakis: -Math.PI / 2,
      alan: [[-1, -6, 1, 1], [1, -6, 5, -4], [3, -12, 5, -6]],
      tee: [0, 0], delik: [4, -11],
      kutular: [
        { r: [-1, -2.2, -0.35, -1.9], y: 0.32, tur: 'kemer' }, { r: [0.35, -2.2, 1, -1.9], y: 0.32, tur: 'kemer' },
        { r: [1.9, -6, 2.2, -5.35], y: 0.32, tur: 'kemer' }, { r: [1.9, -4.65, 2.2, -4], y: 0.32, tur: 'kemer' },
        { r: [3, -9.15, 3.65, -8.85], y: 0.32, tur: 'kemer' }, { r: [4.35, -9.15, 5, -8.85], y: 0.32, tur: 'kemer' }
      ],
      lambalar: [[-1.6, -3], [2.5, -3.4], [5.6, -10]]
    },
    {
      no: 8, ad: 'Safranbolu', sahne: 'safranbolu', par: 3,
      alan: [[-2, -10, 2, 1]],
      tee: [0, 0], delik: [1.2, -9],
      kum: [[-2, -6, -0.5, -4]],
      tamponlar: [[0.3, -3, 1.6, -4.2], [-1.2, -7.4, 0.4, -8.1]],
      lambalar: [[-2.6, -1.5], [2.6, -7]]
    },
    {
      no: 9, ad: 'Nemrut', sahne: 'nemrut', par: 4,
      alan: [[-1.5, -6, 1.5, 1], [-3.5, -13, 3.5, -6]],
      tee: [0, 0], delik: [0.8, -12],
      rampalar: [{ eksen: 'z', a: -6, b: -7, dh: 0.35 }],
      daireler: [[-1.8, -8.2, 0.5, 'bas'], [1.6, -9.3, 0.5, 'bas'], [-0.5, -10.7, 0.45, 'bas']],
      kum: [[-3.5, -13, -2, -11.5]],
      lambalar: [[-2.1, -2], [4.1, -9], [-4.1, -11]]
    }
  ];

  var GolfParkur = { DELIKLER: DELIKLER };
  if (typeof module !== 'undefined' && module.exports) module.exports = GolfParkur;
  else kok.GolfParkur = GolfParkur;
})(this);
