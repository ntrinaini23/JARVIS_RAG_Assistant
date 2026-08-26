# JARVIS — Intelligent Knowledge Assistant

> **Tagline:** *Your Documents. Your Knowledge. Your AI.*

JARVIS is a production-quality, full-stack **Retrieval-Augmented Generation (RAG)** application. It allows users to upload local documents (PDF, TXT, DOCX), processes them into a persistent vector space, and chat with a local AI assistant that answers questions **strictly** using facts extracted from the uploaded files.

---

## 🏗️ System Architecture

```text
               [User Uploads Documents (PDF, TXT, DOCX)]
                                  │
                                  ▼
                     [Document Loading & Text Extraction]
                                  │
                                  ▼
                 [Smart Sentence-Aware Chunking (512 char)]
                                  │
                                  ▼
       [Generate Embeddings via sentence-transformers/all-MiniLM-L6-v2]
                                  │
                                  ▼
              [Store Vectors & Metadatas in ChromaDB]
                                  │
                                  ▼
                 [User Asks JARVIS a Question in UI]
                                  │
                                  ▼
         [Perform Semantic Similarity Search on ChromaDB Nodes]
                                  │
                                  ▼
      [Apply Cosine Similarity Cutoff Filter (Default >= 40%)]
                                  │
               ┌──────────────────┴──────────────────┐
               ▼ (Confidence Pass)                   ▼ (Confidence Fail)
    [Inject Context Chunks into Prompt]     [Return Grounded Fallback Response]
               │                             "I couldn't find enough information..."
               ▼
     [Stream response from local Ollama]
```

---

## 🛠️ Technology Stack

### Frontend
- **Framework:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS (Obsidian dark mode primary, sleek glassmorphism panels)
- **3D Graphics:** Three.js + React Three Fiber + React Three Drei
- **Animations:** Framer Motion (page transitions, upload state cues)
- **Charts:** Recharts (query counts, response latencies, reference ratios)

### Backend
- **Inference Engine:** LlamaIndex + Ollama (running local `qwen2.5:latest` or custom models)
- **Vector Database:** ChromaDB (persistent local collections using Cosine Distance)
- **Metadata Database:** SQLite (persistent logs, metrics, activity feeds, and settings)
- **API Framework:** FastAPI + Uvicorn + Pydantic

---

## 🚀 Getting Started

### 📋 Prerequisites
- **Node.js:** v18.0 or newer
- **Python:** 3.10 or newer
- **Ollama:** Download and install from [Ollama.com](https://ollama.com/)

---

### 1. Ollama Local Setup
Verify that Ollama is installed and active on your host system:
```bash
# Verify Ollama is running
ollama --version

# Pull the lightweight, high-performance Qwen model
ollama pull qwen2.5:latest
```

---

### 2. Manual Development Setup

#### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd jarvis-rag-ai/backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   
   # Windows PowerShell
   .venv\Scripts\Activate.ps1
   # Linux/macOS
   source .venv/bin/activate
   ```
3. Install package dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Launch the FastAPI server:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```
   The backend will auto-seed the SQLite database (`data/jarvis.db`) and create storage directories.

#### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd jarvis-rag-ai/frontend
   ```
2. Install npm dependencies (using legacy peer flags for React 19 / R3F constraints):
   ```bash
   npm install --legacy-peer-deps
   ```
3. Launch the Vite development server:
   ```bash
   npm run dev
   ```
4. Access the web interface at `http://localhost:5173`.

---

### 3. Docker Compose Setup (Single Command)
Ensure Ollama is running on your host machine. Run from the root project directory:
```bash
docker-compose up --build
```
- **Frontend URL:** `http://localhost:5173`
- **Backend API Docs:** `http://localhost:8000/docs`

---

## 📡 REST API Documentation

| Route | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | System health check (SQLite, Chroma, Ollama status) |
| `/api/documents/upload` | `POST` | Upload PDF/TXT/DOCX for background chunking & embedding |
| `/api/documents` | `GET` | List all uploaded documents, sizes, and indexing states |
| `/api/documents/{id}` | `DELETE` | Delete a file and purge its vector embeddings from Chroma |
| `/api/chat` | `POST` | Stream answers back using Server-Sent Events (SSE) |
| `/api/stats` | `GET` | Retrieve counts (files, chunks, questions) for counters |
| `/api/activity` | `GET` | Fetch recent pipeline log entries |
| `/api/settings` | `GET` / `PUT` | Retrieve or update RAG pipeline metrics dynamically |
| `/api/knowledge-graph` | `GET` | Export 3D coordinates for chunk scatter plotting |

---

## 🔧 Troubleshooting

- **"Failed to connect to Ollama" / Offline Status:**
  Ensure Ollama is active locally by visiting `http://localhost:11434` in your browser. Verify the model `qwen2.5:latest` (or whichever model you select in settings) is pulled (`ollama pull qwen2.5:latest`).
- **Low-Performance or Jittery Graphics:**
  3D WebGL scenes can be demanding. Navigate to **Settings** or click the **Interactive 3D** toggle on the Knowledge Base page to switch to the animated 2D fallbacks.
- **DOCX / PDF parsing errors:**
  Verify the file is not corrupted, scanned (scanned image PDFs require OCR which is outside the current scope), or password-protected.
