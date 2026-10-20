// Marmaray Koşusu: kısa, yumuşak sentez sesler ve hafif müzik döngüsü (WebAudio); ses dosyası yok, hepsi çevrimdışı.
// İlk dokunuşta açılır (tarayıcılar kullanıcı hareketi ister); kapalıyken hiçbir şey çalmaz.
export function sesOlustur(acik) {
  let ctx = null, ana = null, muzikKanal = null, gurultu = null;
  let muzikAcik = false, sonrakiVurus = 0, vurus = 0, rayZamani = 0;

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
    muzikKanal = ctx.createGain();
    muzikKanal.gain.value = 0;
    muzikKanal.connect(ana);
    gurultu = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const v = gurultu.getChannelData(0);
    for (let i = 0; i < v.length; i++) v[i] = Math.random() * 2 - 1;
  }

  function hazirMi() { return acik && ctx && ctx.state === 'running'; }

  function ton(tur, f0, f1, sure, ses, gecikme, filtre, hedef, zaman) {
    if (!hazirMi()) return;
    const t = zaman != null ? zaman : ctx.currentTime + (gecikme || 0);
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
    son.connect(hedef || ana);
    o.start(t);
    o.stop(t + sure + 0.05);
  }

  function hisirti(sure, ses, frekans, tip, gecikme, bitis, hedef, zaman) {
    if (!hazirMi()) return;
    const t = zaman != null ? zaman : ctx.currentTime + (gecikme || 0);
    const k = ctx.createBufferSource();
    k.buffer = gurultu;
    const f = ctx.createBiquadFilter();
    f.type = tip || 'lowpass';
    f.Q.value = tip === 'bandpass' ? 6 : 0.7;
    f.frequency.setValueAtTime(frekans, t);
    f.frequency.exponentialRampToValueAtTime(bitis || Math.max(80, frekans / 4), t + sure);
    const g = ctx.createGain();
    g.gain.setValueAtTime(ses, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    k.connect(f); f.connect(g); g.connect(hedef || ana);
    k.start(t, Math.random() * 0.5);
    k.stop(t + sure + 0.05);
  }

  // Müzik: Hicaz'a göz kırpan dört ölçülük yumuşak bas + arpej (100 vuruş/dk). Önceden planlanır, kare hızından bağımsız.
  const BAS = [146.8, 146.8, 155.6, 146.8, 130.8, 130.8, 146.8, 110];
  const ARPEJ = [293.7, 370, 440, 370, 311.1, 370, 440, 523.3, 261.6, 329.6, 392, 329.6, 293.7, 370, 440, 587.3];
  const VURUS = 60 / 100 / 2; // sekizlik
  function muzikPlanla() {
    if (!muzikAcik || !hazirMi()) return;
    const simdi = ctx.currentTime;
    if (sonrakiVurus < simdi) sonrakiVurus = simdi + 0.05;
    while (sonrakiVurus < simdi + 0.25) {
      const i = vurus % 16;
      if (i % 4 === 0) ton('triangle', BAS[(vurus >> 2) % 8], BAS[(vurus >> 2) % 8], VURUS * 3.6, 0.09, 0, 600, muzikKanal, sonrakiVurus);
      ton('sine', ARPEJ[i], ARPEJ[i], VURUS * 0.9, i % 2 ? 0.025 : 0.04, 0, 2400, muzikKanal, sonrakiVurus);
      if (i % 4 === 2) hisirti(0.05, 0.05, 6000, 'highpass', 0, 4000, muzikKanal, sonrakiVurus);
      sonrakiVurus += VURUS;
      vurus++;
    }
  }

  return {
    hazirla,
    acikMi: () => acik,
    ayarla(deger) { acik = deger; if (acik) hazirla(); },
    duraklat() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    surdur() { if (ctx && ctx.state === 'suspended' && acik) ctx.resume(); },
    muzik(acilsin) {
      muzikAcik = acilsin;
      if (!ctx) return;
      const t = ctx.currentTime;
      muzikKanal.gain.cancelScheduledValues(t);
      muzikKanal.gain.setTargetAtTime(acilsin ? 1 : 0, t, acilsin ? 0.6 : 0.15);
      if (acilsin) { vurus = 0; sonrakiVurus = 0; }
    },
    // Her karede çağrılır: müziği planlar ve hıza göre ray takırtısı çalar.
    kare(dt, hiz) {
      muzikPlanla();
      if (!hiz) return;
      rayZamani += dt * hiz;
      if (rayZamani > 15) { // her ray ekinde iki takırtı
        rayZamani = 0;
        hisirti(0.04, 0.12, 1400, 'bandpass', 0, 900);
        hisirti(0.04, 0.1, 1200, 'bandpass', 0.09, 800);
      }
    },
    serit(yon) { hisirti(0.12, 0.16, yon > 0 ? 2600 : 2200, 'bandpass', 0, 900); },
    zipla() { ton('sine', 300, 720, 0.14, 0.11); hisirti(0.12, 0.08, 1800, 'bandpass', 0, 3000); },
    kay() { hisirti(0.3, 0.16, 900, 'lowpass', 0, 200); ton('sine', 260, 140, 0.18, 0.06); },
    inis() { ton('sine', 150, 70, 0.1, 0.12); },
    jeton(seri) {
      const f = 988 * Math.pow(2, Math.min(seri, 8) / 12);
      ton('sine', f, f, 0.08, 0.08); ton('sine', f * 1.5, f * 1.5, 0.14, 0.06, 0.05);
    },
    guc() { [523, 659, 784, 1047].forEach((f, i) => ton('triangle', f, f, 0.16, 0.08, i * 0.06)); },
    gucBitti() { ton('triangle', 660, 330, 0.25, 0.06); },
    yan() { ton('square', 120, 60, 0.18, 0.1, 0, 500); hisirti(0.15, 0.2, 1200); },
    korna() {
      // Gelen trenin iki tonlu düdüğü
      ton('sawtooth', 311, 305, 0.5, 0.05, 0, 1200);
      ton('sawtooth', 392, 385, 0.5, 0.04, 0, 1200);
    },
    fren() {
      // Tren freni: tiz metal çığlık + gürültü, ardından boğuk darbe
      ton('sawtooth', 2100, 1500, 0.9, 0.035, 0, 5000);
      ton('sawtooth', 2350, 1650, 0.8, 0.025, 0.02, 5000);
      hisirti(1.0, 0.18, 4200, 'bandpass', 0, 2200);
      ton('square', 110, 40, 0.35, 0.16, 0, 400);
      hisirti(0.35, 0.4, 1800);
    },
    rekor() { [660, 880, 1100, 1320].forEach((f, i) => ton('triangle', f, f, 0.22, 0.08, i * 0.1)); }
  };
}
