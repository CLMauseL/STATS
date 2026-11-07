package ch.clmausel.farmingtracker.mixin;

import ch.clmausel.farmingtracker.FarmingTrackerClient;
import net.minecraft.client.Minecraft;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.context.BlockPlaceContext;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Counts successful local block placements, not generic item-use attempts. */
@Mixin(BlockItem.class)
abstract class PlacementMixin {
    @Inject(method = "place", at = @At("RETURN"))
    private void holzkopf$placed(BlockPlaceContext context, CallbackInfoReturnable<InteractionResult> cir) {
        if (context.getPlayer() != Minecraft.getInstance().player || !cir.getReturnValue().consumesAction()) return;
        FarmingTrackerClient.placedBlock(BuiltInRegistries.BLOCK.getKey(((BlockItem)(Object)this).getBlock()).toString());
    }
}
