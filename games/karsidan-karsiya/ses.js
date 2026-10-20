// Kısa, yumuşak sentez sesler (WebAudio); ses dosyası yok, hepsi çevrimdışı.
// İlk dokunuşta açılır (tarayıcılar kullanıcı hareketi ister); kapalıyken hiçbir şey çalmaz.
export function sesOlustur(acik) {
  let ctx = null, ana = null, gurultu = null;

  function hazirla() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    ana = ctx.createGain();
    ana.gain.value = 0.5;
    const yumusat = ctx.createDynamicsCompressor();
    ana.connect(yumusat);
    yumusat.connect(ctx.destination);
    // Su ve çarpma için bir saniyelik beyaz gürültü tamponu.
    gurultu = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const v = gurultu.getChannelData(0);
    for (let i = 0; i < v.length; i++) v[i] = Math.random() * 2 - 1;
  }

  function hazirMi() { return acik && ctx && ctx.state === 'running'; }

  // Tek bir zarf içinde osilatör: frekans f0'dan f1'e kayar.
  function ton(tur, f0, f1, sure, ses, gecikme, filtre) {
    if (!hazirMi()) return;
    const t = ctx.currentTime + (gecikme || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tur;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + sure);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(ses, t + Math.min(0.02, sure / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    let son = g;
    if (filtre) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filtre;
      g.connect(f);
      son = f;
    }
    o.connect(g);
    son.connect(ana);
    o.start(t);
    o.stop(t + sure + 0.05);
  }

  function hisirti(sure, ses, frekans, tip, gecikme) {
    if (!hazirMi()) return;
    const t = ctx.currentTime + (gecikme || 0);
    const k = ctx.createBufferSource();
    k.buffer = gurultu;
    const f = ctx.createBiquadFilter();
    f.type = tip || 'lowpass';
    f.frequency.setValueAtTime(frekans, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(80, frekans / 4), t + sure);
    const g = ctx.createGain();
    g.gain.setValueAtTime(ses, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    k.connect(f); f.connect(g); g.connect(ana);
    k.start(t, Math.random() * 0.5);
    k.stop(t + sure + 0.05);
  }

  return {
    hazirla,
    acikMi: () => acik,
    ayarla(deger) { acik = deger; if (acik) hazirla(); },
    zipla() { ton('sine', 420 + Math.random() * 60, 760, 0.09, 0.12); },
    carpisma() { ton('triangle', 220, 160, 0.08, 0.1, 0, 900); },
    simit() { ton('sine', 880, 880, 0.09, 0.12); ton('sine', 1320, 1320, 0.16, 0.1, 0.07); },
    korna() {
      // İki ses yüksekliğinde boğuk korna
      ton('square', 392, 380, 0.22, 0.035, 0, 1100);
      ton('square', 494, 480, 0.22, 0.03, 0, 1100);
    },
    zil() {
      // Tramvay zili: iki kez "çın"
      for (const g of [0, 0.22]) { ton('sine', 1760, 1740, 0.35, 0.07, g); ton('sine', 2637, 2600, 0.25, 0.03, g); }
    },
    duduk() {
      // Vapur düdüğü: alçak, uzun, yumuşak
      ton('sawtooth', 146, 140, 1.1, 0.06, 0, 420);
      ton('sawtooth', 220, 214, 1.1, 0.035, 0, 420);
    },
    su() { hisirti(0.5, 0.35, 1800); ton('sine', 300, 90, 0.3, 0.1); },
    ezilme() { hisirti(0.25, 0.4, 2500); ton('square', 140, 50, 0.25, 0.12, 0, 600); },
    marti() { ton('sawtooth', 1200, 1800, 0.12, 0.04, 0, 2400); ton('sawtooth', 1700, 900, 0.3, 0.04, 0.12, 2400); },
    rekor() { [660, 880, 1100].forEach((f, i) => ton('triangle', f, f, 0.2, 0.08, i * 0.1)); }
  };
}
