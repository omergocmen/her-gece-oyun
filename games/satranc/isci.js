// Satranç yapay zekâsı için Web Worker: hamle araması arayüz iş parçacığını kilitlemez.
// Gelen: { no, baslangic (FEN), hamleler (['e2e4', …]), seviye }  Giden: { no, hamle ('e7e5' ya da null) }
importScripts('motor.js');

self.onmessage = function (olay) {
  var istek = olay.data, M = self.SatrancMotor, hamle = null;
  try {
    var oyun = new M.Oyun(istek.baslangic);
    for (var i = 0; i < istek.hamleler.length; i++) oyun.yap(M.hamleBul(oyun.konum, istek.hamleler[i]));
    hamle = M.bilgisayarHamlesi(oyun, istek.seviye, Math.random);
  } catch (e) { hamle = null; }
  self.postMessage({ no: istek.no, hamle: hamle });
};
