'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../games/gunun-kelimesi/mantik.js');
const { CEVAPLAR, GECERLI } = require('../games/gunun-kelimesi/kelimeler.js');

const TURKCE = /^[ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ]{5}$/u;

test('kelime listeleri beş harfli, Türkçe alfabeyle, tekrarsız ve cevaplar geçerli listede', () => {
  assert.ok(CEVAPLAR.length >= 300, 'en az 300 cevap olmalı');
  for (const k of GECERLI) assert.match(k, TURKCE);
  assert.equal(new Set(CEVAPLAR).size, CEVAPLAR.length);
  assert.equal(new Set(GECERLI).size, GECERLI.length);
  const gecerli = new Set(GECERLI);
  for (const k of CEVAPLAR) assert.ok(gecerli.has(k), `${k} geçerli listede yok`);
});

test('I/ı ve İ/i dönüşümleri Türkçe kurallarla yapılır', () => {
  assert.equal(M.buyut('ıi'), 'Iİ');
  assert.equal(M.buyut('kılıç'), 'KILIÇ');
  assert.equal(M.buyut('dikiş'), 'DİKİŞ');
  assert.equal(M.buyut('çiğköfte'), 'ÇİĞKÖFTE');
  // I ile İ farklı harflerdir
  assert.deepEqual(M.renklendir('ıııı', 'İİİİ'), ['yok', 'yok', 'yok', 'yok']);
  assert.deepEqual(M.renklendir('kilim', 'KİLİM'), ['dogru', 'dogru', 'dogru', 'dogru', 'dogru']);
});

test('ipucu renkleri doğru hesaplanır', () => {
  assert.deepEqual(M.renklendir('KALEM', 'KALEM'), ['dogru', 'dogru', 'dogru', 'dogru', 'dogru']);
  assert.deepEqual(M.renklendir('MELEK', 'KALEM'), ['var', 'yok', 'dogru', 'dogru', 'var']);
  assert.deepEqual(M.renklendir('SOĞAN', 'KALEM'), ['yok', 'yok', 'yok', 'var', 'yok']);
});

test('tekrarlanan harflerde cevaptaki adet kadar işaretlenir', () => {
  // ARABA'da üç A var; AAAAA'nın yalnızca doğru yerdekileri yeşil, kalanı gri olur
  assert.deepEqual(M.renklendir('AAAAA', 'ARABA'), ['dogru', 'yok', 'dogru', 'yok', 'dogru']);
  // Cevapta tek L var: ilk L sarı olur, ikinci L gri kalır
  assert.deepEqual(M.renklendir('LLAMA', 'KALEM'), ['var', 'yok', 'var', 'var', 'yok']);
  // Doğru yerdeki harf önce sayılır: KALEM'deki tek M yeşile gidince öndeki M'ler gri kalır
  assert.deepEqual(M.renklendir('MAMAM', 'KALEM'), ['yok', 'dogru', 'yok', 'yok', 'dogru']);
});

test('aynı gün herkes aynı kelimeyi görür, ertesi gün kelime değişir', () => {
  const sabah = new Date(2026, 10, 3, 0, 5);
  const gece = new Date(2026, 10, 3, 23, 55);
  const ertesi = new Date(2026, 10, 4, 0, 1);
  assert.equal(M.gununKelimesi(CEVAPLAR, sabah), M.gununKelimesi(CEVAPLAR, gece));
  assert.notEqual(M.gununKelimesi(CEVAPLAR, gece), M.gununKelimesi(CEVAPLAR, ertesi));
  assert.equal(M.bulmacaNo(new Date(2026, 9, 20, 12)), 1);
  assert.equal(M.bulmacaNo(new Date(2026, 9, 21, 0, 0)), 2);
  // Yaz saati değişimi (Mart sonu) gün sayımını kaydırmaz
  assert.equal(M.bulmacaNo(new Date(2027, 2, 29)) - M.bulmacaNo(new Date(2027, 2, 27)), 2);
});

test('istatistik: seri ardışık günlerde artar, kayıpta sıfırlanır, aynı gün iki kez sayılmaz', () => {
  let ist = M.yeniIstatistik();
  ist = M.istatistikIsle(ist, 1, true, 3);
  ist = M.istatistikIsle(ist, 2, true, 4);
  assert.equal(ist.seri, 2);
  ist = M.istatistikIsle(ist, 2, true, 4);
  assert.equal(ist.oynanan, 2);
  ist = M.istatistikIsle(ist, 3, false, 6);
  assert.equal(ist.seri, 0);
  ist = M.istatistikIsle(ist, 5, true, 1);
  assert.equal(ist.seri, 1);
  assert.equal(ist.enIyiSeri, 2);
  assert.deepEqual(ist.dagilim, [1, 0, 1, 1, 0, 0]);
  assert.equal(ist.kazanilan, 3);
});

test('paylaşım metni emoji ızgarası içerir ve cevabı açık etmez', () => {
  const metin = M.paylasimMetni(7, ['MELEK', 'KALEM'], 'KALEM', true);
  assert.equal(metin, 'Günün Kelimesi #7 2/6\n\n🟨⬛🟩🟩🟨\n🟩🟩🟩🟩🟩');
  assert.ok(!metin.includes('KALEM'));
});
