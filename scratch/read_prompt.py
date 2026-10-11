import json

with open(r'C:\Users\Polak\.gemini\antigravity-ide\brain\9dabce85-aaba-4dc7-bd08-b762259951c2\.system_generated\logs\transcript_full.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        if data.get('type') == 'USER_INPUT':
            print("=== USER INPUT (step %s) ===" % data.get('step_index'))
            content = data.get('content', '')
            if "just borrow" in content:
                print("FOUND PROMPT 3:")
                print(content[:3000])
                with open("scratch/prompt_3_full.txt", "w", encoding="utf-8") as out:
                    out.write(content)
                print("WROTE scratch/prompt_3_full.txt (length %d)" % len(content))
