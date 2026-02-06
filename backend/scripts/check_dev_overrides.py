import requests
import sys

BASE_URL = "http://localhost:8000/api"

def run():
    try:
        # Login
        resp = requests.post(f"{BASE_URL}/auth/login", json={"phone_number": "1111111111", "password": "TestPass123!"})
        if resp.status_code != 200:
            print("Login failed")
            print(resp.text)
            return

        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Check Status
        resp = requests.get(f"{BASE_URL}/chat-night/status", headers=headers)
        print("Status Code:", resp.status_code)
        if resp.status_code != 200:
             print("Error Text:", resp.text)
        else:
             print("Response:", resp.json())
        
        if resp.status_code == 200:
             data = resp.json()
        if data["is_open"] == True and data["passes_total"] == 100:
            print("SUCCESS: Force Open + 100 Passes active")
        else:
            print("FAIL: Check config")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    run()
