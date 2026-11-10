package kz.nummaza.app;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.Base64;

/**
 * NUMMAZA для Android: веб-приложение из assets/www открывается во встроенном WebView.
 * Данные хранятся в localStorage на устройстве, интернет не нужен.
 * Нативная часть: выбор файла выписки, кнопка «Назад», «Поделиться» итогами,
 * приём выписки из других приложений (Kaspi → «Поделиться» → NUMMAZA).
 */
public class MainActivity extends Activity {
    private static final int PICK_FILE = 41;
    private WebView web;
    private static final int MAX_SHARED = 10 * 1024 * 1024; // как в веб-части: до 10 МБ
    private ValueCallback<Uri[]> fileCallback;
    /** Файл, полученный через «Поделиться», ждёт, пока JavaScript его заберёт (JSON или null). */
    private volatile String sharedJson;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(0xFFF4F5F7);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String scheme = url.getScheme();
                // Внешние ссылки открываем в браузере, свои страницы — внутри приложения
                if ("http".equals(scheme) || "https".equals(scheme)) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, url)); } catch (Exception ignored) { }
                    return true;
                }
                return false;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("*/*");
                pick.putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "application/pdf", "text/csv", "text/comma-separated-values", "text/plain" });
                try {
                    startActivityForResult(Intent.createChooser(pick, "NUMMAZA"), PICK_FILE);
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
            }
        });

        web.addJavascriptInterface(new Bridge(), "NummazaNative");
        setContentView(web);
        if (state != null) web.restoreState(state);
        else {
            receive(getIntent());
            web.loadUrl("file:///android_asset/www/index.html");
        }
    }

    /** Приложение уже открыто, а пользователь снова поделился файлом. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        receive(intent);
        if (sharedJson != null && web != null) {
            web.evaluateJavascript("window.NZ && NZ.app && NZ.app.pullShared && NZ.app.pullShared()", null);
        }
    }

    /** ACTION_SEND (поделиться) или ACTION_VIEW (открыть с помощью): читаем файл и готовим его для JavaScript. */
    private void receive(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Uri uri = null;
        if (Intent.ACTION_SEND.equals(action)) uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        else if (Intent.ACTION_VIEW.equals(action)) uri = intent.getData();
        if (uri == null) return;
        String name = displayName(uri);
        String type = intent.getType();
        try { if (type == null) type = getContentResolver().getType(uri); } catch (Exception ignored) { }
        if (type == null) type = "";
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) throw new java.io.IOException("no stream");
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[64 * 1024];
            int n;
            while ((n = in.read(chunk)) > 0) {
                buf.write(chunk, 0, n);
                if (buf.size() > MAX_SHARED) { sharedJson = "{\"error\":\"size\"}"; return; }
            }
            sharedJson = "{\"name\":" + json(name) + ",\"type\":" + json(type) + ",\"data\":\""
                + Base64.getEncoder().encodeToString(buf.toByteArray()) + "\"}";
        } catch (Exception e) {
            sharedJson = "{\"error\":\"read\"}";
        }
    }

    private String displayName(Uri uri) {
        String name = null;
        try (Cursor c = getContentResolver().query(uri, new String[] { "_display_name" }, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int i = c.getColumnIndex("_display_name");
                if (i >= 0) name = c.getString(i);
            }
        } catch (Exception ignored) { }
        if (name == null || name.isEmpty()) name = uri.getLastPathSegment();
        return name == null || name.isEmpty() ? "statement.pdf" : name;
    }

    private static String json(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            if (ch == '"' || ch == '\\') b.append('\\').append(ch);
            else if (ch < 0x20 || ch == 0x2028 || ch == 0x2029) b.append(String.format("\\u%04x", (int) ch));
            else b.append(ch);
        }
        return b.append('"').toString();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == PICK_FILE && fileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) result = new Uri[] { data.getData() };
            fileCallback.onReceiveValue(result);
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    /** Мост для JavaScript: window.NummazaNative.share(text), window.NummazaNative.takeSharedFile() */
    public class Bridge {
        /** Отдаёт полученный через «Поделиться» файл один раз: {name, type, data: base64} или {error}. */
        @JavascriptInterface
        public String takeSharedFile() {
            String j = sharedJson;
            sharedJson = null;
            return j;
        }

        @JavascriptInterface
        public void share(final String text) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("text/plain");
                    send.putExtra(Intent.EXTRA_TEXT, text);
                    try { startActivity(Intent.createChooser(send, null)); } catch (Exception ignored) { }
                }
            });
        }
    }
}
