package ch.clmausel.farmingtracker;

import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientPacketListener;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.protocol.game.ServerboundClientCommandPacket;
import net.minecraft.stats.Stats;
import net.minecraft.stats.Stat;
import net.minecraft.network.protocol.game.ClientboundAwardStatsPacket;
import java.util.Map;
import java.util.TreeMap;

/** Server-owned vanilla cumulative counters, never attributed to today's work time. */
public final class GameStatistics {
    private static ClientPacketListener connection;
    private static long nextRequest, sampledAt;
    private static boolean requested;
    private static Long previousCake;
    private static Map<String, Long> latest;
    private static final Map<String, Long> vanilla = new TreeMap<>();
    private GameStatistics() {}

    static void tick(Minecraft client) {
        var current = client.player == null || !TrackingScope.multiplayer(client.hasSingleplayerServer(), client.getCurrentServer() != null)
            ? null : client.getConnection();
        if (current != connection) {
            connection = current; latest = null; sampledAt = 0; requested = false; vanilla.clear();
            previousCake = null;
            nextRequest = System.nanoTime() + 1_000_000_000L;
        }
        if (current != null && System.nanoTime() >= nextRequest) {
            requested = true;
            current.send(new ServerboundClientCommandPacket(ServerboundClientCommandPacket.Action.REQUEST_STATS));
            nextRequest = System.nanoTime() + 30_000_000_000L;
        }
    }

    // Called at TAIL, after the vanilla handler has merged the packet into the player's stats.
    public static void received(ClientPacketListener source, ClientboundAwardStatsPacket packet) {
        var client = Minecraft.getInstance();
        if (source != connection || !requested || client.player == null) return;
        for (var entry : packet.stats().object2IntEntrySet()) {
            vanilla.put(statKey(entry.getKey()), (long) Math.max(0, entry.getIntValue()));
        }
        var counter = client.player.getStats();
        Map<String, Long> values = new TreeMap<>();
        values.put("deaths", (long) counter.getValue(Stats.CUSTOM, Stats.DEATHS));
        values.put("mobKills", (long) counter.getValue(Stats.CUSTOM, Stats.MOB_KILLS));
        values.put("playerKills", (long) counter.getValue(Stats.CUSTOM, Stats.PLAYER_KILLS));
        values.put("breeding", (long) counter.getValue(Stats.CUSTOM, Stats.ANIMALS_BRED));
        values.put("jumps", (long) counter.getValue(Stats.CUSTOM, Stats.JUMP));
        values.put("walkCm", (long) counter.getValue(Stats.CUSTOM, Stats.WALK_ONE_CM));
        values.put("sprintCm", (long) counter.getValue(Stats.CUSTOM, Stats.SPRINT_ONE_CM));
        values.put("swimCm", (long) counter.getValue(Stats.CUSTOM, Stats.SWIM_ONE_CM));
        values.put("fishCaught", (long) counter.getValue(Stats.CUSTOM, Stats.FISH_CAUGHT));
        values.put("trades", (long) counter.getValue(Stats.CUSTOM, Stats.TRADED_WITH_VILLAGER));
        values.put("cakeSlices", (long) counter.getValue(Stats.CUSTOM, Stats.EAT_CAKE_SLICE));
        long cake = values.get("cakeSlices");
        if (previousCake != null && cake > previousCake) FarmingTrackerClient.consumedFood("minecraft:cake", cake - previousCake);
        previousCake = cake;
        // Legacy field for older readers only: ITEM_USED may include planting.
        // The food leaderboard exclusively uses observed daily foodConsumed.
        long food = 0;
        for (var item : BuiltInRegistries.ITEM) {
            if (item.components().has(DataComponents.FOOD)) food += Math.max(0, counter.getValue(Stats.ITEM_USED, item));
        }
        values.put("foodEaten", food);
        latest = values; sampledAt = System.currentTimeMillis();
    }
    static Map<String, Long> snapshot() { return latest == null ? null : new TreeMap<>(latest); }
    static long sampledAt() { return sampledAt; }
    static Map<String, Long> vanillaSnapshot() { return latest == null ? null : new TreeMap<>(vanilla); }
    private static <T> String statKey(Stat<T> stat) {
        return BuiltInRegistries.STAT_TYPE.getKey(stat.getType()) + "/" + stat.getType().getRegistry().getKey(stat.getValue());
    }
}
