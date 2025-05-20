// Send Codes Supabase Separate ID and NAME
#include <WiFi.h>
#include <HTTPClient.h>
#include <Adafruit_Fingerprint.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ==================== Wi-Fi Configuration ====================
#define WIFI_SSID "PLDTHOMEFIBR67508"
#define WIFI_PASSWORD "PLDTWIFI7ghd3"
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ==================== Supabase Configuration ====================
const String SUPABASE_URL = "https://vzubmycafgnjtwnjfpop.supabase.co";
const String SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6dWJteWNhZmduanR3bmpmcG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzNDY2NTQsImV4cCI6MjA1OTkyMjY1NH0.fDzlvR0xT3Sm8BTlCnEbxC8WE8-H3ZBRxA9SeEViaeo";
const String SUPABASE_TABLE_NAME = "raw_logs";

// ==================== Fingerprint Sensor Configuration ====================
#define RX_PIN 16
#define TX_PIN 17

HardwareSerial mySerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

// ==================== User Data ====================
const int MAX_USERS = 13;
String names[MAX_USERS + 1] = { "", "John", "Jay Andrey Amulong", "Reiven Cabate", "Ronan Valle", "Dr. Remedios G. Ado", "Engr. Rolito L. Mahaguay", "Engr. Joshua Benjamin B. Rodriguez", "Engr. Orlando V. Pajabera", "Engr. Marlon Jhon B. Bautista", "Engr. Julius S. Cansino", "Nicole Enriquez", "Hydee Palisoc", "Juan" }; // IDs 1–12

bool isTimeIn[MAX_USERS + 1];  // false = next is Time In, true = next is Time Out

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Initialize OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("❌ OLED not found");
    while (true); // Halt if OLED is not found
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(20, 25);
  display.println("SCAN FINGER");
  display.display();

  // Connect to Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // Initialize fingerprint sensor
  mySerial.begin(57600, SERIAL_8N1, RX_PIN, TX_PIN);
  finger.begin(57600);
  if (finger.verifyPassword()) {
    Serial.println("✅ Fingerprint sensor initialized.");
  } else {
    Serial.println("❌ Sensor not found. Check wiring.");
    while (1);
  }
}


void loop() {
  if (finger.getImage() == FINGERPRINT_OK) {
    if (finger.image2Tz() == FINGERPRINT_OK && finger.fingerFastSearch() == FINGERPRINT_OK) {
      int id = finger.fingerID;
      if (id >= 1 && id <= MAX_USERS) {
        String name = names[id];
        String status = isTimeIn[id] ? "out" : "in";

        Serial.println("👆 Finger detected!");
        Serial.println("✅ Match Found:");
        Serial.print("ID: "); Serial.println(id);
        Serial.print("Name: "); Serial.println(name);

        // Send to Supabase but don't toggle yet!
        sendToSupabase(id, name, status);
      } else {
        Serial.println("⚠️ Match found for unknown ID.");
      }

      delay(2000);  // Delay before next read
      while (finger.getImage() != FINGERPRINT_NOFINGER);  // Wait for finger to be removed
    } else {
      Serial.println("❌ Failed to read fingerprint.");
    }
  }

  delay(100);
}

void sendToSupabase(int finger_id, String name, String status) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = SUPABASE_URL + "/rest/v1/" + SUPABASE_TABLE_NAME;

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + SUPABASE_API_KEY);
    http.addHeader("apikey", SUPABASE_API_KEY);

    String jsonPayload = "{\"finger_id\": " + String(finger_id) + 
                         ", \"name\": \"" + name + 
                         "\", \"status\": \"" + status + "\"}";

    Serial.println("Sending Payload: ");
    Serial.println(jsonPayload);

    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode == 201) {
      Serial.printf("🕒 %s recorded.\n", status.c_str());
      Serial.println("✅ Data sent to Supabase successfully!");

      // Toggle after sending successful data (now it's correct!)
      isTimeIn[finger_id] = !isTimeIn[finger_id]; // ✅ Toggle time only after data is sent!
    } else {
      Serial.print("❌ Error sending data: ");
      Serial.println(httpResponseCode);
      Serial.println("⛔ Status not toggled.");
    }

    http.end();
  } else {
    Serial.println("❌ Wi-Fi not connected.");
  }
}
// Codes