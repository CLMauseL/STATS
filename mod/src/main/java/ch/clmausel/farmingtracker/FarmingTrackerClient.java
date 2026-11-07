package ch.clmausel.farmingtracker;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.event.client.player.ClientPlayerBlockBreakEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.resources.Identifier;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.ItemStack;
import org.lwjgl.glfw.GLFW;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

/** Client-only tracker. Inventory increases are estimates, not authoritative pickup events. */
public final class FarmingTrackerClient implements ClientModInitializer {
    private static final Gson JSON = new GsonBuilder().setPrettyPrinting().create();
    private static final KeyMapping.Category CATEGORY = KeyMapping.Category.register(Identifier.fromNamespaceAndPath("farmingtracker", "controls"));
    private static final Path OUT = FabricLoader.getInstance().getConfigDir().resolve("farming-tracker");

    private final KeyMapping startStop = bind("startstop", GLFW.GLFW_KEY_F8);
    private final KeyMapping pause = bind("pause", GLFW.GLFW_KEY_F9);
    private final KeyMapping hud = bind("hud", GLFW.GLFW_KEY_F7);
    private final KeyMapping export = bind("export", GLFW.GLFW_KEY_F10);

    private Session active;
    private boolean paused = false;
    private boolean showHud = true;
    private long lastTickNs = -1L;
    private int hudTicks = 0;
    private int saveTicks = 0;
    private Map<String, Integer> lastInventory = new HashMap<>();
    private String lastWorld = "";
    // Lifetime tracking runs independently from manually started Farming sessions.
    private final Lifetime lifetime = new Lifetime();

    private static KeyMapping bind(String suffix, int key) {
        return KeyMappingHelper.registerKeyMapping(new KeyMapping("key.farmingtracker." + suffix, InputConstants.Type.KEYSYM, key, CATEGORY));
    }

    @Override
    public void onInitializeClient() {
        ClientPlayerBlockBreakEvents.AFTER.register((world, player, pos, state) -> {
            if (player == null) return;
            String id = BuiltInRegistries.BLOCK.getKey(state.getBlock()).toString();
            lifetime.broken(id);
            if (active == null || paused) return;
            active.blocks.merge(id, 1L, Long::sum);
            active.totalBlocks++;
        });
        ClientTickEvents.END_CLIENT_TICK.register(this::tick);
    }

    private void tick(Minecraft client) {
        if (client.player == null) {
            lifetime.leave();
            if (active != null) { saveSession(false); active = null; }
            lastTickNs = -1;
            lastInventory.clear();
            return;
        }
        while (startStop.consumeClick()) {
            if (active == null) start(client);
            else stop(client);
        }
        while (pause.consumeClick()) if (active != null) {
            paused = !paused;
            announce(client, paused ? "§eSession pausiert" : "§aSession fortgesetzt");
        }
        while (hud.consumeClick()) showHud = !showHud;
        while (export.consumeClick()) if (active != null) {
            saveSession(false);
            announce(client, "§aZwischenstand als JSON gespeichert");
        }
        long now = System.nanoTime();
        String worldName = client.getCurrentServer() == null ? "singleplayer" : client.getCurrentServer().ip;
        if (active != null && !worldName.equals(lastWorld)) {
            saveSession(false);
            paused = true;
            announce(client, "§eServer gewechselt: Session pausiert");
        }
        lastWorld = worldName;
        Map<String, Integer> currentInventory = snapshot(client);
        lifetime.tick(client, currentInventory);
        if (active != null && !paused) {
            if (lastTickNs > 0) active.activeMs += Math.max(0, Math.min(1_000L, (now - lastTickNs)/1_000_000L));
            // Inventory positive deltas are a PROXY for pickups and include other gains (crafting, containers, etc.).
            for (var entry : currentInventory.entrySet()) {
                int added = entry.getValue() - lastInventory.getOrDefault(entry.getKey(), 0);
                if (added > 0) {
                    active.inventoryGains.merge(entry.getKey(), (long) added, Long::sum);
                    active.totalInventoryGains += added;
                }
            }
            if (++saveTicks >= 200) { saveTicks = 0; saveSession(false); }
        }
        // F7 HUD is independent of F8 farming sessions; show lifetime stats at all times.
        if (++hudTicks >= 20) {
            hudTicks = 0;
            if (showHud) {
                String info;
                if (active != null) {
                    double hours = Math.max(1, active.activeMs) / 3_600_000.0;
                    info = String.format("§a⛏ %d Blöcke (%.1f/h) §7| §b+%d Items (%.1f/h) §7| §f%s%s",
                        active.totalBlocks, active.totalBlocks / hours,
                        active.totalInventoryGains, active.totalInventoryGains / hours,
                        clock(active.activeMs), paused ? " §ePAUSE" : "");
                } else {
                    info = lifetime.hudSummary();
                }
                client.player.sendOverlayMessage(Component.literal(info));
            }
        }
        lastInventory = currentInventory;
        lastTickNs = now;
    }

    private static Map<String, Integer> snapshot(Minecraft client) {
        Map<String, Integer> counts = new HashMap<>();
        if (client.player == null) return counts;
        for (int i = 0; i < client.player.getInventory().getContainerSize(); i++) {
            ItemStack stack = client.player.getInventory().getItem(i);
            if (stack.isEmpty()) continue;
            String id = BuiltInRegistries.ITEM.getKey(stack.getItem()).toString();
            counts.merge(id, stack.getCount(), Integer::sum);
        }
        return counts;
    }

    private void start(Minecraft client) {
        active = new Session();
        active.id = UUID.randomUUID().toString();
        active.player = client.player.getName().getString();
        active.startedAt = Instant.now().toString();
        active.server = client.getCurrentServer() == null ? "singleplayer" : client.getCurrentServer().ip;
        active.source = "client-inventory-delta-v0.1";
        active.schema = 1;
        paused = false;
        lastTickNs = System.nanoTime();
        lastInventory = snapshot(client);
        lastWorld = active.server;
        announce(client, "§aFarming-Session gestartet (F9 = Pause, F8 = Ende)");
    }

    private void stop(Minecraft client) {
        if (active == null) return;
        active.endedAt = Instant.now().toString();
        saveSession(true);
        announce(client, "§aFarming gespeichert! " + active.totalBlocks + " Blöcke, +" + active.totalInventoryGains + " Items");
        active = null;
        paused = false;
    }

    private void saveSession(boolean finished) {
        if (active == null) return;
        try {
            Files.createDirectories(OUT);
            active.updatedAt = Instant.now().toString();
            active.finished = finished;
            Path target = OUT.resolve("session-" + active.id + ".json");
            Path temp = OUT.resolve("session-" + active.id + ".tmp");
            Files.writeString(temp, JSON.toJson(active));
            Files.move(temp, target, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        } catch (Exception e) {
            System.err.println("[Farming Tracker] Konnte Session nicht speichern: " + e.getMessage());
        }
    }

    private static String clock(long ms) {
        long sec = ms / 1000;
        return String.format("%02d:%02d:%02d", sec/3600, (sec/60)%60, sec%60);
    }
    private static void announce(Minecraft client, String message) {
       if (client.player != null) client.player.sendSystemMessage(Component.literal(message));

    }
    /**
     * Conservative client-side estimator: movement, looking around, inventory change or block breaking
     * proves activity. No server-side attestation; standing still while using menus may be counted AFK.
     * Pending inactivity is assigned retroactively once the 5-minute threshold is reached.
     * On disconnect, a shorter idle spell counts as active, a longer one as AFK.
     */
    private static final class Lifetime {
        private static final long LIMIT = 5 * 60_000L;
        private static final Path DIRECTORY = OUT.resolve("daily");
        private Daily day;
        private long previousNs = -1, pendingIdleMs = 0;
        private double x, y, z, yaw, pitch;
        private boolean initialized = false, blockActivity = false;
        private Map<String, Integer> previousInventory = new HashMap<>();

        String hudSummary() {
            if (day == null) return "§aSwissCraft STATS §7| §fNoch keine Tagesdaten";
            long activeMs = day.workMs + (pendingIdleMs < LIMIT ? pendingIdleMs : 0);
            long afkMs = day.afkMs + (pendingIdleMs >= LIMIT ? pendingIdleMs : 0);
            double diamonds = activeMs * 16.0 / 3_600_000.0;
            return String.format("§aSwissCraft §7| §fOnline %s §7| §bArbeit %s §7| §eAFK %s §7| §b%.1f 💎",
                clock(day.onlineMs), clock(activeMs), clock(afkMs), diamonds);
        }

        void broken(String id) {
            if (day != null) day.blocks.merge(id, 1L, Long::sum);
            blockActivity = true;
        }

        void tick(Minecraft client, Map<String, Integer> inventory) {
            String server = client.getCurrentServer() == null ? "singleplayer" : client.getCurrentServer().ip;
            String player = client.player.getName().getString();
            String date = LocalDate.now().toString();
            if (day == null || !day.date.equals(date) || !day.server.equals(server) || !day.player.equals(player)) {
                leave();
                day = readDay(date, player, server);
            }
            long now = System.nanoTime();
            double nx = client.player.getX(), ny = client.player.getY(), nz = client.player.getZ();
            float newYaw = client.player.getYRot(), newPitch = client.player.getXRot();
            boolean changedInventory = !inventory.equals(previousInventory);
            boolean moved = !initialized || nx != x || ny != y || nz != z || newYaw != yaw || newPitch != pitch;
            boolean activity = moved || changedInventory || blockActivity;
            long delta = previousNs < 0 ? 0 : Math.max(0, Math.min(1000, (now - previousNs)/1_000_000L));
            day.onlineMs += delta;
            pendingIdleMs += delta;
            if (activity) {
                if (pendingIdleMs >= LIMIT) day.afkMs += pendingIdleMs;
                else day.workMs += pendingIdleMs;
                pendingIdleMs = 0;
            }
            if (changedInventory && initialized) {
                for (var e : inventory.entrySet()) {
                    int gained = e.getValue() - previousInventory.getOrDefault(e.getKey(), 0);
                    if (gained > 0) day.inventoryGains.merge(e.getKey(), (long)gained, Long::sum);
                }
            }
            previousInventory = new HashMap<>(inventory);
            previousNs = now;
            x = nx; y = ny; z = nz; yaw = newYaw; pitch = newPitch;
            initialized = true; blockActivity = false;
            if ((++day.saveTick % 200) == 0) save(false);
        }

        void leave() {
            if (day != null) {
                settle();
                save(true);
            }
            day = null;
            previousNs = -1;
            initialized = false;
            pendingIdleMs = 0;
            previousInventory.clear();
            blockActivity = false;
        }

        private void settle() {
            if (day == null) return;
            if (pendingIdleMs >= LIMIT) day.afkMs += pendingIdleMs;
            else day.workMs += pendingIdleMs;
            pendingIdleMs = 0;
        }

        private Daily readDay(String date, String player, String server) {
            // Keep different servers in separate files, without writing their addresses into filenames.
            String serverHash = Integer.toUnsignedString(server.hashCode(), 16);
            String name = player.replaceAll("[^A-Za-z0-9_-]", "_");
            Path file = DIRECTORY.resolve(name + "-" + serverHash + "-" + date + ".json");
            try {
                if (Files.isRegularFile(file)) {
                    Daily d = JSON.fromJson(Files.readString(file), Daily.class);
                    if (d != null && date.equals(d.date) && player.equals(d.player) && server.equals(d.server)) {
                        d.file = file;
                        if (d.blocks == null) d.blocks = new TreeMap<>();
                        if (d.inventoryGains == null) d.inventoryGains = new TreeMap<>();
                        return d;
                    }
                }
            } catch (Exception e) { System.err.println("[Farming Tracker] Daily read: " + e.getMessage()); }
            Daily d = new Daily(); d.date = date; d.player = player; d.server = server; d.file = file;
            return d;
        }

        private void save(boolean finalizing) {
            if (day == null) return;
            try {
                Files.createDirectories(DIRECTORY);
                // Work/AFK totals always partition online time; pending idle is a provisional estimate.
                long pending = pendingIdleMs;
                if (!finalizing) {
                    if (pending >= LIMIT) day.afkMs += pending;
                    else day.workMs += pending;
                }
                Path tmp = day.file.resolveSibling(day.file.getFileName() + ".tmp");
                Files.writeString(tmp, JSON.toJson(day));
                Files.move(tmp, day.file, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                if (!finalizing) {
                    if (pending >= LIMIT) day.afkMs -= pending;
                    else day.workMs -= pending;
                }
            } catch (Exception e) { System.err.println("[Farming Tracker] Daily save: " + e.getMessage()); }
        }
    }

    private static final class Daily {
        int schema = 2;
        String type = "daily", player, date, server;
        long onlineMs, workMs, afkMs;
        Map<String, Long> blocks = new TreeMap<>(), inventoryGains = new TreeMap<>();
        // Unknown until tested with authoritative or synced Minecraft stat counters.
        Integer deaths = null, breeding = null;
        transient Path file;
        transient long saveTick;
    }

    private static final class Session {
        int schema;
        String id, player, server, source, startedAt, endedAt, updatedAt;
        long activeMs, totalBlocks, totalInventoryGains;
        boolean finished;
        Map<String, Long> blocks = new TreeMap<>();
        Map<String, Long> inventoryGains = new TreeMap<>();
    }
}
