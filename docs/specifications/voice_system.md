# voice-system.js プログラム仕様書

[voice-system.js](file:///c:/Users/owner/Documents/lab/Antigravity/alpha-synapse/src/voice-system.js) は、ユーザーの発話を認識してテキスト化する音声認識（STT：Speech-to-Text）、AIアシスタントのセリフを喋らせる音声合成（TTS：Text-to-Speech）のディスパッチ、Web Audio APIによる効果音の生成、および発話音量・文字と同期した口パク（リップシンク）とイコライザーHUDアニメーションを制御するクラス `VoiceSystem` を定義するスクリプトである。

---

## 1. クラス `VoiceSystem` 仕様

### 1.1 主要プロパティ

| プロパティ名 | 型 | 説明 |
| :--- | :--- | :--- |
| `avatar` | `VRMAvatar` | 連動するVRMアバターのインスタンス。口パクや発話中のフラグをセットするために使用。 |
| `updateUIState` | `function` | 音声認識状態（`'listening'`, `'listening_fallback'`, `'idle'`, `'error'`）が変化した際に、画面上のステータスランプやログを更新するUI同期用コールバック関数。 |
| `synth` | `SpeechSynthesis` | ブラウザ標準のテキスト読み上げオブジェクト（Web Speech API）。 |
| `recognition` | `SpeechRecognition` | ブラウザ標準の音声認識オブジェクト。ChromeやEdge等で日本語STTを行うために使用。 |
| `selectedVoice` | `object` | 現在選択されているボイス定義オブジェクト（Geminiボイス定義、クラウド読み上げ定義、あるいはブラウザに内蔵されたOS標準の日本語女性音声）。 |
| `fallbackAudio` | `HTMLAudioElement` | Gemini Native TTSの音声Blob、あるいはGoogle翻訳TTSのプロキシURLを再生するために、DOMに隠し配置された `Audio` 要素。iOSやQuestブラウザの自動再生ブロック（Autoplay Policy）をバイパスするために、事前にユーザーのジェスチャー（ボタンクリック等）でアンロックされる。 |
| `mediaRecorder` | `MediaRecorder` | Web Speech APIの音声認識がサポートされていない環境（Quest内ブラウザ等）でマイク録音を行うためのオブジェクト。 |
| `isListening` | `boolean` | 現在ブラウザ標準の音声認識（STT）が動作中かどうかのフラグ。 |
| `isSpeaking` | `boolean` | 現在音声合成（TTS）が再生中かどうかのフラグ。 |
| `audioQueue` | `array` | Ollamaモードで順次受信するBase64形式の音声・テキスト・感情情報を蓄積する再生キュー。 |
| `isPlayingQueue` | `boolean` | キュー再生ループが現在動作中であるかを示すフラグ。 |

---

### 1.2 主要メソッド

#### `initSynthesis()`
*   **処理概要**: 音声合成オプションの初期設定を行う。ローカルの `Style-Bert-VITS2 (ローカル音声 - 推奨)`、Geminiの内蔵ボイス（Leda, Aoede等）、およびクラウド音声定義を作成し、ブラウザ標準の `speechSynthesis.getVoices()` から取得したネイティブ音声と統合してボイスリストを生成する。LocalStorage から保存済みの音声名を復元する。
*   **引数**: なし
*   **戻り値**: なし
*   **呼び出す外部関数**: `synth.getVoices()`, `onVoicesLoaded` (メインUIの更新用コールバック)

#### `initRecognition()`
*   **処理概要**: ブラウザの `SpeechRecognition` を初期化し、言語を日本語（`ja-JP`）に設定、録音開始・エラー発生（マイク無効、タイムアウト等）・録音終了時のコールバックハンドラーを登録する。
*   **引数**: なし
*   **戻り値**: なし

#### `speak(text, onStart, onComplete)`
*   **処理概要**: 引数で受け取ったAIの応答テキストから、括弧（）やブレンドシェイプタグ（[happy]等）を正規表現で除去してクリーンな平仮名・漢字テキストにする。その後、選択されているボイスに応じて処理をディスパッチする。
    1. **Gemini TTSボイス**: AIBrainを叩いてBase64PCM音声を取得、WAVヘッダーを注入し、`fallbackAudio` で再生。APIキーがない、あるいはエラーが出た場合はクラウドフォールバックへ転送。
    2. **クラウドフォールバックボイス**: `playCloudTTS()` を実行。
    3. **ローカルブラウザボイス**: `playLocalSpeechAPI()` を実行。
*   **引数**:
    *   `text` (`string`): 読み上げるAIのセリフ
    *   `onStart` (`function` | `undefined`): 再生開始時に実行するコールバック
    *   `onComplete` (`function` | `undefined`): 再生完了時に実行するコールバック
*   **戻り値**: なし
*   **呼び出す外部・内部関数**:
    *   `AIBrain.generateAudioFromText()`
    *   `playCloudTTS()`
    *   `playLocalSpeechAPI()`
    *   `cleanupSpeechState()`
    *   `startLipSyncLoop()`

#### `playCloudTTS(cleanText, onStart, onComplete)`
*   **処理概要**: 安全な相対プロキシパスである `/api/tts`（中継先：Google Translate TTS）へクエリを添えてフェッチし、`fallbackAudio` のソースに設定して再生する。本番公開環境などプロキシが存在しないために通信エラー（CORS等）が発生した場合は、**自動でローカル音声合成（`playLocalSpeechAPI`）にフォールバックする**。
*   **引数**: `cleanText` (`string`), `onStart` (`function`), `onComplete` (`function`)
*   **戻り値**: なし
*   **呼び出す内部関数**: `playLocalSpeechAPI()`, `startLipSyncLoop()`

#### `playLocalSpeechAPI(cleanText, onStart, onComplete)`
*   **処理概要**: ブラウザ標準の `SpeechSynthesisUtterance` を使用し、ローカル環境で音声を合成・再生する。ブラウザの読み上げが途中でフリーズするバグを避けるため、読点や句点（。、！、？）でセリフを配列に分割し、非同期に順番に再生する（チャンク再生制御）。
*   **引数**: `cleanText` (`string`), `onStart` (`function`), `onComplete` (`function`)
*   **戻り値**: なし
*   **呼び出す外部・内部関数**:
    *   `synth.speak()`
    *   `startLipSyncLoop()`

#### `playProceduralChirp()`
*   **処理概要**: Web Audio APIを使用し、メモリ上でリアルタイムにサイン波オシレーターと三角波オシレーターを生成。それらを周波数スウィープ（1600Hz → 500Hz、高速アタック・エキスポネンシャルデケイ）させて、SF風の「サイバー精神同期チャイムSE」を完全にクライアントサイドローカルで鳴らす。
*   **引数**: なし
*   **戻り値**: なし

#### `stopSpeaking()`
*   **処理概要**: アクターの発話を強制停止する。再生キューのクリア（`audioQueue = []`, `isPlayingQueue = false`）を実行し、SpeechSynthesisのキャンセル、`fallbackAudio` の一時停止・リソース解放・全リスナー（`onerror`, `onplay`, `onended`）の解除を行い、リップシンクタイマーとイコライザーアニメーションを停止する。
*   **引数**: なし
*   **戻り値**: なし
*   **呼び出す内部関数**: `cleanupSpeechState()`

#### `enqueueAudio(base64Audio, cleanText, expression)`
*   **処理概要**: 音声合成データ（Base64形式のWAVデータ、セリフ、感情）を再生キューにプッシュして追加します。現在キューの自動再生が走っていなければ `playNextInQueue()` を呼び出して再生を開始します。
*   **引数**:
    *   `base64Audio` (`string`): Base64エンコードされたWAV音声データ
    *   `cleanText` (`string`): 読み上げ対象のクリーンなテキスト（リップシンク用）
    *   `expression` (`string`): 表情（感情）の名前
*   **戻り値**: なし
*   **呼び出す内部関数**: `playNextInQueue()`

#### `playNextInQueue()`
*   **処理概要**: `audioQueue` から先頭の項目を pop して非同期で再生します。
    1. キューが空になったら `isPlayingQueue = false` をセットして `cleanupSpeechState` を呼び出し、終了します。
    2. 取り出した音声バイナリを Blob に変換して Blob URL を作成し、`fallbackAudio.src` に割り当てて再生を開始します。
    3. 再生開始に合わせて `AIBrain.applyAvatarExpression()` を呼び出しアバターの表情を更新し、再生時間中に日本語の音節に同期したリップシンクを行います。
    4. 再生終了時（`onended`）や再生エラー時に、WAVの Blob URL を解放（`revokeObjectURL`）した上で、再帰的に自身（`playNextInQueue`）をコールして次のキュー項目を処理します。
*   **引数**: なし
*   **戻り値**: なし
*   **呼び出す外部・内部関数**:
    *   `AIBrain.applyAvatarExpression()`
    *   `startLipSyncLoop()`
    *   `playNextInQueue()` (再帰的コール)

#### `startLipSyncLoop(text)`
*   **処理概要**: 簡易的な日本語母音の解析ループ。テキストを先頭から1文字ずつスキャンし、母音「あ・い・う・え・お」を判定して `VRMAvatar.setViseme()` を呼び出す。発話中、約 130ms ごとに非同期ループ処理として実行される。
*   **引数**:
    *   `text` (`string`): 読み上げ中のプレーンなテキスト
*   **戻り値**: なし
*   **呼び出す外部関数**: `VRMAvatar.setViseme()`

#### `listen(onFinalResult, isGeminiMode)`
*   **処理概要**: ユーザーのマイク音声入力を開始する。ブラウザが `SpeechRecognition`（Web Speech API）に対応していない場合は、`isGeminiMode`（Gemini APIキーが存在する）を確認し、MediaRecorderを用いたマイク録音（`startMicRecording`）に自動で処理を切り替える。
*   **引数**:
    *   `onFinalResult` (`function`): テキスト化された文字列（または音声データのBase64オブジェクト）を受け取るコールバック
    *   `isGeminiMode` (`boolean`): Gemini音声入力が許可されているかどうかのフラグ
*   **戻り値**: なし

#### `startMicRecording(onFinalResult)`
*   **処理概要**: デバイスのマイクへアクセス（`getUserMedia`）し、録音用ストリームを開始する。WebMまたはiOS/Safari互換のMP4形式で5秒間録音を行い、停止した段階で FileReader を用いて録音バイナリをBase64文字列に変換し、コールバック経由で送信する。
*   **引数**: `onFinalResult` (`function`)
*   **戻り値**: `Promise<void>`

#### `pcmToWavBlob(base64Pcm)`
*   **処理概要**: Gemini API から返却されるPCM生バイナリ（ヘッダーなし、24000Hz、モノラル、16ビット）の先頭に、ブラウザがWAVとして解釈できる「44バイトの標準WAVヘッダー（RIFF/WAVEチャンク、サンプリング周波数、ビットレート等）」を作成して連結し、Blobオブジェクトを構築する。
*   **引数**:
    *   `base64Pcm` (`string`): Base64形式のPCMデータ
*   **戻り値**: `Blob`: WAVヘッダー付き音声Blob

---

## 2. Gemini PCM音声データへのWAVヘッダー注入仕様

Gemini APIから返るPCMバイナリをブラウザで鳴らすため、先頭に以下の44バイトのWAVヘッダーを配列操作で作成して結合している。

```
バイトオフセット  | サイズ (Byte) | 格納される値 (WAVヘッダー定義仕様)
-----------------------------------------------------------------
0x00 - 0x03    | 4            | "RIFF" (文字列定数)
0x04 - 0x07    | 4            | ファイル総サイズ - 8 (Little Endian)
0x08 - 0x0B    | 4            | "WAVE" (文字列定数)
0x0C - 0x0F    | 4            | "fmt " (文字列定数)
0x10 - 0x13    | 4            | 16 (fmtチャンクのサイズ = 16バイト)
0x14 - 0x15    | 2            | 1 (音声フォーマット = リニアPCM)
0x16 - 0x17    | 2            | 1 (チャンネル数 = モノラル)
0x18 - 0x1B    | 4            | 24000 (サンプリング周波数 = 24kHz)
0x1C - 0x1F    | 4            | 48000 (データ速度 = 24000Hz * 2バイト)
0x20 - 0x21    | 2            | 2 (ブロックサイズ = チャンネル数 * (ビットレート/8))
0x22 - 0x23    | 2            | 16 (ビット数 = 16bit)
0x24 - 0x27    | 4            | "data" (文字列定数)
0x28 - 0x2B    | 4            | 純粋なPCMデータサイズ (ファイル総サイズ - 44)
-----------------------------------------------------------------
0x2C 〜        | -            | [本物のPCM音声データ（バイナリ）]
```
