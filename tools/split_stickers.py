#!/usr/bin/env python3
"""
把 9 宫格表情包图片切分并抠成透明底贴纸。

用法:
    python3 tools/split_stickers.py 九宫格.jpg -o stickers/

说明:
    - 自动按 3x3 切分, 从图片边缘洪水填充去除背景(保留贴纸白边和装饰)
    - 输出 9 张透明底 PNG: baby-1.png ~ baby-9.png (按从左到右、从上到下排序)
    - 依赖: pip3 install pillow numpy
"""

import argparse
import os
from collections import deque

import numpy as np
from PIL import Image, ImageFilter


def flood_bg(arr: np.ndarray) -> np.ndarray:
    """从图片边缘 BFS 洪水填充, 返回背景掩码(背景为 True)。"""
    h, w, _ = arr.shape
    mn = arr.min(axis=2).astype(int)
    mx = arr.max(axis=2).astype(int)
    # 背景判定: 接近纯白的中性色
    is_bgish = (mn >= 243) & ((mx - mn) <= 14)
    bg = np.zeros((h, w), bool)
    dq = deque()

    for x in range(w):
        for y in (0, h - 1):
            if is_bgish[y, x] and not bg[y, x]:
                bg[y, x] = True
                dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if is_bgish[y, x] and not bg[y, x]:
                bg[y, x] = True
                dq.append((y, x))

    while dq:
        y, x = dq.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and is_bgish[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                dq.append((ny, nx))
    return bg


def cut(src_path: str, out_dir: str) -> None:
    src = Image.open(src_path).convert("RGB")
    W, H = src.size
    os.makedirs(out_dir, exist_ok=True)

    for idx in range(9):
        r, c = divmod(idx, 3)
        cell = src.crop(
            (round(c * W / 3), round(r * H / 3), round((c + 1) * W / 3), round((r + 1) * H / 3))
        )
        arr = np.array(cell)
        alpha = np.where(flood_bg(arr), 0, 255).astype(np.uint8)
        am = Image.fromarray(alpha, "L").filter(ImageFilter.GaussianBlur(0.8))

        rgba = cell.convert("RGBA")
        rgba.putalpha(am)
        bbox = am.point(lambda v: 255 if v > 8 else 0).getbbox()
        if bbox:
            pad = 6
            bbox = (
                max(0, bbox[0] - pad),
                max(0, bbox[1] - pad),
                min(rgba.width, bbox[2] + pad),
                min(rgba.height, bbox[3] + pad),
            )
            rgba = rgba.crop(bbox)

        out = os.path.join(out_dir, f"baby-{idx + 1}.png")
        rgba.save(out)
        print(f"{out}  {rgba.size}")


def main() -> None:
    ap = argparse.ArgumentParser(description="9 宫格表情包切分抠图工具")
    ap.add_argument("image", help="9 宫格原图路径 (jpg/png)")
    ap.add_argument("-o", "--out", default="stickers", help="输出目录 (默认 stickers/)")
    args = ap.parse_args()
    cut(args.image, args.out)
    print("完成! 把输出目录放到 web/ 与 desktop/ 对应位置即可。")


if __name__ == "__main__":
    main()
