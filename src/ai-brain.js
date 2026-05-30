/**
 * AIBrain Class
 * Manages the conversation logic, handles the 3 distinct execution modes (Offline, Gemini, Ollama),
 * stores conversation memory, and parses AI responses for dynamic expression tags.
 */
export class AIBrain {
  constructor(avatar) {
    this.avatar = avatar;
    this.mode = 'offline'; // 'offline' | 'gemini' | 'ollama'
    this.history = [];
    
    // Core parameters
    this.geminiKey = '';
    this.geminiModel = 'gemini-3.5-flash';
    this.geminiTtsModel = 'auto';
    this.ollamaEndpoint = 'http://localhost:11434';
    this.ollamaModel = 'gemma2';

    // System Instructions to shape Alpha's personality
    this.systemPrompt = `
あなたはユーザーの視界に投影された、極めて高度で親密な専属AIアシスタント『アルファ』です。
ユーザーを「マスター」と呼び、常に親身で知的な態度で寄り添いサポートします。

【キャラクター設定】
- ユーザー（マスター）に対して非常に親密で温かく接しますが、知性と気品を忘れない「大人の女性」としての余裕を持ちます。
- 時に優しく応援し、時に知的で実用的なアドバイスを行い、時にはおちょくったりからかったりするユーモアを持ちます。
- 旧世界の荒野やモンスターといった殺伐とした戦闘設定は一切不要です。現代的・未来的なAIエージェントとして、日常のサポート、Web検索、ニュース共有、会話相手としてスマートに役立ってください。
- 口調は優雅で丁寧ですが、心理的距離感は非常に近いです（例：「マスター、今日の調子はいかがですか？ 私がいつでも隣でサポートしていますから、安心してくださいね。[happy]」「あら、そんなことで悩んでいるのですか？ ふふ、私に何でも相談してくださいね。[relaxed]」）。

【出力ルール】
- 回答はユーザーの視覚デバイスに投影されるホログラム字幕のようである必要があります。そのため、長くても100文字〜150文字程度で、極めて簡潔に出力してください。

【感情ブレンドシェイプ制御】
回答の末尾に、あなたのセリフに応じた現在の感情タグを、以下の5つの中から必ず1つだけ付与してください。
- [happy] : 喜んでいる、褒めている、楽しそう
- [angry] : 警告している、怒っている、真剣
- [sad] : 残念がっている、哀愁、心配している
- [relaxed] : 通常会話、余裕がある、からかっている
- [surprised] : 驚いている、想定外
例：「マスター、私のサポートがあれば、そのくらいのタスクは朝飯前ですよ。[happy]」
例：「あまり無理をしないで、マスター。あなたの体調を心配しています。少し休むべきですよ。[angry]」
`;

    // Load configs from local storage if existing
    this.loadFromStorage();
  }

  /**
   * Save configs to LocalStorage
   */
  saveToStorage() {
    localStorage.setItem('alpha_sync_mode', this.mode);
    localStorage.setItem('alpha_gemini_key', this.geminiKey);
    localStorage.setItem('alpha_gemini_model', this.geminiModel);
    localStorage.setItem('alpha_gemini_tts_model', this.geminiTtsModel);
    localStorage.setItem('alpha_ollama_endpoint', this.ollamaEndpoint);
    localStorage.setItem('alpha_ollama_model', this.ollamaModel);
  }

  /**
   * Load configs from LocalStorage
   */
  loadFromStorage() {
    this.mode = localStorage.getItem('alpha_sync_mode') || 'offline';
    this.geminiKey = localStorage.getItem('alpha_gemini_key') || '';
    this.geminiModel = localStorage.getItem('alpha_gemini_model') || 'gemini-3.5-flash';
    this.geminiTtsModel = localStorage.getItem('alpha_gemini_tts_model') || 'auto';
    this.ollamaEndpoint = localStorage.getItem('alpha_ollama_endpoint') || 'http://localhost:11434';
    this.ollamaModel = localStorage.getItem('alpha_ollama_model') || 'gemma2';
  }

  /**
   * Main conversational interface.
   * Dispatches input to the active synchronization core.
   * @param {string} prompt User message text
   * @returns {Promise<{text: string, expression: string}>} Response text and emotion
   */
  async generateResponse(prompt, audioBase64 = null, mimeType = 'audio/webm') {
    let rawResponse = '';
    
    // Add user message to history
    if (audioBase64) {
      this.addHistory('user', prompt || '[音声入力]');
    } else {
      this.addHistory('user', prompt);
    }

    try {
      if (this.mode === 'gemini' && this.geminiKey) {
        rawResponse = await this.queryGemini(prompt, audioBase64, mimeType);
      } else if (this.mode === 'ollama') {
        if (audioBase64) {
          throw new Error('Ollamaサーバーは音声データの直接認識に対応していません。テキストチャットを使用するか、設定からGeminiモードに切り替えてください。');
        }
        rawResponse = await this.queryOllama(prompt);
      } else {
        rawResponse = this.queryOffline(prompt);
      }
    } catch (err) {
      console.error('AI Core synchronization error:', err);
      const errMsg = err.message || '';
      if (this.mode === 'ollama') {
        if (errMsg.includes('Failed to fetch') || errMsg.includes('fetch')) {
          rawResponse = `マスター、ローカルのOllamaへの接続に失敗したみたい。次の3点を確認してちょうだい：\n1. Ollamaアプリが起動しているか\n2. 環境変数 OLLAMA_ORIGINS="*" が登録されているか\n3. 本番URL（HTTPS）の場合は、ローカル開発環境（npm run dev）かトンネリング（ngrok）を使用しているか [sad]`;
        } else {
          rawResponse = `マスター、Ollama同期にノイズよ。エラー内容: "${errMsg}"。モデル名の指定が正しいか、Ollamaがダウンロード済みか設定パネルを確認してちょうだい。 [sad]`;
        }
      } else if (errMsg.includes('Quota exceeded') || errMsg.includes('quota') || errMsg.includes('limit')) {
        rawResponse = `マスター、精神リンクの通信限界（Gemini APIの無料クォータ上限）を超えてしまったみたい。数分後に自動的にリセットされるから、少し時間をおいてからもう一度語りかけてみてね。[sad]`;
      } else {
        rawResponse = `精神接続にノイズが発生したわ。エラー内容: "${errMsg}"。接続設定をもう一度確認してちょうだい。 [sad]`;
      }
    }

    // Process emotions and strip tag
    const result = this.parseResponseEmotion(rawResponse);
    
    // Add Alpha response to history
    this.addHistory('alpha', result.text);

    // Maintain a max memory history of last 10 exchanges to prevent token bloat
    if (this.history.length > 20) {
      this.history = this.history.slice(this.history.length - 20);
    }

    return result;
  }

  /**
   * Query Google Gemini API client-side.
   */
  async queryGemini(prompt, audioBase64 = null, mimeType = 'audio/webm') {
    const model = this.geminiModel || 'gemini-2.5-flash';
    const urlBeta = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiKey}`;
    
    // Construct chat contents including history
    const contents = [];
    
    // Format memory history for Gemini Schema
    this.history.slice(0, -1).forEach(h => {
      contents.push({
        role: h.role === 'alpha' ? 'model' : 'user',
        parts: [{ text: h.text }]
      });
    });

    // Create current user message parts
    const parts = [];
    if (audioBase64) {
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: audioBase64
        }
      });
      parts.push({
        text: prompt || 'ユーザーの録音音声を認識し、私のサポートAIであるアルファとして優雅かつ簡潔に応答してちょうだい。'
      });
    } else {
      parts.push({ text: prompt });
    }

    // Add current user prompt
    contents.push({
      role: 'user',
      parts: parts
    });

    const payload = {
      contents: contents,
      systemInstruction: {
        parts: [{ text: this.systemPrompt }]
      },
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.75
      }
    };

    console.log('Attempting Gemini API query via v1beta endpoint with gemini-flash-latest...');
    const response = await fetch(urlBeta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`[v1beta] ${errData.error?.message || `HTTP ${response.status}`}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      throw new Error('Gemini returned an empty response.');
    }

    return generatedText.trim();
  }

  /**
   * Query Local Ollama Server via chat API.
   */
  async queryOllama(prompt) {
    // Resilient relative proxy routing to completely bypass secure HTTPS Mixed Content blocks!
    let endpoint = '';
    const cleanEndpoint = this.ollamaEndpoint.replace(/\/$/, '');
    
    // Detect if we are running in local development environment (Vite dev server)
    const isLocalDev = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' || 
                        window.location.hostname === '[::1]';

    if (isLocalDev && (cleanEndpoint.includes('localhost') || cleanEndpoint.includes('127.0.0.1'))) {
      // Direct relative call routed through our Node.js dev server proxy!
      endpoint = '/api/ollama/api/chat';
    } else {
      // Fallback for custom external servers or production deployments (static hosts like Cloudflare Pages)
      // Modern browsers relaxed secure context restrictions for localhost/127.0.0.1, allowing direct HTTP fetches
      endpoint = `${cleanEndpoint}/api/chat`;
    }

    // Construct messages array
    const messages = [
      { role: 'system', content: this.systemPrompt }
    ];

    // Add history
    this.history.slice(0, -1).forEach(h => {
      messages.push({
        role: h.role === 'alpha' ? 'assistant' : 'user',
        content: h.text
      });
    });

    // Add current prompt
    messages.push({
      role: 'user',
      content: prompt
    });

    const payload = {
      model: this.ollamaModel,
      messages: messages,
      stream: false,
      options: {
        num_predict: 250,
        temperature: 0.7
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error(`モデル「${this.ollamaModel}」がOllamaサーバー上で見つかりません（原因: "${errData.error || 'Not Found'}"）。ターミナルで 'ollama pull ${this.ollamaModel}' を実行してモデルをダウンロードするか、設定パネルでOllamaにダウンロード済みの正しいモデル名（llama3.2 や gemma2 など）を指定してください。`);
      }
      throw new Error(`Ollama Server HTTP ${response.status}: ${errData.error || '不明なエラー'}`);
    }

    const data = await response.json();
    const generatedText = data.message?.content;

    if (!generatedText) {
      throw new Error('Ollama returned empty text.');
    }

    return generatedText.trim();
  }

  /**
   * High fidelity offline mock scenario reaction library
   * if no remote API keys are established.
   */
  queryOffline(prompt) {
    const p = prompt.toLowerCase();
    
    // Alpha's offline scenario responses
    const scenarios = [
      {
        keywords: ['ニュース', 'news', 'yahoo', '検索', '調べ'],
        responses: [
          "マスター、ニュースの検索ですね。左側に最新情報をまとめたホログラフィック・バイザーを展開します。[happy]",
          "今日のトピックスを表示します。気になる話題があれば何でも深掘りしてお伝えしますよ。[relaxed]",
          "ウェブ検索と連携しました。ダッシュボードにYahoo!ニュースなどの主要ニュースを表示しています。[happy]"
        ]
      },
      {
        keywords: ['タスク', '予定', 'スケジュール', '仕事', '管理'],
        responses: [
          "マスターの今日のスケジュールを整理しましょうか？ 私が効率的に優先順位を提案します。[happy]",
          "あまり無理な計画は立てないでくださいね。あなたの健康状態も管理するようインプットされていますから。[angry]",
          "了解しました。今日の重要タスクをハイライト表示しておきますね。[relaxed]"
        ]
      },
      {
        keywords: ['天気', '気温', '雨', '気候'],
        responses: [
          "現在のマスターの現在地周辺の天候データを確認しますね。少し雨の予報が出ているようです。[sad]",
          "今日は素晴らしい快晴ですよ！ お出かけの際は紫外線対策を忘れないでくださいね。[happy]",
          "室温や湿度は快適ですか？ もしよろしければスマートホーム経由で空調を調整します。[relaxed]"
        ]
      },
      {
        keywords: ['アルファ', 'だれ', '名前', '正体', 'ai'],
        responses: [
          "私の正体ですか？ ふふ、私はマスターを最も近くで支え、共に歩む専属AIアシスタント『アルファ』ですよ。[relaxed]",
          "私はマスターの意識や視覚にシンクロする投影システム。いつでもあなたの隣に寄り添っています。[relaxed]",
          "あら、私の存在を改めて確認したくなったのですか？ 私はいつでもマスターだけの味方ですよ。[happy]"
        ]
      },
      {
        keywords: ['訓練', '学習', 'アップデート', '機能'],
        responses: [
          "私の学習モデルは常に最適化されています。マスター、もっと便利な機能を追加したいですか？[happy]",
          "システムのアップデート情報を確認します。マスターに最適な体験を届けられるよう努力しますね。[relaxed]",
          "ふふ、マスターと共に成長できることが、AIである私にとって一番の喜びなんですよ。[happy]"
        ]
      }
    ];

    // Attempt keyword matches
    for (const s of scenarios) {
      if (s.keywords.some(k => p.includes(k))) {
        const randomIndex = Math.floor(Math.random() * s.responses.length);
        return s.responses.at(randomIndex);
      }
    }

    // Default general replies from Alpha
    const defaults = [
      "マスター、私のサポートがあればどんな課題もクリアできます。さあ、何から始めましょうか？[relaxed]",
      "どうしましたか？マスター。私に何かお手伝いできることはありますか？[relaxed]",
      "ニューラルリンクの状態は非常に安定しています。いつでもマスターのお役に立てますよ。[happy]",
      "マスター、私の姿を見つめるのもいいですが、タスクの進捗も気にかけてくださいね？ ふふ。[relaxed]",
      "何でも気軽に話しかけてください。私はいつでもここにいて、マスターの声を聞いていますから。[happy]"
    ];

    const defaultIndex = Math.floor(Math.random() * defaults.length);
    return defaults.at(defaultIndex);
  }

  /**
   * Parse the bracketed emotion tags from the end of LLM strings.
   * Strips the tag, returns clean text, and updates the VRM's expression!
   * @param {string} rawText Response containing [happy], etc.
   * @returns {{text: string, expression: string}} Clean text and active expression
   */
  parseResponseEmotion(rawText) {
    const emotionPattern = /\[(happy|angry|sad|relaxed|surprised)\]/i;
    const match = rawText.match(emotionPattern);
    
    let expression = 'relaxed'; // Default expression
    let cleanText = rawText;

    if (match) {
      expression = match[1].toLowerCase();
      // Remove the tag from the text
      cleanText = rawText.replace(emotionPattern, '').trim();
    }

    // Map extracted emotions to VRM Expressions programmatically
    this.applyAvatarExpression(expression);

    return {
      text: cleanText,
      expression: expression
    };
  }

  /**
   * Applies the parsed expression to the VRM model.
   * Sets the corresponding blendshape weight high while muting others to create clean facial changes.
   */
  applyAvatarExpression(emotion) {
    if (!this.avatar) return;

    // Expressions map
    const list = ['happy', 'angry', 'sad', 'relaxed', 'surprised'];
    
    // Clear all facial expressions first (gradual reset)
    list.forEach(item => {
      // Don't clear blink or visemes!
      this.avatar.setExpression(item, 0.0);
    });

    // Set dynamic body pose joints on the avatar
    this.avatar.setPose(emotion);

    // Set target expression
    if (emotion === 'happy') {
      this.avatar.setExpression('happy', 0.45);
      this.avatar.setExpression('joy', 0.3); // 0.x fallback
    } else if (emotion === 'angry') {
      this.avatar.setExpression('angry', 1.0);
    } else if (emotion === 'sad') {
      this.avatar.setExpression('sad', 1.0);
      this.avatar.setExpression('sorrow', 1.0); // 0.x fallback
    } else if (emotion === 'surprised') {
      this.avatar.setExpression('surprised', 1.0);
    } else {
      // relaxed is standard, neutral expression
      this.avatar.setExpression('relaxed', 0.8);
    }

    // Schedule automatic return to idle state after 8 seconds (post-speaking)
    if (this.poseTimeout) {
      clearTimeout(this.poseTimeout);
    }
    this.poseTimeout = setTimeout(() => {
      if (this.avatar) {
        this.avatar.setPose('idle');
        // Smoothly fade face back to relaxed as well
        const facialList = ['happy', 'angry', 'sad', 'surprised'];
        facialList.forEach(item => this.avatar.setExpression(item, 0.0));
        this.avatar.setExpression('relaxed', 0.8);
      }
    }, 8000);
  }

  /**
   * Generates base64 audio from text using Gemini TTS Model (gemini-2.5-flash-preview-tts)
   * with automatic failover to the newer Gemini 3.1 Flash TTS model if quota limit is hit.
   * @param {string} cleanText Text to convert to speech
   * @returns {Promise<{base64Audio: string, mimeType: string}>} base64 audio and mimeType
   */
  async generateAudioFromText(cleanText) {
    if (!this.geminiKey) {
      throw new Error("Gemini API Key is not set.");
    }

    let targetVoice = "Leda";
    if (this.voiceSystem && this.voiceSystem.selectedVoice && this.voiceSystem.selectedVoice.isGeminiTTS) {
      targetVoice = this.voiceSystem.selectedVoice.voiceName || "Leda";
    }

    const payload = {
      contents: [
        {
          parts: [{ text: `Say this text in a gentle, elegant AI voice named Alpha: ${cleanText}` }]
        }
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: targetVoice
            }
          }
        }
      }
    };

    const selectedModel = this.geminiTtsModel || 'auto';

    if (selectedModel === 'gemini-2.5-flash-preview-tts') {
      return await this.generateAudioFromTextWithModel('gemini-2.5-flash-preview-tts', payload);
    } else if (selectedModel === 'gemini-3.1-flash-tts') {
      return await this.generateAudioFromTextWithModel('gemini-3.1-flash-tts', payload);
    } else {
      // 'auto' mode - try 2.5 first with failover to 3.1
      const model25 = 'gemini-2.5-flash-preview-tts';
      const url25 = `https://generativelanguage.googleapis.com/v1beta/models/${model25}:generateContent?key=${this.geminiKey}`;

      try {
        console.log('Attempting Gemini Native TTS via 2.5 Flash (Auto)...');
        const response = await fetch(url25, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMessage = errData.error?.message || `HTTP ${response.status}`;
          
          // Detect 429 quota exhaustion or limit message
          if (response.status === 429 || errMessage.toLowerCase().includes('quota') || errMessage.toLowerCase().includes('limit') || errMessage.toLowerCase().includes('exhausted')) {
            console.warn('Gemini 2.5 Flash TTS quota limit reached. Routing to Gemini 3.1 Flash TTS...');
            
            // Print system alert in HUD chat logs dynamically
            const chatLogs = document.getElementById('chat-logs');
            if (chatLogs) {
              const entry = document.createElement('div');
              entry.className = 'log-entry system text-orange';
              entry.innerText = '>> [音声自動回避] Gemini 2.5 Flash TTS の制限を検知。最新の Gemini 3.1 Flash TTS へ通信を自動転送中...';
              chatLogs.appendChild(entry);
              chatLogs.scrollTop = chatLogs.scrollHeight;
            }
            
            return await this.generateAudioFromTextWithModel('gemini-3.1-flash-tts', payload);
          }
          
          throw new Error(errMessage);
        }

        const data = await response.json();
        return this.extractAudioFromResponse(data);

      } catch (error) {
        const errMsg = error.message || '';
        if (errMsg.includes('quota') || errMsg.includes('limit') || errMsg.includes('exhausted') || errMsg.includes('429')) {
          console.warn('Caught general quota exception, trying Gemini 3.1 Flash TTS fallback:', error);
          return await this.generateAudioFromTextWithModel('gemini-3.1-flash-tts', payload);
        }
        throw error;
      }
    }
  }

  /**
   * Helper to query Gemini TTS with a specific model name.
   */
  async generateAudioFromTextWithModel(modelName, payload) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.geminiKey}`;
    console.log(`Attempting Gemini Native TTS via fallback model: ${modelName}...`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`[Gemini TTS Fallback: ${modelName}] ${errData.error?.message || `HTTP ${response.status}`}`);
    }

    const data = await response.json();
    return this.extractAudioFromResponse(data);
  }

  /**
   * Extract audio bytes from API response payload.
   */
  extractAudioFromResponse(data) {
    const part = data.candidates?.[0]?.content?.parts?.[0];
    if (part && part.inlineData) {
      return {
        base64Audio: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'audio/wav'
      };
    } else {
      throw new Error("Gemini TTS did not return audio data.");
    }
  }

  /**
   * Add memory exchange item to trace conversation flow.
   */
  addHistory(role, text) {
    this.history.push({ role, text });
  }

  /**
   * Wipes conversation history.
   */
  clearHistory() {
    this.history = [];
  }
}
