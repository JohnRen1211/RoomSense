// Code run
#define LED_PIN 2

void setup() {
  // Set the LED pin as an output
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);  // Turn the LED on
  delay(100);                  // Wait 1 second
  digitalWrite(LED_PIN, LOW);   // Turn the LED off
  delay(100);                  // Wait 1 second
}
//Code run successfully this