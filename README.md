# ग्रामपंचायत मिळकत कर व्यवस्थापन (GP Property Tax Web App)

A web-based replacement for the legacy VB.NET / Crystal Reports / MS Access
desktop application at `D:\grampanchyat\gp`. Same domain (property/"milkat"
tax assessment — घरपट्टी, दिवाबत्ती, आरोग्य कर, पाणीपट्टी), rebuilt as:

- **Frontend**: React (Vite), in [`frontend/`](frontend/)
- **Backend**: Node.js + Express, in [`backend/`](backend/)
- **Database**: MySQL (was MS Access `bgkdata.mdb`)

## Why this exists — the year-wise redesign

The old Access table `anandoldnew` hard-coded exactly **two** years into its
column names: `OGAHARPATI/ODIVABATI/OAROGYA/OPNINAPTI/OTOTAL` (old year,
2023-2024) and `GAHARPATI/DIVABATI/AROGYA/PNINAPTI/TOTAL` (new year,
2025-2026). Every future year would have required adding more columns and
touching every form/report/query.

This app replaces that with a normalized, year-wise schema (see
[`backend/src/sql/schema.sql`](backend/src/sql/schema.sql)):

- `financial_years` — one row per year (`"2023-2024"`, `"2025-2026"`, ...).
  Add a new year any time from the **आर्थिक वर्ष** page — no code change.
- `property_master` — one row per property/portion (was `gpmaster`).
- `property_tax_assessment` — one row per **(property, financial_year)**,
  holding घरपट्टी/दिवाबत्ती/आरोग्य/पाणीपट्टी/एकूण for that year. This is
  where "old" and "new" year data now both live, as ordinary rows instead of
  parallel column sets.
- `property_tax_summary_view` — live owner-level roll-up (was the
  manually-rebuilt `anandoldnew_total` table / Form4's "करा" button).

### A data-quality note (read before treating `code` as unique)

gp_master's `code` was intended as the unique key, but the live Access data
has only **914 distinct `code` values across 1256 rows** in `anandoldnew`
(and 1064 rows in `gpmaster`) — years of manual entry produced real
duplicates. To migrate without silently merging or dropping citizens' tax
records, `property_master` uses a surrogate `id` as its true primary key and
keeps `property_code` as an indexed, non-unique reference field. New records
created through the API/UI **do** get uniqueness enforced going forward
(see `assertCodeAvailable` in `properties.routes.js`); only the legacy import
is exempt.

Also note: the source table's `JAMIN` column is always blank — the rate
actually used in the original `CalculateValues()` math was stored in the
`BANDKAM` column instead. This is documented (and handled) in
`migrateFromAccessCsv.js`.

## Project layout

```
gpweb/
  backend/
    server.js                          Express app entry point
    src/
      config/db.js                     MySQL connection pool
      sql/schema.sql                   Full DDL (tables + view), with rationale comments
      scripts/applySchema.js           Creates DB, applies schema, seeds years + admin user
      scripts/migrateFromAccessCsv.js  One-time import from the exported Access CSVs
      scripts/resetData.js             Dev helper: truncates property_master/assessment tables
      middleware/auth.js               JWT auth guard
      routes/                          auth, years, particulars, properties, assessments,
                                        payments, reports, settings
      utils/taxCalc.js                 Tax calculation, ported from Form3.vb's CalculateValues()
      utils/dueAllocation.js           Payment FIFO allocation (previous years first, then
                                        current year, each in gharpatti/divabatti/arogya/
                                        panipatti order) - computed on read, no ledger table
      utils/dueBreakdown.js            Shared जुनी/नविन due-breakdown query (single + bulk)
      utils/ownerName.js               Fallback display name ("कोड N") for the ~100 legacy
                                        rows with no owner_name recorded
    data/migration/*.csv               Exported snapshot of the legacy Access tables
  frontend/
    src/
      api/client.js                    Axios instance (JWT header, 401 redirect)
      hooks/useDebouncedValue.js        Powers the live/as-you-type search boxes
      context/AuthContext.jsx, YearContext.jsx
      components/Layout.jsx            Top nav + global year selector
      pages/                           Login, Dashboard, Properties, PropertyDetail,
                                        Particulars (rate master), Years, PaymentEntry
                                        (कर जमा भरणे), Settings (GP name/taluka/district)
      pages/reports/                   PropertyListReport, OldNewComparisonReport (येणे
                                        बाकी अहवाल - due + collected + balance), SummaryReport,
                                        TaxDemandReport, PaymentReceiptsReport (जमा पावती),
                                        AssessmentRegisterReport (नमुना नं. ८, all printable)
```

## Mapping from the old app

| Old (VB.NET / Access) | New |
|---|---|
| `Form1.vb` (GP_PARTICULAR_MASTER CRUD) | **दर मास्टर** page (`/particulars`) |
| `Form3.vb` (anandoldnew entry + CalculateValues) | **PropertyDetail** page, `utils/taxCalc.js` |
| `Form4.vb` (reports + "करा" totals button) | **Reports** pages (always-live, via `property_tax_summary_view`) |
| `GP_Report.rpt`, `anandnagar.rpt`, `ananadnagar_list.rpt` | मिळकत यादी अहवाल (`/reports/property-list`) |
| `ananadnagar_oldNew_list.rpt` | येणे बाकी अहवाल (`/reports/old-new`) - due, collected & balance |
| `summary_anandnagar_*.rpt`, `anandoldnew_total` | मालकनिहाय सारांश (`/reports/summary`) |
| `ananadnagar_kar_magani_main.rpt` | कर आकारणी पावती (`/reports/tax-demand`) |
| `access_anandnagar_report.rpt` | आकारणी यादी / नमुना नं. ८ (`/reports/assessment-register`) |
| *(no equivalent - manual paper receipts)* | कर जमा भरणे (`/payments`) + जमा पावती अहवाल (`/reports/payment-receipts`) |

### Tax collection (कर जमा भरणे)

There is no payment ledger table. A payment is just `(property, date, amount)`;
which specific dues it covers is computed on every read by walking a fixed
priority order - **all prior years' dues first** (घरपट्टी → दिवाबत्ती →
आरोग्य कर → पाणीपट्टी), **then the selected year's dues**, same order - and
consuming the property's cumulative payment total against it
(`utils/dueAllocation.js`). This keeps outstanding balances correct
automatically as new financial years get added, with nothing to migrate.

### GP identity settings

`gp_settings` (single row, `/settings` page) holds the GP name/taluka/district
that the old Crystal Reports had hardcoded per-`.rpt` file - used in the
नमुना नं. ८ header and available for any future report's letterhead.

Reports are rendered as clean printable HTML tables (browser print / "Save
as PDF") rather than pixel-identical Crystal Reports layouts.

## Setup

### 1. Backend

```bash
cd backend
npm install
copy .env.example .env    # then edit DB_PASSWORD etc. for your MySQL
npm run migrate:schema    # creates DB, tables, seeds 2023-2024/2025-2026 + admin user
npm run migrate:data      # imports data/migration/*.csv into the new schema (run once)
npm start                 # http://localhost:4000
```

Default login created by `migrate:schema`: **admin / admin123** — change
this from the app (or re-run with different `ADMIN_USERNAME`/`ADMIN_PASSWORD`
in `.env` before the users table has any rows) — there's no password-reset
UI yet, so change it via `POST /api/auth/change-password` if needed.

If you ever need to re-run the data migration from scratch during
development: `node src/scripts/resetData.js` truncates `property_master`
and `property_tax_assessment` (keeps particulars/years/users) first.

### 2. Frontend

```bash
cd frontend
npm install
copy .env.example .env    # VITE_API_BASE_URL, defaults to http://localhost:4000/api
npm run dev                # http://localhost:5173
```

### Re-generating the migration CSVs (only if the source .mdb changes)

The CSVs in `backend/data/migration/` were exported from
`D:\grampanchyat\gp\bin\Debug\bgkdata.mdb` using the 32-bit "Microsoft Access
Driver (*.mdb, *.accdb)" ODBC driver (already present on this machine) via a
PowerShell/ODBC script, since no 64-bit Access driver was installed. If you
need to re-export: run PowerShell **32-bit**
(`C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe`), open an
`Odbc.OdbcConnection` with
`Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=<path to .mdb>;`,
and dump `gpmaster`, `anandoldNew`, `GP_PARTICULAR_MASTER`, `anandoldNew_total`
to UTF-8 CSV.

## Adding a new financial year later

No migration needed:
1. **आर्थिक वर्ष** page → type the year (e.g. `2027-2028`) → **वर्ष जोडा**.
2. Optionally mark it **चालू वर्ष करा** (active) so it's the default
   selection app-wide.
3. Enter tax data for it from each property's detail page, per portion.

This is the entire point of the redesign — the old system needed new Access
columns (and touching several forms/reports) for this; here it's two clicks.
