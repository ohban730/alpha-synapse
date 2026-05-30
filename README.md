# 🌌 ALPHA Augmented Reality - Neural Link Simulator

[![Cyberpunk Vibe](https://img.shields.io/badge/Theme-Cyberpunk_Visor-orange.svg?style=flat-square)](#)
[![Tech Stack](https://img.shields.io/badge/Tech-Three.js_|_VRM_|_WebXR-00f3ff.svg?style=flat-square)](#)

ユーザーの視界に高解像度投影される専属AIアシスタント『アルファ』と精神同期し、未来的なタクティカルAR-HUDを通じて音声やテキストで対話ができる、3D拡張現実シミュレーターです。

---

## 📋 動作前提条件 (Prerequisites)

本プロジェクトをご自身のPCでビルド・動作させるには、以下がインストールされている必要があります：

*   **Node.js**: `v18.0.0` 以上 (LTS `v20.0.0` 以上推奨 / **検証済み環境: `v24.15.0`**)
*   **NPM**: `v10.0.0` 以上 (**検証済み環境: `v11.12.1`**)

---

## 🚀 クローンと初期セットアップ

リポジトリをご自身のPCにクローンし、依存関係を解決してローカルHTTP開発サーバーを立ち上げます。

```bash
# 依存関係のインストール
npm install

# ローカル開発サーバーの起動 (既定ポート: http://localhost:3000)
npm run dev
```

---

## ☁️ クラウドLLM（Google Gemini API）連携ガイド

最も高精度で、流暢な音声による会話をすぐに楽しめる**推奨モード**です。

### 1. APIキーの取得
1. [Google AI Studio](https://aistudio.google.com/) にアクセスし、無料の API キーを発行します。
2. 発行された API キーをコピーします。

### 2. アプリでの設定手順
1. アプリ画面（デモサイト、またはローカル起動画面）を開きます。
2. 画面右側の **「NEURAL LINK OPTIONS」** パネルを開きます。
3. **「INTELLIGENCE SYNC CORE」** で **「Gemini API (推奨/オンライン)」** を選択します。
4. **「GEMINI API KEY」** 欄にコピーした API キーを貼り付けます。
5. **「GEMINI MODEL」** で利用したいモデル（既定: `Gemini 3.5 Flash`）を選択します。
6. **「ニューラルリンクを同期」** ボタンをクリックします。

### 💎 Geminiモードのメリット
*   **最高峰の知能**: 最新のLLMによるスムーズで賢い対話が可能です。
*   **ネイティブ音声合成 (Native TTS)**: 高音質な6種類の公式AIボイス（Leda, Aoede 等）による美しく自然な日本語発声に対応しています。
*   **音声入力の直接処理**: 音声を直接認識してアルファに伝達する「マイク録音送信」が機能します。

---

## 🛠️ ローカルLLM（Ollama）連携ガイド

クラウドAPIやインターネット接続を行わず、完全プライベートかつ無料で無制限にAIと対話できる**上級者向けモード**です。

> [!WARNING]
> デモWebサイト（HTTPS）からローカルサービス（HTTP）への接続は、ブラウザのセキュリティ制限（CORS/Mixed Content）がかかります。
> ローカルLLMモードをお試しいただく場合は、**必ず本リポジトリをご自身のPCにクローンし、ローカルHTTP環境（`http://localhost:3000`）で起動して実行してください。**

### 1. OllamaのCORS（クロスオリジン許可）設定
ブラウザの安全制限をバイパスしてWebアプリからローカルのOllamaにリクエストを通すため、環境変数 `OLLAMA_ORIGINS` をセットした状態で起動する必要があります。

#### 💻 Windowsの場合 (推奨: システム環境変数への登録)
1. `Win + R` キーを押し、`sysdm.cpl` を入力して実行します（システムのプロパティ）。
2. **「詳細設定」** タブ ＞ 一番下の **「環境変数...」** をクリックします。
3. 新規に変数を作成します：
   * **変数名:** `OLLAMA_ORIGINS`
   * **変数値:** `*`
4. すべてOKをクリックして適用します。
5. **重要:** タスクバーのシステムトレイにある Ollama アイコンを右クリックして **「Quit Ollama」で完全に終了** させてから、スタートメニューから再起動してください。

*(一時的にターミナルだけで試す場合は、コマンドプロンプトで `set OLLAMA_ORIGINS=*` または PowerShellで `$env:OLLAMA_ORIGINS="*"` を実行したあと、同ウィンドウ内で `ollama serve` を実行します)*

#### 🍎 macOSの場合
Ollama アプリを一度終了させた状態で、ターミナルから以下を実行して起動します：
```bash
OLLAMA_ORIGINS="*" open -a Ollama
```

#### 🐧 Linuxの場合
システムサービスの設定を編集します：
```bash
sudo systemctl edit ollama.service
```
開いたエディタに以下を追記して保存します：
```ini
[Service]
Environment="OLLAMA_ORIGINS=*"
```
その後、サービスをリロードして再起動します：
```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

### 2. モデルのダウンロード (Pull)
本シミュレーターの既定モデル（またはお好みのモデル）を事前にローカルPCにダウンロードしておきます。

```bash
# Llama 3.2 3Bモデルをダウンロードする場合 (推奨軽量モデル)
ollama pull llama3.2
```

### 3. アプリケーションでの接続確認
1. ブラウザで `http://localhost:3000` を開きます。
2. 画面右側の **「NEURAL LINK OPTIONS」** パネルを開きます。
3. **「INTELLIGENCE SYNC CORE」** で **「Ollama (ローカルLLM)」** を選択します。
4. **「MODEL NAME」** にダウンロードした正確なモデル名（例: `llama3.2`）を入力します。
5. **「ニューラルリンクを同期」** ボタンをクリックします。
6. チャットや音声対話を行い、アルファが応答すれば同期は成功です！

---

## ⚡ トラブルシューティング (Ollama接続時)

### 🔴 会話時に "Failed to fetch"（接続失敗）のエラーが出る
1. **Ollamaが起動しているか確認:**
   ブラウザで `http://localhost:11434` にアクセスし、画面に `Ollama is running` と表示されるか確認してください。
2. **CORS設定 of 漏れ:**
   `OLLAMA_ORIGINS` 環境変数が適用されていない可能性が高いです。特にWindowsの場合、Ollamaトレイアイコンからの「終了＆再起動」が行われているかを再確認してください。
3. **HTTPS本番デモサイトからのアクセス制限:**
   本番HTTPSの公開サイトからアクセスする場合、一部のブラウザのMixed Content規制に引っかかる場合があります。その場合は上記の手順に従い、ローカルで `npm run dev`（HTTP接続）した環境からアクセスしてください。

---

## 🚀 デプロイと技術スタック

本アプリは、ビルド後に純粋な静的ファイルのみで稼働するため、**Cloudflare Pages** や Netlify、Vercel 等に1ステップでデプロ进入可能です。

*   **Core**: Vanilla HTML5, CSS3, ES6 JavaScript
*   **3D Graphics**: Three.js, @pixiv/three-vrm (3D Avatar Engine)
*   **AI Backend**: Google Gemini API (v1beta beta-tts), Ollama (Local LLM Core)
*   **AR/VR**: WebXR Device API (Meta Quest 3で動作確認)
