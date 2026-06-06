import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import json

app = FastAPI(title="Alpha Synapse Local AI Backend")

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

if __name__ == "__main__":
    import uvicorn
    # Bound to localhost:8000
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
