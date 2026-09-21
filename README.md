<<<<<<< HEAD
# JARVIS — Intelligent Knowledge Assistant

> **Tagline:** *Your Documents. Your Knowledge. Your AI.*

JARVIS is a production-quality, full-stack **Retrieval-Augmented Generation (RAG)** application. It ingests knowledge from documents, websites, or raw database records, processes it into a persistent vector space, and lets you chat with a local AI assistant that answers questions **strictly** using facts extracted from that knowledge base.

---

## ✨ Features

- **Multi-source ingestion** — build your knowledge base from:
  - **File upload:** PDF, TXT, and DOCX documents
  - **Website crawler:** paste a URL and JARVIS fetches, strips HTML, and indexes the page text
  - **Database / table records:** paste raw exported text (e.g. a CSV/SQL dump) and give it a database + table name to ingest as a document
- **Background indexing pipeline** with live per-document status (`Uploaded → Processing → Indexed / Failed`), plus a one-click **reprocess** action for anything that failed or is stuck as "Uploaded"
- **Grounded chat** — every answer is generated only from retrieved context; if nothing meets the similarity bar, JARVIS says so instead of guessing
- **Streamed responses** over Server-Sent Events (SSE) for a real-time typing effect, with source citations returned alongside the answer
- **Multi-provider inference** — switch between local **Ollama**, **Google Gemini**, or **OpenAI** models from the Settings page, no restart required
- **3D knowledge base visualization** (JarvisOrb, KnowledgeParticles, VectorGraph) built with Three.js / React Three Fiber, with a 2D fallback for lower-end hardware
- **Analytics dashboard** — live counters, query/latency charts (Recharts), and an activity feed of pipeline events
- **Configurable RAG settings** — chunk size, chunk overlap, top-K, and similarity threshold are all runtime settings

---

## 🏗️ System Architecture

```text
               [Knowledge Sources: File Upload (PDF/TXT/DOCX) | Website URL | DB/Table Text]
                                  │
                                  ▼
                     [Document Loading & Text Extraction]
                                  │
                                  ▼
                 [Smart Sentence-Aware Chunking (512 char, 64-char overlap)]
                                  │
                                  ▼
       [Generate Embeddings via sentence-transformers/all-MiniLM-L6-v2]
                                  │
                                  ▼
              [Store Vectors & Metadata in ChromaDB (cosine distance)]
                                  │
                                  ▼
                 [User Asks JARVIS a Question in UI]
                                  │
                                  ▼
         [Perform Semantic Similarity Search on ChromaDB Nodes (top-K)]
                                  │
                                  ▼
      [Apply Cosine Similarity Cutoff Filter (Default >= 40%)]
                                  │
               ┌──────────────────┴──────────────────┐
               ▼ (Confidence Pass)                   ▼ (Confidence Fail)
    [Inject Context Chunks into Prompt]     [Return Grounded Fallback Response]
               │                             "I couldn't find enough information..."
               ▼
     [Stream response via LlamaIndex → Ollama, or Gemini / OpenAI REST API]
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
- **Inference Orchestration:** LlamaIndex (`llama-index-llms-ollama`) driving local Ollama models (`qwen2.5:latest` or custom), with optional direct REST integrations for **Google Gemini** and **OpenAI**
- **Vector Database:** ChromaDB (persistent local collections using Cosine Distance)
- **Metadata Database:** SQLite (persistent logs, metrics, activity feeds, and settings)
- **API Framework:** FastAPI + Uvicorn + Pydantic

---

## 🚀 Getting Started

### 📋 Prerequisites
- **Node.js:** v18.0 or newer
- **Python:** 3.10 or newer
- **Ollama:** Download and install from [Ollama.com](https://ollama.com/) — required for the default local provider; optional if you plan to run exclusively on Gemini/OpenAI

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

### 3. One-Command Setup (Root Orchestrator)
From the project root, this starts backend and frontend together via `start-project.js`:
```bash
npm install
npm start
```
(Windows users can alternatively double-click `start.bat`.)

---

### 4. Docker Compose Setup (Single Command)
Ensure Ollama is running on your host machine. Run from the root project directory:
```bash
docker-compose up --build
```
- **Frontend URL:** `http://localhost:5173`
- **Backend API Docs:** `http://localhost:8000/docs`

---

### 5. Using Gemini or OpenAI Instead of / Alongside Ollama
Open **Settings** in the app and switch the **LLM Provider** dropdown to `Google Gemini API` or `OpenAI Chat API`, then paste your API key. Keys can also be pre-set via environment variables before starting the backend:
```bash
export GEMINI_API_KEY="your-key-here"
export OPENAI_API_KEY="your-key-here"
```

---

## 📡 REST API Documentation

| Route | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | System health check (SQLite, Chroma, Ollama status) |
| `/api/documents/upload` | `POST` | Upload PDF/TXT/DOCX for background chunking & embedding |
| `/api/documents/url` | `POST` | Crawl a website URL, strip HTML, and queue the text for indexing |
| `/api/documents/database` | `POST` | Ingest raw pasted database/table text as a new document |
| `/api/documents` | `GET` | List all uploaded documents, sizes, and indexing states |
| `/api/documents/{id}` | `DELETE` | Delete a file and purge its vector embeddings from Chroma |
| `/api/documents/process` | `POST` | Re-queue all `Failed` or `Uploaded` documents for indexing |
| `/api/chat` | `POST` | Stream answers back using Server-Sent Events (SSE) |
| `/api/stats` | `GET` | Retrieve counts (files, chunks, questions) for counters |
| `/api/activity` | `GET` | Fetch recent pipeline log entries |
| `/api/settings` | `GET` / `PUT` | Retrieve or update RAG pipeline settings dynamically |
| `/api/knowledge-graph` | `GET` | Export 3D coordinates for chunk scatter plotting |

---

## 🔧 Troubleshooting

- **"Failed to connect to Ollama" / Offline Status:**
  Ensure Ollama is active locally by visiting `http://localhost:11434` in your browser. Verify the model `qwen2.5:latest` (or whichever model you select in settings) is pulled (`ollama pull qwen2.5:latest`).
- **Gemini / OpenAI errors in chat:**
  Confirm the API key is saved in **Settings** (or set as an environment variable) and that the selected model name is valid for your account/tier.
- **Low-Performance or Jittery Graphics:**
  3D WebGL scenes can be demanding. Navigate to **Settings** or click the **Interactive 3D** toggle on the Knowledge Base page to switch to the animated 2D fallbacks.
- **DOCX / PDF parsing errors:**
  Verify the file is not corrupted, scanned (scanned image PDFs require OCR which is outside the current scope), or password-protected.
- **Website ingestion returns no text:**
  Some sites render content client-side via JavaScript; the crawler only reads server-rendered HTML, so heavily JS-driven pages may yield little or no extractable text.
=======
# Jarvis-RAG
Team Members :
Nalle Trinaini Vijaya Leela (lead),
Pechetti Lakshman Kumar,
Gutta Thanvi,
Talakonda Bindusri,
Komatla Ajitha Reddy
>>>>>>> fda71457946ebbc06172c67267f0d5c86c1cf057
