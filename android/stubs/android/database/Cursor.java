package android.database;
/** Заглушка только для компиляции. */
public interface Cursor extends java.io.Closeable {
    boolean moveToFirst();
    int getColumnIndex(String columnName);
    String getString(int columnIndex);
    void close();
}
