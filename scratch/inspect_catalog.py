import re, csv

with open('src/data/catalog.ts', encoding='utf-8') as f:
    names = re.findall(r'name:\s*"([^"]+)"', f.read())
print(f"Found in catalog.ts ({len(names)}):")
for n in names:
    print('  -', n)

with open('public/assets/products/product_image_manifest_template.csv', encoding='utf-8') as f:
    rows = list(csv.DictReader(f))
print(f"\nFound in manifest ({len(rows)}):")
for r in rows:
    print('  -', r['sku'], '|', r['alt_text'])
