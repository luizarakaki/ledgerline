# Sample data

Five sets of consolidation inputs, one per subdirectory. Each set has the four
CSVs the app expects:

```
Parent_PnL.csv
Parent_BalanceSheet.csv
Subsidiary_PnL.csv
Subsidiary_BalanceSheet.csv
```

Upload all four from a set into the app's drop-zones (or drag the folder's
files in) and **Run consolidation**.

## Nothing is hardcoded

The sets deliberately differ in account names, number of rows, statement
structure, and even CSV formatting — to show the engine matches on **account
type and keywords**, not fixed labels. The intercompany eliminations are
detected from many naming variants:

| Elimination | Variants used across the sets |
| ----------- | ----------------------------- |
| P&L intercompany | *Subsidiary Revenue* ↔ *Parent Company Fees*; *Management Fee Income* ↔ *Management Fee*; *Service Fee Income* ↔ *Parent Service Fees*; *Intercompany Revenue* ↔ *Intercompany Charges* |
| Intercompany balance | *Due from/to Subsidiary/Parent*; *Intercompany Receivable/Payable*; *Due from Affiliate / Due to Parent*; *Loan to Subsidiary / Loan from Parent* |
| Equity investment | *Investment in Subsidiary* ↔ *Common Stock*; *Equity Investment in Affiliate* ↔ *Share Capital*; *Investment in Subsidiary* ↔ *Capital Stock* |

For a clean, balanced result a set only needs: each entity's own balance sheet
to balance, and the three intercompany pairs to be equal-and-opposite.

## The sets

| Folder | Scenario | What it exercises | NI (consol.) | Assets (consol.) |
| ------ | -------- | ----------------- | -----------: | ---------------: |
| `01-provided` | The original take-home sample data (**this is the provided set**) | Baseline | $133,500 | $732,000 |
| `02-helios-saas` | Helios SaaS + Lumen Analytics | Different account names, more line items (deferred revenue, goodwill, R&D), management-fee + intercompany-receivable + equity-investment-in-affiliate variants | $454,000 | $1,854,000 |
| `03-brightline-retail` | Brightline Retail + Cobalt Outfitters | **Alternative CSV format** — `Line Item, Category, Balance` headers, `$` signs, comma thousands separators, parentheses-negatives | $531,000 | $2,300,000 |
| `04-vanguard-industrial` | Vanguard Industrial + Ironworks Fabrication | Larger statements (two COGS lines, deferred tax, WIP inventory), loan-to/from + intercompany-revenue variants, and a **subsidiary running at a loss** | $251,000 | $3,240,000 |
| `05-pioneer-media-warning` | Pioneer Media + Echo Studios | **Validation demo** — intercompany P&L doesn't fully net ($60k vs $50k), so the engine eliminates the lesser and flags the $10k residual; the balance sheet still balances | $213,000 | $835,000 |

Every set balances (consolidated balance check passes). Sets 01–04 produce no
warnings; set 05 produces a single warning to demonstrate the validation panel.
