# ai-brain.js プログラム仕様書

[ai-brain.js](file:///c:/Users/owner/Documents/lab/Antigravity/alpha-synapse/src/ai-brain.js) は、AIとの対話処理、LocalStorageによる設定の永続化、会話履歴（コンテキストメモリ）の保持と自動削減、およびAIの応答文から感情表現タグの抽出処理を担当するクラス `AIBrain` を定義するスクリプトである。

---

## 1. クラス `AIBrain` 仕様

### 1.1 主要プロパティ

| プロパティ名 | 型 | 説明 |
| :--- | :--- | :--- |
| `avatar` | `VRMAvatar` | 連動するVRMアバターのインスタンス。表情やポーズの適用指示を送るために使用。 |
| `mode` | `string` | 現在の同期コアモード。`'offline'`（スタンドアロン）、`'gemini'`（Google Gemini API）、`'ollama'`（ローカルOllamaサーバー）。 |
| `history` | `array` | 直近の会話データ配列。要素は `{ role: 'user'\|'alpha', text: string }`。最大20要素（10往復分）に制限。 |
| `geminiKey` | `string` | Google Gemini API キー。設定パネルから入力される。 |
| `geminiModel` | `string` | 対話に使用する Gemini のモデル名。デフォルトは `'gemini-3.5-flash'`。 |
| `geminiTtsModel` | `string` | 音声合成（Gemini Native TTS）に使用するモデル名（`'auto'` / `'gemini-2.5-flash-preview-tts'` / `'gemini-3.1-flash-tts'`）。 |
| `ollamaEndpoint` | `string` | ローカルに起動している Ollama の API アドレス。デフォルトは `'http://localhost:11434'`。 |
| `ollamaModel` | `string` | Ollama上で稼働しているダウンロード済みの LLM モデル名。デフォルトは `'gemma2'`。 |
| `systemPrompt` | `string` | AIのキャラクター『アルファ』としての性格や口調、出力文字制限（100〜150文字程度）、および感情タグ（`[happy]`, `[angry]`, `[sad]`, `[relaxed]`, `[surprised]`）を文末に付加するためのシステム命令テキスト。 |

---

### 1.2 主要メソッド

#### `saveToStorage()`
*   **処理概要**: 現在メモリ上にある動作モード、APIキー、エンドポイントURL、モデル名などの設定項目をブラウザの LocalStorage に書き込む。
*   **引数**: なし
*   **戻り値**: なし

#### `loadFromStorage()`
*   **処理概要**: ページ読み込み時に LocalStorage から保存済みの設定データを読み出し、プロパティを初期化する。値が未設定の場合は初期デフォルト値を代入する。
*   **引数**: なし
*   **戻り値**: なし

#### `generateResponse(prompt, audioBase64, mimeType)`
*   **処理概要**: 対話リクエストを受けるメイン窓口。ユーザーの発言を履歴に追加し、動作モードに応じて外部API（Gemini/Ollama/オフライン）をコールする。レスポンス文字列を受信したら、文末の感情タグを切り出してアバターにポーズ・表情を適用し、タグを除去したプレーンなテキストを返す。
*   **引数**:
    *   `prompt` (`string`): ユーザーが入力したテキスト（音声入力時は空文字の場合がある）
    *   `audioBase64` (`string` | `null`): ユーザーの音声入力ファイル（Base64形式、Gemini用）
    *   `mimeType` (`string`): 音声データのMIMEタイプ
*   **戻り値**: `Promise<{ text: string, expression: string }>`: 感情タグを取り除いたセリフ本文と、検出された感情文字列
*   **呼び出す外部・内部関数**:
    *   `queryGemini()`
    *   `queryOllama()`
    *   `queryOffline()`
    *   `parseResponseEmotion()`
    *   `addHistory()`

#### `queryGemini(prompt, audioBase64, mimeType)`
*   **処理概要**: 過去の対話履歴を Gemini API の `contents` 形式に整形し、システムプロンプトと現在の入力をくっつけ、Googleの `v1beta/models` エンドポイントに対して HTTP POST リクエストを送信し、生成テキストを取得する。音声データが存在する場合は、`inlineData` としてバイナリを直接送信する。
*   **引数**:
    *   `prompt` (`string`): ユーザーのテキスト入力
    *   `audioBase64` (`string` | `null`): 音声バイナリ
    *   `mimeType` (`string`): 音声のMIME形式
*   **戻り値**: `Promise<string>`: 生成されたテキスト
*   **呼び出す外部関数**: `fetch()` (HTTPS API リクエスト)

#### `queryOllama(prompt)`
*   **処理概要**: Ollama の `/api/chat` API に向けてリクエストを送信する。
    *   **ローカル開発環境 (localhost)**: ブラウザのHTTPS Mixed Content制限を回避するため、Viteサーバープロキシである `/api/ollama/api/chat` にリダイレクトして送信。
    *   **本番静的環境**: ユーザーが設定した外部エンドポイントURLへ直接送信する。
*   **引数**:
    *   `prompt` (`string`): ユーザーのテキスト入力
*   **戻り値**: `Promise<string>`: 生成されたテキスト
*   **呼び出す外部関数**: `fetch()` (HTTP API リクエスト)

#### `queryOffline(prompt)`
*   **処理概要**: インターネット未接続あるいはAPIキー未登録時用のフォールバック処理。ユーザー入力テキストに「ニュース」「天気」「タスク」「アップデート」などの特定のキーワードが含まれているかを判別し、あらかじめ定義された『アルファ』のオフライン用セリフテンプレートからランダムに返答を返す。
*   **引数**:
    *   `prompt` (`string`): ユーザーのテキスト入力
*   **戻り値**: `string`: 返答テキスト

#### `parseResponseEmotion(rawText)`
*   **処理概要**: 正規表現 `/\[(happy\|angry\|sad\|relaxed\|surprised)\]/i` を用いて、テキスト末尾に含まれる感情タグを検索し、感情名を抽出した上で、セリフ本体からそのタグ部分を削除する。その後、抽出した感情名をアバターのブレンドシェイプとポーズに即時反映させる。
*   **引数**:
    *   `rawText` (`string`): LLMから届いた未処理の出力テキスト
*   **戻り値**: `{ text: string, expression: string }`: クリーンになったテキストと感情キー
*   **呼び出す内部関数**: `applyAvatarExpression()`

#### `applyAvatarExpression(emotion)`
*   **処理概要**: 表情名（`happy`, `angry`, `sad`, `surprised`, `relaxed`）に基づき、[vrm-avatar.js](file:///c:/Users/owner/Documents/lab/Antigravity/alpha-synapse/src/vrm-avatar.js) 側の `setExpression` と `setPose` をコールして瞬時にアバターの見た目を変化させる。また、8秒間発話がなかった場合に自動で `idle` ポーズに戻すためのタイマー（`poseTimeout`）の管理も行う。
*   **引数**:
    *   `emotion` (`string`): パースされた感情キー
*   **戻り値**: なし
*   **呼び出す外部関数**:
    *   `VRMAvatar.setExpression()`
    *   `VRMAvatar.setPose()`

---

## 2. 感情タグの抽出・パース処理フロー

```mermaid
flowchart TD
    Start([LLMから生テキストを受信]) --> A[正規表現パターン /[happy|angry|sad|relaxed|surprised]/i を適用]
    A --> B{タグが検出されたか？}
    
    B -- Yes --> C[検出された感情名を expression に代入]
    C --> D[生テキストから [happy] 等の文字列を完全に除去して cleanText に代入]
    
    B -- No --> E[expression にデフォルト値 'relaxed' を代入]
    E --> F[生テキストをそのまま cleanText に代入]
    
    D & F --> G[applyAvatarExpression: アバターの表情・ポーズを変更]
    G --> H[addHistory: 会話履歴に cleanText を追加]
    H --> End([パース処理完了、cleanTextとexpressionを返却])
```
