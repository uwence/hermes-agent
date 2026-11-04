package com.winson.hermes.mobile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashSet;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

/**
 * OkHttp WebSocket so a saved extra header (Cloudflare Access and similar) can
 * ride the upgrade. The WebView's own WebSocket cannot set headers. The chat
 * socket uses this only when the connection has extra headers; cleartext
 * Tailscale gateways keep the WebView socket.
 */
@CapacitorPlugin(name = "HermesSocket")
public class HermesSocketPlugin extends Plugin {
    private static final Set<String> FORBIDDEN = new HashSet<>();

    static {
        FORBIDDEN.add("authorization");
        FORBIDDEN.add("connection");
        FORBIDDEN.add("content-length");
        FORBIDDEN.add("cookie");
        FORBIDDEN.add("host");
        FORBIDDEN.add("origin");
        FORBIDDEN.add("upgrade");
        FORBIDDEN.add("x-hermes-session-token");
    }

    private final OkHttpClient client = new OkHttpClient.Builder()
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .build();
    private final Map<String, WebSocket> sockets = new ConcurrentHashMap<>();

    @PluginMethod
    public void connect(PluginCall call) {
        String id = call.getString("id");
        String url = call.getString("url");
        if (id == null || url == null || !(url.startsWith("ws://") || url.startsWith("wss://"))) {
            call.reject("HermesSocket.connect requires id and a ws(s) url");
            return;
        }
        Request.Builder builder = new Request.Builder().url(url);
        JSObject headers = call.getObject("headers");
        if (headers != null) {
            Iterator<String> keys = headers.keys();
            while (keys.hasNext()) {
                String name = keys.next();
                if (name == null || FORBIDDEN.contains(name.toLowerCase(Locale.US))) continue;
                String value = headers.optString(name, "");
                if (!value.isEmpty()) builder.addHeader(name, value.replace("\r", "").replace("\n", ""));
            }
        }
        WebSocket socket = client.newWebSocket(builder.build(), new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                emit(id, "open", null, 0, null);
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                emit(id, "message", text, 0, null);
            }

            @Override
            public void onMessage(WebSocket webSocket, ByteString bytes) {
                emit(id, "message", bytes.utf8(), 0, null);
            }

            @Override
            public void onClosing(WebSocket webSocket, int code, String reason) {
                webSocket.close(code, reason);
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                sockets.remove(id);
                emit(id, "close", null, code, reason);
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                sockets.remove(id);
                emit(id, "error", null, response != null ? response.code() : 0, t.getMessage());
                emit(id, "close", null, 1006, t.getMessage());
            }
        });
        sockets.put(id, socket);
        call.resolve();
    }

    @PluginMethod
    public void send(PluginCall call) {
        WebSocket socket = sockets.get(call.getString("id", ""));
        String data = call.getString("data", "");
        if (socket == null) {
            call.reject("socket not open");
            return;
        }
        socket.send(data);
        call.resolve();
    }

    @PluginMethod
    public void close(PluginCall call) {
        String id = call.getString("id", "");
        WebSocket socket = sockets.remove(id);
        if (socket != null) {
            int code = call.getInt("code", 1000);
            socket.close(code, call.getString("reason", ""));
        }
        call.resolve();
    }

    private void emit(String id, String event, String data, int code, String reason) {
        JSObject payload = new JSObject();
        payload.put("id", id);
        payload.put("event", event);
        if (data != null) payload.put("data", data);
        if (code != 0) payload.put("code", code);
        if (reason != null) payload.put("reason", reason);
        notifyListeners("frame", payload);
    }
}
