from flask import Flask, request, jsonify
import joblib
import numpy as np
from datetime import datetime

app = Flask(__name__)

# 1. Load the AI model and scaler
print("Loading AI model...")
scaler = joblib.load('scaler.pkl')
svm_model = joblib.load('svm_water_model.pkl')
print("Model loaded successfully!")

# 2. Create a digital notepad to store recent data
sensor_history = []

# 3. The endpoint where the ESP32 sends data
@app.route('/api/sensor-data', methods=['POST'])
def receive_sensor_data():
    data = request.json
    
    # Get the numbers
    ph = data['ph']
    tds = data['tds']
    temp = data['temp']
    
    # Prepare them for the AI
    features = np.array([[ph, tds, temp]])
    features_scaled = scaler.transform(features)
    
    # Ask the AI for a prediction (0 = Unsafe, 1 = Safe)
    prediction = svm_model.predict(features_scaled)[0]
    status = "Safe" if prediction == 1 else "Unsafe"
    
    # Save the record to our notepad
    record = {
        'ph': ph, 'tds': tds, 'temp': temp,
        'safe': int(prediction), 'status': status,
        'timestamp': datetime.now().isoformat()
    }
    sensor_history.append(record)
    
    # Keep the notepad from getting too long (max 50 records)
    if len(sensor_history) > 50:
        sensor_history.pop(0)
        
    print(f"Received data: {record}")
    return jsonify(record), 201

# 4. The endpoint where the Web Dashboard asks for data
@app.route('/api/latest-readings', methods=['GET'])
def get_latest_readings():
    return jsonify(sensor_history)

if __name__ == '__main__':
    # This starts the waiter!
    app.run(host='0.0.0.0', port=5000, debug=True)