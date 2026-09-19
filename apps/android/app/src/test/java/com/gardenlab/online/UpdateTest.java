package com.gardenlab.online;

import org.junit.Test;
import org.json.JSONObject;
import java.io.*;
import java.security.MessageDigest;
import java.util.*;
import static org.junit.Assert.*;

public class UpdateTest {
    private JSONObject release() throws Exception {
        return new JSONObject().put("versionCode", 10).put("versionName", "0.10.0")
                .put("apkUrl", "https://github.com/ffffhx/garden-lab/releases/download/android-v0.10.0/Garden-Lab-0.10.0.apk")
                .put("sha256", "a".repeat(64)).put("sizeBytes", 650000).put("minSdk", 26)
                .put("releaseNotes", "修复更新流程");
    }

    @Test public void comparesNumericVersionsAndRoundTripsMetadata() throws Exception {
        UpdateInfo info = UpdateInfo.parse(release().toString());
        assertTrue(info.isNewerThan(9));
        assertFalse(info.isNewerThan(10));
        assertFalse(info.isNewerThan(11));
        assertEquals(info.sha256, UpdateInfo.parse(info.toJson()).sha256);
        assertEquals(info.notes, UpdateInfo.parse(info.toJson()).notes);
    }

    @Test public void rejectsUntrustedReleaseLocations() throws Exception {
        String good = release().getString("apkUrl");
        for (String url : List.of(good.replace("https:", "http:"), good.replace("github.com", "github.com.evil.test"),
                good.replace("ffffhx/garden-lab", "attacker/garden-lab"), good.replace("github.com/", "user@github.com/"),
                good + "?redirect=https://evil.test", good.replace("/Garden-Lab", "/../Garden-Lab"))) {
            assertThrows(Exception.class, () -> UpdateInfo.parse(release().put("apkUrl", url).toString()));
        }
    }

    @Test public void rejectsInvalidSizesDigestsAndVersions() throws Exception {
        for (long size : new long[]{0, -1, UpdateInfo.MAX_APK_BYTES + 1}) {
            assertThrows(Exception.class, () -> UpdateInfo.parse(release().put("sizeBytes", size).toString()));
        }
        assertThrows(Exception.class, () -> UpdateInfo.parse(release().put("sha256", "short").toString()));
        assertThrows(Exception.class, () -> UpdateInfo.parse(release().put("versionCode", 0).toString()));
        assertThrows(Exception.class, () -> UpdateInfo.parse(release().put("versionName", "<script>").toString()));
        assertThrows(Exception.class, () -> UpdateInfo.parse("{}"));
    }

    @Test public void validatesDownloadedBytesAndReportsProgress() throws Exception {
        byte[] bytes = new byte[50000];
        new Random(7).nextBytes(bytes);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        List<Integer> progress = new ArrayList<>();
        UpdateDownload.transfer(new ByteArrayInputStream(bytes), output, bytes.length, sha(bytes), progress::add);
        assertArrayEquals(bytes, output.toByteArray());
        assertEquals(Integer.valueOf(100), progress.get(progress.size() - 1));
        assertTrue(progress.size() > 1);
    }

    @Test public void rejectsCorruptionTruncationAndOversizedResponses() throws Exception {
        byte[] bytes = {1, 2, 3, 4};
        assertThrows(IOException.class, () -> transfer(bytes, 4, "0".repeat(64)));
        assertThrows(IOException.class, () -> transfer(bytes, 5, sha(bytes)));
        assertThrows(IOException.class, () -> transfer(bytes, 3, sha(bytes)));
    }

    @Test public void interruptedDownloadCannotBeInstalled() throws Exception {
        Thread.currentThread().interrupt();
        try { assertThrows(InterruptedIOException.class, () -> transfer(new byte[]{1}, 1, sha(new byte[]{1}))); }
        finally { Thread.interrupted(); }
    }

    private void transfer(byte[] bytes, long size, String hash) throws Exception {
        UpdateDownload.transfer(new ByteArrayInputStream(bytes), new ByteArrayOutputStream(), size, hash, ignored -> {});
    }
    private String sha(byte[] bytes) throws Exception {
        return UpdateDownload.hex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }
}
