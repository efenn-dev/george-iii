"""
01_auto_record.py â€” Automated Dual-Device Recording Controller
==============================================================
Monitors for Minecraft process launch/exit and controls OBS
recording via WebSocket. Supports primary PC and a child's
device over LAN.

Usage:
    python 01_auto_record.py
    python 01_auto_record.py --config C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/config/pipeline_config.yaml
"""

import obsws_python as obs
import psutil
import time
import yaml
import logging
import argparse
import ntplib
from datetime import datetime, timezone

# -----------------------------------------------------------------------------
# Logging Setup
# -----------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/logs/auto_record.log"),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
def load_config(path: str = "C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/config/pipeline_config.yaml") -> dict:
    """Load pipeline configuration from YAML file."""
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

# -----------------------------------------------------------------------------
# NTP Timestamp
# -----------------------------------------------------------------------------
def get_ntp_timestamp() -> str:
    """
    Fetch current time from NTP server for cross-device sync.
    Falls back to local system time if NTP is unreachable.
    """
    try:
        client = ntplib.NTPClient()
        response = client.request("pool.ntp.org", version=3)
        ntp_time = datetime.fromtimestamp(response.tx_time, tz=timezone.utc)
        return ntp_time.strftime("%Y%m%d_%H%M%S_%f")
    except Exception as e:
        log.warning(f"NTP unavailable ({e}), using local time")
        return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")

# -----------------------------------------------------------------------------
# Process Detection
# -----------------------------------------------------------------------------
def is_minecraft_running(process_names: list[str]) -> bool:
    """Check if any Minecraft process is currently running."""
    for proc in psutil.process_iter(["name"]):
        try:
            if proc.info["name"] in process_names:
                return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return False

# -----------------------------------------------------------------------------
# OBS Connection Manager
# -----------------------------------------------------------------------------
class OBSRecorder:
    """Manages OBS WebSocket connection and recording control."""

    def __init__(self, host: str, port: int, password: str, name: str = "primary"):
        self.host = host
        self.port = port
        self.password = password
        self.name = name
        self.client = None
        self.is_recording = False

    def connect(self) -> bool:
        """Establish WebSocket connection to OBS."""
        try:
            self.client = obs.ReqClient(
                host=self.host,
                port=self.port,
                password=self.password,
                timeout=10
            )
            version = self.client.get_version()
            log.info(
                f"[{self.name}] Connected to OBS "
                f"v{version.obs_version} "
                f"(WebSocket v{version.obs_web_socket_version})"
            )
            return True
        except Exception as e:
            log.error(f"[{self.name}] OBS connection failed: {e}")
            return False

    def start_recording(self) -> bool:
        """Start OBS recording with NTP-stamped filename."""
        if not self.client or self.is_recording:
            return False
        try:
            timestamp = get_ntp_timestamp()
            self.client.set_profile_parameter(
                "Output", "FilenameFormatting",
                f"minecraft_{self.name}_{timestamp}"
            )
            self.client.start_record()
            self.is_recording = True
            log.info(f"[{self.name}] Recording STARTED â€” {timestamp}")
            return True
        except Exception as e:
            log.error(f"[{self.name}] Failed to start recording: {e}")
            return False

    def stop_recording(self) -> str:
        """Stop OBS recording. Returns output file path."""
        if not self.client or not self.is_recording:
            return ""
        try:
            result = self.client.stop_record()
            self.is_recording = False
            output_path = result.output_path
            log.info(f"[{self.name}] Recording STOPPED â€” {output_path}")
            return output_path
        except Exception as e:
            log.error(f"[{self.name}] Failed to stop recording: {e}")
            self.is_recording = False
            return ""

    def disconnect(self):
        """Clean up WebSocket connection."""
        if self.client:
            del self.client
            self.client = None
            log.info(f"[{self.name}] Disconnected from OBS")

# -----------------------------------------------------------------------------
# Main Loop
# -----------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Auto-record Minecraft gameplay")
    parser.add_argument("--config", default="C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/config/pipeline_config.yaml",
                        help="Path to pipeline config YAML")
    args = parser.parse_args()

    config = load_config(args.config)
    poll_interval = config["game_detection"]["poll_interval_sec"]
    process_names = config["game_detection"]["process_names"]

    primary = OBSRecorder(
        host=config["obs_primary"]["host"],
        port=config["obs_primary"]["port"],
        password=config["obs_primary"]["password"],
        name="pc"
    )

    child = None
    if config["obs_child"].get("enabled", False):
        child = OBSRecorder(
            host=config["obs_child"]["host"],
            port=config["obs_child"]["port"],
            password=config["obs_child"]["password"],
            name="device"
        )

    if not primary.connect():
        log.critical("Cannot connect to primary OBS. Exiting.")
        return

    if child and not child.connect():
        log.warning("Child OBS unavailable â€” recording primary only.")
        child = None

    log.info("Monitoring for Minecraft process launch...")
    game_was_running = False

    try:
        while True:
            game_is_running = is_minecraft_running(process_names)

            if game_is_running and not game_was_running:
                log.info("Minecraft DETECTED â€” initiating recording")
                primary.start_recording()
                if child:
                    child.start_recording()

            elif not game_is_running and game_was_running:
                log.info("Minecraft CLOSED â€” stopping recording")
                primary.stop_recording()
                if child:
                    child.stop_recording()

            game_was_running = game_is_running
            time.sleep(poll_interval)

    except KeyboardInterrupt:
        log.info("Interrupted by user â€” cleaning up")
        if primary.is_recording:
            primary.stop_recording()
        if child and child.is_recording:
            child.stop_recording()
    finally:
        primary.disconnect()
        if child:
            child.disconnect()

if __name__ == "__main__":
    main()




