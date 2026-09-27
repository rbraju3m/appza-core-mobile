package net.appza.app;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Environment;
import android.text.TextUtils;
import android.webkit.MimeTypeMap;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Saves a file to the device's Downloads folder.
 *
 * Why this exists: nothing in the WebView can do it. Capacitor 6's
 * Android bridge sets neither `setSupportMultipleWindows` /
 * `onCreateWindow` nor a `setDownloadListener`, so
 *   - `window.open(url, '_blank')` cannot open a window and returns null,
 *     which is why the media viewer's Download button did nothing on the
 *     phone while working fine in the browser-based simulator, and
 *   - an `<a download>` is inert for the same reason.
 * Navigating the main frame at the file instead is not a fix either: the
 * WebView renders an image inline, so the app would be replaced by the
 * picture with no way back.
 *
 * Android's DownloadManager sidesteps all of that — it fetches out of
 * process, writes into the public Downloads directory, shows the system
 * progress notification and makes the file visible to the gallery and
 * every file manager.
 *
 * Written as a local plugin rather than pulling in @capacitor/filesystem
 * because it needs no npm dependency (this box has no pnpm, and the
 * workspace is pnpm-managed), no runtime permission on any currently
 * supported Android, and no base64 round-trip of the whole file through
 * the JS bridge.
 *
 * The media URLs this serves are plain public uploads URLs — verified as
 * 200 with real bytes and no auth — so DownloadManager can fetch them
 * directly without carrying a session.
 */
@CapacitorPlugin(name = "AppzaDownload")
public class AppzaDownloadPlugin extends Plugin {

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        if (url == null || TextUtils.isEmpty(url.trim())) {
            call.reject("A url is required");
            return;
        }

        try {
            Uri uri = Uri.parse(url.trim());
            String scheme = uri.getScheme();
            // DownloadManager only speaks http(s); anything else (data:,
            // blob:, file:) would throw deep inside it with a message the
            // caller cannot act on.
            if (scheme == null || !(scheme.equals("http") || scheme.equals("https"))) {
                call.reject("Only http and https URLs can be downloaded");
                return;
            }

            String filename = safeFileName(call.getString("filename"), uri);

            DownloadManager.Request request = new DownloadManager.Request(uri);
            request.setTitle(filename);
            request.setDescription(uri.getHost());
            request.setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
            );
            // Public Downloads dir: no runtime permission on API 29+, and
            // the manifest carries the legacy WRITE_EXTERNAL_STORAGE
            // capped at API 28 for older devices. A name that already
            // exists gets a numeric suffix rather than clobbering.
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

            String mime = MimeTypeMap.getSingleton()
                .getMimeTypeFromExtension(extensionOf(filename));
            if (mime != null) {
                request.setMimeType(mime);
            }

            DownloadManager manager =
                (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager == null) {
                call.reject("Downloads are unavailable on this device");
                return;
            }
            long id = manager.enqueue(request);

            JSObject result = new JSObject();
            result.put("id", id);
            result.put("filename", filename);
            call.resolve(result);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Download failed", e);
        }
    }

    /**
     * A name DownloadManager will accept: no path separators (it throws on
     * those), never empty, and carrying an extension so the system picks
     * the right app to open it with.
     */
    private String safeFileName(String requested, Uri uri) {
        String name = requested == null ? "" : requested.trim();
        if (TextUtils.isEmpty(name)) {
            String last = uri.getLastPathSegment();
            name = last == null ? "" : last;
        }
        name = name.replaceAll("[/\\\\]+", "_").trim();
        if (TextUtils.isEmpty(name)) {
            name = "download";
        }
        if (TextUtils.isEmpty(extensionOf(name))) {
            String fromUrl = extensionOf(uri.getLastPathSegment());
            if (!TextUtils.isEmpty(fromUrl)) {
                name = name + "." + fromUrl;
            }
        }
        return name;
    }

    private String extensionOf(String name) {
        if (name == null) {
            return "";
        }
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) {
            return "";
        }
        return name.substring(dot + 1).toLowerCase();
    }
}
