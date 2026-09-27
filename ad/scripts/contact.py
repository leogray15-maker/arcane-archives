"""Tile PNG frames into a contact sheet: contact.py out.png cols w in1 in2 ..."""
import sys
from PIL import Image, ImageDraw
out, cols, w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
ims = [Image.open(p).convert("RGB") for p in sys.argv[4:]]
h = int(w * 1920 / 1080)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * h), (40, 40, 40))
for i, (im, p) in enumerate(zip(ims, sys.argv[4:])):
    t = im.resize((w, h))
    d = ImageDraw.Draw(t)
    d.text((6, 6), p.split("-")[-1].split(".")[0], fill=(255, 80, 80))
    sheet.paste(t, ((i % cols) * w, (i // cols) * h))
sheet.save(out)
