package com.gardenlab.online;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Foreground update checks. APKs are installed only after an explicit download/install action. */
final class AppUpdater {
    private static final long CHECK_INTERVAL = 6L * 60 * 60 * 1000;
    private final Activity activity;
    private final SharedPreferences prefs;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final File directory;
    private boolean busy, destroyed;
    private AlertDialog dialog;
    private Future<?> task;

    AppUpdater(Activity activity) {
        this.activity = activity;
        prefs = activity.getSharedPreferences("app_updates", Context.MODE_PRIVATE);
        directory = new File(activity.getFilesDir(), "updates");
    }

    void resume() {
        if (prefs.getBoolean("install_permission_pending", false)) {
            prefs.edit().remove("install_permission_pending").apply();
            try {
                UpdateInfo info = UpdateInfo.parse(prefs.getString("ready", ""));
                if (info.isNewerThan(BuildConfig.VERSION_CODE) && activity.getPackageManager().canRequestPackageInstalls()) {
                    prepareInstall(info);
                    return;
                }
            } catch (Exception ignored) { /* Manual check can download again. */ }
            toast("未获得安装权限，可通过“检查更新”重试");
            return;
        }
        check(false);
    }

    void check(boolean manual) {
        if (busy) { if (manual) toast("正在处理更新，请稍候"); return; }
        if (dialog != null && dialog.isShowing()) return;
        long now = System.currentTimeMillis(), previous = prefs.getLong("last_check", 0);
        if (!manual && now >= previous && now - previous < CHECK_INTERVAL) return;
        if (manual) toast("正在检查更新…");
        busy = true;
        task = worker.submit(() -> {
            try {
                UpdateInfo info = UpdateInfo.parse(UpdateDownload.manifest(BuildConfig.UPDATE_URL));
                prefs.edit().putLong("last_check", System.currentTimeMillis()).apply();
                ui(() -> {
                    busy = false;
                    if (!info.isNewerThan(BuildConfig.VERSION_CODE)) {
                        clearReady();
                        if (manual) message("已是最新版本", "当前版本 " + BuildConfig.VERSION_NAME);
                    } else if (info.minSdk > Build.VERSION.SDK_INT) {
                        if (manual) message("暂时无法更新", "新版本需要更新的 Android 系统。");
                    } else if (manual || prefs.getLong("snooze_version", 0) != info.versionCode
                            || System.currentTimeMillis() >= prefs.getLong("snooze_until", 0)) {
                        offer(info);
                    }
                });
            } catch (Exception error) {
                // A failed request retries sooner than the normal six-hour successful-check interval.
                prefs.edit().putLong("last_check", System.currentTimeMillis() - CHECK_INTERVAL + 15 * 60 * 1000).apply();
                ui(() -> { busy = false; if (manual) message("检查更新失败", friendly(error)); });
            }
        });
    }

    private void offer(UpdateInfo info) {
        boolean downloaded = apk(info).isFile();
        String details = "当前 " + BuildConfig.VERSION_NAME + " → " + info.versionName
                + String.format(Locale.CHINA, "\n安装包 %.2f MB", info.sizeBytes / 1048576.0)
                + (info.notes.trim().isEmpty() ? "" : "\n\n" + info.notes);
        dialog = new AlertDialog.Builder(activity).setTitle("发现新版本 " + info.versionName)
                .setMessage(details)
                .setPositiveButton(downloaded ? "安装更新" : "下载并安装", (d, which) -> {
                    if (downloaded) prepareInstall(info); else download(info);
                })
                .setNegativeButton("稍后", (d, which) -> snooze(info))
                .setOnCancelListener(d -> snooze(info)).create();
        dialog.show();
    }

    private void snooze(UpdateInfo info) {
        prefs.edit().putLong("snooze_version", info.versionCode)
                .putLong("snooze_until", System.currentTimeMillis() + 24L * 60 * 60 * 1000).apply();
    }

    private void download(UpdateInfo info) {
        if (busy) return;
        busy = true;
        AtomicBoolean cancelled = new AtomicBoolean();
        ProgressDialog progress = new ProgressDialog(activity);
        progress.setTitle("下载更新 " + info.versionName);
        progress.setProgressStyle(ProgressDialog.STYLE_HORIZONTAL);
        progress.setMax(100);
        progress.setCanceledOnTouchOutside(false);
        progress.setOnCancelListener(d -> cancelled.set(true));
        progress.setButton(ProgressDialog.BUTTON_NEGATIVE, "取消", (d, which) -> progress.cancel());
        dialog = progress;
        progress.show();
        task = worker.submit(() -> {
            File partial = new File(directory, "download.part");
            try {
                if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("无法创建下载目录");
                UpdateDownload.apk(info, partial, percent -> {
                    if (cancelled.get()) throw new CancellationException();
                    ui(() -> progress.setProgress(percent));
                });
                verify(partial, info);
                if (cancelled.get() || Thread.currentThread().isInterrupted()) throw new InterruptedIOException();
                Files.move(partial.toPath(), apk(info).toPath(), StandardCopyOption.REPLACE_EXISTING);
                prefs.edit().putString("ready", info.toJson()).apply();
                ui(() -> {
                    busy = false;
                    progress.dismiss();
                    if (!cancelled.get()) installVerified(info);
                });
            } catch (Exception error) {
                partial.delete();
                ui(() -> {
                    busy = false;
                    progress.dismiss();
                    if (!cancelled.get()) message("下载更新失败", friendly(error));
                });
            }
        });
    }

    private void prepareInstall(UpdateInfo info) {
        if (busy) return;
        busy = true;
        toast("正在校验安装包…");
        task = worker.submit(() -> {
            try {
                verify(apk(info), info);
                prefs.edit().putString("ready", info.toJson()).apply();
                ui(() -> { busy = false; installVerified(info); });
            } catch (Exception error) {
                apk(info).delete();
                prefs.edit().remove("ready").apply();
                ui(() -> { busy = false; message("无法安装更新", friendly(error) + "\n请重新检查更新并下载。"); });
            }
        });
    }

    private void installVerified(UpdateInfo info) {
        if (!activity.getPackageManager().canRequestPackageInstalls()) {
            dialog = new AlertDialog.Builder(activity).setTitle("允许安装更新")
                    .setMessage("首次更新需要在系统设置中允许 Garden Lab 安装应用。开启后返回这里，将继续安装。")
                    .setPositiveButton("前往设置", (d, which) -> {
                        prefs.edit().putBoolean("install_permission_pending", true).apply();
                        try {
                            activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                    Uri.parse("package:" + activity.getPackageName())));
                        } catch (Exception error) {
                            prefs.edit().remove("install_permission_pending").apply();
                            message("无法打开设置", "请在系统应用设置中允许 Garden Lab 安装未知应用，再检查更新。");
                        }
                    }).setNegativeButton("稍后", null).create();
            dialog.show();
            return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".updates", apk(info));
            Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.setClipData(ClipData.newRawUri("Garden Lab update", uri));
            activity.startActivity(intent);
        } catch (Exception error) {
            message("无法打开安装器", "安装包已保留，可通过“检查更新”重试。");
        }
    }

    @SuppressWarnings("deprecation")
    private void verify(File file, UpdateInfo info) throws Exception {
        if (!file.isFile()) throw new IOException("安装包不存在");
        // Recheck hash even for files recovered after process death or settings round-trips.
        try (InputStream input = new FileInputStream(file)) {
            UpdateDownload.transfer(input, new OutputStream() { @Override public void write(int value) {}
                @Override public void write(byte[] buffer, int off, int count) {} },
                    info.sizeBytes, info.sha256, ignored -> {});
        }
        PackageManager pm = activity.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo archive = pm.getPackageArchiveInfo(file.getAbsolutePath(), flags);
        PackageInfo installed = pm.getPackageInfo(activity.getPackageName(), flags);
        if (archive == null || !activity.getPackageName().equals(archive.packageName)) throw new IOException("安装包包名不匹配");
        long code = Build.VERSION.SDK_INT >= 28 ? archive.getLongVersionCode() : archive.versionCode;
        if (code != info.versionCode || !Objects.equals(archive.versionName, info.versionName)
                || !info.isNewerThan(BuildConfig.VERSION_CODE)) throw new IOException("安装包版本不匹配");
        if (archive.applicationInfo == null || archive.applicationInfo.minSdkVersion > Build.VERSION.SDK_INT) {
            throw new IOException("安装包不支持当前 Android 系统");
        }
        Set<String> current = signatures(installed), next = signatures(archive);
        if (current.isEmpty() || !current.equals(next)) throw new IOException("安装包签名不匹配");
    }

    @SuppressWarnings("deprecation")
    private Set<String> signatures(PackageInfo info) throws Exception {
        Signature[] values = Build.VERSION.SDK_INT >= 28
                ? (info.signingInfo == null ? new Signature[0] : info.signingInfo.getApkContentsSigners()) : info.signatures;
        Set<String> result = new HashSet<>();
        if (values != null) for (Signature value : values) {
            result.add(UpdateDownload.hex(MessageDigest.getInstance("SHA-256").digest(value.toByteArray())));
        }
        return result;
    }

    private File apk(UpdateInfo info) { return new File(directory, "garden-lab-" + info.versionCode + ".apk"); }

    private void clearReady() {
        // Never touches WebView storage or the user's article/login data.
        prefs.edit().remove("ready").remove("install_permission_pending").apply();
        File[] files = directory.listFiles();
        if (files != null) for (File file : files) if (file.getName().matches("garden-lab-[0-9]+\\.apk|download\\.part")) file.delete();
    }

    private String friendly(Exception error) {
        if (error instanceof java.net.SocketTimeoutException || error instanceof java.net.UnknownHostException)
            return "连接超时或网络不可用，请稍后重试。";
        return error.getMessage() == null ? "请检查网络后重试。" : error.getMessage();
    }
    private void message(String title, String text) {
        dialog = new AlertDialog.Builder(activity).setTitle(title).setMessage(text).setPositiveButton("知道了", null).create();
        dialog.show();
    }
    private void toast(String text) { Toast.makeText(activity, text, Toast.LENGTH_SHORT).show(); }
    private void ui(Runnable action) {
        activity.runOnUiThread(() -> { if (!destroyed && !activity.isFinishing() && !activity.isDestroyed()) action.run(); });
    }
    void destroy() {
        destroyed = true;
        if (task != null) task.cancel(true);
        worker.shutdownNow();
        if (dialog != null) dialog.dismiss();
    }
}
