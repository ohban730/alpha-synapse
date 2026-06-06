# 1. 基礎知識と全体アーキテクチャ

この章では、プログラムのコードを読む前に知っておくべき**「超基本的な前提知識」**と、アプリ全体がどのようにデータをやり取りしているかの**「全体像」**を学びます。

---

## 💡 主要技術の「たとえ話」解説

Alpha Synapse はいくつかの近代的な技術を組み合わせて作られています。これらを「レストラン」に例えて理解してみましょう。

```
【レストランに例えた全体図】

 🍳 [調理場 / 食材倉庫] ----- 🚚 [配達員] ------> 🍽️ [お客様のテーブル]
    (Node.js / npm)          (Vite)            (ブラウザ / WebGL)
                                                    │ (立体映像化)
                                                    ▼
                                               🥽 [VR/AR体験]
                                                  (WebXR)
```

### 1. JavaScript (JS) とは？
- **役割**: テーブルの上の料理（画面のボタンや3Dキャラ）に動きを与える**「筋肉」**です。
- **解説**: HTMLが「骨組み（テキストや配置）」、CSSが「化粧（色やデザイン）」だとすると、JavaScriptは「動かす仕組み（ボタンを押したらキャラが笑う、マイクの音を拾うなど）」を担当します。

### 2. Node.js & npm とは？
- **役割**: レストランの**「調理場（環境）」**と、世界中から便利な下ごしらえ済み食材を取り寄せる**「食材カタログ（ツール）」**です。
- **解説**:
  - **Node.js**: 本来ブラウザの中でしか動かない JavaScript を、あなたのパソコンのOS上で直接動かすためのソフトです。
  - **npm (Node Package Manager)**: 世界中のプログラマーが作った便利なプログラム（3Dを描く部品など）を、コマンド一つでダウンロードして管理するシステムです。

### 3. Vite（ヴィート）とは？
- **役割**: 調理場で作った料理（バラバラのJSやCSSファイル）を素早くまとめて、お客様のテーブルに届ける**「超特急の配達員」**です。
- **解説**: 開発中にファイルを書き換えると、ブラウザの画面を一瞬で自動更新（ホットリロード）してくれます。また、ローカルでテストするための臨時の「開発用Webサーバー」も立ち上げてくれます。

### 4. Three.js とは？
- **役割**: ブラウザの中に**「立体的な暗闇空間（3Dスタジオ）」**を作り、カメラやライト、3Dモデルを配置する**「映画監督のツール」**です。
- **解説**: 通常、ブラウザは2次元（平面的）な表現しかできませんが、Three.js を使うことで、ブラウザの中に奥行きのある3D空間を作り出し、キャラクターを立たせることができます。

### 5. WebXR とは？
- **役割**: ブラウザの中の3Dスタジオを、Meta Quest 3 などの**「VR/ARゴーグルの立体視界に転送する橋渡し」**です。
- **解説**: ゴーグルを被ったときに、左右の目に少しズレた映像を届けることで、目の前に本当にアバターやHUD画面が浮かんでいるような立体感（没入感）を作り出します。

---

## 🌐 Webアプリが通信する仕組み（APIとプロキシ）

アプリがAIと会話したり、ニュースを取得したりする時、インターネットを通じて別のコンピューター（サーバー）と通信しています。

### API (Application Programming Interface) とは？
- **「窓口」**のようなものです。
- 例えば、こちらから「Gemini API」という窓口にテキストとAPIキーを渡すと、Geminiが「AIの返答」を返してくれます。

### プロキシ（代理人）とは？ なぜ必要なのか？
- ブラウザには**「CORS（クロスオリジンリソース共有）制限」**というセキュリティルールがあります。これは、「いま開いているWebサイトと違う場所（別のドメイン）にあるデータは、ブラウザから直接勝手にダウンロードしてはいけない」というルールです。
- このルールがあるため、ブラウザから直接「Yahoo!ニュースのRSS」や「Googleの音声合成API」を叩こうとすると、ブラウザが通信をブロックしてしまいます。
- そこで、開発サーバーである **Vite** が**「プロキシ（代理人）」**となり、ブラウザの代わりに裏側でデータを取ってきてブラウザに手渡します。こうすることで、ブラウザのセキュリティ制限を回避しています。

---

## 🏗️ システム構成図 (System Components)

システム全体のコンポーネント接続・関係図です。ブラウザ（フロントエンド）、Vite開発プロキシ、Python中継バックエンド、Ollama（LLM）、および Style-Bert-VITS2（TTS）の相互接続関係を示しています。

```mermaid
graph TD
    subgraph Client ["クライアントサイド（ブラウザ・WebGL）"]
        A["UI（HTML・CSS）"] --- B["全体指揮（main.js）"]
        B --- C["3Dアバター（vrm-avatar.js）"]
        B --- D["AI脳中継（ai-brain.js）"]
        B --- E["音声・再生キュー（voice-system.js）"]
        B --- F["3D HUD（floating-hud.js）"]
        E -. "リップシンク（口パク）" .-> C
    end

    subgraph DevServer ["Vite 開発サーバー"]
        G["Vite Proxy（/api/local-brain）"]
    end

    subgraph Backend ["中継バックエンド"]
        H["Python サーバー（server.py）"]
    end

    subgraph LocalAI ["ローカル AI サービス"]
        I["Ollama（gemma2:9b）"]
        J["Style-Bert-VITS2（jvnv-F1-jp）"]
    end

    D -->|"HTTPS リクエスト・SSE"| G
    G -->|"HTTP 8000 ポート中継"| H
    H -->|"HTTP 11434 チャット要求"| I
    H -->|"HTTP 5000 音声合成要求"| J
    E -->|"音声バイナリ（Base64）"| D

    classDef client fill:#1f3d52,stroke:#00f3ff,stroke-width:2px,color:#fff;
    classDef proxy fill:#2e245c,stroke:#a600ff,stroke-width:2px,color:#fff;
    classDef backend fill:#1f5c3d,stroke:#00ff66,stroke-width:2px,color:#fff;
    classDef ai fill:#5c251f,stroke:#ff3c00,stroke-width:2px,color:#fff;

    class A,B,C,D,E,F client;
    class G proxy;
    class H backend;
    class I,J ai;
```

---

## 🌐 全体のデータフロー（情報の流れ）

ユーザーがアクションを起こしてから、アバターが反応してしゃべるまでの、システム全体のデータの流れです。

```mermaid
sequenceDiagram
    autonumber
    actor U as "ユーザー"
    participant UI as "ブラウザUI・VRコントローラー（main.js）"
    participant VS as "音声・イコライザー（voice-system.js）"
    participant AB as "AIの脳みそ（ai-brain.js）"
    participant AV as "3Dアバター（vrm-avatar.js）"
    participant HUD as "3D画面（floating-hud.js）"

    %% 1. 入力フェーズ
    U->>UI: テキスト入力 または 音声対話ボタン押下
    UI->>VS: 音声の聞き取り開始（STT・録音）
    VS-->>UI: ユーザーの話し声をテキスト化（または音声Blob）

    %% 2. AI思考フェーズ
    UI->>AV: 「考えるポーズ［thinking］」に変更指示
    UI->>AB: メッセージを伝達してAIへ問い合わせ
    AB->>AB: 過去の会話履歴（最大20件）とシステムプロンプトを合成
    AB->>AB: API経由でLLM（Gemini・Ollama）にリクエスト送信
    AB-->>UI: AIの返答（例：「こんにちは！［happy］」）

    %% 3. パース・演出フェーズ
    UI->>AB: 返答文から感情タグ［happy］等を抽出
    AB->>AV: 感情に合わせた表情変更（happy）とポーズ指示（喜ぶ）
    UI->>UI: 字幕のタイピング表示アニメーション開始
    
    %% 4. 音声生成・出力フェーズ
    UI->>VS: AIのセリフの音声合成（TTS）を指示
    VS->>AB: ［Geminiモードの場合］音声データの生成を依頼
    AB-->>VS: 音声データ（Base64）を返却
    VS->>VS: ［必要に応じて］WAVヘッダーを注入して再生準備
    
    par 音声再生と視覚フィードバックの連動
        VS->>VS: スピーカーから音声を再生
        VS->>UI: 音量に合わせてイコライザー波形をアニメーション
        VS->>AV: 声のトーンや文字に合わせて「口パク（リップシンク）」指示
    end

    %% 5. ニュース・検索連携 (キーワード検知時)
    Note over UI,HUD: セリフに「ニュース」「検索」が含まれる場合
    UI->>HUD: 3DホログラフHUDを表示
    UI->>UI: 湾曲Webブラウザ（Web Visor iframe）にYahoo・Wikiを読み込み
    UI->>HUD: HUD上に検索要約テキストを描画
```

### ⭕ ローカルAI (Ollama) + 音声合成 (Style-Bert-VITS2) の超低遅延連携フロー

ローカル LLM 応答時の最大レイテンシである「音声合成の待ち時間」を極小化するため、バックエンドとフロントエンドが並行して動く「非同期逐次再生キュー（Audio Pipeline）」を導入しています。

```mermaid
sequenceDiagram
    autonumber
    participant UI as "ブラウザ UI（main.js）"
    participant PY as "バックエンド（server.py）"
    participant OL as "ローカルLLM（Ollama）"
    participant TTS as "ローカル音声合成（SBV2）"
    participant VS as "音声キュー再生（voice-system.js）"
    participant AV as "アバター（vrm-avatar.js）"

    UI->>PY: チャットリクエスト送信（Ollamaモード）
    PY->>OL: チャットストリーム要求（stream：true）
    
    loop Ollama回答ストリーミング中
        OL-->>PY: トークン返却（例：「マスター、」）
        PY-->>UI: トークンを即時SSE転送（type：text）
        UI->>UI: HUD字幕に文字を即時描画（タイプライター遅延なし）
        
        Note over PY: バックエンド内のバッファにテキスト蓄積
        
        Note over PY: 句切れ（「。」「！」など）を検知した瞬間
        PY->>TTS: 感情タグに対応するスタイルで音声合成を非同期要求（POST /voice）
        TTS-->>PY: 生成されたWAV音声バイナリ
        PY-->>UI: 音声データをBase64変換してSSE転送（type：audio）
        UI->>VS: 音声データを再生キューに蓄積（enqueueAudio）
    end
    
    loop 音声キュー再生ループ（非同期並行）
        VS->>VS: キューから取り出してデコード・再生（Blob URL）
        VS->>AV: 再生開始に合わせて表情を変更
        par 音声再生とリップシンク
            VS->>VS: 音声の再生
            VS->>AV: 再生時間中に日本語の音節で口パク（リップシンク）
        end
    end
```

### 👆 データフローのポイント
1. **すべて非同期 (Promise/async/await)**: インターネットを通じた通信（AIの返答待ちなど）は時間がかかるため、プログラムがフリーズしないように「裏側で通信を待ちつつ、画面の処理は動かし続ける」という工夫が随所になされています。
2. **感情タグのパース**: AIが文末に `[happy]` のようなタグを出力し、それをプログラムが検出してアバターの関節の角度（ポーズ）やブレンドシェイプ（表情）の数値を書き換えています。
3. **並行処理**: しゃべっている間、音量に合わせて「イコライザーが揺れる」「アバターの口が動く」「アバターの身体がゆらゆら呼吸する」という複数のアニメーションが同時に並行して実行されています。

---

次の **[第2章：プログラムの解説と仕組みの探究](file:///c:/Users/owner/Documents/lab/Antigravity/alpha-synapse/docs/modules.md)** では、これらのデータフローが具体的にどのファイルのどの部分でプログラミングされているかを詳しく見ていきます。
