# Accessibility Concept

## Zielbild

Die Foundation-Oberflaeche soll WCAG AA als praktisches Minimum erreichen. Fokus liegt auf:

- Tastaturbedienbarkeit ohne Maus
- sichtbaren Fokus-Zustaenden in allen interaktiven Bereichen
- verstaendlichen Namen, Rollen und Statusmeldungen fuer Screenreader
- ausreichenden Kontrasten in Navigation, Tabellen, Modals und Status-Chips

## Fokus-Management

- Drawer- und Modal-Varianten nutzen einen Focus Trap, solange sie modal offen sind.
- Beim Oeffnen springt der Fokus auf das erste sinnvolle Element im Container.
- Beim Schliessen kehrt der Fokus auf das zuvor aktive Element zurueck.
- `Escape` bleibt der einheitliche Dismiss-Shortcut fuer modale Drawer.

## Skip Link

- Die linke Foundation-Navigation bekommt einen fruehen Skip Link: `Zum Hauptinhalt springen`.
- Ziel ist der zentrale Inhaltsbereich der Foundation-Shell.
- Der Zielbereich muss per `tabIndex={-1}` fokussierbar sein, damit Screenreader- und Tastatur-Nutzer direkt im Hauptcontent landen.

## ARIA-Pass-Kriterien

- Sortierbare Tabellenkoepfe setzen `aria-sort` korrekt auf `ascending`, `descending` oder `none`.
- Modale Drawer setzen `role="dialog"` und `aria-modal="true"`.
- Interaktive Icons bleiben dekorativ (`aria-hidden="true"`), wenn daneben bereits lesbarer Text existiert.
- Status- und Warntexte verwenden nur dann Live-Rollen, wenn sie tatsaechlich neue Informationen ansagen sollen.

## Screenreader Live Regions

- Lade-Overlays und kritische Persistenz-/Flow-Hinweise nutzen `aria-live="polite"` oder `role="status"`.
- Erfolgs- und Warnhinweise sollen kurz, eindeutig und ohne visuelles Vorwissen verstaendlich sein.
- Live-Regionen duplizieren keine ohnehin fokussierten Dialoginhalte.

## QA-Checkliste

- Foundation komplett per `Tab`, `Shift+Tab`, `Enter`, `Space` und `Escape` bedienbar
- Skip Link direkt nach Fokusstart sichtbar und funktionsfaehig
- Drawer verliert keinen Fokus nach innen oder nach hinten aus dem Modal
- Sortierbare Tabellenkoepfe werden in VoiceOver/NVDA mit Sortierstatus angesagt
- Keine rein farbliche Statuskommunikation ohne Textsignal
