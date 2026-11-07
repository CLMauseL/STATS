package ch.clmausel.farmingtracker;

import com.google.gson.*;
import com.sun.net.httpserver.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;

/** Short-lived, origin- and nonce-bound return channel. Never exposes credentials over GET. */
public final class LocalPairingServer implements AutoCloseable {
    private static final String ORIGIN = "https://clmausel.github.io";
    private final HttpServer server;
    private final ScheduledExecutorService executor;
    private final Path directory;
    private final String player, nonce;
    private final Consumer<String> status;
    private final long expires;
    private volatile boolean completed;
    public LocalPairingServer(Path directory, String player, Duration ttl, Consumer<String> status) throws Exception {
        if (!player.matches("[A-Za-z0-9_]{1,16}")) throw new IllegalArgumentException("Invalid player");
        this.directory=directory;this.player=player;this.status=status;
        byte[] random=new byte[32];new SecureRandom().nextBytes(random);nonce=HexFormat.of().formatHex(random);
        expires=System.nanoTime()+ttl.toNanos();
        server=HttpServer.create(new InetSocketAddress(InetAddress.getByName("127.0.0.1"),0),0);
        executor=Executors.newScheduledThreadPool(2,r->{Thread t=new Thread(r,"holzkopf-pairing");t.setDaemon(true);return t;});
        server.setExecutor(executor);server.createContext("/pair",this::receive);server.start();
        executor.schedule(()->{if(!completed)status.accept("Anmeldung abgelaufen – Verbindung erneut öffnen");close();},ttl.toMillis(),TimeUnit.MILLISECONDS);
    }
    public URI browserUri() {
        return URI.create(ORIGIN+"/STATS/?pairPort="+server.getAddress().getPort()+"&player="+player+"#pair="+nonce);
    }
    private synchronized void receive(HttpExchange request) throws java.io.IOException {
        try {
            String origin=request.getRequestHeaders().getFirst("Origin");
            if(!ORIGIN.equals(origin)||!request.getRequestURI().toString().equals("/pair")
                ||!("127.0.0.1:"+server.getAddress().getPort()).equals(request.getRequestHeaders().getFirst("Host"))){respond(request,403);return;}
            var headers=request.getResponseHeaders();headers.set("Access-Control-Allow-Origin",ORIGIN);headers.set("Vary","Origin");
            headers.set("Cache-Control","no-store");headers.set("Access-Control-Allow-Private-Network","true");
            if(request.getRequestMethod().equals("OPTIONS")){
                headers.set("Access-Control-Allow-Methods","POST, OPTIONS");headers.set("Access-Control-Allow-Headers","Content-Type, X-Holzkopf-Pairing");respond(request,204);return;
            }
            if(!request.getRequestMethod().equals("POST")){respond(request,405);return;}
            String supplied=request.getRequestHeaders().getFirst("X-Holzkopf-Pairing");
            if(supplied==null||!MessageDigest.isEqual(nonce.getBytes(StandardCharsets.US_ASCII),supplied.getBytes(StandardCharsets.US_ASCII))){respond(request,403);return;}
            if(completed||System.nanoTime()>expires){respond(request,410);return;}
            if(!"application/json".equals(request.getRequestHeaders().getFirst("Content-Type"))){respond(request,415);return;}
            byte[] bytes=request.getRequestBody().readNBytes(16385);if(bytes.length>16384){respond(request,413);return;}
            JsonObject config;
            try {
                var incoming=JsonParser.parseString(new String(bytes,StandardCharsets.UTF_8)).getAsJsonObject();
                if(!"holzkopf-stats-clmausel".equals(incoming.get("projectId").getAsString())||!"live".equals(incoming.get("databaseId").getAsString())
                    ||!player.equals(incoming.get("player").getAsString())){respond(request,400);return;}
                config=new JsonObject();
                for(String key:List.of("projectId","databaseId","apiKey","uid","player","refreshToken")){
                    String value=incoming.get(key).getAsString();if(value.isBlank()||value.length()>(key.equals("refreshToken")?8192:256))throw new IllegalArgumentException();config.addProperty(key,value);
                }
            }catch(Exception invalid){respond(request,400);return;}
            Files.createDirectories(directory);Path temporary=directory.resolve("cloud-session.json.tmp");
            Files.writeString(temporary,new Gson().toJson(config),StandardCharsets.UTF_8);
            try{Files.move(temporary,directory.resolve("cloud-session.json"),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}
            catch(AtomicMoveNotSupportedException unsupported){Files.move(temporary,directory.resolve("cloud-session.json"),StandardCopyOption.REPLACE_EXISTING);}
            completed=true;status.accept("Anmeldung für "+player+" gespeichert – Upload wird geprüft");respond(request,200);
            executor.schedule(this::close,1,TimeUnit.SECONDS);
        } catch(Exception failure){status.accept("Verbindung konnte nicht gespeichert werden – erneut versuchen");respond(request,500);}
        finally{request.close();}
    }
    private static void respond(HttpExchange request,int code) throws java.io.IOException {
        request.getResponseHeaders().set("Content-Type","application/json");
        if(code==204){request.sendResponseHeaders(code,-1);return;}
        byte[] bytes=(code==200?"{\"ok\":true}":"{\"ok\":false}").getBytes(StandardCharsets.UTF_8);
        request.sendResponseHeaders(code,bytes.length);request.getResponseBody().write(bytes);
    }
    public void close(){server.stop(0);executor.shutdownNow();}
}
