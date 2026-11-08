"""Regenerate the social-share images: python3 scripts/make-og.py  (needs Pillow)"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEYS = ["apple2", "mac128", "macplus", "imacg3", "cube", "imacg4", "pmg5", "imacm4", "neo"]
TEXT = {"en": ("Apple Museum", "50 years of Mac · 1976–2026 · Interactive Cover Flow"),
        "es": ("Apple Museum", "50 años de Mac · 1976–2026 · Museo interactivo Cover Flow")}
def font(size, bold=False):
    for f in ["/System/Library/Fonts/SFNS.ttf", "/System/Library/Fonts/Helvetica.ttc", "/Library/Fonts/Arial.ttf"]:
        if os.path.exists(f):
            try:
                ft = ImageFont.truetype(f, size)
                if bold and f.endswith("SFNS.ttf"):
                    try: ft.set_variation_by_name("Bold")
                    except Exception: pass
                return ft
            except Exception: pass
    return ImageFont.load_default()
for lang, (title, sub) in TEXT.items():
    W, H = 1200, 630
    bg = Image.new("RGB", (W, H), "#eef1f6")
    grad = Image.new("L", (W, H))
    gd = ImageDraw.Draw(grad)
    for r in range(700, 0, -4): gd.ellipse((W/2-r*1.3, 300-r*0.8, W/2+r*1.3, 300+r*0.8), fill=int(255*(1-r/700)))
    bg.paste(Image.new("RGB", (W, H), "#ffffff"), (0, 0), grad)
    canvas = bg.convert("RGBA")
    d = ImageDraw.Draw(canvas)
    d.text((W/2, 92), title, font=font(84, True), fill="#1d1d1f", anchor="mm")
    d.text((W/2, 162), sub, font=font(30), fill="#6e6e73", anchor="mm")
    n = len(KEYS); slot = W / n
    for i, k in enumerate(KEYS):
        im = Image.open(os.path.join(ROOT, "img", k + ".webp")).convert("RGBA")
        im.thumbnail((int(slot * 1.02), 240), Image.LANCZOS)
        x = int(i * slot + slot / 2 - im.width / 2); y = 540 - im.height
        sh = Image.new("RGBA", (im.width + 40, 40), (0, 0, 0, 0))
        ImageDraw.Draw(sh).ellipse((10, 10, im.width + 30, 30), fill=(0, 0, 0, 70))
        canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)), (x - 20, 530))
        canvas.alpha_composite(im, (x, y))
    d.text((150, 596), "1976", font=font(20), fill="#9a9aa0", anchor="mm")
    d.text((W - 150, 596), "2026", font=font(20), fill="#9a9aa0", anchor="mm")
    d.line((190, 596, W - 190, 596), fill="#c4c4ca", width=2)
    canvas.convert("RGB").save(os.path.join(ROOT, "public", f"og-{lang}.jpg"), quality=86, optimize=True)
    print("og", lang)
