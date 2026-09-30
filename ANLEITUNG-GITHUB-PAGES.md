# DESADViewer auf GitHub Pages veröffentlichen

Diese Anleitung bringt DESADViewer kostenlos ins Internet, zum Beispiel unter
`https://IHR-NAME.github.io/desadviewer/`. Danach können Sie und andere die Seite
ohne Installation im Browser öffnen.

**Zeitbedarf:** beim ersten Mal etwa 30 Minuten. Spätere Aktualisierungen brauchen nur drei Befehle.

> **Gut zu wissen**
> - **GitHub** ist ein Dienst, auf dem Programmcode gespeichert wird.
>   **GitHub Pages** macht daraus eine Webseite.
> - **Git** ist ein Programm auf Ihrem Rechner, das Ihre Dateien zu GitHub hochlädt.
> - Für die kostenlose Veröffentlichung muss das Projekt **öffentlich** sein. Jeder kann dann den
>   Programmcode und die (erfundenen) Beispieldateien sehen. **Legen Sie niemals echte
>   Lieferavise in den Projektordner**, höchstens in den Ordner `privat/`. Dieser wird nie hochgeladen.
> - Das Bauen und Veröffentlichen übernimmt GitHub automatisch. Die Anleitung dafür steckt in
>   der Datei `.github/workflows/deploy.yml`.

---

## Übersicht

1. [Git installieren](#schritt-1-git-installieren) (einmalig)
2. [Git Ihren Namen mitteilen](#schritt-2-git-ihren-namen-mitteilen) (einmalig)
3. [GitHub-Konto anlegen](#schritt-3-github-konto-anlegen) (einmalig)
4. [Leeres Repository auf GitHub anlegen](#schritt-4-leeres-repository-auf-github-anlegen) (einmalig)
5. [Projekt hochladen](#schritt-5-projekt-hochladen) (einmalig)
6. [GitHub Pages einschalten](#schritt-6-github-pages-einschalten) (einmalig)
7. [Seite aufrufen](#schritt-7-seite-aufrufen)
8. [Später: Änderungen veröffentlichen](#später-änderungen-veröffentlichen)

---

## Schritt 1: Git installieren

Öffnen Sie **PowerShell**. Drücken Sie die Windows-Taste, tippen Sie `PowerShell` und drücken Sie Enter.
Geben Sie dann ein:

```bash
winget install --id Git.Git -e --source winget
```

Bestätigen Sie eventuelle Rückfragen. Falls `winget` nicht funktioniert, laden Sie Git von
<https://git-scm.com/download/win> herunter. Im Installationsprogramm können Sie überall die
vorgeschlagenen Einstellungen übernehmen und immer auf „Next“ klicken.

**Danach PowerShell schließen und neu öffnen.** Prüfen Sie dann:

```bash
git --version
```

✅ Es erscheint etwas wie `git version 2.xx.x`.

---

## Schritt 2: Git Ihren Namen mitteilen

Git vermerkt bei jeder Änderung, wer sie gemacht hat. Diese Angaben werden **öffentlich** sichtbar.

```bash
git config --global user.name "Ihr Name"
```

Für die E-Mail-Adresse empfehle ich die **anonyme GitHub-Adresse**, damit Ihre echte Adresse nicht
öffentlich wird. Sie finden sie nach Schritt 3 auf GitHub unter **Settings → Emails**, bei
„Keep my email addresses private“. Sie sieht etwa so aus: `12345678+name@users.noreply.github.com`.

```bash
git config --global user.email "12345678+name@users.noreply.github.com"
```

Sie können Schritt 2 auch nach Schritt 3 erledigen.

---

## Schritt 3: GitHub-Konto anlegen

Falls Sie noch keines haben: Auf <https://github.com> auf **„Sign up“** klicken und den
Anweisungen folgen. Das kostenlose Konto reicht völlig.

Merken Sie sich Ihren **Benutzernamen**, er ist später Teil der Web-Adresse.

---

## Schritt 4: Leeres Repository auf GitHub anlegen

Ein **Repository** („Repo“) ist ein Projektordner auf GitHub.

1. Auf GitHub oben rechts auf **„+“** klicken und **„New repository“** wählen.
2. **Repository name:** `desadviewer`. Der Name wird Teil der Adresse, verwenden Sie am besten
   Kleinbuchstaben ohne Leerzeichen.
3. **Description** (optional): `EDIFACT-DESADV-Lieferavise im Browser lesbar machen`
4. **Public** auswählen.
5. **Wichtig:** *Keinen* Haken bei „Add a README file“ setzen, *kein* .gitignore und *keine*
   Lizenz auswählen. Diese Dateien gibt es im Projekt schon.
6. Auf **„Create repository“** klicken.

GitHub zeigt jetzt eine Seite mit Befehlen an. Sie brauchen davon nur die Adresse, die etwa so aussieht:
`https://github.com/IHR-NAME/desadviewer.git`

---

## Schritt 5: Projekt hochladen

Öffnen Sie PowerShell **im Projektordner**. Am einfachsten geht das so: den Ordner im Explorer öffnen,
oben in die Adresszeile `powershell` tippen und Enter drücken. Alternativ wechseln Sie mit diesem
Befehl in den Ordner:

```bash
cd C:\Users\diete\Desktop\DESADV
```

Führen Sie dann diese Befehle **nacheinander** aus. Ersetzen Sie dabei `IHR-NAME` durch Ihren GitHub-Benutzernamen.

**1. Git für diesen Ordner einrichten:**
```bash
git init -b main
```

**2. Alle Dateien für den ersten Stand vormerken.** `node_modules`, `dist` und `privat` werden
dank der Datei `.gitignore` automatisch ausgelassen.
```bash
git add .
```

**3. Den Stand speichern:**
```bash
git commit -m "Erste Version von DESADViewer"
```

**4. Git sagen, wohin hochgeladen wird:**
```bash
git remote add origin https://github.com/IHR-NAME/desadviewer.git
```

**5. Hochladen:**
```bash
git push -u origin main
```

Beim ersten Hochladen öffnet sich ein Fenster zur **Anmeldung bei GitHub**. Wählen Sie
„Sign in with your browser“ und bestätigen Sie im Browser. Das passiert nur einmal.

✅ Laden Sie die GitHub-Seite Ihres Repositorys neu. Jetzt sehen Sie dort die Projektdateien
und die README.

---

## Schritt 6: GitHub Pages einschalten

1. Auf GitHub in Ihrem Repository oben auf **„Settings“** (Zahnrad) klicken.
2. Links im Menü **„Pages“** wählen.
3. Unter **„Build and deployment“ → „Source“** den Eintrag **„GitHub Actions“** auswählen.

Das war's. Sie müssen hier nichts weiter speichern.

Das Veröffentlichen selbst anstoßen:

1. Oben im Repository auf **„Actions“** klicken.
2. Links **„Auf GitHub Pages veröffentlichen“** wählen.
3. Rechts auf **„Run workflow“** und dann auf den grünen Knopf **„Run workflow“** klicken.

GitHub führt jetzt alle Tests aus, baut die Seite und veröffentlicht sie. Das dauert etwa zwei Minuten.
Ein **grüner Haken ✅** bedeutet: Es hat geklappt.

> Hatten Sie Schritt 6 schon vor Schritt 5 erledigt, startet das Veröffentlichen beim Hochladen
> von selbst. „Run workflow“ ist dann nicht nötig.

---

## Schritt 7: Seite aufrufen

Ihre Seite ist jetzt erreichbar unter:

```
https://IHR-NAME.github.io/desadviewer/
```

Die genaue Adresse steht auch unter **Settings → Pages** („Your site is live at …“) und im
Actions-Lauf beim Schritt „Veröffentlichen“.

💡 Beim allerersten Mal kann es bis zu 10 Minuten dauern, bis die Seite erreichbar ist.

---

## Später: Änderungen veröffentlichen

Wenn Sie (oder Claude) etwas am Projekt geändert haben, prüfen Sie es zuerst lokal:

```bash
npm test
```

Wenn alles grün ist, veröffentlichen Sie mit drei Befehlen. Der Text in Anführungszeichen
beschreibt kurz, was sich geändert hat:

```bash
git add .
```
```bash
git commit -m "Neue Codes für DTM ergänzt"
```
```bash
git push
```

GitHub testet, baut und veröffentlicht automatisch. Nach etwa zwei Minuten ist die neue Version online.
**Schlagen die Tests fehl, wird nichts veröffentlicht.** Die alte Version bleibt dann online, und
unter „Actions“ sehen Sie ein rotes ❌ mit der Fehlermeldung.

Mit diesem Befehl sehen Sie jederzeit, welche Dateien sich seit dem letzten Speichern geändert haben:

```bash
git status
```

---

## Wenn etwas nicht klappt

| Meldung / Problem | Lösung |
|---|---|
| `git` wird nicht erkannt | Git installieren (Schritt 1) und PowerShell **neu öffnen** |
| `Author identity unknown` | Schritt 2 ausführen, dann `git commit …` wiederholen |
| `remote origin already exists` | Die Adresse ist schon eingetragen. Korrigieren mit `git remote set-url origin https://github.com/IHR-NAME/desadviewer.git` |
| `failed to push some refs` / `rejected` | Das Repository auf GitHub war nicht leer (z. B. mit README angelegt). Einfachste Lösung: Repository löschen und Schritt 4 ohne Haken wiederholen |
| Bei „Actions“ ein rotes ❌ | Auf den Lauf klicken und dann auf den roten Schritt. Die Fehlermeldung steht dort. Oft hilft es, lokal `npm test` auszuführen und den Fehler zu beheben |
| `Get Pages site failed` im Actions-Lauf | Schritt 6 fehlt: Unter Settings → Pages als Source „GitHub Actions“ wählen, dann „Run workflow“ erneut starten |
| Seite zeigt 404 | Ein paar Minuten warten. Adresse prüfen: Sie endet auf `/desadviewer/` (Name des Repositorys) |
| Seite ist leer/weiß | Im Browser `Strg + F5` drücken (neu laden ohne Zwischenspeicher) |

---

## Optional

- **Lizenz:** Möchten Sie anderen ausdrücklich erlauben, den Code zu nutzen, können Sie auf GitHub
  eine Lizenzdatei ergänzen („Add file“ → „Create new file“ → Name `LICENSE` → „Choose a license
  template“). Ohne Lizenz bleiben alle Rechte bei Ihnen.
- **Privates Repository:** GitHub Pages aus privaten Repositorys ist nur mit einem kostenpflichtigen
  GitHub-Tarif möglich. Die Seite selbst wäre dann trotzdem öffentlich erreichbar.
- **Eigene Domain** (z. B. `desadv.meinefirma.de`): unter Settings → Pages → „Custom domain“.
