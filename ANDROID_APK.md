# Android APK Build

This project uses Capacitor to wrap the React/Vite website as an Android app.

## What Is Already Set Up

- Capacitor config: `capacitor.config.json`
- Native Android project: `android/`
- Android app id: `com.georgianking.app`
- Android app name: `Georgian King`
- The game screen locks to landscape mode; other screens use normal orientation
- APK helper scripts are in `package.json`

## What You Need To Install

1. Install Android Studio.
2. In Android Studio, install:
   - Android SDK
   - Android SDK Platform-Tools
   - Android SDK Build-Tools
   - Android Emulator, if you want to test without a phone
3. Install a JDK if Android Studio does not add one automatically.
   - Android Studio usually includes a bundled JDK.
   - If the terminal says `java` is not recognized, add Android Studio's bundled JDK `bin` folder to your Windows PATH.

## Build From VS Code / Visual Studio Terminal

Run this from the project folder:

```bash
npm install
npm run android:apk
```

The debug APK will be created here:

```text
GeorgianKing-debug.apk
```

Gradle also creates the original APK here:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

You can also use `Terminal > Run Task` in VS Code and choose:

- `Android: Sync Web App`
- `Android: Open Studio`
- `Android: Build Debug APK`
- `Android: Run On Device`

## Open In Android Studio

Run:

```bash
npm run android:open
```

Then in Android Studio:

1. Wait for Gradle sync to finish.
2. Choose a connected phone or emulator.
3. Press Run to install and test.
4. To create an APK manually, use `Build > Build Bundle(s) / APK(s) > Build APK(s)`.

## After Website Changes

Every time you change the React app, sync it into Android:

```bash
npm run android:sync
```

Then build or run the Android app again.

## Notes

- Email/password Firebase auth should work normally.
- Google sign-in in the APK needs the Firebase Android setup in `FIREBASE_ANDROID_GOOGLE.md`.
- For a Play Store release APK/AAB, create a signed build in Android Studio.
- If `java` is not in PATH, the APK script uses Android Studio's bundled JDK automatically.
