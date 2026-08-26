import json
import httpx
from typing import List, Dict, Any, Generator
from app.rag.vector_store import VectorStoreManager
from app.config import settings
from llama_index.llms.ollama import Ollama

class QueryEngine:
    def __init__(self, vector_store: VectorStoreManager):
        self.vector_store = vector_store

    def build_context_prompt(self, context_chunks: List[str], question: str) -> str:
        """Constructs a strict prompt with context constraints."""
        context_text = "\n\n---\n\n".join(context_chunks)
        
        system_prompt = (
            "You are JARVIS, an AI Knowledge Assistant.\n\n"
            "Answer the user's question using ONLY the provided context from the knowledge base.\n\n"
            "Rules:\n"
            "1. Do not use outside knowledge.\n"
            "2. Do not invent information.\n"
            "3. If the answer is not available in the context, clearly say:\n"
            "   \"I couldn't find enough information in the provided knowledge base to answer that question.\"\n"
            "4. Give a clear, professional, and concise answer.\n"
            "5. Use the retrieved sources when supporting your answer.\n\n"
            f"Context:\n{context_text}\n\n"
            f"Question: {question}\n"
            "Answer:"
        )
        return system_prompt

    def query(
        self, 
        question: str, 
        top_k: int = 4, 
        similarity_threshold: float = 0.40,
        llm_provider: str = "ollama",
        model_name: str = "qwen2.5:latest",
        temperature: float = 0.1,
        max_tokens: int = 1024,
        api_key: str = ""
    ) -> Dict[str, Any]:
        """
        Executes a non-streaming query.
        Returns the answer and source list.
        """
        # 1. Retrieve matching chunks from vector database
        results = self.vector_store.query(question, top_k=top_k)
        
        # 2. Filter chunks by similarity threshold
        filtered_results = [r for r in results if r["similarity"] >= similarity_threshold]
        
        # Fallback response if no chunks meet criteria
        if not filtered_results:
            return {
                "answer": "I couldn't find enough information in your knowledge base to answer that question.",
                "sources": []
            }
            
        # 3. Build Prompt
        context_texts = [r["text"] for r in filtered_results]
        prompt = self.build_context_prompt(context_texts, question)
        
        # 4. Generate Answer via Selected Provider
        if llm_provider == "gemini":
            answer = self._query_gemini_direct(prompt, model_name, temperature, max_tokens, api_key)
        elif llm_provider == "openai":
            answer = self._query_openai_direct(prompt, model_name, temperature, max_tokens, api_key)
        else:
            try:
                llm = Ollama(
                    model=model_name, 
                    base_url=settings.OLLAMA_HOST, 
                    temperature=temperature,
                    additional_kwargs={"num_predict": max_tokens}
                )
                response = llm.complete(prompt)
                answer = response.text
            except Exception as e:
                # Fallback to direct HTTP endpoint if LlamaIndex client encounters issues
                print(f"LlamaIndex Ollama error: {e}. Falling back to direct REST request.")
                answer = self._query_ollama_direct(prompt, model_name, temperature, max_tokens)
            
        # 5. Extract unique sources for citations
        sources = []
        seen_files = set()
        for r in filtered_results:
            fname = r["metadata"]["filename"]
            if fname not in seen_files:
                sources.append({
                    "file_name": fname,
                    "score": r["similarity"]
                })
                seen_files.add(fname)
                
        return {
            "answer": answer,
            "sources": sources
        }

    def query_stream(
        self, 
        question: str, 
        top_k: int = 4, 
        similarity_threshold: float = 0.40,
        llm_provider: str = "ollama",
        model_name: str = "qwen2.5:latest",
        temperature: float = 0.1,
        max_tokens: int = 1024,
        api_key: str = ""
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Executes a streaming query, yielding tokens as JSON.
        Yields source chunks first, then streams tokens.
        """
        # 1. Retrieve chunks
        results = self.vector_store.query(question, top_k=top_k)
        
        # 2. Filter by threshold
        filtered_results = [r for r in results if r["similarity"] >= similarity_threshold]
        
        # Yield retrieval information first
        sources = []
        seen_files = set()
        for r in filtered_results:
            fname = r["metadata"]["filename"]
            if fname not in seen_files:
                sources.append({
                    "file_name": fname,
                    "score": r["similarity"]
                })
                seen_files.add(fname)
                
        # Send initial metadata header
        yield {
            "type": "metadata",
            "sources": sources
        }
        
        if not filtered_results:
            yield {
                "type": "content",
                "delta": "I couldn't find enough information in your knowledge base to answer that question."
            }
            return
            
        # 3. Build Prompt
        context_texts = [r["text"] for r in filtered_results]
        prompt = self.build_context_prompt(context_texts, question)
        
        # 4. Stream generation from API based on provider
        if llm_provider == "gemini":
            key = api_key or settings.GEMINI_API_KEY
            if not key:
                yield {
                    "type": "content",
                    "delta": "Error: Gemini API Key is missing. Configure it in settings."
                }
                return
            
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:streamGenerateContent?key={key}&alt=sse"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": temperature,
                    "maxOutputTokens": max_tokens
                }
            }
            try:
                with httpx.stream("POST", url, json=payload, timeout=60.0) as response:
                    if response.status_code != 200:
                        yield {
                            "type": "content",
                            "delta": f"Error: Gemini API returned status {response.status_code}."
                        }
                        return
                    for line in response.iter_lines():
                        if line:
                            if line.startswith("data:"):
                                data_str = line[len("data:"):].strip()
                                if not data_str:
                                    continue
                                try:
                                    chunk_data = json.loads(data_str)
                                    if "candidates" in chunk_data and len(chunk_data["candidates"]) > 0:
                                        parts = chunk_data["candidates"][0].get("content", {}).get("parts", [])
                                        if parts and "text" in parts[0]:
                                            yield {
                                                "type": "content",
                                                "delta": parts[0]["text"]
                                            }
                                except Exception:
                                    pass
            except Exception as e:
                yield {
                    "type": "content",
                    "delta": f"\n[Backend Error connecting to Gemini API: {str(e)}]"
                }

        elif llm_provider == "openai":
            key = api_key or settings.OPENAI_API_KEY
            if not key:
                yield {
                    "type": "content",
                    "delta": "Error: OpenAI API Key is missing. Configure it in settings."
                }
                return
            
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": model_name,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": True
            }
            try:
                with httpx.stream("POST", url, headers=headers, json=payload, timeout=60.0) as response:
                    if response.status_code != 200:
                        yield {
                            "type": "content",
                            "delta": f"Error: OpenAI API returned status {response.status_code}."
                        }
                        return
                    for line in response.iter_lines():
                        if line:
                            if line.startswith("data:"):
                                data_str = line[len("data:"):].strip()
                                if data_str == "[DONE]":
                                    continue
                                if not data_str:
                                    continue
                                try:
                                    chunk_data = json.loads(data_str)
                                    if "choices" in chunk_data and len(chunk_data["choices"]) > 0:
                                        delta = chunk_data["choices"][0].get("delta", {})
                                        content = delta.get("content", "")
                                        if content:
                                            yield {
                                                "type": "content",
                                                "delta": content
                                            }
                                except Exception:
                                    pass
            except Exception as e:
                yield {
                    "type": "content",
                    "delta": f"\n[Backend Error connecting to OpenAI API: {str(e)}]"
                }

        else:
            url = f"{settings.OLLAMA_HOST}/api/generate"
            payload = {
                "model": model_name,
                "prompt": prompt,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens
                },
                "stream": True
            }
            try:
                with httpx.stream("POST", url, json=payload, timeout=60.0) as response:
                    if response.status_code != 200:
                        yield {
                            "type": "content",
                            "delta": f"Error: Ollama returned status {response.status_code}."
                        }
                        return
                        
                    for line in response.iter_lines():
                        if line:
                            chunk_data = json.loads(line)
                            delta = chunk_data.get("response", "")
                            if delta:
                                yield {
                                    "type": "content",
                                    "delta": delta
                                }
            except Exception as e:
                yield {
                    "type": "content",
                    "delta": f"\n[Backend Error connecting to Ollama: {str(e)}]"
                }

    def _query_gemini_direct(self, prompt: str, model_name: str, temperature: float, max_tokens: int, api_key: str) -> str:
        """Direct HTTP request to Gemini API."""
        key = api_key or settings.GEMINI_API_KEY
        if not key:
            return "Error: Gemini API Key is missing. Configure it in the Settings panel."
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens
            }
        }
        try:
            response = httpx.post(url, json=payload, timeout=60.0)
            if response.status_code == 200:
                data = response.json()
                if "candidates" in data and len(data["candidates"]) > 0:
                    candidate = data["candidates"][0]
                    if "content" in candidate and "parts" in candidate["content"]:
                        parts = candidate["content"]["parts"]
                        if len(parts) > 0:
                            return parts[0].get("text", "")
                return "Gemini API returned an empty response."
            return f"Gemini HTTP error {response.status_code}: {response.text}"
        except Exception as e:
            return f"Gemini connection failed: {str(e)}"

    def _query_openai_direct(self, prompt: str, model_name: str, temperature: float, max_tokens: int, api_key: str) -> str:
        """Direct HTTP request to OpenAI chat API."""
        key = api_key or settings.OPENAI_API_KEY
        if not key:
            return "Error: OpenAI API Key is missing. Configure it in the Settings panel."
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model_name,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        try:
            response = httpx.post(url, headers=headers, json=payload, timeout=60.0)
            if response.status_code == 200:
                data = response.json()
                if "choices" in data and len(data["choices"]) > 0:
                    return data["choices"][0]["message"].get("content", "")
                return "OpenAI API returned an empty response."
            return f"OpenAI HTTP error {response.status_code}: {response.text}"
        except Exception as e:
            return f"OpenAI connection failed: {str(e)}"

    def _query_ollama_direct(self, prompt: str, model_name: str, temperature: float, max_tokens: int) -> str:
        """Fallback direct HTTP request to Ollama service."""
        url = f"{settings.OLLAMA_HOST}/api/generate"
        payload = {
            "model": model_name,
            "prompt": prompt,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens
            },
            "stream": False
        }
        try:
            response = httpx.post(url, json=payload, timeout=60.0)
            if response.status_code == 200:
                return response.json().get("response", "")
            return f"Ollama HTTP error {response.status_code}."
        except Exception as e:
            return f"Connection failed to Ollama: {str(e)}."
