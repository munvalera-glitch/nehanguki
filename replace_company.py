import os
import re

files_to_patch = [
    "src/i18n/locales/en.js",
    "src/i18n/locales/ko.js",
    "src/i18n/locales/ru.js",
    "src/legal/privacy.js",
    "src/legal/terms.js"
]

def process_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Replace the company name
    content = content.replace("MANGO TOUR", "유어코리아(YOUR KOREA)")
    content = content.replace("망고투어 (유어코리아(YOUR KOREA))", "유어코리아(YOUR KOREA)")
    
    # Replace registration number
    content = content.replace("565-53-00861", "131-70-00627")
    
    # Remove mentions of the representative and MUN VALERY
    # Footer replacements
    content = content.replace(" | Representative: MUN VALERY", "")
    content = content.replace(" | 대표자: MUN VALERY", "")
    content = content.replace(" | Представитель: MUN VALERY", "")
    
    # Legal documents inline replacements
    content = content.replace(" (представитель: MUN VALERY)", "")
    content = content.replace(" (Representative: MUN VALERY)", "")
    content = content.replace(" (대표자: MUN VALERY)", "")
    
    # Legal documents list replacements
    content = re.sub(r'Представитель: MUN VALERY\n?\r?', '', content)
    content = re.sub(r'Representative: MUN VALERY\n?\r?', '', content)
    content = re.sub(r'대표자: MUN VALERY\n?\r?', '', content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Processed {filepath}")

for file in files_to_patch:
    process_file(file)
