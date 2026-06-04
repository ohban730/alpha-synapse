# floating-hud.js プログラム仕様書

[floating-hud.js](file:///c:/Users/owner/Documents/lab/Antigravity/alpha-synapse/src/floating-hud.js) は、3Dアバターの左右に浮かぶ、近未来SF（アイアンマン風ホログラム）インターフェースである立体浮遊ディスプレイ（`HolographicPanel`）と、回転するインジケーターダイヤル（`TacticalRadar`）の描画および動作を制御するスクリプトである。

---

## 1. クラス `HolographicPanel` 仕様 (右側ディスプレイ)

### 1.1 主要プロパティ

| プロパティ名 | 型 | 説明 |
| :--- | :--- | :--- |
| `canvas` | `HTMLCanvasElement` | メモリ上に作成される2D描画用キャンバス（デフォルトサイズ：512x384）。 |
| `ctx` | `CanvasRenderingContext2D` | キャンバスの2Dグラフィック描画コンテキスト。 |
| `texture` | `THREE.CanvasTexture` | キャンバスに描かれたグラフィックを3D空間のポリゴンに貼り付けるテクスチャオブジェクト。 |
| `mesh` | `THREE.Mesh` | 空間に浮き上がる 1.3m x 0.9m の平面（PlaneGeometry）メッシュ。 |
| `isDetailView` | `boolean` | VRコントローラー操作時に、特定のニュースを選択した「詳細ビュー」に入っているかを示すフラグ。 |
| `activeDetailItem`| `object` | 詳細ビュー表示中のニュースデータ（タイトル、本文、原本URL）。 |
| `scale` | `number` | ディスプレイの現在の拡大率。 |
| `opacity` | `number` | ディスプレイマテリアルの現在の不透明度。 |
| `targetScale` | `number` | フェードイン/アウトアニメーション時の目標拡大率。非表示時は `0.001`、表示時は `1.0`。 |
| `targetOpacity` | `number` | アニメーション時の目標不透明度。非表示時は `0.0`、表示時は `1.0`。 |

### 1.2 主要メソッド

#### `drawCanvas(title, lines)`
*   **処理概要**: メモリ上の2Dキャンバスに、半透明の暗濃背景、ネオンブルーの外枠、四隅のL字型ブラケット、背景のサイバーグリッドドット、および上部の「タイトルバー」を描画する。
    *   **詳細ビュー (`isDetailView === true`)**: ニュースタイトルと本文を折り返し（Word Wrap）付きでテキスト描画し、下部に「<< BACK TO FEED」および「OPEN FULL ARTICLE >>」の2つのボタンの枠線を描画する。
    *   **リストビュー**: `rawItems` のデータを3枚のカード（左に1枚、右に上下で2枚）に分割してレイアウト枠を描画する（Cyber Triptych Spatial Grid）。
*   **引数**:
    *   `title` (`string`): ディスプレイ上部に描く大見出し
    *   `lines` (`array`): リスト表示する文字列の配列
*   **戻り値**: なし

#### `updateContent(title, lines)`
*   **処理概要**: `lines` プロパティを書き換えて `drawCanvas()` をコールし、テクスチャの `needsUpdate` フラグを `true` に設定してThree.jsのWebGLレンダラーに再転写を要求する。
*   **引数**: `title` (`string`), `lines` (`array`)
*   **戻り値**: なし
*   **呼び出す内部関数**: `drawCanvas()`

#### `showDetail(item)`
*   **処理概要**: `isDetailView` フラグを有効化し、渡された詳細アイテムを `activeDetailItem` に保存して、詳細表示を描画更新する。
*   **引数**:
    *   `item` (`object`): 表示するニュース/記事データ
*   **戻り値**: なし
*   **呼び出す内部関数**: `updateContent()`

#### `showList()`
*   **処理概要**: `isDetailView` フラグを無効化し、保存されていたリスト表示用データ（`savedTitle`, `savedLines`）に戻して描画更新する。
*   **引数**: なし
*   **戻り値**: なし
*   **呼び出す内部関数**: `updateContent()`

#### `setPosition(avatarPos, isVR)`
*   **処理概要**: アバターの基本位置に基づいて浮遊座標を設定する。VRモード時には、コントローラーによる狙撃判定がブレないよう、通常より手前かつユーザーの目線高さ（Yオフセット = 1.15m）に配置する。
*   **引数**:
    *   `avatarPos` (`THREE.Vector3`): アバターの位置座標
    *   `isVR` (`boolean`): WebXRプレゼンテーション中かどうかのフラグ
*   **戻り値**: なし

#### `update(time, delta, isVR)`
*   **処理概要**: 描画フレームごとの更新。拡大率（`scale`）と不透明度（`opacity`）を目標値に向けてLERP補完し、拡大率が `0.01` 以下の場合はレンダリング計算から除外するため `mesh.visible = false` にする。PCモード時はディスプレイをサイン波（`bob`）で上下にゆっくり浮遊させ、最後に常にカメラの方を向くように回転（Billboarding：Y軸回転のみ）させる。
*   **引数**:
    *   `time` (`number`): 累積秒数
    *   `delta` (`number`): 前フレームからの経過秒数
    *   `isVR` (`boolean`): WebXR稼働フラグ
*   **戻り値**: なし

---

## 2. クラス `TacticalRadar` 仕様 (左側サークル)

### 2.1 主要プロパティ

| プロパティ名 | 型 | 説明 |
| :--- | :--- | :--- |
| `group` | `THREE.Group` | 複数のインジケーター円盤や直線メッシュをまとめたグループオブジェクト。 |
| `mesh1` | `THREE.Mesh` | 外側のタティカルリング（ワイヤーフレーム、水色、RingGeometry）。 |
| `mesh2` | `THREE.Mesh` | 内側のターゲティングリング（ワイヤーフレーム、オレンジ色、RingGeometry）。 |
| `lines` | `THREE.LineSegments` | 中央の照準用十字線（LineSegments）。 |
| `offset` | `THREE.Vector3` | アバター位置からの浮遊相対距離。デフォルトは `(-1.1, 0.25, -0.2)`。 |

### 2.2 主要メソッド

#### `setPosition(avatarPos, isVR)`
*   **処理概要**: アバターの位置に基づいて、アバターの左手前の空中（VR時は胸元高めのやや手前）にサークルを配置する。
*   **引数**: `avatarPos` (`THREE.Vector3`), `isVR` (`boolean`)
*   **戻り値**: なし

#### `update(time, delta, isVR)`
*   **処理概要**: 毎フレームの更新。PCモード時は `FloatingPanel` と同様に上下に浮遊（bob）させる。リング1（`mesh1`）を時計回り、リング2（`mesh2`）を反時計回り、十字線（`lines`）を低速回転させ、最後にグループ全体がカメラの正面を向くように回転（Billboarding：全軸）させる。
*   **引数**: `time` (`number`), `delta` (`number`), `isVR` (`boolean`)
*   **戻り値**: なし

---

## 3. レンダリング・ビルボード制御フロー

```mermaid
flowchart TD
    Start([描画更新ティック開始]) --> A[時間変数 time と前フレームからの差分 delta を計算]
    A --> Scale[scale & opacity を target値 に向けて LERP 補間]
    Scale --> Visible{scale > 0.01 か？}
    
    Visible -- No --> Hide[mesh.visible = false に設定して描画をスキップ] --> End([スキップ完了])
    Visible -- Yes --> Show[mesh.visible = true に設定]
    
    Show --> VR_Check{isVR === true (VRプレゼン中) か？}
    VR_Check -- Yes --> Bob_Off[浮遊ボビング処理を無効化: bob = 0]
    VR_Check -- No --> Bob_On[サイン/コサイン波による浮遊を加算: bob = Math.sin(time)*0.04]
    
    Bob_Off & Bob_On --> Pos[mesh.position にアバター基準の offset と bob を適用]
    
    Pos --> Cam[カメラのワールド空間位置 camPos を取得]
    Cam --> Rotation[Y軸直立ビルボード: targetVector = camPos.x, mesh.y, camPos.z]
    Rotation --> Look[mesh.lookAt(targetVector)]
    Look --> End
```
