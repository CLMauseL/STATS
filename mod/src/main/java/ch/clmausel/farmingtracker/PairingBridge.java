package ch.clmausel.farmingtracker;

import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Util;
import net.fabricmc.loader.api.FabricLoader;
import java.time.Duration;

public final class PairingBridge {
    private static LocalPairingServer pending;
    public static volatile String status="Noch nicht verbunden";
    private PairingBridge() {}
    public static synchronized void open(){
        try{
            if(pending!=null)pending.close();
            var client=Minecraft.getInstance();
            pending=new LocalPairingServer(FabricLoader.getInstance().getConfigDir().resolve("farming-tracker"),client.getUser().getName(),Duration.ofMinutes(5),message->{status=message;CloudStatus.message=message;client.execute(()->{if(client.player!=null)client.player.sendSystemMessage(Component.literal("[Holzkopfarmy] "+message));});});
            status="Browser geöffnet – dort anmelden und Mod verbinden";CloudStatus.message=status;
            Util.getPlatform().openUri(pending.browserUri());
        }catch(Exception failure){status="Browser-Verbindung fehlgeschlagen – erneut im Menü versuchen";CloudStatus.message=status;}
    }
}
