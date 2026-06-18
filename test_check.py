import fitz
doc = fitz.open()
page = doc.new_page()
try:
    page.insert_text(fitz.Point(100, 100), "✔", fontsize=20, fontname="helv", color=(0,0,0))
    print("Inserted ✔ using helv")
except Exception as e:
    print("Error:", e)
doc.save("test_check.pdf")
