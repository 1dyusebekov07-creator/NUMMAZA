package android.webkit;
import android.content.Context;
import android.os.Bundle;
import android.view.View;
/** Заглушка только для компиляции. */
public class WebView extends View {
    public WebView(Context context) { throw new RuntimeException("stub"); }
    public WebSettings getSettings() { throw new RuntimeException("stub"); }
    public void setWebViewClient(WebViewClient client) { throw new RuntimeException("stub"); }
    public void setWebChromeClient(WebChromeClient client) { throw new RuntimeException("stub"); }
    public void addJavascriptInterface(Object object, String name) { throw new RuntimeException("stub"); }
    public void loadUrl(String url) { throw new RuntimeException("stub"); }
    public boolean canGoBack() { throw new RuntimeException("stub"); }
    public void goBack() { throw new RuntimeException("stub"); }
    public WebBackForwardList saveState(Bundle outState) { throw new RuntimeException("stub"); }
    public WebBackForwardList restoreState(Bundle inState) { throw new RuntimeException("stub"); }
}
