#include <WiFi.h>
#include <HTTPClient.h>

// 1. WI-FI SETTINGS
const char* ssid = "Faiba";
const char* password = "Wantam@2027";
String serverName = "http://192.168.1.50:8000/api/readings"; // e.g., http://192.168.1.45:8000...

// 2. PIN DEFINITIONS (Change these to match your wiring)
const int PH_PIN = 21;    // Change 34 to the pin you are using
const int TDS_PIN = 22;   // Change 35 to the pin you are using
const int TEMP_PIN = 23;  // Change 32 to the pin you are using

void setup() {
  Serial.begin(115200);
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to Wi-Fi!");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    
    // --- READ SENSORS ---
    // 1. Read Temperature (Assuming a standard analog thermistor/LM35)
    int rawTemp = analogRead(TEMP_PIN);
    float voltageTemp = rawTemp * (3.3 / 4095.0); // Convert to Volts
    float tempC = voltageTemp * 100.0;            // LM35 formula (10mV per degree). CHANGE if you use a different sensor!

    // 2. Read pH
    int rawPh = analogRead(PH_PIN);
    float voltagePh = rawPh * (3.3 / 4095.0);
    // Standard generic pH formula: pH = -5.70 * voltage + 21.34
    float phValue = -5.70 * voltagePh + 21.34; 
    
    // 3. Read TDS
    int rawTds = analogRead(TDS_PIN);
    float voltageTds = rawTds * (3.3 / 4095.0);
    
    // Temperature compensation for TDS
    float compensationCoefficient = 1.0 + 0.02 * (tempC - 25.0);
    float compensationVoltage = voltageTds / compensationCoefficient;
    
    // Standard TDS formula
    float tdsValue = (133.42 * pow(compensationVoltage, 3) - 255.86 * pow(compensationVoltage, 2) + 857.39 * compensationVoltage) * 0.5;

    // For the sake of the demo, let's pretend the input (source) water is dirty
    float tds_in = tdsValue * 2.5; 
    float tds_out = tdsValue; // The filtered water

    // --- SEND TO FASTAPI ---
    HTTPClient http;
    http.begin(serverName);
    http.addHeader("Content-Type", "application/json");

    // Build the JSON payload with REAL sensor data
    String jsonPayload = "{\"ph\":" + String(phValue, 2) + 
                         ",\"tds_in\":" + String(tds_in, 0) + 
                         ",\"tds_out\":" + String(tds_out, 0) + 
                         ",\"temp_c\":" + String(tempC, 1) + "}";

    Serial.print("Sending JSON: ");
    Serial.println(jsonPayload);

    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode > 0) {
      Serial.print("Server Response code: ");
      Serial.println(httpResponseCode);
    } else {
      Serial.print("Error code: ");
      Serial.println(httpResponseCode);
    }
    
    http.end();
  }

  // Wait 3 seconds
  delay(3000);
}