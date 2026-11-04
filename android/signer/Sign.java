import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/** Подписывает APK схемой v2 (minSdk 26 — v1 не нужна) через библиотеку apksig и сразу проверяет подпись. */
public class Sign {
    public static void main(String[] a) throws Exception {
        String in = a[0], out = a[1], ksPath = a[2], pass = a[3], alias = a[4];
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream f = new FileInputStream(ksPath)) { ks.load(f, pass.toCharArray()); }
        PrivateKey key = (PrivateKey) ks.getKey(alias, pass.toCharArray());
        X509Certificate cert = (X509Certificate) ks.getCertificate(alias);
        ApkSigner.SignerConfig sc = new ApkSigner.SignerConfig.Builder("nummaza", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(sc))
            .setInputApk(new File(in)).setOutputApk(new File(out))
            .setMinSdkVersion(26).setV1SigningEnabled(false).setV2SigningEnabled(true)
            .build().sign();
        ApkVerifier.Result r = new ApkVerifier.Builder(new File(out)).build().verify();
        System.out.println("verified=" + r.isVerified() + " v1=" + r.isVerifiedUsingV1Scheme() + " v2=" + r.isVerifiedUsingV2Scheme());
        if (!r.isVerified()) { for (Object e : r.getErrors()) System.out.println("ERROR " + e); System.exit(1); }
    }
}
