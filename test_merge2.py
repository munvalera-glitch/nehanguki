import fitz

merged = fitz.open()
merged.insert_pdf(fitz.open("test_out_app.pdf"))
merged.save("test_merged_app.pdf", deflate=True)
merged.close()

doc2 = fitz.open("test_merged_app.pdf")
text2 = doc2[0].get_text()
if "v" in text2:
    print("Found 'v' in text2!")
else:
    print("NO 'v' FOUND in MERGED!")
