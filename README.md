# 🚗 My Car Detector

Web app to recognize my car using Teachable Machine + TensorFlow.js

## Features

- 📱 Mobile-friendly responsive design
- 🎥 Real-time webcam feed
- 🤖 Teachable Machine model integration
- ✅ Visual feedback (green for match, red for no match)
- 📊 Confidence percentage display
- 🔴 Start/Stop button

## How to Use

1. Open `index.html` in a web browser
2. **Important:** The app requires HTTPS or localhost to access the camera
3. Click "Запустить" (Start) to begin detection
4. Point your camera at your car
5. The app will show:
   - ✅ Green overlay "Это твоя тачка!" if confidence >= 80%
   - ❌ Red overlay "Не она" if confidence < 80%
6. Click "Остановить" (Stop) to pause detection

## Local Development

### Option 1: Python HTTP Server
```bash
python3 -m http.server 8080
```
Then open: `http://localhost:8080/index.html`

### Option 2: Node.js HTTP Server
```bash
npx http-server
```

### Option 3: VS Code Live Server
Install the "Live Server" extension and click "Go Live"

## Technical Details

- **Model URL:** `https://teachablemachine.withgoogle.com/models/L00hgPrz-/`
- **Threshold:** 80% confidence
- **Webcam Resolution:** 400x400
- **Libraries:** TensorFlow.js & Teachable Machine Image (from CDN)

## Model Configuration

You can configure which class represents your car in `app.js`:
```javascript
const MY_CAR_CLASS = null; // null = auto-detect (uses first class)
// or
const MY_CAR_CLASS = 'MyCarClassName'; // specific class name
```

## Browser Compatibility

- Chrome/Edge (recommended)
- Safari (iOS/macOS)
- Firefox
- Any modern browser with WebRTC support

## Security Note

Camera access requires:
- HTTPS connection OR
- localhost domain

File protocol (`file://`) will not work due to browser security restrictions.