// Sudoku bulmaca üreticisi için Web Worker: üretim arayüz iş parçacığını kilitlemez.
// Gelen: { no, tohum, seviye } ya da { no, gun } (günün bulmacası)  Giden: { no, bulmaca, cozum, seviye } (81 rakamlık metinler)
importScripts('mantik.js');

self.onmessage = function (olay) {
  var istek = olay.data, M = self.SudokuMantik;
  var sonuc = istek.gun ? M.gunlukUret(istek.gun) : M.uret(istek.tohum, istek.seviye);
  self.postMessage({ no: istek.no, bulmaca: sonuc.bulmaca.join(''), cozum: sonuc.cozum.join(''), seviye: sonuc.seviye });
};
