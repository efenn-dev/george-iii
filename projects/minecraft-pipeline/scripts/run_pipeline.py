"""
run_pipeline.py â€” Pipeline Orchestrator
========================================
Chains all 8 stages with error handling, logging, timing,
and CLI control. The single entry point for the entire
Minecraft-to-YouTube automation workflow.

Usage:
    python run_pipeline.py --full
    python run_pipeline.py --stage 3
    python run_pipeline.py --stage 4-8
    python run_pipeline.py --full --dry-run
    python run_pipeline.py --full --child-safe
"""

import sys
import time
import yaml
import logging
import argparse
import importlib
import traceback
from pathlib import Path
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/logs/pipeline.log"),
        logging.StreamHandler()
    ]
)
log = logging.getLogger("pipeline")

STAGES = {
    1: {"module": "01_auto_record",       "name": "Auto-Record",
        "skip_in_batch": True},
    2: {"module": "02_collect_sync",       "name": "Collect & Sync"},
    3: {"module": "03_highlight_detect",   "name": "Highlight Detection"},
    4: {"module": "04_assemble_brand",     "name": "Assembly & Branding"},
    5: {"module": "05_caption",            "name": "Captioning"},
    6: {"module": "06_thumbnail",          "name": "Thumbnail Generation"},
    7: {"module": "07_metadata",           "name": "Metadata Drafting"},
    8: {"module": "08_upload",             "name": "YouTube Upload"},
}

def load_config(path: str = "C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/config/pipeline_config.yaml") -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def run_stage(stage_num: int, dry_run: bool = False, extra_args: list[str] = None) -> bool:
    """Execute a single pipeline stage. Returns True on success."""
    stage = STAGES.get(stage_num)
    if not stage:
        log.error(f"Invalid stage number: {stage_num}")
        return False

    name = stage["name"]
    module_name = stage["module"]

    log.info(f"{'='*60}")
    log.info(f"STAGE {stage_num}: {name}")
    log.info(f"{'='*60}")

    if dry_run:
        log.info(f"  [DRY RUN] Would execute {module_name}.py")
        return True

    start_time = time.time()

    try:
        sys.path.insert(0, str(Path(__file__).parent))
        # Clear sys.argv so stage scripts don't see orchestrator args
        original_argv = sys.argv
        # Pass extra args to the stage script
        stage_argv = [module_name + ".py"] + (extra_args or [])
        sys.argv = stage_argv
        module = importlib.import_module(module_name.replace("-", "_"))
        module.main()
        sys.argv = original_argv

        elapsed = time.time() - start_time
        log.info(f"Stage {stage_num} completed in {elapsed:.1f}s")
        return True

    except Exception as e:
        elapsed = time.time() - start_time
        log.error(f"Stage {stage_num} FAILED after {elapsed:.1f}s: {e}")
        log.error(traceback.format_exc())
        return False

def parse_stage_range(stage_arg: str) -> list[int]:
    """Parse stage argument: '3' â†’ [3], '4-8' â†’ [4,5,6,7,8]."""
    if "-" in stage_arg:
        start, end = stage_arg.split("-")
        return list(range(int(start), int(end) + 1))
    return [int(stage_arg)]

def send_notification(title: str, message: str, config: dict):
    """Send completion notification (Windows toast or email)."""
    notif_cfg = config.get("notifications", {})
    if not notif_cfg.get("enabled", False):
        return

    method = notif_cfg.get("method", "toast")
    if method == "toast":
        try:
            from win10toast import ToastNotifier
            toast = ToastNotifier()
            toast.show_toast(title, message, duration=10)
        except ImportError:
            log.warning("win10toast not installed â€” skipping notification")

def main():
    parser = argparse.ArgumentParser(
        description="Minecraft â†’ YouTube Pipeline Orchestrator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_pipeline.py --full              Run stages 2-8
  python run_pipeline.py --stage 3           Run highlight detection only
  python run_pipeline.py --stage 4-8         Run assembly through upload
  python run_pipeline.py --full --dry-run    Preview without processing
  python run_pipeline.py --full --child-safe Enable child safety filters
        """
    )
    parser.add_argument("--full", action="store_true",
                        help="Run full pipeline (stages 2-8)")
    parser.add_argument("--stage", type=str,
                        help="Run specific stage(s): '3' or '4-8'")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview pipeline without executing")
    parser.add_argument("--child-safe", action="store_true",
                        help="Enable all child safety filters")
    parser.add_argument("--config", default="C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/config/pipeline_config.yaml",
                        help="Path to configuration YAML")
    parser.add_argument("--skip-visual", action="store_true",
                        help="Skip visual scene detection in stage 3 (use audio only)")
    args = parser.parse_args()

    if not args.full and not args.stage:
        parser.print_help()
        return

    config = load_config(args.config)

    if args.child_safe:
        config["child_safety"]["webcam_capture"] = False
        config["child_safety"]["voice_recording"] = False
        config["child_safety"]["require_parent_review"] = True
        config["child_safety"]["content_filter"] = True
        config["youtube"]["default_privacy"] = "unlisted"
        config["youtube"]["made_for_kids"] = True
        log.info("Child safety mode ENABLED â€” all safeguards active")

    if args.full:
        stages_to_run = [s for s in range(2, 9)]
    else:
        stages_to_run = parse_stage_range(args.stage)

    log.info(f"Pipeline started at {datetime.now().isoformat()}")
    log.info(f"Stages to run: {stages_to_run}")
    log.info(f"Dry run: {args.dry_run}")

    pipeline_start = time.time()
    results = {}

    for stage_num in stages_to_run:
        # Pass --skip-visual to stage 3 if requested
        extra_args = []
        if stage_num == 3 and args.skip_visual:
            extra_args = ["--skip-visual"]
        success = run_stage(stage_num, dry_run=args.dry_run, extra_args=extra_args)
        results[stage_num] = success

        if not success and not args.dry_run:
            log.error(f"Pipeline halted at stage {stage_num}")
            break

    total_time = time.time() - pipeline_start
    log.info(f"\n{'='*60}")
    log.info("PIPELINE SUMMARY")
    log.info(f"{'='*60}")
    for stage_num, success in results.items():
        status = "PASS" if success else "FAIL"
        name = STAGES[stage_num]["name"]
        log.info(f"  Stage {stage_num} ({name}): {status}")
    log.info(f"Total time: {total_time:.1f}s ({total_time/60:.1f} min)")

    all_passed = all(results.values())
    if all_passed:
        send_notification(
            "Pipeline Complete",
            f"All {len(results)} stages completed in "
            f"{total_time/60:.1f} min",
            config
        )
    else:
        send_notification(
            "Pipeline Failed",
            "Pipeline stopped â€” check logs for details",
            config
        )

if __name__ == "__main__":
    main()





