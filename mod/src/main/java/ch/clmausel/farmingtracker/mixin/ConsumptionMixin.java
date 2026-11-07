package ch.clmausel.farmingtracker.mixin;

import ch.clmausel.farmingtracker.FarmingTrackerClient;
import net.minecraft.client.Minecraft;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.entity.LivingEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** The remote server's completion event invokes this after the use/stack checks.
 * Planting, pickups, crafting and cancelled use never invoke finishUsingItem. */
@Mixin(LivingEntity.class)
abstract class ConsumptionMixin {
    @Inject(method = "completeUsingItem", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/item/ItemStack;finishUsingItem(Lnet/minecraft/world/level/Level;Lnet/minecraft/world/entity/LivingEntity;)Lnet/minecraft/world/item/ItemStack;"))
    private void holzkopf$consumed(CallbackInfo ci) {
        var client = Minecraft.getInstance();
        if ((Object) this != client.player) return;
        var stack = ((LivingEntity) (Object) this).getUseItem();
        if (stack.isEmpty() || !stack.has(DataComponents.FOOD)) return;
        FarmingTrackerClient.consumedFood(BuiltInRegistries.ITEM.getKey(stack.getItem()).toString(), 1);
    }
}
