
import requests
import json
import time
import sys

BASE_URL = "http://localhost:8000"

def run_partner_simulation():
    print("[Partner B] Starting Simulation logic...")
    
    # 1. Load Token
    try:
        with open("qa_tokens.json", "r") as f:
            tokens = json.load(f)
            token_b = tokens["B"]
    except Exception as e:
        print(f"[Partner B] Failed to load tokens: {e}")
        return

    headers = {"Authorization": f"Bearer {token_b}"}

    # 2. Enter Chat Night
    print("[Partner B] Entering Pool...")
    res = requests.post(f"{BASE_URL}/api/chat-night/enter", headers=headers)
    data = res.json()
    print(f"[Partner B] Enter Result: {data.get('status')} Room: {data.get('room_id')}")
    
    room_id = data.get("room_id")
    
    # 3. Poll for Room Active (if queued)
    if not room_id or data.get('status') == 'queued':
        print("[Partner B] Polling for Room...")
        while True:
            time.sleep(2)
            res = requests.get(f"{BASE_URL}/api/chat-night/my-room", headers=headers)
            rdata = res.json()
            if rdata.get("room_id"):
                room_id = rdata["room_id"]
                state = rdata.get("state")
                print(f"[Partner B] Room Found: {room_id} State: {state}")
                if state == 'active':
                    break
    
    # 4. Wait for Partner (Simulate delay before engaging?)
    print("[Partner B] Room Active. Waiting 5s before engaging...")
    time.sleep(5)
    
    # 5. Engage
    print("[Partner B] Engaging...")
    res = requests.post(f"{BASE_URL}/api/chat-night/engage", json={"room_id": room_id}, headers=headers)
    print(f"[Partner B] Engage Status: {res.status_code}")
    
    # 6. Poll for Match Unlocked
    print("[Partner B] Polling for Match Unlock...")
    while True:
        time.sleep(2)
        res = requests.get(f"{BASE_URL}/api/chat-night/room/{room_id}", headers=headers)
        rdata = res.json()
        if rdata.get("match_unlocked"):
            print("[Partner B] MATCH UNLOCKED!")
            break
        
    # 7. Poll Threads
    print("[Partner B] Polling for Threads...")
    thread_id = None
    for _ in range(20):
        time.sleep(2)
        res = requests.get(f"{BASE_URL}/api/chat/threads", headers=headers)
        threads = res.json()
        if threads and len(threads) > 0:
            # Assuming first thread is the new one
            thread_id = threads[0]["_id"]
            title = threads[0].get("title", "Unknown")
            print(f"[Partner B] Thread Found: {thread_id} with {title}")
            break
            
    if not thread_id:
        print("[Partner B] No thread found after 40s. Exiting.")
        return

    # 8. Wait for "Hello" from A
    print("[Partner B] Waiting for message from A...")
    last_msg_count = 0
    while True:
        time.sleep(2)
        res = requests.get(f"{BASE_URL}/api/chat/threads/{thread_id}/messages", headers=headers)
        msgs = res.json().get("messages", [])
        if len(msgs) > last_msg_count:
            new_msg = msgs[0] # assuming sorted desc or check list
            # Usually messages are desc (latest first) or asc? API contract changed?
            # Prompt says "Frontend updated... pagination". Standard is often latest-first for pagination or asc for history.
            # Let's assume list contains messages.
            print(f"[Partner B] Messages count: {len(msgs)}")
            # Check content
            text = new_msg.get("text", "")
            sender_id = new_msg.get("sender_id", "")
            print(f"[Partner B] Latest Msg: {text}")
            
            if "hello" in text.lower():
                print("[Partner B] Received Hello! Replying...")
                time.sleep(1)
                requests.post(f"{BASE_URL}/api/chat/threads/{thread_id}/messages", json={"text": "Hi from B"}, headers=headers)
                print("[Partner B] Sent Reply.")
                break
                
    # 9. Spam messages for Pagination Test
    print("[Partner B] Starting Spam (60 messages) in 5s...")
    time.sleep(5)
    for i in range(1, 61):
        requests.post(f"{BASE_URL}/api/chat/threads/{thread_id}/messages", json={"text": f"Spam message {i}"}, headers=headers)
        if i % 10 == 0:
            print(f"[Partner B] Sent {i}/60")
        time.sleep(0.1)
        
    print("[Partner B] Spam Complete. Simulation Done.")

if __name__ == "__main__":
    run_partner_simulation()
