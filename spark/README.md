# SPARK: website + Android app

```
spark/
  site/       -> the website (Netlify): index.html, leaderboard backend, sw.js
  spark-app/  -> Android wrapper (Capacitor) with background step counter
  .github/    -> builds the APK in the cloud
```

## 1. Put the website live (Netlify)
1. Install Node.js 20+.
2. In `site/` run: `npm install` then `npx netlify deploy --prod`
   (first time it asks you to log in and create a site). Note the URL, e.g. https://spark-subhasis.netlify.app
3. Open `site/index.html`, find `const SITE='https://YOUR-SITE.netlify.app'` and put your real URL. Deploy again.
   Do NOT use drag-and-drop for this site: it can't install the leaderboard function's dependency.

## 2. Build the APK (no Android Studio needed)
1. Create a private GitHub repo and push the whole `spark/` folder.
2. One time, make a signing key so future updates install over old ones (needs Java):
   `keytool -genkeypair -keystore spark-app/debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"`
   Commit `debug.keystore`.
3. GitHub > Actions > "Build SPARK APK" > Run workflow. Download the `SPARK-apk` artifact, unzip, rename `app-debug.apk` to `spark.apk`.
4. Put `spark.apk` in `site/` and run `npx netlify deploy --prod` again. The website's "Download APK" button now works.

Local build instead: in `spark-app/` run `npm install`, `npm run setup`, then `cd android && ./gradlew assembleDebug` (Windows: `gradlew.bat assembleDebug`). Needs JDK 21 and Android SDK.
After editing `site/index.html`, rebuild the APK so the app gets the changes.

## 3. How a user installs and runs the APK
1. Open the website on the phone, tap Download APK (or send the file by WhatsApp).
2. Open the file. If Android asks, allow "Install unknown apps" for that browser/app.
3. Open SPARK, finish setup, and Allow "Physical activity" and "Notifications" when asked.
4. Keep the "SPARK is counting your steps" notification. On Xiaomi/Oppo/Vivo/Realme/Samsung also: Profile > Battery settings > set SPARK to Unrestricted/No restrictions, and enable Autostart.
