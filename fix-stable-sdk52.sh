#!/bin/bash
cd /home/workdir/artifacts/obd2-pro

# Fix app.json
cat > app.json << 'EOL'
{
  "expo": {
    "name": "OBD2 Pro",
    "slug": "obd2-pro",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "obd2pro",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/images/icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#0A0A0A"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.obd2pro.app"
    },
    "android": {
      "package": "com.obd2pro.app",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/icon.png",
        "backgroundColor": "#0A0A0A"
      },
      "permissions": [
        "android.permission.BLUETOOTH",
        "android.permission.BLUETOOTH_ADMIN",
        "android.permission.BLUETOOTH_CONNECT",
        "android.permission.BLUETOOTH_SCAN",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.USB_PERMISSION"
      ]
    },
    "plugins": [
      ["expo-router", { "origin": "https://replit.com/" }],
      "expo-font",
      "expo-web-browser"
    ],
    "extra": {
      "eas": {
        "projectId": "0f2f1e25-fb90-4cb4-baba-ab4f4a06d5aa"
      }
    }
  }
}
EOL

# Fix package.json (stable versions)
cat > package.json << 'EOL'
{
  "name": "obd2-pro",
  "version": "1.0.0",
  "main": "expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "build": "eas build"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "react": "18.3.1",
    "react-native": "0.76.5",
    "react-native-bluetooth-classic": "^1.73.0-rc.17"
  },
  "devDependencies": {
    "@react-native-community/cli": "latest",
    "@react-native/metro-config": "^0.76.0",
    "@types/react": "~18.3.0"
  }
}
EOL

echo "✅ Stable SDK 52 configuration applied"
