package br.com.minhasdespesas.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Insets;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Minhas Despesas — casca Android: um WebView em tela cheia com o app embutido (file:///android_asset/app.html).
 * Funciona offline; os dados ficam no aparelho. Links externos (e-mail, outros sites) abrem fora do app.
 * Downloads (CSV, OFX, backup) e a cópia dos dados passam por uma ponte JavaScript (assets/bridge.js).
 */
public class MainActivity extends Activity {
    private static final String ASSET_PREFIX = "file:///android_asset/";
    private static final String START_URL = ASSET_PREFIX + "app.html";
    private static final String PREFS = "minhas_despesas";
    private static final int REQ_FILE = 71;
    private static final int MAX_DATA_BYTES = 8 * 1024 * 1024;
    private static final int MAX_FILE_BYTES = 25 * 1024 * 1024;
    private static final int DARK = 0xFF14150D;      // também usado na barra de navegação de Androids antigos
    private static final int LIGHT_BG = 0xFFF2F1EA;  // creme do tema claro

    private FrameLayout root;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        root = new FrameLayout(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        installInsetsHandling();

        SharedPreferences sp = getSharedPreferences(PREFS, MODE_PRIVATE);
        applyBars(sp.getInt("bar_color", LIGHT_BG), sp.getBoolean("bar_light", true));   // última cor usada: sem "piscar" ao abrir

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);                    // necessário para ler o app embutido (android_asset)
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setBuiltInZoomControls(false);
        s.setSupportZoom(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        WebView.setWebContentsDebuggingEnabled(false);
        CookieManager.getInstance().setAcceptCookie(false);

        web.addJavascriptInterface(new Bridge(), "AndroidApp");
        web.setWebChromeClient(new WebChromeClient() {
            /** Seletor de arquivos do Android (usado por "Restaurar backup"). Só para as páginas do próprio app. */
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!isInternal(view.getUrl())) { callback.onReceiveValue(null); return true; }
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    startActivityForResult(Intent.createChooser(i, "Escolher backup"), REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                }
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (isInternal(url)) return false;
                openExternally(url);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (isInternal(url)) injectBridge();
            }

            /** Se o processo de renderização do WebView morrer (pouca memória, atualização do WebView), recria a tela em vez de fechar o app. */
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                toast("O app foi reiniciado.");
                runOnUiThread(new Runnable() { public void run() { recreate(); } });
                return true;
            }
        });

        // Botão/gesto voltar: a partir do Android 13 o sistema exige registrar o callback moderno; antes, onBackPressed.
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, new OnBackInvokedCallback() {
                @Override public void onBackInvoked() { handleBack(); }
            });
        }

        if (state != null) web.restoreState(state); else web.loadUrl(START_URL);
    }

    /**
     * Android 15+ (alvo 35+) desenha o app SOB as barras do sistema. Aqui a gente aplica as margens (barras, recorte da tela e teclado)
     * como espaçamento e deixa a cor do app aparecer atrás delas. Em versões antigas o sistema já reserva o espaço e nada muda.
     */
    private void installInsetsHandling() {
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                int l, t, r, b;
                if (Build.VERSION.SDK_INT >= 30) {
                    Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                    Insets ime = insets.getInsets(WindowInsets.Type.ime());
                    l = bars.left; t = bars.top; r = bars.right; b = Math.max(bars.bottom, ime.bottom);
                    v.setPadding(l, t, r, b);
                    return WindowInsets.CONSUMED;
                }
                l = insets.getSystemWindowInsetLeft(); t = insets.getSystemWindowInsetTop(); r = insets.getSystemWindowInsetRight(); b = insets.getSystemWindowInsetBottom();
                v.setPadding(l, t, r, b);
                return insets.consumeSystemWindowInsets();
            }
        });
        root.requestApplyInsets();
    }

    /** Pinta o fundo atrás das barras do sistema com a cor do app e escolhe ícones claros ou escuros conforme o fundo. */
    private void applyBars(int color, boolean lightBackground) {
        int c = color | 0xFF000000;
        root.setBackgroundColor(c);
        getWindow().setBackgroundDrawable(new ColorDrawable(c));
        if (web != null) web.setBackgroundColor(c);
        if (Build.VERSION.SDK_INT < 35) {   // a partir do Android 15 o sistema ignora estas cores (as barras são transparentes sobre o fundo acima)
            getWindow().setStatusBarColor(c);
            getWindow().setNavigationBarColor(Build.VERSION.SDK_INT >= 26 ? c : DARK);   // antes do Android 8 os ícones da barra de baixo não ficam escuros
        }
        if (Build.VERSION.SDK_INT >= 29) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController ic = getWindow().getInsetsController();
            if (ic != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                ic.setSystemBarsAppearance(lightBackground ? mask : 0, mask);
            }
        } else {
            View decor = getWindow().getDecorView();
            int flags = decor.getSystemUiVisibility();
            int mask = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | (Build.VERSION.SDK_INT >= 26 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0);
            decor.setSystemUiVisibility(lightBackground ? (flags | mask) : (flags & ~mask));
        }
    }

    private boolean isInternal(String url) {
        return url != null && url.startsWith(ASSET_PREFIX);
    }

    private void openExternally(String url) {
        try {
            Uri u = Uri.parse(url);
            String scheme = u.getScheme();
            if ("https".equals(scheme) || "http".equals(scheme) || "mailto".equals(scheme) || "tel".equals(scheme)) {
                startActivity(new Intent(Intent.ACTION_VIEW, u));
            }
        } catch (ActivityNotFoundException e) {
            toast("Nenhum aplicativo para abrir este link.");
        }
    }

    private void injectBridge() {
        InputStream in = null;
        try {
            in = getAssets().open("bridge.js");
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            web.evaluateJavascript(out.toString("UTF-8"), null);
        } catch (Exception e) {
            // sem a ponte, só os downloads e a cópia nativa deixam de funcionar; o resto do app segue normal
        } finally {
            if (in != null) { try { in.close(); } catch (Exception ignored) { } }
        }
    }

    private void handleBack() {
        if (web.canGoBack()) web.goBack(); else finish();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {            // Androids anteriores ao 13
        handleBack();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            if (fileCallback != null) {
                Uri[] result = null;
                if (resultCode == RESULT_OK && data != null && data.getData() != null) result = new Uri[] { data.getData() };
                fileCallback.onReceiveValue(result);
                fileCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onPause() { super.onPause(); if (web != null) web.onPause(); }

    @Override
    protected void onResume() { super.onResume(); if (web != null) web.onResume(); }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.removeJavascriptInterface("AndroidApp"); web.destroy(); }
        super.onDestroy();
    }

    private void toast(final String msg) {
        runOnUiThread(new Runnable() { public void run() { Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show(); } });
    }

    /** Ponte chamada pelo JavaScript do app. Só as páginas do próprio app (file:///android_asset) chegam a ela. */
    private class Bridge {
        /** A página informa a cor do fundo do app (e muda quando o tema muda). Guardamos para o próximo início. */
        @JavascriptInterface
        public void setBars(final int color, final boolean lightBackground) {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putInt("bar_color", color | 0xFF000000).putBoolean("bar_light", lightBackground).apply();
            runOnUiThread(new Runnable() { public void run() { applyBars(color, lightBackground); } });
        }

        /** Cópia dos dados do app, gravada de forma SÍNCRONA (commit): se o WebView perder o armazenamento próprio, o app recupera daqui. */
        @JavascriptInterface
        public boolean saveData(String json) {
            if (json == null || json.length() > MAX_DATA_BYTES) return false;
            return getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("data", json).commit();
        }

        @JavascriptInterface
        public String loadData() {
            return getSharedPreferences(PREFS, MODE_PRIVATE).getString("data", "");
        }

        @JavascriptInterface
        public void saveFile(String name, String mime, String base64) {
            OutputStream os = null;
            try {
                if (base64 == null || base64.length() > MAX_FILE_BYTES * 4L / 3) { toast("Arquivo grande demais para salvar."); return; }
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                String safe = sanitize(name);
                String type = (mime == null || mime.length() == 0) ? "application/octet-stream" : mime.split(";")[0].trim();
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put("_display_name", safe);
                    v.put("mime_type", type);
                    v.put("relative_path", "Download/");
                    v.put("is_pending", 1);
                    Uri uri = getContentResolver().insert(Uri.parse("content://media/external/downloads"), v);
                    if (uri == null) throw new IllegalStateException("sem destino");
                    os = getContentResolver().openOutputStream(uri);
                    os.write(data);
                    os.close(); os = null;
                    ContentValues done = new ContentValues();
                    done.put("is_pending", 0);
                    getContentResolver().update(uri, done, null, null);
                    toast("Salvo em Downloads: " + safe);
                } else {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    File f = new File(dir, safe);
                    os = new FileOutputStream(f);
                    os.write(data);
                    toast("Salvo em: " + f.getAbsolutePath());
                }
            } catch (Exception e) {
                toast("Não foi possível salvar o arquivo.");
            } finally {
                if (os != null) { try { os.close(); } catch (Exception ignored) { } }
            }
        }
    }

    static String sanitize(String name) {
        String n = name == null ? "" : name.replaceAll("[^A-Za-z0-9._-]", "_");
        n = n.replaceAll("^[._]+", "");
        if (n.length() == 0) n = "arquivo";
        return n.length() > 100 ? n.substring(n.length() - 100) : n;
    }
}
