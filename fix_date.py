import glob
from docx import Document
import re

def process_file(filepath):
    doc = Document(filepath)
    modified = False
    
    for p in doc.paragraphs:
        if "2026" in p.text and "Year" in p.text:
            text = p.text
            new_text = re.sub(r'2026\s*\(Year\)\s*\(Month\)\s*\(Day\)', '{currentDate}', text)
            if new_text != text:
                for i, run in enumerate(p.runs):
                    if i == 0:
                        run.text = new_text
                    else:
                        run.text = ""
                modified = True
                print(f"Fixed date in {filepath}")

    if modified:
        doc.save(filepath)

files = glob.glob("templates/schedule_*.docx")
for f in files:
    try:
        process_file(f)
    except Exception as e:
        print(f"Error processing {f}: {e}")
