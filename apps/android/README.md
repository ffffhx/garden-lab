# Garden Lab Android

An online reader for `https://ffffhx.github.io/garden-lab/`. It uses Android's
system WebView and does not bundle article HTML, JavaScript or images from the
site. Publishing the site updates what the app loads without rebuilding the APK.

- Package: `com.gardenlab.online`, version `0.3.1` (code `3`).
- Android 8+; the system Android WebView must be enabled.
- A fresh launch loads the online page. Returning after at least 60 seconds
  reloads the current Garden page and attempts to restore the scroll position.
- The toolbar provides refresh, home, open-in-browser, and check-for-update actions.
- Offline availability is limited to the website's existing service-worker cache.
  A first visit requires a connection. Failed navigation offers a retry button.
- Author sign-in has its own WebView storage. Chrome and the retired app's login
  state are not migrated. Author sign-in requires a separate end-to-end check.
- External article/project links open in the system browser. Garden's API and
  GitHub login redirects stay in the WebView. No native JavaScript bridge, file
  access, cleartext traffic, or certificate-error bypass is enabled.

## Build

Install JDK 17+, Android SDK platform 37 and the SDK build tools. Set `JAVA_HOME`
and `ANDROID_HOME`, or specify `sdk.dir` in an untracked `local.properties`.

For release signing, create an untracked `keystore.properties`:

```properties
storeFile=C:/path/outside/repository/release.jks
storePassword=YOUR_PRIVATE_PASSWORD
keyAlias=garden-lab
keyPassword=YOUR_PRIVATE_PASSWORD
```

Keep the keystore and credentials backed up securely: future updates require the
same signing key. The initial local signing material is in
`%USERPROFILE%/.android/garden-lab-online/` and is not committed.

```powershell
./gradlew.bat assembleRelease testDebugUnitTest lintRelease
```

Output: `app/build/outputs/apk/release/app-release.apk`. Without signing properties,
Gradle produces an unsigned release APK; use `assembleDebug` for local development.

## Install / update

```powershell
adb install -r app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.gardenlab.online/.MainActivity
```

This package intentionally differs from the retired Tauri package
`com.gardenlab.blog`: its original signing key was unavailable. Install and verify
the online app before removing the old one. Uninstalling the old app removes its
local data and requires the user's authorization.

## In-app updates

The app checks `https://ffffhx.github.io/garden-lab/android/update.json` on opening
or resuming, at most once every six hours after a successful check. Failures retry
after 15 minutes. Manual checks always bypass the interval. A newer version shows
its version, size and release notes with a **Download and install** button.
Choosing **Later** snoozes automatic prompts for that version for 24 hours.

Checks and prompts run while the app is open; there is no background push service.
The app never downloads or installs an APK without the user's action. Android's
per-app install permission and final installation confirmation remain required.
The permission settings round-trip resumes installation, including after process
recreation. Downloaded APKs survive restarts; incomplete downloads can be retried.
Downloads are size-limited and checked against SHA-256, package name, numeric
version, Android compatibility and the installed app's signing certificate.
The non-exported FileProvider shares only the update directory with the installer.

Website content still updates on navigation/reload without an APK. APK updates
replace the existing package and preserve its data.

## Publish the next Android version

1. Increase both `versionCode` and `versionName` in `app/build.gradle.kts`, and update
   `release-notes.md`. Build and run the checks above with the existing release key.
2. Run `python scripts/prepare-release.py` from this directory. It validates the
   APK signature, reads its actual version, copies the APK into ignored `dist/`,
   and generates `../site/public/android/update.json` with its hash and size.
3. Commit the Android source and generated public manifest. Create and push a tag
   `android-vX.Y.Z` at that commit. Publish the APK **before** pushing the manifest
   commit to `main`, so the app never sees metadata for an unavailable download:

   ```powershell
   gh release create android-vX.Y.Z dist/Garden-Lab-X.Y.Z.apk --verify-tag --title "Garden Lab Android X.Y.Z" --notes-file release-notes.md
   git push origin main
   ```

4. Wait for the existing GitHub Pages deployment, then verify the public manifest,
   APK hash, and an in-app manual update check. Publishing a GitHub release alone
   does not update the website manifest. Never replace an APK under an existing
   version tag; publish a higher version instead.

The first end-to-end test uses the locally installed 0.3.0 bootstrap (code 2) to
download and install the published 0.3.1 release (code 3). The original 0.2.0 did
not contain an updater and requires one initial USB/manual installation.
