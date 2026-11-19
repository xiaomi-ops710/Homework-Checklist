/*
 * 元素インベーダー BGM（games/invader.html の SoundSystem から抽出）
 *
 *   window.KOSA_BGM.invader = { title, tracks, create(ctx, dest) }
 *   player = create(ctx, dest): play(i) / stop() / setVolume(v) / index / analyser
 *
 * 抽出元: startBgm / stopBgm / playBgmStep と、そこで鳴る楽器・ステレオ・ホールリバーブ・
 * ピンポンディレイ・マスタリング経路（低域シェルフ・高域シェルフ・コンプレッサー）。
 * 効果音(SFX)は含まない。パターン値とテンポはゲームのコードからコピーした。
 * ゲーム側のテンポ変化（速さ設定・残り20秒の減速）と一時停止・ゲームオーバーは含まない。
 */
(function (global) {
  'use strict';

  var MAX_VOICES = 48;      // 同時に鳴る発音体(source)の上限。超えた音符は捨てる
  var FADE_SEC = 0.3;       // stop() のフェードアウト時間
  var STEPS = 128;          // ゲームと同じ 128 ステップでループ
  var DEFAULT_VOLUME = 0.9; // ゲームの masterGain.gain の既定値
  // ゲームは masterGain(0.9) をコンプレッサーの前に置いていた。こちらは前段を 1.0 にして
  // 閾値を 0.9 倍(約 -0.92dB)ぶん上げ、出力側で 0.9 を掛けると同じ結果になる。
  var COMP_THRESHOLD = -16 - 20 * Math.log10(0.9);

  // select の並び順（1, 2, 3）。key はゲーム内の bgmTrack の値、tempo は 1 ステップの ms
  var TRACKS = [
    { key: 'cyber', name: '1. COSMIC AURORA (立体美旋律)', tempo: 114 },
    { key: 'galactic', name: '2. STELLAR SYMPHONY (幻想交響)', tempo: 118 },
    { key: 'overdrive', name: '3. QUANTUM HORIZON (疾走重低音)', tempo: 108 }
  ];

  // ゲーム本体 playBgmStep 内の tracks オブジェクトをそのままコピー
  var PATTERNS = {
    cyber: {
        // 1. COSMIC AURORA: 透明感あふれる美旋律と深い重低音 (Fmaj7 -> G6 -> Em7 -> Am9)
        subRoot: [43.65, 49.00, 41.20, 55.00], // F1, G1, E1, A1
        bass: [
            87.31, 87.31, 174.61, 87.31, 87.31, 174.61, 164.81, 174.61,
            98.00, 98.00, 196.00, 98.00, 98.00, 196.00, 174.61, 196.00,
            82.41, 82.41, 164.81, 82.41, 82.41, 164.81, 196.00, 164.81,
            110.00, 110.00, 220.00, 110.00, 98.00, 196.00, 87.31, 174.61
        ],
        chords: [
            [174.61, 220.00, 261.63, 329.63, 392.00], // Fmaj9
            [196.00, 246.94, 293.66, 329.63, 392.00], // G6(add11)
            [164.81, 246.94, 293.66, 329.63, 392.00], // Em7
            [220.00, 261.63, 329.63, 392.00, 493.88]  // Am9
        ],
        leadVerse: [
            523.25, 0, 659.25, 783.99, 880.00, 0, 783.99, 659.25,
            783.99, 0, 659.25, 587.33, 523.25, 0, 587.33, 659.25,
            659.25, 0, 783.99, 987.77, 1046.50, 0, 987.77, 783.99,
            880.00, 783.99, 659.25, 587.33, 523.25, 0, 659.25, 587.33
        ],
        leadDrop: [
            1046.50, 0, 987.77, 880.00, 783.99, 880.00, 1046.50, 1318.51,
            1174.66, 0, 1046.50, 987.77, 783.99, 880.00, 987.77, 1174.66,
            1318.51, 0, 1174.66, 1046.50, 987.77, 1046.50, 1318.51, 1567.98,
            1318.51, 1174.66, 1046.50, 987.77, 880.00, 783.99, 659.25, 783.99
        ],
        arp: [523.25, 659.25, 783.99, 987.77, 1046.50, 1318.51, 1046.50, 783.99]
    },
    galactic: {
        // 2. STELLAR SYMPHONY: 壮麗な宇宙オーケストラ＆重低音 (Cm9 -> Abmaj7 -> Eb -> G7)
        subRoot: [32.70, 51.91, 38.89, 49.00],
        bass: [
            65.41, 130.81, 65.41, 130.81, 65.41, 130.81, 155.56, 130.81,
            51.91, 103.83, 51.91, 103.83, 51.91, 103.83, 130.81, 103.83,
            77.78, 155.56, 77.78, 155.56, 77.78, 155.56, 130.81, 155.56,
            49.00, 98.00,  49.00, 98.00,  61.74, 123.47, 73.42,  146.83
        ],
        chords: [
            [130.81, 155.56, 196.00, 233.08, 293.66], // Cm9
            [103.83, 155.56, 196.00, 233.08, 311.13], // Abmaj9
            [155.56, 196.00, 233.08, 293.66, 392.00], // Ebmaj7
            [98.00,  146.83, 174.61, 246.94, 293.66]  // G7
        ],
        leadVerse: [
            523.25, 0, 622.25, 783.99, 932.33, 0, 783.99, 622.25,
            830.61, 0, 783.99, 698.46, 622.25, 0, 523.25, 622.25,
            698.46, 0, 783.99, 932.33, 1046.50, 0, 932.33, 783.99,
            783.99, 739.99, 783.99, 987.77, 783.99, 0, 622.25, 587.33
        ],
        leadDrop: [
            1046.50, 783.99, 622.25, 1046.50, 1244.51, 1174.66, 1046.50, 932.33,
            830.61, 622.25, 523.25, 830.61, 1046.50, 932.33, 783.99, 698.46,
            783.99, 932.33, 1174.66, 1567.98, 1396.91, 1244.51, 1174.66, 1046.50,
            987.77, 1174.66, 1396.91, 1567.98, 1479.98, 1396.91, 1174.66, 987.77
        ],
        arp: [523.25, 622.25, 783.99, 932.33, 1046.50, 1244.51, 1046.50, 783.99]
    },
    overdrive: {
        // 3. QUANTUM HORIZON: 疾走感と高揚感あふれる王道シューティング・トランス (F#m7 -> Dmaj7 -> E -> C#m7)
        subRoot: [46.25, 36.71, 41.20, 34.65],
        bass: [
            92.50, 185.00, 92.50, 185.00, 92.50, 185.00, 164.81, 185.00,
            73.42, 146.83, 73.42, 146.83, 73.42, 146.83, 164.81, 146.83,
            82.41, 164.81, 82.41, 164.81, 82.41, 164.81, 185.00, 164.81,
            69.30, 138.59, 69.30, 138.59, 82.41, 164.81, 92.50,  185.00
        ],
        chords: [
            [185.00, 220.00, 277.18, 329.63, 369.99], // F#m7
            [146.83, 185.00, 220.00, 277.18, 329.63], // Dmaj9
            [164.81, 207.65, 246.94, 329.63, 369.99], // E6
            [138.59, 164.81, 207.65, 246.94, 329.63]  // C#m7
        ],
        leadVerse: [
            739.99, 0, 880.00, 987.77, 1108.73, 0, 987.77, 880.00,
            987.77, 0, 880.00, 739.99, 659.25, 0, 554.37, 659.25,
            739.99, 0, 880.00, 1108.73, 1318.51, 0, 1108.73, 987.77,
            1108.73, 987.77, 880.00, 739.99, 659.25, 0, 554.37, 659.25
        ],
        leadDrop: [
            1108.73, 0, 1318.51, 1479.98, 1661.22, 1479.98, 1318.51, 1108.73,
            1174.66, 0, 1108.73, 987.77, 880.00, 987.77, 1108.73, 1318.51,
            1479.98, 0, 1318.51, 1108.73, 1318.51, 1479.98, 1661.22, 1760.00,
            1661.22, 1479.98, 1318.51, 1108.73, 987.77, 880.00, 739.99, 880.00
        ],
        arp: [739.99, 880.00, 1108.73, 1318.51, 1479.98, 1318.51, 1108.73, 880.00]
    }
  };

  function safe(fn) {
    try { fn(); } catch (e) { /* ignore: node already gone or ctx closed */ }
  }

  function disc(node) {
    if (node) safe(function () { node.disconnect(); });
  }

  function stopNode(node) {
    if (node && typeof node.stop === 'function') safe(function () { node.stop(); });
  }

  function clamp01(v) {
    v = Number(v);
    if (!(v >= 0)) return 0;
    return v > 1 ? 1 : v;
  }

  // ステレオ・インパルス応答（宇宙空間ホール残響）
  function createStereoReverbBuffer(ctx, duration, decay) {
    var rate = ctx.sampleRate;
    var length = Math.floor(rate * duration);
    var impulse = ctx.createBuffer(2, length, rate);
    var left = impulse.getChannelData(0);
    var right = impulse.getChannelData(1);
    for (var i = 0; i < length; i++) {
      var env = Math.pow(1 - i / length, decay);
      left[i] = (Math.random() * 2 - 1) * env;
      right[i] = (Math.random() * 2 - 1) * env;
    }
    return impulse;
  }

  function createNoiseBuffer(ctx) {
    var size = Math.floor(ctx.sampleRate * 1.5);
    var buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    var out = buffer.getChannelData(0);
    for (var i = 0; i < size; i++) out[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function createPlayer(ctx, dest) {
    var analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.78;

    var volume = DEFAULT_VOLUME;
    var index = -1;
    var step = 0;
    var timer = null;
    var fadeTimer = null;
    var chain = null;    // 出力経路のノード群（play 時に作り、stop 後の teardown で捨てる）
    var noise = null;
    var impulse = null;
    var groups = [];     // 発音中の音符。{ end, n, nodes } 。end を過ぎたら切断する
    var liveCount = 0;   // 発音体(source)の数の合計

    function clearTick() {
      if (timer) { clearTimeout(timer); timer = null; }
    }

    function clearFade() {
      if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
    }

    // 音符を 1 つ開く。上限を超えるならそのまま null を返し、呼び出し側は鳴らさない
    function openNote(endTime, sources) {
      if (liveCount + sources > MAX_VOICES) return null;
      var g = { end: endTime, n: sources, nodes: [] };
      groups.push(g);
      liveCount += sources;
      return g;
    }

    function own(g, node) {
      g.nodes.push(node);
      return node;
    }

    // end を過ぎた音符のノードを切断して数を戻す
    function sweep(t) {
      var keep = [];
      for (var i = 0; i < groups.length; i++) {
        var g = groups[i];
        if (g.end + 0.05 < t) {
          g.nodes.forEach(disc);
          liveCount -= g.n;
        } else {
          keep.push(g);
        }
      }
      groups = keep;
    }

    function releaseAll() {
      groups.forEach(function (g) {
        g.nodes.forEach(function (n) { stopNode(n); disc(n); });
      });
      groups = [];
      liveCount = 0;
    }

    function impulseBuffer() {
      if (!impulse) impulse = createStereoReverbBuffer(ctx, 2.4, 2.8);
      return impulse;
    }

    // 3D 定位用のステレオパン。ゲームと同じく head へ送る
    function makePanner(g, panVal) {
      var p;
      if (ctx.createStereoPanner) {
        p = own(g, ctx.createStereoPanner());
        p.pan.setValueAtTime(Math.max(-1, Math.min(1, panVal)), ctx.currentTime);
      } else {
        p = own(g, ctx.createGain());
      }
      p.connect(chain.head);
      return p;
    }

    // 出力経路: head -> 低域シェルフ -> 高域シェルフ -> コンプレッサー -> out -> analyser -> dest
    // リバーブとディレイの戻りは高域シェルフ手前に合流（ゲームと同じ）
    function buildChain() {
      var t = ctx.currentTime;
      var c = {};

      c.head = ctx.createGain();
      c.head.gain.setValueAtTime(1.0, t);

      c.sub = ctx.createBiquadFilter();
      c.sub.type = 'lowshelf';
      c.sub.frequency.setValueAtTime(85, t);
      c.sub.gain.setValueAtTime(6.5, t);

      c.high = ctx.createBiquadFilter();
      c.high.type = 'highshelf';
      c.high.frequency.setValueAtTime(6000, t);
      c.high.gain.setValueAtTime(4.0, t);

      c.comp = ctx.createDynamicsCompressor();
      c.comp.threshold.setValueAtTime(COMP_THRESHOLD, t);
      c.comp.knee.setValueAtTime(12, t);
      c.comp.ratio.setValueAtTime(6, t);
      c.comp.attack.setValueAtTime(0.005, t);
      c.comp.release.setValueAtTime(0.18, t);

      c.out = ctx.createGain();
      c.out.gain.setValueAtTime(volume, t);

      c.conv = ctx.createConvolver();
      c.conv.buffer = impulseBuffer();
      c.revGain = ctx.createGain();
      c.revGain.gain.setValueAtTime(0.34, t);

      c.dL = ctx.createDelay(1.0);
      c.dR = ctx.createDelay(1.0);
      c.dL.delayTime.setValueAtTime(0.24, t);
      c.dR.delayTime.setValueAtTime(0.36, t);
      c.fbL = ctx.createGain();
      c.fbR = ctx.createGain();
      c.fbL.gain.setValueAtTime(0.32, t);
      c.fbR.gain.setValueAtTime(0.32, t);
      c.dFilter = ctx.createBiquadFilter();
      c.dFilter.type = 'bandpass';
      c.dFilter.frequency.setValueAtTime(2200, t);
      c.dFilter.Q.setValueAtTime(0.7, t);

      if (ctx.createStereoPanner) {
        c.panL = ctx.createStereoPanner();
        c.panR = ctx.createStereoPanner();
        c.panL.pan.setValueAtTime(-0.78, t);
        c.panR.pan.setValueAtTime(0.78, t);
      }

      c.head.connect(c.sub);
      c.sub.connect(c.high);
      c.high.connect(c.comp);
      c.comp.connect(c.out);
      c.out.connect(analyser);
      analyser.connect(dest);

      c.conv.connect(c.revGain);
      c.revGain.connect(c.high);

      if (c.panL) {
        c.dL.connect(c.panL);
        c.dR.connect(c.panR);
        c.panL.connect(c.dFilter);
        c.panR.connect(c.dFilter);
      } else {
        c.dL.connect(c.dFilter);
        c.dR.connect(c.dFilter);
      }
      c.dL.connect(c.fbL);
      c.fbL.connect(c.dR);
      c.dR.connect(c.fbR);
      c.fbR.connect(c.dL);
      c.dFilter.connect(c.high);

      chain = c;
    }

    function ensureChain() {
      if (!noise) noise = createNoiseBuffer(ctx);
      if (!chain) buildChain();
    }

    // 出力経路と発音中の音をすべて切断して捨てる
    function teardown() {
      clearFade();
      releaseAll();
      if (chain) {
        Object.keys(chain).forEach(function (k) { disc(chain[k]); });
        chain = null;
      }
      disc(analyser);
    }

    // ゲーム playBgmStep の本体。now・dest・ノード接続はそのまま
    function playStep(st) {
      var now = ctx.currentTime;
      var s32 = st % 32;
      var isDrop = st >= 64;               // ゲームの section === 'DROP'
      var cur = PATTERNS[TRACKS[index].key];
      var barIdx = Math.floor(s32 / 8) % 4;
      var isFillBar = (st >= 56 && st < 64) || (st >= 120);
      var head = chain.head;

      // 1. ウォーム＆ディープ・サブキック
      if ((s32 % 4 === 0) || (isDrop && s32 === 30)) {
        var kg = openNote(now + 0.35, 1);
        if (kg) {
          var kickOsc = own(kg, ctx.createOscillator());
          var kickGain = own(kg, ctx.createGain());
          kickOsc.type = 'sine';
          kickOsc.frequency.setValueAtTime(175, now);
          kickOsc.frequency.exponentialRampToValueAtTime(46, now + 0.055);
          kickOsc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
          kickGain.gain.setValueAtTime(0.62, now);
          kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
          kickOsc.connect(kickGain);
          kickGain.connect(head);
          kickOsc.start(now);
          kickOsc.stop(now + 0.35);
        }
      }

      // 2. リムスネア＋クラップ、3. シルキーハイハット
      var isSnareHit = (s32 % 8 === 4) || (isFillBar && st % 2 === 1);
      if (isSnareHit) {
        var sg = openNote(now + 0.22, 2);
        if (sg) {
          var nSrc = own(sg, ctx.createBufferSource());
          nSrc.buffer = noise;
          var nFilter = own(sg, ctx.createBiquadFilter());
          nFilter.type = 'bandpass';
          nFilter.frequency.setValueAtTime(2400, now);
          var nGain = own(sg, ctx.createGain());
          nGain.gain.setValueAtTime(isFillBar ? 0.09 : 0.14, now);
          nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
          nSrc.connect(nFilter);
          nFilter.connect(nGain);
          nGain.connect(head);
          if (chain.conv) nGain.connect(chain.conv);
          nSrc.start(now);
          nSrc.stop(now + 0.17);

          var cl = own(sg, ctx.createBufferSource());
          cl.buffer = noise;
          var cf = own(sg, ctx.createBiquadFilter());
          cf.type = 'bandpass';
          cf.frequency.setValueAtTime(1150, now);
          cf.Q.setValueAtTime(0.9, now);
          var cg = own(sg, ctx.createGain());
          cg.gain.setValueAtTime(0.0001, now);
          cg.gain.linearRampToValueAtTime(0.11, now + 0.006);
          cg.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          cl.connect(cf);
          cf.connect(cg);
          cg.connect(head);
          cl.start(now);
          cl.stop(now + 0.21);
        }
      }

      var isOpenHat = s32 % 4 === 2;
      var hatDur = isOpenHat ? 0.085 : 0.028;
      var hg = openNote(now + hatDur + 0.02, 1);
      if (hg) {
        var hh = own(hg, ctx.createBufferSource());
        hh.buffer = noise;
        var hFilter = own(hg, ctx.createBiquadFilter());
        hFilter.type = 'highpass';
        hFilter.frequency.setValueAtTime(8500, now);
        var hGain = own(hg, ctx.createGain());
        hGain.gain.setValueAtTime(isOpenHat ? 0.038 : 0.018, now);
        hGain.gain.exponentialRampToValueAtTime(0.001, now + hatDur);
        var hhPan = makePanner(hg, Math.sin(st * 0.5) * 0.45);
        hh.connect(hFilter);
        hFilter.connect(hGain);
        hGain.connect(hhPan);
        hh.start(now);
        hh.stop(now + hatDur + 0.01);
      }

      // 4. サブベース（サイン）
      if (s32 % 4 !== 0) {
        var subFreq = cur.subRoot[barIdx];
        if (subFreq) {
          var subG = openNote(now + 0.25, 1);
          if (subG) {
            var subSine = own(subG, ctx.createOscillator());
            var subGain = own(subG, ctx.createGain());
            subSine.type = 'sine';
            subSine.frequency.setValueAtTime(subFreq * 1.9, now);
            subSine.frequency.exponentialRampToValueAtTime(subFreq, now + 0.07);
            subGain.gain.setValueAtTime(isDrop ? 0.34 : 0.26, now);
            subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);
            subSine.connect(subGain);
            subGain.connect(head);
            subSine.start(now);
            subSine.stop(now + 0.25);
          }
        }
      }

      // 5. ベース（少しずらした2本のノコギリ波＋1オクターブ下のサイン）
      var bFreq = cur.bass[s32];
      if (bFreq > 0) {
        var bg = openNote(now + 0.23, 3);
        if (bg) {
          [-11, 11].forEach(function (det) {
            var bOsc = own(bg, ctx.createOscillator());
            var bFilter = own(bg, ctx.createBiquadFilter());
            var bGain = own(bg, ctx.createGain());
            bOsc.type = 'sawtooth';
            bOsc.frequency.setValueAtTime(bFreq, now);
            bOsc.detune.setValueAtTime(det, now);
            bFilter.type = 'lowpass';
            bFilter.Q.setValueAtTime(7, now);
            bFilter.frequency.setValueAtTime(isDrop ? 1500 : 1000, now);
            bFilter.frequency.exponentialRampToValueAtTime(110, now + 0.2);
            bGain.gain.setValueAtTime(0.075, now);
            bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            bOsc.connect(bFilter);
            bFilter.connect(bGain);
            bGain.connect(head);
            bOsc.start(now);
            bOsc.stop(now + 0.23);
          });
          var low = own(bg, ctx.createOscillator());
          var lowG = own(bg, ctx.createGain());
          low.type = 'sine';
          low.frequency.setValueAtTime(bFreq / 2, now);
          lowG.gain.setValueAtTime(0.12, now);
          lowG.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          low.connect(lowG);
          lowG.connect(head);
          low.start(now);
          low.stop(now + 0.19);
        }
      }

      // 6. ワイドステレオ・パッド和音
      if (s32 % 8 === 0 || (isDrop && s32 % 4 === 2)) {
        var chord = cur.chords[barIdx];
        var cDur = s32 % 8 === 0 ? 0.72 : 0.28;
        var chg = openNote(now + cDur + 0.03, chord.length);
        if (chg) {
          chord.forEach(function (cFreq, idx) {
            var panPos = ((idx / (chord.length - 1)) * 2 - 1) * 0.85;
            var panNode = makePanner(chg, panPos);
            var cOsc = own(chg, ctx.createOscillator());
            var cFilter = own(chg, ctx.createBiquadFilter());
            var cGain = own(chg, ctx.createGain());
            cOsc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
            cOsc.frequency.setValueAtTime(cFreq, now);
            cOsc.detune.setValueAtTime((idx - 2) * 7, now);
            cFilter.type = 'lowpass';
            cFilter.frequency.setValueAtTime(isDrop ? 2800 : 1800, now);
            cGain.gain.setValueAtTime(0.001, now);
            cGain.gain.linearRampToValueAtTime(isDrop ? 0.026 : 0.020, now + 0.06);
            cGain.gain.exponentialRampToValueAtTime(0.001, now + cDur);
            cOsc.connect(cFilter);
            cFilter.connect(cGain);
            cGain.connect(panNode);
            if (chain.conv && idx % 2 === 0) cGain.connect(chain.conv);
            cOsc.start(now);
            cOsc.stop(now + cDur + 0.03);
          });
        }
      }

      // 7. クリスタル・アルペジオ（サインが左右を往復）
      var aFreq = cur.arp[st % 8] * (isDrop && st % 4 === 0 ? 1.5 : 1.0);
      if (aFreq > 0) {
        var ag = openNote(now + 0.17, 1);
        if (ag) {
          var aOsc = own(ag, ctx.createOscillator());
          var aGain = own(ag, ctx.createGain());
          var arpPan = makePanner(ag, Math.sin(st * 0.45) * 0.88);
          aOsc.type = 'sine';
          aOsc.frequency.setValueAtTime(aFreq, now);
          aGain.gain.setValueAtTime(isDrop ? 0.036 : 0.025, now);
          aGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
          aOsc.connect(aGain);
          aGain.connect(arpPan);
          if (chain.dL) aGain.connect(st % 2 === 0 ? chain.dL : chain.dR);
          if (chain.conv) aGain.connect(chain.conv);
          aOsc.start(now);
          aOsc.stop(now + 0.17);
        }
      }

      // 8. ビブラート付きリード（ノコギリ＋トライアングルのデチューン、ビブラート LFO 付き）
      var leadArray = isDrop ? cur.leadDrop : cur.leadVerse;
      var lFreq = leadArray[s32];
      if (lFreq > 0) {
        var lg = openNote(now + 0.29, 4);
        if (lg) {
          var leadPan = makePanner(lg, Math.cos(st * 0.2) * 0.32);
          [-6, 6].forEach(function (det, i) {
            var lOsc = own(lg, ctx.createOscillator());
            var lFilter = own(lg, ctx.createBiquadFilter());
            var lGain = own(lg, ctx.createGain());
            lOsc.type = i === 0 ? 'sawtooth' : 'triangle';
            lOsc.frequency.setValueAtTime(lFreq, now);
            lOsc.detune.setValueAtTime(det, now);

            var vib = own(lg, ctx.createOscillator());
            var vibGain = own(lg, ctx.createGain());
            vib.frequency.setValueAtTime(5.5, now);
            vibGain.gain.setValueAtTime(4.5, now);
            vib.connect(vibGain);
            vibGain.connect(lOsc.frequency);
            vib.start(now);
            vib.stop(now + 0.28);

            lFilter.type = 'lowpass';
            lFilter.frequency.setValueAtTime(3600, now);
            lGain.gain.setValueAtTime(0.001, now);
            lGain.gain.linearRampToValueAtTime(isDrop ? 0.034 : 0.026, now + 0.018);
            lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
            lOsc.connect(lFilter);
            lFilter.connect(lGain);
            lGain.connect(leadPan);
            if (chain.dL && i === 0) lGain.connect(chain.dL);
            if (chain.conv && i === 1) lGain.connect(chain.conv);
            lOsc.start(now);
            lOsc.stop(now + 0.28);
          });
        }
      }

      // 9. 節の頭（最初と後半）の重低音のブーン
      if (st === 0 || st === 64) {
        var boomG = openNote(now + 1.65, 1);
        if (boomG) {
          var bo = own(boomG, ctx.createOscillator());
          var bgn = own(boomG, ctx.createGain());
          bo.type = 'sine';
          bo.frequency.setValueAtTime(62, now);
          bo.frequency.exponentialRampToValueAtTime(26, now + 1.4);
          bgn.gain.setValueAtTime(0.5, now);
          bgn.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
          bo.connect(bgn);
          bgn.connect(head);
          bo.start(now);
          bo.stop(now + 1.65);
        }
      }
    }

    // ゲーム startBgm の tick と同じ：1 ステップ鳴らして次の setTimeout を張る
    function tick() {
      timer = null;
      if (index < 0 || !chain) return;
      // ctx が止まっている間は進めない（音符が積み上がらないように）
      if (ctx.state === 'running') {
        sweep(ctx.currentTime);
        try { playStep(step); } catch (e) { /* keep the scheduler alive */ }
        step = (step + 1) % STEPS;
      }
      timer = setTimeout(tick, TRACKS[index].tempo);
    }

    function play(i) {
      if (typeof i !== 'number' || i !== Math.floor(i) || i < 0 || i >= TRACKS.length) return;
      clearTick();
      if (fadeTimer) teardown(); // stop() のフェード中なら、その場で切って新しく始める
      index = i;
      step = 0;
      ensureChain();
      if (ctx.state === 'suspended') {
        safe(function () {
          var p = ctx.resume();
          if (p && typeof p.catch === 'function') p.catch(function () {});
        });
      }
      tick();
    }

    function stop() {
      clearTick();
      index = -1;
      step = 0;
      if (!chain) return;
      var t = ctx.currentTime;
      safe(function () {
        var g = chain.out.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(0, t + FADE_SEC);
      });
      clearFade();
      fadeTimer = setTimeout(function () {
        fadeTimer = null;
        teardown();
      }, Math.round(FADE_SEC * 1000) + 50);
    }

    function setVolume(v) {
      volume = clamp01(v);
      if (chain && index >= 0) {
        var t = ctx.currentTime;
        safe(function () {
          chain.out.gain.cancelScheduledValues(t);
          chain.out.gain.setTargetAtTime(volume, t, 0.02);
        });
      }
    }

    return {
      play: play,
      stop: stop,
      setVolume: setVolume,
      get index() { return index; },
      get analyser() { return analyser; }
    };
  }

  global.KOSA_BGM = global.KOSA_BGM || {};
  global.KOSA_BGM.invader = {
    title: '元素インベーダー',
    tracks: TRACKS.map(function (t) { return { name: t.name }; }),
    create: function (ctx, dest) {
      return createPlayer(ctx, dest || ctx.destination);
    }
  };
})(typeof window !== 'undefined' ? window : this);
