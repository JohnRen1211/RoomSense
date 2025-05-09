//Enroll version 1.2
// Codes Fingerprint names hardcoded
#include <Adafruit_Fingerprint.h>

#define RX_PIN 16
#define TX_PIN 17
#define RESET_BUTTON_PIN 12

HardwareSerial mySerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

const int MAX_USERS = 5;
String names[MAX_USERS + 1] = { "", "John", "Rolito", "Jorly", "Diana", "Eve" }; // IDs 1–5

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
  Serial.println("[e] Enroll | [m] Match | [r] Reset DB | [c] Count | [V] View");
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
  Serial.println("⚠️ Are you sure you want to clear the fingerprint database?");
  Serial.println("Type 'yes' to confirm or any other key to cancel:");

  // Flush previous input
  while (Serial.available()) Serial.read();

  delay(100); // ✅ Add this delay to ensure prompt is printed before waiting

  // Wait for user input
  while (!Serial.available());

  String input = Serial.readStringUntil('\n');
  input.trim();

  if (input.equalsIgnoreCase("yes")) {
    resetFingerprintDatabase();
  } else {
    Serial.println("❎ Cancelled. Database not cleared.");
  }
}


    else if (command == 'c') {
      countFingerprints();
    }
    else if (command == 'v') {  // Trigger view registered fingerprints
      viewRegisteredFingerprints();
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
      Serial.println("❌ Error to store fingerprint.");
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
        Serial.println("⚠️ Error to convert image.");
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

  while (true) {
    // Allow cancellation with 'q'
    if (Serial.available() && Serial.peek() == 'q') {
      Serial.read();
      Serial.println("🚪 Enrollment canceled.\n");
      return false;
    }

    int p = finger.getImage();
    if (p == FINGERPRINT_OK) {
      int c = finger.image2Tz(bufferId);
      if (c == FINGERPRINT_OK) {
        Serial.println("📸 Image captured.");
        return true;
      } else {
        Serial.println("⚠️ Error converting image. Try again...");
        delay(500); // slight delay before retrying
        continue;
      }
    } else if (p == FINGERPRINT_NOFINGER) {
      // do nothing, wait for finger
    } else if (p == FINGERPRINT_PACKETRECIEVEERR) {
      Serial.println("⚠️ Communication error. Retrying...");
    } else {
      Serial.println("⚠️ Unknown error. Retrying...");
    }

    delay(200); // slight delay before retrying
  }
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
      Serial.println("❌ Error to convert image.");
      continue;
    }

    if (finger.fingerFastSearch() == FINGERPRINT_OK) {
      int id = finger.fingerID;
      if (id >= 1 && id <= MAX_USERS) {
        // Separate the ID and Name into two lines
        Serial.println("ID: " + String(id));         // Line 1: Show ID
        Serial.println("Name: " + names[id]);       // Line 2: Show Name
        Serial.print("Confidence: ");
        Serial.println(finger.confidence);
      } else {
        Serial.println("⚠️ Match found for unknown ID: ");
        Serial.println(id);
      }
    } else {
      Serial.println("❌ No match found.");
    }

    delay(2000); // Delay before next scan
    Serial.println("🔍 Waiting for finger...");
  }
}

void viewRegisteredFingerprints() {
  Serial.println("\n--- Registered Fingerprints ---");
  bool anyRegistered = false;

  // Iterate through all possible IDs (1 to MAX_USERS)
  for (int id = 1; id <= MAX_USERS; id++) {
    if (finger.loadModel(id) == FINGERPRINT_OK) {  // Check if the fingerprint for this ID exists
      Serial.print("ID: ");
      Serial.print(id);                       // Show the ID
      Serial.print(" - Name: ");
      Serial.println(names[id]);              // Show the Name
      anyRegistered = true;
    }
  }

  if (!anyRegistered) {
    Serial.println("❌ No fingerprints registered.");
  }
}


void resetFingerprintDatabase() {
  if (finger.emptyDatabase() == FINGERPRINT_OK) {
    Serial.println("🗑️ Database successfully cleared.");
  } else {
    Serial.println("❌ Error to clear DB.");
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
