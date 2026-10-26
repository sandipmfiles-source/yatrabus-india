# YatraBus India: Android APK Build & Installation Guide

This guide walks you through building and installing the **YatraBus India** Android App directly from GitHub Actions without needing Android Studio installed locally.

---

## 1. Automated Cloud Build via GitHub Actions

The repository includes a ready-to-run GitHub Actions workflow (`.github/workflows/android-apk.yml`) that automatically compiles the web application into an installable Android APK file (`.apk`).

### Step-by-Step Instructions:

1. **Push Code to GitHub**:
   - Create a new repository on [GitHub](https://github.com/).
   - Push this workspace to your GitHub repository:
     ```bash
     git init
     git add .
     git commit -m "feat: complete India smart bus platform"
     git remote add origin https://github.com/<your-username>/<your-repo-name>.git
     git branch -M main
     git push -u origin main
     ```

2. **Trigger the APK Workflow**:
   - In your GitHub repository, click on the **Actions** tab at the top.
   - Select **Build Android APK** from the left sidebar.
   - Click the **Run workflow** button (or push any commit to `main`).

3. **Download the APK Artifact**:
   - Wait 3–4 minutes while GitHub Actions builds the project and runs the automated tests.
   - When the workflow run displays a green checkmark (`✔`), click on the run title.
   - Scroll down to the **Artifacts** section at the bottom.
   - Click on **`yatrabus-india-debug-apk`** to download the ZIP file containing the APK.

---

## 2. Installing the APK on Your Android Device

1. **Transfer the APK to Your Phone**:
   - Unzip the downloaded file to find `app-debug.apk`.
   - Send the `.apk` file to your Android phone via WhatsApp, Google Drive, Telegram, or USB cable.

2. **Enable Unknown Apps Permission**:
   - When you tap the `.apk` file, Android may display a prompt: *"For your security, your phone is not allowed to install unknown apps from this source."*
   - Tap **Settings** in the popup.
   - Toggle **Allow from this source** to ON.
   - Return to the previous screen and tap **Install**.

3. **Open YatraBus India**:
   - The app icon will appear on your home screen and app drawer.
   - Open the app and start searching bus routes immediately.

---

## 3. Location Permissions in the App

- When you open the app, no location permission is requested.
- If you click **"Are you travelling on this bus?"** and tap **"Enable Location & Start Sharing"**, Android will ask:
  *"Allow YatraBus India to access this device's location?"*
- Select **While using the app** (or **Allow all the time** if you wish to contribute background updates while travelling).
- You can stop sharing at any moment by tapping the red **"Stop Sharing Location"** button in the app.

---

## 4. Updating the App After Code Changes

Whenever you push new changes or bug fixes to GitHub:
1. The GitHub Actions workflow automatically builds a new APK.
2. Download the updated artifact from the Actions tab.
3. Tap the new `.apk` file on your phone—it will install cleanly as an in-place update without clearing your saved recent searches.
