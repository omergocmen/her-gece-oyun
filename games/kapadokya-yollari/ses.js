// WebAudio ile anında üretilen sesler: motor (vitese göre devir), rüzgâr, lastik kayması, arazi uğultusu,
// kontrol noktası çanı, geri sayım ve çarpma. Ses dosyası yoktur; tek dokunuşla kapanır.
export class Ses {
  constructor() {
    this.bag = null;
    this.acik = true;
  }

  // Tarayıcılar sesi ancak bir dokunuş/tuştan sonra başlatır.
  baslat() {
    if (this.bag) { if (this.bag.state === 'suspended') this.bag.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const b = this.bag = new AC();
    this.ana = b.createGain();
    this.ana.gain.value = this.acik ? 0.8 : 0;
    const sik = b.createDynamicsCompressor();
    this.ana.connect(sik).connect(b.destination);

    // Motor: testere + kare dalga, devirle açılan alçak geçiren süzgeç
    this.motorSuzgec = b.createBiquadFilter();
    this.motorSuzgec.type = 'lowpass';
    this.motorSuzgec.Q.value = 3;
    this.motorKazanc = b.createGain();
    this.motorKazanc.gain.value = 0;
    this.m1 = b.createOscillator(); this.m1.type = 'sawtooth';
    this.m2 = b.createOscillator(); this.m2.type = 'square';
    const m2k = b.createGain(); m2k.gain.value = 0.45;
    this.m1.connect(this.motorSuzgec);
    this.m2.connect(m2k).connect(this.motorSuzgec);
    this.motorSuzgec.connect(this.motorKazanc).connect(this.ana);
    this.m1.start(); this.m2.start();

    // Beyaz gürültü: rüzgâr, kayma ve arazi için ortak kaynak
    const uz = b.sampleRate * 2, tampon = b.createBuffer(1, uz, b.sampleRate), veri = tampon.getChannelData(0);
    for (let i = 0; i < uz; i++) veri[i] = Math.random() * 2 - 1;
    const kaynak = (tur, f, q) => {
      const k = b.createBufferSource(); k.buffer = tampon; k.loop = true;
      const s = b.createBiquadFilter(); s.type = tur; s.frequency.value = f; s.Q.value = q;
      const g = b.createGain(); g.gain.value = 0;
      k.connect(s).connect(g).connect(this.ana);
      k.start(0, Math.random() * 2);
      return { s, g };
    };
    this.ruzgar = kaynak('bandpass', 700, 0.6);
    this.kayma = kaynak('bandpass', 2300, 4);
    this.arazi = kaynak('lowpass', 260, 1);
  }

  sessiz(kapali) {
    this.acik = !kapali;
    if (this.ana) this.ana.gain.setTargetAtTime(this.acik ? 0.8 : 0, this.bag.currentTime, 0.05);
  }

  duraklat() { if (this.bag && this.bag.state === 'running') this.bag.suspend(); }
  devam() { if (this.bag && this.bag.state === 'suspended') this.bag.resume(); }

  // d: { devir, gaz, hiz (m/sn), kayma (m/sn), arazi 0..1, calisiyor }
  guncelle(d) {
    if (!this.bag) return;
    const t = this.bag.currentTime, z = 0.06;
    const f = d.devir / 60 * 2; // dört silindir: devir başına iki ateşleme
    this.m1.frequency.setTargetAtTime(f, t, 0.03);
    this.m2.frequency.setTargetAtTime(f * 0.5 * 1.01, t, 0.03);
    this.motorSuzgec.frequency.setTargetAtTime(380 + d.devir * 0.32 + d.gaz * 900, t, z);
    this.motorKazanc.gain.setTargetAtTime(d.calisiyor ? 0.05 + d.gaz * 0.07 + d.devir / 6800 * 0.04 : 0, t, z);
    const v = Math.min(1, d.hiz / 40);
    this.ruzgar.g.gain.setTargetAtTime(v * v * 0.22, t, 0.15);
    this.ruzgar.s.frequency.setTargetAtTime(500 + v * 900, t, 0.2);
    const kay = Math.max(0, Math.min(1, (d.kayma - 3) / 9)) * Math.min(1, d.hiz / 8) * (1 - d.arazi);
    this.kayma.g.gain.setTargetAtTime(kay * 0.12, t, 0.05);
    this.arazi.g.gain.setTargetAtTime(d.arazi * Math.min(1, d.hiz / 15) * 0.5, t, 0.08);
  }

  _ton(frekans, sure, tur, guc, gecikme) {
    if (!this.bag) return;
    const b = this.bag, t = b.currentTime + (gecikme || 0);
    const o = b.createOscillator(), g = b.createGain();
    o.type = tur || 'sine'; o.frequency.value = frekans;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(guc || 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t + sure);
    o.connect(g).connect(this.ana);
    o.start(t); o.stop(t + sure + 0.05);
  }

  bip(son) { this._ton(son ? 880 : 440, son ? 0.6 : 0.25, 'triangle', 0.22); }
  can() { this._ton(1046, 0.7, 'sine', 0.18); this._ton(1568, 0.9, 'sine', 0.1, 0.06); }
  bitis(rekor) {
    [523, 659, 784, rekor ? 1046 : 784].forEach((f, i) => this._ton(f, 0.8, 'triangle', 0.15, i * 0.12));
  }
  carpma(siddet) {
    if (!this.bag) return;
    const b = this.bag, t = b.currentTime;
    const o = b.createOscillator(), g = b.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    g.gain.setValueAtTime(Math.min(0.5, 0.1 + siddet * 0.03), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.ana);
    o.start(t); o.stop(t + 0.35);
  }
}
