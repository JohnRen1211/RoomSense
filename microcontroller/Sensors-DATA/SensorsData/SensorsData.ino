// Code
#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// ==================== Wi-Fi Configuration ====================
#define WIFI_SSID "PLDTHOMEFIBR67508"
#define WIFI_PASSWORD "PLDTWIFI7ghd3"

// ==================== Supabase Configuration ====================

const String SUPABASE_URL = "https://vzubmycafgnjtwnjfpop.supabase.co";
const String SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6dWJteWNhZmduanR3bmpmcG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzNDY2NTQsImV4cCI6MjA1OTkyMjY1NH0.fDzlvR0xT3Sm8BTlCnEbxC8WE8-H3ZBRxA9SeEViaeo";  // Replace with your actual Supabase API key
const String SUPABASE_TABLE_NAME = "comp_data"; // Supabase table name


// ==================== Sensor Configuration ====================
#define PIR_PIN 25               // PIR sensor pin  GPIO25
#define DHT_PIN 26               // DHT22 data pin GPIO26
#define LIGHT_SENSOR_PIN 36      // ESP32 analog pin for light sensor (GPIO36 / VP)

#define DHTTYPE DHT22            // Specify DHT22 instead of DHT11
DHT dht(DHT_PIN, DHTTYPE);      // DHT sensor object

// ==================== Timing Control ====================
unsigned long sendDataPrevMillis = 0;
const unsigned long interval = 30000; // Send data every 30 seconds

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Start Wi-Fi connection
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");

  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }

  Serial.println("\nWi-Fi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // Initialize DHT sensor
  dht.begin();

  // Initialize PIR sensor
  pinMode(PIR_PIN, INPUT);
}

void loop() {
  if (millis() - sendDataPrevMillis > interval || sendDataPrevMillis == 0) {
    sendDataPrevMillis = millis();

    // === Read Sensor Data ===
    float temp = dht.readTemperature();
    float humidity = dht.readHumidity();
    int lightValue = analogRead(LIGHT_SENSOR_PIN);
    int motionState = digitalRead(PIR_PIN); // 1 = motion, 0 = no motion

    // === Serial Debug Output ===
    Serial.print("Temp: "); Serial.print(temp); Serial.print(" °C  ");
    Serial.print("Humidity: "); Serial.print(humidity); Serial.print(" %  ");
    Serial.print("Light: "); Serial.print(lightValue); Serial.print("  ");
    Serial.println(motionState == HIGH ? "Motion detected!" : "No motion");

    // === Check if Wi-Fi is connected ===
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;

      String url = SUPABASE_URL + "/rest/v1/" + SUPABASE_TABLE_NAME;
      http.begin(url);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("Authorization", "Bearer " + SUPABASE_API_KEY);
      http.addHeader("apikey", SUPABASE_API_KEY);

      // === Create JSON payload ===
      String jsonPayload = "{\"temperature\":" + String(temp) +
                           ", \"humidity\":" + String(humidity) +
                           ", \"light\":" + String(lightValue) + 
                           ", \"motion\":" + String(motionState) + "}";

      int httpResponseCode = http.POST(jsonPayload);

      if (httpResponseCode == 201) {
        Serial.println("Data sent to Supabase successfully!");
      } else {
        Serial.print("Error sending data: ");
        Serial.println(httpResponseCode);
      }

      http.end();
    } else {
      Serial.println("WiFi not connected.");
    }
  }
}
