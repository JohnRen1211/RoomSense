// Codes Fingerprint names hardcoded
#include <Adafruit_Fingerprint.h>

#define RX_PIN 16
#define TX_PIN 17
#define RESET_BUTTON_PIN 12

HardwareSerial mySerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

const int MAX_USERS = 5;
String names[MAX_USERS + 1] = { "", "Alice", "Bob", "Charlie", "Diana", "Eve" }; // IDs 1–5

void setup() {
  Serial.begin(115200);
  delay(1000);

  mySerial.begin(57600, SERIAL_8N1, RX_PIN, TX_PIN);
  Serial.println("🔌 Connecting to AS608...");

  finger.begin(57600);
  if (finger.verifyPassword()) {
    Serial.println("✅ Fingerprint sensor initialized.");
  } else {
    Serial.println("❌ Sensor not found. Check wiring.");
    while (1);
  }

  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);

  Serial.println("\n--- Fingerprint System Ready ---");
  Serial.println("[e] Enroll | [m] Match | [r] Reset DB | [c] Count");
}

void loop() {
  if (digitalRead(RESET_BUTTON_PIN) == LOW) {
    Serial.println("🔄 Resetting fingerprint database...");
    resetFingerprintDatabase();
    delay(1000);
  }

  if (Serial.available()) {
    char command = Serial.read();
    if (command == 'e') {
      delay(200);
      promptForEnrollmentID();
    }
    else if (command == 'm') {
      matchFingerprint();
    }
    else if (command == 'r') {
      resetFingerprintDatabase();
    }
    else if (command == 'c') {
      countFingerprints();
    }
  }
}

void promptForEnrollmentID() {
  Serial.println("\n📋 Available IDs to enroll:");
  for (int i = 1; i <= MAX_USERS; i++) {
    Serial.print("  ID ");
    Serial.print(i);
    Serial.print(" - ");
    Serial.println(names[i]);
  }

  Serial.println("📝 Type an ID number (1 to 5) and press Enter (or 'q' to cancel):");

  while (true) {
    while (!Serial.available()); // Wait for input

    if (Serial.peek() == 'q') {
      Serial.read(); // consume the 'q'
      Serial.println("🚪 Enrollment canceled.\n");
      return;
    }

    int id = Serial.parseInt();
    if (id >= 1 && id <= MAX_USERS) {
      Serial.print("✅ Selected ID ");
      Serial.print(id);
      Serial.print(" - ");
      Serial.println(names[id]);
      enrollFingerprint(id);
      return;
    } else {
      Serial.println("Type ID. Enter 1–5 or 'q' to cancel:");
      while (Serial.available()) Serial.read(); // clear buffer
    }
  }
}

void enrollFingerprint(int id) {
  // Check if this ID is already registered
  if (finger.loadModel(id) == FINGERPRINT_OK) {
    Serial.print("⚠️ ID ");
    Serial.print(id);
    Serial.print(" (");
    Serial.print(names[id]);
    Serial.println(") is already registered.");
    Serial.println("📝 Type 'yes' to overwrite, 'q' to cancel:");

    while (true) {
      while (!Serial.available());
      String input = Serial.readStringUntil('\n');
      input.trim();

      if (input.equalsIgnoreCase("q")) {
        Serial.println("🚪 Enrollment canceled.\n");
        return;
      } else if (input.equalsIgnoreCase("yes")) {
        break; // continue to enroll
      } else {
        Serial.println("❌ Invalid input. Type 'yes' to overwrite, or 'q' to cancel:");
      }
    }
  }

  Serial.print("\n📲 Enrolling ID: ");
  Serial.print(id);
  Serial.print(" - ");
  Serial.println(names[id]);

  if (!getFingerprintImageCancelable("👉 Place your finger... (press 'q' to cancel)", 1)) return;

  Serial.println("✋ Remove your finger.");
  while (finger.getImage() != FINGERPRINT_NOFINGER);
  delay(1000);

  if (!getFingerprintImageCancelable("👉 Place the same finger again... (press 'q' to cancel)", 2)) return;

  uint8_t result = finger.createModel();
  if (result == FINGERPRINT_OK) {
    if (finger.storeModel(id) == FINGERPRINT_OK) {
      Serial.println("✅ Fingerprint saved!");
    } else {
      Serial.println("❌ Failed to store fingerprint.");
    }
  } else if (result == FINGERPRINT_ENROLLMISMATCH) {
    Serial.println("⚠️ Fingers didn't match. Try again.");
  } else {
    Serial.println("❌ Error creating model.");
  }
}

bool getFingerprintImage(String prompt, uint8_t bufferId) {
  Serial.println(prompt);
  for (int attempts = 0; attempts < 20; attempts++) {
    int p = finger.getImage();
    if (p == FINGERPRINT_OK) {
      if (finger.image2Tz(bufferId) == FINGERPRINT_OK) {
        Serial.println("📸 Image captured.");
        return true;
      } else {
        Serial.println("⚠️ Failed to convert image.");
        return false;
      }
    }
    delay(200);
  }
  Serial.println("⏱️ Timed out waiting for finger.");
  return false;
}

bool getFingerprintImageCancelable(String prompt, uint8_t bufferId) {
  Serial.println(prompt);
  for (int attempts = 0; attempts < 50; attempts++) {
    if (Serial.available() && Serial.peek() == 'q') {
      Serial.read();
      Serial.println("🚪 Enrollment canceled.\n");
      return false;
    }

    int p = finger.getImage();
    if (p == FINGERPRINT_OK) {
      if (finger.image2Tz(bufferId) == FINGERPRINT_OK) {
        Serial.println("📸 Image captured.");
        return true;
      } else {
        Serial.println("⚠️ Failed to convert image.");
        return false;
      }
    }
    delay(200);
  }
  Serial.println("⏱️ Timed out waiting for finger.");
  return false;
}

void matchFingerprint() {
  Serial.println("🔍 Match mode active. Place a finger to scan.");
  Serial.println("🔄 Press 'q' to quit match mode.\n");

  while (true) {
    if (Serial.available()) {
      char exitCommand = Serial.read();
      if (exitCommand == 'q') {
        Serial.println("🚪 Exiting match mode.\n");
        return;
      }
    }

    if (finger.getImage() != FINGERPRINT_OK) {
      delay(100);
      continue;
    }

    if (finger.image2Tz(1) != FINGERPRINT_OK) {
      Serial.println("❌ Failed to convert image.");
      continue;
    }

    if (finger.fingerFastSearch() == FINGERPRINT_OK) {
      int id = finger.fingerID;
      if (id >= 1 && id <= MAX_USERS) {
        Serial.print("🎉 Match found! ID: ");
        Serial.print(id);
        Serial.print(" - ");
        Serial.print(names[id]);
        Serial.print(" | Confidence: ");
        Serial.println(finger.confidence);
      } else {
        Serial.print("⚠️ Match found for unknown ID: ");
        Serial.println(id);
      }
    } else {
      Serial.println("❌ No match found.");
    }

    delay(2000); // Delay before next scan
    Serial.println("🔍 Waiting for finger...");
  }
}

void resetFingerprintDatabase() {
  if (finger.emptyDatabase() == FINGERPRINT_OK) {
    Serial.println("🗑️ Database cleared.");
  } else {
    Serial.println("❌ Failed to clear DB.");
  }
}

void countFingerprints() {
  int count = 0;
  for (int id = 1; id <= MAX_USERS; id++) {
    if (finger.loadModel(id) == FINGERPRINT_OK) count++;
  }
  Serial.print("📦 Total fingerprints stored: ");
  Serial.println(count);
}
