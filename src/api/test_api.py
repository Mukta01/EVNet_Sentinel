import requests
import pandas as pd
import json

def test_health():
    print("Testing /health endpoint...")
    try:
        response = requests.get("http://localhost:8000/")
        print("Status Code:", response.status_code)
        print("Response:", response.json())
        print("-" * 40)
    except Exception as e:
        print(f"Failed to connect to API: {e}")

def test_prediction():
    print("Testing /predict endpoint using a real row from X_test.csv...")
    try:
        # Load exactly 1 row from the test set to send to the API
        df = pd.read_csv("data/processed/X_test.csv", nrows=1)
        
        # Convert the single row to a dictionary
        payload = df.iloc[0].to_dict()
        
        # Send the POST request
        response = requests.post(
            "http://localhost:8000/predict",
            json={"features": payload}
        )
        
        print("Status Code:", response.status_code)
        print("Prediction Result:", json.dumps(response.json(), indent=2))
        
    except Exception as e:
        print(f"Prediction test failed: {e}")

if __name__ == "__main__":
    test_health()
    test_prediction()
