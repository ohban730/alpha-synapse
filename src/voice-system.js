import * as THREE from 'three';

/**
 * VoiceSystem Class
 * Orchestrates Web Speech API Speech Synthesis (TTS) and Speech Recognition (STT),
 * handles Japanese system voice filtering, phonetic lip-sync triggers, and HUD audio waves.
 */
export class VoiceSystem {
  constructor(avatar, updateUIStateCallback) {
    this.avatar = avatar;
    this.updateUIState = updateUIStateCallback; // Callback to sync voice status to HUD
    
    // Web Speech API - Synthesis (TTS)
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.selectedVoice = null;
    this.lipSyncInterval = null;
    this.activeUtterance = null;

    // Web Speech API - Recognition (STT)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = SpeechRecognition ? new SpeechRecognition() : null;
    this.isListening = false;

    // Equalizer animation variables
    this.eqAnimationId = null;
    this.isSpeaking = false;

    // Persistent HTML5 Audio element for Autoplay bypass and cloud fallback
    this.fallbackAudio = new Audio();
    this.fallbackAudio.preload = 'auto';
    this.fallbackAudio.style.display = 'none';
    this.fallbackAudio.id = 'alpha-fallback-audio';
    document.body.appendChild(this.fallbackAudio); // Attach to DOM to bypass mobile/Oculus autoplay rendering blocks!

    // VR Microphone fallback recording states
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.mediaStream = null;
    this.recTimeout = null;

    // Local SBV2 queue initialization
    this.audioQueue = [];
    this.isPlayingQueue = false;

    this.initSynthesis();
    this.initRecognition();
  }

  /**
   * Initialize Text-To-Speech Synthesis
   */
  initSynthesis() {
    // Define local Style-Bert-VITS2 option
    const localTtsVoice = {
      name: 'Style-Bert-VITS2 (ローカル音声 - 推奨)',
      lang: 'ja-JP',
      isLocalTTS: true,
      voiceName: 'jvnv-F1-jp'
    };

    // Define high-quality Gemini Native API Speech Synthesis options
    const geminiVoices = [
      { name: 'Gemini - Leda (優雅な女性ボイス)', lang: 'ja-JP', isGeminiTTS: true, voiceName: 'Leda' },
      { name: 'Gemini - Aoede (落ち着いた女性ボイス)', lang: 'ja-JP', isGeminiTTS: true, voiceName: 'Aoede' },
      { name: 'Gemini - Kore (元気な女性ボイス)', lang: 'ja-JP', isGeminiTTS: true, voiceName: 'Kore' },
      { name: 'Gemini - Puck (穏やかな男性ボイス)', lang: 'ja-JP', isGeminiTTS: true, voiceName: 'Puck' },
      { name: 'Gemini - Charon (渋い男性ボイス)', lang: 'ja-JP', isGeminiTTS: true, voiceName: 'Charon' },
      { name: 'Gemini - Fenrir (力強い男性ボイス)', lang: 'ja-JP', isGeminiTTS: true, voiceName: 'Fenrir' }
    ];

    // Define high-quality online Japanese cloud fallback voice
    const fallbackVoice = {
      name: 'クラウド音声 (日本語 - オンライン推奨)',
      lang: 'ja-JP',
      localService: false,
      default: false,
      isFallback: true
    };

    const loadVoices = () => {
      let nativeVoices = [];
      if (this.synth) {
        try {
          nativeVoices = this.synth.getVoices() || [];
        } catch (e) {
          console.warn('Failed to retrieve native voices:', e);
        }
      }

      // Combine Local TTS, Gemini native voices, fallback voice, and native voices
      this.voices = [localTtsVoice, ...geminiVoices, fallbackVoice, ...nativeVoices];
      
      // Load saved voice from localStorage
      let savedVoiceName = localStorage.getItem('alpha_selected_voice');
      
      // デフォルトとして Leda (優雅な女性ボイス) を最優先で設定・保存します
      if (!savedVoiceName || savedVoiceName === 'undefined' || savedVoiceName === 'null' || savedVoiceName === '') {
        savedVoiceName = 'Gemini - Leda (優雅な女性ボイス)';
        localStorage.setItem('alpha_selected_voice', savedVoiceName);
      }

      if (savedVoiceName) {
        const matched = this.voices.find(v => v.name === savedVoiceName);
        if (matched) {
          this.selectedVoice = matched;
        } else {
          // 保存されたボイスが現環境のリストで見つからない場合の堅牢なフォールバック
          console.warn(`Saved voice "${savedVoiceName}" not found in list. Falling back to Gemini Leda.`);
          const defaultLeda = geminiVoices.find(v => v.voiceName === 'Leda') || geminiVoices[0];
          this.selectedVoice = defaultLeda;
          localStorage.setItem('alpha_selected_voice', defaultLeda.name);
        }
      }

      if (!this.selectedVoice) {
        // By default, prioritize Gemini Leda
        this.selectedVoice = geminiVoices.find(v => v.voiceName === 'Leda') || geminiVoices[0];
      }

      // Trigger select menu refresh in main UI if callback is bound
      if (this.onVoicesLoaded) {
        this.onVoicesLoaded(this.voices, this.selectedVoice);
      }
    };

    if (!this.synth) {
      console.warn('Speech Synthesis is not supported in this browser. Activating Gemini/Cloud Fallback Voice.');
      // Execute loadVoices synchronously to register the fallback option
      loadVoices();
      return;
    }

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  /**
   * Initialize Speech-To-Text Recognition
   */
  initRecognition() {
    if (!this.recognition) {
      console.warn('Speech Recognition is not supported in this browser.');
      return;
    }

    // Configuration
    this.recognition.lang = 'ja-JP';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    // Handlers
    this.recognition.onstart = () => {
      this.isListening = true;
      this.hasError = false;
      this.updateUIState('listening');
    };

    this.recognition.onerror = (event) => {
      console.error('Speech Recognition Error:', event.error);
      this.isListening = false;
      this.hasError = true;
      this.updateUIState('error', event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      // Delay status reset to make it feel natural unless an error occurred
      setTimeout(() => {
        if (!this.isListening && !this.hasError) {
          this.updateUIState('idle');
        }
      }, 800);
    };
  }

  /**
   * Helper to fetch and play proxy-based Cloud TTS
   * @param {string} cleanText Clean text to speak
   * @param {function} onStart Start playback callback
   * @param {function} onComplete Completion callback
   */
  /**
   * Ultimate fallback to the browser's built-in local Japanese SpeechSynthesis (Web Speech API).
   * Runs 100% locally, no network requests, CORS-safe, bypasses all quota and proxy issues.
   */
  playLocalSpeechAPI(cleanText, onStart, onComplete) {
    if (!this.synth) {
      console.warn('Web Speech Synthesis is not supported in this browser. Speech failed.');
      this.updateUIState('error', 'すべての音声エンジン（Gemini API、Proxy API、ローカル音声API）の呼び出しに失敗しました。');
      if (onComplete) onComplete();
      return;
    }

    console.log('Attempting ultimate fallback to local browser SpeechSynthesis with chunk splitting.');
    
    // Split text into chunks using punctuation to prevent browser native synthesis freezing!
    const chunks = cleanText.split(/[。！？]+/).map(s => s.trim()).filter(s => s.length > 0);
    if (chunks.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    let chunkIdx = 0;
    
    const speakNextChunk = () => {
      if (!this.isSpeaking && chunkIdx > 0) {
        // Stopped in between
        return;
      }
      
      if (chunkIdx >= chunks.length) {
        this.cleanupSpeechState();
        if (onComplete) onComplete();
        return;
      }

      const chunkText = chunks[chunkIdx];
      this.activeUtterance = new SpeechSynthesisUtterance(chunkText);

      const nativeJaVoice = this.synth.getVoices().find(v => v.lang.startsWith('ja') && !v.name.includes('Gemini') && !v.name.includes('クラウド'));
      if (nativeJaVoice) {
        this.activeUtterance.voice = nativeJaVoice;
      } else {
        this.activeUtterance.lang = 'ja-JP';
      }

      this.activeUtterance.pitch = 1.05;
      this.activeUtterance.rate = 1.05;
      this.activeUtterance.volume = 1.0;

      this.activeUtterance.onstart = () => {
        if (chunkIdx === 0) {
          this.isSpeaking = true;
          this.avatar.setSpeaking(true);
          this.animateEqualizer(true);
          this.startLipSyncLoop(cleanText); // sync loop with original entire text
          if (onStart) onStart();
        }
      };

      this.activeUtterance.onend = () => {
        chunkIdx++;
        speakNextChunk();
      };

      this.activeUtterance.onerror = (e) => {
        console.error('Local synthesis chunk failed:', e);
        chunkIdx++;
        speakNextChunk();
      };

      this.synth.speak(this.activeUtterance);
    };

    // Begin speaking process
    this.isSpeaking = true; // Set flag early
    speakNextChunk();
  }

  playCloudTTS(cleanText, onStart, onComplete) {
    try {
      // Routed via secure relative proxy to completely bypass Google CORS/Referer/Oculus Browser blocks!
      const url = `/api/tts?ie=UTF-8&tl=ja&client=gtx&q=${encodeURIComponent(cleanText)}`;
      
      // Re-use the persistent, gesture-unlocked Audio element!
      this.fallbackAudio.src = url;
      
      let fallbackTriggered = false;
      const triggerFallback = (reason, err) => {
        if (fallbackTriggered) return;
        fallbackTriggered = true;
        console.warn(`${reason}. Falling back to local browser SpeechSynthesis:`, err);
        // Clear listeners to prevent multiple event dispatches
        this.fallbackAudio.onerror = null;
        this.fallbackAudio.onplay = null;
        this.fallbackAudio.onended = null;
        this.playLocalSpeechAPI(cleanText, onStart, onComplete);
      };

      this.fallbackAudio.onplay = () => {
        this.isSpeaking = true;
        this.avatar.setSpeaking(true);
        
        // Start immersive equalizer HUD animations
        this.animateEqualizer(true);

        // Start Japanese vowel lip-sync loop
        this.startLipSyncLoop(cleanText);
        
        if (onStart) onStart();
      };

      this.fallbackAudio.onended = () => {
        this.cleanupSpeechState();
        if (onComplete) onComplete();
      };

      this.fallbackAudio.onerror = (e) => {
        triggerFallback('Cloud TTS proxy failed', e);
      };

      this.fallbackAudio.play().catch((e) => {
        triggerFallback('Failed to auto-play Cloud TTS', e);
      });

    } catch (err) {
      console.error('Failed to instantiate Audio for Cloud TTS. Falling back to local browser SpeechSynthesis:', err);
      this.playLocalSpeechAPI(cleanText, onStart, onComplete);
    }
  }

  /**
   * Start Speech Synthesis for Alpha's response
   * @param {string} text The text to speak
   * @param {function} onComplete Callback when speech ends
   */
  /**
   * Start Speech Synthesis for Alpha's response
   * @param {string} text The text to speak
   * @param {function} onStart Callback when speech starts playing
   * @param {function} onComplete Callback when speech ends
   */
  speak(text, onStart, onComplete, emotion = 'relaxed') {
    // Stop active speech and clean timers
    this.stopSpeaking();

    // Remove any markdown, parentheticals, or emoticons for cleaner reading
    const cleanText = text
      .replace(/\(.*?\)/g, '')
      .replace(/（.*?）/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/[*_`~#]/g, '')
      .replace(/[「」『』【】]/g, '、');

    const isGeminiTTS = this.selectedVoice && this.selectedVoice.isGeminiTTS;
    const isFallback = this.selectedVoice && this.selectedVoice.isFallback;
    const isLocalTTS = this.selectedVoice && this.selectedVoice.isLocalTTS;

    // 0. Local Style-Bert-VITS2 (SBV2) TTS via server.py
    if (isLocalTTS) {
      console.log('Routing speech synthesis to Local Style-Bert-VITS2 (via server.py).');
      
      const isLocalDev = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1' || 
                          window.location.hostname === '[::1]' ||
                          window.location.hostname.endsWith('.local') ||
                          /^192\.168\./.test(window.location.hostname) ||
                          /^10\./.test(window.location.hostname) ||
                          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname);
      const endpoint = isLocalDev ? '/api/local-brain/api/tts' : 'http://localhost:8000/api/tts';
      
      // Split text into chunks that are strictly under 90 characters to bypass the SBV2 100-char limit
      const rawChunks = cleanText.split(/[。！？\n]+/).map(s => s.trim()).filter(s => s.length > 0);
      const chunks = [];
      
      rawChunks.forEach(chunk => {
        if (chunk.length <= 90) {
          chunks.push(chunk);
        } else {
          // Sub-split by commas or spaces if too long
          let currentSub = '';
          const subParts = chunk.split(/[、, ]+/);
          subParts.forEach(part => {
            if ((currentSub + part).length > 85) {
              if (currentSub) chunks.push(currentSub);
              currentSub = part;
            } else {
              currentSub = currentSub ? currentSub + '、' + part : part;
            }
          });
          if (currentSub) chunks.push(currentSub);
        }
      });

      if (chunks.length === 0) {
        if (onComplete) onComplete();
        return;
      }

      // Prepare array to hold audio results in correct order
      const results = new Array(chunks.length);
      let loadedCount = 0;
      let startedPlaying = false;

      const playQueueIfReady = () => {
        // Enqueue successfully loaded chunks in order
        while (loadedCount < chunks.length && results[loadedCount] !== undefined) {
          const res = results[loadedCount];
          if (res && res.audio) {
            this.enqueueAudio(res.audio, res.text, emotion);
            if (!startedPlaying) {
              startedPlaying = true;
              if (onStart) onStart();
            }
          }
          loadedCount++;
        }
        if (loadedCount >= chunks.length && this.audioQueue.length === 0 && !this.isPlayingQueue) {
          // All chunks done and finished playing
          if (onComplete) onComplete();
        }
      };

      // Fetch all chunks in parallel
      chunks.forEach((chunkText, idx) => {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunkText, emotion: emotion })
        })
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then(result => {
          if (result.error) throw new Error(result.error);
          results[idx] = {
            audio: result.audio,
            text: chunkText
          };
          playQueueIfReady();
        })
        .catch(err => {
          console.error(`Local TTS chunk ${idx} failed:`, err);
          // Insert null to prevent blocking the queue
          results[idx] = null;
          playQueueIfReady();
        });
      });

      return;
    }

    // 1. High-fidelity Gemini Native TTS
    if (isGeminiTTS && this.aiBrain && this.aiBrain.geminiKey) {
      console.log('Routing speech synthesis to Gemini Native TTS.');
      
      this.aiBrain.generateAudioFromText(cleanText)
        .then(result => {
          // Robust WAV parsing: Auto-detect if Gemini's response already contains a standard RIFF/WAVE container header.
          // Gemini API typically returns a fully-packed standard WAV container!
          const raw = window.atob(result.base64Audio);
          const uInt8Array = Uint8Array.from(raw, (_, i) => raw.charCodeAt(i));

          let wavBlob;
          const isRiffContainer = uInt8Array[0] === 0x52 && uInt8Array[1] === 0x49 && uInt8Array[2] === 0x46 && uInt8Array[3] === 0x46; // "RIFF"
          
          if (isRiffContainer) {
            console.log("Gemini audio contains valid standard WAV container. Loading directly.");
            wavBlob = new Blob([uInt8Array], { type: result.mimeType || 'audio/wav' });
          } else {
            console.log("Gemini audio contains headerless PCM. Injecting standard WAV header.");
            wavBlob = this.pcmToWavBlob(result.base64Audio);
          }

          const audioUrl = URL.createObjectURL(wavBlob);
          this.fallbackAudio.src = audioUrl;

          this.fallbackAudio.onplay = () => {
            this.isSpeaking = true;
            this.avatar.setSpeaking(true);
            this.animateEqualizer(true);
            this.startLipSyncLoop(cleanText);
            
            if (onStart) onStart();
          };

          this.fallbackAudio.onended = () => {
            this.cleanupSpeechState();
            if (onComplete) onComplete();
          };

          this.fallbackAudio.onerror = (e) => {
            console.error('Gemini Native TTS playback error:', e);
            this.updateUIState('error', 'Gemini Native TTS 再生に失敗しました');
            this.cleanupSpeechState();
            if (onComplete) onComplete();
          };

          this.fallbackAudio.play().catch((e) => {
            console.error('Failed to auto-play Gemini Native TTS:', e);
            this.updateUIState('error', `自動再生ブロック: ${e.message}`);
            this.cleanupSpeechState();
            if (onComplete) onComplete();
          });
        })
        .catch(err => {
          console.error('Gemini Native TTS generation failed:', err);
          this.updateUIState('error', `音声生成失敗: ${err.message}`);
          
          // Secondary fallback to proxy Cloud TTS
          console.log('Falling back to proxy Cloud TTS.');
          this.playCloudTTS(cleanText, onStart, onComplete);
        });
      return;
    }

    // 2. Fallback Proxy Cloud TTS
    if (isFallback || !this.synth) {
      console.log('Routing speech synthesis to Cloud TTS Fallback.');
      this.playCloudTTS(cleanText, onStart, onComplete);
      return;
    }

    // 3. Web Speech API local browser voices with chunk splitting to bypass freeze bugs
    const chunks = cleanText.split(/[。！？]+/).map(s => s.trim()).filter(s => s.length > 0);
    if (chunks.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    let chunkIdx = 0;
    
    const speakNextChunk = () => {
      if (!this.isSpeaking && chunkIdx > 0) {
        return;
      }
      
      if (chunkIdx >= chunks.length) {
        this.cleanupSpeechState();
        if (onComplete) onComplete();
        return;
      }

      const chunkText = chunks[chunkIdx];
      this.activeUtterance = new SpeechSynthesisUtterance(chunkText);
      
      if (this.selectedVoice && !this.selectedVoice.isGeminiTTS && !this.selectedVoice.isFallback) {
        this.activeUtterance.voice = this.selectedVoice;
      } else {
        const nativeJaVoices = this.synth.getVoices().filter(v => v.lang.startsWith('ja') && !v.name.includes('Gemini') && !v.name.includes('クラウド'));
        const femaleJaVoice = nativeJaVoices.find(v => 
          v.name.toLowerCase().includes('haruka') || 
          v.name.toLowerCase().includes('ayumi') || 
          v.name.toLowerCase().includes('sayaka') ||
          v.name.toLowerCase().includes('nanami') ||
          v.name.toLowerCase().includes('aoi') ||
          v.name.toLowerCase().includes('google') ||
          (!v.name.toLowerCase().includes('ichiro') && !v.name.toLowerCase().includes('keita') && !v.name.toLowerCase().includes('dave') && !v.name.toLowerCase().includes('mark'))
        );
        
        const targetVoice = femaleJaVoice || nativeJaVoices[0];
        if (targetVoice) {
          this.activeUtterance.voice = targetVoice;
        } else {
          this.activeUtterance.lang = 'ja-JP';
        }
      }

      this.activeUtterance.pitch = 1.05; 
      this.activeUtterance.rate = 1.05;  
      this.activeUtterance.volume = 1.0;

      this.activeUtterance.onstart = () => {
        if (chunkIdx === 0) {
          this.isSpeaking = true;
          this.avatar.setSpeaking(true);
          this.animateEqualizer(true);
          this.startLipSyncLoop(cleanText); // sync loop with original entire text
          if (onStart) onStart();
        }
      };

      this.activeUtterance.onend = () => {
        chunkIdx++;
        speakNextChunk();
      };

      this.activeUtterance.onerror = (e) => {
        console.error('Speech synthesis chunk error:', e);
        chunkIdx++;
        speakNextChunk();
      };

      this.synth.speak(this.activeUtterance);
    };

    // Begin speaking process
    this.isSpeaking = true; // Set flag early
    speakNextChunk();
  }

  /**
   * Synthesizes and plays a gorgeous futuristic cyberpunk neural link SE using the Web Audio API.
   * Completely local, 0ms load delay, works 100% of the time, bypasses autoplay limits.
   */
  playProceduralChirp() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      
      // 1. Futuristic High-Frequency Neural Scan Sweep (Chirp)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      osc1.type = 'sine';
      // Quick pitch sweep downwards (represents data pulse sync)
      osc1.frequency.setValueAtTime(1600, now);
      osc1.frequency.exponentialRampToValueAtTime(500, now + 0.12);
      
      gain1.gain.setValueAtTime(0.005, now);
      gain1.gain.linearRampToValueAtTime(0.12, now + 0.01); // fast attack
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12); // fast decay
      
      osc1.start(now);
      osc1.stop(now + 0.12);
      
      // 2. Futuristic Low-Frequency Spine Synapse Hum (Sway)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc2.type = 'triangle';
      // Low organic hum climbing slightly
      osc2.frequency.setValueAtTime(100, now);
      osc2.frequency.linearRampToValueAtTime(140, now + 0.22);
      
      gain2.gain.setValueAtTime(0.18, now);
      gain2.gain.linearRampToValueAtTime(0.001, now + 0.22);
      
      osc2.start(now);
      osc2.stop(now + 0.22);
      
    } catch (err) {
      console.warn('Failed to synthesize cyber chirp SE:', err);
    }
  }

  /**
   * Stop active speech synthesis and clean states.
   */
  stopSpeaking() {
    this.audioQueue = [];
    this.isPlayingQueue = false;

    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (e) {}
    }
    if (this.fallbackAudio) {
      try {
        this.fallbackAudio.pause();
        this.fallbackAudio.removeAttribute('src');
        this.fallbackAudio.onerror = null;
        this.fallbackAudio.onplay = null;
        this.fallbackAudio.onended = null;
        this.fallbackAudio.load();
      } catch (e) {}
    }
    this.cleanupSpeechState();
  }

  /**
   * Enqueue dynamic local voice synthesis audio for Ollama mode
   */
  enqueueAudio(base64Audio, cleanText, expression) {
    this.audioQueue.push({
      base64Audio,
      cleanText,
      expression
    });
    console.log(`Audio enqueued. Queue length: ${this.audioQueue.length}`);
    if (!this.isPlayingQueue) {
      this.playNextInQueue();
    }
  }

  /**
   * Play the next audio item in the queue
   */
  playNextInQueue() {
    if (this.audioQueue.length === 0) {
      this.isPlayingQueue = false;
      this.cleanupSpeechState();
      return;
    }

    this.isPlayingQueue = true;
    const currentItem = this.audioQueue.shift();
    let audioUrl = '';
    
    try {
      // Decode Base64 WAV to Blob
      const raw = window.atob(currentItem.base64Audio);
      const uInt8Array = Uint8Array.from(raw, (_, i) => raw.charCodeAt(i));
      const wavBlob = new Blob([uInt8Array], { type: 'audio/wav' });
      audioUrl = URL.createObjectURL(wavBlob);
      
      this.fallbackAudio.src = audioUrl;

      // Sync expression
      if (this.aiBrain) {
        this.aiBrain.applyAvatarExpression(currentItem.expression);
      }

      this.fallbackAudio.onplay = () => {
        this.isSpeaking = true;
        this.avatar.setSpeaking(true);
        this.animateEqualizer(true);
        
        const lipSyncText = currentItem.cleanText
          .replace(/\(.*?\)/g, '')
          .replace(/（.*?）/g, '')
          .replace(/\[.*?\]/g, '')
          .replace(/[*_`~#]/g, '')
          .replace(/[「」『』【】]/g, '、');
        this.startLipSyncLoop(lipSyncText);
      };

      this.fallbackAudio.onended = () => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        this.playNextInQueue();
      };

      this.fallbackAudio.onerror = (e) => {
        console.error('Queue audio playback error:', e);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        this.playNextInQueue();
      };

      this.fallbackAudio.play().catch((e) => {
        console.error('Failed to play queue audio:', e);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        this.playNextInQueue();
      });

    } catch (err) {
      console.error('Failed to parse queued audio base64:', err);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      this.playNextInQueue();
    }
  }

  /**
   * Reset active timers, loops, animations, and model flags.
   */
  cleanupSpeechState() {
    this.isSpeaking = false;
    this.avatar.setSpeaking(false);
    this.animateEqualizer(false);

    if (this.lipSyncInterval) {
      clearInterval(this.lipSyncInterval);
      this.lipSyncInterval = null;
    }
  }

  /**
   * Implements custom periodic phonetic lip-sync looping.
   * Matches the visual mouth opening rate to spoken Japanese syllables.
   * @param {string} text 
   */
  startLipSyncLoop(text) {
    if (this.lipSyncInterval) {
      clearInterval(this.lipSyncInterval);
    }

    const vowels = ['aa', 'ih', 'ou', 'ee', 'oh'];
    let idx = 0;

    // Run mouth shape updates at approx 7.5Hz (every 130ms)
    this.lipSyncInterval = setInterval(() => {
      if (!this.isSpeaking) {
        clearInterval(this.lipSyncInterval);
        return;
      }

      // Check current letter to guess vowel shape (Japanese syllabary parsing)
      const char = text.charAt(idx);
      let selectedVowel = 'aa';

      if (char) {
        const c = char.toLowerCase();
        if (['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ', 'a'].includes(c)) {
          selectedVowel = 'aa';
        } else if (['い', 'き', 'し', 'ち', 'に', 'ひ', 'み', 'り', 'i'].includes(c)) {
          selectedVowel = 'ih';
        } else if (['う', 'く', 'す', 'つ', 'ぬ', 'ふ', 'む', 'ゆ', 'る', 'u'].includes(c)) {
          selectedVowel = 'ou';
        } else if (['え', 'け', 'せ', 'て', 'ね', 'へ', 'め', 'れ', 'e'].includes(c)) {
          selectedVowel = 'ee';
        } else if (['お', 'こ', 'そ', 'と', 'の', 'ほ', 'も', 'よ', 'ろ', 'を', 'o'].includes(c)) {
          selectedVowel = 'oh';
        } else {
          // Cycle if punctuation or consonant
          selectedVowel = vowels.at(Math.floor(Math.random() * vowels.length));
        }
        
        this.avatar.setViseme(selectedVowel);
        idx = (idx + 1) % text.length;
      }
    }, 130);
  }

  /**
   * Warm up audio context and elements by playing a silent sound.
   * Triggered by direct user gestures to bypass strict browser autoplay policies.
   */
  warmUpAudio() {
    // 1. Web Speech API (SpeechSynthesis) warm up / unlock
    if (this.synth) {
      try {
        const dummyUtterance = new SpeechSynthesisUtterance(' ');
        dummyUtterance.volume = 0.0;
        this.synth.speak(dummyUtterance);
      } catch (e) {
        console.warn('Failed to warm up SpeechSynthesis:', e);
      }
    }

    // 2. HTML5 Audio elements warm up
    try {
      // Use a completely independent temporary Audio element to warm up permissions,
      // preventing any interruption or replay of the main active TTS playback!
      const dummyAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      dummyAudio.play().catch(() => {});

      // Play a short silent sound on the main fallbackAudio element to unlock it for future async playbacks
      if (this.fallbackAudio && (this.fallbackAudio.paused || !this.fallbackAudio.src)) {
        const originalSrc = this.fallbackAudio.src;
        if (!originalSrc || originalSrc.startsWith('data:')) {
          this.fallbackAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
          this.fallbackAudio.play().catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Failed to warm up Audio elements:', err);
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        const ctx = THREE.AudioContext.getContext();
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().then(() => {
            console.log('Global Web AudioContext successfully resumed.');
          });
        }
      }
    } catch (err) {
      console.warn('Failed to warm up Web AudioContext:', err);
    }
  }

  /**
   * Listen for user speech (STT).
   * @param {function} onFinalResult Callback receiving final text transcript or audio data object
   * @param {boolean} isGeminiMode Flag to permit direct audio upload fallback
   */
  listen(onFinalResult, isGeminiMode = false) {
    const isOllamaMode = this.aiBrain && this.aiBrain.mode === 'ollama';

    if (isOllamaMode) {
      console.log('Ollama mode active. Forcing completely local STT using MediaRecorder and backend Whisper.');
      this.startMicRecording(onFinalResult);
      return;
    }

    if (!this.recognition) {
      if (isGeminiMode) {
        console.log('Speech Recognition not supported. Activating Gemini Audio Fallback (MediaRecorder).');
        this.startMicRecording(onFinalResult);
      } else {
        console.warn('Speech Recognition is not supported.');
        alert('音声認識（Web Speech API）はお使いのブラウザでサポートされていません。ローカルOllamaモードでは音声入力が利用できません。音声入力を使用するには「Gemini APIモード」に切り替えていただくか、PCのChrome等の対応ブラウザをご使用ください。');
      }
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
      return;
    }

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript && onFinalResult) {
        onFinalResult(transcript);
      }
    };

    try {
      this.recognition.start();
    } catch (e) {
      console.error('Error starting recognition:', e);
    }
  }

  /**
   * Implements robust local microphone recording as STT fallback.
   */
  async startMicRecording(onFinalResult) {
    if (this.isRecording) {
      this.stopMicRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;
      this.audioChunks = [];
      
      // Supported MIME types list for cross-platform compatibility (iOS, Quest 3, Android, PC)
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4'; // iOS/Safari
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = ''; // System default
      }
      
      const options = mimeType ? { mimeType } : {};
      this.mediaRecorder = new MediaRecorder(stream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        const actualMime = this.mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: actualMime });
        
        const isOllamaMode = this.aiBrain && this.aiBrain.mode === 'ollama';
        
        if (isOllamaMode) {
          console.log('Sending audio blob to local FastAPI server for Whisper transcription...');
          
          const isLocalDev = window.location.hostname === 'localhost' || 
                              window.location.hostname === '127.0.0.1' || 
                              window.location.hostname === '[::1]' ||
                              window.location.hostname.endsWith('.local') ||
                              /^192\.168\./.test(window.location.hostname) ||
                              /^10\./.test(window.location.hostname) ||
                              /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname);
          const endpoint = isLocalDev ? '/api/local-brain/api/stt' : 'http://localhost:8000/api/stt';
          
          const formData = new FormData();
          formData.append('file', audioBlob, 'audio.webm');
          
          this.updateUIState('transcribing');
          
          fetch(endpoint, {
            method: 'POST',
            body: formData
          })
          .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
          })
          .then(result => {
            if (result.error) throw new Error(result.error);
            console.log('Local STT transcription result:', result.text);
            
            this.updateUIState('idle');
            
            if (onFinalResult) {
              onFinalResult(result.text);
            }
          })
          .catch(err => {
            console.error('Local STT transcription failed:', err);
            this.updateUIState('error', err.message);
            if (onFinalResult) {
              onFinalResult('');
            }
          });
        } else {
          // Standard base64 fallback for Gemini mode
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Data = reader.result.split(',')[1];
            if (onFinalResult) {
              onFinalResult({
                audioBase64: base64Data,
                mimeType: actualMime.split(';')[0]
              });
            }
          };
          reader.readAsDataURL(audioBlob);
        }

        stream.getTracks().forEach(track => track.stop());
      };

      this.isRecording = true;
      this.updateUIState('listening_fallback');

      this.mediaRecorder.start();
      console.log('Started microphone recording...');

      // Auto-stop after 10 seconds to give user enough time to speak naturally
      this.recTimeout = setTimeout(() => {
        if (this.isRecording) {
          this.stopMicRecording();
        }
      }, 10000);

    } catch (err) {
      console.error('Failed to access microphone for Audio Fallback:', err);
      alert('マイクの初期化に失敗しました。アクセス権限を確認してください。');
      this.updateUIState('idle');
    }
  }

  stopMicRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.recTimeout) {
      clearTimeout(this.recTimeout);
      this.recTimeout = null;
    }
    this.isRecording = false;
    this.updateUIState('idle');
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
    if (this.isRecording) {
      this.stopMicRecording();
    }
  }

  /**
   * Animate the bottom frequency HUD waveform bars.
   * Flutters bars dynamically using high-speed sine functions while speaking.
   * @param {boolean} active 
   */
  animateEqualizer(active) {
    if (this.eqAnimationId) {
      cancelAnimationFrame(this.eqAnimationId);
      this.eqAnimationId = null;
    }

    const freqBars = document.querySelectorAll('.freq-bar');
    if (freqBars.length === 0) return;

    if (!active) {
      // Smoothly return bars to minimum height
      freqBars.forEach(bar => {
        bar.style.height = '4px';
      });
      return;
    }

    const draw = () => {
      if (!this.isSpeaking) return;

      const time = Date.now() * 0.01;

      freqBars.forEach((bar, idx) => {
        // Combine sine wave functions with index offsets to create complex organic wave
        const multiplier = Math.sin(time + idx * 0.4) * Math.cos(time * 0.5 - idx * 0.2);
        const intensity = 0.3 + 0.7 * Math.random(); // Subtle organic noise
        
        // Calculate height (between 4px and 38px)
        let heightVal = 4 + Math.abs(multiplier) * intensity * 34;
        bar.style.height = `${heightVal}px`;
      });

      this.eqAnimationId = requestAnimationFrame(draw);
    };

    draw();
  }

  /**
   * Prepend standard 44-byte WAV header to raw 16-bit 24kHz mono PCM data from Gemini TTS
   * @param {string} base64Pcm 
   * @returns {Blob} Playable audio/wav Blob
   */
  pcmToWavBlob(base64Pcm) {
    const raw = window.atob(base64Pcm);
    const rawLength = raw.length;
    const pcmBuffer = Uint8Array.from(raw, (_, i) => raw.charCodeAt(i));

    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    // "RIFF"
    view.setUint32(0, 0x52494646, false);
    // File length (36 + rawLength)
    view.setUint32(4, 36 + rawLength, true);
    // "WAVE"
    view.setUint32(8, 0x57415645, false);

    // "fmt "
    view.setUint32(12, 0x666d7420, false);
    // Subchunk1Size (16)
    view.setUint32(16, 16, true);
    // AudioFormat (1 for PCM)
    view.setUint16(20, 1, true);
    // NumChannels (1 for mono)
    view.setUint16(22, 1, true);
    // SampleRate (24000 Hz)
    view.setUint32(24, 24000, true);
    // ByteRate (SampleRate * NumChannels * BitsPerSample/8 = 24000 * 1 * 2 = 48000)
    view.setUint32(28, 48000, true);
    // BlockAlign (NumChannels * BitsPerSample/8 = 1 * 2 = 2)
    view.setUint16(32, 2, true);
    // BitsPerSample (16 bits)
    view.setUint16(34, 16, true);

    // "data"
    view.setUint32(36, 0x64617461, false);
    // Subchunk2Size (rawLength)
    view.setUint32(40, rawLength, true);

    return new Blob([header, pcmBuffer], { type: 'audio/wav' });
  }
}
