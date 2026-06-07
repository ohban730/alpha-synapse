import os
import sys

# Add CUDA library directories to Windows DLL search path and system PATH
cuda_dirs = [
    r"C:\Users\owner\miniconda3\envs\alpha-brain\Lib\site-packages\nvidia\cublas\bin",
    r"C:\Users\owner\miniconda3\envs\alpha-brain\Lib\site-packages\nvidia\cudnn\bin",
    r"C:\Users\owner\miniconda3\envs\alpha-brain\Lib\site-packages\nvidia\cuda_nvrtc\bin",
    r"C:\Users\owner\miniconda3\envs\alpha-brain\Lib\site-packages\nvidia\cuda_runtime\bin"
]
for d in cuda_dirs:
    if os.path.exists(d):
        os.add_dll_directory(d)
        os.environ["PATH"] = d + ";" + os.environ["PATH"]

import httpx
from fastapi import FastAPI, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import json
import static_ffmpeg
from faster_whisper import WhisperModel

# Initialize static ffmpeg binaries dynamically for the current process
static_ffmpeg.add_paths()

app = FastAPI(title="Alpha Synapse Local AI Backend")

# Global reference for local STT model
stt_model = None

def get_stt_model():
    global stt_model
    if stt_model is None:
        try:
            print("Lazy initializing WhisperModel on CUDA...")
            # large-v3-turbo is extremely fast and accurate.
            stt_model = WhisperModel("large-v3-turbo", device="cuda", compute_type="float16")
            print("WhisperModel initialized on CUDA successfully.")
        except Exception as cuda_err:
            print(f"Failed to initialize WhisperModel on CUDA: {cuda_err}. Falling back to CPU.")
            try:
                stt_model = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8")
                print("WhisperModel initialized on CPU successfully.")
            except Exception as cpu_err:
                print(f"Failed to initialize WhisperModel on CPU: {cpu_err}")
    return stt_model



# Allow CORS so that the front-end running on standard dev ports can communicate seamlessly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = "http://127.0.0.1:11434"
TTS_URL = "http://127.0.0.1:5000/voice"

STYLE_MAP = {
    "happy": "Happy",
    "angry": "Angry",
    "sad": "Sad",
    "relaxed": "Neutral",
    "surprised": "Surprise"
}

@app.post("/api/chat")
async def chat(request: Request):
    data = await request.json()
    model = data.get("model", "gemma2:9b")
    messages = data.get("messages", [])
    
    ollama_payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "options": {
            "num_predict": 250,
            "temperature": 0.7
        }
    }
    
    async def event_generator():
        import re
        import base64
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                async with client.stream(
                    "POST", 
                    f"{OLLAMA_URL}/api/chat", 
                    json=ollama_payload
                ) as response:
                    last_sentence = ""
                    MIN_CHAR_LENGTH = 30
                    buffer = ""
                    
                    async def synthesize_sentence(text_to_synthesize):
                        nonlocal last_sentence
                        # Extract emotion tag
                        emotion = "relaxed"
                        tag_match = re.search(r'\[(happy|angry|sad|relaxed|surprised)\]', text_to_synthesize, re.IGNORECASE)
                        if tag_match:
                            emotion = tag_match.group(1).lower()
                        
                        # Strip tags and markdown for clean Speech Synthesis reading
                        clean_text = text_to_synthesize
                        clean_text = re.sub(r'\[(happy|angry|sad|relaxed|surprised)\]', '', clean_text, flags=re.IGNORECASE)
                        clean_text = re.sub(r'[*_`~#「」『』【】]', ' ', clean_text).strip()
                        
                        if not clean_text:
                            return None
                        
                        style = STYLE_MAP.get(emotion, "Neutral")
                        
                        try:
                            # Direct query to Style-Bert-VITS2 API server
                            async with httpx.AsyncClient(timeout=10.0) as tts_client:
                                params = {
                                    "text": clean_text,
                                    "encoding": "utf-8",
                                    "model_name": "jvnv-F1-jp",
                                    "style": style,
                                    "style_weight": 1.2,
                                    "length": 1.0
                                }
                                if last_sentence:
                                    params["assist_text"] = last_sentence
                                    params["assist_text_weight"] = 1.0
                                    
                                tts_response = await tts_client.post(TTS_URL, params=params)
                                if tts_response.status_code == 200:
                                    last_sentence = clean_text
                                    audio_b64 = base64.b64encode(tts_response.content).decode("utf-8")
                                    return {
                                        "type": "audio",
                                        "audio": audio_b64,
                                        "text": clean_text,
                                        "expression": emotion
                                    }
                                else:
                                    print(f"TTS API Error: Status {tts_response.status_code}, Detail: {tts_response.text}")
                        except Exception as e:
                            print(f"TTS Synthesis Failed: {e}")
                        return None

                    async for line in response.aiter_lines():
                        if line:
                            try:
                                chunk = json.loads(line)
                                content = chunk.get("message", {}).get("content", "")
                                done = chunk.get("done", False)
                                
                                if content:
                                    # Output token immediately for real-time typewriter HUD display
                                    yield f"data: {json.dumps({'type': 'text', 'content': content}, ensure_ascii=False)}\n\n"
                                    buffer += content
                                    
                                    # Sentence splitting logic
                                    while True:
                                        match = re.search(r'[。！？!?\n]', buffer)
                                        if not match:
                                            break
                                        
                                        end_pos = match.end()
                                        sentence_candidate = buffer[:end_pos]
                                        
                                        # Force split if length is sufficient or if it contains a newline
                                        if len(sentence_candidate) >= MIN_CHAR_LENGTH or '\n' in sentence_candidate:
                                            tail = buffer[end_pos:]
                                            # Handle emotion tag trailing behind the punctuation mark
                                            tag_match = re.match(r'^\s*\[([a-zA-Z]+)\]', tail)
                                            if tag_match:
                                                end_pos += tag_match.end()
                                                sentence = buffer[:end_pos]
                                                buffer = buffer[end_pos:]
                                            elif '[' in tail and ']' not in tail:
                                                # Tag started receiving but is cut off, wait for the next token
                                                break
                                            else:
                                                sentence = sentence_candidate
                                                buffer = buffer[end_pos:]
                                            
                                            audio_data = await synthesize_sentence(sentence)
                                            if audio_data:
                                                yield f"data: {json.dumps(audio_data, ensure_ascii=False)}\n\n"
                                        else:
                                            # Keep buffering since candidate length is too short
                                            break
                                
                            except json.JSONDecodeError:
                                continue
                                
                    # Synthesize any remaining text left in the buffer
                    if buffer.strip():
                        audio_data = await synthesize_sentence(buffer)
                        if audio_data:
                            yield f"data: {json.dumps(audio_data, ensure_ascii=False)}\n\n"
                    
                    # Yield done marker
                    yield f"data: {json.dumps({'type': 'done', 'done': True}, ensure_ascii=False)}\n\n"
                                    
            except httpx.ConnectError:
                error_msg = "[sad]マスター、ローカルのOllamaが起動していないみたい。Ollamaアプリを立ち上げてからもう一度話しかけてね。"
                yield f"data: {json.dumps({'type': 'text', 'content': error_msg}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'done': True}, ensure_ascii=False)}\n\n"
            except Exception as e:
                print(f"Error in stream generator: {e}")
                error_msg = f"[sad]マスター、ローカルAIサーバー内部でエラーが発生したみたい。原因: {str(e)}"
                yield f"data: {json.dumps({'type': 'text', 'content': error_msg}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'done': True}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/tts")
async def tts(request: Request):
    data = await request.json()
    text = data.get("text", "")
    emotion = data.get("emotion", "relaxed")
    
    import re
    import base64
    
    clean_text = re.sub(r'\[(happy|angry|sad|relaxed|surprised)\]', '', text, flags=re.IGNORECASE)
    clean_text = re.sub(r'[*_`~#「」『』【】]', ' ', clean_text).strip()
    
    if not clean_text:
        return {"error": "Empty text"}
        
    style = STYLE_MAP.get(emotion.lower(), "Neutral")
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as tts_client:
            params = {
                "text": clean_text,
                "encoding": "utf-8",
                "model_name": "jvnv-F1-jp",
                "style": style,
                "style_weight": 1.2,
                "length": 1.0
            }
            tts_response = await tts_client.post(TTS_URL, params=params)
            if tts_response.status_code == 200:
                audio_b64 = base64.b64encode(tts_response.content).decode("utf-8")
                return {
                    "audio": audio_b64,
                    "text": clean_text,
                    "expression": emotion
                }
            else:
                print(f"TTS API Error: Status {tts_response.status_code}, Detail: {tts_response.text}")
                return {"error": f"TTS API Error: Status {tts_response.status_code}, Detail: {tts_response.text}"}
    except Exception as e:
        return {"error": f"TTS Synthesis Failed: {str(e)}"}

@app.post("/api/stt")
async def stt(file: UploadFile = File(...)):
    model = get_stt_model()
    if model is None:
        return {"error": "STT model could not be initialized."}

    import tempfile
    import os
    import subprocess
    
    temp_path = None
    wav_path = None
    try:
        # Write uploaded file to a temporary file
        audio_bytes = await file.read()
        print(f"Received audio upload. Size: {len(audio_bytes)} bytes")
        if len(audio_bytes) == 0:
            return {"error": "Empty audio file received."}

        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_audio:
            temp_audio.write(audio_bytes)
            temp_path = temp_audio.name
            
        # Convert webm to standard WAV (16kHz, mono, PCM 16-bit)
        wav_path = temp_path + ".wav"
        cmd = [
            "ffmpeg", "-y",
            "-i", temp_path,
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            wav_path
        ]
        
        print(f"Converting {temp_path} to WAV: {wav_path}")
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode != 0:
            stderr_msg = result.stderr.decode('utf-8', errors='ignore')
            print(f"FFmpeg conversion failed: {stderr_msg}")
            raise Exception(f"Audio conversion failed: {stderr_msg}")
            
        if not os.path.exists(wav_path) or os.path.getsize(wav_path) == 0:
            raise Exception("Converted WAV file is empty or missing.")
            
        # Transcribe the converted WAV audio
        try:
            segments, info = model.transcribe(wav_path, beam_size=5, language="ja")
            transcription = "".join([segment.text for segment in segments])
        except Exception as trans_err:
            if model and getattr(model, "device", None) == "cuda":
                print(f"CUDA transcription failed: {trans_err}. Re-initializing on CPU and retrying...")
                try:
                    import gc
                    del model
                    gc.collect()
                except Exception:
                    pass
                global stt_model
                stt_model = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8")
                model = stt_model
                segments, info = model.transcribe(wav_path, beam_size=5, language="ja")
                transcription = "".join([segment.text for segment in segments])
            else:
                raise trans_err
        
        return {"text": transcription.strip()}
    except Exception as e:
        print(f"Error during STT transcription: {e}")
        return {"error": f"STT failed: {str(e)}"}
    finally:
        # Clean up temporary files
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as e:
                print(f"Failed to remove temp file: {e}")
        if wav_path and os.path.exists(wav_path):
            try:
                os.remove(wav_path)
            except Exception as e:
                print(f"Failed to remove wav file: {e}")

if __name__ == "__main__":
    import uvicorn
    # Bound to localhost:8000
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)

