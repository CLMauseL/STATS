package ch.clmausel.farmingtracker;

/** Safe user-visible status only; no tokens, API responses or account identifiers. */
public final class CloudStatus {
    public static volatile String message="Noch nicht verbunden – Holzkopfarmy verbinden wählen";
    private CloudStatus() {}
}
