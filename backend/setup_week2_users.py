
import requests
import random
import string
import time
import json

BASE_URL = "http://localhost:8000"

def random_phone():
    return f"+91{random.randint(6000000000, 9999999999)}"

def register_user(label, gender):
    print(f"[{label}] Registering...")
    phone = random_phone()
    password = "Password123!"
    
    # 1. Register with Password
    # Using /api/auth/register as per verify_discovery.ps1 strategy
    payload = {"phone_number": phone, "password": password}
    try:
        res = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
    except Exception as e:
        print(f"Connection error: {e}")
        return None

    if res.status_code != 200:
        # If user exists (400), try logging in or just fail if fresh required
        print(f"Failed to register {label}: {res.text}")
        return None
        
    data = res.json()
    token = data.get("access_token")
    if not token:
        print(f"No token returned for {label}: {res.text}")
        return None
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Onboarding (Update Profile)
    # Note: Onboarding usually requires multiple steps or a single patch.
    # We patch the critical fields for Chat Night eligibility.
    profile_update = {
        "first_name": f"User{label}",
        "gender": gender,
        "birth_date": "1995-01-01", 
        "dating_preference": "Everyone",
         # Minimum 4 photos often required by backend
        "photos": [
            "https://via.placeholder.com/150", 
            "https://via.placeholder.com/150", 
            "https://via.placeholder.com/150", 
            "https://via.placeholder.com/150"
        ],
        "bio": f"I am User {label}",
        "work": "Tester",
        "location": "QA Lab",
        "hometown": "Internet",
        "profile_completion": 100
    }
    
    time.sleep(1) # Safety
    res = requests.patch(f"{BASE_URL}/api/users/me", json=profile_update, headers=headers)
    if res.status_code != 200:
        print(f"Failed to onboard {label}: {res.text}")
        
    print(f"[{label}] Ready. Phone: {phone} Pass: {password}")
    return token

def check_status(token):
    try:
        res = requests.get(f"{BASE_URL}/api/chat-night/status", headers={"Authorization": f"Bearer {token}"})
        print(f"[System] Chat Night Status: {res.json()}")
    except Exception as e:
        print(f"[System] Status check failed: {e}")

if __name__ == "__main__":
    token_a = register_user("A", "Man")
    token_b = register_user("B", "Woman")
    token_c = register_user("C", "Man")
    
    # Save tokens to a file for other scripts to use
    with open("qa_tokens.json", "w") as f:
        json.dump({
            "A": token_a, 
            "B": token_b, 
            "C": token_c
        }, f)
    
    print("\n--- TOKENS SAVED TO qa_tokens.json ---")
    
    if token_a:
        check_status(token_a)
