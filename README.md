# Envelope Budget PWA

A small offline-first digital envelope budget app designed around a 14-day household budget cycle.

## Budget-cycle model

- Set the date of the next budget cycle (typically a household payday).
- The app calculates future cycles every 14 days.
- Nothing is funded automatically. When the date arrives, the app shows **New Budget Cycle Ready** and requires confirmation.
- Each envelope has a normal funding amount per cycle and can be included in cycle funding or set to manual-only.
- Before confirming a cycle, funding amounts can be adjusted for that cycle without changing the normal defaults.
- Leftover envelope balances always carry forward. Starting a new cycle adds money; it does not reset balances.

## Included features

- Envelope cards with current available balances
- Spending and manual money additions
- Split transactions across multiple envelopes
- Budget-cycle funding history
- Add, edit, and delete envelopes
- Edit and delete normal transactions
- JSON backup and restore
- Offline support and installable PWA manifest
- Local-only storage in the browser

## Updating an existing installation

This version keeps the existing `envelope-budget-pwa-v1` local-storage key and migrates older envelope data automatically. Existing monthly budget amounts are preserved as current starting balances, and their per-cycle funding defaults are initialized to half of the old monthly amount.

After replacing the files on GitHub Pages, close and reopen the installed app so the new service worker can take control. Do not clear browser/site data unless you intentionally want to erase local budget data; exporting a backup first is recommended.
