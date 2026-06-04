# Alpha Synapse 仕様書インデックス

本ディレクトリには、対話型3DアバターAIアシスタントシステム **Alpha Synapse** の各プログラムファイルごとの詳細な仕様書が格納されています。

---

## 1. ファイル別プログラム仕様書の一覧

各ファイルの詳細な変数・関数・フロー仕様は、以下の個別ドキュメントを参照してください。

*   **[main.js 仕様書](file:///c:/Users/owner/Documents/lab/Antigravity/alpha-synapse/docs/specifications/main.md)**
    *   システム全体の初期化、ライト、カメラ、描画ループ、WebXRコントローラーの入力判定およびレイキャスト計算。
*   **[vrm_avatar.js 仕様書](file:///c:/Users/owner/Documents/lab/Antigravity/alpha-synapse/docs/specifications/vrm_avatar.md)**
    *   VRMアバターの読み込み、関節ねじれ防止処理、呼吸・瞬き・LookAt（視線追従）、および口パク処理。
*   **[ai_brain.js 仕様書](file:///c:/Users/owner/Documents/lab/Antigravity/alpha-synapse/docs/specifications/ai_brain.md)**
    *   会話コンテキスト管理、LLM（Gemini/Ollama/Offline）へのクエリ送信、感情タグのパース。
*   **[voice_system.js 仕様書](file:///c:/Users/owner/Documents/lab/Antigravity/alpha-synapse/docs/specifications/voice_system.md)**
    *   マイク音声のSTT認識（認識非対応時の録音フォールバック）、TTS音声合成の振り分けとWAVヘッダーの自動注入。
*   **[floating_hud.js 仕様書](file:///c:/Users/owner/Documents/lab/Antigravity/alpha-synapse/docs/specifications/floating_hud.md)**
    *   3D浮遊型ディスプレイ（HolographicPanel）と tactical サークル（TacticalRadar）のCanvas描画と回転。
*   **[news_portal.html 仕様書](file:///c:/Users/owner/Documents/lab/Antigravity/alpha-synapse/docs/specifications/news_portal.md)**
    *   `<iframe>`内でのYahoo!ニュースRSSおよびWikipedia検索結果の取得、段階的CORSプロキシ回避。

---

## 2. 共通使用ライブラリ・パッケージ

システムが依存している主要パッケージ一覧。

| ライブラリ / パッケージ | バージョン範囲 | 用途・役割 |
| :--- | :--- | :--- |
| **Three.js** (`three`) | `^0.184.0` | WebGLを用いた3D空間の作成、カメラ、ライト、コントローラー、および描画ループの制御。 |
| **three-vrm** (`@pixiv/three-vrm`) | `^3.5.3` | 人型3Dモデル規格「VRM」のロードおよび表情（ブレンドシェイプ）、関節（スケルトン）、揺れ物の制御。 |
| **Vite** (`vite`) | `^8.0.12` | 開発環境のビルド、モジュールバンドル、およびローカルAPIプロキシサーバーの提供。 |
| **Web Speech API** | ブラウザ標準 | テキストから音声への変換（TTS）およびマイク音声の認識（STT）。 |
| **MediaRecorder API** | ブラウザ標準 | 音声認識非対応の環境における音声データ録音。 |

---

## 3. 環境変数および永続データ (LocalStorage)

### 3.1 外部プログラム環境変数
ローカルAIエンジン（Ollama）を動作・連携させるために以下の環境変数を使用する。

*   `OLLAMA_ORIGINS`
    *   **値**: `*`
    *   **用途**: ブラウザからのCORS制限を解除し、外部オリジンからの接続をOllamaサーバーに許可する。
*   `OLLAMA_HOST`
    *   **値**: `0.0.0.0`
    *   **用途**: Quest 3などの外部機器からPC内のOllamaへアクセスできるように、すべてのIPアドレスからの接続を待ち受ける。

### 3.2 LocalStorage 永続キー
アプリの設定パネルの保存値およびUI状態をブラウザに永続化するために使用される。

| キー名 | デフォルト値 | 設定内容 |
| :--- | :--- | :--- |
| `alpha_sync_mode` | `'offline'` | 同期動作モード。`'offline'`、`'gemini'`、`'ollama'`。 |
| `alpha_gemini_key` | `''` | Google Gemini API キー。 |
| `alpha_gemini_model` | `'gemini-3.5-flash'` | 使用する Gemini LLM モデル名。 |
| `alpha_gemini_tts_model`| `'auto'` | 音声合成に使用する Gemini TTS モデル名（`'auto'` / `'gemini-2.5-flash-preview-tts'` / `'gemini-3.1-flash-tts'`）。 |
| `alpha_ollama_endpoint`| `'http://localhost:11434'` | Ollama API のエンドポイントURL。 |
| `alpha_ollama_model` | `'gemma2'` | Ollama で稼働させるローカル LLM モデル名。 |
| `alpha_selected_voice` | `'Gemini - Leda (優雅な女性ボイス)'` | アプリケーションが喋るための選択ボイス。 |
| `alpha_dismiss_ollama_prod_warn`| `'false'` | 本番公開時のOllama混在コンテンツ接続警告モーダルの「再表示しない」チェック判定。 |

---

## 4. 全体システム連携フロー図

### 4.1 会話・音声合成シーケンス

```mermaid
flowchart TD
    Input([ユーザーの発話・入力]) --> Chirp[VoiceSystem: ChirpSE再生]
    Chirp --> Pose[VRMAvatar: thinkingポーズへ]
    Pose --> Brain[AIBrain: コンテキスト合成 & LLMへ送信]
    Brain --> Parse[AIBrain: 感情タグ [happy] 等の抽出]
    Parse --> Clean[感情タグを削除したテキストの作成]
    Clean --> AV_Exp[VRMAvatar: 表情 & ポーズ変更]
    Clean --> Subtitle[UI: 字幕描画]
    Clean --> TTS{音声合成 selectedVoice の種類判定}
    TTS -- Gemini TTS --> GemTTS[AIBrain: generateAudioFromText]
    TTS -- クラウド --> CldTTS[VoiceSystem: /api/tts フェッチ]
    TTS -- ローカル --> LocTTS[VoiceSystem: SpeechSynthesisUtterance]
    GemTTS & CldTTS -- エラーフォールバック --> LocTTS
    GemTTS & CldTTS & LocTTS --> Play[VoiceSystem: スピーカーから再生]
    par リアルタイム同期
        Play --> Lip[VoiceSystem: 母音に応じたリップシンク]
        Play --> Eq[VoiceSystem: 音量に応じたイコライザー波形]
    end
    Play --> Finish([発話終了・アバターを idle 状態へリセット])
```
