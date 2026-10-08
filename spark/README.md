# SPARK

```
spark/
  site/       -> the website (download page + About the dev) and the leaderboard server. Goes on Netlify.
  spark-app/  -> the real app. app/index.html is the app itself. GitHub turns it into the APK.
```
The website only offers the app download. The app is only inside the APK.

## Quick order of work
1. In spark-app/app/index.html set: const SITE='https://YOUR-SITE.netlify.app'  (your Netlify address)
2. Upload the spark folder to GitHub, run Actions > Build SPARK APK, download the APK, rename it spark.apk.
3. Put spark.apk in the site folder and deploy the site: npx netlify deploy --prod
