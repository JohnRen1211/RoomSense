// Send ID and display data sent
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
const int MAX_USERS = 5;
String names[MAX_USERS + 1] = { "", "John", "Rolito", "Jorly", "Diana", "Eve" };
bool isTimeIn[MAX_USERS + 1];  // false = next is Time In, true = next is Time Out

// Helper function to calculate centered position
int getCenteredX(String text, int textSize = 1) {
  int16_t x1, y1;
  uint16_t w, h;
  display.setTextSize(textSize);
  display.getTextBounds(text, 0, 0, &x1, &y1, &w, &h);
  return (SCREEN_WIDTH - w) / 2;
}

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
  display.setCursor(getCenteredX("SCAN FINGER"), 25);
  display.println("SCAN FINGER");
  display.display();

  // Connect to Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  displayCenteredMessage("Connecting to WiFi...");
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nWi-Fi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  displayCenteredMessage("WiFi connected!");

  // Initialize fingerprint sensor
  mySerial.begin(57600, SERIAL_8N1, RX_PIN, TX_PIN);
  finger.begin(57600);
  if (finger.verifyPassword()) {
    Serial.println("✅ Fingerprint sensor initialized.");
    displayTwoLineMessage("Fingerprint sensor", "initialized");
  } else {
    Serial.println("❌ Sensor not found. Check wiring.");
    displayTwoLineMessage("Sensor not found", "Check wiring");
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
        
        displayFingerprintInfo(id, name, status);

        // Send to Supabase but don't toggle yet!
        sendToSupabase(id, name, status);
      } else {
        Serial.println("⚠️ Match found for unknown ID.");
        displayTwoLineMessage("Unknown ID", "Please register");
      }

      delay(2000);  // Delay before next read
      while (finger.getImage() != FINGERPRINT_NOFINGER);  // Wait for finger to be removed
      display.clearDisplay();
      display.setCursor(getCenteredX("SCAN FINGER"), 25);
      display.println("SCAN FINGER");
      display.display();
    } else {
      Serial.println("❌ Error to read fingerprint.");
      displayTwoLineMessage("Scan error", "Try again");
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
      displayTwoLineMessage("Time " + status, "Sent to Supabase");

      // Toggle after sending successful data (now it's correct!)
      isTimeIn[finger_id] = !isTimeIn[finger_id]; // ✅ Toggle time only after data is sent!
    } else {
      Serial.print("❌ Error sending data: ");
      Serial.println(httpResponseCode);
      Serial.println("⛔ Status not toggled.");
      displayTwoLineMessage("Upload error", "Error: " + String(httpResponseCode));
    }

    http.end();
  } else {
    Serial.println("❌ Wi-Fi not connected.");
    displayTwoLineMessage("WiFi disconnected", "Cannot upload");
  }
}

// Helper functions for OLED display
void displayCenteredMessage(String message) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(getCenteredX(message), SCREEN_HEIGHT/2 - 4);
  display.println(message);
  display.display();
}

void displayTwoLineMessage(String line1, String line2) {
  display.clearDisplay();
  display.setTextSize(1);
  
  // Center first line
  display.setCursor(getCenteredX(line1), SCREEN_HEIGHT/2 - 12);
  display.println(line1);
  
  // Center second line
  display.setCursor(getCenteredX(line2), SCREEN_HEIGHT/2 + 4);
  display.println(line2);
  
  display.display();
}

void displayFingerprintInfo(int id, String name, String status) {
  display.clearDisplay();
  display.setTextSize(1);
  
  // Center title
  String title = "Fingerprint Match";
  display.setCursor(getCenteredX(title), 5);
  display.println(title);
  
  // Center ID line
  String idLine = "ID: " + String(id);
  display.setCursor(getCenteredX(idLine), 20);
  display.println(idLine);
  
  // Center Name line
  String nameLine = "Name: " + name;
  display.setCursor(getCenteredX(nameLine), 30);
  display.println(nameLine);
  
  // Center Status line
  String statusLine = "Time " + status;
  display.setCursor(getCenteredX(statusLine), 40);
  display.println(statusLine);
  
  // Center Uploading line
  String uploadLine = "Uploading...";
  display.setCursor(getCenteredX(uploadLine), 55);
  display.println(uploadLine);
  
  display.display();
}
// Codes