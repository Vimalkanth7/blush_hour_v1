import requests
import json
import sys
import os

BASE_URL = "http://127.0.0.1:8000"

def log(msg, status="INFO"):
    print(f"[{status}] {msg}")

def test_admin_security():
    log("Verifying Admin Security...")
    
    # 1. Try accessing admin endpoint WITHOUT header
    try:
        # Assuming there is a GET /api/admin/health or similar, or just try listing users if that exists
        # Since I don't know exact admin endpoints, I'll try a common pattern or check the file content first?
        # Wait, the user said "admin endpoints locked down". I should view admin.py content to know what to call.
        # But broadly, /api/admin/... should 403.
        
        # Let's try /api/admin/metrics or list-users if they exist. 
        # I'll rely on the fact that any /api/admin path should be protected.
        # Let's try root admin if it has one, or a known subpath.
        # I will start by just trying /api/admin/users which is a common admin pattern.
        # If it returns 404, it means route doesn't exist, which is also "safe" but not what we want to test.
        # I need to see admin.py content to know a valid route. 
        # I will read admin.py in the main loop before running this script if I can't guess.
        # Check: `view_file` on `backend/app/routers/admin.py` is better.
        pass
    except Exception as e:
        log(f"Error: {e}", "FAIL")

# I'll pause this write to check admin.py content first to be precise.
