package com.gardenlab.online;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.function.IntConsumer;

final class UpdateDownload {
    static HttpURLConnection connect(String address) throws Exception {
        URL url = new URL(address);
        for (int redirects = 0; redirects <= 5; redirects++) {
            if (!"https".equals(url.getProtocol()) || url.getUserInfo() != null
                    || (url.getPort() != -1 && url.getPort() != 443)) {
                throw new IOException("更新连接必须使用 HTTPS");
            }
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(20_000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("User-Agent", "GardenLab-Android");
            int code;
            try { code = connection.getResponseCode(); }
            catch (IOException error) { connection.disconnect(); throw error; }
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null) throw new IOException("更新地址跳转无效");
                url = new URL(url, location);
            } else if (code == 200) {
                return connection;
            } else {
                connection.disconnect();
                throw new IOException("更新服务器暂时不可用（HTTP " + code + "）");
            }
        }
        throw new IOException("更新地址跳转次数过多");
    }

    static String manifest(String address) throws Exception {
        HttpURLConnection connection = connect(address);
        try (InputStream input = connection.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            for (int n; (n = input.read(buffer)) != -1;) {
                if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException();
                if (out.size() + n > 64 * 1024) throw new IOException("更新信息过大");
                out.write(buffer, 0, n);
            }
            return out.toString(StandardCharsets.UTF_8.name());
        } finally { connection.disconnect(); }
    }

    static void apk(UpdateInfo info, File partial, IntConsumer progress) throws Exception {
        HttpURLConnection connection = connect(info.apkUrl);
        try (InputStream input = connection.getInputStream(); FileOutputStream out = new FileOutputStream(partial)) {
            transfer(input, out, info.sizeBytes, info.sha256, progress);
            out.getFD().sync();
        } finally { connection.disconnect(); }
    }

    // Streaming bounds and digest verification are independent of Android and covered by JVM tests.
    static void transfer(InputStream input, OutputStream out, long expected, String hash, IntConsumer progress) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] buffer = new byte[16384];
        long total = 0;
        int previous = -1;
        for (int n; (n = input.read(buffer)) != -1;) {
            if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException("下载已取消");
            total += n;
            if (total > expected || total > UpdateInfo.MAX_APK_BYTES) throw new IOException("安装包大小不匹配");
            digest.update(buffer, 0, n);
            out.write(buffer, 0, n);
            int percent = (int) (total * 100 / expected);
            if (percent != previous) { progress.accept(percent); previous = percent; }
        }
        if (total != expected || !hex(digest.digest()).equals(hash)) throw new IOException("安装包校验失败，请重新下载");
    }

    static String hex(byte[] bytes) {
        StringBuilder out = new StringBuilder();
        for (byte value : bytes) out.append(String.format(Locale.ROOT, "%02x", value & 255));
        return out.toString();
    }
}
