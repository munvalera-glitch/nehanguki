import fitz
import sys
from pdf_generator import generate_application_form

data = {
    "sex": "M",
    "full_name": "JOHN DOE",
    "nationality": "USA",
    "guarantor_sex": "F",
    "guarantor_full_name": "JANE DOE",
    "form_type": "extension"
}

try:
    generate_application_form(data, "templates/application.pdf", "test_visual_checkmarks.pdf")
    
    # Render page 0 to PNG
    doc = fitz.open("test_visual_checkmarks.pdf")
    page = doc[0]
    pix = page.get_pixmap(dpi=150)
    pix.save("test_visual_page0.png")
    print("Saved test_visual_page0.png")
except Exception as e:
    print(f"Error: {e}")
