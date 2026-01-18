# 🐟 Pond Monitor System

A real-time IoT monitoring system for aquaculture ponds using ESP32, displaying water quality parameters (Temperature, pH, and TDS) on a beautiful web dashboard.

![Dashboard Preview](https://img.shields.io/badge/Status-Active-success) ![Platform](https://img.shields.io/badge/Platform-ESP32-blue) ![License](https://img.shields.io/badge/License-MIT-green)

## 📊 Live Dashboard

**[View Live Dashboard →](https://hzqmo.github.io/pond-monitor/pond-dashboard.html)**



---

## ✨ Features

- 🌡️ **Real-time Temperature Monitoring** (DS18B20 sensor)
- 💧 **pH Level Tracking** (Analog pH sensor)
- 📊 **TDS Measurement** (Total Dissolved Solids)
- 📱 **Mobile-Friendly Dashboard** (responsive design)
- 🔔 **Audio Alarm** (triggers when temperature exceeds threshold)
- 📈 **Historical Data Charts** (24-hour temperature graph)
- ☁️ **Cloud Data Storage** (Google Sheets integration)
- 🖥️ **OLED Display** (local monitoring)
- 🔄 **Auto-Refresh** (dashboard updates every 30 seconds)

---

## 🛠️ Hardware Components

| Component | Model/Type | Purpose |
|-----------|------------|---------|
| Microcontroller | ESP32 DevKit | Main controller with WiFi |
| Temperature Sensor | DS18B20 (Waterproof) | Water temperature measurement |
| pH Sensor | Analog pH Sensor | Water pH level measurement |
| TDS Sensor | Analog TDS Meter | Water quality (dissolved solids) |
| Display | SSD1306 OLED (128x64) | Local data display |
| Buzzer | Active Buzzer | Temperature alarm |
| Resistor | 4.7kΩ | Pull-up for DS18B20 |

---

## 🔌 Wiring Diagram

```
ESP32 Pin Connections:
├── GPIO 4  → DS18B20 Data Pin (with 4.7kΩ pull-up to 3.3V)
├── GPIO 18 → Buzzer Positive
├── GPIO 34 → TDS Sensor Analog Output
├── GPIO 35 → pH Sensor Analog Output
├── GPIO 21 → OLED SDA
├── GPIO 22 → OLED SCL
├── 3.3V    → Sensors VCC & OLED VCC
└── GND     → All Grounds
```

### Detailed Connections:

**DS18B20 Temperature Sensor:**
- Red (VCC) → ESP32 3.3V
- Black (GND) → ESP32 GND
- Yellow (Data) → ESP32 GPIO 4
- 4.7kΩ resistor between Data and VCC

**pH Sensor:**
- VCC → ESP32 5V (or 3.3V depending on sensor)
- GND → ESP32 GND
- Analog Out → ESP32 GPIO 35

**TDS Sensor:**
- VCC → ESP32 5V (or 3.3V depending on sensor)
- GND → ESP32 GND
- Analog Out → ESP32 GPIO 34

**OLED Display (I2C):**
- VCC → ESP32 3.3V
- GND → ESP32 GND
- SDA → ESP32 GPIO 21
- SCL → ESP32 GPIO 22

**Buzzer:**
- Positive → ESP32 GPIO 18
- Negative → ESP32 GND

---

## 📦 Software Requirements

### Arduino Libraries (Install via Library Manager)

```cpp
- WiFi (built-in)
- HTTPClient (built-in)
- BlynkSimpleEsp32
- Adafruit GFX Library
- Adafruit SSD1306
- OneWire
- DallasTemperature
```

### External Services

- **Google Sheets** - Data storage (free)
- **Google Apps Script** - Data logger (free)
- **GitHub Pages** - Dashboard hosting (free)
- **Blynk** (optional) - Mobile app monitoring

---

## 🚀 Quick Start Guide

### 1. Hardware Setup
1. Connect all sensors according to the wiring diagram above
2. Double-check all connections (especially polarity!)
3. Ensure 4.7kΩ pull-up resistor is connected for DS18B20

### 2. Google Sheets Setup

**Create Data Logger:**
1. Create a new [Google Sheet](https://sheets.google.com)
2. Open **Extensions → Apps Script**
3. Paste the Google Apps Script code (see `google-apps-script.js`)
4. Deploy as **Web App** (Execute as: Me, Access: Anyone)
5. Copy the **Web App URL**

**Publish Sheet as CSV:**
1. Click **File → Share → Publish to web**
2. Select **SensorData** sheet
3. Choose **Comma-separated values (.csv)**
4. Click **Publish** and copy the CSV URL

### 3. ESP32 Configuration

1. Open `esp32-pond-monitor.ino` in Arduino IDE
2. Update WiFi credentials:
   ```cpp
   char ssid[] = "YOUR_WIFI_SSID";
   char pass[] = "YOUR_WIFI_PASSWORD";
   ```
3. Update Google Script URL:
   ```cpp
   String GOOGLE_SCRIPT_URL = "YOUR_WEB_APP_URL";
   ```
4. Enable/disable sensors as needed:
   ```cpp
   #define ENABLE_PH_SENSOR true   // Set to false if not connected
   #define ENABLE_TDS_SENSOR true  // Set to false if not connected
   ```
5. Upload to ESP32

### 4. Dashboard Setup

1. Open `pond-dashboard.html`
2. Update the CSV URL (line ~193):
   ```javascript
   const SHEET_CSV_URL = 'YOUR_GOOGLE_SHEET_CSV_URL';
   ```
3. Upload to this GitHub repository
4. Enable **GitHub Pages** in repository settings
5. Access dashboard at: `https://YOUR-USERNAME.github.io/pond-monitor/pond-dashboard.html`

---

## ⚙️ Configuration

### Temperature Alarm Threshold
```cpp
#define TEMP_THRESHOLD 32.0  // Temperature in Celsius
```

### pH Sensor Calibration
```cpp
float ph4Voltage = 2.03;  // Voltage reading at pH 4.0
float ph7Voltage = 1.65;  // Voltage reading at pH 7.0
```

**How to Calibrate:**
1. Place pH probe in pH 7.0 buffer solution
2. Read voltage from Serial Monitor
3. Update `ph7Voltage` value
4. Repeat with pH 4.0 buffer solution
5. Update `ph4Voltage` value

### Dashboard Alert Thresholds

Edit in `pond-dashboard.html`:
```javascript
const TEMP_MIN = 20;    // Minimum safe temperature (°C)
const TEMP_MAX = 32;    // Maximum safe temperature (°C)
const PH_MIN = 6.5;     // Minimum safe pH
const PH_MAX = 8.5;     // Maximum safe pH
const TDS_MIN = 300;    // Minimum safe TDS (ppm)
const TDS_MAX = 800;    // Maximum safe TDS (ppm)
```

### Data Upload Frequency
```cpp
unsigned long googleSheetsInterval = 30000; // 30 seconds (30000ms)
```

---

## 📱 Using the Dashboard

### On Desktop/Laptop:
- Open the dashboard URL in any browser
- Auto-refreshes every 30 seconds
- Click "Refresh Now" for manual update

### On Mobile:
1. Open dashboard URL in mobile browser
2. **Add to Home Screen** for app-like experience:
   - **Android**: Chrome menu → "Add to Home screen"
   - **iPhone**: Share button → "Add to Home Screen"
3. Icon appears on home screen like a native app!

---

## 📊 Data Flow

```
ESP32 Sensors
    ↓
WiFi Connection
    ↓
Google Apps Script (Web App)
    ↓
Google Sheets (Data Storage)
    ↓
Published CSV Feed
    ↓
Web Dashboard (Auto-refresh)
    ↓
User's Phone/Computer
```

---

## 🔧 Troubleshooting

### ESP32 Issues

**WiFi Won't Connect:**
- Verify SSID and password are correct
- Ensure using 2.4GHz WiFi (ESP32 doesn't support 5GHz)
- Check router is in range

**Sensors Reading 0 or Invalid Values:**
- Check wiring connections
- Verify sensor power (3.3V or 5V as required)
- Enable sensors in code (`ENABLE_PH_SENSOR` / `ENABLE_TDS_SENSOR`)
- For DS18B20: ensure 4.7kΩ pull-up resistor is installed

**Data Not Sending to Google Sheets:**
- Verify Google Apps Script URL is correct
- Check deployment is set to "Anyone" can access
- Look for error codes in Serial Monitor

### Dashboard Issues

**Dashboard Shows "Error loading data":**
- Verify Google Sheet is published as CSV
- Check CSV URL in dashboard code is correct
- Ensure "SensorData" sheet exists and has data

**Charts Not Displaying:**
- Check internet connection (Chart.js needs to load)
- Verify at least 2 rows of data exist

**Data Not Updating:**
- Check ESP32 is powered and sending data
- Wait 30 seconds for auto-refresh
- Click "Refresh Now" button
- Clear browser cache if needed

---

## 📈 Future Enhancements

- [ ] SMS/Email alerts for critical values
- [ ] Multi-pond monitoring support
- [ ] Historical data analysis (weekly/monthly reports)
- [ ] Automated feeding schedules
- [ ] Dissolved oxygen (DO) sensor integration
- [ ] Solar power option for remote ponds
- [ ] Machine learning predictions for water quality

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Your Name**
- GitHub: [@Hzqmo](https://github.com/Hzqmo)
- Email: haziqmohd65@gmail.com

---

## 🙏 Acknowledgments

- Thanks to the open-source community
- Blynk for IoT platform inspiration
- Google for free cloud services
- Arduino and ESP32 communities



## 📞 Support

If you find this project helpful, please consider:
- ⭐ Starring this repository
- 🐛 Reporting bugs
- 💡 Suggesting improvements
- 📢 Sharing with others

---

**Made with ❤️ for sustainable aquaculture**
