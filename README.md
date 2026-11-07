# SwissCraft Analytics – Wochenbericht / Lifetime MVP (v0.2 source)

**Status:** Quellcode und lokale Webseite erstellt, Java-Mod **nicht kompiliert / nicht im Spiel getestet**. Die Webseite wurde auf JavaScript-Syntax geprüft. Minecraft Java 26.2 / Fabric. Eine zuverlässige Online-Mehrspieler-Synchronisierung gibt es noch nicht.

## Inhalt
- `mod/` – eigenständige Fabric-Client-Mod. Nicht mit der Ancient Countdown Mod verwechseln.
- `team-web/index.html` – lokale Offline-Webseite mit Team-Wochenbericht und Lifetime-Ansicht.
- `example-data/*daily.json` – Beispieldateien für Website-Test. Keine echten Spielerwerte.

## Lifetime-Aufzeichnung
Sobald der Minecraft-Client mit der Mod auf einem Server oder in Singleplayer läuft, schreibt die Mod jeden Tag `config/farming-tracker/daily/<Spieler>-<ServerHash>-YYYY-MM-DD.json` und aktualisiert die Datei ungefähr alle zehn Sekunden, beim Logout, Serverwechsel oder Tageswechsel.

Die Datei enthält:
- `onlineMs`: Zeit im Spiel (Client muss laufen)
- `workMs`: angerechnete Onlinezeit
- `afkMs`: als AFK erkannte Zeit
- `blocks`: clientseitig abgebaute Blöcke nach ID
- `inventoryGains`: **Netto-Inventarzuwächse, keine verifizierten Boden-Pickups**
- `deaths`, `breeding`: **null = noch nicht verlässlich erfasst**

**AFK-Regel:** Nach 5 Minuten ohne festgestellte Aktivität wird die komplette Inaktivitätsphase rückwirkend AFK. Bewegung, Blickrichtungsänderung, Blockabbau und Inventaränderung zählen als Aktivität. Das ist eine erste Heuristik, keine fälschungssichere oder vollständige Eingabeerkennung: stationäre Aktionen können als AFK gelten; Makros können Aktivität vortäuschen. Bei weniger als 5 Minuten Pause wird diese Zeit vergütet. Beim Clientabsturz können letzte Sekunden verloren gehen.

Lohnsatz: **16 Diamanten je aktiver Arbeitsstunde**. Rechenwerte sind Vorschläge; keine automatische Minecraft-Diamantenauszahlung. Ein Admin sollte Auszahlungen freigeben.

**Wichtig:** Tracking läuft auch ohne manuelle Farming-Session. F8 Start/Stopp, F9 Pause, F7 HUD, F10 Export betreffen weiterhin die separate Farming-Session. Das Teamdashboard verarbeitet v0.2-Tagesdateien, NICHT automatisch die alten v0.1-Session-Dateien.

## Wochenberichte
Öffne `team-web/index.html` im Browser und importiere die `daily`-JSON-Dateien von jedem Teammitglied. Woche ist Montag–Sonntag. Spielerfilter, aktive Arbeitszeit, AFK, Lohn, Ressourcen und Lifetime-Vergleich werden aus den importierten Tagesdateien errechnet. `CSV` exportiert den gewählten Wochenbericht. Zum Test kannst du `Beispieldaten laden` klicken.

Die statische Webseite verwendet nur lokalen Browser-Speicher; importierte Daten bleiben im jeweiligen Browser. **Noch KEINE geteilte Team-Cloud, kein automatischer Sync, keine Scheduler-/PDF-Berichtserstellung.** Dafür folgt später Firebase Auth/Firestore mit Team-Einladungen, Zugriffsregeln, täglichem Upload und Administrator-Freigaben. Auch ein gehosteter Web-Link müsste erst veröffentlicht werden.

## Build
1. Neues Repository für den Tracker erstellen; **nur den Inhalt von `mod/`** ins Repo-Root hochladen.
2. Auf GitHub **Actions → Build Farming Tracker** ausführen.
3. Falls der Build erfolgreich ist, die normale `.jar`, nicht die `-sources.jar`, in den `mods`-Ordner der Fabric-26.2-Instanz legen.
4. Die hier verwendeten 26.2-Mappings/Methoden sind **noch nicht gegen einen Build verifiziert**; Fehlerlogs können weitere Anpassungen nötig machen.

## Datenschutz
Jeder Teilnehmer entscheidet selbst, welche Daten er teilt. Servernamen/IP-Adressen stehen derzeit in lokalen JSON-Dateien; vor öffentlichem Teilen Dateien prüfen. Die Client-Daten sind manipulierbar. Für eine belastbare Lohnabrechnung braucht es Zustimmungs- und Admin-Prozesse.
