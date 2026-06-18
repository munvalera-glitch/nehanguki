import fitz

merged = fitz.open()
merged.insert_pdf(fitz.open("test_out_app.pdf"))
merged.save("test_merged_garbage.pdf", deflate=True, garbage=4)
merged.close()

doc2 = fitz.open("test_merged_garbage.pdf")
text2 = doc2[0].get_text()
if "v" in text2:
    print("Found 'v' in text2!")
else:
    print("NO 'v' FOUND in MERGED WITH GARBAGE=4!")
