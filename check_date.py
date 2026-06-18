from docx import Document

doc = Document('templates/schedule_tokyo_1_villa_fontaine_kayabacho.docx')
for p in doc.paragraphs:
    if "2026" in p.text or "Year" in p.text:
        print(repr(p.text))
        for r in p.runs:
            print("  Run:", repr(r.text))
