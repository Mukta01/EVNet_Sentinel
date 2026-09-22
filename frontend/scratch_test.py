import urllib.request
try:
    with urllib.request.urlopen("http://localhost:3000/dashboard") as response:
        print(response.status)
        print(response.read()[:200])
except Exception as e:
    print(e)
