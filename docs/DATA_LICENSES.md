# Nutriverse — Data Sources, Licensing & Provenance Register

This document establishes the official licensing, attribution, API usage policy, and data provenance requirements for all nutrition and product datasets utilized or evaluated by Nutriverse.

---

## 1. Primary Verified Reference: ICMR-NIN IFCT 2017

| Property | Value |
| :--- | :--- |
| **Source Name** | Indian Food Composition Tables (IFCT 2017) |
| **Publisher** | National Institute of Nutrition (ICMR), Hyderabad |
| **Lead Authors** | T. Longvah, R. Ananthan, K. Bhaskarachary, K. Venkaiah |
| **File / Media** | `datasets/IFCT2017.pdf` (12,401,190 bytes) |
| **Cryptographic SHA-256** | `7fc5a5112a57240d25bf695dca82cccd8d93ed54e8c39530e42b5ad1820d0e8c` |
| **Copyright & Legal Status** | Copyright © 2017 National Institute of Nutrition (ICMR). All rights reserved. |
| **Measurement Basis** | Per 100g edible portion (unless explicitly indicated otherwise) |
| **Food State** | Raw food (all agricultural staples, legumes, vegetables, fruits, and dairy) |
| **Verification Level** | `verified_reference` (Highest tier) |

### Publication Terms & Redistribution Restrictions (Page 3 / Page ii)
The official copyright notice printed on Page 3 of IFCT 2017 explicitly states:
> *"The use and dissemination of the data in this book is encouraged. This publication can be reproduced for personal use with full acknowledgment of the source. However, no part of this publication can be stored or reproduced in any electronic format for creating a product without the prior written permission of the National Institute of Nutrition, Hyderabad."*

### Legal Analysis & Conservative Handling Approach
1. **Personal & Educational Use**: Reproduction and dissemination for personal use, scientific research, and educational dietary planning is explicitly encouraged, provided full scholarly acknowledgment is given.
2. **Commercial & Product Creation Restriction**: Bulk storage or reproduction in an electronic database to create a commercial software product is **restricted** without prior written permission from NIN Hyderabad. Bulk incorporation into a commercial SaaS cannot be claimed as unconditionally licensed based on open-access assumptions.
3. **Factual Attribution vs Compilation Copyright**: While underlying scientific facts (e.g., moisture, protein, or ash content of an agricultural crop) are uncopyrightable facts in most jurisdictions, the compilation, specific sampling structure, and electronic database republication fall squarely within the publisher's stated restriction.
4. **Nutriverse Operational Policy**:
   - Ingested IFCT values are restricted to internal, read-only algorithmic nutrition calculation, verification, and user target estimation.
   - Raw IFCT data tables MUST NOT be exposed via public bulk download APIs or redistributed as a commercial database export.
   - Prior to commercial monetization or public release of productized database features, Nutriverse management must seek and obtain formal written authorization/licensing from the Director, National Institute of Nutrition (ICMR), Hyderabad.

**Mandatory Citation:**
> Longvah, T., Ananthan, R., Bhaskarachary, K., & Venkaiah, K. (2017). *Indian Food Composition Tables*. National Institute of Nutrition, Indian Council of Medical Research, Department of Health Research, Ministry of Health and Family Welfare, Government of India, Hyderabad.

### Data Integrity & Unknown Handling Rules
- **Non-Detection vs. Zero**: Blank analytical cells in IFCT 2017 denote values *below the detectable limit* (BDL) of the analytical method or parameters not assayed for that food matrix (Page 30 / Page xxiii). They MUST be stored as `NULL` with `is_unknown = True` and explicit reason. They MUST NEVER be silently converted to `0.0`.
- **Food State Preservation**: Raw staples must remain designated as `food_state = "raw"` until cooked or processed via deterministic culinary retention factors.
- **Energy Conversion**: IFCT reports physiological available energy in kilojoules ($\text{kJ}$). Standard conversion to kilocalories ($\text{kcal}$) uses:
  $$E_{\text{kcal}} = \frac{E_{\text{kJ}}}{4.184}$$

---

## 2. Commercial & Packaged Goods: Open Food Facts (OFF)

| Property | Value |
| :--- | :--- |
| **Source Name** | Open Food Facts |
| **Publisher / Maintainer** | Open Food Facts Association (non-profit, Paris, France) |
| **API Endpoints** | `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`<br>`https://in.openfoodfacts.org/api/v2/product/{barcode}.json` |
| **Database License** | Open Database License (ODbL) v1.0 |
| **Database Contents License** | Database Contents License (DbCL) v1.0 |
| **Media / Photos License** | Creative Commons Attribution-ShareAlike (CC BY-SA 3.0 / 4.0) / CC0 |
| **Verification Level** | `source_reported` or `label_derived` (NEVER `verified_reference`) |

### Mandatory Attribution Requirement (ODbL §4.3)
Any user-facing interface, report, or data export containing Open Food Facts product details must clearly display:
> *"Contains information from Open Food Facts, which is made available here under the Open Database License (ODbL)."*

A hyperlink to `https://opendatacommons.org/licenses/odbl/1-0/` and `https://openfoodfacts.org` must accompany digital publications.

### Derivative Work & Database Rights (ODbL §4.4)
- **Collective Database**: Nutriverse maintains Open Food Facts records in an isolated, partitioned provenance structure (`source_records` and `data_sources`). Aggregating OFF records alongside independent scientific data (e.g., IFCT 2017) constitutes a Collective Database under ODbL §1.0.
- **Adapted Database**: If Nutriverse modifies, enriches, or normalizes Open Food Facts database tables and redistributes or publicly exposes the resulting adapted database, the adapted database must be published under the ODbL. Internal private algorithmic usage is permitted under ODbL §4.4.
- **Image Compliance**: Product images extracted from Open Food Facts are subject to CC BY-SA. Commercial caching or display requires displaying attribution and linking back to the source image page.

### API Acceptable Use Policy & Technical Constraints
1. **User-Agent Header**: Every HTTP request MUST provide a descriptive User-Agent following the format:
   ```http
   User-Agent: NutriverseApp/1.0 (Web/Backend; contact: dev@nutriverse.in)
   ```
   Requests with generic user-agents (`python-requests`, `httpx`, `curl`) are subject to automated Cloudflare blocking.
2. **Rate Limiting & Concurrency**:
   - Limit API calls to $\le 10$ requests per minute for consumer lookup traffic.
   - Implement exponential backoff when encountering HTTP 429 (Too Many Requests).
   - Set request timeouts to $\le 5.0$ seconds to ensure quick-commerce response SLAs.
3. **Data Quality Policy**: Open Food Facts entries are crowdsourced from consumer label photographs and OCR. OCR errors, unit discrepancies, and missing micronutrients are common.
   - All imported OFF data must be tagged with `verification_status = "source_reported"` or `"label_derived"`.
   - Never mark Open Food Facts entries as `"verified_reference"`.

---

## 3. Quarantined & Unverified Datasets

### A. `cleaned_nutrition_dataset_per100g.csv`
- **File**: `datasets/cleaned_nutrition_dataset_per100g.csv` (329,037 bytes)
- **SHA-256**: `6e9362630626f405b17a90e067278cbaab1cfb0ba63ab51557a59b94e79ffdd8`
- **Status**: **STRICTLY QUARANTINED — PROHIBITED FROM INGESTION**
- **Findings**:
  - Contains biologically impossible macronutrient values (e.g., row 4 contains 218g of fat per 100g of food).
  - Contains spurious/obsolete nutrient columns (e.g., "Vitamin B11").
  - Widespread blanket zero-filling of missing micronutrients ($0.0$), destroying the distinction between zero and unanalyzed nutrients.
  - Lacks provenance, publisher identity, methodology notes, or licensing terms.

### B. `Food_Nutrition_Dataset.csv`
- **File**: `datasets/Food_Nutrition_Dataset.csv` (15,673 bytes)
- **SHA-256**: `50f6c724722f9e3f340705fea028a4d7df2ced809252ceab8b8b14fa31aeba27`
- **Status**: **QUARANTINED PENDING INDEPENDENT AUDIT**
- **Findings**:
  - 206 food records without explicit units in column headers (calories, protein, carbs, fat, iron, vitamin_c).
  - Lacks verifiable laboratory or publisher attribution.
  - No stated license terms or commercial redistribution rights.
  - Must not be ingested as ground truth.

---

## 4. Summary of Verification Status Matrix

| Verification Status | Definition | Eligible Sources |
| :--- | :--- | :--- |
| `verified_reference` | Analytical laboratory ground truth from peer-reviewed or national institute food tables. | ICMR-NIN IFCT 2017, USDA FoodData Central (Foundation/SR Legacy) |
| `label_derived` | Extracted from compliant manufacturer nutrition facts panels or verified lab test reports. | Certified supplier COAs, verified FSSAI brand packaging |
| `source_reported` | Crowdsourced or third-party reported data awaiting internal nutritionist validation. | Open Food Facts, vendor API feeds |
| `pending_review` | Newly ingested or conflicting nutrient values awaiting professional review. | Ingestion queue, user-submitted barcode scans |
| `rejected` | Values identified as erroneous, implausible, or mathematically impossible. | Quarantined datasets, failed checksums, corrupted OCR |
