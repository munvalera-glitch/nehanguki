import fitz
doc = fitz.open()
page = doc.new_page()
# Method 1: draw_line
page.draw_line(fitz.Point(100, 100), fitz.Point(200, 200), color=(1,0,0), width=5)
# Method 2: shape
shape = page.new_shape()
shape.draw_line(fitz.Point(100, 200), fitz.Point(200, 300))
shape.finish(color=(0,1,0), width=5)
shape.commit()
doc.save("test_shape.pdf")
