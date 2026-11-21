/* =============================================================================
 * 歴打 -REKIDA- procedural BGM (Web Audio, plain ES2015 script)
 *
 *   window.KOSA_BGM.rekida.create(ctx, dest) -> player
 *     player.play(i)       start track i (0-based); loops until stop() or play()
 *     player.stop()        fade out 0.3s, stop scheduling, disconnect nodes
 *     player.setVolume(v)  output gain 0..1
 *     player.index         current track index or -1
 *     player.analyser      AnalyserNode (fftSize 256) carrying the output
 *
 *   Tracks: 0 = 雅（平安の大合奏） / 1 = 陣（合戦絵巻） / 2 = 暁（維新疾走）
 *   No DOM, no storage, no game globals. Sound only starts inside play().
 * ========================================================================== */
(function (global) {
    'use strict';

    global.KOSA_BGM = global.KOSA_BGM || {};

    var STEP = 0.165;            // 8分音符グリッド（約182BPM）: 元の歴打と同じ
    var STEPS = 64;              // 1周 64ステップ（約10.6秒）
    var TICK_MS = 25;            // スケジューラ周期
    var AHEAD = 0.14;            // 先読み秒数
    var FADE_STOP = 0.3;
    var FADE_SWITCH = 0.25;
    var FADE_IN = 0.25;
    // 同時発音（オシレーター／ソース）の上限。優先度の低いものから間引く
    var LIMIT = { 0: 30, 1: 40, 2: 48 };   // 0=持続音・鈴, 1=装飾, 2=主旋律・ベース・主太鼓
    var NOTE_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

    function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
    function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function noteMidi(name) {
        var m = /^([A-G])(b?)(\d)$/.exec(name);
        return (parseInt(m[3], 10) + 1) * 12 + NOTE_SEMI[m[1]] - (m[2] ? 1 : 0);
    }
    // 空白区切りの音名列を MIDI 番号の配列に変換（'-' は休符 = null）
    function seq(s) {
        return s.trim().split(/\s+/).map(function (tok) {
            return tok === '-' ? null : noteMidi(tok);
        });
    }
    function disconnectQuiet(node) {
        try { node.disconnect(); } catch (e) { /* already detached */ }
    }

    /* ---------------------------------------------------------------------
     * 旋律テーブル（元の歴打の64ステップ譜をそのまま移植。8ステップ×8行）
     * ------------------------------------------------------------------- */
    // 雅：十三絃箏（主旋律）
    var T_MIYABI_KOTO = seq(
        'D4 A4 Bb4 A4 G4 Eb4 D4 A3 ' +
        'D4 G4 A4 D5 Bb4 A4 G4 Eb4 ' +
        'G3 D4 G4 A4 Bb4 D5 A4 G4 ' +
        'Eb4 G4 A4 C5 A4 G4 E4 D4 ' +
        'D4 A4 D5 Eb5 D5 Bb4 A4 G4 ' +
        'Eb4 G4 A4 D5 E5 D5 A4 G4 ' +
        'Bb4 A4 G4 Eb4 D4 G4 A4 Bb4 ' +
        'A4 G4 Eb4 D4 A3 D4 D5 -');
    // 雅：篠笛・尺八の掛け合い
    var T_MIYABI_FUE = seq(
        'A5 - - Bb5 A5 - G5 - ' +
        'D5 - Eb5 - G5 - - - ' +
        'Bb5 - A5 - G5 - D5 G5 ' +
        'A5 - - C6 A5 - - - ' +
        'D6 - Bb5 D6 Bb5 - A5 - ' +
        'G5 A5 Bb5 - A5 - G5 - ' +
        'D5 - Eb5 G5 A5 - G5 Eb5 ' +
        'D5 - - - A4 - D5 -');
    // 雅：十七絃バス箏
    var T_MIYABI_BASS = seq(
        'D3 - - - G2 - A2 - ' +
        'D3 - - - Bb2 - A2 - ' +
        'G2 - D3 - G3 - F3 - ' +
        'Eb3 - C3 - A2 - D3 - ' +
        'D2 - D3 - Bb2 - G2 - ' +
        'Eb3 - F3 - A2 - A3 - ' +
        'G2 - Eb3 - D3 - Bb2 - ' +
        'A2 - G2 - D2 - D3 -');
    // 陣：津軽三味線（主旋律）
    var T_JIN_SHAMISEN = seq(
        'D4 D4 Eb4 D4 G4 Eb4 D4 A3 ' +
        'D4 Eb4 G4 A4 Bb4 A4 G4 Eb4 ' +
        'G4 G4 A4 Bb4 A4 G4 Eb4 D4 ' +
        'Eb4 D4 C4 D4 Eb4 G4 A4 A3 ' +
        'D5 D5 Eb5 D5 Bb4 A4 G4 A4 ' +
        'Bb4 D5 C5 Bb4 A4 G4 Eb4 D4 ' +
        'G4 A4 Bb4 D5 Eb5 D5 Bb4 A4 ' +
        'G4 Eb4 D4 Eb4 D4 A3 D4 D5');
    // 陣：尺八（力強い主旋律）
    var T_JIN_SHAKU = seq(
        '- - - - A4 - Bb4 A4 ' +
        'G4 - - - D5 - A4 - ' +
        'Bb4 - D5 - Eb5 D5 Bb4 - ' +
        'A4 - G4 - A4 - - - ' +
        'D5 - F5 - Eb5 - D5 - ' +
        'Bb4 - C5 - A4 - - - ' +
        'G5 - F5 - Eb5 - D5 - ' +
        'Bb4 A4 G4 - D5 - - -');
    // 暁：篠笛（主旋律）
    var T_AK_MELODY = seq(
        'D5 - E5 G5 A5 - G5 E5 ' +
        'D5 - A4 B4 D5 - - - ' +
        'E5 - G5 A5 B5 - A5 G5 ' +
        'E5 - D5 E5 G5 - A5 - ' +
        'D6 - B5 A5 G5 - E5 G5 ' +
        'A5 - G5 E5 D5 - A4 - ' +
        'E5 G5 A5 - B5 A5 G5 E5 ' +
        'D5 - E5 - D5 - - -');
    // 暁：ヨナ抜き音階の箏
    var T_AK_KOTO = seq(
        'D4 G4 A4 D5 B4 G4 D4 A3 ' +
        'E4 G4 A4 E5 D5 A4 G4 E4 ' +
        'D4 A4 D5 E5 G4 B4 D5 G5 ' +
        'E4 A4 D5 E5 A4 E5 G5 A5 ' +
        'G4 B4 D5 G5 E4 G4 A4 E5 ' +
        'D4 F4 A4 D5 B4 D5 G4 D4 ' +
        'E4 G4 A4 D5 G4 B4 D5 E5 ' +
        'D4 A4 D5 A4 D4 A3 D4 -');

    /* ---------------------------------------------------------------------
     * 共有の波形（ノイズ・ワウシェーパー・残響インパルス）
     * ------------------------------------------------------------------- */
    function makeNoise(ctx) {
        var sr = ctx.sampleRate;
        var buf = ctx.createBuffer(1, sr, sr);
        var d = buf.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return buf;
    }
    function makeCurve(k) {
        var n = 1024, c = new Float32Array(n);
        for (var i = 0; i < n; i++) {
            var x = (i * 2) / (n - 1) - 1;
            c[i] = Math.tanh(k * x) / Math.tanh(k);
        }
        return c;
    }
    // ステレオのホール残響（1.9秒）＋初期反射
    function makeImpulse(ctx) {
        var sr = ctx.sampleRate;
        var len = Math.floor(sr * 1.9);
        var buf = ctx.createBuffer(2, len, sr);
        var taps = [0.011, 0.019, 0.031, 0.047];
        for (var ch = 0; ch < 2; ch++) {
            var d = buf.getChannelData(ch);
            for (var i = 0; i < len; i++) {
                d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * 0.45;
            }
            for (var k = 0; k < taps.length; k++) {
                var at = Math.floor(taps[k] * sr * (ch ? 1.07 : 1));
                if (at < len) d[at] += (ch ? -0.5 : 0.5) * (0.6 - k * 0.1);
            }
        }
        return buf;
    }

    // 発音終了時：カウンタを戻し、そのボイスのノードを全て切断する（二重実行しない）
    function releaseRec(p, S, rec) {
        if (rec.done) return;
        rec.done = true;
        p._voices -= rec.n;
        S.voices.delete(rec);
        for (var i = 0; i < rec.nodes.length; i++) disconnectQuiet(rec.nodes[i]);
    }

    /* ---------------------------------------------------------------------
     * 1再生セッション分の発音API（t は AudioContext 時刻）
     * 各メソッドは同時発音数の上限を見て、超えるときは何もしない
     * ------------------------------------------------------------------- */
    function makeApi(p, S) {
        var ctx = p._ctx;

        function allow(n, prio) { return p._voices + n <= LIMIT[prio]; }

        function mkOsc(type, freq, t) {
            var o = ctx.createOscillator();
            o.type = type;
            o.frequency.setValueAtTime(freq, t);
            o.start(t);
            return o;
        }

        function noiseSrc(t) {
            var s = ctx.createBufferSource();
            s.buffer = p._noise;
            s.loop = true;               // 終了は stop() に任せる（早期 onended を避ける）
            s.start(t, Math.random() * 0.8);
            return s;
        }

        // ノードを発音経路に載せる: head → (パン) → セッションバス ＋ 残響センド
        function outNodes(head, nodes, pan, send) {
            nodes.push(head);
            var last = head;
            if (ctx.createStereoPanner) {
                var pn = ctx.createStereoPanner();
                pn.pan.value = clamp(pan, -1, 1);
                last.connect(pn);
                nodes.push(pn);
                last = pn;
            }
            last.connect(S.bus);
            if (send > 0) {
                var sg = ctx.createGain();
                sg.gain.value = send;
                last.connect(sg);
                sg.connect(p._verb);
                nodes.push(sg);
            }
        }

        // 開始済みのソースを記録し、t1 で止める。全ソース終了時にノードを切断する
        function track(srcs, nodes, t1) {
            var rec = {
                srcs: srcs,
                nodes: nodes.concat(srcs),
                n: srcs.length,
                t1: t1,
                done: false
            };
            p._voices += rec.n;
            S.voices.add(rec);
            srcs[0].onended = function () { releaseRec(p, S, rec); };
            for (var i = 0; i < srcs.length; i++) {
                try { srcs[i].stop(t1); } catch (e) { /* ignore */ }
            }
        }

        // ---- 箏（十三絃・十七絃）：撥弦、二重奏の微妙なデチューン ----
        function koto(midi, t, dur, vel, pan, send, prio) {
            if (!allow(2, prio)) return;
            var f = mtof(midi);
            var t1 = t + dur + 0.04;
            var lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.Q.value = 0.7;
            lp.frequency.setValueAtTime(clamp(f * 9, 500, 9000), t);
            lp.frequency.exponentialRampToValueAtTime(clamp(f * 2.2, 200, 4000), t + Math.min(0.35, dur));
            var env = ctx.createGain();
            env.gain.setValueAtTime(0.0001, t);
            env.gain.exponentialRampToValueAtTime(vel, t + 0.004);
            env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            var o1 = mkOsc('sawtooth', f, t);
            var o2 = mkOsc('sawtooth', f, t);
            o2.detune.setValueAtTime(7, t);
            o1.connect(lp);
            o2.connect(lp);
            lp.connect(env);
            var nodes = [lp];
            outNodes(env, nodes, pan, send);
            track([o1, o2], nodes, t1);
        }

        // ---- 三味線：撥の当たり（ノイズ）＋ワウシェーパーの「ビビリ」 ----
        function shamisen(midi, t, dur, vel, pan, send, prio) {
            if (!allow(3, prio)) return;
            var f = mtof(midi);
            var t1 = t + dur + 0.03;
            var o1 = mkOsc('sawtooth', f, t);
            var o2 = mkOsc('square', f, t);
            var g2 = ctx.createGain();
            g2.gain.value = 0.35;
            var sh = ctx.createWaveShaper();
            sh.curve = p._curve;
            sh.oversample = '2x';
            var lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.Q.value = 1.2;
            lp.frequency.setValueAtTime(clamp(f * 12, 800, 7000), t);
            lp.frequency.exponentialRampToValueAtTime(clamp(f * 3, 400, 3000), t + Math.min(0.2, dur));
            var env = ctx.createGain();
            env.gain.setValueAtTime(0.0001, t);
            env.gain.exponentialRampToValueAtTime(vel, t + 0.002);
            env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o1.connect(sh);
            o2.connect(g2);
            g2.connect(sh);
            sh.connect(lp);
            lp.connect(env);
            var ns = noiseSrc(t);
            var nb = ctx.createBiquadFilter();
            nb.type = 'bandpass';
            nb.frequency.value = 3500;
            nb.Q.value = 0.9;
            var ng = ctx.createGain();
            ng.gain.setValueAtTime(vel * 0.6, t);
            ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
            ns.connect(nb);
            nb.connect(ng);
            ng.connect(env);
            var nodes = [sh, g2, lp, nb, ng];
            outNodes(env, nodes, pan, send);
            track([o1, o2, ns], nodes, t1);
        }

        // ---- 尺八・篠笛：ビブラート（遅れて掛かる）＋息の成分 ----
        function fue(midi, t, dur, vel, pan, send, prio, shaku) {
            if (!allow(4, prio)) return;
            var f = mtof(midi);
            var atk = shaku ? 0.07 : 0.035;
            var rel = 0.09;
            var t1 = t + dur + rel + 0.02;
            var o = mkOsc('sine', f, t);
            var o2 = mkOsc('sine', f * 2, t);
            var g2 = ctx.createGain();
            g2.gain.value = 0.12;
            var lfo = mkOsc('sine', shaku ? 5.0 : 5.8, t);
            var lfoG = ctx.createGain();
            lfoG.gain.setValueAtTime(0, t);
            lfoG.gain.linearRampToValueAtTime(f * (shaku ? 0.018 : 0.008), t + (shaku ? 0.3 : 0.2));
            lfo.connect(lfoG);
            lfoG.connect(o.frequency);
            var env = ctx.createGain();
            env.gain.setValueAtTime(0.0001, t);
            env.gain.linearRampToValueAtTime(vel, t + atk);
            env.gain.setValueAtTime(vel, t + dur);
            env.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
            o.connect(env);
            o2.connect(g2);
            g2.connect(env);
            var ns = noiseSrc(t);
            var bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = clamp(f * 2.5, 800, 9000);
            bp.Q.value = 1.1;
            var ng = ctx.createGain();
            ng.gain.setValueAtTime(0.0001, t);
            ng.gain.linearRampToValueAtTime(vel * (shaku ? 0.5 : 0.2), t + atk);
            ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            ns.connect(bp);
            bp.connect(ng);
            ng.connect(env);
            var nodes = [lfoG, g2, bp, ng];
            outNodes(env, nodes, pan, send);
            track([o, o2, lfo, ns], nodes, t1);
        }

        // ---- 笙：ゆっくり息が入る和音クラスター（音ごとに定位を広げる）----
        function sho(midis, t, dur, vel, spread, prio) {
            var n = midis.length;
            if (!allow(2 * n, prio)) return;
            for (var k = 0; k < n; k++) {
                var f = mtof(midis[k]);
                var t1 = t + dur + 0.7;
                var o = mkOsc('sawtooth', f, t);
                var o2 = mkOsc('triangle', f * 2, t);
                var g2 = ctx.createGain();
                g2.gain.value = 0.35;
                var lp = ctx.createBiquadFilter();
                lp.type = 'lowpass';
                lp.Q.value = 0.5;
                lp.frequency.value = clamp(f * 4, 600, 3000);
                var env = ctx.createGain();
                env.gain.setValueAtTime(0.0001, t);
                env.gain.exponentialRampToValueAtTime(vel, t + 0.3);
                env.gain.setValueAtTime(vel, t + dur);
                env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
                o.connect(lp);
                lp.connect(env);
                o2.connect(g2);
                g2.connect(env);
                var pan = n > 1 ? -spread + (2 * spread * k) / (n - 1) : 0;
                var nodes = [lp, g2];
                outNodes(env, nodes, pan, 0.6);
                track([o, o2], nodes, t1);
            }
        }

        // ---- 太鼓・小鼓・摺鉦・拍子木・鈴 ----
        //   don/odon: 大太鼓（odon は大きく長い） / ka: 締太鼓の縁打ち / pon: 小鼓
        //   kane: 摺鉦 / hyoshi: 拍子木 / suzu: 鈴（長い余韻）
        function taiko(kind, t, vel, pan, prio) {
            var big = kind === 'odon';
            var need = kind === 'pon' ? 1 : (kind === 'don' || kind === 'odon') ? 3 : 2;
            if (!allow(need, prio)) return;
            var env = ctx.createGain();
            var srcs = [];
            var nodes = [];
            var t1;
            var send = 0.2;

            if (kind === 'don' || kind === 'odon') {
                var dur = big ? 0.42 : 0.24;
                t1 = t + dur + 0.03;
                env.gain.setValueAtTime(vel * (big ? 1.5 : 1.15), t);
                env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
                var o1 = mkOsc('sine', big ? 130 : 150, t);
                o1.frequency.exponentialRampToValueAtTime(42, t + (big ? 0.3 : 0.2));
                var o2 = mkOsc('sine', 300, t);          // 胴鳴りの倍音
                o2.frequency.exponentialRampToValueAtTime(84, t + 0.12);
                var g2 = ctx.createGain();
                g2.gain.value = 0.3;
                o1.connect(env);
                o2.connect(g2);
                g2.connect(env);
                var ns = noiseSrc(t);                    // 撥/バチの打撃音
                var nf = ctx.createBiquadFilter();
                nf.type = 'lowpass';
                nf.frequency.value = 700;
                var ng = ctx.createGain();
                ng.gain.setValueAtTime(vel * 0.5, t);
                ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
                ns.connect(nf);
                nf.connect(ng);
                ng.connect(env);
                srcs = [o1, o2, ns];
                nodes = [g2, nf, ng];
                send = big ? 0.4 : 0.2;
            } else if (kind === 'ka') {
                t1 = t + 0.07;
                env.gain.setValueAtTime(vel * 0.75, t);
                env.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
                var ko = mkOsc('triangle', 640, t);
                ko.frequency.exponentialRampToValueAtTime(190, t + 0.045);
                var kn = noiseSrc(t);
                var kb = ctx.createBiquadFilter();
                kb.type = 'bandpass';
                kb.frequency.value = 3800;
                kb.Q.value = 2;
                var kg = ctx.createGain();
                kg.gain.setValueAtTime(vel * 0.4, t);
                kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
                kn.connect(kb);
                kb.connect(kg);
                kg.connect(env);
                ko.connect(env);
                srcs = [ko, kn];
                nodes = [kb, kg];
                send = 0.15;
            } else if (kind === 'pon') {
                t1 = t + 0.17;
                env.gain.setValueAtTime(vel * 0.8, t);
                env.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
                var po = mkOsc('sine', 290, t);
                po.frequency.exponentialRampToValueAtTime(380, t + 0.04);
                po.frequency.exponentialRampToValueAtTime(230, t + 0.14);
                po.connect(env);
                srcs = [po];
                send = 0.2;
            } else if (kind === 'kane') {
                t1 = t + 0.1;
                env.gain.setValueAtTime(vel * 0.28, t);
                env.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
                var ka1 = mkOsc('sine', 1760, t);
                var ka2 = mkOsc('sine', 2637, t);
                var kg2 = ctx.createGain();
                kg2.gain.value = 0.6;
                ka1.connect(env);
                ka2.connect(kg2);
                kg2.connect(env);
                srcs = [ka1, ka2];
                nodes = [kg2];
                send = 0.3;
            } else if (kind === 'hyoshi') {
                t1 = t + 0.09;
                env.gain.setValueAtTime(vel, t);
                env.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
                var h1 = mkOsc('triangle', 1900, t);
                var h2 = mkOsc('triangle', 2400, t);
                var hg = ctx.createGain();
                hg.gain.value = 0.5;
                h1.connect(env);
                h2.connect(hg);
                hg.connect(env);
                srcs = [h1, h2];
                nodes = [hg];
                send = 0.2;
            } else { // suzu
                t1 = t + 1.5;
                env.gain.setValueAtTime(vel, t);
                env.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
                var s1 = mkOsc('sine', 2600, t);
                var s2 = mkOsc('sine', 3910, t);
                var sg = ctx.createGain();
                sg.gain.value = 0.3;
                s1.connect(env);
                s2.connect(sg);
                sg.connect(env);
                srcs = [s1, s2];
                nodes = [sg];
                send = 0.5;
            }
            outNodes(env, nodes, pan, send);
            track(srcs, nodes, t1);
        }

        // 乱打（ロール）：n 打を等間隔に、だんだん強く
        function roll(t, dur, n, vel, pan, prio) {
            for (var k = 0; k < n; k++) {
                taiko('don', t + dur * k / n, vel * (0.6 + 0.4 * k / Math.max(1, n - 1)), pan, prio);
            }
        }

        return {
            koto: koto,
            shamisen: shamisen,
            fue: fue,
            sho: sho,
            taiko: taiko,
            roll: roll
        };
    }

    /* ---------------------------------------------------------------------
     * 3曲のステップ譜。idx は 0..63、t は発音時刻。
     * 序（0-15）→破（16-31）→急（32-47）→結（48-63）の4節で層を増やす
     * ------------------------------------------------------------------- */

    // 雅：平安の大合奏。箏の主旋律と低音を軸に、篠笛が節ごとに重なる。太鼓は拍を一定に刻む
    function stepMiyabi(v, idx, t) {
        var sec = idx >> 4;
        var k = T_MIYABI_KOTO[idx];
        var f = T_MIYABI_FUE[idx];
        var b = T_MIYABI_BASS[idx];
        if (k !== null) v.koto(k, t, 0.45, 0.058, -0.4, 0.25, 2);                 // 主旋律（箏・左）
        if (b !== null) v.koto(b, t, 0.72, 0.07, 0.4, 0.2, 2);                    // 低音（箏・右）
        if (f !== null && sec >= 1) v.fue(f, t, 0.48, 0.042, sec === 1 ? 0.15 : -0.2, 0.35, 1, sec === 1);
        if (k !== null && sec === 2 && (idx & 1) === 0) v.shamisen(k + 12, t, 0.2, 0.035, 0.3, 0.2, 1);   // 急：三味線が1本だけ重なる
        if ((idx & 15) === 0) v.sho([74, 79, 81, 86], t, 1.8, 0.014, 0.6, 0);     // 節の頭に笙の和音
        var big = idx === 0 || idx === 32;
        if ((idx & 7) === 0) v.taiko(big ? 'odon' : 'don', t, big ? 0.12 : 0.075, 0, 2);
        if ((idx & 7) === 4) v.taiko('pon', t, 0.055, -0.4, 2);
        if (sec >= 2 && (idx & 3) === 2) v.taiko('ka', t, 0.04, 0.4, 1);
        if (idx === 60) v.roll(t, 0.15, 5, 0.025, 0.2, 1);                         // 結の締め
    }

    // 陣：合戦絵巻。三味線が主役、尺八が破から旋律を重ね、大太鼓が疾走感を作る
    function stepJin(v, idx, t) {
        var sec = idx >> 4;
        var s = T_JIN_SHAMISEN[idx];
        var sk = T_JIN_SHAKU[idx];
        var root = sec === 2 ? 43 : 38;                                            // 急は G2、他は D2
        if (s !== null) v.shamisen(s, t, 0.24, 0.07, 0.35, 0.18, 2);             // 三味線（主役）
        if (sk !== null && sec >= 1) v.fue(sk, t, 0.42, 0.05, -0.15, 0.3, 2, true);   // 尺八（破から）
        if ((idx & 3) === 0) v.koto(root, t, 0.55, 0.075, 0.25, 0.15, 2);          // 十七絃の重低音
        var big = idx === 0 || idx === 32;
        if ((idx & 3) === 0) v.taiko(big ? 'odon' : 'don', t, big ? 0.14 : 0.09, 0, 2);
        else if ((idx & 3) === 2) v.taiko('pon', t, 0.06, -0.4, 2);
        else if ((idx & 1) === 1) v.taiko('ka', t, 0.045, 0.4, 1);
        if ((idx & 3) === 1 && idx >= 16) v.taiko('kane', t, 0.04, 0.6, 1);       // 摺鉦（破から）
        if (idx === 30 || idx === 62) v.roll(t, 0.15, 6, 0.03, 0, 1);              // 陣太鼓の乱打
    }

    // 暁：明治維新の疾走。ヨナ抜きの箏と篠笛が明るく跳ね、太鼓と拍子木が弾ませる
    function stepAkatsuki(v, idx, t) {
        var sec = idx >> 4;
        var k = T_AK_KOTO[idx];
        var m = T_AK_MELODY[idx];
        if (k !== null) v.koto(k, t, 0.42, 0.058, -0.4, 0.25, 2);                  // 箏の主旋律（左）
        if (m !== null && sec >= 1) v.fue(m, t, 0.44, 0.045, 0.25, 0.25, 2, false); // 篠笛（破から）
        if ((idx & 3) === 0) v.koto(50, t, 0.6, 0.065, 0.4, 0.2, 2);              // D3 の低音
        if ((idx & 15) === 0) v.sho([74, 77, 81], t, 1.5, 0.012, 0.5, 0);         // 節の頭の和音
        if ((idx & 3) === 0) v.taiko('don', t, 0.075, 0, 2);
        if ((idx & 3) === 2) v.taiko('ka', t, 0.05, 0.4, 2);
        if ((idx & 7) === 6) v.taiko('hyoshi', t, 0.04, -0.5, 1);                 // 拍子木で弾ませる
        if (idx === 60) v.roll(t, 0.12, 4, 0.025, -0.2, 1);
    }

    var TRACKS = [
        { id: 'miyabi', name: '雅（平安の大合奏）', level: 1.8, step: stepMiyabi },
        { id: 'jin', name: '陣（合戦絵巻）', level: 1.9, step: stepJin },
        { id: 'akatsuki', name: '暁（維新疾走）', level: 1.75, step: stepAkatsuki }
    ];

    /* ---------------------------------------------------------------------
     * プレイヤー
     * ------------------------------------------------------------------- */
    function createPlayer(ctx, dest) {
        // 常設ノード（何も鳴らさない限り無音）
        var verb = ctx.createConvolver();
        verb.buffer = makeImpulse(ctx);
        var verbOut = ctx.createGain();
        verbOut.gain.value = 0.55;
        var comp = ctx.createDynamicsCompressor();     // バスのリミッター（ヘッドルーム確保）
        comp.threshold.value = -10;
        comp.knee.value = 6;
        comp.ratio.value = 12;
        comp.attack.value = 0.003;
        comp.release.value = 0.15;
        var vol = ctx.createGain();
        vol.gain.value = 0.8;
        var analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        verb.connect(verbOut);
        verbOut.connect(comp);
        comp.connect(vol);
        vol.connect(analyser);

        var p = {
            _ctx: ctx,
            _dest: dest,
            _verb: verb,
            _comp: comp,
            _vol: vol,
            _an: analyser,
            _noise: makeNoise(ctx),
            _curve: makeCurve(3),
            _sessions: new Set(),
            _session: null,
            _index: -1,
            _voices: 0,
            _outOn: false,
            _volume: 0.8
        };

        function resumeCtx() {
            try {
                if (ctx.state !== 'running' && typeof ctx.resume === 'function') {
                    var r = ctx.resume();
                    if (r && typeof r.catch === 'function') r.catch(function () {});
                }
            } catch (e) { /* ignore */ }
        }

        // 残響の戻し（stop 時は残響の余韻も含めて 0 まで落とす）
        function setReverbReturn(target, time, ramp) {
            try {
                var cur = verbOut.gain.value;
                verbOut.gain.cancelScheduledValues(time);
                verbOut.gain.setValueAtTime(cur, time);
                verbOut.gain.linearRampToValueAtTime(target, time + ramp);
            } catch (e) { /* ignore */ }
        }

        function startSession(i) {
            var now = ctx.currentTime;
            setReverbReturn(0.55, now, 0.05);
            var S = {
                idx: i,
                track: TRACKS[i],
                bus: ctx.createGain(),
                voices: new Set(),
                timer: null,
                step: 0,
                next: now + 0.06,
                stopping: false,
                torn: false,
                anchor: null,
                api: null
            };
            S.bus.gain.setValueAtTime(0.0001, now);
            S.bus.gain.exponentialRampToValueAtTime(S.track.level, now + FADE_IN);
            S.bus.connect(comp);
            S.api = makeApi(p, S);
            p._sessions.add(S);
            p._session = S;
            if (!p._outOn) {
                vol.connect(dest);
                p._outOn = true;
            }
            S.timer = setInterval(function () { tick(S); }, TICK_MS);
            tick(S);
        }

        function tick(S) {
            if (S.stopping) return;
            try {
                var now = ctx.currentTime;
                if (S.next < now) S.next = now + 0.02;         // 遅延時は拍を立て直す
                var lim = now + AHEAD;
                while (S.next < lim) {
                    S.track.step(S.api, S.step % STEPS, S.next);
                    S.step++;
                    S.next += STEP;
                }
            } catch (e) { /* never throw into the page */ }
        }

        // セッションをフェードアウトさせ、終了後にノードを切断する
        function endSession(S, fade) {
            if (S.stopping) return;
            S.stopping = true;
            if (S.timer !== null) {
                clearInterval(S.timer);
                S.timer = null;
            }
            try {
                var now = ctx.currentTime;
                var tEnd = now + fade;
                var cur = S.bus.gain.value;
                S.bus.gain.cancelScheduledValues(now);
                S.bus.gain.setValueAtTime(cur, now);
                S.bus.gain.linearRampToValueAtTime(0, tEnd);
                S.voices.forEach(function (rec) {
                    var t = Math.min(rec.t1, tEnd);
                    for (var i = 0; i < rec.srcs.length; i++) {
                        try { rec.srcs[i].stop(t); } catch (e) { /* ignore */ }
                    }
                });
                // 無音のアンカー発音が終わった時点でセッションのノードを全て切断する
                var anchor = ctx.createOscillator();
                anchor.onended = function () { teardown(S); };
                anchor.start(now);
                anchor.stop(tEnd + 0.03);
                S.anchor = anchor;
            } catch (e) {
                teardown(S);
            }
        }

        function teardown(S) {
            if (S.torn) return;
            S.torn = true;
            if (S.timer !== null) {
                clearInterval(S.timer);
                S.timer = null;
            }
            Array.from(S.voices).forEach(function (rec) { releaseRec(p, S, rec); });
            S.voices.clear();
            disconnectQuiet(S.bus);
            p._sessions.delete(S);
            if (p._session === S) p._session = null;
            if (p._sessions.size === 0 && p._outOn) {
                try { vol.disconnect(dest); } catch (e) { /* ignore */ }
                p._outOn = false;
            }
        }

        function fadeOutAll(fade) {
            Array.from(p._sessions).forEach(function (S) { endSession(S, fade); });
        }

        return {
            play: function (i) {
                var n = Number(i);
                if (!(n === Math.floor(n) && n >= 0 && n < TRACKS.length)) return;
                if (p._session && !p._session.stopping && p._session.idx === n) return;
                try {
                    resumeCtx();
                    fadeOutAll(FADE_SWITCH);
                    p._index = n;
                    startSession(n);
                } catch (e) {
                    p._index = -1;
                }
            },
            stop: function () {
                p._index = -1;
                try { setReverbReturn(0, ctx.currentTime, FADE_STOP); } catch (e) { /* ignore */ }
                Array.from(p._sessions).forEach(function (S) { endSession(S, FADE_STOP); });
            },
            setVolume: function (v) {
                var x = Number(v);
                if (!isFinite(x)) return;
                p._volume = clamp(x, 0, 1);
                try { vol.gain.setTargetAtTime(p._volume, ctx.currentTime, 0.03); } catch (e) { /* ignore */ }
            },
            get index() { return p._index; },
            get analyser() { return analyser; }
        };
    }

    global.KOSA_BGM.rekida = {
        title: '歴打',
        tracks: TRACKS.map(function (t) { return { id: t.id, name: t.name }; }),
        create: function (ctx, dest) { return createPlayer(ctx, dest); }
    };
})(typeof window !== 'undefined' ? window : this);
