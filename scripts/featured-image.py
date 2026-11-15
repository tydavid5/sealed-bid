"""Generate featured.png, 1600 by 900, deep navy with soft gold, sealed envelope."""
from PIL import Image, ImageDraw, ImageFont

W, H = 1600, 900
navy = (10, 26, 51)
navy2 = (18, 41, 77)
gold = (201, 162, 39)
gold_soft = (227, 199, 102)
ink = (232, 237, 245)
muted = (159, 176, 201)

img = Image.new("RGB", (W, H), navy)
d = ImageDraw.Draw(img)
for y in range(H):
    t = y / H
    r = int(navy[0] + (navy2[0] - navy[0]) * t)
    g = int(navy[1] + (navy2[1] - navy[1]) * t)
    b = int(navy[2] + (navy2[2] - navy[2]) * t)
    d.line([(0, y), (W, y)], fill=(r, g, b))
for i in range(90):
    x = (i * 173) % W
    y = (i * 97) % H
    d.ellipse([x, y, x + 3, y + 3], fill=(60, 55, 25))

def font(sz, bold=False):
    paths = ["/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
             "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    for p in paths:
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            pass
    return ImageFont.load_default()

ex0, ey0, ex1, ey1 = 950, 250, 1450, 620
d.rounded_rectangle([ex0, ey0, ex1, ey1], radius=18, fill=(16, 35, 63), outline=gold, width=4)
d.line([(ex0 + 6, ey0 + 10), (1200, ey0 + 190), (ex1 - 6, ey0 + 10)], fill=gold, width=4)
d.ellipse([1150, 400, 1250, 500], fill=gold)
d.text((1200, 450), "S", font=font(64, True), anchor="mm", fill=navy)
d.line([(1000, 560), (1400, 560)], fill=gold, width=2)
d.text((1200, 585), "ML-KEM-1024", font=font(30), anchor="mm", fill=gold_soft)

d.text((90, 210), "Sealed Bid", font=font(120, True), fill=ink)
d.text((92, 360), "Open bids let others copy your price.", font=font(44), fill=gold_soft)
d.text((92, 440), "Every bid stays sealed until close.", font=font(44), fill=muted)
d.text((92, 760), "QoreChain testnet  |  qorechain-diana  |  chain id 9800", font=font(32), fill=muted)
d.line([(90, 700), (700, 700)], fill=gold, width=3)
img.save("featured.png", optimize=True)
print("saved featured.png")
