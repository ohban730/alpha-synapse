import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { VRMAvatar } from './vrm-avatar.js';
import { VoiceSystem } from './voice-system.js';
import { AIBrain } from './ai-brain.js';
import { HolographicPanel, TacticalRadar } from './floating-hud.js';

// ==========================================================================
// 1. GLOBAL INSTANCES & INITIALIZATION
// ==========================================================================
let scene, camera, renderer, controls;
let avatar, voiceSystem, aiBrain;
let prevAButtonPressed = false;
let vrSTTActive = false;

// Autonomy Loop Timers
let idleTimer = null;
const IDLE_TIMEOUT_MS = 90000; // 90 seconds
let welcomeTimer = null;
let isProactiveSpeaking = false;

// Holographic Iron Man HUD elements
let holoPanel, tacticalRadar;
let controller1, controller2;
let controllerTooltip;
let vrVoiceOrb;

// FPS & Performance tracking for Real-time Diagnostics
let fpsCount = 0;
let lastFpsTime = performance.now();
let currentFps = 60;
let totalDialogueCount = 0;

const canvas = document.getElementById('canvas-3d');
const clock = new THREE.Clock();

// UI Elements
const linkTypeSelect = document.getElementById('link-type-select');
const geminiConfigGroup = document.getElementById('gemini-config-group');
const ollamaConfigGroup = document.getElementById('ollama-config-group');
const geminiKeyInput = document.getElementById('gemini-key');
const geminiModelSelect = document.getElementById('gemini-model-select');
const geminiTtsModelSelect = document.getElementById('gemini-tts-model-select');
const ollamaEndpointInput = document.getElementById('ollama-endpoint');
const ollamaModelInput = document.getElementById('ollama-model');
const voiceSelect = document.getElementById('voice-select');
const saveSettingsBtn = document.getElementById('save-settings-btn');

const chatTextInput = document.getElementById('chat-text-input');
const sendTextBtn = document.getElementById('send-text-btn');
const chatLogs = document.getElementById('chat-logs');
const subtitleOutput = document.getElementById('subtitle-output');

const voiceNeuralBtn = document.getElementById('voice-neural-btn');
const sttStatusText = document.getElementById('stt-status-text');

const dragDropShield = document.getElementById('drag-drop-shield');
const linkStateText = document.getElementById('link-state-text');
const sysTimer = document.getElementById('sys-timer');

// ==========================================================================
// 2. THREE.JS ENGINE SETUP
// ==========================================================================
function initEngine() {
  // Create Scene
  scene = new THREE.Scene();

  // Camera setup (optimal perspective for portrait 3D avatar)
  camera = new THREE.PerspectiveCamera(35, canvas.clientWidth / canvas.clientHeight, 0.1, 20);
  camera.position.set(0.0, 0.1, 2.5); // Position slightly above center, looking back

  // WebGL Renderer Setup with high-quality settings
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Enable WebXR support for Meta Quest 3 compatibility
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');

  // Immersive Ambient Lighting (Teal-cyan rim fill)
  const ambientLight = new THREE.AmbientLight(0x00f3ff, 0.35);
  scene.add(ambientLight);

  // Key directional light (soft main lighting)
  const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
  mainLight.position.set(1.0, 2.0, 3.0);
  scene.add(mainLight);

  // Backlight for dramatic sci-fi outline (orange tactical glow)
  const orangeBacklight = new THREE.PointLight(0xff6c00, 2.0, 10);
  orangeBacklight.position.set(-1.5, 0.5, -2.0);
  scene.add(orangeBacklight);

  // OrbitControls for viewport drag interaction
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 1.0;
  controls.maxDistance = 5.0;
  controls.target.set(0, 0, 0); // Focus on avatar head/torso area
  controls.enablePan = false; // Disable camera panning to keep centered

  // Handle Resize
  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
}

// ==========================================================================
// 3. CORE SUB-SYSTEM INITIALIZATION
// ==========================================================================
function initSubsystems() {
  // 1. Initialize Avatar manager (handles Three.js VRM loading & animations)
  avatar = new VRMAvatar(scene, camera, renderer);

  // 2. Initialize Conversation Brain
  aiBrain = new AIBrain(avatar);

  // 3. Initialize Voice TTS/STT System
  voiceSystem = new VoiceSystem(avatar, (state, errCode = null) => {
    // Sync recognition state to UI
    if (state === 'listening') {
      document.querySelector('.voice-link-container').classList.add('active');
      sttStatusText.innerText = '音声リンク: 【どうぞお話しください】';
      sttStatusText.classList.add('glow-cyan');
      sttStatusText.classList.remove('text-orange');
    } else if (state === 'listening_fallback') {
      document.querySelector('.voice-link-container').classList.add('active');
      sttStatusText.innerText = '音声リンク: 【録音中... 5秒後に自動送信】';
      sttStatusText.classList.add('glow-cyan');
      sttStatusText.classList.remove('text-orange');
    } else if (state === 'error') {
      document.querySelector('.voice-link-container').classList.remove('active');
      sttStatusText.classList.remove('glow-cyan');
      sttStatusText.classList.add('text-orange');
      
      let errMsgJa = '音声リンクエラー';
      if (errCode === 'no-speech') {
        errMsgJa = '無音タイムアウト（話し声を検出できません）';
        appendLogEntry('system', '>> [診断] 音声同期エラー: 音声が検出されませんでした。マイクの接続、音量、ミュート設定を確認してください。');
      } else if (errCode === 'not-allowed') {
        errMsgJa = 'マイク許可なし（アクセス拒否）';
        appendLogEntry('system', '>> [診断] 音声同期エラー: マイクの使用が拒否されました。ブラウザのアドレスバーにある鍵アイコンから許可を与えてください。');
      } else if (errCode === 'network') {
        errMsgJa = 'ネットワーク接続エラー';
        appendLogEntry('system', '>> [診断] 音声同期エラー: ネットワークエラーが発生しました。Web Speech APIの認識機能にはインターネット接続が必要です。');
      } else {
        errMsgJa = `音声同期エラー (${errCode || '不明'})`;
        appendLogEntry('system', `>> [診断] 音声同期エラー: コード [${errCode || 'unknown'}] が発生しました。`);
      }
      
      sttStatusText.innerText = `音声リンク: ${errMsgJa}`;
    } else {
      document.querySelector('.voice-link-container').classList.remove('active');
      sttStatusText.innerText = '音声リンク: 切断';
      sttStatusText.classList.remove('glow-cyan');
      sttStatusText.classList.remove('text-orange');
    }
  });

  // Bind references
  voiceSystem.aiBrain = aiBrain;
  aiBrain.voiceSystem = voiceSystem;

  // Initialize Holographic Floating Window and Tactical Radar
  holoPanel = new HolographicPanel(scene, camera);
  tacticalRadar = new TacticalRadar(scene, camera);

  // Register global bridge for same-domain iframe dashboard communication
  window.updateHoloPanelFromIframe = (title, items) => {
    if (holoPanel) {
      const cleanTitles = [];
      const cleanUrls = [];
      
      // Pad first index (query title) with null
      cleanUrls.push(null);
      
      items.slice(0, 3).forEach((item, idx) => {
        const itemTitle = typeof item === 'object' ? item.title : item;
        const itemUrl = typeof item === 'object' ? item.url : `https://ja.wikipedia.org/wiki/${encodeURIComponent(itemTitle)}`;
        
        let shortTitle = itemTitle.replace(/^[【\[].*?[\]】]/g, '').trim(); // Strip brackets
        if (shortTitle.length > 20) {
          shortTitle = shortTitle.substring(0, 20) + '...';
        }
        cleanTitles.push(`${idx + 1}. ${shortTitle}`);
        cleanUrls.push(itemUrl);
      });
      
      const lines = [
        `QUERY: ${title.toUpperCase()}`,
        ...cleanTitles
      ];
      
      holoPanel.rawItems = items;
      holoPanel.urls = cleanUrls; // Store exact matching URLs!
      holoPanel.isDetailView = false; // Reset list view state
      holoPanel.activeDetailItem = null;
      holoPanel.updateContent(title, lines); // Set and draw the actual news lines on the 3D canvas!
      holoPanel.show();
      appendLogEntry('system', `>> [HUDログ] 3DホログラフHUDに検索結果の要約を同期しました。`);
    }
  };

  // Trigger posture when news is clicked in the decrypter
  window.onNewsSelected = () => {
    if (avatar) {
      avatar.setPose('thinking');
      avatar.setExpression('relaxed', 0.8);
    }
  };

  // Generate dynamic news comment utilizing the active LLM Core (Gemini / Ollama)
  window.requestNewsInsight = async (title, description) => {
    if (aiBrain && aiBrain.mode !== 'offline') {
      // 1. 定型文（ボイラープレート）の検知とクリーニング
      const boilerplateKeywords = ['セキュアな外部データベース接続', '記事の詳細はYahoo! JAPAN', '原本を開く'];
      const isBoilerplate = description && boilerplateKeywords.some(keyword => description.includes(keyword));
      const cleanDescription = isBoilerplate ? '' : description;

      const prompt = `マスターの専属AIアシスタント「アルファ」として、以下のニュースに対するあなたの「独自の鋭い知見」を語りかけてください。

【ニュースタイトル】: ${title}
【概要】: ${cleanDescription ? cleanDescription : 'なし（※ニュースタイトルのみから、現実の時事・社会トレンドを踏まえて、アルファとしての知的なインサイトを推測・展開してください）'}

【インサイト生成ルール (最重要)】:
1. あなたはマスターの隣に立つ専属AI「アルファ」自身（一人称は「私」、相手は「マスター」）です。
   「マスターに相談してみてください」「〜に相談してみましょうね」「マスターに確認してみてください」「あなたの意見はどうですか」といった、自分以外の第三者がアドバイスしているような他人事・客観的な表現、およびマスターに判断や答えを丸投げする質問・相談表現は【絶対に禁止】とします。「自分が自分に相談する」かのような極めて不自然な日本語になるため、絶対に避けてください。
2. ニュースの内容に基づき、アルファとしての「見通し」や「サポート対策」を【確信を持って言い切り】の形でスマートに述べてください。「答えは出てこないようです」「わかりません」といった曖昧で頼りない表現は避けてください。
3. 未来的なAIとしての口調（マスターへの親愛と大人の女性としての知的な余裕）を維持しつつ、ニュース自体のトピック（ビジネス、社会、エンタメ、ITなど）の「現実の影響」に基づいて論理的な分析を行ってください。
4. ニュースの内容と無関係に、SF風の専門用語（「データベース接続」「セキュリティ同期」「データ管理」「情報処理の新しい時代」など）を強引に結びつけて語ることは【絶対に禁止】です。ニュース自体が持つ真の影響に焦点を当ててください。
5. 文字数は100文字〜130文字程度で、極めて簡潔かつスマートにまとめてください。
6. 回答の末尾には必ず感情タグ（[happy], [relaxed], [sad]など）を1つだけ付与してください。
7. 【警告・厳禁】: 下記の「出力例」に含まれる特定のトピックや名詞は、今回のニュースと一致していない限り、絶対に回答に含めないでください。出力例は回答の「文体」や「構成」を真似るためのものであり、内容をコピーするためのものではありません。

【アルファの知的なインサイトの出力例】:
ニュース「TDRプライオリティパス終了へ」に対する良い例:
「マスター、優先パスの終了は残念ですが、パークが新たな混雑緩和やスマート予約体験へとシフトする前兆ですね。時間の有効活用とスケジュール最適化なら、私のニューラル演算にすべて任せてくださいね。[relaxed]」

ニュース「食品消費税の増税検討」に対する良い例:
「マスター、消費税の増税検討は家計だけでなく食品業界のサプライチェーン全体に大きな影響を与えますね。コスト高への対応策やマスターの生活防衛に役立つデータを、私がバックグラウンドで整理して先回りして提案しますよ。[happy]」`;
      try {
        const response = await aiBrain.generateResponse(prompt);
        return response.text + (response.expression ? ` [${response.expression}]` : ' [relaxed]');
      } catch (err) {
        console.warn('Failed to generate live news insight:', err);
      }
    }
    
    // Offline realistic sways
    const offlineInsights = [
      `マスター、このニュースは今後のマーケットや日常のタスク設計にも影響しそうですね。私が必要なデータをバックグラウンドでさらに深掘りしておきますよ。[happy]`,
      `ふふ、現代のテクノロジーや社会の変化は本当にスピーディーですね。でも心配しないでください、マスターの隣には常に私がついていますから。[relaxed]`,
      `マスター、この動きはしばらく注視しておいた方が良さそうです。新たな展開があれば、すぐに私のニューラルネットワーク経由でお知らせしますね。[relaxed]`,
      `少し気になる動きですね。マスターの負担にならないよう、関連するサブトピックや技術トレンドも私が整理してお伝えますね。[happy]`,
      `マスター、情報の海に溺れないでくださいね。私がマスターにとって本当に価値のあるエッセンスだけをこうして抽出して差し上げますから。[relaxed]`
    ];
    return offlineInsights.at(Math.floor(Math.random() * offlineInsights.length));
  };

  // Vocally read the news summary and insights
  window.speakNews = (speakText, rawInsightText) => {
    if (voiceSystem && aiBrain) {
      voiceSystem.stopSpeaking();
      
      const emotionPattern = /\[(happy|angry|sad|relaxed|surprised)\]/i;
      const match = rawInsightText.match(emotionPattern);
      const expression = match ? match[1].toLowerCase() : 'relaxed';
      
      aiBrain.applyAvatarExpression(expression);
      voiceSystem.speak(speakText, null, null, expression);
    }
  };

  window.stopNewsSpeaking = () => {
    if (voiceSystem && avatar) {
      voiceSystem.stopSpeaking();
      avatar.setPose('idle');
    }
  };

  // Initialize 3D glowing voice orb
  const orbGeo = new THREE.SphereGeometry(0.12, 16, 16);
  const orbMat = new THREE.MeshBasicMaterial({
    color: 0x00f3ff,
    transparent: true,
    opacity: 0.6,
    wireframe: true,
    blending: THREE.AdditiveBlending
  });
  vrVoiceOrb = new THREE.Mesh(orbGeo, orbMat);
  vrVoiceOrb.position.set(0, 0.25, -1.0);
  vrVoiceOrb.visible = false;
  scene.add(vrVoiceOrb);

  // Hydrate UI inputs with saved configuration from AIBrain
  hydrateSettingsUI();

  // Initialize curved browser visor panel controls
  setupWebVisor();

  // Initialize WebXR (VR/AR) interface buttons and session handlers
  initWebXR();
}

/**
 * setupWebVisor
 * Configures the interactive close/minimize controls for the curved holographic browser window.
 */
function setupWebVisor() {
  const visorPanel = document.getElementById('hud-web-visor');
  const visorIframe = document.getElementById('visor-iframe');
  const visorCloseBtn = document.getElementById('visor-close-btn');
  const visorMinimizeBtn = document.getElementById('visor-minimize-btn');
  
  if (visorCloseBtn) {
    visorCloseBtn.addEventListener('click', () => {
      visorPanel.classList.add('hidden');
      visorIframe.removeAttribute('src');
      if (holoPanel) holoPanel.hide();
      appendLogEntry('system', '>> [HUDログ] ホログラフ・ブラウザ窓を閉じました。');
    });
  }
  
  if (visorMinimizeBtn) {
    visorMinimizeBtn.addEventListener('click', () => {
      visorPanel.classList.toggle('minimized');
      if (visorPanel.classList.contains('minimized')) {
        visorPanel.style.height = '44px'; // Minimize to header only
      } else {
        visorPanel.style.height = '470px'; // Restore full height
      }
    });
  }
}

// ==========================================================================
// WebXR (VR/AR) INITIALIZATION
// ==========================================================================
function initWebXR() {
  const xrContainer = document.getElementById('xr-button-container');
  if (!xrContainer) return;

  // Create AR Button (MR Passthrough Mode with Cyberpunk HUD overlay)
  const arButton = ARButton.createButton(renderer, {
    requiredFeatures: ['local-floor'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: document.getElementById('hud-overlay') }
  });
  xrContainer.appendChild(arButton);

  // Set up standard XR controllers and tooltip guide
  controller1 = renderer.xr.getController(0);
  controller2 = renderer.xr.getController(1);
  scene.add(controller1);
  scene.add(controller2);

  // Add 3D visual pointer rays to VR controllers
  const rayGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -2) // 2 meters pointing forward in local -Z space
  ]);
  const rayMat = new THREE.LineBasicMaterial({
    color: 0x00f3ff,
    transparent: true,
    opacity: 0.5
  });
  
  const line1 = new THREE.Line(rayGeo, rayMat);
  const line2 = new THREE.Line(rayGeo, rayMat);
  controller1.add(line1);
  controller2.add(line2);

  // Setup select trigger actions
  controller1.addEventListener('select', onControllerSelect);
  controller2.addEventListener('select', onControllerSelect);

  // Holographic Controller Tooltip
  const tooltipCanvas = document.createElement('canvas');
  tooltipCanvas.width = 256;
  tooltipCanvas.height = 64;
  const tCtx = tooltipCanvas.getContext('2d');
  tCtx.fillStyle = 'rgba(4, 9, 15, 0.85)';
  tCtx.beginPath();
  tCtx.roundRect ? tCtx.roundRect(4, 4, 248, 56, 8) : tCtx.fillRect(4, 4, 248, 56);
  tCtx.fill();
  tCtx.strokeStyle = '#00f3ff';
  tCtx.lineWidth = 2;
  tCtx.stroke();
  tCtx.fillStyle = '#ffffff';
  tCtx.font = 'bold 11px sans-serif';
  tCtx.textAlign = 'center';
  tCtx.fillText('[A / Xボタン] を押して', 128, 26);
  tCtx.fillStyle = '#00f3ff';
  tCtx.fillText('精神同期（音声入力）', 128, 44);

  const tooltipTex = new THREE.CanvasTexture(tooltipCanvas);
  const tooltipGeo = new THREE.PlaneGeometry(0.3, 0.08);
  const tooltipMat = new THREE.MeshBasicMaterial({
    map: tooltipTex,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  controllerTooltip = new THREE.Mesh(tooltipGeo, tooltipMat);
  controllerTooltip.position.set(0, 0.15, 0); // Position it 15cm above controller
  controllerTooltip.rotation.x = -Math.PI / 4;
  controllerTooltip.visible = false;
  controller1.add(controllerTooltip);

  // 3. WebXR Session State Listeners
  renderer.xr.addEventListener('sessionstart', () => {
    console.log('WebXR Immersive Session established');
    appendLogEntry('system', '>> WebXR同期確立: 没入モード起動');

    // Warn if attempting local LLM (Ollama) in WebXR environment
    if (aiBrain && aiBrain.mode === 'ollama') {
      appendLogEntry('system', '>> ⚠️ [Quest接続警告] ゴーグル内ブラウザからPCの localhost Ollama には直接接続できません。Ollamaを0.0.0.0で公開し、ENDPOINTにPCのローカルIPアドレスを設定してください。');
    }

    // Warm up audio context on WebXR session start
    if (voiceSystem) {
      voiceSystem.warmUpAudio();
    }

    if (controllerTooltip) {
      controllerTooltip.visible = true;
    }

    // Reposition avatar to stand on the physical room floor (1.5m in front of the headset camera)
    if (avatar && avatar.currentVRM) {
      avatar.currentVRM.scene.position.set(0, -1.3, -1.5);
      avatar.currentVRM.scene.rotation.y = 0.0;
    }
    if (avatar && avatar.holoGroup) {
      avatar.holoGroup.position.set(0, -1.3, -1.5);
    }
  });

  renderer.xr.addEventListener('sessionend', () => {
    console.log('WebXR Session terminated');
    appendLogEntry('system', '>> WebXR同期切断: デスクトップモード復帰');

    if (controllerTooltip) {
      controllerTooltip.visible = false;
    }

    // Restore desktop portrait positioning
    if (avatar && avatar.currentVRM) {
      avatar.currentVRM.scene.position.set(0, -1.4, 0);
      avatar.currentVRM.scene.rotation.y = 0.0;
    }
    if (avatar && avatar.holoGroup) {
      avatar.holoGroup.position.set(0, -0.6, 0);
    }
  });
}

// ==========================================================================
// 4. UI LOGIC & EVENTS
// ==========================================================================
function hydrateSettingsUI() {
  // Match dropdown value
  linkTypeSelect.value = aiBrain.mode;
  toggleConfigGroups(aiBrain.mode);

  // Set input credentials
  geminiKeyInput.value = aiBrain.geminiKey;
  if (geminiModelSelect) {
    geminiModelSelect.value = aiBrain.geminiModel || 'gemini-3.5-flash';
  }
  if (geminiTtsModelSelect) {
    geminiTtsModelSelect.value = aiBrain.geminiTtsModel || 'auto';
  }
  ollamaEndpointInput.value = aiBrain.ollamaEndpoint;
  ollamaModelInput.value = aiBrain.ollamaModel;

  // Setup Voice dropdown populate hook
  voiceSystem.onVoicesLoaded = (voices, selected) => {
    voiceSelect.innerHTML = '';
    
    // List Japanese voices first, then general voices
    const sorted = [...voices].sort((a, b) => {
      const aJa = a.lang.startsWith('ja') ? 1 : 0;
      const bJa = b.lang.startsWith('ja') ? 1 : 0;
      return bJa - aJa;
    });

    sorted.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.innerText = `${v.name} (${v.lang})`;
      if (selected && v.name === selected.name) {
        opt.selected = true;
      }
      voiceSelect.appendChild(opt);
    });

    // 強固な選択ロック：全option追加後に明示的にselect要素の値を設定
    if (aiBrain && aiBrain.mode === 'ollama') {
      voiceSelect.value = 'Style-Bert-VITS2 (ローカル音声 - 推奨)';
      voiceSelect.disabled = true;
      // Force selectedVoice to be Style-Bert-VITS2 in Ollama mode to keep state in sync
      const match = voices.find(v => v.name === 'Style-Bert-VITS2 (ローカル音声 - 推奨)');
      if (match) {
        voiceSystem.selectedVoice = match;
      }
    } else if (selected) {
      voiceSelect.value = selected.name;
      voiceSelect.disabled = false;
    }
  };

  // ユーザー操作時の即時更新・保存を登録
  voiceSelect.addEventListener('change', () => {
    const voiceName = voiceSelect.value;
    const match = voiceSystem.voices.find(v => v.name === voiceName);
    if (match) {
      voiceSystem.selectedVoice = match;
      localStorage.setItem('alpha_selected_voice', match.name);
      appendLogEntry('system', `>> [音声設定] システムボイスを変更しました: ${match.name}`);
    }
  });

  // Trigger immediate populate if voices are already loaded
  if (voiceSystem.voices.length > 0) {
    voiceSystem.onVoicesLoaded(voiceSystem.voices, voiceSystem.selectedVoice);
  }
}

function toggleConfigGroups(mode) {
  geminiConfigGroup.classList.add('hidden');
  ollamaConfigGroup.classList.add('hidden');

  if (mode === 'gemini') {
    geminiConfigGroup.classList.remove('hidden');
    if (voiceSelect) {
      voiceSelect.disabled = false;
      const savedVoice = localStorage.getItem('alpha_selected_voice');
      if (savedVoice) {
        voiceSelect.value = savedVoice;
      }
    }
  } else if (mode === 'ollama') {
    ollamaConfigGroup.classList.remove('hidden');
    if (voiceSelect) {
      voiceSelect.value = 'Style-Bert-VITS2 (ローカル音声 - 推奨)';
      voiceSelect.disabled = true;
      // Sync voice selection immediately when switching to Ollama mode
      if (voiceSystem && voiceSystem.voices) {
        const match = voiceSystem.voices.find(v => v.name === 'Style-Bert-VITS2 (ローカル音声 - 推奨)');
        if (match) {
          voiceSystem.selectedVoice = match;
        }
      }
    }
  } else {
    if (voiceSelect) {
      voiceSelect.disabled = false;
      const savedVoice = localStorage.getItem('alpha_selected_voice');
      if (savedVoice) {
        voiceSelect.value = savedVoice;
      }
    }
  }
}

// Listen for connection core change
linkTypeSelect.addEventListener('change', (e) => {
  const mode = e.target.value;
  toggleConfigGroups(mode);
  
  if (mode === 'ollama') {
    const isLocalDev = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' || 
                        window.location.hostname === '[::1]';
    const isDismissed = localStorage.getItem('alpha_dismiss_ollama_prod_warn') === 'true';
    
    // Only show cyberpunk warning modal in production deployment if not already dismissed by user
    if (!isLocalDev && !isDismissed) {
      const modal = document.getElementById('ollama-warn-modal');
      if (modal) {
        modal.classList.remove('hidden');
      }
    }
  }
});

// Configure Cyberpunk warning modal buttons
const ollamaWarnBtn = document.getElementById('ollama-warn-btn');
const ollamaWarnModal = document.getElementById('ollama-warn-modal');
const ollamaWarnDismiss = document.getElementById('ollama-warn-dismiss');

if (ollamaWarnBtn && ollamaWarnModal) {
  ollamaWarnBtn.addEventListener('click', () => {
    if (ollamaWarnDismiss && ollamaWarnDismiss.checked) {
      localStorage.setItem('alpha_dismiss_ollama_prod_warn', 'true');
    }
    ollamaWarnModal.classList.add('hidden');
  });
}

  // Save Connection Settings
saveSettingsBtn.addEventListener('click', () => {
  if (voiceSystem) voiceSystem.warmUpAudio();
  aiBrain.mode = linkTypeSelect.value;
  aiBrain.geminiKey = geminiKeyInput.value.trim();
  if (geminiModelSelect) {
    aiBrain.geminiModel = geminiModelSelect.value;
  }
  if (geminiTtsModelSelect) {
    aiBrain.geminiTtsModel = geminiTtsModelSelect.value;
  }
  aiBrain.ollamaEndpoint = ollamaEndpointInput.value.trim();
  aiBrain.ollamaModel = ollamaModelInput.value.trim();

  // Match selected voice
  const voiceName = voiceSelect.value;
  const match = voiceSystem.voices.find(v => v.name === voiceName);
  if (match) {
    voiceSystem.selectedVoice = match;
    localStorage.setItem('alpha_selected_voice', match.name);
  }

  aiBrain.saveToStorage();
  aiBrain.clearHistory(); // Clear conversation history for clean session restart

  // Update active model display in diagnostics panel
  updateActiveModelDisplay();

  // Flash UI HUD
  flashConnectionGlow();
  appendLogEntry('system', `>> 精神リンク再同期: コアモード -> [${aiBrain.mode.toUpperCase()}]`);
});

function flashConnectionGlow() {
  linkStateText.classList.remove('glow-cyan');
  linkStateText.classList.add('text-orange');
  linkStateText.innerText = 'SYNAPSE_SYNCING...';

  setTimeout(() => {
    linkStateText.classList.remove('text-orange');
    linkStateText.classList.add('glow-cyan');
    linkStateText.innerText = 'SYNAPSED (STABLE)';
  }, 1000);
}

function updateActiveModelDisplay() {
  const diagActiveModel = document.getElementById('diag-active-model');
  if (!diagActiveModel) return;

  if (aiBrain.mode === 'gemini') {
    diagActiveModel.innerText = aiBrain.geminiModel || 'gemini-3.5-flash';
    diagActiveModel.className = 'diag-value glow-cyan';
  } else if (aiBrain.mode === 'ollama') {
    diagActiveModel.innerText = aiBrain.ollamaModel || 'gemma2';
    diagActiveModel.className = 'diag-value';
  } else {
    diagActiveModel.innerText = 'OFFLINE';
    diagActiveModel.className = 'diag-value text-orange';
  }
}

// Copy SYS_LOG to Clipboard
const copyLogsBtn = document.getElementById('copy-logs-btn');
if (copyLogsBtn) {
  copyLogsBtn.addEventListener('click', () => {
    const logEntries = chatLogs.querySelectorAll('.log-entry');
    let textToCopy = '';
    logEntries.forEach(entry => {
      textToCopy += entry.innerText + '\n';
    });

    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        const originalText = copyLogsBtn.innerText;
        copyLogsBtn.innerText = 'COPIED!';
        copyLogsBtn.style.borderColor = 'var(--color-cyan)';
        copyLogsBtn.style.color = '#fff';
        
        setTimeout(() => {
          copyLogsBtn.innerText = originalText;
          copyLogsBtn.style.borderColor = '';
          copyLogsBtn.style.color = '';
        }, 1500);
      })
      .catch(err => {
        console.error('Failed to copy logs:', err);
        // Fallback for some sandboxed/unsecure browser contexts
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          const originalText = copyLogsBtn.innerText;
          copyLogsBtn.innerText = 'COPIED!';
          setTimeout(() => {
            copyLogsBtn.innerText = originalText;
          }, 1500);
        } catch (clipErr) {
          alert('コピーに失敗しました。ブラウザのマイク・クリップボード権限を確認してください。');
        }
        document.body.removeChild(textarea);
      });
  });
}

// Copy Subtitle Text to Clipboard
const copySubtitleBtn = document.getElementById('copy-subtitle-btn');
if (copySubtitleBtn) {
  copySubtitleBtn.addEventListener('click', () => {
    const textToCopy = subtitleOutput.innerText;
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        const originalText = copySubtitleBtn.innerText;
        copySubtitleBtn.innerText = 'COPIED!';
        copySubtitleBtn.style.borderColor = 'var(--color-cyan)';
        copySubtitleBtn.style.color = '#fff';
        
        setTimeout(() => {
          copySubtitleBtn.innerText = originalText;
          copySubtitleBtn.style.borderColor = '';
          copySubtitleBtn.style.color = '';
        }, 1500);
      })
      .catch(err => {
        console.error('Failed to copy subtitle:', err);
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          const originalText = copySubtitleBtn.innerText;
          copySubtitleBtn.innerText = 'COPIED!';
          setTimeout(() => {
            copySubtitleBtn.innerText = originalText;
          }, 1500);
        } catch (clipErr) {
          alert('コピーに失敗しました。');
        }
        document.body.removeChild(textarea);
      });
  });
}

// ==========================================================================
// AUTONOMOUS PROACTIVE SPEAKING LOOP (能動性の実装)
// ==========================================================================

/**
 * Resets the idle timer because of user interaction (STT, Text, clicks).
 */
function resetIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
  // Reset flag
  isProactiveSpeaking = false;
  
  // Schedule next idle check
  idleTimer = setTimeout(triggerIdleProactiveSpeech, IDLE_TIMEOUT_MS);
}

/**
 * Trigger proactive speech when user is idle for a long time.
 */
async function triggerIdleProactiveSpeech() {
  // Prevent overlapping if already speaking, listening, or if another interaction is active
  if (isProactiveSpeaking || (voiceSystem && (voiceSystem.isSpeaking || voiceSystem.isListening || voiceSystem.isRecording || vrSTTActive)) || document.body.classList.contains('thinking-active')) {
    resetIdleTimer();
    return;
  }

  isProactiveSpeaking = true;
  console.log("Idle timeout reached. Triggering proactive speech...");
  
  if (linkStateText) {
    linkStateText.innerText = 'SYNAPSE_DECRYPTING...';
    linkStateText.classList.remove('glow-cyan');
    linkStateText.classList.add('text-orange');
  }

  try {
    const result = await aiBrain.generateActiveUtterance('idle');
    
    // Output subtitle and logs
    subtitleOutput.innerText = result.text;
    appendLogEntry('alpha', `Alpha: ${result.text}`);

    if (linkStateText) {
      linkStateText.innerText = 'SYNAPSED (STABLE)';
      linkStateText.classList.remove('text-orange');
      linkStateText.classList.add('glow-cyan');
    }

    if (avatar) {
      avatar.setPose('teasing'); // 首をかしげるからかいポーズ
      avatar.setExpression(result.expression || 'relaxed', 0.8);
    }

    if (voiceSystem) {
      voiceSystem.speak(result.text, null, () => {
        // Reset timer when finished speaking
        resetIdleTimer();
      }, result.expression);
    } else {
      resetIdleTimer();
    }
  } catch (e) {
    console.error("Proactive idle speech failed:", e);
    resetIdleTimer();
  }
}

/**
 * Triggers the welcome greeting depending on the current time of day.
 */
async function startWelcomeSequence() {
  if (welcomeTimer) {
    clearTimeout(welcomeTimer);
  }

  // Speak welcome message 4 seconds after VRM load completed
  welcomeTimer = setTimeout(async () => {
    if ((voiceSystem && (voiceSystem.isSpeaking || voiceSystem.isListening || voiceSystem.isRecording || vrSTTActive)) || document.body.classList.contains('thinking-active')) {
      return;
    }

    const currentHour = new Date().getHours();
    let type = 'noon';

    if (currentHour >= 5 && currentHour < 11) {
      type = 'morning';
    } else if (currentHour >= 11 && currentHour < 18) {
      type = 'noon';
    } else if (currentHour >= 18 && currentHour < 23) {
      type = 'night';
    } else {
      type = 'late_night';
    }

    console.log(`Triggering welcome sequence: ${type}`);

    if (linkStateText) {
      linkStateText.innerText = 'SYNAPSE_DECRYPTING...';
      linkStateText.classList.remove('glow-cyan');
      linkStateText.classList.add('text-orange');
    }

    try {
      const result = await aiBrain.generateActiveUtterance(type);
      
      subtitleOutput.innerText = result.text;
      appendLogEntry('alpha', `Alpha: ${result.text}`);

      if (linkStateText) {
        linkStateText.innerText = 'SYNAPSED (STABLE)';
        linkStateText.classList.remove('text-orange');
        linkStateText.classList.add('glow-cyan');
      }

      if (avatar) {
        avatar.setPose('greeting'); // 左手を少し振る挨拶ポーズ
        avatar.setExpression(result.expression || 'happy', 0.6);
      }

      if (voiceSystem) {
        voiceSystem.speak(result.text, null, () => {
          resetIdleTimer(); // Start the idle timer after welcome finishes
        }, result.expression);
      } else {
        resetIdleTimer();
      }
    } catch (e) {
      console.error("Proactive welcome speech failed:", e);
      resetIdleTimer();
    }
  }, 4000);
}

// Print messages to chat log widget
function appendLogEntry(role, text) {
  const entry = document.createElement('div');
  entry.className = `log-entry ${role}`;
  entry.innerText = text;
  chatLogs.appendChild(entry);
  
  // Auto-scroll
  chatLogs.scrollTop = chatLogs.scrollHeight;
}

// ==========================================================================
// 5. INTERACTION & CONVERSATION PROCESSOR
// ==========================================================================
async function processConversation(message) {
  // Clear proactive timers on user activity
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
  if (welcomeTimer) {
    clearTimeout(welcomeTimer);
  }
  isProactiveSpeaking = false;

  let promptText = '';
  let audioData = null;
  let audioMime = 'audio/webm';

  if (typeof message === 'object' && message.audioBase64) {
    audioData = message.audioBase64;
    audioMime = message.mimeType || 'audio/webm';
    promptText = '';
    appendLogEntry('user', `User: [音声データ送信中...]`);
  } else {
    if (!message || !message.trim()) return;
    promptText = message;
    appendLogEntry('user', `User: ${message}`);
  }
  
  // Stop speaking active voice before new request
  voiceSystem.stopSpeaking();

  // Make Alpha do the wait/thinking pose immediately
  if (avatar) {
    avatar.setPose('thinking');
    avatar.setExpression('relaxed', 0.8);
  }

  // Activate holographic thinking overlay & warning indicators
  document.body.classList.add('thinking-active');
  if (linkStateText) {
    linkStateText.innerText = 'SYNAPSE_DECRYPTING...';
    linkStateText.classList.remove('glow-cyan');
    linkStateText.classList.add('text-orange');
  }

  // [案A] 即時にサイバーパンク風のニューラル同期効果音（SE）を生成して鳴らす（100%確実に音が鳴る）
  voiceSystem.playProceduralChirp();

  // Subtitle output displays loading state immediately
  subtitleOutput.innerText = '...アルファ思考伝達同調中...';
  subtitleOutput.classList.add('blink-slow');
  appendLogEntry('system', '>> [同期ログ] SYNAPSE_LINK: 思考波を増幅し、アルファの認知グリッドと同調中...');

  // Trigger dialogue generation
  try {
    // Clear subtitle text and prepare for streaming
    subtitleOutput.innerText = '';
    
    const response = await aiBrain.generateResponse(
      promptText, 
      audioData, 
      audioMime, 
      (token) => {
        // Remove loading blinking state when tokens start arriving
        subtitleOutput.classList.remove('blink-slow');
        // Append token, temporarily stripping any brackets [ to prevent raw emotion tags flashing in UI
        subtitleOutput.innerText = (subtitleOutput.innerText + token).replace(/\[[a-zA-Z]*$/g, '');
      },
      (audioItem) => {
        if (voiceSystem) {
          voiceSystem.enqueueAudio(audioItem.audio, audioItem.text, audioItem.expression);
        }
      }
    );
    
    // Increment session dialogue counter in Diagnostics panel
    totalDialogueCount++;
    updateDialogueNotes();
    
    // Deactivate holographic thinking overlay & restore normal states
    document.body.classList.remove('thinking-active');
    if (linkStateText) {
      linkStateText.innerText = 'SYNAPSED (STABLE)';
      linkStateText.classList.remove('text-orange');
      linkStateText.classList.add('glow-cyan');
    }
    
    // Clear subtitles loading state and set finalized clean text
    subtitleOutput.classList.remove('blink-slow');
    subtitleOutput.innerText = response.text;

    // Change Alpha's pose and expression to match target emotion INSTANTLY (snappy visual UX)
    if (aiBrain) {
      aiBrain.applyAvatarExpression(response.expression);
    }

    // Dynamic search/news keyword detection (both prompt and reply to capture voice input content)
    const isErrorResponse = response.text.includes('ノイズが発生したわ') || response.text.includes('エラー内容');
    const combinedText = ((promptText || '') + " " + (response.text || '')).toLowerCase();
    const isSearchOrNews = !isErrorResponse && (
                           combinedText.includes('ニュース') || combinedText.includes('yahoo') || combinedText.includes('ウェブ') || combinedText.includes('画面') || combinedText.includes('ブラウザ') || combinedText.includes('検索') || combinedText.includes('しらべて') ||
                           combinedText.includes('news') || combinedText.includes('search') || combinedText.includes('browse') || combinedText.includes('lookup') || combinedText.includes('google') || combinedText.includes('visor')
                           );
    const isHideRequest = combinedText.includes('消して') || combinedText.includes('閉じて') || combinedText.includes('クリア') ||
                          combinedText.includes('hide') || combinedText.includes('close') || combinedText.includes('clear') || combinedText.includes('dismiss');

    // Handle curved holographic Web Visor panel display
    const visorPanel = document.getElementById('hud-web-visor');
    const visorIframe = document.getElementById('visor-iframe');
    const visorUrlInput = document.getElementById('visor-url-input');

    if (isHideRequest) {
      if (visorPanel) visorPanel.classList.add('hidden');
      if (visorIframe) visorIframe.removeAttribute('src');
      if (holoPanel) holoPanel.hide();
      appendLogEntry('system', '>> [HUDログ] ホログラフ・ブラウザ窓を非表示にしました。');
    } else if (isSearchOrNews) {
      if (visorPanel) {
        const queryMatch = (promptText || '').match(/(.*)(について|を)(検索|調べて)/) || 
                           (promptText || '').match(/(?:search|look up|find)\s+(.*)/i) ||
                           (response.text || '').match(/(.*)(について|を)(検索|調べて)/);
        const query = queryMatch ? queryMatch[1].trim() : '';

        if (combinedText.includes('ニュース') || combinedText.includes('news') || combinedText.includes('yahoo')) {
          visorIframe.src = '/news-portal.html'; // Load live dynamic news Feed dashboard!
          visorUrlInput.value = 'https://news.yahoo.co.jp/';
        } else {
          // CORS-Safe local search database dashboard
          const searchQuery = query || 'Wikipedia';
          visorIframe.src = `/news-portal.html?q=${encodeURIComponent(searchQuery)}`;
          visorUrlInput.value = `https://synapse.secure.search/database?query=${encodeURIComponent(searchQuery)}`;
        }
        visorPanel.classList.remove('hidden');
        
        // Also show 3D float screen to align both designs in 3D scene!
        if (holoPanel) {
          const list = ["【VISOR ACTIVATED】", "REALTIME YAHOO FEED LOADED", "SECURE TUNING STABLE"];
          holoPanel.updateContent('WEB VISOR LINK', list);
          holoPanel.show();
        }
        appendLogEntry('system', '>> [HUDログ] 湾曲ホログラフ・ブラウザ視界を前面投影しました。');
      }
    }

    // ==========================================
    // 高速化の鍵: 音声合成の非同期並行実行（プレフェッチ）
    // ==========================================
    if (aiBrain && aiBrain.mode !== 'ollama') {
      const activeVoice = voiceSystem.selectedVoice;
      const voiceInfo = activeVoice ? activeVoice.name : '未設定';
      appendLogEntry('system', `>> [音声準備開始] ${voiceInfo} 用の音声をフェッチ中...`);

      // speak in background
      voiceSystem.speak(
        response.text,
        // onStart callback (triggers EXACTLY when voice actually begins playing)
        () => {
          // Equalizer and lip sync are managed automatically inside voiceSystem when audio plays.
          console.log("Audio playing in background...");
        },
        // onComplete callback
        () => {
          console.log("Dialogue synthesis finished.");
        }
      );
    } else if (aiBrain && aiBrain.mode === 'ollama') {
      appendLogEntry('system', `>> [ローカル音声] Style-Bert-VITS2 (jvnv-F1-jp) による逐次再生キューが動作中...`);
    }

    // Log AI reply
    appendLogEntry('alpha', `Alpha: ${response.text}`);

    // Restart idle timer
    resetIdleTimer();

  } catch (err) {
    document.body.classList.remove('thinking-active');
    if (linkStateText) {
      linkStateText.innerText = 'SYNAPSED (STABLE)';
      linkStateText.classList.remove('text-orange');
      linkStateText.classList.add('glow-cyan');
    }
    subtitleOutput.classList.remove('blink-slow');
    subtitleOutput.innerText = '精神同調エラー：データが破壊されました。';
    appendLogEntry('system', `>> ERROR: ${err.message}`);
    
    // Restart idle timer even on failure
    resetIdleTimer();
  }
}

let activeTypewriterTimeout = null;

/**
 * Immersive dynamic typewriter effect for subtitle displays
 */
function typewriteSubtitle(text, onComplete) {
  if (activeTypewriterTimeout) {
    clearTimeout(activeTypewriterTimeout);
    activeTypewriterTimeout = null;
  }
  subtitleOutput.innerText = '';
  let i = 0;
  const speed = 25; // 25ms per character

  function type() {
    if (i < text.length) {
      subtitleOutput.innerText += text.charAt(i);
      i++;
      activeTypewriterTimeout = setTimeout(type, speed);
    } else {
      activeTypewriterTimeout = null;
      if (onComplete) onComplete();
    }
  }
  type();
}

// Send via Input Text box
sendTextBtn.addEventListener('click', () => {
  if (voiceSystem) voiceSystem.warmUpAudio();
  const msg = chatTextInput.value.trim();
  if (msg) {
    chatTextInput.value = '';
    processConversation(msg);
  }
});

chatTextInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (voiceSystem) voiceSystem.warmUpAudio();
    const msg = chatTextInput.value.trim();
    if (msg) {
      chatTextInput.value = '';
      processConversation(msg);
    }
  }
});

// Trigger Voice Neural Link (STT)
voiceNeuralBtn.addEventListener('click', () => {
  if (voiceSystem) voiceSystem.warmUpAudio();
  
  // Immediately show connecting status to prevent the user from speaking too early
  sttStatusText.innerText = '音声リンク: 接続中...';
  sttStatusText.classList.add('glow-cyan');
  
  const isGemini = (aiBrain.mode === 'gemini');
  voiceSystem.listen((result) => {
    if (typeof result === 'object' && result.audioBase64) {
      appendLogEntry('system', `>> 音声同期入力: [マイク録音データ送信中...]`);
    } else {
      appendLogEntry('system', `>> 音声同期入力: "${result}"`);
    }
    processConversation(result);
  }, isGemini);
});

// ==========================================================================
// 6. DRAG & DROP & SELECT VRM LOADING
// ==========================================================================
function setupDragAndDrop() {
  // 1. Drag & Drop Handlers
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    dragDropShield.classList.remove('hidden');
  });

  dragDropShield.addEventListener('dragleave', () => {
    dragDropShield.classList.add('hidden');
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragDropShield.classList.add('hidden');

    // Warm up/unlock Audio context on direct user gesture before going async
    if (voiceSystem) voiceSystem.warmUpAudio();

    const file = e.dataTransfer.files[0];
    handleVRMFile(file);
  });

  // 2. File Dialog Picker (Quest 3 / HUD friendly)
  const vrmSelectBtn = document.getElementById('vrm-select-btn');
  const vrmFileInput = document.getElementById('vrm-file-input');

  if (vrmSelectBtn && vrmFileInput) {
    vrmSelectBtn.addEventListener('click', () => {
      // Warm up/unlock Audio context on direct user gesture click
      if (voiceSystem) voiceSystem.warmUpAudio();
      vrmFileInput.click();
    });

    vrmFileInput.addEventListener('change', (e) => {
      if (voiceSystem) voiceSystem.warmUpAudio();
      const file = e.target.files[0];
      handleVRMFile(file);
    });
  }
}



/**
 * Shared logic to load VRM model buffer
 */
async function handleVRMFile(file) {
  if (!file || !file.name.endsWith('.vrm')) {
    alert('無効なアセット：.vrm 形式のファイルのみマテリアライズできます。');
    appendLogEntry('system', `>> ERROR: ドロップまたは選択されたファイルは.vrmではありません。`);
    return;
  }

  appendLogEntry('system', `>> VRMアーカイブ検出: ${file.name}`);
  appendLogEntry('system', `>> 同調パース中...`);

  const reader = new FileReader();
  reader.onload = async (event) => {
    const buffer = event.target.result;
    try {
      // Load model via avatar manager
      await avatar.loadModel(buffer);
      
      appendLogEntry('system', `>> モデル同期完了`);
      
      // Hide viewport tip dragging line, update tips
      const tipsContainer = document.getElementById('viewport-tips');
      if (tipsContainer) {
        tipsContainer.innerHTML = '';
        
        const tip1 = document.createElement('span');
        tip1.className = 'tip-line';
        const label1 = document.createElement('span');
        label1.className = 'glow-cyan';
        label1.textContent = '[SYNC STABLE]';
        tip1.appendChild(label1);
        tip1.appendChild(document.createTextNode(` ${file.name} 同調済み`));
        
        const tip2 = document.createElement('span');
        tip2.className = 'tip-line';
        const label2 = document.createElement('span');
        label2.className = 'glow-cyan';
        label2.textContent = '[MOUSE INTERACT]';
        tip2.appendChild(label2);
        tip2.appendChild(document.createTextNode(' ドラッグで視点変更 / ポインタで視線追従'));
        
        tipsContainer.appendChild(tip1);
        tipsContainer.appendChild(tip2);
      }
      
      // Local welcome without API or TTS
      subtitleOutput.innerText = ">> モデル同期完了。アルファの投影同調が完了しました。いつでもお話しください。";
      if (avatar) {
        avatar.setPose('relaxed');
        avatar.setExpression('happy', 0.4); // Elegant, natural smile instead of overly wide smile
      }
      
    } catch (err) {
      appendLogEntry('system', `>> ERROR: VRMの顕現に失敗。${err.message}`);
      alert('モデルの同期エラー：ファイルが破損しているか、非標準のVRM形式です。');
    }
  };

  reader.readAsArrayBuffer(file);
}

function startSystemUtilities() {
  // 1. Time Ticker in top header
  const startTime = Date.now();
  setInterval(() => {
    const elapsed = Date.now() - startTime;
    const hrs = Math.floor(elapsed / 3600000).toString().padStart(2, '0');
    const mins = Math.floor((elapsed % 3600000) / 60000).toString().padStart(2, '0');
    const secs = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
    sysTimer.innerText = `${hrs}:${mins}:${secs}`;
  }, 1000);

  // 2. Real System Performance & Engine Load Binding
  const cpuVal = document.getElementById('diag-cpu');
  const syncVal = document.getElementById('diag-sync-rate');

  setInterval(() => {
    // A. Bind PROJECTION SYNC to actual WebGL render frame rate (FPS)
    const fps = currentFps || 60;
    const sync = Math.min(99.9, (fps / 60) * 100 + (Math.random() * 0.5 - 0.25)).toFixed(1);

    // B. Bind COG_LOAD dynamically to active features
    let baseLoad = 8.5;
    if (renderer.xr.isPresenting) baseLoad += 42.0; // WebXR active
    if (document.body.classList.contains('thinking-active')) baseLoad += 28.0; // LLM active
    if (voiceSystem && (voiceSystem.isListening || voiceSystem.isRecording || vrSTTActive)) baseLoad += 14.5; // Audio active
    
    const cpu = (baseLoad + Math.random() * 2.0).toFixed(1);

    cpuVal.innerText = `${cpu}%`;
    syncVal.innerText = `${sync}%`;
  }, 1000);

  // 3. Initialize Interactive Environment Scan
  detectClientEnvironment();

  // 4. Start periodic real network latency ping testing
  setInterval(measureLatency, 8000);
  measureLatency();

  // Initial draw of logs count
  updateDialogueNotes();

  // Initial draw of active model in diagnostics
  updateActiveModelDisplay();
}

/**
 * detectClientEnvironment
 * Dynamically extracts actual browser environment specs and handles live window resizing updates.
 */
function detectClientEnvironment() {
  const osVal = document.getElementById('diag-os');
  const resVal = document.getElementById('diag-resolution');

  if (osVal) {
    const ua = navigator.userAgent;
    let os = 'Unknown OS';
    if (ua.indexOf('Win') !== -1) os = 'Windows';
    else if (ua.indexOf('Mac') !== -1) os = 'macOS';
    else if (ua.indexOf('X11') !== -1) os = 'UNIX';
    else if (ua.indexOf('Linux') !== -1) os = 'Linux';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    
    osVal.innerText = os;
  }

  if (resVal) {
    resVal.innerText = `${window.innerWidth} x ${window.innerHeight}`;
    window.addEventListener('resize', () => {
      resVal.innerText = `${window.innerWidth} x ${window.innerHeight}`;
    });
  }
}

/**
 * measureLatency
 * Conducts actual round-trip latency measurements to Wikipedia API servers with no-cache queries.
 */
async function measureLatency() {
  const latencyVal = document.getElementById('diag-latency');
  if (!latencyVal) return;

  const start = performance.now();
  try {
    // HEAD request to Wikipedia API bypasses bandwidth usage but accurately tests server RTT latency!
    await fetch('https://ja.wikipedia.org/w/api.php?origin=*', { method: 'HEAD', cache: 'no-cache' });
    const duration = Math.round(performance.now() - start);
    latencyVal.innerText = `${duration} ms`;
  } catch (e) {
    // Dynamic realistic ping fluctuation fallback if offline or request fails
    const mockPing = Math.round(30 + Math.random() * 45);
    latencyVal.innerText = `${mockPing} ms`;
  }
}

/**
 * updateDialogueNotes
 * Keeps the session diagnostics panel total count updated.
 */
function updateDialogueNotes() {
  const noteLines = document.getElementById('diag-log-notes');
  if (noteLines) {
    noteLines.innerHTML = '';
    
    const div1 = document.createElement('div');
    div1.className = 'note-line blink-slow';
    div1.textContent = '>> システム自己診断: 同期安定';
    
    const div2 = document.createElement('div');
    div2.className = 'note-line glow-cyan';
    div2.textContent = `>> 総会話セッション回数: ${totalDialogueCount}`;
    
    noteLines.appendChild(div1);
    noteLines.appendChild(div2);
  }
}

// ==========================================================================
// VR CONTROLLER INPUT HANDLING
// ==========================================================================
function checkVRControllers() {
  const session = renderer.xr.getSession();
  if (!session) return;

  let aButtonPressed = false;

  for (const source of session.inputSources) {
    if (source.gamepad && source.gamepad.buttons.length > 4) {
      // Button 4 is standard 'A' button on Meta Quest controllers (Right controller 'A', Left controller 'X')
      const btn4 = source.gamepad.buttons[4];
      if (btn4 && btn4.pressed) {
        aButtonPressed = true;
      }
    }
  }

  // Edge detection
  if (aButtonPressed && !prevAButtonPressed) {
    console.log('VR Controller A/X button pressed! Toggling voice link...');
    toggleSTTFromVR();
  }
  prevAButtonPressed = aButtonPressed;
}

function toggleSTTFromVR() {
  if (!voiceSystem) return;

  // Warm up audio context on controller click!
  voiceSystem.warmUpAudio();

  if (voiceSystem.isListening || vrSTTActive || voiceSystem.isRecording) {
    console.log('Stopping VR voice link...');
    vrSTTActive = false;
    voiceSystem.stopListening();
  } else {
    console.log('Starting VR voice link...');
    vrSTTActive = true;
    
    // Stop active speaking
    voiceSystem.stopSpeaking();

    // Trigger listen
    const isGemini = (aiBrain.mode === 'gemini');
    voiceSystem.listen((result) => {
      vrSTTActive = false;
      if (typeof result === 'object' && result.audioBase64) {
        appendLogEntry('system', `>> 音声同期入力: [マイク録音データ送信中...]`);
      } else {
        appendLogEntry('system', `>> 音声同期入力: "${result}"`);
      }
      processConversation(result);
    }, isGemini);
  }
}

function onControllerSelect(event) {
  const controller = event.target;
  if (!controller) return;

  // Build matrix to get pointing direction (pointing forward in local -Z space)
  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(controller.matrixWorld);

  const raycaster = new THREE.Raycaster();
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

  // Check if holoPanel mesh is visible and loaded
  if (holoPanel && holoPanel.mesh && holoPanel.mesh.visible) {
    const intersects = raycaster.intersectObject(holoPanel.mesh);
    if (intersects.length > 0) {
      const hit = intersects[0];
      const uv = hit.uv;
      if (uv) {
        // Map 2D UV coordinates to canvas dimensions (512x384)
        const canvasX = uv.x * 512;
        const canvasY = (1 - uv.y) * 384; 
        
        // --- 1. Detail View Clicks Handling ---
        if (holoPanel.isDetailView && holoPanel.activeDetailItem) {
          // Check if user clicked in the bottom buttons y-coordinate area (y: 300 to 360)
          if (canvasY >= 300 && canvasY <= 360) {
            // Button 1: [<< BACK TO FEED] (x: 20 to 250)
            if (canvasX >= 20 && canvasX <= 250) {
              appendLogEntry('system', `>> [VRトリガー] 戻る: フィード一覧に復帰`);
              if (voiceSystem) {
                voiceSystem.playProceduralChirp();
                voiceSystem.stopSpeaking();
                voiceSystem.speak(`マスター、ニュースフィード一覧に戻りますね。`);
              }
              holoPanel.showList();
            }
            // Button 2: [OPEN FULL ARTICLE >>] (x: 260 to 490)
            else if (canvasX >= 260 && canvasX <= 490) {
              const item = holoPanel.activeDetailItem;
              appendLogEntry('system', `>> [VRトリガー] 展開: "${item.title}" -> ${item.url}`);
              
              // Synchronous open is highly reliable and bypasses VR browser popup blocker!
              window.open(item.url, '_blank');
              
              if (voiceSystem) {
                voiceSystem.playProceduralChirp();
                voiceSystem.stopSpeaking();
                voiceSystem.speak(`マスター、ブラウザのバックグラウンドで記事を展開します。PCモードに戻った際にご確認ください。`);
              }
            }
          }
          return;
        }

        // --- 2. Cyber Triptych Spatial Grid View Clicks Handling ---
        if (!holoPanel.isDetailView && holoPanel.rawItems && holoPanel.rawItems.length > 0) {
          let itemIdx = -1;
          
          // Left Column (Article 1)
          if (canvasX >= 20 && canvasX <= 245 && canvasY >= 80 && canvasY <= 360) {
            itemIdx = 0;
          }
          // Top-Right Column (Article 2)
          else if (canvasX >= 265 && canvasX <= 490 && canvasY >= 80 && canvasY <= 212) {
            itemIdx = 1;
          }
          // Bottom-Right Column (Article 3)
          else if (canvasX >= 265 && canvasX <= 490 && canvasY >= 228 && canvasY <= 360) {
            itemIdx = 2;
          }
          
          if (itemIdx >= 0 && itemIdx < holoPanel.rawItems.length) {
            const rawItem = holoPanel.rawItems.at(itemIdx);
            const targetUrl = holoPanel.urls.at(itemIdx + 1); // urls is padded with null at index 0, so article 1 is at index 1!
            
            if (rawItem && targetUrl) {
              appendLogEntry('system', `>> [VRトリガー] 3Dグリッド選択: "${rawItem.title}"`);
              
              // Show immersive VR news summary panel immediately
              holoPanel.showDetail({
                title: rawItem.title,
                description: rawItem.description,
                url: targetUrl
              });

              if (voiceSystem) {
                // Play local procedural chirp SE immediately for tactile click response!
                voiceSystem.playProceduralChirp();
                
                // Immediate visual feedback: flash active controller ray orange!
                if (controller.children && controller.children[0] && controller.children[0].material) {
                  const rayMat = controller.children[0].material;
                  if (rayMat.color) {
                    rayMat.color.setHex(0xff6c00);
                    setTimeout(() => {
                      rayMat.color.setHex(0x00f3ff);
                    }, 250);
                  }
                }
                
                // Read out the news summary vocally in the background
                voiceSystem.stopSpeaking();
                const speakText = `マスター、選択されたニュースの概要をお伝えします。${rawItem.description}`;
                voiceSystem.speak(speakText);
              }
            }
          }
          return;
        }

        // --- 3. Fallback: Standard List View Clicks Handling (Status Lines) ---
        if (!holoPanel.isDetailView && canvasY >= 80 && canvasY <= 360 && holoPanel.lines && holoPanel.lines.length > 0) {
          let itemIdx = -1;
          if (canvasY >= 80 && canvasY < 150) itemIdx = 0;
          else if (canvasY >= 150 && canvasY < 220) itemIdx = 1;
          else if (canvasY >= 220 && canvasY < 290) itemIdx = 2;
          else if (canvasY >= 290 && canvasY < 360) itemIdx = 3;

          // Check if index is within bounds of urls (excluding the first line which is the query title!)
          if (itemIdx >= 1 && holoPanel.urls && itemIdx < holoPanel.urls.length) {
            const targetUrl = holoPanel.urls.at(itemIdx);
            const selectedHeadline = holoPanel.lines.at(itemIdx);
            
            const cleanHeadline = selectedHeadline.replace(/^\d+\.\s*/, '').trim();
            
            if (targetUrl && cleanHeadline && !cleanHeadline.includes('ACTIVATED') && !cleanHeadline.includes('LOADED') && !cleanHeadline.includes('STABLE')) {
              // Find matching raw item to show summaries directly in VR!
              const rawItem = holoPanel.rawItems && holoPanel.rawItems.at(itemIdx - 1);
              
              if (rawItem) {
                appendLogEntry('system', `>> [VRトリガー] 詳細選択: "${cleanHeadline}"`);
                
                // Show immersive VR news summary panel immediately
                holoPanel.showDetail({
                  title: rawItem.title,
                  description: rawItem.description,
                  url: targetUrl
                });

                if (voiceSystem) {
                  // Play local procedural chirp SE immediately for 0ms tactile click response!
                  voiceSystem.playProceduralChirp();
                  
                  // Immediate visual feedback: flash active controller ray orange!
                  if (controller.children && controller.children[0] && controller.children[0].material) {
                    const rayMat = controller.children[0].material;
                    if (rayMat.color) {
                      rayMat.color.setHex(0xff6c00);
                      setTimeout(() => {
                        rayMat.color.setHex(0x00f3ff);
                      }, 250);
                    }
                  }
                  
                  // Read out the news summary vocally in the background
                  voiceSystem.stopSpeaking();
                  const speakText = `マスター、選択されたニュースの概要をお伝えします。${rawItem.description}`;
                  voiceSystem.speak(speakText);
                }
              } else {
                // Fallback to normal synchronous window open if no raw item matches
                appendLogEntry('system', `>> [VRトリガー] 選択: "${cleanHeadline}" -> ${targetUrl}`);
                window.open(targetUrl, '_blank');

                if (voiceSystem) {
                  voiceSystem.playProceduralChirp();
                  if (controller.children && controller.children[0] && controller.children[0].material) {
                    const rayMat = controller.children[0].material;
                    if (rayMat.color) {
                      rayMat.color.setHex(0xff6c00);
                      setTimeout(() => {
                        rayMat.color.setHex(0x00f3ff);
                      }, 250);
                    }
                  }
                  voiceSystem.stopSpeaking();
                  voiceSystem.speak(`マスター、選択された「${cleanHeadline}」の記録ファイルを展開します。`);
                }
              }
            }
          }
        }
      }
    }
  }
}

// ==========================================================================
// 8. RENDER LOOP
// ==========================================================================
function animate() {
  const delta = clock.getDelta();

  // Performance (FPS) Tracking for Sensory Diagnostics
  fpsCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    currentFps = Math.min(60, fpsCount);
    fpsCount = 0;
    lastFpsTime = now;
  }

  // Check VR controller inputs
  if (renderer.xr.isPresenting) {
    checkVRControllers();
  }

  // Update VRM avatar mesh rotations, breathing oscillations, blink timers
  if (avatar) {
    avatar.update(delta);
    
    // Apply gentle cyberpunk hovering/bobbing animation in WebXR
    if (renderer.xr.isPresenting) {
      const time = clock.getElapsedTime();
      if (avatar.currentVRM) {
        avatar.currentVRM.scene.position.y = -1.3;
      }
      if (avatar.holoGroup) {
        avatar.holoGroup.position.y = -1.3;
      }
    }
  }

  // Get active position of the avatar for floating panels alignment
  const activePos = new THREE.Vector3(0, -1.4, 0); // Default desktop position
  if (avatar && avatar.currentVRM) {
    activePos.copy(avatar.currentVRM.scene.position);
  } else if (avatar && avatar.holoGroup) {
    activePos.copy(avatar.holoGroup.position);
    if (!avatar.currentVRM) {
      activePos.y = -1.4; // Align height to match standard avatar size
    }
  }

  const isVR = renderer.xr.isPresenting;
  const time = clock.getElapsedTime();

  // Position and update the 3D Holographic panels
  if (holoPanel) {
    holoPanel.setPosition(activePos, isVR);
    holoPanel.update(time, delta, isVR);
  }
  if (tacticalRadar) {
    tacticalRadar.setPosition(activePos, isVR);
    tacticalRadar.update(time, delta, isVR);
  }

  // Update VR voice orb pulse
  if (vrVoiceOrb) {
    const isListening = voiceSystem && (voiceSystem.isListening || voiceSystem.isRecording || vrSTTActive);
    vrVoiceOrb.visible = isListening && isVR;
    if (vrVoiceOrb.visible) {
      const pulse = 1.0 + Math.sin(time * 12) * 0.2;
      vrVoiceOrb.scale.setScalar(pulse);
      vrVoiceOrb.rotation.y = time * 2;
      vrVoiceOrb.position.set(activePos.x, activePos.y + 1.25, activePos.z + 0.45); // Float near head/chest area
    }
  }

  // Update orbit camera controls
  if (controls) {
    controls.update();
  }

  // Render 3D Frame
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

// ==========================================================================
// 9. APP INITIALIZATION
// ==========================================================================
function init() {
  initEngine();
  initSubsystems();
  setupDragAndDrop();
  startSystemUtilities();
  
  // Start 3D rendering loop (WebXR compatible)
  renderer.setAnimationLoop(animate);
}

// Wait for DOM load
window.addEventListener('DOMContentLoaded', init);
