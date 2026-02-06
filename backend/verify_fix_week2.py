
import requests
import json
import time
import random

BASE_URL = "http://localhost:8000"

def random_phone():
    return f"+91{random.randint(6000000000, 9999999999)}"

def register_full_user(label, gender, name=None):
    print(f"[{label}] Registering...")
    phone = random_phone()
    pw = "Password123!"
    
    # 1. Register
    try:
        res = requests.post(f"{BASE_URL}/api/auth/register", json={"phone_number": phone, "password": pw})
        token = res.json().get("access_token")
    except Exception as e:
        print(f"Reg failed: {e}")
        return None, None

    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Onboard (With or Without Name)
    match_photos = ["https://p.com/1"] * 4
    
    if name:
        payload = {
            "first_name": name, # Snake
            "firstName": name,  # Camel
            "gender": gender,
            "birth_date": "1999-01-01",
            "birthday": "1999-01-01", # Camel alias?
            "photos": match_photos,
            "dating_preference": "Everyone",
            "bio": f"I am {name}",
            "work": "Tester",
            "location": "Lab",
            "hometown": "Codebase",
            "profile_completion": 80
        }
    else:
        # Intentionally missing Name
        payload = {
            "gender": gender,
            "birth_date": "1999-01-01",
             "photos": match_photos
        }
        
    res = requests.patch(f"{BASE_URL}/api/users/me", json=payload, headers=headers)
    print(f"[{label}] Onboarded: {res.status_code}")
        
    return token, headers

def run_verification():
    print("--- DEBUG Re-Verifying Week 2 Fix (Attempt 2) ---")

    # Test 2: Happy Path (Valid Names)
    print("\n2. Testing Happy Path (Valid Names)...")
    token_a, headers_a = register_full_user("UserA", "Man", "AliceMan")
    token_b, headers_b = register_full_user("UserB", "Woman", "BobWoman")
    
    # A Enters
    print("A Entering...")
    res = requests.post(f"{BASE_URL}/api/chat-night/enter", headers=headers_a)
    print(f"A Enter Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"FAIL: A could not enter. Body: {res.text}")
        return

    # B Enters
    time.sleep(1)
    print("B Entering...")
    res = requests.post(f"{BASE_URL}/api/chat-night/enter", headers=headers_b)
    data = res.json()
    print(f"B Enter Status: {res.status_code}")
    
    room_id = data.get("room_id")
    if not room_id:
        print("B queued, polling for 10s...")
        for _ in range(5):
            time.sleep(2)
            res = requests.get(f"{BASE_URL}/api/chat-night/my-room", headers=headers_b)
            rdata = res.json()
            if rdata.get("room_id"):
                room_id = rdata["room_id"]
                print(f"Room Found via Polling: {room_id}")
                break
    
    if not room_id:
        print("FAIL: No room assigned even after polling. Match failed.")
        return

    # Engage Both
    print(f"Engaging Room {room_id}...")
    requests.post(f"{BASE_URL}/api/chat-night/engage", json={"room_id": room_id}, headers=headers_a)
    requests.post(f"{BASE_URL}/api/chat-night/engage", json={"room_id": room_id}, headers=headers_b)
    
    # Wait for Match Unlock & Thread Creation
    print("Waiting for thread generation...")
    time.sleep(3)
    
    # Check Threads for A
    print("Checking A's Threads...")
    res = requests.get(f"{BASE_URL}/api/chat/threads", headers=headers_a)
    
    try:
        threads = res.json()
    except:
        print(f"FAIL: Invalid JSON: {res.text}")
        return

    if isinstance(threads, dict): t_list = threads.get("threads")
    else: t_list = threads
    
    if not t_list:
        print("FAIL: No threads found.")
        return
    
    t = t_list[0]
    partner_name = t.get('partner', {}).get('first_name')
    print(f"A's Partner Name: '{partner_name}'")
    
    if partner_name == "BobWoman":
        print("PASS: Partner name correctly resolved.")
    elif partner_name == "Unknown":
        print("FAIL: Partner name is still Unknown!")
    else:
        print(f"WARN: Expected BobWoman, got {partner_name}")

if __name__ == "__main__":
    run_verification()
