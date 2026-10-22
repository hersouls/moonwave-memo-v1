package kr.moonwave.memo;

import android.content.pm.PackageInfo;
import android.os.Bundle;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // the screen's 설정 › Android 앱 compares this with the newest build (window.MoonwaveApp)
    getBridge().getWebView().addJavascriptInterface(new AppVersion(), "MoonwaveApp");
  }

  private class AppVersion {
    @JavascriptInterface
    public int versionCode() {
      PackageInfo info = info();
      return info == null ? 0 : (int) info.getLongVersionCode();
    }

    @JavascriptInterface
    public String versionName() {
      PackageInfo info = info();
      return info == null || info.versionName == null ? "" : info.versionName;
    }

    private PackageInfo info() {
      try {
        return getPackageManager().getPackageInfo(getPackageName(), 0);
      } catch (Exception e) {
        return null;
      }
    }
  }
}
