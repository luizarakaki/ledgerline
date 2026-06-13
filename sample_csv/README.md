# Sample data

Four complete sets of consolidation inputs, one per subdirectory. Each set has
the four CSVs the app expects:

```
Parent_PnL.csv
Parent_BalanceSheet.csv
Subsidiary_PnL.csv
Subsidiary_BalanceSheet.csv
```

Upload all four from a set into the app's drop-zones (or drag the folder's
files in) and **Run consolidation**. Every set is constructed so each entity's
balance sheet balances on its own and the three intercompany pairs match
exactly, so the consolidated balance sheet balances with no validation warnings.

Each set exercises the same three eliminations:

- **P&L** — parent's *Subsidiary Revenue* ↔ subsidiary's *Parent Company Fees*
- **Balance sheet** — *Due from Subsidiary* ↔ *Due to Parent*
- **Balance sheet** — parent's *Investment in Subsidiary* ↔ subsidiary's *Common Stock*

## The sets

| Folder | Scenario | Net income (consolidated) | Total assets (consolidated) |
| ------ | -------- | -------------------------: | --------------------------: |
| `01-provided` | The original take-home sample data (**this is the provided set**) | $133,500 | $732,000 |
| `02-nimbus-software` | Nimbus Holdings + Stratus Labs (software) | $258,000 | $1,035,000 |
| `03-meridian-retail` | Meridian Retail + Coastline Goods (retail) | $206,000 | $1,350,000 |
| `04-atlas-manufacturing` | Atlas Manufacturing + Forge Components (manufacturing) | $237,500 | $1,755,000 |

Account names vary across sets (and nothing is hardcoded to a specific file) —
matching is keyword-based, so the same eliminations are detected in every set.
