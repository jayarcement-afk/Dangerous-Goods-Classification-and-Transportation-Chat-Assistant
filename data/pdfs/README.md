# Local PDFs for ingestion

UNECE may return **403 Forbidden** for automated downloads. Save PDFs here manually, then run ingest again.

| File | Source | Purpose |
|------|--------|---------|
| `table-c-adn.pdf` | [ADN 2011 Table C (Dangerous Goods List)](https://unece.org/DAM/trans/danger/publi/adn/adn2011/English/7-TableC-E.pdf) | **Primary UN / PSN / classification lookup** |
| `vol-1.pdf` | [Volume I (Rev. 24)](https://unece.org/sites/default/files/2025-09/ST_SG_AC10_1_Rev24e_Vol%20I_1.pdf) | Orange Book regulatory text |
| `vol-2.pdf` | [Volume II (Rev. 24)](https://unece.org/sites/default/files/2025-09/ST_SG_AC10_1_Rev24e_Vol_II_1.pdf) | Orange Book regulatory text |

Alternate paths also work: `7-TableC-E.pdf`, `data/vol-1.pdf`.

```bash
# Index Table C first (recommended for UN number questions)
npm run ingest -- --source table-c-adn

# Orange Book volumes
npm run ingest -- --source vol-1
npm run ingest -- --source all
```

The ingest script uses local files when present and only downloads if missing.
