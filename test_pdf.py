import fitz
import os

MM_TO_PT = 2.8346
ID_W = 85.60 * MM_TO_PT
ID_H = 53.98 * MM_TO_PT

# Create dummy landscape image
img = fitz.Pixmap(fitz.csRGB, (0, 0, 856, 540), 0)
img.clear_with()  # white
img.save("dummy.jpg")

doc = fitz.open()
page = doc.new_page(width=595, height=842) # A4

# Rect for back card
rect_back = fitz.Rect(68.9, 580.7, 68.9 + ID_H, 580.7 + ID_W)

try:
    page.insert_image(rect_back, filename="dummy.jpg", keep_proportion=True, rotate=270)
    print("Inserted successfully!")
except Exception as e:
    print(f"Error: {e}")

doc.save("test_out.pdf")
doc.close()
