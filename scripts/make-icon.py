#!/usr/bin/env python3
"""Custom Tunnel 마켓플레이스 아이콘 생성 (128x128 PNG).
터널 포탈(동심원 깊이감) + 인디고→바이올렛 그라데이션 배경.
4배 슈퍼샘플링 후 LANCZOS 축소로 안티에일리어싱."""
from PIL import Image, ImageDraw

S = 4                      # supersample factor
SIZE = 128 * S
R = 26 * S                 # 라운드 코너 반경

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

# --- 1) 세로 그라데이션 배경 ---
top = (79, 70, 229)        # indigo #4F46E5
bot = (124, 58, 237)       # violet #7C3AED
bg = Image.new("RGB", (SIZE, SIZE))
bd = ImageDraw.Draw(bg)
for y in range(SIZE):
    bd.line([(0, y), (SIZE, y)], fill=lerp(top, bot, y / SIZE))

# --- 2) 라운드 사각형 마스크 ---
mask = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=R, fill=255)

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
img.paste(bg, (0, 0), mask)
d = ImageDraw.Draw(img)

# --- 3) 터널 포탈: 바깥(어두움) → 중심(밝은 시안) 동심원 ---
cx = cy = SIZE // 2
outer = 44 * S
rings = [
    (outer,        (49, 46, 129)),    # deep indigo
    (outer * 0.80, (67, 56, 202)),
    (outer * 0.62, (99, 102, 241)),
    (outer * 0.46, (56, 189, 248)),   # sky
    (outer * 0.30, (125, 211, 252)),  # light cyan
    (outer * 0.16, (224, 250, 255)),  # near white glow
]
for rad, col in rings:
    d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=col)

# --- 4) 관통하는 연결 화살표 (터널을 지나는 신호) ---
aw = 5 * S
d.line([(cx - outer * 1.15, cy), (cx + outer * 1.15, cy)],
       fill=(255, 255, 255), width=aw)
ah = 13 * S
tipx = cx + outer * 1.15
d.polygon([(tipx, cy), (tipx - ah, cy - ah * 0.7), (tipx - ah, cy + ah * 0.7)],
          fill=(255, 255, 255))

# --- 5) 축소 저장 ---
img.resize((128, 128), Image.LANCZOS).save("images/icon.png")
print("✅ images/icon.png (128x128) 생성 완료")
