# 4. 本番公開とCloudflare Workersの仕組み

この章では、アプリをインターネット上に完全公開する際、どのような仕組みでセキュリティ規制（CORS）を突破しているのか、そしてそれを支える技術である **Cloudflare Workers** について学びます。

---

## ☁️ Cloudflare Workers とは？（サーバーレス超入門）

通常、Webサイトの裏側で動くプログラム（データベースの処理やプロキシ通信など）を動かすためには、「レンタルサーバー」を契約し、常に起動しっぱなしにして管理する必要があります。これには電気代や管理の手間、そして費用（月額数千円など）がかかります。

これを解決するのが **「サーバーレス」** という技術です。中でも **Cloudflare Workers** はその代表例です。

- **役割**: インターネット上の世界中にあるCloudflareの拠点（エッジサーバー）に、**「必要な時だけ一瞬で起動するプログラム（関数）」**を配置する技術です。
- **たとえ話**:
  - **普通のレンタルサーバー**: **「常駐の執事」**。仕事がなくても給料（サーバー維持費）を払い続ける必要があります。
  - **Cloudflare Workers**: **「必要な時だけ一瞬で現れて消える忍者」**。ブラウザから「ニュースを取ってきて！」というリクエストがあった瞬間だけ自動で起動し、仕事を終えると消えます。そのため、無料枠が非常に大きく、アクセスがない時は費用が全くかかりません。

---

## 🌐 なぜ本番公開で Workers が必要なのか？

第3章で学んだ通り、ブラウザには「違う場所（ドメイン）のデータを直接ダウンロードしてはいけない」という **CORS制限** があります。

ローカル開発環境（あなたのパソコンの中）では、**Vite** が「プロキシ（代理人）」となって代わりにデータを取得してくれていましたが、インターネット上にアプリを静的ファイルとして公開（デプロイ）してしまうと、Viteは動いていません。

そのため、ブラウザで直接 Yahoo!ニュースのRSSやGoogle翻訳の音声合成（TTS）を叩く必要が出てきますが、当然ブラウザのCORS制限に引っかかって通信が遮断されてしまいます。

そこで、インターネット上に **「CORS制限をバイパスするための中継プロキシ（忍者）」** として Cloudflare Workers を配置します。

```
【本番環境での通信の流れ】

 [ユーザーのブラウザ (HTTPSの公開サイト)]
      │
      │ 1. 「YahooニュースのRSSを代わりに取ってきて！」(CORS制限なし)
      ▼
 🥷 [Cloudflare Workers (中継プロキシ)]
      │
      │ 2. ブラウザの代わりに直接アクセス (CORS制限を受けない)
      ▼
 📰 [Yahoo!ニュース / Google TTS サーバー]
      │
      │ 3. データを Workers に返却
      ▼
 🥷 [Cloudflare Workers]
      │
      │ 4. レスポンスヘッダーに「アクセスを許可しますよ (* )」という
      │    お墨付き (Access-Control-Allow-Origin: *) を添えてブラウザに戻す
      ▼
 [ユーザーのブラウザ]  <-- お墨付きがあるので、ブラウザがブロックせずにデータを読み込める！
```

### 💡 なぜ Workers だと規制を回避できるのか？
CORS制限はあくまで**「ブラウザ（Google ChromeやSafariなど）」の中のセキュリティルール**です。
ブラウザを介さない「プログラム同士の通信（サーバーからサーバーへのアクセス）」には、CORS制限は一切適用されません。
そのため、Cloudflare Workers という中継地点（サーバー）を挟むことで、安全にデータを取得することができるのです。

---

## 📝 本作におけるプロキシ設定の比較

ローカルで動かす時と、インターネットに本番公開した時で、通信先がどのように切り替わっているかの対比表です。

| 通信の目的 | ローカル環境 (`npm run dev` 時) | 本番公開環境 (デモサイト `https://alpha-xr.org` など) |
| :--- | :--- | :--- |
| **フロントの表示** | `http://localhost:3000` | Cloudflare Pages や Netlify などの静的ホスティング |
| **Yahoo!ニュース取得** | `vite.config.js` のプロキシ設定により `/api/yahoo-news` が中継される | Cloudflare Workers（中継プロキシ）のURLへ通信する |
| **音声合成 (Google TTS)** | `vite.config.js` のプロキシ設定により `/api/tts` が中継される | Cloudflare Workers（中継プロキシ）のURLへ通信する |
| **ローカルAI (Ollama)** | あなたのパソコン上で動いている `http://localhost:11434` に直接通信 | WebXR(Quest)からは、PCのローカルIP (`http://<PCのIP>:11434`) に直接通信 |

### 🔍 プロキシプログラム（Workers）のコードイメージ
もし自分で Workers にプロキシを作る場合、以下のような非常にシンプルな JavaScript プログラム（数十行）を Cloudflare にアップロードするだけで実現できます。

```javascript
export default {
  async fetch(request, env, ctx) {
    // 1. リクエストされたURL（Yahoo!ニュースなど）を特定
    const targetUrl = "https://news.yahoo.co.jp/rss/topics/top-picks.xml";
    
    // 2. ブラウザの代わりにデータを取得
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 ...' // 必要に応じてブラウザになりすます
      }
    });
    
    // 3. ブラウザが受け取れるように「CORS許可のお墨付きヘッダー」をくっつける
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*"); // 全オリジンからのアクセスを許可
    
    // 4. データをブラウザに返す
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
}
```

---

## 🏁 まとめ：再構築のロードマップへ

これで、Alpha Synapse を動かしているすべての要素の理解が整いました！

1. **基本の動き**は、ブラウザ上の **JavaScript** が作っています。
2. **3D空間やアバター**は、**Three.js** と **VRMの仕組み**で表現されています。
3. **音声やAIの対話**は、ブラウザの機能（Web Speech API）と外部の賢いAIサーバー（**Gemini / Ollama**）を中継プロキシを挟みながら連携させています。
4. **本番公開時**は、ブラウザのセキュリティを突破するために **Cloudflare Workers** などのサーバーレスプロキシが裏側で動いています。

これらの知識があれば、コピペで終わらせずに「なぜ動くのか」を説明でき、何かエラーが起きた時も「ブラウザのCORSが原因だな」と見当をつけて自力でデバッグ・再構築することができます。

まずは、**[第3章：環境構築とトラブルシューティング](file:///c:/Users/owner/Documents/lab/Antigravity/alpha-synapse/docs/setup.md)** に沿って、あなたのパソコンで実際にプログラムを起動させ、目の前でアバターが動く感動を体験してみてください！
