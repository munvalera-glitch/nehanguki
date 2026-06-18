import fitz
doc = fitz.open()
page = doc.new_page()
# Assuming NanumGothic is the font used. Let's see if we can use FONT from pdf_generator.py
import sys
sys.path.insert(0, '.')
from pdf_generator import FONT
page.insert_text(fitz.Point(100, 100), "v", fontsize=10, fontname="nanum", fontfile=FONT, color=(0, 0, 0))
doc.save("test_nanum.pdf")
doc.close()
