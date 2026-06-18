import fitz
import sys
sys.path.insert(0, '.')
from pdf_generator import FONT

# 1. Create a PDF with 'v' using nanum
doc1 = fitz.open()
page1 = doc1.new_page()
page1.insert_text(fitz.Point(100, 100), "v", fontsize=10, fontname="nanum", fontfile=FONT, color=(0, 0, 0))
doc1.save("test_nanum_src.pdf")
doc1.close()

# 2. Merge it with garbage=4
merged = fitz.open()
merged.insert_pdf(fitz.open("test_nanum_src.pdf"))
merged.save("test_nanum_merged.pdf", deflate=True, garbage=4)
merged.close()

# 3. Check if 'v' survived
doc2 = fitz.open("test_nanum_merged.pdf")
text2 = doc2[0].get_text()
if "v" in text2:
    print("Found 'v' in test_nanum_merged.pdf!")
else:
    print("NO 'v' FOUND in test_nanum_merged.pdf!")
