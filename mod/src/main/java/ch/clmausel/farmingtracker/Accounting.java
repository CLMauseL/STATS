package ch.clmausel.farmingtracker;

/** Shared boundary rules for provisional idle time and suggested wages. */
final class Accounting {
    static final long AFK_LIMIT_MS = 300_000L;
    record Totals(long workMs, long afkMs) {}
    static Totals includingIdle(long workMs, long afkMs, long pendingMs) {
        return pendingMs >= AFK_LIMIT_MS
            ? new Totals(workMs, afkMs + pendingMs)
            : new Totals(workMs + pendingMs, afkMs);
    }
    static double diamonds(long activeMs) { return activeMs * 16.0 / 3_600_000.0; }
}
