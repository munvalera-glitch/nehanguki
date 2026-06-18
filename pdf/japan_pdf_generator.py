import fitz
import sys
import os

def create_japan_signature_pdf(img_path, output_file):
    doc = fitz.open()
    template_path = os.path.join("templates", "온라인신청 서명란.pdf")
    
    if os.path.exists(template_path):
        sig_doc = fitz.open(template_path)
        sig_page = sig_doc[0]
        # Signature coordinates: moved up by 1cm (~28 points) from y=271
        sig_rect = fitz.Rect(561, 243, 561 + 120, 243 + 40)
        try:
            sig_page.insert_image(sig_rect, filename=img_path)
            doc.insert_pdf(sig_doc)
        except Exception as e:
            print(f"Failed to insert signature: {e}")
            
    doc.save(output_file)
    doc.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(1)
    create_japan_signature_pdf(sys.argv[1], sys.argv[2])

