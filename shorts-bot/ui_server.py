"""ui_server.py - Lightweight HTTP server for Shorts Bot Dashboard.

Serves the web UI and provides API endpoints for status and job submission.
"""

import json
import os
import shutil
import subprocess
import time
from datetime import datetime
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import threading

# Project paths
PROJECT_DIR = Path(__file__).parent
DATA_DIR = PROJECT_DIR / "data"
UI_DIR = PROJECT_DIR / "ui"

# Ensure data directory exists
DATA_DIR.mkdir(exist_ok=True)

# Default data files
JOBS_FILE = DATA_DIR / "jobs.json"
ACTIVITY_FILE = DATA_DIR / "activity.json"
STATUS_FILE = DATA_DIR / "status.json"


def init_data_files():
    """Create default data files if they don't exist."""
    if not JOBS_FILE.exists():
        with open(JOBS_FILE, 'w') as f:
            json.dump({"jobs": []}, f, indent=2)
    
    if not ACTIVITY_FILE.exists():
        with open(ACTIVITY_FILE, 'w') as f:
            json.dump({"activities": []}, f, indent=2)
    
    if not STATUS_FILE.exists():
        with open(STATUS_FILE, 'w') as f:
            json.dump({
                "bot_status": "offline",
                "ffmpeg_available": False,
                "config_loaded": False,
                "last_updated": datetime.now().isoformat()
            }, f, indent=2)


def load_json(filepath: Path, default=None):
    """Load JSON file or return default if not found."""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default if default is not None else {}


def save_json(filepath: Path, data: dict):
    """Save data to JSON file."""
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)


def add_activity(message: str, activity_type: str = "info"):
    """Add an activity log entry."""
    data = load_json(ACTIVITY_FILE, {"activities": []})
    data["activities"].insert(0, {
        "timestamp": datetime.now().isoformat(),
        "message": message,
        "type": activity_type
    })
    # Keep only last 50 activities
    data["activities"] = data["activities"][:50]
    save_json(ACTIVITY_FILE, data)


def check_ffmpeg() -> bool:
    """Check if FFmpeg is available on PATH."""
    return shutil.which("ffmpeg") is not None


def check_config() -> bool:
    """Check if config.env exists and has required values."""
    env_path = PROJECT_DIR / ".env"
    return env_path.exists()


def get_bot_status() -> str:
    """Check if the Discord bot is running (simplified check)."""
    status_data = load_json(STATUS_FILE, {})
    return status_data.get("bot_status", "offline")


def get_cron_jobs() -> list:
    """Get list of scheduled/cron jobs (placeholder - reads from jobs file)."""
    jobs_data = load_json(JOBS_FILE, {"jobs": []})
    cron_jobs = []
    for job in jobs_data.get("jobs", []):
        if job.get("status") == "scheduled":
            cron_jobs.append({
                "id": job.get("id"),
                "title": job.get("title"),
                "scheduled_for": job.get("scheduled_for"),
                "platforms": job.get("platforms", [])
            })
    return cron_jobs


def generate_job_id() -> str:
    """Generate a unique job ID."""
    return f"job_{int(time.time() * 1000)}_{os.urandom(4).hex()}"


class DashboardHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the dashboard API."""
    
    def log_message(self, format, *args):
        """Custom logging - quieter output."""
        pass  # Suppress default logging
    
    def _send_json(self, data: dict, status: int = 200):
        """Send JSON response."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def _send_cors_headers(self):
        """Send CORS headers for preflight."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
    
    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self._send_cors_headers()
    
    def do_GET(self):
        """Handle GET requests."""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        # Serve the dashboard HTML
        if path == "/" or path == "/index.html":
            self.serve_file(UI_DIR / "index.html", "text/html")
        # Serve static assets
        elif path.endswith(".css"):
            self.serve_file(UI_DIR / path.lstrip("/"), "text/css")
        elif path.endswith(".js"):
            self.serve_file(UI_DIR / path.lstrip("/"), "application/javascript")
        elif path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
        # API endpoints
        elif path == "/api/status":
            self.handle_status()
        elif path == "/api/jobs":
            self.handle_jobs()
        elif path == "/api/activity":
            self.handle_activity()
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        """Handle POST requests."""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        if path == "/api/submit":
            self.handle_submit()
        elif path == "/api/jobs/clear":
            self.handle_clear_jobs()
        else:
            self.send_response(404)
            self.end_headers()
    
    def serve_file(self, filepath: Path, content_type: str):
        """Serve a static file."""
        try:
            with open(filepath, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_response(404)
            self.end_headers()
    
    def handle_status(self):
        """Return system status."""
        jobs_data = load_json(JOBS_FILE, {"jobs": []})
        activity_data = load_json(ACTIVITY_FILE, {"activities": []})
        
        # Count jobs by status
        jobs = jobs_data.get("jobs", [])
        job_counts = {
            "queued": len([j for j in jobs if j.get("status") == "queued"]),
            "processing": len([j for j in jobs if j.get("status") == "processing"]),
            "completed": len([j for j in jobs if j.get("status") == "completed"]),
            "failed": len([j for j in jobs if j.get("status") == "failed"]),
            "total": len(jobs)
        }
        
        status = {
            "bot_status": get_bot_status(),
            "ffmpeg_available": check_ffmpeg(),
            "config_loaded": check_config(),
            "job_counts": job_counts,
            "cron_jobs": get_cron_jobs(),
            "recent_activity": activity_data.get("activities", [])[:10],
            "last_updated": datetime.now().isoformat()
        }
        self._send_json(status)
    
    def handle_jobs(self):
        """Return all jobs."""
        jobs_data = load_json(JOBS_FILE, {"jobs": []})
        self._send_json(jobs_data)
    
    def handle_activity(self):
        """Return recent activity."""
        activity_data = load_json(ACTIVITY_FILE, {"activities": []})
        self._send_json(activity_data)
    
    def handle_submit(self):
        """Handle job submission."""
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            self._send_json({"error": "No data provided"}, 400)
            return
        
        post_data = self.rfile.read(content_length)
        try:
            data = json.loads(post_data.decode())
        except json.JSONDecodeError:
            self._send_json({"error": "Invalid JSON"}, 400)
            return
        
        # Validate required fields
        input_path = data.get("input_path", "").strip()
        title = data.get("title", "").strip()
        
        if not input_path:
            self._send_json({"error": "Input path is required"}, 400)
            return
        if not title:
            self._send_json({"error": "Title is required"}, 400)
            return
        
        # Validate file exists
        if not Path(input_path).exists():
            self._send_json({"error": f"File not found: {input_path}"}, 400)
            return
        
        # Create job
        job_id = generate_job_id()
        job = {
            "id": job_id,
            "input_path": input_path,
            "title": title,
            "description": data.get("description", ""),
            "platforms": data.get("platforms", ["youtube"]),
            "blur_bg": data.get("blur_bg", True),
            "max_duration": data.get("max_duration", 60),
            "skip_approval": data.get("skip_approval", False),
            "status": "queued",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "output_path": None,
            "results": {}
        }
        
        # Save job
        jobs_data = load_json(JOBS_FILE, {"jobs": []})
        jobs_data["jobs"].insert(0, job)
        save_json(JOBS_FILE, jobs_data)
        
        # Log activity
        add_activity(f"New job submitted: '{title}' (ID: {job_id[:8]}...)", "success")
        
        self._send_json({"success": True, "job": job})
    
    def handle_clear_jobs(self):
        """Clear completed/failed jobs."""
        jobs_data = load_json(JOBS_FILE, {"jobs": []})
        # Keep only queued and processing jobs
        active_jobs = [j for j in jobs_data.get("jobs", []) 
                      if j.get("status") in ["queued", "processing"]]
        cleared_count = len(jobs_data.get("jobs", [])) - len(active_jobs)
        jobs_data["jobs"] = active_jobs
        save_json(JOBS_FILE, jobs_data)
        
        add_activity(f"Cleared {cleared_count} completed/failed jobs", "info")
        self._send_json({"success": True, "cleared": cleared_count})


def update_status_file(bot_status: str = "offline"):
    """Update the status file with current system state."""
    status = {
        "bot_status": bot_status,
        "ffmpeg_available": check_ffmpeg(),
        "config_loaded": check_config(),
        "last_updated": datetime.now().isoformat()
    }
    save_json(STATUS_FILE, status)


def run_server(port: int = 8888):
    """Run the HTTP server."""
    init_data_files()
    update_status_file()
    
    server = HTTPServer(("localhost", port), DashboardHandler)
    print(f"[ui_server] Dashboard running at http://localhost:{port}")
    print(f"[ui_server] Data directory: {DATA_DIR}")
    print("[ui_server] Press Ctrl+C to stop")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[ui_server] Shutting down...")
        server.shutdown()


if __name__ == "__main__":
    run_server()
