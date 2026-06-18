import fitz
doc = fitz.open()
page = doc.new_page()
# Just insert a "v" like pdf_generator.py does
page.insert_text(fitz.Point(100, 100), "v", fontsize=10, fontname="helv", color=(0, 0, 0))
# And draw a line
page.draw_line(fitz.Point(150, 100), fitz.Point(160, 110), color=(1,0,0), width=1.5)
doc.save("test_checkmarks.pdf")
doc.close()

import fitz
merged = fitz.open()
merged.insert_pdf(fitz.open("test_checkmarks.pdf"))
merged.save("test_merged.pdf", deflate=True)
merged.close()
