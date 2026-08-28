const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Color helpers for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m'
};

function log(service, message, color = colors.reset) {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = `${colors.dim}[${timestamp}]${colors.reset} [${color}${service}${colors.reset}]`;
  console.log(`${prefix} ${message}`);
}

const activeProcesses = [];

// Clean up processes on exit
function cleanup() {
  log('System', 'Cleaning up and shutting down all services...', colors.yellow);
  activeProcesses.forEach(proc => {
    try {
      if (proc && !proc.killed) {
        log('System', `Terminating process PID ${proc.pid}...`, colors.dim);
        if (process.platform === 'win32') {
          // On Windows, taskkill is more reliable for killing child process trees
          execSync(`taskkill /pid ${proc.pid} /f /t`, { stdio: 'ignore' });
        } else {
          proc.kill('SIGTERM');
        }
      }
    } catch (e) {
      // Ignore errors during cleanup
    }
  });
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

// Check if Ollama is running
function checkOllama() {
  return new Promise((resolve) => {
    // Try localhost first
    const req = http.get('http://localhost:11434/api/tags', (res) => {
      res.resume(); // consume response data to free up memory
      resolve(res.statusCode === 200);
    });
    req.on('error', () => {
      // Fallback to 127.0.0.1
      const req2 = http.get('http://127.0.0.1:11434/api/tags', (res2) => {
        res2.resume();
        resolve(res2.statusCode === 200);
      });
      req2.on('error', () => {
        resolve(false);
      });
      req2.setTimeout(1000, () => {
        req2.destroy();
        resolve(false);
      });
      req2.end();
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

// Start Ollama
async function ensureOllama() {
  log('Ollama', 'Checking connection to Ollama (http://localhost:11434)...', colors.magenta);
  const isRunning = await checkOllama();
  
  if (isRunning) {
    log('Ollama', 'Ollama is already running and online.', colors.green);
    return true;
  }
  
  log('Ollama', 'Ollama is offline. Attempting to start Ollama...', colors.yellow);
  try {
    const ollamaProc = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore'
    });
    ollamaProc.unref(); // Allow the parent process to run independently
    
    // Wait and poll a few times
    for (let i = 0; i < 5; i++) {
      log('Ollama', `Waiting for Ollama to start (attempt ${i + 1}/5)...`, colors.dim);
      await new Promise(r => setTimeout(r, 2000));
      if (await checkOllama()) {
        log('Ollama', 'Successfully connected to Ollama.', colors.green);
        return true;
      }
    }
    log('Ollama', 'Failed to start Ollama automatically. Please make sure Ollama is installed and running manually.', colors.red);
    return false;
  } catch (err) {
    log('Ollama', `Error starting Ollama: ${err.message}`, colors.red);
    return false;
  }
}

// Start the Backend (FastAPI + databases)
function startBackend() {
  const backendDir = path.join(__dirname, 'jarvis-rag-ai', 'backend');
  let pythonPath = 'python'; // Fallback
  
  // Look for virtual environment python
  if (process.platform === 'win32') {
    const venvPython = path.join(backendDir, '.venv', 'Scripts', 'python.exe');
    if (fs.existsSync(venvPython)) {
      pythonPath = venvPython;
    }
  } else {
    const venvPython = path.join(backendDir, '.venv', 'bin', 'python');
    if (fs.existsSync(venvPython)) {
      pythonPath = venvPython;
    }
  }
  
  log('Backend', `Starting FastAPI server using Python: ${pythonPath}...`, colors.green);
  
  const backendProcess = spawn(pythonPath, ['-u', '-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: backendDir,
    shell: false
  });
  
  activeProcesses.push(backendProcess);
  
  backendProcess.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) log('Backend', line, colors.green);
    });
  });
  
  backendProcess.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) log('Backend', line, colors.green);
    });
  });
  
  backendProcess.on('close', (code) => {
    log('Backend', `Process exited with code ${code}`, colors.red);
  });
}

// Start the Frontend (Vite)
function startFrontend() {
  const frontendDir = path.join(__dirname, 'jarvis-rag-ai', 'frontend');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  
  log('Frontend', 'Starting React/Vite development server...', colors.cyan);
  
  const frontendProcess = spawn(npmCmd, ['run', 'dev'], {
    cwd: frontendDir,
    shell: true
  });
  
  activeProcesses.push(frontendProcess);
  
  frontendProcess.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) log('Frontend', line, colors.cyan);
    });
  });
  
  frontendProcess.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) log('Frontend', line, colors.cyan);
    });
  });
  
  frontendProcess.on('close', (code) => {
    log('Frontend', `Process exited with code ${code}`, colors.red);
  });
}

// Main execution flow
async function main() {
  console.clear();
  console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}             JARVIS AI - RAG SYSTEM                 ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}\n`);
  
  // 1. Ensure Ollama is running
  await ensureOllama();
  
  // 2. Start Backend (Runs SQLite and ChromaDB automatically)
  startBackend();
  
  // Wait a moment for Backend to initialize and open port 8000
  await new Promise(r => setTimeout(r, 2000));
  
  // 3. Start Frontend (Vite UI)
  startFrontend();
  
  log('System', 'All services have been launched successfully!', colors.bright + colors.green);
  log('System', 'Open your browser at http://localhost:5173 to access JARVIS.', colors.bright + colors.cyan);
  log('System', 'Press Ctrl+C to stop all services simultaneously.', colors.yellow);
}

main().catch(err => {
  log('System', `Fatal error during startup: ${err.message}`, colors.red);
  cleanup();
});
