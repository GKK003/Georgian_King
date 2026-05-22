# Firebase Android Google Login

Google login in the APK cannot use the normal website popup flow. The Android app needs its own Firebase Android app configuration.

## App Details

- Android package name: `com.georgianking.app`
- Debug SHA-1:

```text
D1:E5:A2:95:E2:E5:C8:F8:FF:26:AE:1F:B4:E4:16:FD:4F:F6:67:30
```

- Debug SHA-256:

```text
0C:4E:C2:20:A1:2B:14:40:1B:7C:7A:00:C3:11:7D:40:4F:0D:6D:84:EA:14:DC:B3:BE:33:2B:96:15:68:B2:A5
```

## Firebase Console Steps

1. Open Firebase Console.
2. Open project `king-game-de3f6`.
3. Go to `Project settings`.
4. In `Your apps`, add an Android app.
5. Use package name:

```text
com.georgianking.app
```

6. Add the SHA-1 above.
7. Download `google-services.json`.
8. Put it here:

```text
android/app/google-services.json
```

9. Make sure `Authentication > Sign-in method > Google` is enabled.
10. Rebuild:

```bash
npm run android:apk
```

11. Install the new APK on the phone:

```bash
C:\Users\Predator\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r GeorgianKing-debug.apk
```

## If SHA-1 Changes

Run:

```bash
npm run android:sha1
```

Use the SHA-1 from the `debug` variant.
