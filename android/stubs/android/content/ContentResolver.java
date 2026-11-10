package android.content;
import android.database.Cursor;
import android.net.Uri;
/** Заглушка только для компиляции. */
public abstract class ContentResolver {
    public final java.io.InputStream openInputStream(Uri uri) throws java.io.FileNotFoundException { throw new RuntimeException("stub"); }
    public final String getType(Uri url) { throw new RuntimeException("stub"); }
    public final Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) { throw new RuntimeException("stub"); }
}
