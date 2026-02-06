
import requests
import time
import sys
import random
import os

API_URL = "http://localhost:8000/api"

def register_and_setup(role_gender):
    rand_suffix = random.randint(100000, 999999)
    phone = f"+9199{rand_suffix}00"
    password = "secretpassword"
    
    print(f"[{role_gender[:1]}] Registering {phone}...")
    reg_data = {"phone_number": phone, "password": password}
    try:
        res = requests.post(f"{API_URL}/auth/register", json=reg_data)
        if res.status_code == 400 and "already registered" in res.text:
             res = requests.post(f"{API_URL}/auth/login", json=reg_data)
             
        if res.status_code != 200:
            print(f"Auth failed: {res.text}")
            return None, None
            
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Update Gender & Complete Profile
        patch_data = {
            "gender": role_gender, 
            "firstName": f"Test{role_gender}",
            "birthday": "1995-01-01",
            "photos": [
                "https://placehold.co/400x600/png",
                "https://placehold.co/400x600/png",
                "https://placehold.co/400x600/png",
                "https://placehold.co/400x600/png"
            ]
        }
        requests.patch(f"{API_URL}/users/me", json=patch_data, headers=headers)
        return token, phone
    except Exception as e:
        print(f"Connection failed: {e}")
        return None, None

def main():
    print("--- Setup Web QA ---")
    
    # 1. Setup Users
    token_a, phone_a = register_and_setup("Woman")
    token_b, phone_b = register_and_setup("Man")
    
    if not token_a or not token_b:
        print("Failed to create users")
        sys.exit(1)

    print(f"\nUser A (Woman): {phone_a}")
    print(f"Token A: {token_a}")
    print(f"\nUser B (Man): {phone_b}")
    print(f"Token B: {token_b}")
    
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 2. Check Status
    try:
        res = requests.get(f"{API_URL}/chat-night/status", headers=headers_a)
        if not res.json()['is_open']:
            print("\nERROR: Chat Night is closed. Set CHAT_NIGHT_TEST_MODE=true")
            sys.exit(1)
    except:
        print("Backend not reachable")
        sys.exit(1)

    # Helper to drain queues
    def drain_queue(gender_to_drain):
        # To drain MEN queue, we send WOMEN until one gets queued.
        # To drain WOMEN queue, we send MEN until one gets queued.
        print(f"Draining {gender_to_drain} queue...")
        actor_gender = "Woman" if gender_to_drain == "Man" else "Man"
        
        for i in range(10): # Safety limit
            # Register dummy
            ph = f"+919900{random.randint(1000,9999)}00"
            requests.post(f"{API_URL}/auth/register", json={"phone_number": ph, "password": "pass"})
            t = requests.post(f"{API_URL}/auth/login", json={"phone_number": ph, "password": "pass"}).json()['access_token']
            requests.patch(f"{API_URL}/users/me", json={"gender": actor_gender, "first_name": "Drainer"}, headers={"Authorization": f"Bearer {t}"})
            
            # Enter
            r = requests.post(f"{API_URL}/chat-night/enter", headers={"Authorization": f"Bearer {t}"}).json()
            status = r.get('status')
            print(f"  Drainer ({actor_gender}) {i}: {status}")
            if status == 'queued':
                # Queue is now waiting for this gender, meaning opposite queue is drained.
                # Now remove this drainer so we are clean.
                requests.post(f"{API_URL}/chat-night/leave", headers={"Authorization": f"Bearer {t}"})
                print(f"  {gender_to_drain} queue empty. Drainer left.")
                return
        print("Warning: Queue drain limit reached.")

    # 3. Drain existing
    drain_queue("Man")
    drain_queue("Woman")

    # 4. Enter Pool
    print("\nClearing queues first...")
    requests.post(f"{API_URL}/chat-night/leave", headers=headers_a)
    requests.post(f"{API_URL}/chat-night/leave", headers=headers_b)

    print("\nMatching...")
    res_a = requests.post(f"{API_URL}/chat-night/enter", headers=headers_a) # Woman queues
    print(f"User A Enter: {res_a.json()}")
    
    res = requests.post(f"{API_URL}/chat-night/enter", headers=headers_b) # Man enters -> Match
    print(f"User B Enter: {res.json()}")
    
    data = res.json()
    if data.get('status') == 'match_found':
        room_id = data['room_id']
        print(f"\nSUCCESS! Room Created.")
        print(f"Room ID: {room_id}")
        print(f"\nWeb URL: http://localhost:8082/chat/talk-room?roomId={room_id}")
        print("\nACTION REQUIRED: Open TWO browsers with the tokens above (inject via localStorage manually or login UI if possible).")
        print("Since web login UI might be complex, you can try to inject token. Or just use the URL if authentication handling is patched.")
    else:
        print("Failed to match.")
        print(data)

if __name__ == "__main__":
    main()
