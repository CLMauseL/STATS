package ch.clmausel.farmingtracker;

/** No game launch required. Executed by Gradle check. */
public final class AccountingTest {
    public static void main(String[] args) {
        check(Accounting.includingIdle(0, 0, 299_999), 299_999, 0);
        check(Accounting.includingIdle(0, 0, 300_000), 0, 300_000);
        check(Accounting.includingIdle(60_000, 10_000, 600_000), 60_000, 610_000);
        // A later snapshot retroactively removes the full formerly provisional five minutes.
        var before = Accounting.includingIdle(120_000, 0, 299_999);
        var after = Accounting.includingIdle(120_000, 0, 300_000);
        if (before.workMs() != 419_999 || after.workMs() != 120_000) throw new AssertionError("retroactive deduction");
        if (after.workMs() + after.afkMs() != 420_000) throw new AssertionError("time partition");
        if (Accounting.diamonds(3_600_000) != 16 || Accounting.diamonds(1_800_000) != 8) throw new AssertionError("wages");
        // Snapshots are pure; repeated saves and retries must not inflate totals.
        check(Accounting.includingIdle(120_000, 0, 300_000), 120_000, 300_000);
        System.out.println("AFK boundary, retroactive deduction, time partition, wages and retry snapshots passed");
    }
    private static void check(Accounting.Totals t, long work, long afk) {
        if (t.workMs() != work || t.afkMs() != afk) throw new AssertionError(t.toString());
    }
}
