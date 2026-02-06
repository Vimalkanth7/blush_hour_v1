
import requests
import time
import sys
import random

API_URL = "http://localhost:8000/api"

def register_and_setup(role_gender):
    # Random phone to ensure unique registration
    rand_suffix = random.randint(100000, 999999)
    phone = f"+9199{rand_suffix}00"
    password = "secretpassword"
    
    print(f"[{role_gender[:1]}] Registering {phone}...")
    
    # 1. Register
    reg_data = {"phone_number": phone, "password": password}
    res = requests.post(f"{API_URL}/auth/register", json=reg_data)
    
    # If already exists (rare with random), try login
    if res.status_code == 400 and "already registered" in res.text:
        print(f"[{role_gender[:1]}] User exists, logging in...")
        res = requests.post(f"{API_URL}/auth/login", json=reg_data)
        
    if res.status_code != 200:
        print(f"Auth failed: {res.text}")
        sys.exit(1)
        
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Update Gender
    print(f"[{role_gender[:1]}] Setting gender to {role_gender}...")
    patch_data = {"gender": role_gender, "first_name":  f"Test{role_gender}"}
    res = requests.patch(f"{API_URL}/users/me", json=patch_data, headers=headers)
    if res.status_code != 200:
        print(f"Update failed: {res.text}")
        sys.exit(1)
        
    return token, headers

def main():
    print("--- Starting Chat Night Simulation (Auto-Reg v2) ---")
    
    # 1. Setup Users
    token_a, headers_a = register_and_setup("Woman")
    token_b, headers_b = register_and_setup("Man")
    
    # 2. Check Status
    res = requests.get(f"{API_URL}/chat-night/status", headers=headers_a)
    status = res.json()
    print(f"\nChat Night Open? {status['is_open']}")
    if not status['is_open']:
        print("ERROR: Chat Night is closed. Ensure CHAT_NIGHT_TEST_MODE=true")
        sys.exit(1)
        
    # 3. Enter Pool (Woman)
    print("\n[W] Enter Pool...")
    res = requests.post(f"{API_URL}/chat-night/enter", headers=headers_a)
    data_a = res.json()
    print(f"[W] Status: {data_a['status']}")
    
    # 4. Enter Pool (Man)
    print("\n[M] Enter Pool...")
    res = requests.post(f"{API_URL}/chat-night/enter", headers=headers_b)
    data_b = res.json()
    print(f"[M] Status: {data_b['status']}")
    
    match_room_id = None
    if data_b['status'] == 'match_found':
        match_room_id = data_b['room_id']
        print(f"SUCCESS: Match Found for Man! Room: {match_room_id}")
    else:
        print("ERROR: Man did not match immediately.")
        
    # 5. Poll Woman (Should match)
    if match_room_id:
        print("\n[W] Polling again...")
        res = requests.post(f"{API_URL}/chat-night/enter", headers=headers_a)
        data_a_2 = res.json()
        print(f"[W] Status: {data_a_2['status']}")
        if data_a_2['status'] == 'match_found' and data_a_2['room_id'] == match_room_id:
             print("SUCCESS: Woman matched to same room!")
        else:
             print(f"ERROR: Woman mismatch. Got {data_a_2}")

    # 6. Engage Flow
    if match_room_id:
        print(f"\n--- Testing Engagement in Room {match_room_id} ---")
        
        # Man Engages
        print("[M] Engaging...")
        res = requests.post(f"{API_URL}/chat-night/engage", json={"room_id": match_room_id}, headers=headers_b)
        print(f"[M] {res.json()}")
        
        # Check from Woman's side
        print(f"[W] Fetching room {match_room_id}...")
        res = requests.get(f"{API_URL}/chat-night/room/{match_room_id}", headers=headers_a)
        if res.status_code != 200:
             print(f"FAILED to fetch room. Status: {res.status_code}, Body: {res.text}")
             sys.exit(1)
        room_data = res.json()
        ui_status = room_data.get("engage_status")
        print(f"[W View] UI Status: {ui_status} (Expected: pending/waiting_for_partner)")
        
        # Woman Engages
        print("[W] Engaging...")
        res = requests.post(f"{API_URL}/chat-night/engage", json={"room_id": match_room_id}, headers=headers_a)
        print(f"[W] {res.json()}")
        
        if res.json().get("room_state") == "engaged":
             print("SUCCESS: Room is ENGAGED/UNLOCKED!")
        else:
             print(f"ERROR: Room state is {res.json()}")

if __name__ == "__main__":
    main()
