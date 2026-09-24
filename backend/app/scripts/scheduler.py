"""
Background scheduler untuk auto-submit expired ujian
Run this script as a background process (Windows service / systemd / supervisor)

Usage:
    python -m app.scripts.scheduler

Or run directly:
    python app/scripts/scheduler.py

For Windows (background):
    start /B python app/scripts/scheduler.py

For Linux/Mac (background with nohup):
    nohup python -m app.scripts.scheduler &
"""

import sys
import time
from pathlib import Path
from datetime import datetime

# Add backend root to path
backend_root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(backend_root))

from app.core.timeutils import utc_now
from app.scripts.auto_submit_expired import auto_submit_expired_ujian


# Configuration
CHECK_INTERVAL_SECONDS = 60  # Check every 1 minute
DEBUG_MODE = True  # Set to False in production for less verbose output


def run_scheduler():
    """
    Run auto-submit scheduler in infinite loop
    """
    print(f"Auto-submit scheduler started at {utc_now()}")
    print(f"Check interval: {CHECK_INTERVAL_SECONDS} seconds")
    print(f"Mode: {'DEBUG' if DEBUG_MODE else 'PRODUCTION'}")
    print(f"")
    print(f"Press CTRL+C to stop...")
    print(f"-" * 60)
    
    iteration = 0
    
    try:
        while True:
            iteration += 1
            
            if DEBUG_MODE:
                print(f"\n[{iteration}] Checking at {utc_now()}")
            
            try:
                submitted, errors = auto_submit_expired_ujian()
                
                if submitted > 0 or errors > 0:
                    print(f"[{iteration}] Submitted: {submitted}, Errors: {errors}")
                elif DEBUG_MODE:
                    print(f"[{iteration}] No expired ujian found")
                    
            except Exception as e:
                print(f"[{iteration}] [ERROR] in scheduler loop: {e}")
                
            # Sleep until next check
            time.sleep(CHECK_INTERVAL_SECONDS)
            
    except KeyboardInterrupt:
        print(f"\n\nScheduler stopped by user at {utc_now()}")
        print(f"Total iterations: {iteration}")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n[FATAL] error in scheduler: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run_scheduler()
