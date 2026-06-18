import fitz
doc = fitz.open("test_out_app.pdf")
page = doc[0]
text = page.get_text()
if "v" in text:
    print("Found 'v' in text!")
else:
    print("NO 'v' FOUND!")
