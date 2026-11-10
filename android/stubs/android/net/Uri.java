package android.net;
/** Заглушка только для компиляции. */
public abstract class Uri implements android.os.Parcelable {
    public abstract String getScheme();
    public abstract String getLastPathSegment();
}
