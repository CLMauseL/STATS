package ch.clmausel.farmingtracker;

import com.google.gson.*;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;

/** User-scoped REST sync. No service account, password, or admin token in the mod. */
final class CloudSync {
    private static final Gson JSON = new Gson();
    private static final String PROJECT = "holzkopf-stats-clmausel", DATABASE = "live";
    private final Path directory;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final Map<String, String> uploaded = new HashMap<>();
    private String idToken = "", credential = "";
    private long expiresAt;
    CloudSync(Path directory) { this.directory = directory; }

    void start() {
        ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "holzkopf-stats-sync"); t.setDaemon(true); return t;
        });
        executor.scheduleWithFixedDelay(this::sync, 5, 30, TimeUnit.SECONDS);
    }

    private void sync() {
        Path configFile = directory.resolve("cloud-session.json");
        if (!Files.isRegularFile(configFile)) { uploaded.clear(); credential = ""; return; }
        try {
            JsonObject config = JsonParser.parseString(Files.readString(configFile)).getAsJsonObject();
            if (!PROJECT.equals(config.get("projectId").getAsString())
                || !DATABASE.equals(config.get("databaseId").getAsString())) throw new IllegalArgumentException();
            String uid = config.get("uid").getAsString(), player = config.get("player").getAsString();
            String refresh = config.get("refreshToken").getAsString();
            if (!refresh.equals(credential) || System.currentTimeMillis() >= expiresAt) {
                JsonObject body = new JsonObject(); body.addProperty("grant_type", "refresh_token");
                body.addProperty("refresh_token", refresh);
                JsonObject result = send("https://securetoken.googleapis.com/v1/token?key=" +
                    java.net.URLEncoder.encode(config.get("apiKey").getAsString(), StandardCharsets.UTF_8), "POST", body, null);
                if (!uid.equals(result.get("user_id").getAsString())) throw new IllegalArgumentException();
                idToken = result.get("id_token").getAsString();
                expiresAt = System.currentTimeMillis() + (result.get("expires_in").getAsLong() - 120) * 1000;
                String rotated = result.get("refresh_token").getAsString();
                if (!refresh.equals(rotated)) {
                    config.addProperty("refreshToken", rotated);
                    Path temp = configFile.resolveSibling("cloud-session.json.tmp");
                    Files.writeString(temp, JSON.toJson(config));
                    Files.move(temp, configFile, StandardCopyOption.REPLACE_EXISTING);
                }
                if (!credential.equals(rotated)) uploaded.clear();
                credential = rotated;
            }
            Path daily = directory.resolve("daily");
            if (!Files.isDirectory(daily)) return;
            try (var paths = Files.list(daily)) {
                for (Path file : paths.filter(p -> p.toString().endsWith(".json")).sorted().toList()) {
                    try {
                        String content = Files.readString(file);
                        if (sha256(content).equals(uploaded.get(file.toString()))) continue;
                        JsonObject d = JsonParser.parseString(content).getAsJsonObject();
                        if (!player.equals(d.get("player").getAsString())) continue;
                        String server = sha256(d.get("server").getAsString());
                        String date = d.get("date").getAsString();
                        String id = uid + "_" + sha256(server + "_" + date);
                        JsonObject fields = new JsonObject();
                        for (String key : List.of("schema", "onlineMs", "workMs", "afkMs")) {
                            JsonObject value = new JsonObject(); value.addProperty("integerValue", d.get(key).getAsString()); fields.add(key, value);
                        }
                        for (var entry : Map.of("type", "daily", "ownerUid", uid, "player", player,
                                "date", date, "server", server, "blocksJson", JSON.toJson(d.get("blocks")),
                                "inventoryGainsJson", JSON.toJson(d.get("inventoryGains"))).entrySet()) {
                            JsonObject value = new JsonObject(); value.addProperty("stringValue", entry.getValue()); fields.add(entry.getKey(), value);
                        }
                        String name = "projects/" + PROJECT + "/databases/" + DATABASE + "/documents/daily/" + id;
                        JsonObject update = new JsonObject(); update.addProperty("name", name); update.add("fields", fields);
                        JsonObject transform = new JsonObject(); transform.addProperty("fieldPath", "updatedAt"); transform.addProperty("setToServerValue", "REQUEST_TIME");
                        JsonArray transforms = new JsonArray(); transforms.add(transform);
                        JsonObject write = new JsonObject(); write.add("update", update); write.add("updateTransforms", transforms);
                        JsonArray writes = new JsonArray(); writes.add(write);
                        JsonObject request = new JsonObject(); request.add("writes", writes);
                        send("https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/" + DATABASE + "/documents:commit", "POST", request, idToken);
                        uploaded.put(file.toString(), sha256(content));
                    } catch (Exception e) {
                        // One rejected/corrupt day cannot starve every later day. Retry on the next pass.
                        System.err.println("[Holzkopf Sync] Tagesstand nicht übertragen; erneuter Versuch in 30 Sekunden.");
                    }
                }
            }
        } catch (Exception e) {
            expiresAt = 0;
            System.err.println("[Holzkopf Sync] Verbindung nicht verfügbar. Anmeldung und Teamfreigabe im Dashboard prüfen.");
        }
    }

    private JsonObject send(String url, String method, JsonObject body, String token) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(20))
            .header("Content-Type", "application/json");
        if (token != null) builder.header("Authorization", "Bearer " + token);
        var response = http.send(builder.method(method, HttpRequest.BodyPublishers.ofString(JSON.toJson(body))).build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) throw new java.io.IOException("HTTP " + response.statusCode());
        return JsonParser.parseString(response.body()).getAsJsonObject();
    }
    static String sha256(String text) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
    }
}
