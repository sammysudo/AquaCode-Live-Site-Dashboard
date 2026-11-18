// SafiSense ESP32 station
// Libraries to install (Library Manager): OneWire, DallasTemperature
// Board: any ESP32 dev board (Arduino-ESP32 core 2.x or 3.x)

#include <WiFi.h>
#include <WebServer.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// Wi-Fi access point the laptop joins (password needs 8+ characters)
const char* AP_SSID = "SafiSense";
const char* AP_PASS = "safisense1";
const char* DEVICE_ID = "safisense-01";

// ADC1 pins only (GPIO 32-39): ADC2 stops working while Wi-Fi is on
const int PIN_TDS_IN  = 34;
const int PIN_TDS_OUT = 35;
const int PIN_PH      = 32;   // through a 10k + 20k divider (see notes)
const int PIN_TEMP    = 4;    // DS18B20 data, 4.7k pull-up to 3V3

// Calibration values: replace after calibrating (see notes)
float PH_V7 = 1.65f;          // volts at the ADC pin in pH 7 buffer
float PH_V4 = 1.95f;          // volts at the ADC pin in pH 4 buffer
float TDS_K_IN  = 1.0f;       // known ppm / displayed ppm
float TDS_K_OUT = 1.0f;

WebServer server(80);
OneWire oneWire(PIN_TEMP);
DallasTemperature tempSensor(&oneWire);

float gPh = 7.0f, gTdsIn = 0, gTdsOut = 0, gTemp = 25.0f, gPhVolts = 0;
bool gTempOk = false;
unsigned long lastRead = 0;

float readVolts(int pin) {
  uint32_t s[15];
  for (int i = 0; i < 15; i++) {
    s[i] = analogReadMilliVolts(pin);
    delayMicroseconds(400);
  }
  for (int i = 1; i < 15; i++) {
    uint32_t k = s[i];
    int j = i - 1;
    while (j >= 0 && s[j] > k) { s[j + 1] = s[j]; j--; }
    s[j + 1] = k;
  }
  return s[7] / 1000.0f;
}

float tdsPpm(float volts, float tempC, float k) {
  float comp = 1.0f + 0.02f * (tempC - 25.0f);
  float v = volts / comp;
  float ppm = (133.42f * v * v * v - 255.86f * v * v + 857.39f * v) * 0.5f;
  return ppm < 0 ? 0 : ppm * k;
}

float phFromVolts(float v) {
  float span = PH_V4 - PH_V7;
  if (fabs(span) < 0.01f) return 7.0f;
  float ph = 7.0f + (-3.0f / span) * (v - PH_V7);
  return constrain(ph, 0.0f, 14.0f);
}

void sample() {
  tempSensor.requestTemperatures();
  float t = tempSensor.getTempCByIndex(0);
  gTempOk = (t != DEVICE_DISCONNECTED_C);
  gTemp = gTempOk ? t : 25.0f;

  gTdsIn  = tdsPpm(readVolts(PIN_TDS_IN),  gTemp, TDS_K_IN);
  gTdsOut = tdsPpm(readVolts(PIN_TDS_OUT), gTemp, TDS_K_OUT);
  gPhVolts = readVolts(PIN_PH);
  gPh = phFromVolts(gPhVolts);

  Serial.printf("%.2f,%.0f,%.0f,%.1f,%.3f\n", gPh, gTdsIn, gTdsOut, gTemp, gPhVolts);
}

void sendCors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Cache-Control", "no-store");
}

void handleData() {
  char buf[220];
  snprintf(buf, sizeof(buf),
    "{\"device_id\":\"%s\",\"uptime_s\":%lu,\"ph\":%.2f,\"tds_in\":%.0f,"
    "\"tds_out\":%.0f,\"temp_c\":%.1f,\"turbidity\":null,\"temp_ok\":%s}",
    DEVICE_ID, millis() / 1000UL, gPh, gTdsIn, gTdsOut, gTemp, gTempOk ? "true" : "false");
  sendCors();
  server.send(200, "application/json", buf);
}

void handlePreflight() {
  sendCors();
  server.send(204);
}

void handleRoot() {
  sendCors();
  server.send(200, "text/plain", "SafiSense station. Readings are at /data");
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_TDS_IN, ADC_11db);
  analogSetPinAttenuation(PIN_TDS_OUT, ADC_11db);
  analogSetPinAttenuation(PIN_PH, ADC_11db);

  tempSensor.begin();
  tempSensor.setResolution(10);

  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);
  Serial.print("Join Wi-Fi '"); Serial.print(AP_SSID);
  Serial.print("' then open http://"); Serial.print(WiFi.softAPIP()); Serial.println("/data");

  server.on("/", HTTP_GET, handleRoot);
  server.on("/data", HTTP_GET, handleData);
  server.on("/data", HTTP_OPTIONS, handlePreflight);
  server.begin();

  Serial.println("ph,tds_in,tds_out,temp_c,ph_volts");
  sample();
}

void loop() {
  server.handleClient();
  if (millis() - lastRead >= 1000) {
    lastRead = millis();
    sample();
  }
}
