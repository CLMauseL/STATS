package ch.clmausel.farmingtracker.mixin;

import ch.clmausel.farmingtracker.PairingBridge;
import ch.clmausel.farmingtracker.CloudStatus;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.AlertScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.network.chat.Component;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin({TitleScreen.class,PauseScreen.class})
abstract class ConnectionMenuMixin extends Screen {
    protected ConnectionMenuMixin(Component title){super(title);}
    @Inject(method="init",at=@At("TAIL"))
    private void holzkopf$connection(CallbackInfo ci){
        int controlWidth=Math.min(190,(width-24)/2);
        addRenderableWidget(Button.builder(Component.literal("Holzkopfarmy verbinden"),b->PairingBridge.open()).bounds(8,8,controlWidth,20).build());
        addRenderableWidget(Button.builder(Component.literal("Verbindungsstatus"),b->{var client=Minecraft.getInstance();client.setScreenAndShow(new AlertScreen(()->client.setScreenAndShow(this),Component.literal("Holzkopfarmy · Verbindungsstatus"),Component.literal(CloudStatus.message)));}).bounds(16+controlWidth,8,controlWidth,20).build());
    }
}

