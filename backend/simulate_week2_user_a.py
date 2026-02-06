
import requests
import json
import time

BASE_URL = "http://localhost:8000"

def run_a_simulation():
    print("[User A] Starting Simulation logic...")
    
    with open("qa_tokens.json", "r") as f:
        tokens = json.load(f)
        token_a = tokens["A"]
        
    headers = {"Authorization": f"Bearer {token_a}"}
    
    # 2. Enter Chat Night
    print("[User A] Entering Pool...")
    res = requests.post(f"{BASE_URL}/api/chat-night/enter", headers=headers)
    data = res.json()
    print(f"[User A] Enter Result: {data.get('status')} Room: {data.get('room_id')}")
    
    room_id = data.get("room_id")
    
    # 3. Poll for Room Active
    if not room_id or data.get('status') == 'queued':
        print("[User A] Polling for Room...")
        while True:
            time.sleep(2)
            res = requests.get(f"{BASE_URL}/api/chat-night/my-room", headers=headers)
            rdata = res.json()
            if rdata.get("room_id"):
                room_id = rdata["room_id"]
                state = rdata.get("state")
                print(f"[User A] Search Updated Room: {room_id} State: {state}")
                if state == 'active':
                    print("[User A] Room Active/Match Found!")
                    break
                    
    # 4. Wait & Engage
    print("[User A] Waiting 2s...")
    time.sleep(2)
    print("[User A] Engaging...")
    requests.post(f"{BASE_URL}/api/chat-night/engage", json={"room_id": room_id}, headers=headers)
    
    # 5. Poll for Thread to appear
    print("[User A] Waiting for Thread creation...")
    for _ in range(15):
        time.sleep(2)
        res = requests.get(f"{BASE_URL}/api/chat/threads", headers=headers)
        threads = res.json()
        if threads:
            print(f"[User A] Thread Created! ID: {threads[0]['_id']}")
            # Send the Hello message
            requests.post(f"{BASE_URL}/api/chat/threads/{threads[0]['_id']}/messages", json={"text": "Hello User B"}, headers=headers)
            print("[User A] Sent Hello.")
            break
            
if __name__ == "__main__":
    run_a_simulation()
