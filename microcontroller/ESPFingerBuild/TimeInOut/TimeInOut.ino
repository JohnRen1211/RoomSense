// Time In and Out
#include <Adafruit_Fingerprint.h>

#define RX_PIN 16
#define TX_PIN 17

HardwareSerial mySerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

const int MAX_USERS = 5;
String names[MAX_USERS + 1] = { "", "Alice", "Bob", "Charlie", "Diana", "Eve" }; // ID 1–5
bool isTimeIn[MAX_USERS + 1];  // false = next is Time In, true = next is Time Out

void setup() {
  Serial.begin(115200);
  delay(1000);

  mySerial.begin(57600, SERIAL_8N1, RX_PIN, TX_PIN);
  finger.begin(57600);

  Serial.println("🔌 Connecting to fingerprint sensor...");
  if (finger.verifyPassword()) {
    Serial.println("✅ Sensor connected.");
  } else {
    Serial.println("❌ Sensor not detected. Check connections.");
    while (1);
  }

  Serial.println("\n--- Time In / Out System Ready ---");
}

void loop() {
  if (finger.getImage() == FINGERPRINT_OK) {
    if (finger.image2Tz() == FINGERPRINT_OK && finger.fingerFastSearch() == FINGERPRINT_OK) {
      int id = finger.fingerID;
      if (id >= 1 && id <= MAX_USERS) {
        Serial.print("👆 Finger detected!\n✅ Match Found: ID: ");
        Serial.print(id);
        Serial.print(" - ");
        Serial.println(names[id]);

        if (!isTimeIn[id]) {
          Serial.print("🕒 Time In recorded for ");
        } else {
          Serial.print("🕒 Time Out recorded for ");
        }
        Serial.print("ID: ");
        Serial.print(id);
        Serial.print(" - ");
        Serial.println(names[id]);

        isTimeIn[id] = !isTimeIn[id]; // toggle status
      } else {
        Serial.println("⚠️ Match found for unknown ID.");
      }

      delay(2000);  // delay before next read
      while (finger.getImage() != FINGERPRINT_NOFINGER);  // wait for finger to be removed
    } else {
      Serial.println("❌ Failed to read fingerprint.");
    }
  }

  delay(100);
}
