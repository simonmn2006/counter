#define SENSOR_PIN 2  // The digital pin where the sensor is connected
bool lastState = LOW; // To track state changes

void setup() {
  // CRITICAL: Baud rate must be 115200 to match the server
  Serial.begin(115200);  
  pinMode(SENSOR_PIN, INPUT);
  
  // Initial state sync
  lastState = digitalRead(SENSOR_PIN);
  sendState(lastState);
}

void loop() {
  bool currentState = digitalRead(SENSOR_PIN);
  
  // Only send a message if the state has changed
  if (currentState != lastState) {
    sendState(currentState);
    lastState = currentState;
    delay(50); // Small debounce delay
  }
}

void sendState(bool state) {
  if (state == HIGH) {
    // These strings match exactly what the server logic expects
    Serial.println("activated");
  } else {
    Serial.println("deactivated");
  }
}
