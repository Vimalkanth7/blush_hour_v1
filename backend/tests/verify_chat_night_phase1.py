
import requests
import time
import sys
import random

API_URL = "http://localhost:8000/api"

def setup_user(role):
    phone = f"+9199{random.randint(100000, 999999)}00"
    print(f"[{role}] Registering {phone}...")
    
    # Register/Login
    auth_data = {"phone_number": phone, "password": "pass"}
    res = requests.post(f"{API_URL}/auth/register", json=auth_data)
    if res.status_code == 400:
        res = requests.post(f"{API_URL}/auth/login", json=auth_data)
    
    if res.status_code != 200:
        print(f"Auth failed: {res.text}")
        return None
        
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Complete Profile (to avoid any side effects, though Chat Night shouldn't care)
    profile_data = {
        "gender": role,
        "firstName": f"Test{role}",
        "birthday": "1995-01-01",
        "photos": ["https://via.placeholder.com/150"] * 4
    }
    requests.patch(f"{API_URL}/users/me", json=profile_data, headers=headers)
    return headers

def verify_chat_night():
    print("--- Verifying Chat Night Phase 1 ---")
    
    # 1. Setup Users
    headers_w = setup_user("Woman")
    headers_m = setup_user("Man")
    
    # 2. Open/Closed State
    print("\n[Check] Chat Night Status...")
    res = requests.get(f"{API_URL}/chat-night/status", headers=headers_w)
    status = res.json()
    print(f"  Is Open: {status['is_open']}")
    if not status['is_open']:
        print("  FAIL: Chat Night is CLOSED. Set CHAT_NIGHT_FORCE_OPEN=true or TEST_MODE=true.")
        sys.exit(1)
    else:
        print("  PASS: Chat Night is OPEN.")

    # 3. Room Entry & Idempotency
    print("\n[Check] Queueing & Matching...")
    requests.post(f"{API_URL}/chat-night/leave", headers=headers_w) # Ensure clean
    requests.post(f"{API_URL}/chat-night/leave", headers=headers_m)
    
    res_w = requests.post(f"{API_URL}/chat-night/enter", headers=headers_w).json()
    print(f"  Woman Enter: {res_w['status']}")
    
    res_m = requests.post(f"{API_URL}/chat-night/enter", headers=headers_m).json()
    print(f"  Man Enter: {res_m['status']}")
    
    if res_m['status'] != 'match_found':
        print("  FAIL: Match not found immediately.")
        sys.exit(1)
        
    room_id = res_m['room_id']
    print(f"  Room ID: {room_id}")
    
    # Check Idempotency (Enter again checking for SAME room)
    print("\n[Check] Idempotency (Prevent Duplicate Rooms)...")
    res_m_2 = requests.post(f"{API_URL}/chat-night/enter", headers=headers_m).json()
    if res_m_2.get('room_id') == room_id:
        print("  PASS: User re-entering returns matched room.")
    else:
        print(f"  FAIL: User re-entering got differing result: {res_m_2}")

    # 4. Timer Progression
    print("\n[Check] Timer Progression (Refresh Stability)...")
    r1 = requests.get(f"{API_URL}/chat-night/room/{room_id}", headers=headers_m).json()
    t1 = r1['seconds_remaining']
    print(f"  Time Remaining T1: {t1}")
    
    time.sleep(3)
    
    r2 = requests.get(f"{API_URL}/chat-night/room/{room_id}", headers=headers_m).json()
    t2 = r2['seconds_remaining']
    print(f"  Time Remaining T2: {t2}")
    
    if t2 < t1 and (t1 - t2) >= 2:
        print("  PASS: Timer is decrementing correctly.")
    else:
        print(f"  FAIL: Timer stuck or reset. T1={t1}, T2={t2}")

    if t2 < 0:
        print(f"  FAIL: Timer is negative: {t2}")
        sys.exit(1)
    else:
        print("  PASS: Timer is non-negative.")

    # 5. Engage Button Flow
    print("\n[Check] Engage Flow...")
    # Woman Engages
    requests.post(f"{API_URL}/chat-night/engage", json={"room_id": room_id}, headers=headers_w)
    
    # Check Man's View (Should indicate partner waiting or UI specific status)
    check_m = requests.get(f"{API_URL}/chat-night/room/{room_id}", headers=headers_m).json()
    print(f"  Man View Engage Status: {check_m['engage_status']}")
    
    # Man Engages
    res_engage = requests.post(f"{API_URL}/chat-night/engage", json={"room_id": room_id}, headers=headers_m).json()
    print(f"  Man Engage Result: {res_engage}")
    
    if res_engage.get('room_state') == 'engaged':
        print("  PASS: Room transitioned to ENGAGED.")
    else:
         print(f"  FAIL: Room state expected 'engaged', got '{res_engage.get('room_state')}'")

if __name__ == "__main__":
    verify_chat_night()
