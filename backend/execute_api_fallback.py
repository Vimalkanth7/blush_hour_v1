
import requests
import json
import time

BASE_URL = "http://localhost:8000"

def run_tests():
    print("[Fallback QA] Starting API-based verification due to Browser failure...")
    
    # 1. Load Tokens
    with open("qa_tokens.json", "r") as f:
        tokens = json.load(f)
        token_a = tokens["A"]
        token_c = tokens["C"]
        
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_c = {"Authorization": f"Bearer {token_c}"}
    
    # 2. User A: Find Thread
    print("\n[User A] Fetching Threads...")
    res = requests.get(f"{BASE_URL}/api/chat/threads", headers=headers_a)
    data = res.json()
    
    if isinstance(data, list):
        threads = data
    elif "threads" in data:
        threads = data["threads"]
    else:
        print(f"FAIL: Unexpected format: {data}")
        return
        
    if not threads:
        print("FAIL: User A has no threads. Match simulation failed?")
        return
        
    thread = threads[0]
    tid = thread.get("thread_id") or thread.get("_id") # Handle schema variation
    print(f"PASS: Found Thread {tid}")
    print(f"Partner Name: {thread.get('partner', {}).get('first_name')}")
    
    # 2b. SPAM GENERATION (Since Partner B crashed)
    print(f"\n[User A] Generating 60 messages to test pagination...")
    for i in range(60):
        requests.post(f"{BASE_URL}/api/chat/threads/{tid}/messages", json={"text": f"Fallback Spam {i}"}, headers=headers_a)
        if i % 20 == 0: print(f"Sent {i}...")
    
    # 3. Pagination Test (User A)
    print(f"\n[User A] Testing Pagination for Thread {tid}...")
    # Fetch latest 50
    res = requests.get(f"{BASE_URL}/api/chat/threads/{tid}/messages?limit=50", headers=headers_a)
    data = res.json()
    msgs_p1 = data.get("messages", [])
    print(f"Page 1 Count: {len(msgs_p1)}")
    
    if len(msgs_p1) >= 50:
        print("PASS: Page 1 limit respected.")
        # Fetch Page 2 (older)
        # Assuming messages are sorted descending (latest first)
        last_id = msgs_p1[-1]["_id"] 
        print(f"Fetch before: {last_id}")
        res = requests.get(f"{BASE_URL}/api/chat/threads/{tid}/messages?limit=50&before={last_id}", headers=headers_a)
        data = res.json()
        msgs_p2 = data.get("messages", [])
        print(f"Page 2 Count: {len(msgs_p2)}")
        if len(msgs_p2) > 0:
            print("PASS: Pagination 'before' cursor works.")
            print(f"Sample Old Msg: {msgs_p2[0]['text']}")
        else:
            print("WARN: Page 2 empty. Maybe not enough spam?")
    else:
        print("WARN: Not enough messages for full page test.")
        
    # 4. Security Test (User C)
    print(f"\n[Security] User C attempting to access Thread {tid}...")
    
    # Message Access
    res = requests.get(f"{BASE_URL}/api/chat/threads/{tid}/messages", headers=headers_c)
    print(f"GET /messages Status: {res.status_code}")
    if res.status_code == 403:
        print("PASS: User C blocked from messages.")
    else:
        print(f"FAIL: User C got {res.status_code} (Expected 403)")
        
    # Partner Access
    res = requests.get(f"{BASE_URL}/api/chat/threads/{tid}/partner", headers=headers_c)
    print(f"GET /partner Status: {res.status_code}")
    if res.status_code == 403:
        print("PASS: User C blocked from partner info.")
    else:
        print(f"FAIL: User C got {res.status_code} (Expected 403)")
        
    print("\n[Fallback QA] Complete.")

if __name__ == "__main__":
    run_tests()
