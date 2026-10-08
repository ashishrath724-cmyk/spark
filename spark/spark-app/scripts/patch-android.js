// Run once after `npx cap add android`. Adds the step-counter plugin, foreground service and permissions.
const fs = require("fs"), path = require("path");
const pkgDir = "android/app/src/main/java/com/subhasis/spark";
fs.mkdirSync(pkgDir, { recursive: true });
const W = (n, s) => fs.writeFileSync(path.join(pkgDir, n), s);

W("MainActivity.java", `package com.subhasis.spark;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
  @Override public void onCreate(Bundle b) { registerPlugin(StepCounterPlugin.class); super.onCreate(b); }
}
`);

W("StepCounterPlugin.java", `package com.subhasis.spark;
import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.app.NotificationManager;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import org.json.JSONObject;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(name = "StepCounter", permissions = {
  @Permission(alias = "activity", strings = { Manifest.permission.ACTIVITY_RECOGNITION }),
  @Permission(alias = "notif", strings = { "android.permission.POST_NOTIFICATIONS" })
})
public class StepCounterPlugin extends Plugin {
  @PluginMethod public void start(PluginCall c) {
    SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
    boolean ok = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null;
    if (ok) { try { ContextCompat.startForegroundService(getContext(), new Intent(getContext(), StepService.class)); } catch (Exception e) { } }
    JSObject r = new JSObject(); r.put("supported", ok); c.resolve(r);
  }
  @PluginMethod public void getDays(PluginCall c) {
    SharedPreferences p = getContext().getSharedPreferences("spark_steps", 0);
    try { JSObject r = new JSObject(); r.put("days", new JSObject(p.getString("days", "{}"))); c.resolve(r); }
    catch (Exception e) { c.reject("Could not read steps"); }
  }
  @PluginMethod public void setTotal(PluginCall c) {
    try {
      String d = c.getString("d", ""); int n = c.getInt("n", 0);
      SharedPreferences p = getContext().getSharedPreferences("spark_steps", 0);
      int nat = new JSONObject(p.getString("days", "{}")).optInt(d, 0);
      p.edit().putString("offDate", d).putInt("off", n - nat).apply();
      if (p.getLong("last", -1) >= 0) ((NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE)).notify(1, StepService.note(getContext(), n));
      c.resolve();
    } catch (Exception e) { c.reject("setTotal failed"); }
  }
  @PluginMethod public void saveFile(PluginCall c) {
    try {
      String name = c.getString("name"), mime = c.getString("mime", "application/octet-stream");
      byte[] bytes = android.util.Base64.decode(c.getString("data"), android.util.Base64.DEFAULT);
      if (Build.VERSION.SDK_INT < 29) { c.reject("Saving needs Android 10 or newer. Use Share instead."); return; }
      boolean img = mime.startsWith("image/");
      ContentValues v = new ContentValues();
      v.put(MediaStore.MediaColumns.DISPLAY_NAME, name); v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
      v.put(MediaStore.MediaColumns.RELATIVE_PATH, img ? Environment.DIRECTORY_PICTURES + "/SPARK" : Environment.DIRECTORY_DOWNLOADS);
      Uri u = getContext().getContentResolver().insert(img ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI : MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
      try (java.io.OutputStream o = getContext().getContentResolver().openOutputStream(u)) { o.write(bytes); }
      c.resolve();
    } catch (Exception e) { c.reject("Save failed"); }
  }
  @PluginMethod public void openBatterySettings(PluginCall c) {
    Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(i); c.resolve();
  }
}
`);

W("StepService.java", `package com.subhasis.spark;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Iterator;
import java.util.Locale;
import java.util.TreeSet;
import org.json.JSONObject;

public class StepService extends Service implements SensorEventListener {
  SharedPreferences p; SensorManager sm; long lastNote = 0;
  @Override public void onCreate() {
    super.onCreate();
    p = getSharedPreferences("spark_steps", 0); sm = (SensorManager) getSystemService(SENSOR_SERVICE);
    if (Build.VERSION.SDK_INT >= 26)
      getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel("spark_steps", "Step counting", NotificationManager.IMPORTANCE_LOW));
  }
  String dk() { return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date()); }
  int off(String k) { return k.equals(p.getString("offDate", "")) ? p.getInt("off", 0) : 0; }
  int today() { try { return new JSONObject(p.getString("days", "{}")).optInt(dk(), 0) + off(dk()); } catch (Exception e) { return 0; } }
  Notification note(int n) { return note(this, n); }
  static Notification note(android.content.Context c, int n) {
    PendingIntent pi = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, "spark_steps") : new Notification.Builder(c);
    return b.setSmallIcon(c.getApplicationInfo().icon).setContentTitle("SPARK is counting your steps")
      .setContentText(String.format(Locale.US, "%,d steps today", n)).setContentIntent(pi).setOngoing(true).setOnlyAlertOnce(true).build();
  }
  @Override public int onStartCommand(Intent i, int f, int id) {
    if (Build.VERSION.SDK_INT >= 34) startForeground(1, note(today()), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH);
    else startForeground(1, note(today()));
    Sensor s = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
    if (s != null) { sm.unregisterListener(this); sm.registerListener(this, s, SensorManager.SENSOR_DELAY_NORMAL, 2000000); }
    return START_STICKY;
  }
  @Override public void onSensorChanged(SensorEvent e) {
    long raw = (long) e.values[0], last = p.getLong("last", -1);
    long d = last < 0 ? 0 : (raw >= last ? raw - last : raw);   // counter resets to 0 on reboot
    try {
      JSONObject o = new JSONObject(p.getString("days", "{}")); String k = dk();
      if (d > 0) o.put(k, o.optInt(k, 0) + (int) d);
      TreeSet<String> ks = new TreeSet<>(); for (Iterator<String> it = o.keys(); it.hasNext();) ks.add(it.next());
      while (ks.size() > 45) o.remove(ks.pollFirst());
      p.edit().putLong("last", raw).putString("days", o.toString()).apply();
      long now = SystemClock.elapsedRealtime();
      if (d > 0 && now - lastNote > 3000) { lastNote = now; getSystemService(NotificationManager.class).notify(1, note(o.optInt(k, 0) + off(k))); }
    } catch (Exception x) { }
  }
  @Override public void onAccuracyChanged(Sensor s, int a) { }
  @Override public void onDestroy() { sm.unregisterListener(this); super.onDestroy(); }
  @Override public IBinder onBind(Intent i) { return null; }
}
`);

W("BootReceiver.java", `package com.subhasis.spark;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;
public class BootReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context c, Intent i) {
    try { if (c.getSharedPreferences("spark_steps", 0).getLong("last", -1) >= 0) ContextCompat.startForegroundService(c, new Intent(c, StepService.class)); } catch (Exception e) { }
  }
}
`);

const mf = "android/app/src/main/AndroidManifest.xml";
let m = fs.readFileSync(mf, "utf8");
if (!m.includes("StepService")) {
  const perms = ["ACTIVITY_RECOGNITION", "FOREGROUND_SERVICE", "FOREGROUND_SERVICE_HEALTH", "POST_NOTIFICATIONS", "RECEIVE_BOOT_COMPLETED", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"]
    .map((p) => `    <uses-permission android:name="android.permission.${p}" />\n`).join("");
  m = m.replace("<application", perms + '    <uses-feature android:name="android.hardware.location.gps" android:required="false" />\n    <application');
  m = m.replace("</application>", `        <service android:name=".StepService" android:exported="false" android:foregroundServiceType="health" />
        <receiver android:name=".BootReceiver" android:exported="true">
            <intent-filter><action android:name="android.intent.action.BOOT_COMPLETED" /></intent-filter>
        </receiver>
    </application>`);
  fs.writeFileSync(mf, m);
}
console.log("Android project patched.");
