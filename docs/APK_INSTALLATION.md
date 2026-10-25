# Android APK Build & Installation Guide

This guide describes how to generate, download, and install the YatriBus Android Debug APK on any compatible Android smartphone (Android 7.0 / API 24 or newer).

---

## 1. Automated APK Build via GitHub Actions (Recommended)

You do **not** need Android Studio installed on your computer. GitHub Actions compiles the Android APK in the cloud.

### Step 1: Push Code to GitHub
1. Create a new repository on GitHub (e.g., `your-username/yatri-smart-bus`).
2. Push your project code:
   ```bash
   git init
   git add .
   git commit -m "feat: complete YatriBus platform with Android build workflow"
   git remote add origin https://github.com/your-username/yatri-smart-bus.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Download the Compiled APK Artifact
1. Open your repository on GitHub in a web browser.
2. Click on the **Actions** tab at the top.
3. In the left sidebar, click **Build Android Debug APK**.
4. Select the latest completed workflow run (marked with a green checkmark).
5. Scroll down to the **Artifacts** section at the bottom of the summary page.
6. Click on **`yatribus-debug-apk`** to download the zip archive containing `app-debug.apk`.

---

## 2. Installing the APK on Your Android Device

### Step 1: Transfer APK to Your Phone
- Unzip the downloaded file to extract `app-debug.apk`.
- Transfer `app-debug.apk` to your phone via USB cable, Google Drive, WhatsApp, Telegram, or email.

### Step 2: Enable "Install Unknown Apps"
Because this is a development/debug build not installed via the Google Play Store, Android requires one-time permission:
1. Tap on `app-debug.apk` in your phone's File Manager or Downloads app.
2. If Android displays a security prompt saying *"For your security, your phone is not allowed to install unknown apps from this source"*:
   - Tap **Settings** in the dialog.
   - Toggle **Allow from this source** to ON.
   - Press the back button to return to the installer.
3. Tap **Install**.
4. Once installation completes, tap **Open**.

---

## 3. Local Android Build (Optional, for Android Developers)

If you have Android Studio and the Android SDK installed locally:
1. Build the web bundle:
   ```bash
   npm run build
   ```
2. Sync Capacitor native files:
   ```bash
   npx cap sync android
   ```
3. Build debug APK using Gradle wrapper:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
4. Find the built APK at:
   `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 4. Generating a Signed Production Release APK / AAB
For production release on the Google Play Store:
1. Generate an upload keystore:
   ```bash
   keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-alias
   ```
2. Set environment secrets in GitHub Actions (`ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`).
3. Never commit keystores or signing passwords to public git repositories!
