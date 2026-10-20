// Dama yapay zekâsı için Web Worker: hamle araması arayüz iş parçacığını kilitlemez.
// Gelen: { no, t (64 karakter konum), sira, sayac, seviye }  Giden: { no, hamle: { de, yol } ya da null }
importScripts('motor.js');

self.onmessage = function (olay) {
  var istek = olay.data, M = self.DamaMotor, hamle = null;
  try {
    var p = M.diziden(istek.t, istek.sira);
    p.sayac = istek.sayac || 0;
    var m = M.bilgisayarHamlesi(new M.Oyun(p), istek.seviye, Math.random);
    if (m) hamle = { de: m.de, yol: m.yol };
  } catch (e) { hamle = null; }
  self.postMessage({ no: istek.no, hamle: hamle });
};
