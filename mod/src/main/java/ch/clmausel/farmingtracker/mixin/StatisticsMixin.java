package ch.clmausel.farmingtracker.mixin;

import ch.clmausel.farmingtracker.GameStatistics;
import net.minecraft.client.multiplayer.ClientPacketListener;
import net.minecraft.network.protocol.game.ClientboundAwardStatsPacket;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(ClientPacketListener.class)
abstract class StatisticsMixin {
    @Inject(method = "handleAwardStats", at = @At("TAIL"))
    private void holzkopf$stats(ClientboundAwardStatsPacket packet, CallbackInfo ci) {
        GameStatistics.received((ClientPacketListener) (Object) this, packet);
    }
}
