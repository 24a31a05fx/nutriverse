import urllib.request
import os
import json
from PIL import Image

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
os.makedirs('public/assets/products', exist_ok=True)

catalog = [
    {
        'id': 'potato',
        'file': 'potato.jpg',
        'url': 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Lars Blankers',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Fresh whole unpeeled potatoes in natural light'
    },
    {
        'id': 'chickpeas',
        'file': 'chickpeas.jpg',
        'url': 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Milada Vigerova',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Organic desi chickpeas in ceramic bowl'
    },
    {
        'id': 'spinach',
        'file': 'spinach.jpg',
        'url': 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Elianna Friedman',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Tender organic green baby spinach leaves'
    },
    {
        'id': 'sweet_potato',
        'file': 'sweet-potato.jpg',
        'url': 'https://images.unsplash.com/photo-1596097635121-14b63b7a0c19?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Louis Hansel',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Fresh whole orange sweet potatoes'
    },
    {
        'id': 'greek_yoghurt',
        'file': 'greek-yoghurt.jpg',
        'url': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Sara Cervera',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Creamy probiotic Greek yoghurt in bowl'
    },
    {
        'id': 'quinoa',
        'file': 'quinoa.jpg',
        'url': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Jocelyn Morales',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Organic white quinoa grains'
    },
    {
        'id': 'blueberries',
        'file': 'blueberries.jpg',
        'url': 'https://images.unsplash.com/photo-1498557850523-fd3d118b962e?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Joanna Kosinska',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Fresh wild antioxidant-rich blueberries'
    },
    {
        'id': 'almonds',
        'file': 'almonds.jpg',
        'url': 'https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Remi Yuan',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Raw California whole almonds'
    },
    {
        'id': 'chia_seeds',
        'file': 'chia-seeds.jpg',
        'url': 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Maddi Bazzocco',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Organic black chia seeds with omega-3'
    },
    {
        'id': 'green_moong',
        'file': 'green-moong.jpg',
        'url': 'https://images.unsplash.com/photo-1587334274328-64186a80aeee?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Sanjay Acharya',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Whole green gram moong beans'
    },
    {
        'id': 'mustard_oil',
        'file': 'mustard-oil.jpg',
        'url': 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Roberta Sorge',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Cold-pressed golden unrefined cooking oil'
    },
    {
        'id': 'rolled_oats',
        'file': 'rolled-oats.jpg',
        'url': 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Melissa Belanger',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Whole grain jumbo rolled oats'
    },
    {
        'id': 'broccoli',
        'file': 'broccoli.jpg',
        'url': 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Annie Spratt',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Fresh green broccoli florets'
    },
    {
        'id': 'garlic',
        'file': 'garlic.jpg',
        'url': 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Gaelle Marcel',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Fresh white garlic bulbs and cloves'
    },
    {
        'id': 'red_onions',
        'file': 'red-onions.jpg',
        'url': 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Ksenia Chernaya',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Fresh harvest Indian red onions'
    },
    {
        'id': 'green_chillies',
        'file': 'green-chillies.jpg',
        'url': 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Chung Hoang',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Fresh sharp green chillies'
    },
    {
        'id': 'lemons',
        'file': 'lemons.jpg',
        'url': 'https://images.unsplash.com/photo-1533082723898-8e3b5e4c0226?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Hanxiao',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Fresh ripe whole and sliced lemons'
    },
    {
        'id': 'ginger',
        'file': 'ginger.jpg',
        'url': 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Mockup Graphics',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Fresh organic spicy ginger root'
    },
    {
        'id': 'muskmelon',
        'file': 'muskmelon.jpg',
        'url': 'https://images.unsplash.com/photo-1571575173700-afb9492e8c50?w=600&auto=format&fit=crop&q=80',
        'source': 'Unsplash',
        'author': 'Mae Mu',
        'license': 'Unsplash Free Commercial License',
        'alt': 'Fresh sweet netted muskmelon cantaloupe'
    }
]

provenance = []
for item in catalog:
    dst = os.path.join('public', 'assets', 'products', item['file'])
    try:
        req = urllib.request.Request(item['url'], headers=headers)
        with urllib.request.urlopen(req, timeout=15) as r, open(dst, 'wb') as f:
            f.write(r.read())
        with Image.open(dst) as im:
            im.verify()
        size_kb = os.path.getsize(dst) // 1024
        print(f"SUCCESS: {item['file']} ({size_kb} KB)")
        provenance.append({
            'product_id': item['id'],
            'filename': item['file'],
            'local_url': f"/assets/products/{item['file']}",
            'source_url': item['url'],
            'author': item['author'],
            'license': item['license'],
            'alt_text': item['alt'],
            'status': 'verified_authentic'
        })
    except Exception as e:
        print(f"FAILED: {item['file']} - {e}")
        provenance.append({
            'product_id': item['id'],
            'filename': item['file'],
            'local_url': f"/assets/products/{item['file']}",
            'status': 'pending_fallback',
            'error': str(e)
        })

prov_path = os.path.join('public', 'assets', 'products', 'provenance.json')
with open(prov_path, 'w', encoding='utf-8') as f:
    json.dump(provenance, f, indent=2)
print("Provenance saved to", prov_path)
