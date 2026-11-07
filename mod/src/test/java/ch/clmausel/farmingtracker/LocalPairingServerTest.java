package ch.clmausel.farmingtracker;
import java.net.*;
import java.net.http.*;
import java.nio.file.*;
import java.time.Duration;
import com.google.gson.*;

public final class LocalPairingServerTest {
    private static final HttpClient HTTP=HttpClient.newHttpClient();
    private static HttpResponse<String> call(LocalPairingServer server,String method,String origin,String nonce,String body) throws Exception {
        URI page=server.browserUri();String port=page.getQuery().split("&")[0].split("=")[1];
        var b=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/pair")).header("Origin",origin).header("Content-Type","application/json").header("X-Holzkopf-Pairing",nonce);
        return HTTP.send(b.method(method,HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());
    }
    private static void check(boolean value){if(!value)throw new AssertionError();}
    public static void main(String[] args) throws Exception {
        Path directory=Files.createTempDirectory("holzkopf-pair-test");
        String origin="https://clmausel.github.io";
        String config="{\"projectId\":\"holzkopf-stats-clmausel\",\"databaseId\":\"live\",\"player\":\"TestPlayer\",\"uid\":\"test_uid\",\"apiKey\":\"test_key\",\"refreshToken\":\"test_only_not_a_credential\"}";
        try(var server=new LocalPairingServer(directory,"TestPlayer",Duration.ofMinutes(1),message->{})){
            String nonce=server.browserUri().getFragment().substring(5);
            check(call(server,"POST","https://evil.example",nonce,config).statusCode()==403);
            check(call(server,"POST",origin,"wrong",config).statusCode()==403);
            check(call(server,"GET",origin,nonce,"").statusCode()==405);
            check(call(server,"POST",origin,nonce,config.replace("TestPlayer","OtherPlayer")).statusCode()==400);
            check(call(server,"POST",origin,nonce,"x".repeat(16385)).statusCode()==413);
            check(!Files.exists(directory.resolve("cloud-session.json")));
            var preflight=call(server,"OPTIONS",origin,"","");check(preflight.statusCode()==204);
            check(preflight.headers().firstValue("Access-Control-Allow-Origin").orElse("").equals(origin));
            var success=call(server,"POST",origin,nonce,config);check(success.statusCode()==200);check(!success.body().contains("test_only"));
            var saved=JsonParser.parseString(Files.readString(directory.resolve("cloud-session.json"))).getAsJsonObject();check(saved.get("player").getAsString().equals("TestPlayer"));
            check(call(server,"POST",origin,nonce,config).statusCode()==410);
        }
        try(var server=new LocalPairingServer(directory,"TestPlayer",Duration.ofMillis(300),message->{})){
            String nonce=server.browserUri().getFragment().substring(5);Thread.sleep(500);
            try{call(server,"POST",origin,nonce,config);throw new AssertionError("expired bridge accepted request");}catch(java.io.IOException expected){}
        }
        Files.deleteIfExists(directory.resolve("cloud-session.json"));Files.delete(directory);
        System.out.println("Pairing: origin, nonce, method, player, size, CORS, atomic save, replay and expiry passed");
    }
}
