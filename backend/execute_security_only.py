
import requests
import json

BASE_URL = "http://localhost:8000"

def run_security():
    print("[Security Check Fast] Starting...")
    
    with open("qa_tokens.json", "r") as f:
        tokens = json.load(f)
        token_a = tokens["A"]
        token_c = tokens["C"]
        
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_c = {"Authorization": f"Bearer {token_c}"}
    
    # Get A's thread
    res = requests.get(f"{BASE_URL}/api/chat/threads", headers=headers_a)
    data = res.json()
    if "threads" in data and data["threads"]:
        tid = data["threads"][0]["thread_id"]
    elif isinstance(data, list) and data:
        tid = data[0]["_id"]
    else:
        print("No thread found for A to test security against.")
        return

    print(f"Target Thread: {tid}")

    # TEST C -> A's Thread
    res = requests.get(f"{BASE_URL}/api/chat/threads/{tid}/messages", headers=headers_c)
    print(f"GET /messages Status: {res.status_code}")
    
    res = requests.get(f"{BASE_URL}/api/chat/threads/{tid}/partner", headers=headers_c)
    print(f"GET /partner Status: {res.status_code}")

if __name__ == "__main__":
    run_security()
