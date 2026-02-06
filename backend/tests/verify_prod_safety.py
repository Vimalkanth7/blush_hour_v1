import requests
import sys

BASE_URL = "http://127.0.0.1:8000"
ADMIN_TOKEN = "mysecret" # Matches running instance

def log(msg, status="INFO"):
    print(f"[{status}] {msg}")

def test_admin_security():
    print("\n--- Testing Admin Security ---")
    
    # 1. Test No Token
    try:
        res = requests.get(f"{BASE_URL}/api/admin/stats")
        if res.status_code == 403: # Or 422 if header missing, but code says 403
            log("PASS: Access without token returned 403/422", "PASS")
        elif res.status_code == 422: # Missing header usually 422 in FastAPI
             log("PASS: Access without token returned 422 (Missing Header)", "PASS")
        else:
            log(f"FAIL: Expected 403/422, got {res.status_code}", "FAIL")
    except Exception as e:
        log(f"FAIL: Request error {e}", "FAIL")

    # 2. Test Invalid Token
    try:
        res = requests.get(f"{BASE_URL}/api/admin/stats", headers={"x-admin-token": "wrong"})
        if res.status_code == 403:
            log("PASS: Access with invalid token returned 403", "PASS")
        else:
            log(f"FAIL: Expected 403, got {res.status_code}", "FAIL")
    except Exception as e:
        log(f"FAIL: Request error {e}", "FAIL")

    # 3. Test Valid Token
    try:
        res = requests.get(f"{BASE_URL}/api/admin/stats", headers={"x-admin-token": ADMIN_TOKEN})
        if res.status_code == 200:
            log("PASS: Access with valid token returned 200", "PASS")
            print(" Stats:", res.json())
        else:
            log(f"FAIL: Expected 200, got {res.status_code}", "FAIL")
            print(res.text)
    except Exception as e:
        log(f"FAIL: Request error {e}", "FAIL")

if __name__ == "__main__":
    test_admin_security()
