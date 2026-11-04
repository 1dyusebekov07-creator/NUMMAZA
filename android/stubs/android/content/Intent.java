package android.content;
import android.net.Uri;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public class Intent {
    public static final String ACTION_GET_CONTENT = "android.intent.action.GET_CONTENT";
    public static final String ACTION_SEND = "android.intent.action.SEND";
    public static final String ACTION_VIEW = "android.intent.action.VIEW";
    public static final String CATEGORY_OPENABLE = "android.intent.category.OPENABLE";
    public static final String EXTRA_MIME_TYPES = "android.intent.extra.MIME_TYPES";
    public static final String EXTRA_TEXT = "android.intent.extra.TEXT";
    public Intent(String action) { throw new RuntimeException("stub"); }
    public Intent(String action, Uri uri) { throw new RuntimeException("stub"); }
    public Intent addCategory(String category) { throw new RuntimeException("stub"); }
    public Intent setType(String type) { throw new RuntimeException("stub"); }
    public Intent putExtra(String name, String value) { throw new RuntimeException("stub"); }
    public Intent putExtra(String name, String[] value) { throw new RuntimeException("stub"); }
    public Uri getData() { throw new RuntimeException("stub"); }
    public static Intent createChooser(Intent target, CharSequence title) { throw new RuntimeException("stub"); }
}
