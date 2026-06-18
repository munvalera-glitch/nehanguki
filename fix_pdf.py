import fitz
import sys

def fix_pdf(input_path, output_path):
    doc = fitz.open(input_path)
    page = doc[0]
    
    # We want to render the page visually right-side up (since currently it looks upside down when rotation=0).
    # If the user saw it upside down, it means the raw image is upside down.
    # So we render it as is, and then rotate the pixmap.
    pix = page.get_pixmap(dpi=300)
    
    # Create a new PDF
    new_doc = fitz.open()
    new_page = new_doc.new_page(width=page.rect.width, height=page.rect.height)
    
    # Insert the image rotated by 180 degrees!
    new_page.insert_image(new_page.rect, stream=pix.tobytes("png"), rotate=180)
    
    new_doc.save(output_path)
    new_doc.close()
    doc.close()

if __name__ == "__main__":
    fix_pdf("templates/f4_non_employment_pledge.pdf", "templates/f4_non_employment_pledge_fixed.pdf")
