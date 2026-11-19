/*
 * KOSA BGM: 元素マージ (games/merge.html) の手続き型BGM。
 * games/merge.html の SpatialLabAudioEngine から BGM 部分をそのまま写したプレーヤー（音源ファイルなし）。
 * 使い方: var p = window.KOSA_BGM.merge.create(ctx, ctx.destination); p.play(0); p.stop();
 * ・play() を呼ぶまで音は出ない。DOM / localStorage / ゲームのグローバルには触れない。
 * ・出力: 曲のバス → リミッター/リバーブ → コンプレッサー → マスター(0.85) → 出力ゲイン(既定 0.45) → アナライザー → dest
 */
window.KOSA_BGM = window.KOSA_BGM || {};
(function () {
  'use strict';

  // ---- 曲データ（games/merge.html の BGM_TRACKS をそのまま） ----
  const BGM_TRACKS = [
    {
      // Track 1: 本家スイカゲーム風の陽気でコミカルなラグタイム・マリンバ＆クラリネット（32ステップ×2展開）
      name: '1.陽だまりラグタイム',
      tempo: 126,
      style: 'suika_rag',
      groove: 'rag',
      hat: 'shaker', fill: true, vol: 0.85,
      pad: 'strings',
      arp: 'harp',
      brass: true, brassVel: 0.6,
      counter: true, counterInst: 'flute',
      alt: { marimba: 'glock', clarinet: 'flute' },
      chords: [
        [60, 64, 67, 72], // C
        [69, 73, 76, 79], // A7
        [62, 65, 69, 72], // Dm7
        [67, 71, 74, 77], // G7
        [64, 67, 71, 74], // Em7
        [69, 73, 76, 81], // A7
        [62, 66, 69, 74], // D7
        [67, 71, 74, 79]  // G7 -> C
      ],
      // 1拍目ルート、3拍目5度（またはウォーキング）のチューバ/ウッドベースライン
      bass: [
        [48, 55], [45, 52], [50, 57], [43, 50],
        [52, 47], [45, 52], [50, 54], [43, 47]
      ],
      // g: 装飾音(Grace note), n: メイン音, d: 長さ(16分音符単位), inst: 'marimba' | 'clarinet'
      melody: [
        // Bar 1 (C)
        [
          { g: 75, n: 76, d: 2, inst: 'marimba' }, null, { n: 79, d: 2, inst: 'marimba' }, null,
          { n: 84, d: 2, inst: 'marimba' }, { n: 81, d: 2, inst: 'marimba' }, { n: 79, d: 2, inst: 'marimba' }, { n: 76, d: 2, inst: 'marimba' },
          { g: 73, n: 74, d: 2, inst: 'clarinet' }, { n: 76, d: 2, inst: 'clarinet' }, { n: 72, d: 3, inst: 'clarinet' }, null,
          { n: 67, d: 2, inst: 'marimba' }, null, { n: 72, d: 2, inst: 'marimba' }, null
        ],
        // Bar 2 (A7)
        [
          { g: 75, n: 76, d: 2, inst: 'marimba' }, null, { n: 79, d: 2, inst: 'marimba' }, null,
          { g: 80, n: 81, d: 3, inst: 'clarinet' }, null, { n: 79, d: 2, inst: 'clarinet' }, null,
          { n: 76, d: 2, inst: 'marimba' }, { n: 73, d: 2, inst: 'marimba' }, { n: 69, d: 2, inst: 'marimba' }, { n: 73, d: 2, inst: 'marimba' },
          { n: 76, d: 3, inst: 'marimba' }, null, null, null
        ],
        // Bar 3 (Dm7)
        [
          { g: 73, n: 74, d: 2, inst: 'clarinet' }, null, { n: 77, d: 2, inst: 'clarinet' }, null,
          { n: 81, d: 2, inst: 'marimba' }, { n: 79, d: 2, inst: 'marimba' }, { n: 77, d: 2, inst: 'marimba' }, { n: 74, d: 2, inst: 'marimba' },
          { n: 72, d: 2, inst: 'clarinet' }, null, { n: 69, d: 2, inst: 'clarinet' }, null,
          { n: 74, d: 3, inst: 'marimba' }, null, null, null
        ],
        // Bar 4 (G7)
        [
          { g: 70, n: 71, d: 2, inst: 'marimba' }, { n: 74, d: 2, inst: 'marimba' }, { n: 77, d: 2, inst: 'marimba' }, { n: 79, d: 2, inst: 'marimba' },
          { n: 83, d: 3, inst: 'clarinet' }, null, { n: 79, d: 2, inst: 'clarinet' }, null,
          { n: 77, d: 2, inst: 'marimba' }, { n: 74, d: 2, inst: 'marimba' }, { n: 71, d: 2, inst: 'marimba' }, { n: 74, d: 2, inst: 'marimba' },
          { n: 79, d: 3, inst: 'marimba' }, null, null, null
        ],
        // Bar 5 (Em7)
        [
          { g: 78, n: 79, d: 2, inst: 'marimba' }, null, { n: 83, d: 2, inst: 'marimba' }, null,
          { n: 86, d: 2, inst: 'clarinet' }, { n: 83, d: 2, inst: 'clarinet' }, { n: 79, d: 2, inst: 'marimba' }, { n: 76, d: 2, inst: 'marimba' },
          { n: 74, d: 2, inst: 'marimba' }, { n: 76, d: 2, inst: 'marimba' }, { n: 79, d: 3, inst: 'clarinet' }, null,
          { n: 76, d: 2, inst: 'marimba' }, null, null, null
        ],
        // Bar 6 (A7)
        [
          { g: 75, n: 76, d: 2, inst: 'clarinet' }, { n: 79, d: 2, inst: 'clarinet' }, { n: 81, d: 2, inst: 'marimba' }, { n: 85, d: 2, inst: 'marimba' },
          { n: 88, d: 3, inst: 'marimba' }, null, { n: 85, d: 2, inst: 'marimba' }, null,
          { n: 81, d: 2, inst: 'clarinet' }, { n: 79, d: 2, inst: 'clarinet' }, { n: 76, d: 2, inst: 'marimba' }, { n: 73, d: 2, inst: 'marimba' },
          { n: 69, d: 3, inst: 'marimba' }, null, null, null
        ],
        // Bar 7 (D7)
        [
          { g: 73, n: 74, d: 2, inst: 'marimba' }, null, { n: 78, d: 2, inst: 'marimba' }, null,
          { n: 81, d: 2, inst: 'clarinet' }, null, { n: 84, d: 2, inst: 'clarinet' }, null,
          { n: 83, d: 2, inst: 'marimba' }, { n: 81, d: 2, inst: 'marimba' }, { n: 78, d: 2, inst: 'marimba' }, { n: 74, d: 2, inst: 'marimba' },
          { n: 79, d: 3, inst: 'clarinet' }, null, null, null
        ],
        // Bar 8 (G7 Turnaround)
        [
          { g: 83, n: 84, d: 3, inst: 'marimba' }, null, { n: 79, d: 2, inst: 'marimba' }, { n: 76, d: 2, inst: 'marimba' },
          { n: 72, d: 2, inst: 'marimba' }, { n: 74, d: 2, inst: 'marimba' }, { n: 76, d: 2, inst: 'marimba' }, { n: 79, d: 2, inst: 'marimba' },
          { n: 84, d: 3, inst: 'clarinet' }, null, null, null,
          null, null, null, null
        ]
      ]
    },
    {
      // Track 2: わくわく実験マーチ（トイ・グロッケン＆木管マーチ）
      name: '2.わくわく実験マーチ',
      tempo: 130,
      style: 'lab_march',
      groove: 'march',
      hat: 'hat', fill: true, vol: 0.85,
      pad: 'strings',
      arp: 'celesta',
      brass: true, brassVel: 1.0,
      timp: true,
      counter: true, counterInst: 'flute',
      alt: { marimba: 'glock' },
      chords: [
        [65, 69, 72, 77], // F
        [60, 64, 67, 70], // C7
        [62, 65, 69, 74], // Dm
        [58, 62, 65, 70], // Bb
        [65, 69, 72, 77], // F
        [67, 71, 74, 79], // G7
        [60, 64, 67, 72], // C
        [60, 64, 67, 70]  // C7
      ],
      bass: [
        [41, 48], [36, 43], [38, 45], [34, 41],
        [41, 48], [43, 50], [36, 43], [36, 40]
      ],
      melody: [
        [
          { n: 77, d: 2, inst: 'marimba' }, null, { n: 72, d: 2, inst: 'marimba' }, { n: 77, d: 2, inst: 'marimba' },
          { n: 81, d: 3, inst: 'clarinet' }, null, { n: 77, d: 2, inst: 'clarinet' }, null,
          { n: 84, d: 2, inst: 'marimba' }, { n: 81, d: 2, inst: 'marimba' }, { n: 77, d: 2, inst: 'marimba' }, { n: 72, d: 2, inst: 'marimba' },
          { n: 77, d: 3, inst: 'marimba' }, null, null, null
        ],
        [
          { n: 76, d: 2, inst: 'clarinet' }, null, { n: 72, d: 2, inst: 'clarinet' }, { n: 76, d: 2, inst: 'clarinet' },
          { n: 79, d: 3, inst: 'marimba' }, null, { n: 76, d: 2, inst: 'marimba' }, null,
          { n: 82, d: 2, inst: 'clarinet' }, { n: 79, d: 2, inst: 'clarinet' }, { n: 76, d: 2, inst: 'clarinet' }, { n: 72, d: 2, inst: 'clarinet' },
          { n: 76, d: 3, inst: 'marimba' }, null, null, null
        ],
        [
          { n: 74, d: 2, inst: 'marimba' }, { n: 77, d: 2, inst: 'marimba' }, { n: 81, d: 3, inst: 'marimba' }, null,
          { n: 86, d: 3, inst: 'clarinet' }, null, { n: 81, d: 2, inst: 'clarinet' }, null,
          { n: 77, d: 2, inst: 'marimba' }, { n: 74, d: 2, inst: 'marimba' }, { n: 69, d: 2, inst: 'marimba' }, { n: 74, d: 2, inst: 'marimba' },
          { n: 77, d: 3, inst: 'marimba' }, null, null, null
        ],
        [
          { g: 73, n: 74, d: 2, inst: 'clarinet' }, null, { n: 77, d: 2, inst: 'clarinet' }, null,
          { n: 82, d: 3, inst: 'marimba' }, null, { n: 77, d: 2, inst: 'marimba' }, null,
          { n: 74, d: 2, inst: 'marimba' }, { n: 77, d: 2, inst: 'marimba' }, { n: 82, d: 2, inst: 'marimba' }, { n: 86, d: 2, inst: 'marimba' },
          { n: 84, d: 3, inst: 'clarinet' }, null, null, null
        ],
        [
          { n: 81, d: 2, inst: 'marimba' }, null, { n: 77, d: 2, inst: 'marimba' }, { n: 81, d: 2, inst: 'marimba' },
          { n: 84, d: 3, inst: 'clarinet' }, null, { n: 81, d: 2, inst: 'clarinet' }, null,
          { n: 77, d: 2, inst: 'marimba' }, { n: 72, d: 2, inst: 'marimba' }, { n: 69, d: 2, inst: 'marimba' }, { n: 72, d: 2, inst: 'marimba' },
          { n: 77, d: 3, inst: 'marimba' }, null, null, null
        ],
        [
          { n: 79, d: 2, inst: 'clarinet' }, { n: 83, d: 2, inst: 'clarinet' }, { n: 86, d: 3, inst: 'marimba' }, null,
          { n: 83, d: 2, inst: 'marimba' }, { n: 79, d: 2, inst: 'marimba' }, { n: 74, d: 2, inst: 'marimba' }, { n: 79, d: 2, inst: 'marimba' },
          { n: 83, d: 3, inst: 'clarinet' }, null, { n: 86, d: 2, inst: 'marimba' }, null,
          { n: 84, d: 3, inst: 'marimba' }, null, null, null
        ],
        [
          { n: 84, d: 2, inst: 'marimba' }, { n: 79, d: 2, inst: 'marimba' }, { n: 76, d: 2, inst: 'marimba' }, { n: 72, d: 2, inst: 'marimba' },
          { n: 74, d: 2, inst: 'clarinet' }, { n: 76, d: 2, inst: 'clarinet' }, { n: 79, d: 2, inst: 'clarinet' }, { n: 84, d: 2, inst: 'clarinet' },
          { n: 88, d: 3, inst: 'marimba' }, null, { n: 84, d: 2, inst: 'marimba' }, null,
          { n: 79, d: 3, inst: 'marimba' }, null, null, null
        ],
        [
          { n: 76, d: 2, inst: 'clarinet' }, { n: 79, d: 2, inst: 'clarinet' }, { n: 82, d: 2, inst: 'marimba' }, { n: 84, d: 2, inst: 'marimba' },
          { n: 88, d: 3, inst: 'marimba' }, null, null, null,
          null, null, null, null,
          null, null, null, null
        ]
      ]
    },
    {
      // Track 3: トロピカル分子ボサ（ヴィブラフォン＆アコースティックギター風ボサノヴァ）
      name: '3.トロピカル分子ボサ',
      tempo: 116,
      style: 'bossa',
      groove: 'bossa',
      hat: 'shaker', fill: true, vol: 0.85,
      pad: 'choir',
      arp: 'harp',
      counter: true, counterInst: 'pizz',
      alt: { clarinet: 'flute' },
      chords: [
        [65, 69, 72, 76], // Fmaj7
        [64, 67, 71, 74], // Em7
        [62, 65, 69, 72], // Dm7
        [60, 64, 67, 71], // Cmaj7
        [58, 62, 65, 69], // Bbmaj7
        [69, 72, 76, 79], // Am7
        [62, 65, 69, 74], // Dm7
        [67, 71, 74, 77]  // G7
      ],
      bass: [
        [41, 48], [40, 47], [38, 45], [36, 43],
        [34, 41], [45, 52], [38, 45], [43, 50]
      ],
      melody: [
        [
          { g: 79, n: 81, d: 3, inst: 'marimba' }, null, null, { n: 76, d: 2, inst: 'marimba' },
          { n: 72, d: 2, inst: 'marimba' }, null, { n: 76, d: 2, inst: 'clarinet' }, { n: 81, d: 3, inst: 'clarinet' },
          null, null, { n: 79, d: 2, inst: 'marimba' }, { n: 76, d: 2, inst: 'marimba' },
          { n: 72, d: 3, inst: 'marimba' }, null, null, null
        ],
        [
          { n: 79, d: 3, inst: 'clarinet' }, null, null, { n: 74, d: 2, inst: 'clarinet' },
          { n: 71, d: 2, inst: 'marimba' }, null, { n: 76, d: 2, inst: 'marimba' }, { n: 79, d: 3, inst: 'marimba' },
          null, null, { n: 83, d: 2, inst: 'clarinet' }, { n: 79, d: 2, inst: 'clarinet' },
          { n: 74, d: 3, inst: 'marimba' }, null, null, null
        ],
        [
          { n: 77, d: 3, inst: 'marimba' }, null, null, { n: 72, d: 2, inst: 'marimba' },
          { n: 69, d: 2, inst: 'marimba' }, null, { n: 74, d: 2, inst: 'clarinet' }, { n: 77, d: 3, inst: 'clarinet' },
          null, null, { n: 81, d: 2, inst: 'marimba' }, { n: 77, d: 2, inst: 'marimba' },
          { n: 72, d: 3, inst: 'marimba' }, null, null, null
        ],
        [
          { n: 76, d: 3, inst: 'clarinet' }, null, { n: 79, d: 2, inst: 'marimba' }, null,
          { n: 84, d: 4, inst: 'marimba' }, null, null, null,
          { n: 83, d: 2, inst: 'clarinet' }, { n: 79, d: 2, inst: 'clarinet' }, { n: 76, d: 2, inst: 'marimba' }, { n: 72, d: 2, inst: 'marimba' },
          { n: 71, d: 3, inst: 'marimba' }, null, null, null
        ],
        [
          { n: 74, d: 3, inst: 'marimba' }, null, null, { n: 70, d: 2, inst: 'marimba' },
          { n: 74, d: 2, inst: 'clarinet' }, { n: 77, d: 2, inst: 'clarinet' }, { n: 81, d: 3, inst: 'marimba' }, null,
          { n: 77, d: 2, inst: 'marimba' }, null, { n: 74, d: 2, inst: 'marimba' }, null,
          { n: 70, d: 3, inst: 'clarinet' }, null, null, null
        ],
        [
          { n: 76, d: 3, inst: 'clarinet' }, null, null, { n: 72, d: 2, inst: 'clarinet' },
          { n: 76, d: 2, inst: 'marimba' }, { n: 79, d: 2, inst: 'marimba' }, { n: 84, d: 3, inst: 'clarinet' }, null,
          { n: 79, d: 2, inst: 'marimba' }, null, { n: 76, d: 2, inst: 'marimba' }, null,
          { n: 72, d: 3, inst: 'marimba' }, null, null, null
        ],
        [
          { n: 74, d: 2, inst: 'marimba' }, { n: 77, d: 2, inst: 'marimba' }, { n: 81, d: 3, inst: 'marimba' }, null,
          { n: 84, d: 3, inst: 'clarinet' }, null, { n: 81, d: 2, inst: 'clarinet' }, null,
          { n: 77, d: 2, inst: 'marimba' }, { n: 74, d: 2, inst: 'marimba' }, { n: 72, d: 2, inst: 'marimba' }, { n: 69, d: 2, inst: 'marimba' },
          { n: 74, d: 3, inst: 'marimba' }, null, null, null
        ],
        [
          { n: 79, d: 2, inst: 'clarinet' }, { n: 83, d: 2, inst: 'clarinet' }, { n: 86, d: 3, inst: 'marimba' }, null,
          { n: 83, d: 2, inst: 'marimba' }, { n: 79, d: 2, inst: 'marimba' }, { n: 74, d: 2, inst: 'marimba' }, { n: 71, d: 2, inst: 'marimba' },
          { n: 72, d: 4, inst: 'clarinet' }, null, null, null,
          null, null, null, null
        ]
      ]
    },
    {
      // Track 4: 星空の放課後オルゴール（チェレスタ・オルゴール＆ローファイ・チル）
      name: '4.星空オルゴール',
      tempo: 96,
      style: 'musicbox',
      groove: 'chill',
      fill: true, vol: 0.8,
      pad: 'strings',
      arp: 'celesta',
      counter: true, counterInst: 'flute',
      alt: { marimba: 'celesta' },
      chords: [
        [63, 67, 70, 74], // Ebmaj7
        [62, 65, 69, 72], // Dm7
        [60, 63, 67, 70], // Cm7
        [58, 62, 65, 69], // Bbmaj7
        [56, 60, 63, 67], // Abmaj7
        [55, 58, 62, 65], // Gm7
        [60, 63, 67, 70], // Cm7
        [53, 57, 60, 63]  // F7
      ],
      bass: [
        [39, 46], [38, 45], [36, 43], [34, 41],
        [32, 39], [31, 38], [36, 43], [41, 48]
      ],
      melody: [
        [
          { n: 79, d: 3, inst: 'marimba' }, null, { n: 75, d: 2, inst: 'marimba' }, null,
          { n: 74, d: 3, inst: 'marimba' }, null, { n: 70, d: 2, inst: 'marimba' }, null,
          { n: 75, d: 2, inst: 'clarinet' }, { n: 79, d: 2, inst: 'clarinet' }, { n: 82, d: 4, inst: 'marimba' }, null,
          null, null, null, null
        ],
        [
          { n: 77, d: 3, inst: 'marimba' }, null, { n: 74, d: 2, inst: 'marimba' }, null,
          { n: 72, d: 3, inst: 'marimba' }, null, { n: 69, d: 2, inst: 'marimba' }, null,
          { n: 74, d: 2, inst: 'clarinet' }, { n: 77, d: 2, inst: 'clarinet' }, { n: 81, d: 4, inst: 'marimba' }, null,
          null, null, null, null
        ],
        [
          { n: 75, d: 3, inst: 'marimba' }, null, { n: 72, d: 2, inst: 'marimba' }, null,
          { n: 70, d: 3, inst: 'clarinet' }, null, { n: 67, d: 2, inst: 'clarinet' }, null,
          { n: 72, d: 2, inst: 'marimba' }, { n: 75, d: 2, inst: 'marimba' }, { n: 79, d: 4, inst: 'marimba' }, null,
          null, null, null, null
        ],
        [
          { n: 74, d: 3, inst: 'clarinet' }, null, { n: 77, d: 2, inst: 'marimba' }, null,
          { n: 82, d: 4, inst: 'marimba' }, null, null, null,
          { n: 81, d: 2, inst: 'marimba' }, { n: 77, d: 2, inst: 'marimba' }, { n: 74, d: 4, inst: 'clarinet' }, null,
          null, null, null, null
        ],
        [
          { n: 75, d: 2, inst: 'marimba' }, { n: 79, d: 2, inst: 'marimba' }, { n: 84, d: 4, inst: 'marimba' }, null,
          { n: 82, d: 2, inst: 'clarinet' }, { n: 79, d: 2, inst: 'clarinet' }, { n: 75, d: 4, inst: 'marimba' }, null,
          null, null, null, null,
          null, null, null, null
        ],
        [
          { n: 74, d: 2, inst: 'marimba' }, { n: 77, d: 2, inst: 'marimba' }, { n: 82, d: 4, inst: 'marimba' }, null,
          { n: 79, d: 2, inst: 'clarinet' }, { n: 74, d: 2, inst: 'clarinet' }, { n: 70, d: 4, inst: 'marimba' }, null,
          null, null, null, null,
          null, null, null, null
        ],
        [
          { n: 72, d: 2, inst: 'marimba' }, { n: 75, d: 2, inst: 'marimba' }, { n: 79, d: 3, inst: 'marimba' }, null,
          { n: 84, d: 3, inst: 'clarinet' }, null, { n: 79, d: 2, inst: 'marimba' }, null,
          { n: 75, d: 2, inst: 'marimba' }, { n: 72, d: 2, inst: 'marimba' }, { n: 70, d: 3, inst: 'marimba' }, null,
          null, null, null, null
        ],
        [
          { n: 72, d: 2, inst: 'marimba' }, { n: 75, d: 2, inst: 'marimba' }, { n: 77, d: 2, inst: 'marimba' }, { n: 81, d: 2, inst: 'marimba' },
          { n: 86, d: 5, inst: 'marimba' }, null, null, null,
          null, null, null, null,
          null, null, null, null
        ]
      ]
    },
    {
      // Track 5: ネオン・サブベース（136BPM・シンセウェーブ／エレクトロ。重低音サブ＋ノコギリ波リード＋フィルタースイープ）
      name: '5.ネオン・サブベース',
      tempo: 136,
      style: 'synth',
      groove: 'synth',
      pad: 'synth',
      arp: 'pluck',
      kickSteps: [0, 4, 8, 12],
      subPat: [0, null, 0, 12, 0, null, 7, 12], // 8分音符ごとの根音からの半音オフセット（null は休符）
      riser: true,
      heavy: true,
      stab: true,
      vol: 0.55,
      chords: [
        [57, 60, 64, 69], // Am
        [53, 57, 60, 65], // F
        [60, 64, 67, 72], // C
        [55, 59, 62, 67], // G
        [57, 60, 64, 69], // Am
        [53, 57, 60, 65], // F
        [62, 65, 69, 74], // Dm7
        [64, 68, 71, 74]  // E7
      ],
      bass: [
        [33, 40], [29, 36], [36, 43], [31, 38],
        [33, 40], [29, 36], [38, 45], [40, 47]
      ],
      // リード（8分音符ごと・8個／小節）
      lead: [
        [69, null, 72, 76, 74, null, 72, 69],
        [72, null, 77, 76, 72, null, 69, null],
        [76, null, 79, 79, 76, 72, null, 76],
        [79, null, 83, 79, 76, 74, 71, null],
        [69, null, 72, 76, 81, null, 79, 76],
        [77, null, 72, 69, null, 72, 77, 81],
        [74, null, 77, 81, 79, null, 77, 74],
        [76, null, 80, 83, null, 81, 80, 76]
      ]
    },
    {
      // Track 6: メルトダウン・ドライブ（140BPM・ダークなエレクトロ。ハードな低音と跳ねるキック）
      name: '6.メルトダウン・ドライブ',
      tempo: 140,
      style: 'synth',
      groove: 'synth',
      pad: 'synth',
      arp: null,
      kickSteps: [0, 6, 8, 14],
      subPat: [0, 0, 12, 0, 0, 7, 0, 12],
      riser: true,
      heavy: true,
      pump: true,
      vol: 0.55,
      chords: [
        [62, 65, 69, 72], // Dm
        [58, 62, 65, 70], // Bb
        [53, 57, 60, 65], // F
        [60, 64, 67, 72], // C
        [55, 58, 62, 67], // Gm
        [58, 62, 65, 70], // Bb
        [57, 61, 64, 67], // A7
        [62, 65, 69, 72]  // Dm
      ],
      bass: [
        [38, 45], [34, 41], [29, 36], [36, 43],
        [31, 38], [34, 41], [33, 40], [38, 45]
      ],
      lead: [
        [74, null, 77, 81, 79, null, 77, 74],
        [70, null, 74, 77, 77, null, 74, 70],
        [65, null, 69, 72, 72, null, 69, 65],
        [72, null, 76, 79, 79, null, 76, 72],
        [70, null, 74, 77, 79, null, 77, 74],
        [70, null, 74, 77, 81, null, 77, 70],
        [73, null, 76, 79, 81, null, 79, 76],
        [74, null, 77, 81, 84, null, 81, 77]
      ]
    }
  ];

  // ---- 定数（games/merge.html と同じ値） ----
  const BGM_BASE_GAIN = 0.45;  // BGMバスの基準音量（曲ごとの vol を掛けて使う）
  const BGM_MAX_VOICES = 56;   // BGMの同時発音数の上限（iPad Safari の負荷対策）
  // 鐘・木琴系の倍音定義 [倍音比, 音量比, 減衰秒]
  const CELESTA_PARTIALS = [[1, 1.0, 1.1], [4, 0.28, 0.45]];
  const GLOCK_PARTIALS = [[1, 1.0, 1.0], [2.76, 0.35, 0.35], [5.4, 0.12, 0.12]];
  const HARP_PARTIALS = [[1, 1.0, 0.9], [2, 0.3, 0.45]];
  // パッドの音色設定（ストリングス＝柔らかい / シンセ＝フィルタースイープ）
  const PAD_STRINGS = { lo: 900, hi: 2200, end: 1500, peakAt: 0.6, q: 0.7, attack: 0.35, release: 0.3 };
  const PAD_SYNTH = { lo: 260, hi: 1700, end: 700, peakAt: 0.7, q: 2.5, attack: 0.12, release: 0.25 };

  // ---- 1曲ぶんの発音セッション。ゲームの SpatialLabAudioEngine の BGM メソッドをそのまま持つ ----
  // ノードは全部 nodes に記録し、teardown() で切断する。
  function makeTrackedContext(ctx, nodes) {
    function track(n) { nodes.push(n); return n; }
    var w = {
      get currentTime() { return ctx.currentTime; },
      get sampleRate() { return ctx.sampleRate; },
      createBuffer: function () { return ctx.createBuffer.apply(ctx, arguments); },
      createGain: function () { return track(ctx.createGain()); },
      createOscillator: function () { return track(ctx.createOscillator()); },
      createBiquadFilter: function () { return track(ctx.createBiquadFilter()); },
      createBufferSource: function () { return track(ctx.createBufferSource()); },
      createConvolver: function () { return track(ctx.createConvolver()); },
      createDynamicsCompressor: function () { return track(ctx.createDynamicsCompressor()); }
    };
    if (ctx.createStereoPanner) {
      w.createStereoPanner = function () { return track(ctx.createStereoPanner()); };
    }
    return w;
  }

  // 白色ノイズ（0.25秒）。元の createWhiteNoiseBuffer と同じ
  function makeNoiseBuffer(ctx) {
    var rate = ctx.sampleRate;
    var len = Math.floor(rate * 0.25);
    var buf = ctx.createBuffer(1, len, rate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  // 木のルームリバーブのインパルス（1.0秒, 減衰 3.6）。元の createLightReverb と同じ
  function makeReverbImpulse(ctx) {
    var rate = ctx.sampleRate;
    var length = Math.floor(rate * 1.0);
    var impulse = ctx.createBuffer(2, length, rate);
    var left = impulse.getChannelData(0);
    var right = impulse.getChannelData(1);
    for (var i = 0; i < length; i++) {
      var env = Math.pow(1 - i / length, 3.6);
      left[i] = (Math.random() * 2 - 1) * env;
      right[i] = (Math.random() * 2 - 1) * env;
    }
    return impulse;
  }

  class MergeBgmSession {
    constructor(ctx, out, trackIndex, shared) {
      this.nodes = [];
      this.ctx = makeTrackedContext(ctx, this.nodes);
      this.bgmEnabled = true;
      this.trackIndex = trackIndex;
      this.isPlayingBgm = false;
      this.currentStep = 0;
      this.nextStepTime = 0;
      this.schedulerTimer = null;
      this.noiseBuffer = shared.noise;
      this.voiceSlots = new Float64Array(BGM_MAX_VOICES);

      // セッション全体のフェード用ゲイン（曲の切り替え・停止のフェードに使う）
      this.sessOut = this.ctx.createGain();
      this.sessOut.gain.value = 1.0;
      this.sessOut.connect(out);

      // 曲のバス（曲ごとの vol。基準音量はプレーヤーの出力ゲインで掛ける）
      this.bgmBus = this.ctx.createGain();
      this.bgmBus.gain.value = BGM_TRACKS[trackIndex].vol || 1;

      // BGM専用リミッター
      this.bgmLimiter = this.ctx.createDynamicsCompressor();
      this.bgmLimiter.threshold.value = -9;
      this.bgmLimiter.knee.value = 4;
      this.bgmLimiter.ratio.value = 12;
      this.bgmLimiter.attack.value = 0.003;
      this.bgmLimiter.release.value = 0.12;

      // リバーブ送り
      var reverb = this.ctx.createConvolver();
      reverb.buffer = shared.impulse;
      var reverbSend = this.ctx.createGain();
      reverbSend.gain.value = 0.24;

      this.bgmBus.connect(this.bgmLimiter);
      this.bgmBus.connect(reverbSend);
      this.bgmLimiter.connect(this.sessOut);
      reverbSend.connect(reverb);
      reverb.connect(this.sessOut);
    }

    createPanner(panVal = 0) {
      if (this.ctx.createStereoPanner) {
        const p = this.ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, panVal));
        return p;
      }
      return this.ctx.createGain();
    }

    mtof(midi) {
      return 440 * Math.pow(2, (midi - 69) / 12);
    }

    /**
     * 同時発音数の管理。空きスロットがあり上限未満なら発音を許可し、終了時刻を記録する。
     * prio 0: 主旋律・ベース・キック（常に許可）/ prio 1: パッド・アルペジオ・対旋律 / prio 2: 細かな打楽器
     */
    allocVoice(endTime, prio = 0) {
      const slots = this.voiceSlots;
      if (!slots) return false;
      const now = this.ctx.currentTime;
      let active = 0;
      let free = -1;
      for (let i = 0; i < slots.length; i++) {
        if (slots[i] > now) {
          active++;
        } else if (free < 0) {
          free = i;
        }
      }
      const cap = prio === 0 ? slots.length : (prio === 1 ? 36 : 28);
      if (free < 0 || active >= cap) return false;
      slots[free] = endTime;
      return true;
    }

    /**
     * アコースティック・ストライドピアノ / ウクレレ裏打ちコード（わずかなストラム時間差で人間味を再現）
     */
    playAcousticStrideChord(chordNotes, time, dur, style, pan = -0.3, vmul = 1) {
      if (!this.ctx || !this.bgmEnabled) return;
      const panner = this.createPanner(pan);
      panner.connect(this.bgmBus);

      chordNotes.forEach((midi, idx) => {
        const noteTime = time + idx * 0.009; // 9msずつの自然なストローク/打鍵ズレ
        if (!this.allocVoice(noteTime + dur + 0.02, 1)) return;
        const freq = this.mtof(midi);

        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const amp = this.ctx.createGain();

        osc1.type = 'triangle';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(freq, noteTime);
        osc2.frequency.setValueAtTime(freq * 2, noteTime);

        const peak = (style === 'suika_rag' ? 0.062 : 0.052) * vmul;
        amp.gain.setValueAtTime(0.0001, noteTime);
        amp.gain.linearRampToValueAtTime(peak, noteTime + 0.008);
        amp.gain.exponentialRampToValueAtTime(0.0008, noteTime + dur);

        const overtoneGain = this.ctx.createGain();
        overtoneGain.gain.setValueAtTime(peak * 0.35, noteTime);
        overtoneGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + dur * 0.5);

        osc1.connect(amp);
        osc2.connect(overtoneGain);
        overtoneGain.connect(amp);
        amp.connect(panner);

        osc1.start(noteTime);
        osc2.start(noteTime);
        osc1.stop(noteTime + dur + 0.02);
        osc2.stop(noteTime + dur + 0.02);
      });
    }

    /**
     * スイカゲーム風 ローズウッド・マリンバ / シロフォン（基音 + 4倍音 + マレット打撃トランジェント）
     */
    playWoodyMarimba(midi, time, dur, style, pan = 0.25, graceMidi = null, vmul = 1) {
      if (!this.ctx || !this.bgmEnabled) return;

      // 装飾音（グレースノート）がある場合は本音の32ms前にコロッと鳴らす
      if (graceMidi) {
        this.triggerMarimbaVoice(this.mtof(graceMidi), time, 0.05, 0.09 * vmul, pan - 0.1, style);
        this.triggerMarimbaVoice(this.mtof(midi), time + 0.034, dur, 0.17 * vmul, pan, style);
      } else {
        this.triggerMarimbaVoice(this.mtof(midi), time, dur, 0.165 * vmul, pan, style);
      }
    }

    triggerMarimbaVoice(freq, time, dur, velocity, pan, style) {
      const release = style === 'musicbox' ? dur * 1.4 : Math.min(dur, 0.24);
      if (!this.allocVoice(time + release + 0.02, 0)) return;
      const panner = this.createPanner(pan);
      panner.connect(this.bgmBus);

      // 1. 基音（温かいウッド共鳴）
      const fund = this.ctx.createOscillator();
      const fundAmp = this.ctx.createGain();
      fund.type = 'sine';
      fund.frequency.setValueAtTime(freq, time);

      fundAmp.gain.setValueAtTime(0.0001, time);
      fundAmp.gain.linearRampToValueAtTime(velocity, time + 0.004);
      fundAmp.gain.exponentialRampToValueAtTime(0.0008, time + release);

      // 2. マリンバ特有の4倍音（3.98倍で木琴のコロコロした響きを作る）
      const harm = this.ctx.createOscillator();
      const harmAmp = this.ctx.createGain();
      harm.type = 'triangle';
      harm.frequency.setValueAtTime(freq * (style === 'musicbox' ? 3.0 : 3.98), time);

      harmAmp.gain.setValueAtTime(0.0001, time);
      harmAmp.gain.linearRampToValueAtTime(velocity * 0.42, time + 0.002);
      harmAmp.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);

      // 3. マレットのアタッククリック音
      const click = this.ctx.createOscillator();
      const clickAmp = this.ctx.createGain();
      click.type = 'sine';
      click.frequency.setValueAtTime(freq * 6.5, time);
      click.frequency.exponentialRampToValueAtTime(freq * 1.5, time + 0.014);
      clickAmp.gain.setValueAtTime(velocity * 0.28, time);
      clickAmp.gain.exponentialRampToValueAtTime(0.0001, time + 0.015);

      fund.connect(fundAmp);
      harm.connect(harmAmp);
      click.connect(clickAmp);

      fundAmp.connect(panner);
      harmAmp.connect(panner);
      clickAmp.connect(panner);

      fund.start(time);
      harm.start(time);
      click.start(time);

      fund.stop(time + release + 0.02);
      harm.stop(time + 0.055);
      click.stop(time + 0.02);
    }

    /**
     * スイカゲーム風 クラリネット / 木管リード（奇数倍音＋ローパスフィルタ＋柔らかなビブラート）
     */
    playClarinetWoodwind(midi, time, dur, pan = -0.25, graceMidi = null, vmul = 1) {
      if (!this.ctx || !this.bgmEnabled) return;
      const startT = graceMidi ? time + 0.032 : time;
      if (graceMidi) {
        this.triggerClarinetVoice(this.mtof(graceMidi), time, 0.045, 0.06 * vmul, pan);
      }
      this.triggerClarinetVoice(this.mtof(midi), startT, dur, 0.095 * vmul, pan);
    }

    triggerClarinetVoice(freq, time, dur, velocity, pan) {
      if (!this.allocVoice(time + dur + 0.02, 0)) return;
      const osc = this.ctx.createOscillator();
      const sub = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const amp = this.ctx.createGain();
      const panner = this.createPanner(pan);

      // クラリネット特有の矩形波（奇数倍音）＋三角波ブレンド
      osc.type = 'square';
      sub.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      sub.frequency.setValueAtTime(freq, time);

      // 心地よいビブラートLFO
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 5.5;
      lfoGain.gain.setValueAtTime(0, time);
      lfoGain.gain.linearRampToValueAtTime(3.2, time + 0.08);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      // 木管の丸みを作るローパスフィルタ
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 2.8, time);
      filter.Q.value = 1.4;

      amp.gain.setValueAtTime(0.0001, time);
      amp.gain.linearRampToValueAtTime(velocity, time + 0.018);
      amp.gain.setValueAtTime(velocity * 0.85, time + dur * 0.65);
      amp.gain.exponentialRampToValueAtTime(0.0008, time + dur);

      osc.connect(filter);
      sub.connect(filter);
      filter.connect(amp);
      amp.connect(panner);
      panner.connect(this.bgmBus);

      osc.start(time);
      sub.start(time);
      lfo.start(time);

      osc.stop(time + dur + 0.02);
      sub.stop(time + dur + 0.02);
      lfo.stop(time + dur + 0.02);
    }

    /**
     * チューバ / ウッドベース（弾むような低音ブン・チャッの「ブン」）
     */
    playUprightBass(midi, time, dur, vmul = 1) {
      if (!this.ctx || !this.bgmEnabled) return;
      if (!this.allocVoice(time + dur + 0.02, 0)) return;
      const freq = this.mtof(midi);
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const amp = this.ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 4.5, time);
      filter.frequency.exponentialRampToValueAtTime(freq * 1.6, time + 0.14);

      amp.gain.setValueAtTime(0.001, time);
      amp.gain.linearRampToValueAtTime(0.21 * vmul, time + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.001, time + dur);

      const sawGain = this.ctx.createGain();
      sawGain.gain.value = 0.28;

      osc1.connect(filter);
      osc2.connect(sawGain);
      sawGain.connect(filter);
      filter.connect(amp);
      amp.connect(this.bgmBus);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + dur + 0.02);
      osc2.stop(time + dur + 0.02);
    }

    /**
     * トイ・パーカッション（ウッドブロック・ブラシスネア・アコースティックキック）
     */
    playToyPercussion(type, time) {
      if (!this.ctx || !this.bgmEnabled) return;
      if (type === 'kick') {
        if (!this.allocVoice(time + 0.12, 0)) return;
        const osc = this.ctx.createOscillator();
        const amp = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(125, time);
        osc.frequency.exponentialRampToValueAtTime(46, time + 0.09);
        amp.gain.setValueAtTime(0.22, time);
        amp.gain.exponentialRampToValueAtTime(0.001, time + 0.11);
        osc.connect(amp);
        amp.connect(this.bgmBus);
        osc.start(time);
        osc.stop(time + 0.12);
      } else if (type === 'woodblock_hi' || type === 'woodblock_lo') {
        if (!this.allocVoice(time + 0.04, 2)) return;
        const osc = this.ctx.createOscillator();
        const amp = this.ctx.createGain();
        const panner = this.createPanner(type === 'woodblock_hi' ? 0.38 : 0.25);
        const baseF = type === 'woodblock_hi' ? 960 : 720;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseF, time);
        osc.frequency.exponentialRampToValueAtTime(baseF * 0.72, time + 0.028);
        amp.gain.setValueAtTime(0.095, time);
        amp.gain.exponentialRampToValueAtTime(0.0008, time + 0.035);
        osc.connect(amp);
        amp.connect(panner);
        panner.connect(this.bgmBus);
        osc.start(time);
        osc.stop(time + 0.04);
      } else if (type === 'brush' && this.noiseBuffer) {
        if (!this.allocVoice(time + 0.06, 2)) return;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2600;
        filter.Q.value = 1.2;
        const amp = this.ctx.createGain();
        const panner = this.createPanner(-0.25);
        amp.gain.setValueAtTime(0.055, time);
        amp.gain.exponentialRampToValueAtTime(0.0008, time + 0.055);
        src.connect(filter);
        filter.connect(amp);
        amp.connect(panner);
        panner.connect(this.bgmBus);
        src.start(time);
        src.stop(time + 0.06);
      }
    }

    /** 鐘系（チェレスタ・グロッケン・ハープ）：倍音の組み合わせで音色を作る */
    playBell(midi, time, vel, pan, partials, prio) {
      if (!this.ctx || !this.bgmEnabled) return;
      let maxDecay = 0;
      for (let i = 0; i < partials.length; i++) {
        maxDecay = Math.max(maxDecay, partials[i][2]);
      }
      if (!this.allocVoice(time + maxDecay + 0.05, prio)) return;
      const f = this.mtof(midi);
      const panner = this.createPanner(pan);
      for (let i = 0; i < partials.length; i++) {
        const p = partials[i];
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f * p[0], time);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.linearRampToValueAtTime(vel * p[1], time + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, time + p[2]);
        osc.connect(g);
        g.connect(panner);
        osc.start(time);
        osc.stop(time + p[2] + 0.05);
      }
      panner.connect(this.bgmBus);
    }

    /** ピチカート（三角波＋減衰するローパス） */
    playPizz(midi, time, dur, vel, pan = 0) {
      if (!this.ctx || !this.bgmEnabled) return;
      const end = time + 0.4;
      if (!this.allocVoice(end, 1)) return;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const amp = this.ctx.createGain();
      const panner = this.createPanner(pan);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(this.mtof(midi), time);
      filter.type = 'lowpass';
      filter.Q.value = 0.8;
      filter.frequency.setValueAtTime(2400, time);
      filter.frequency.exponentialRampToValueAtTime(500, time + 0.2);
      amp.gain.setValueAtTime(0.0001, time);
      amp.gain.linearRampToValueAtTime(vel, time + 0.005);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);
      osc.connect(filter);
      filter.connect(amp);
      amp.connect(panner);
      panner.connect(this.bgmBus);
      osc.start(time);
      osc.stop(end);
    }

    /** フルート（純音＋2倍音＋息のノイズ＋ゆるいビブラート） */
    playFlute(midi, time, dur, vel, pan = 0) {
      if (!this.ctx || !this.bgmEnabled || !this.noiseBuffer) return;
      const end = time + dur + 0.05;
      if (!this.allocVoice(end, 1)) return;
      const f = this.mtof(midi);
      const panner = this.createPanner(pan);
      const amp = this.ctx.createGain();
      const osc = this.ctx.createOscillator();
      const second = this.ctx.createOscillator();
      const secondGain = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const src = this.ctx.createBufferSource();
      const breathFilter = this.ctx.createBiquadFilter();
      const breathGain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, time);
      second.type = 'sine';
      second.frequency.setValueAtTime(f * 2, time);
      secondGain.gain.value = 0.18;
      lfo.frequency.value = 5.2;
      lfoGain.gain.setValueAtTime(0, time);
      lfoGain.gain.linearRampToValueAtTime(f * 0.008, time + 0.25);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      src.buffer = this.noiseBuffer;
      src.loop = true;
      breathFilter.type = 'bandpass';
      breathFilter.frequency.value = f * 3;
      breathFilter.Q.value = 3;
      breathGain.gain.value = 0.05;

      amp.gain.setValueAtTime(0.0001, time);
      amp.gain.linearRampToValueAtTime(vel, time + 0.07);
      amp.gain.setValueAtTime(vel, time + dur - 0.12);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      osc.connect(amp);
      second.connect(secondGain);
      secondGain.connect(amp);
      src.connect(breathFilter);
      breathFilter.connect(breathGain);
      breathGain.connect(amp);
      amp.connect(panner);
      panner.connect(this.bgmBus);

      osc.start(time);
      second.start(time);
      lfo.start(time);
      src.start(time);
      osc.stop(end);
      second.stop(end);
      lfo.stop(end);
      src.stop(end);
    }

    /** ストリングス／コーラス／シンセのパッド（和音ごとに鳴らす。cfg で音色を切り替え） */
    playSawPad(chord, time, dur, vel, cfg, pan) {
      if (!this.ctx || !this.bgmEnabled) return;
      const count = Math.min(chord.length, 4);
      for (let i = 0; i < count; i++) {
        const end = time + dur + 0.05;
        if (!this.allocVoice(end, 1)) continue;
        const f = this.mtof(chord[i]);
        const panner = this.createPanner(pan + (i - 1.5) * 0.35);
        const filter = this.ctx.createBiquadFilter();
        const amp = this.ctx.createGain();
        filter.type = 'lowpass';
        filter.Q.value = cfg.q;
        filter.frequency.setValueAtTime(cfg.lo, time);
        filter.frequency.exponentialRampToValueAtTime(cfg.hi, time + dur * cfg.peakAt);
        filter.frequency.exponentialRampToValueAtTime(cfg.end, time + dur);
        amp.gain.setValueAtTime(0.0001, time);
        amp.gain.linearRampToValueAtTime(vel, time + cfg.attack);
        amp.gain.setValueAtTime(vel, time + dur - cfg.release);
        amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        for (let d = -1; d <= 1; d += 2) {
          const osc = this.ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, time);
          osc.detune.setValueAtTime(d * 8, time);
          osc.connect(filter);
          osc.start(time);
          osc.stop(end);
        }
        filter.connect(amp);
        amp.connect(panner);
        panner.connect(this.bgmBus);
      }
    }

    /** コーラス風パッド（ノコギリ波を2つの帯域通過フィルターに通して母音の共鳴を作る） */
    playPadChoir(chord, time, dur, vel, pan = 0) {
      if (!this.ctx || !this.bgmEnabled) return;
      const count = Math.min(chord.length, 3);
      for (let i = 0; i < count; i++) {
        const end = time + dur + 0.05;
        if (!this.allocVoice(end, 1)) continue;
        const osc = this.ctx.createOscillator();
        const f1 = this.ctx.createBiquadFilter();
        const f2 = this.ctx.createBiquadFilter();
        const g1 = this.ctx.createGain();
        const g2 = this.ctx.createGain();
        const amp = this.ctx.createGain();
        const panner = this.createPanner(pan + (i - 1) * 0.4);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(this.mtof(chord[i]), time);
        f1.type = 'bandpass';
        f1.frequency.value = 720;
        f1.Q.value = 5;
        f2.type = 'bandpass';
        f2.frequency.value = 1180;
        f2.Q.value = 6;
        g1.gain.value = 0.8;
        g2.gain.value = 0.5;
        amp.gain.setValueAtTime(0.0001, time);
        amp.gain.linearRampToValueAtTime(vel, time + 0.5);
        amp.gain.setValueAtTime(vel, time + dur - 0.45);
        amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        osc.connect(f1);
        osc.connect(f2);
        f1.connect(g1);
        f2.connect(g2);
        g1.connect(amp);
        g2.connect(amp);
        amp.connect(panner);
        panner.connect(this.bgmBus);
        osc.start(time);
        osc.stop(end);
      }
    }

    /** ブラス・スタブ（ノコギリ波の二重奏＋開いていくローパス。短い和音のファンファーレ） */
    playBrassStab(chord, time, dur, vel, pan = 0) {
      if (!this.ctx || !this.bgmEnabled) return;
      const count = Math.min(chord.length, 3);
      for (let i = 0; i < count; i++) {
        const end = time + dur + 0.05;
        if (!this.allocVoice(end, 1)) continue;
        const f = this.mtof(chord[i]);
        const panner = this.createPanner(pan + (i - 1) * 0.25);
        const filter = this.ctx.createBiquadFilter();
        const amp = this.ctx.createGain();
        filter.type = 'lowpass';
        filter.Q.value = 2.5;
        filter.frequency.setValueAtTime(500, time);
        filter.frequency.exponentialRampToValueAtTime(2600, time + 0.06);
        filter.frequency.exponentialRampToValueAtTime(1000, time + dur);
        amp.gain.setValueAtTime(0.0001, time);
        amp.gain.linearRampToValueAtTime(vel, time + 0.025);
        amp.gain.setValueAtTime(vel * 0.85, time + dur * 0.6);
        amp.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.04);
        for (let d = -1; d <= 1; d += 2) {
          const osc = this.ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, time);
          osc.detune.setValueAtTime(d * 8, time);
          osc.connect(filter);
          osc.start(time);
          osc.stop(end);
        }
        filter.connect(amp);
        amp.connect(panner);
        panner.connect(this.bgmBus);
      }
    }

    /** 太鼓（テーラ／タム）：ピッチが少し下がるサイン波＋打撃の低域ノイズ */
    playTaiko(midi, time, dur, vel, pan = 0) {
      if (!this.ctx || !this.bgmEnabled || !this.noiseBuffer) return;
      if (!this.allocVoice(time + dur + 0.02, 0)) return;
      const f = this.mtof(midi);
      const panner = this.createPanner(pan);
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * 1.35, time);
      osc.frequency.exponentialRampToValueAtTime(f, time + 0.05);
      amp.gain.setValueAtTime(vel, time);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.connect(amp);
      amp.connect(panner);
      panner.connect(this.bgmBus);
      osc.start(time);
      osc.stop(time + dur + 0.02);

      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      lp.Q.value = 0.7;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(vel * 0.6, time);
      ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
      src.connect(lp);
      lp.connect(ng);
      ng.connect(panner);
      src.start(time);
      src.stop(time + 0.06);
    }

    /** 重低音キック（155Hz→42Hzのピッチ落下） */
    playBigKick(time, vel) {
      if (!this.ctx || !this.bgmEnabled) return;
      if (!this.allocVoice(time + 0.34, 0)) return;
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(155, time);
      osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);
      amp.gain.setValueAtTime(vel, time);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);
      osc.connect(amp);
      amp.connect(this.bgmBus);
      osc.start(time);
      osc.stop(time + 0.34);
    }

    /** スネア（ノイズ＋短いトーン） */
    playSnare(time, vel) {
      if (!this.ctx || !this.bgmEnabled || !this.noiseBuffer) return;
      if (!this.allocVoice(time + 0.18, 0)) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1700;
      bp.Q.value = 0.8;
      const amp = this.ctx.createGain();
      amp.gain.setValueAtTime(vel, time);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.17);
      src.connect(bp);
      bp.connect(amp);
      amp.connect(this.bgmBus);
      src.start(time);
      src.stop(time + 0.18);

      const body = this.ctx.createOscillator();
      const bodyAmp = this.ctx.createGain();
      body.type = 'triangle';
      body.frequency.setValueAtTime(190, time);
      body.frequency.exponentialRampToValueAtTime(160, time + 0.06);
      bodyAmp.gain.setValueAtTime(vel * 0.55, time);
      bodyAmp.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
      body.connect(bodyAmp);
      bodyAmp.connect(this.bgmBus);
      body.start(time);
      body.stop(time + 0.1);
    }

    /** クラップ（ノイズを3回短く打ち直す） */
    playClap(time, vel) {
      if (!this.ctx || !this.bgmEnabled || !this.noiseBuffer) return;
      if (!this.allocVoice(time + 0.18, 1)) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1300;
      bp.Q.value = 1.0;
      const amp = this.ctx.createGain();
      amp.gain.setValueAtTime(0.0001, time);
      amp.gain.linearRampToValueAtTime(vel, time + 0.002);
      amp.gain.linearRampToValueAtTime(vel * 0.2, time + 0.012);
      amp.gain.linearRampToValueAtTime(vel, time + 0.016);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
      src.connect(bp);
      bp.connect(amp);
      amp.connect(this.bgmBus);
      src.start(time);
      src.stop(time + 0.19);
    }

    /** ハイハット（ノイズのハイパス。open=true で余韻を長く） */
    playHat(time, vel, open) {
      if (!this.ctx || !this.bgmEnabled || !this.noiseBuffer) return;
      const dec = open ? 0.2 : 0.04;
      if (!this.allocVoice(time + dec + 0.02, 2)) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7600;
      const amp = this.ctx.createGain();
      amp.gain.setValueAtTime(vel, time);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + dec);
      src.connect(hp);
      hp.connect(amp);
      amp.connect(this.bgmBus);
      src.start(time);
      src.stop(time + dec + 0.02);
    }

    /** シェイカー（帯域通過ノイズの短い擦過音） */
    playShaker(time, vel, pan) {
      if (!this.ctx || !this.bgmEnabled || !this.noiseBuffer) return;
      if (!this.allocVoice(time + 0.06, 2)) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 6200;
      bp.Q.value = 1.2;
      const amp = this.ctx.createGain();
      const panner = this.createPanner(pan);
      amp.gain.setValueAtTime(0.0001, time);
      amp.gain.linearRampToValueAtTime(vel, time + 0.006);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
      src.connect(bp);
      bp.connect(amp);
      amp.connect(panner);
      panner.connect(this.bgmBus);
      src.start(time);
      src.stop(time + 0.06);
    }

    /** ライザー（ノイズの帯域を下から上へ掃引して次の小節への盛り上がりを作る） */
    playRiser(time, dur) {
      if (!this.ctx || !this.bgmEnabled || !this.noiseBuffer) return;
      if (!this.allocVoice(time + dur + 0.02, 2)) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(300, time);
      bp.frequency.exponentialRampToValueAtTime(6500, time + dur);
      const amp = this.ctx.createGain();
      amp.gain.setValueAtTime(0.0001, time);
      amp.gain.linearRampToValueAtTime(0.09, time + dur);
      src.connect(bp);
      bp.connect(amp);
      amp.connect(this.bgmBus);
      src.start(time);
      src.stop(time + dur + 0.02);
    }

    /** 重低音サブベース：サイン波＋ノコギリ波（ローパス）。発音直後に一度沈んでから戻る＝ポンピング */
    playSubBass(midi, time, dur, vel) {
      if (!this.ctx || !this.bgmEnabled) return;
      const end = time + dur + 0.04;
      if (!this.allocVoice(end, 0)) return;
      const f = this.mtof(midi);
      const amp = this.ctx.createGain();
      const sub = this.ctx.createOscillator();
      const saw = this.ctx.createOscillator();
      const sawGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(f, time);
      saw.type = 'sawtooth';
      saw.frequency.setValueAtTime(f, time);
      sawGain.gain.value = 0.42;
      filter.type = 'lowpass';
      filter.Q.value = 3.5;
      filter.frequency.setValueAtTime(130, time);
      filter.frequency.exponentialRampToValueAtTime(560, time + 0.09);
      filter.frequency.exponentialRampToValueAtTime(230, time + dur);
      amp.gain.setValueAtTime(vel * 0.4, time);
      amp.gain.linearRampToValueAtTime(vel, time + 0.1);
      amp.gain.setValueAtTime(vel, time + dur - 0.04);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      sub.connect(amp);
      saw.connect(filter);
      filter.connect(sawGain);
      sawGain.connect(amp);
      amp.connect(this.bgmBus);
      sub.start(time);
      saw.start(time);
      sub.stop(end);
      saw.stop(end);
    }

    /** 重いキック：ピッチが速く落ちるパンチ＋長く沈む低音（heavy の曲で使う） */
    playHeavyKick(time, vel) {
      if (!this.ctx || !this.bgmEnabled) return;
      if (!this.allocVoice(time + 0.5, 0)) return;
      const body = this.ctx.createOscillator();
      const bodyAmp = this.ctx.createGain();
      body.type = 'sine';
      body.frequency.setValueAtTime(170, time);
      body.frequency.exponentialRampToValueAtTime(44, time + 0.14);
      bodyAmp.gain.setValueAtTime(vel, time);
      bodyAmp.gain.exponentialRampToValueAtTime(0.0001, time + 0.42);
      body.connect(bodyAmp);
      bodyAmp.connect(this.bgmBus);
      body.start(time);
      body.stop(time + 0.44);
      // 打ち込みの「カッ」という立ち上がり
      const click = this.ctx.createOscillator();
      const clickAmp = this.ctx.createGain();
      click.type = 'triangle';
      click.frequency.setValueAtTime(1200, time);
      click.frequency.exponentialRampToValueAtTime(300, time + 0.02);
      clickAmp.gain.setValueAtTime(vel * 0.5, time);
      clickAmp.gain.exponentialRampToValueAtTime(0.0001, time + 0.025);
      click.connect(clickAmp);
      clickAmp.connect(this.bgmBus);
      click.start(time);
      click.stop(time + 0.03);
    }

    /** リースベース：デチューンしたノコギリ波2本を低域フィルターで揺らす（重低音の芯） */
    playReese(midi, time, dur, vel) {
      if (!this.ctx || !this.bgmEnabled) return;
      const end = time + dur + 0.04;
      if (!this.allocVoice(end, 0)) return;
      const f = this.mtof(midi);
      const filter = this.ctx.createBiquadFilter();
      const amp = this.ctx.createGain();
      filter.type = 'lowpass';
      filter.Q.value = 6;
      filter.frequency.setValueAtTime(f * 2.2, time);
      filter.frequency.exponentialRampToValueAtTime(f * 6, time + dur * 0.35);
      filter.frequency.exponentialRampToValueAtTime(f * 2.6, time + dur);
      amp.gain.setValueAtTime(0.0001, time);
      amp.gain.linearRampToValueAtTime(vel, time + 0.01);
      amp.gain.setValueAtTime(vel * 0.75, time + dur * 0.7);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      for (let d = -1; d <= 1; d += 2) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, time);
        osc.detune.setValueAtTime(d * 14, time);
        osc.connect(filter);
        osc.start(time);
        osc.stop(end);
      }
      filter.connect(amp);
      amp.connect(this.bgmBus);
    }

    /** シンセリード：デチューンしたノコギリ波2本＋フィルタースイープ（開いてから閉じる） */
    playSawLead(midi, time, dur, vel, pan = 0) {
      if (!this.ctx || !this.bgmEnabled) return;
      const end = time + dur + 0.05;
      if (!this.allocVoice(end, 1)) return;
      const f = this.mtof(midi);
      const panner = this.createPanner(pan);
      const filter = this.ctx.createBiquadFilter();
      const amp = this.ctx.createGain();
      filter.type = 'lowpass';
      filter.Q.value = 7;
      filter.frequency.setValueAtTime(f * 2, time);
      filter.frequency.exponentialRampToValueAtTime(f * 7, time + 0.05);
      filter.frequency.exponentialRampToValueAtTime(f * 3, time + dur);
      amp.gain.setValueAtTime(0.0001, time);
      amp.gain.linearRampToValueAtTime(vel, time + 0.008);
      amp.gain.setValueAtTime(vel * 0.8, time + dur * 0.7);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      for (let d = -1; d <= 1; d += 2) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, time);
        osc.detune.setValueAtTime(d * 9, time);
        osc.connect(filter);
        osc.start(time);
        osc.stop(end);
      }
      filter.connect(amp);
      amp.connect(panner);
      panner.connect(this.bgmBus);
    }

    /** メロディ楽器の振り分け（曲の音色指定 inst と、後半の入れ替え先 alt の名前で選ぶ） */
    playMelodyNote(inst, style, midi, time, dur, pan, grace, vmul) {
      if (inst === 'clarinet') {
        this.playClarinetWoodwind(midi, time, dur, pan, grace, vmul);
      } else if (inst === 'glock') {
        this.playBell(midi, time, 0.13 * vmul, pan, GLOCK_PARTIALS, 0);
      } else if (inst === 'celesta') {
        this.playBell(midi, time, 0.12 * vmul, pan, CELESTA_PARTIALS, 0);
      } else if (inst === 'flute') {
        this.playFlute(midi, time, dur, 0.09 * vmul, pan);
      } else if (inst === 'pizz') {
        this.playPizz(midi, time, dur, 0.12 * vmul, pan);
      } else {
        this.playWoodyMarimba(midi, time, dur, style, pan, grace, vmul);
      }
    }

    /**
     * 全曲共通の伴奏レイヤー（パッド・アルペジオ・ブラス・対旋律・太鼓・フィル・シェイカー）
     */
    scheduleLayers(track, bar, beatStep, time, stepDur, chord, bassPair, dyn) {
      const isLastBar = bar === track.chords.length - 1;

      // 1. パッド：小節頭で和音を長く伸ばす
      if (beatStep === 0 && track.pad) {
        const padDur = stepDur * 16 * 1.04;
        if (track.pad === 'choir') {
          this.playPadChoir(chord, time, padDur, 0.05 * dyn, 0);
        } else if (track.pad === 'synth') {
          this.playSawPad(chord, time, padDur, 0.03 * dyn, PAD_SYNTH, 0);
        } else {
          this.playSawPad(chord, time, padDur, 0.034 * dyn, PAD_STRINGS, 0);
        }
      }

      // 2. アルペジオ（16分の2・6・10・14）：和音をずらしながら上下に回す
      if (track.arp && beatStep % 4 === 2) {
        const k = beatStep >> 2;
        const n = chord.length;
        let midi = chord[(k + bar) % n] + (k % 2 === 1 ? 12 : 0);
        if (midi > 84) midi -= 12;
        const pan = k % 2 === 0 ? 0.35 : -0.35;
        if (track.arp === 'celesta') {
          this.playBell(midi, time, 0.05 * dyn, pan, CELESTA_PARTIALS, 1);
        } else {
          this.playBell(midi, time, 0.045 * dyn, pan, HARP_PARTIALS, 1);
        }
      }

      // 3. ブラス・スタブ：偶数小節の頭と、4小節目の裏で短く鳴らす
      if (track.brass && ((beatStep === 0 && bar % 2 === 0) || (beatStep === 10 && bar % 4 === 3))) {
        this.playBrassStab(chord, time, stepDur * 3.2, 0.03 * (track.brassVel || 1) * dyn, -0.15);
      }

      // 4. 対旋律：小節頭と中間で、和音の内声を1オクターブ上に置く（フルート or ピチカート）
      if (track.counter && (beatStep === 0 || beatStep === 8)) {
        let cn = chord[(bar + (beatStep ? 1 : 0)) % chord.length] + 12;
        if (cn > 84) cn -= 12;
        const cdur = stepDur * 7.6;
        if (track.counterInst === 'pizz') {
          this.playPizz(cn, time, cdur, 0.075 * dyn, 0.4);
        } else {
          this.playFlute(cn, time, cdur, 0.07 * dyn, 0.4);
        }
      }

      // 5. 太鼓：小節頭のドン（timp 指定の曲）
      if (track.timp) {
        if (beatStep === 0) {
          this.playTaiko(bassPair[0] + 12, time, stepDur * 6, 0.22 * dyn, 0);
        } else if (beatStep === 8) {
          this.playTaiko(bassPair[0] + 7, time, stepDur * 4, 0.14 * dyn, 0.2);
        }
      }

      // 6. 最終小節の後半：タムのロール（音程を下げながら音量を上げる）→ 次のフレーズへの盛り上がり
      if (track.fill && isLastBar && beatStep >= 12) {
        const fm = chord[0] + 12 - (beatStep - 12) * 3;
        this.playTaiko(fm, time, stepDur * 1.6, (0.12 + (beatStep - 12) * 0.05) * dyn, (beatStep - 12) * 0.2 - 0.3);
      }

      // 7. シェイカー／ハイハット（細かな刻み）
      if (track.hat === 'shaker' && beatStep % 2 === 0) {
        this.playShaker(time, (beatStep % 4 === 0 ? 0.03 : 0.018) * dyn, beatStep % 4 === 0 ? -0.4 : 0.4);
      } else if (track.hat === 'hat' && beatStep % 4 === 2) {
        this.playHat(time, 0.035 * dyn, false);
      }
    }

    /** 従来のスイカゲーム風リズム（ラグ／マーチ／ボサ／オルゴール）＋メロディ */
    scheduleClassicStep(track, step, bar, beatStep, time, stepDur, chord, bassPair, dyn) {
      if (track.style === 'suika_rag' || track.style === 'lab_march') {
        // スイカゲーム特有の「ブン・チャッ・ブン・チャッ」ストライド伴奏
        if (beatStep === 0 || beatStep === 8) {
          const bNote = beatStep === 0 ? bassPair[0] : bassPair[1];
          this.playUprightBass(bNote, time, stepDur * 3.1);
          this.playToyPercussion('kick', time);
        }
        // 4拍目のウォーキング・ピックアップベース
        if (beatStep === 14 && bar % 2 === 1) {
          this.playUprightBass(bassPair[1] + 2, time, stepDur * 1.6);
        }

        // 2拍目・4拍目の裏打ちアコースティックコード＆ブラシスネア
        if (beatStep === 4 || beatStep === 12) {
          this.playAcousticStrideChord(chord, time, stepDur * 1.9, track.style, -0.32, dyn);
          this.playToyPercussion('brush', time);
        } else if (beatStep === 15 && bar % 2 === 0) {
          // シンコペーションの軽いチャッ
          this.playAcousticStrideChord(chord, time, stepDur * 1.2, track.style, -0.2, dyn);
        }

        // コミカルなウッドブロックの合いの手（カッ・コッ）
        if (beatStep === 6) this.playToyPercussion('woodblock_hi', time);
        if (beatStep === 7 && bar % 2 === 1) this.playToyPercussion('woodblock_lo', time);
        if (beatStep === 14) this.playToyPercussion('woodblock_lo', time);
      } else if (track.style === 'bossa') {
        // ボサノヴァ・クラーヴェパターン
        if (beatStep === 0 || beatStep === 3 || beatStep === 6 || beatStep === 10 || beatStep === 12) {
          this.playAcousticStrideChord(chord, time, stepDur * 2.4, track.style, -0.3, dyn);
        }
        if (beatStep === 0 || beatStep === 6 || beatStep === 8 || beatStep === 14) {
          const bNote = beatStep < 8 ? bassPair[0] : bassPair[1];
          this.playUprightBass(bNote, time, stepDur * 2.5);
        }
        if (beatStep === 0 || beatStep === 8) this.playToyPercussion('kick', time);
        if (beatStep === 2 || beatStep === 6 || beatStep === 10 || beatStep === 14) {
          this.playToyPercussion('brush', time);
        }
        if (beatStep === 4 || beatStep === 11) this.playToyPercussion('woodblock_hi', time);
      } else {
        // オルゴール・アルペジオ伴奏
        if (beatStep % 4 === 0) {
          const noteIdx = (beatStep / 4) % chord.length;
          this.playAcousticStrideChord([chord[noteIdx], chord[(noteIdx + 2) % chord.length]], time, stepDur * 3.8, track.style, -0.25, dyn);
        }
        if (beatStep === 0 || beatStep === 8) {
          this.playUprightBass(beatStep === 0 ? bassPair[0] : bassPair[1], time, stepDur * 4.5);
        }
      }

      // メロディパート：後半の小節は alt の音色に入れ替えて変化をつける
      const melEvent = track.melody[bar][beatStep];
      if (melEvent) {
        const noteDur = (melEvent.d || 2) * stepDur * 0.95;
        const panPos = Math.sin(step * 0.35) * 0.45;
        let inst = melEvent.inst;
        if (bar >= track.chords.length / 2 && track.alt && track.alt[inst]) {
          inst = track.alt[inst];
        }
        this.playMelodyNote(inst, track.style, melEvent.n, time, noteDur, panPos, melEvent.g || null, dyn);
      }
    }

    /** シンセ曲（重低音サブベース・ノコギリ波リード・四つ打ちキック・ライザー）。heavy の曲は、低音とドラムを厚くする */
    scheduleSynthStep(track, step, bar, beatStep, time, stepDur, chord, bassPair, dyn) {
      const isLastBar = bar === track.chords.length - 1;
      const heavy = !!track.heavy;

      // キック（heavy の曲は、パンチのある重いキック）
      if (track.kickSteps.indexOf(beatStep) >= 0) {
        if (heavy) this.playHeavyKick(time, 1.0 * dyn);
        else this.playBigKick(time, 0.85 * dyn);
      }
      // スネア＋クラップ（heavy の曲は、大きく）
      if (beatStep === 4 || beatStep === 12) {
        this.playSnare(time, (heavy ? 0.3 : 0.2) * dyn);
        this.playClap(time, (heavy ? 0.16 : 0.1) * dyn);
      }
      // ゴーストスネア（heavy の曲だけ、偶数小節の4拍目の裏）
      if (heavy && beatStep === 14 && bar % 2 === 0) {
        this.playSnare(time, 0.07 * dyn);
      }

      if (beatStep % 2 === 0) {
        const idx = beatStep >> 1;
        const off = track.subPat[idx];
        if (off !== null) {
          this.playSubBass(bassPair[0] + off, time, stepDur * 1.9, (heavy ? 0.6 : 0.5) * dyn);
          if (heavy) this.playReese(bassPair[0] + off, time, stepDur * 1.8, 0.2 * dyn);
        }
        const note = track.lead[bar][idx];
        if (note !== null) {
          this.playSawLead(note, time, stepDur * 1.8, 0.05 * dyn, idx % 4 < 2 ? 0.3 : -0.3);
        }
      }

      // ポンプ（pump の曲）：16分の裏で、低音を短く打ち込む
      if (heavy && track.pump && beatStep % 4 === 3) {
        this.playSubBass(bassPair[0], time, stepDur * 0.9, 0.22 * dyn);
      }

      if (beatStep % 4 === 2) {
        this.playHat(time, 0.04 * dyn, beatStep === 14 && bar % 2 === 1);
      }
      // ハイハットを16分で刻む（heavy の曲だけ、弱めに）
      if (heavy && beatStep % 2 === 1) {
        this.playHat(time, 0.018 * dyn, false);
      }

      // シンセのスタブ（stab の曲）：奇数小節の4拍目の裏で、和音を短く鳴らす
      if (track.stab && beatStep === 10 && bar % 2 === 1) {
        for (let i = 0; i < 3; i++) {
          this.playSawLead(chord[i] + 12, time, stepDur * 2.4, 0.035 * dyn, (i - 1) * 0.4);
        }
      }

      // 最終小節：ライザーとスネアの連打で次のフレーズへ
      if (isLastBar && beatStep === 0 && track.riser) {
        this.playRiser(time, stepDur * 16);
      }
      if (isLastBar && beatStep >= 8 && beatStep % 2 === 0 && beatStep !== 12) {
        this.playSnare(time, (0.08 + (beatStep - 8) * 0.02) * dyn);
      }
    }

    scheduleStep(step, time) {
      const track = BGM_TRACKS[this.trackIndex];
      const stepDur = 60 / track.tempo / 4;
      const bars = track.chords.length;
      const bar = Math.floor(step / 16) % bars;
      const beatStep = step % 16;

      const chord = track.chords[bar];
      const bassPair = track.bass[bar];
      // 4小節ごとのクレッシェンド（強弱のうねり）
      const dyn = 0.8 + 0.2 * ((bar % 4) / 3);

      if (track.style === 'synth') {
        this.scheduleSynthStep(track, step, bar, beatStep, time, stepDur, chord, bassPair, dyn);
      } else {
        this.scheduleClassicStep(track, step, bar, beatStep, time, stepDur, chord, bassPair, dyn);
      }
      this.scheduleLayers(track, bar, beatStep, time, stepDur, chord, bassPair, dyn);
    }

    startBgmLoop() {
      if (!this.ctx || this.isPlayingBgm) return;
      this.isPlayingBgm = true;
      this.nextStepTime = this.ctx.currentTime + 0.05;

      const lookahead = () => {
        if (!this.isPlayingBgm) return;
        const track = BGM_TRACKS[this.trackIndex];
        const stepDur = 60 / track.tempo / 4;
        const totalSteps = track.chords.length * 16;
        while (this.nextStepTime < this.ctx.currentTime + 0.12) {
          this.scheduleStep(this.currentStep, this.nextStepTime);
          this.nextStepTime += stepDur;
          this.currentStep = (this.currentStep + 1) % totalSteps;
        }
        this.schedulerTimer = setTimeout(lookahead, 30);
      };
      lookahead();
    }

    /** 新しい音を出さず、sec 秒かけて音量を0にする */
    fadeOut(sec) {
      this.isPlayingBgm = false;
      if (this.schedulerTimer) { clearTimeout(this.schedulerTimer); this.schedulerTimer = null; }
      try {
        var g = this.sessOut.gain;
        var t = this.ctx.currentTime;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(0, t + sec);
      } catch (e) { /* ignore */ }
    }

    /** 残っているノードをすべて停止・切断する */
    teardown() {
      this.isPlayingBgm = false;
      if (this.schedulerTimer) { clearTimeout(this.schedulerTimer); this.schedulerTimer = null; }
      var list = this.nodes.splice(0, this.nodes.length);
      for (var i = 0; i < list.length; i++) {
        var n = list[i];
        try { if (typeof n.stop === 'function') n.stop(); } catch (e) { /* not started */ }
        try { n.disconnect(); } catch (e) { /* already disconnected */ }
      }
      try { this.sessOut.disconnect(); } catch (e) { /* ignore */ }
      this.noiseBuffer = null;
      this.voiceSlots = null;
    }
  }

  // ---- プレーヤー ----
  function createPlayer(ctx, dest) {
    if (!ctx || typeof ctx.createGain !== 'function') {
      return {
        play: function () {}, stop: function () {}, setVolume: function () {},
        get index() { return -1; }, get analyser() { return null; }
      };
    }
    dest = dest || ctx.destination;

    // 出力段（ゲームのマスター相当）
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 3;
    var master = ctx.createGain();
    master.gain.value = 0.85;
    var outGain = ctx.createGain();
    outGain.gain.value = BGM_BASE_GAIN;   // 既定の音量 = ゲームのBGMの基準音量
    var analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    var shared = { noise: makeNoiseBuffer(ctx), impulse: makeReverbImpulse(ctx) };
    var sessions = [];   // まだ音が残っているセッション（現在の曲を含む）
    var current = null;  // 現在の曲
    var index = -1;
    var outputOn = false;

    function connectOutput() {
      if (outputOn) return;
      comp.connect(master);
      master.connect(outGain);
      outGain.connect(analyser);
      analyser.connect(dest);
      outputOn = true;
    }

    function disconnectOutput() {
      if (!outputOn) return;
      try { comp.disconnect(); master.disconnect(); outGain.disconnect(); analyser.disconnect(); } catch (e) { /* ignore */ }
      outputOn = false;
    }

    // セッションをフェードしてから、少し後に切断する
    function retire(sess, fadeSec) {
      sess.fadeOut(fadeSec);
      setTimeout(function () {
        sess.teardown();
        sessions = sessions.filter(function (s) { return s !== sess; });
        if (sessions.length === 0) disconnectOutput();
      }, Math.round(fadeSec * 1000) + 60);
    }

    return {
      play: function (i) {
        var n = Math.floor(Number(i));
        if (!(n >= 0 && n < BGM_TRACKS.length)) return;
        try {
          if (current) { retire(current, 0.12); current = null; }
          connectOutput();
          var sess = new MergeBgmSession(ctx, comp, n, shared);
          sessions.push(sess);
          current = sess;
          index = n;
          sess.startBgmLoop();
        } catch (e) { /* audio unavailable: stay silent */ }
      },
      stop: function () {
        if (!current) return;
        var s = current;
        current = null;
        index = -1;
        retire(s, 0.3);
      },
      setVolume: function (v) {
        var x = Number(v);
        if (!isFinite(x)) return;
        x = Math.max(0, Math.min(1, x));
        try {
          var t = ctx.currentTime;
          outGain.gain.cancelScheduledValues(t);
          outGain.gain.setTargetAtTime(x, t, 0.03);
        } catch (e) { /* ignore */ }
      },
      get index() { return index; },
      get analyser() { return analyser; }
    };
  }

  window.KOSA_BGM.merge = {
    title: '元素マージ',
    tracks: [
      { name: '1.陽だまりラグタイム' },
      { name: '2.わくわく実験マーチ' },
      { name: '3.トロピカル分子ボサ' },
      { name: '4.星空オルゴール' },
      { name: '5.ネオン・サブベース' },
      { name: '6.メルトダウン・ドライブ' }
    ],
    create: createPlayer
  };
})();
