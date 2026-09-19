package com.gardenlab.online;

import android.app.Activity;
import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

/** A small online reader. Article HTML and JS are never bundled into the APK. */
public final class MainActivity extends Activity {
    private static final String HOME = "https://ffffhx.github.io/garden-lab/";
    private static final int PAPER = Color.rgb(244, 239, 228);
    private WebView web;
    private LinearLayout errorPanel;
    private ProgressBar progress;
    private long pausedAt;
    private boolean mainFrameFailed;
    private int restoreScroll = -1;
    private String lastSiteUrl = HOME;
    private AppUpdater updater;

    @SuppressLint("SetJavaScriptEnabled") // Required by our Next.js site; no native JS bridge is exposed.
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        updater = new AppUpdater(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(PAPER);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            // Includes status/navigation bars and keyboard, also with Android 15 edge-to-edge.
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = new TextView(this);
        title.setText(R.string.app_name);
        title.setTextColor(Color.rgb(30, 30, 26));
        title.setTextSize(16);
        title.setPadding(dp(16), 0, 0, 0);
        bar.addView(title, new LinearLayout.LayoutParams(0, dp(48), 1));
        title.setGravity(Gravity.CENTER_VERTICAL);
        Button refresh = new Button(this);
        refresh.setText("↻");
        refresh.setContentDescription("刷新页面");
        refresh.setOnClickListener(view -> reload());
        bar.addView(refresh, new LinearLayout.LayoutParams(dp(52), dp(48)));
        Button more = new Button(this);
        more.setText("⋮");
        more.setContentDescription("更多选项");
        more.setOnClickListener(this::showMenu);
        bar.addView(more, new LinearLayout.LayoutParams(dp(52), dp(48)));
        root.addView(bar);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        root.addView(progress, new LinearLayout.LayoutParams(-1, dp(2)));
        FrameLayout content = new FrameLayout(this);
        root.addView(content, new LinearLayout.LayoutParams(-1, 0, 1));
        web = new WebView(this);
        web.setBackgroundColor(PAPER);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setSupportMultipleWindows(false);
        CookieManager.getInstance().setAcceptCookie(true);
        // Garden's author API is on a different origin; its auth also supports bearer tokens.
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) {
                progress.setProgress(value);
                progress.setVisibility(value == 100 ? View.INVISIBLE : View.VISIBLE);
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if (isInternal(uri)) return false;
                openExternal(uri);
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                mainFrameFailed = false;
                errorPanel.setVisibility(View.GONE);
                if (isSite(Uri.parse(url))) lastSiteUrl = url;
            }
            @Override public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
                // Next.js changes routes with pushState without starting a document load.
                if (isSite(Uri.parse(url))) lastSiteUrl = url;
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!mainFrameFailed && restoreScroll >= 0) {
                    int y = restoreScroll;
                    restoreScroll = -1;
                    web.postDelayed(() -> web.scrollTo(0, y), 250);
                }
                CookieManager.getInstance().flush();
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError();
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) showError();
            }
        });
        web.setDownloadListener((url, userAgent, disposition, mimeType, length) -> openExternal(Uri.parse(url)));
        content.addView(web, new FrameLayout.LayoutParams(-1, -1));
        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(dp(24), dp(24), dp(24), dp(24));
        errorPanel.setBackgroundColor(PAPER);
        TextView errorText = new TextView(this);
        errorText.setText("暂时无法打开页面\n请检查网络后重试");
        errorText.setGravity(Gravity.CENTER);
        errorText.setTextSize(18);
        errorPanel.addView(errorText);
        Button retry = new Button(this);
        retry.setText("重试");
        retry.setOnClickListener(view -> reload());
        errorPanel.addView(retry);
        errorPanel.setVisibility(View.GONE);
        content.addView(errorPanel, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 27) {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(0, this::goBack);
        }
        // Always request the current online document on a new Activity, never a saved HTML snapshot.
        String saved = state == null ? null : state.getString("page");
        web.loadUrl(saved != null && isSite(Uri.parse(saved)) ? saved : HOME);
    }

    static boolean isSite(Uri uri) {
        return "https".equals(uri.getScheme()) && "ffffhx.github.io".equals(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443)
                && uri.getPath() != null && uri.getPath().startsWith("/garden-lab/");
    }

    private static boolean isInternal(Uri uri) {
        if (isSite(uri)) return true;
        if (!"https".equals(uri.getScheme())) return false;
        // Keep the author's GitHub OAuth redirect chain in the same cookie/storage context.
        if ("github.com".equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443)) {
            String path = uri.getPath();
            return path != null && (path.equals("/login") || path.startsWith("/login/")
                    || path.equals("/session") || path.startsWith("/sessions/"));
        }
        return "124-221-36-36.anyip.dev".equals(uri.getHost()) && uri.getPort() == 8443
                && uri.getPath() != null && uri.getPath().startsWith("/garden-api/");
    }

    private void showError() {
        mainFrameFailed = true;
        errorPanel.setVisibility(View.VISIBLE);
        progress.setVisibility(View.INVISIBLE);
    }

    private void reload() {
        restoreScroll = web.getScrollY();
        errorPanel.setVisibility(View.GONE);
        if (mainFrameFailed) web.loadUrl(lastSiteUrl);
        else web.reload();
    }

    private void showMenu(View anchor) {
        PopupMenu menu = new PopupMenu(this, anchor);
        menu.getMenu().add(0, 1, 0, "首页");
        menu.getMenu().add(0, 2, 1, "刷新");
        menu.getMenu().add(0, 3, 2, "在浏览器打开");
        menu.getMenu().add(0, 4, 3, "检查更新");
        menu.getMenu().add(0, 5, 4, "在线版 " + BuildConfig.VERSION_NAME).setEnabled(false);
        menu.setOnMenuItemClickListener(item -> {
            switch (item.getItemId()) {
                case 1: web.loadUrl(HOME); break;
                case 2: reload(); break;
                case 3: openExternal(Uri.parse(lastSiteUrl)); break;
                case 4: updater.check(true); break;
                default: return false;
            }
            return true;
        });
        menu.show();
    }

    private void openExternal(Uri uri) {
        String scheme = uri.getScheme();
        if (!("https".equals(scheme) || "http".equals(scheme) || "mailto".equals(scheme))) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "没有可打开此链接的应用", Toast.LENGTH_SHORT).show();
        }
    }

    private void goBack() {
        if (web.canGoBack()) { errorPanel.setVisibility(View.GONE); web.goBack(); }
        else finish();
    }
    // Legacy Android 8–12 callback. Android 13+ uses the native dispatcher registered above.
    @SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() { goBack(); }
    @Override protected void onPause() {
        pausedAt = SystemClock.elapsedRealtime();
        web.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        web.onResume();
        updater.resume();
        // Returning after a minute revalidates the page; do not interrupt the OAuth flow.
        if (pausedAt > 0 && SystemClock.elapsedRealtime() - pausedAt >= 60_000
                && web.getUrl() != null && isSite(Uri.parse(web.getUrl()))) reload();
        pausedAt = 0;
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        state.putString("page", lastSiteUrl);
        super.onSaveInstanceState(state);
    }
    @Override protected void onDestroy() {
        web.destroy();
        updater.destroy();
        super.onDestroy();
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
