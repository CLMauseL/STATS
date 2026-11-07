# Holzkopf: Live-Teamdaten

## Neu in 0.4.1: nur Multiplayer, alle bereitgestellten Statistiken

Tracking ist ausschließlich bei einer externen Multiplayer-Verbindung aktiv. Singleplayer und der eigene integrierte LAN-Host werden nicht aufgezeichnet; auf einem fremden LAN-Server verbundene Spieler zählen als Multiplayer. Ein Wechsel in Singleplayer beendet die bisherige Multiplayer-Aufzeichnung sauber. In Singleplayer werden keine Statistik-Anfragen gesendet. Alte lokale Singleplayer-Dateien werden nicht hochgeladen. Die bekannte Singleplayer-Serverkennung wird zusätzlich in Firestore-Schreibregeln abgelehnt und aus allen Dashboard-Berechnungen, Importen und CSV-Berichten gefiltert. Bereits vorhandene Daten werden dadurch nicht gelöscht.

Der Tab **Alle Statistiken** zeigt sämtliche vom Server über die Vanilla-Statistikpakete übertragenen Zähler: allgemeine Aktionen sowie Statistiken pro Block, Item und Entity, einschließlich Abbau, Herstellung, Nutzung, zerbrochene Werkzeuge, Aufsammeln, Wegwerfen, Kills und Todesursachen-Entity. Er bietet Suche, Kategorie-/Spielerfilter und Seiten mit 100 Einträgen. Gleiche Statistik wird pro Spieler/Server nur aus dem neuesten Snapshot genommen und über unterschiedliche Server summiert. Die Tabellen verwenden die Minecraft-IDs, damit auch neue Items und modifizierte Registrierungen ohne Namensliste darstellbar bleiben.

Strecken mit `_one_cm` werden in Blöcke umgerechnet, andere Rohzähler bleiben ausdrücklich Minecraft-Zähler (z. B. Ticks oder Schadens-Untereinheiten, nicht pauschal Ereignisse). Es wird nur erfasst, was der Server tatsächlich als Statistik liefert. Keine Chattexte, kontinuierlichen Koordinaten oder fremden Spielerstatistiken werden damit ausgelesen. Jeder Spieler muss seine eigene Mod verbinden. Ohne Mod getätigte Aktionen können beim nächsten Statistikabruf im Server-Gesamtstand enthalten sein.

Die vollständige Snapshot-JSON ist auf 512 KiB begrenzt; übergroße Snapshots werden nicht hochgeladen, die festen Übersichtszähler weiterhin schon. Das Dashboard validiert IDs und ganzzahlige Zähler und verarbeitet höchstens 10.000 Statistikschlüssel pro Snapshot. Wie Ressourcen-JSON ist diese JSON für Firestore-Regeln inhaltlich undurchsichtig; sie dient nur zur Anzeige, niemals zur Autorisierung oder automatischen Auszahlung.

Zum Aktualisieren alte Tracker-JAR durch **0.4.1** ersetzen, Verbindungsdatei behalten und Minecraft neu starten. Ein Praxischeck im laufenden Minecraft bleibt erforderlich.

## Neu in Mod 0.4.0: Minecraft-Zähler und Tabs

Die Tabs Übersicht, Ranglisten, Essen, Kampf & Tode, Bewegung und Team/Anmeldung trennen die Bereiche. Die Mod fordert vanilla Minecraft-Statistiken nach dem Beitritt und danach alle 30 Sekunden an. Ein Mixin liest die vom Server übertragenen Zähler erst nach Verarbeitung durch Minecraft. Tode, Nahrung, Kuchenstücke, Mobs/Spieler besiegt, gezüchtete Tiere, Sprünge, Lauf-/Sprint-/Schwimmstrecke, Fische und Handel werden so als Gesamtstände erfasst.

Diese Gesamtstände können die bisherige Geschichte auf dem jeweiligen Server enthalten und werden **nicht** der aktuellen Berichtswoche zugeschlagen. Das Dashboard wählt pro Spieler/Server nur den neuesten Snapshot und summiert unterschiedliche Server; mehrere Tagesdateien zählen dieselben Gesamtstände nicht mehrfach. Gelaufene Blöcke = Minecraft-Zentimeter / 100. Nahrung = ITEM_USED für Items mit FOOD-Komponente; Kuchenstücke werden separat erfasst und für die Essensrangliste addiert. Serverdefinierte Spezialaktionen ohne Vanilla-Statistik sind nicht enthalten.

Fehlende Zähler bleiben „–“. Alte Mod-Versionen und Dateien funktionieren weiter, liefern diese neuen Werte aber nicht. Wenn der Server keine Statistikpakete sendet, bleiben die Werte unbekannt. Serverseitige Statistik-Resets werden als neuer Gesamtstand übernommen. Bei identischen Serveradressen werden ersetzte Welten nicht als unabhängige Serverhistorien zusammengerechnet. Ein echter Minecraft-Praxistest des Mixins bleibt erforderlich.

Zum Aktualisieren Minecraft schließen, die alte Tracker-JAR durch Version 0.4.0 ersetzen und wieder starten. `cloud-session.json` und vorhandene Tagesdateien behalten. Die optionalen `gameStats`-Felder werden durch Firestore strikt nach Schlüsseln, Integer-Typ und Wertebereich geprüft. Gesamtstände bleiben clientseitig übermittelt und sind keine Auszahlungsgarantie.

Projekt `holzkopf-stats-clmausel`, Datenbank `live`: Enterprise Native, **Zürich / europe-west6**, Echtzeit aktiviert. Dashboard: https://clmausel.github.io/STATS/

## Spieler verbinden

1. Im Dashboard Konto erstellen, E-Mail bestätigen und **Bestätigung prüfen** wählen. Passwort: mindestens zwölf Zeichen.
2. Der Projektinhaber gibt die E-Mail und den exakten Minecraft-Spielernamen frei (unten).
3. Passwort nochmals eingeben, **Eigene Mod verbinden** wählen. Die Datei `cloud-session.json` unter `.minecraft/config/farming-tracker/cloud-session.json` der richtigen Spielinstanz ablegen. Zusätzliche Downloadkopie löschen. Die Datei enthält einen privaten Spieler-Anmeldeschlüssel: niemals teilen oder in GitHub speichern.
4. Die normale JAR aus dem Build-Artefakt (nicht `-sources.jar`) zusammen mit Fabric API für Minecraft 26.2 installieren. Die laufende Mod erkennt die Verbindung innerhalb von 30 Sekunden. Auch bestehende lokale Tagesdateien des freigegebenen Spielers werden hochgeladen.

Die Mod enthält keinen Admin-/Service-Account-Schlüssel. Das Dashboard verwendet eine Browser-Sitzung. Abmelden beendet diese Sitzung; die Mod hat ihre eigene Verbindung. Entfernen der Verbindungsdatei stoppt künftige Synchronisierung. Bei verlorenem PC Teamfreigabe sofort entziehen und Refresh-Sitzungen widerrufen. Bereits ausgestellte ID-Tokens können bis zu einer Stunde gelten; entzogene Mitgliedschaft blockiert trotzdem weitere Datenzugriffe.

## Teamfreigabe verwalten

Auf dem vertrauenswürdigen Rechner des Projektinhabers, Node **24.12+**:

```sh
npm ci
npx firebase-tools login
node scripts/manage-member.mjs grant player@example.com ExactMinecraftName
node scripts/manage-member.mjs revoke player@example.com
node scripts/manage-member.mjs revoke-sessions player@example.com
```

Beispieladresse ersetzen. Spieler müssen zuerst ein Konto erstellen und bestätigen. Das Werkzeug nutzt die Google-Projektberechtigung der CLI-Anmeldung nur im Speicher. Bei eigener Anmeldeablage `XDG_CONFIG_HOME` wie beim Login setzen. Spieler können sich nicht selbst freigeben und keine Rollen setzen. Der Betreiber muss die Minecraft-Identität selbst prüfen: die Namenszuordnung ist eine Betreiberfreigabe, kein kryptografischer Minecraft-Besitznachweis.

## Synchronisierung und Grenzen

Die Mod speichert lokal ungefähr alle zehn Sekunden und lädt geänderte Tagesdateien im Hintergrund alle 30 Sekunden hoch. Fehler werden aus den lokalen Dateien erneut versucht; Spiel und Eingaben warten nicht auf das Netzwerk. Beim Beenden zuletzt gespeicherte, noch nicht hochgeladene Daten folgen beim nächsten Start.

UID + SHA-256(Serverhash + Datum) identifizieren Tagesstände eindeutig. Uploads ersetzen den Stand, statt Zeit zu addieren. Wiederholungen zählen deshalb nicht doppelt. Serveradressen werden vor dem Upload durch SHA-256 ersetzt. Cloud-Tagesdokumente enthalten weder E-Mail noch Passwort noch Serveradresse. Ressourcen liegen als größenbegrenzte JSON-Zeichenketten vor und werden im Dashboard vor der Anzeige validiert. Regeln können ihren JSON-Inhalt nicht prüfen; Clientstatistiken sind keine vertrauenswürdige Berechtigungs- oder Zahlungsquelle.

**Eine Tracking-Installation je Spieler verwenden.** Mehrere Rechner ersetzen denselben Spieler/Server/Tag gegenseitig; Zeitlinien werden nicht zusammengeführt. Lokale Tagesdateien sind die dauerhafte Wiederholungsablage: vor erfolgreichem Upload nicht löschen.

Das Dashboard nutzt Core-`onSnapshot`, weil Echtzeitdaten erforderlich sind. Live-Daten bleiben im Arbeitsspeicher und werden bei Abmeldung/Entzug gelöscht. Offline-Importe und Demos bleiben separat im lokalen Browser-Speicher und werden niemals hochgeladen. Der Schalter **Live-Teamdaten anzeigen** wählt die Quelle; Import/Demo wählt automatisch offline.

**5 Minuten AFK-Grenze, voller rückwirkender Abzug und 16 Diamanten pro aktiver Stunde bleiben bestehen.** Vorläufige Zeiten können beim Erreichen der AFK-Grenze sinken. Ein fehlgeschlagener lokaler Speichervorgang verändert die Zeitberechnung nicht mehr. Wie im bisherigen Tracker werden Inaktivitätsphasen beim Tages-, Serverwechsel oder Logout abgeschlossen; eine Pause über Mitternacht wird in Tagesabschnitte geteilt. Datum/Zeitzone stammen vom Spielrechner. Inventarzuwächse bleiben Schätzwerte, Tode/Breeding unbekannt. Keine automatische Diamantenauszahlung; Freigabe durch Betreiber erforderlich.

## Prüfen und veröffentlichen

Java **25**, Gradle **9.5.1**: im Ordner `mod` mit `gradle build --no-daemon` bauen. `check` prüft AFK-Grenzwerte 299999/300000 ms, rückwirkenden Abzug, Zeitaufteilung, wiederholte Snapshots und Lohnsatz. GitHub Actions baut für Pull Requests und `main`.

Node **24.12+**, Java **25**:

```sh
npm ci
npm run check:web
npm run test:rules
```

Regeltests laufen ausschließlich im Emulatorprojekt `demo-holzkopf`. Sie prüfen erlaubte Uploads und Updates mit sinkender Arbeitszeit, unberechtigte/gesperrte Konten, fremde Änderungen, Löschung, Selbstfreigabe, Schema, Pflichtfelder, Grenzen, Zeitstempel und Entzug. Produktiv wird die benannte Datenbank `live` verwendet.

```sh
npx firebase-tools deploy --only firestore --project holzkopf-stats-clmausel
```

Die Regeln sind ein getesteter Prototyp und sollten vor breiter Verteilung zusätzlich geprüft werden. Ein Minecraft-Test im Spiel bleibt erforderlich. Die Clientdaten sind manipulierbar.

## Aufbewahrung

Der Projektinhaber verwaltet Cloud-Export und Löschung über seine Google-Projektberechtigungen. Entzug einer Freigabe löscht keine historischen Statistiken. **Importe löschen** betrifft nur lokale Browser-Importe. Lokale Tagesdateien vor einem Rechnerwechsel sichern.
