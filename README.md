# SwissCraft Analytics – Wochenbericht / Lifetime MVP (v0.2 source)

**Aktuell:** Firebase-Anmeldung, private Teamfreigaben, automatische Mod-Synchronisierung und Live-Dashboard sind ergänzt. Einrichtung, Tests und Einschränkungen stehen in [FIREBASE.md](FIREBASE.md). Minecraft Java 26.2 / Fabric; ein Test im Spiel ist weiterhin erforderlich. Die folgenden Abschnitte beschreiben außerdem den bisherigen Offline-Import.

**Mod 0.4.0:** Neue Tabs und Ranglisten für Tode, Essen, gelaufene Blöcke, Sprünge, Kampf und weitere Minecraft-Gesamtzähler. Die zuvor nicht erfassten Tode/Breeding werden nun über die Vanilla-Statistiken synchronisiert und getrennt vom Wochenlohn angezeigt. Alte Tagesdateien ohne diese Werte bleiben unbekannt.

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

Die statische Webseite unterstützt jetzt zusätzlich private Firebase-Live-Daten. Offline-Importe bleiben im jeweiligen Browser und werden nicht hochgeladen. Anmeldung und Teamfreigabe siehe [FIREBASE.md](FIREBASE.md). Scheduler und PDF-Berichte sind nicht enthalten.

## Build
1. Dieses Repository verwenden; die Mod bleibt im Unterordner `mod/`.
2. Auf GitHub **Actions → Build SwissCraft STATS** ausführen.
3. Falls der Build erfolgreich ist, die normale `.jar`, nicht die `-sources.jar`, in den `mods`-Ordner der Fabric-26.2-Instanz legen.
4. Die hier verwendeten 26.2-Mappings/Methoden sind **noch nicht gegen einen Build verifiziert**; Fehlerlogs können weitere Anpassungen nötig machen.

## Datenschutz
Jeder Teilnehmer entscheidet selbst, welche Daten er teilt. Servernamen/IP-Adressen stehen derzeit in lokalen JSON-Dateien; vor öffentlichem Teilen Dateien prüfen. Die Client-Daten sind manipulierbar. Für eine belastbare Lohnabrechnung braucht es Zustimmungs- und Admin-Prozesse.
