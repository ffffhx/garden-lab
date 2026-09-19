package com.gardenlab.online;

import java.net.URI;
import org.json.JSONObject;

final class UpdateInfo {
    static final long MAX_APK_BYTES = 50L * 1024 * 1024;
    final long versionCode, sizeBytes;
    final int minSdk;
    final String versionName, apkUrl, sha256, notes;

    private UpdateInfo(long code, String name, String url, String hash, long size, int sdk, String notes) {
        this.versionCode = code; this.versionName = name; this.apkUrl = url;
        this.sha256 = hash; this.sizeBytes = size; this.minSdk = sdk; this.notes = notes;
    }

    static UpdateInfo parse(String text) throws Exception {
        JSONObject json = new JSONObject(text);
        long code = json.getLong("versionCode"), size = json.getLong("sizeBytes");
        String name = json.getString("versionName"), url = json.getString("apkUrl");
        String hash = json.getString("sha256").toLowerCase(java.util.Locale.ROOT);
        int sdk = json.getInt("minSdk");
        URI uri = new URI(url);
        String path = uri.getPath();
        if (code <= 0 || code > Integer.MAX_VALUE || !name.matches("[0-9][a-zA-Z0-9.+-]{0,63}")
                || !hash.matches("[0-9a-f]{64}") || size <= 0 || size > MAX_APK_BYTES || sdk < 26) {
            throw new IllegalArgumentException("更新信息格式不正确");
        }
        if (!"https".equals(uri.getScheme()) || !"github.com".equals(uri.getHost())
                || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)
                || uri.getQuery() != null || uri.getFragment() != null || path == null
                || !path.startsWith("/ffffhx/garden-lab/releases/download/android-v")
                || !path.endsWith(".apk") || !uri.normalize().equals(uri) || path.contains("..")) {
            throw new IllegalArgumentException("安装包地址不是 Garden Lab 官方发布地址");
        }
        String notes = json.optString("releaseNotes", "");
        if (notes.length() > 4000) throw new IllegalArgumentException("更新说明过长");
        return new UpdateInfo(code, name, url, hash, size, sdk, notes);
    }

    boolean isNewerThan(long installed) { return versionCode > installed; }

    String toJson() throws Exception {
        return new JSONObject().put("versionCode", versionCode).put("versionName", versionName)
                .put("apkUrl", apkUrl).put("sha256", sha256).put("sizeBytes", sizeBytes)
                .put("minSdk", minSdk).put("releaseNotes", notes).toString();
    }
}
