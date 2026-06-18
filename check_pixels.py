from PIL import Image
img = Image.open("test_visual_page0.png")
# Point is roughly (366, 329) in pt. The image is 150 DPI.
# 1 pt = 1/72 inch. So x_px = x_pt * 150 / 72
x_px = int(366 * 150 / 72)
y_px = int(329 * 150 / 72)

# crop 50x50 around it
crop = img.crop((x_px - 25, y_px - 25, x_px + 25, y_px + 25))
extrema = crop.convert("L").getextrema()
print(f"Extrema (min, max): {extrema}")
