import http.client

def test_cors():
    conn = http.client.HTTPConnection("localhost", 8000)
    headers = {
        "Origin": "http://localhost:8082",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"
    }
    print("Sending OPTIONS request to /api/auth/login...")
    conn.request("OPTIONS", "/api/auth/login", headers=headers)
    response = conn.getresponse()
    print(f"Status: {response.status} {response.reason}")
    print("Response Headers:")
    # Header keys are lowercased in tuple list usually
    headers_dict = {k.lower(): v for k, v in response.getheaders()}
    for k, v in headers_dict.items():
        print(f"{k}: {v}")
    
    if "access-control-allow-origin" in headers_dict:
        print("\nSUCCESS: Access-Control-Allow-Origin found.")
    else:
        print("\nFAILURE: Access-Control-Allow-Origin NOT found.")

if __name__ == "__main__":
    test_cors()
