// Tavla yapay zekâsı için Web Worker: hamle araması arayüz iş parçacığını kilitlemez.
// Gelen: { no, t, p, zarlar, seviye }  Giden: { no, adimlar } (hamle yoksa boş liste).
importScripts('mantik.js');

self.onmessage = function (olay) {
  var istek = olay.data;
  var hamle = self.TavlaMantik.yapayZekaHamlesi(istek.t, istek.p, istek.zarlar, istek.seviye, Math.random);
  self.postMessage({ no: istek.no, adimlar: hamle ? hamle.adimlar : [] });
};
