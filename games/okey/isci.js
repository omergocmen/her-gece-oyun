// Okey bilgisayar rakipleri için Web Worker: hamle araması arayüz iş parçacığını kilitlemez.
// Gelen: { no, tur: 'al' | 'at', gorunum, ayar, seviye, stil, tohum }  Giden: { no, sonuc }
importScripts('mantik.js');

self.onmessage = function (olay) {
  var i = olay.data, M = self.OkeyMantik, sonuc;
  if (i.tur === 'al') sonuc = M.yzAl(i.gorunum, i.ayar, i.seviye, i.stil, i.tohum);
  else sonuc = M.yzAt(i.gorunum, i.ayar, i.seviye, i.stil, i.tohum);
  self.postMessage({ no: i.no, sonuc: sonuc });
};
