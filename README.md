🇺🇸 **English** | 🇯🇵 [日本語版](README.ja.md)

# 🌌 Alpha Synapse

[![Demo Site](https://img.shields.io/badge/Demo_Site-alpha--xr.org-00f3ff.svg?style=flat-square)](https://alpha-xr.org)
[![Cyberpunk Vibe](https://img.shields.io/badge/Theme-Cyberpunk_Visor-orange.svg?style=flat-square)](#)
[![Tech Stack](https://img.shields.io/badge/Tech-Three.js_|_VRM_|_WebXR-00f3ff.svg?style=flat-square)](#)

A 3D Augmented Reality simulator where you synchronize with "Alpha", an advanced personal AI assistant projected into your field of view, and interact with her using voice or text through a futuristic tactical AR HUD.

🌐 **Online Live Demo:** [https://alpha-xr.org](https://alpha-xr.org)

<p align="center">
  <video src="./assets/demo.mp4" width="100%" height="auto" controls autoplay loop muted></video>
</p>

---

## 💎 Complete BYO (Bring Your Own) Model

To maximize user privacy and keep the developer's server maintenance costs at absolute zero, this system operates on a **Complete BYO (Bring Your Own)** architecture. You bring both your visual assets and your own AI brain:

*   **BYO Avatar**: Synchronize your own custom 3D avatar (.vrm format) by simply dragging and dropping it into the browser.
*   **BYO Cloud Key**: Set up high-fidelity cloud connection by entering your personal Google Gemini API key.
*   **BYO Local LLM**: Achieve complete local privacy and unlimited free usage by connecting the app to an Ollama server running on your local machine.

---

## 🌌 Core Features & Experience Guide

This simulator allows you to experience a highly immersive 3D personal AI companion inside a futuristic sci-fi tactical HUD interface. Here is an overview of the key features and how you can trigger/experience them:

### 1. 3D Avatar Projection (VRM Avatar Projection)
*   **What it does**: Materialize your favorite 3D character (VRM avatar) directly in the 3D space. The avatar performs natural breathing, idle gestures, and interactive eye-tracking that dynamically follows your mouse pointer or VR controller inputs.
*   **How to try it**:
    1. Simply drag and drop any `.vrm` file (VRM 0.x / 1.0 supported) from your computer directly onto the 3D viewport canvas.
    2. Alternatively, open the "NEURAL LINK OPTIONS" panel on the right side of the screen and click the **"Load VRM File"** button to browse and upload it locally.

### 2. AI Chat & Voice Interaction (Multimodal AI Link)
*   **What it does**: Enjoy real-time smart text or voice dialogue with your companion "Alpha". The 3D VRM avatar dynamically changes her facial expressions (happy, sad, angry, surprised, relaxed) and body poses (e.g., thinking, joy, idle) in sync with her thoughts. When using Gemini API, she speaks her replies back to you in an elegant prebuilt AI voice (using native v1beta TTS).
*   **How to try it**:
    1. Ensure your API key (Gemini) or local LLM (Ollama) settings are synced.
    2. **For Text Chat**: Type your message in the chat input bar at the bottom right and click the **"Send"** button.
    3. **For Voice Interaction**: Click the **"NEURAL LINK (音声対話)"** button at the bottom, grant microphone access, and speak when it displays "どうぞお話しください" (Please speak). Once you stop speaking, the app automatically transcribes and sends your speech to Alpha.

### 3. Curved Holographic Web Visor (Search & Yahoo News Portal)
*   **What it does**: Dynamically summon a cyberpunk curved web browser (Web Visor) in front of you by talking to Alpha.
    - **Yahoo! Japan News Portal**: Real-time Yahoo! topics RSS feed portal fetch and display.
    - **Wikipedia Search**: CORS-Safe instant Wikipedia search integration. The search summary is dynamically transcribed onto the 3D Holographic Floating HUD Panel floating in the 3D canvas, giving you an immersive Iron-Man-like HUD experience.
*   **How to try it**:
    1. Chat or speak to Alpha: "**Show me the news**", "**Open Yahoo News**" or "**最新のニュースを教えて**" to trigger the news portal dashboard.
    2. Ask to search: "**Search about Google**", "**Three.jsについて調べて**" or "**Look up space**".
    3. The holographic browser visor will smoothly slide into view displaying the live topics feed or search database results.

### 4. Terminal Decryption & AI Insights (AI Cognitive Insight & TTS Reader)
*   **What it does**: Clicking a topic in the visor opens a terminal-style decryption overlay. Alpha will generate a live, logical, and companion-focused analysis/advice (AI Insight) for that news article. You can also click the TTS speak button to hear her read the analysis aloud using her native TTS voice.
*   **How to try it**:
    1. Open the Web Visor and click any news card or search result.
    2. A cybernetic decoder terminal overlay will launch, compiling the article synopsis and generating the **"ALPHA AI INSIGHT"** card.
    3. Click the **"🎙️ 音声読み上げ"** (Read Aloud) button to have Alpha explain her insight to you verbally with natural vocal synthesis.

---

## 📋 Prerequisites

To clone, build, and run this project on your machine, you must have the following installed:

*   **Node.js**: `v18.0.0` or higher (LTS `v20.0.0`+ recommended / **Verified environment: `v24.15.0`**)
*   **NPM**: `v10.0.0` or higher (**Verified environment: `v11.12.1`**)

---

## 🚀 Cloning & Initial Setup

Clone the repository to your local machine, install the dependencies, and launch the local HTTP development server.

```bash
# Clone the repository and navigate into it
git clone https://github.com/your-username/alpha-synapse.git
cd alpha-synapse

# Install dependencies
npm install

# Start the local development server (Default port: http://localhost:3000)
npm run dev
```

---

## ☁️ Cloud LLM (Google Gemini API) Setup Guide

This is the **highly recommended mode** to experience maximum AI intelligence and beautifully natural, high-fidelity voice dialogue immediately.
*Note: The cloud LLM pipeline is currently designed specifically around the **Google Gemini API** (future updates plan to add other cloud providers).*

### 1. Retrieve Your API Key
1. Visit [Google AI Studio](https://aistudio.google.com/) and generate a free API key.
2. Copy the generated key.

### 2. Configure the App
1. Open the application (via the live demo `https://alpha-xr.org` or your local development URL).
2. Expand the **"NEURAL LINK OPTIONS"** panel on the right side of the screen.
3. Select **"Gemini API (Recommended/Online)"** under the **"INTELLIGENCE SYNC CORE"** setting.
4. Paste your copied API key into the **"GEMINI API KEY"** input field.
5. Select your preferred model (Default: `Gemini 3.5 Flash`) under **"GEMINI MODEL"**.
6. Click the **"Sync Neural Link"** button to establish the link.

### 💎 Key Advantages of Gemini Mode
*   **State-of-the-Art Intelligence**: Seamless, smart, and context-aware responses driven by Google's latest models.
*   **Native TTS (Text-to-Speech)**: Extremely natural speech synthesis featuring 6 official high-quality voice profiles (Leda, Aoede, etc.) tuned for elegant Japanese pronunciation.
*   **Direct Audio Stream Processing**: Talk directly using your voice; the app handles direct mic capture streams to feed the LLM.

---

## 🛠️ Local LLM (Ollama) Setup Guide

A **power-user mode** that operates entirely offline, keeping your conversations 100% private, free, and unrestricted.

> [!WARNING]
> Accessing a local HTTP service (`http://localhost:11434`) from a remote secure HTTPS website (`https://alpha-xr.org`) is generally blocked by browser **CORS & Mixed Content policies**.
> To use the Local LLM mode, **you must clone this repository and run the app locally via `http://localhost:3000` (Local HTTP Context).**

### 1. Configure CORS in Ollama
To allow your web browser to communicate with your local Ollama server, you must launch Ollama with the `OLLAMA_ORIGINS` environment variable set to `*` (or to your specific origin).

#### 💻 On Windows (Recommended: Global System Environment Variable)
1. Press `Win + R`, type `sysdm.cpl` and hit Enter to open **System Properties**.
2. Navigate to the **"Advanced"** tab and click **"Environment Variables..."**.
3. Under System Variables (or User Variables), click **"New..."** to add a variable:
   *   **Variable Name:** `OLLAMA_ORIGINS`
   *   **Variable Value:** `*`
4. Click OK on all windows to apply the setting.
5. **CRITICAL STEP**: Right-click the Ollama icon in the Windows system tray and select **"Quit Ollama"**, then launch it again from the Start Menu to load the new global environment variable.

*(If you only want to test via terminal, run `set OLLAMA_ORIGINS=*` in Command Prompt or `$env:OLLAMA_ORIGINS="*"` in PowerShell, then run `ollama serve` in the same window)*

#### 🍎 On macOS
Make sure the Ollama application is completely closed, then launch it from the terminal with the variable prepended:
```bash
OLLAMA_ORIGINS="*" open -a Ollama
```

#### 🐧 On Linux
Edit the system service configuration:
```bash
sudo systemctl edit ollama.service
```
Add the environment line in the configuration block and save:
```ini
[Service]
Environment="OLLAMA_ORIGINS=*"
```
Reload systemd and restart the service:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

### 2. Download the Model (Pull)
Ensure the model specified in the app is downloaded locally:

```bash
# Pull Llama 3.2 3B (Recommended lightweight model)
ollama pull llama3.2
```

### 3. Establish Sync in App
1. Open your browser to `http://localhost:3000`.
2. Expand the **"NEURAL LINK OPTIONS"** panel on the right.
3. Select **"Ollama (Local LLM)"** in the sync core dropdown.
4. Set the **"MODEL NAME"** input to your downloaded model (e.g., `llama3.2`).
5. Click **"Sync Neural Link"**.
6. Chat using voice or text; Alpha will begin generating local responses!

---

## ⚡ Troubleshooting (Ollama Connections)

### 🔴 "Failed to Fetch" Error during Chat
1.  **Check if Ollama is running**: Visit `http://localhost:11434` in your browser. It should output `Ollama is running`.
2.  **CORS Variable Missing**: Ensure `OLLAMA_ORIGINS` is configured correctly and the Ollama server has been *fully* restarted (not just minimized).
3.  **HTTPS Mixed Content Restriction**: If you are accessing the app via the production HTTPS URL (`https://alpha-xr.org`), strict browsers (like Safari) will block fetches to `http://localhost`. Run the app locally over HTTP via `npm run dev` to bypass this.

---

## 🛠️ Development & Transparency (OSS Policy)

To foster trust in the open-source community, we believe in being **completely honest and transparent** about our development process, AI collaboration, and current codebase status.

### 🚀 1. Speed Development & "Vibe Coding"
This project was rapidly prototyped and built using **Vibe Coding**—leveraging advanced AI tools (Antigravity - Gemini) for high-speed development.
*   **AI Collaboration**: The architecture is a co-creation between human directive design and high-speed AI output. Consequently, while functionality was delivered incredibly fast, some parts of the codebase remain raw, unified in single files, and lack strict refactoring. It works wonderfully, but it is not a "highly polished" academic codebase.
*   **Why Open Source?**: By adopting a Bring Your Own Key (BYOK) model, we keep host costs at zero while offering everyone free, transparent access to test the future of MR avatar-based AI interfaces.

### 🔒 2. Privacy & Security Assurance
Your privacy is our absolute priority.
*   **Zero Server Transmission**: Your Gemini API key and uploaded VRM files are processed and stored **100% locally in your own browser** (via `localStorage` and memory arrays). They are **never** transmitted to any external server managed by developers or third parties.
*   **Transparent Traffic**: Network traffic is strictly restricted to direct calls to the official "Google AI Studio API endpoints" and your own local loopback Ollama port (`127.0.0.1`).

### 📋 3. Code Quality & Known Technical Debt
Because we prioritized building visual high-fidelity and real-time interaction speed, the following debt is openly shared:
*   **Monolithic HUD Component**: Most of the HUD's UI state rendering is grouped in single-file scripts rather than decoupled UI modular templates, leaving high potential for modular refactoring.
*   **No Automated Tests**: There are currently **no automated unit or E2E tests** configured. Validation is performed through rigorous manual device testing.

### 🥽 4. Tested Environments & Limits
Instead of claiming universal support, we share our explicit testing scopes:
*   **Verified Environment**: Optimized specifically for **Meta Quest 3** (via standard Quest Browser WebXR immersive mode) and **PC Google Chrome**. Apple Vision Pro or other HMD devices may experience minor controller mapping offsets or styling misalignments.
*   **VRM Avatar Limits**: Designed for standard VRM 0.x and 1.0 specifications. Avatars with exceptionally complex mesh groups or high counts of spring bone colliders may experience performance frame drops on standalone mobile VR chipsets (Quest native runtime).

### 🤝 5. Contributing
We view our raw, unrefined codebase as an exciting "room to grow" for open-source contributors!
*   **PRs are Highly Welcome**: We warmly welcome any pull requests focusing on codebase cleanup, optimizing cross-browser compatibility, expanding WebXR headset bindings, or adding strict error handling. Let's build the future of Alpha together!

---

## 🚀 Deploy & Tech Stack

This project compiles down to completely serverless static files, making it deployable to **Cloudflare Pages**, Vercel, Netlify, or similar platforms in one step.

*   **Core**: Vanilla HTML5, CSS3, ES6 JavaScript
*   **3D Graphics**: Three.js, @pixiv/three-vrm (3D Avatar Engine)
*   **AI Backend**: Google Gemini API (v1beta beta-tts), Ollama (Local LLM Core)
*   **AR/VR**: WebXR Device API (Meta Quest 3 Verified)
