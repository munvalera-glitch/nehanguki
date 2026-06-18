from docx import Document

doc = Document('templates/schedule_tokyo_1_villa_fontaine_kayabacho.docx')
for p in doc.paragraphs:
    if "Name of companion" in p.text or p.text.strip() in ['1.', '2.', '3.', '4.', '5.']:
        print(repr(p.text))
