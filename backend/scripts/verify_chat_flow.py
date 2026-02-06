import requests
import json
import sys

BASE_URL = "http://localhost:8000/api"

def login(phone, password):
    resp = requests.post(f"{BASE_URL}/auth/login", json={"phone_number": phone, "password": password})
    if resp.status_code != 200:
        print(f"Login failed for {phone}: {resp.text}")
        sys.exit(1)
    return resp.json()["access_token"]

def run_test():
    print("--- 1. Login Users ---")
    token_a = login("1111111111", "TestPass123!")
    token_b = login("2222222222", "TestPass123!")
    token_c = login("3333333333", "TestPass123!")
    print("Logins successful.")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    headers_c = {"Authorization": f"Bearer {token_c}"}

    print("\n--- 2. User A Lists Threads (Should auto-create) ---")
    resp = requests.get(f"{BASE_URL}/chat/threads", headers=headers_a)
    print(f"List Threads A: {resp.status_code}")
    threads = resp.json()["threads"]
    if len(threads) == 0:
        print("FAIL: No threads found for User A")
        sys.exit(1)
    
    thread_id = threads[0]["thread_id"]
    print(f"Found Thread ID: {thread_id}")

    print("\n--- 3. User A Sends Message ---")
    msg_payload = {"text": "Hello User B!"}
    resp = requests.post(f"{BASE_URL}/chat/threads/{thread_id}/messages", headers=headers_a, json=msg_payload)
    print(f"Send Msg: {resp.status_code}")
    if resp.status_code != 200:
        print(resp.text)
        sys.exit(1)
        
    print("\n--- 4. User B Fetches Messages ---")
    resp = requests.get(f"{BASE_URL}/chat/threads/{thread_id}/messages", headers=headers_b)
    print(f"Get Msgs B: {resp.status_code}")
    msgs = resp.json()
    if len(msgs) == 0 or msgs[0]["text"] != "Hello User B!":
        print("FAIL: Message not received correctly")
        print(msgs)
        sys.exit(1)
    print("Message received successfully.")

    print("\n--- 5. User B Marks Read ---")
    resp = requests.post(f"{BASE_URL}/chat/threads/{thread_id}/read", headers=headers_b)
    print(f"Mark Read: {resp.status_code}")
    
    # Verify unread count for B via List Threads
    resp = requests.get(f"{BASE_URL}/chat/threads", headers=headers_b)
    unread = resp.json()["threads"][0]["unread_count"]
    print(f"User B Unread Count: {unread} (Expected 0)")
    if unread != 0:
        print("FAIL: Unread count not cleared")

    print("\n--- 6. Security Check (User C Intruder) ---")
    resp = requests.get(f"{BASE_URL}/chat/threads/{thread_id}/messages", headers=headers_c)
    print(f"User C Access: {resp.status_code}")
    if resp.status_code == 403:
        print("SUCCESS: User C blocked correctly.")
    else:
        print(f"FAIL: User C got {resp.status_code} (Expected 403)")
        sys.exit(1)

    print("\n--- ALL TESTS PASSED ---")

if __name__ == "__main__":
    run_test()
