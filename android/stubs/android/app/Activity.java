package android.app;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
/** Заглушка только для компиляции. */
public class Activity extends Context {
    public static final int RESULT_OK = -1;
    protected void onCreate(Bundle savedInstanceState) { throw new RuntimeException("stub"); }
    protected void onActivityResult(int requestCode, int resultCode, Intent data) { throw new RuntimeException("stub"); }
    protected void onSaveInstanceState(Bundle outState) { throw new RuntimeException("stub"); }
    public void onBackPressed() { throw new RuntimeException("stub"); }
    public void setContentView(View view) { throw new RuntimeException("stub"); }
    public void startActivity(Intent intent) { throw new RuntimeException("stub"); }
    public void startActivityForResult(Intent intent, int requestCode) { throw new RuntimeException("stub"); }
    public final void runOnUiThread(Runnable action) { throw new RuntimeException("stub"); }
}
