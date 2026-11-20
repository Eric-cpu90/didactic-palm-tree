"""Prepare images: crop, unify tone, resize, blurred backdrops, manifest with attribution.

Reads  images.json (curated list), <raw dir>/meta.json + files (downloaded from Wikimedia Commons)
Writes assets/img/<key>.jpg, assets/img/<key>.bg.jpg, assets/manifest.json, assets/grain.png
Usage: python3 tools/images.py <raw dir> [<fallback raw dir> ...]
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageOps, ImageFilter, ImageEnhance

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "assets", "img")
MAXSIDE = 2000

SHADOW = np.array([12, 10, 8], dtype=np.float32)
MID = np.array([138, 128, 112], dtype=np.float32)
LIGHT = np.array([240, 232, 215], dtype=np.float32)


def duotone(gray):
    """Map a grayscale image to a warm monochrome ramp."""
    g = np.asarray(gray, dtype=np.float32) / 255.0
    g = g[..., None]
    lo = SHADOW + (MID - SHADOW) * np.clip(g * 2, 0, 1)
    hi = MID + (LIGHT - MID) * np.clip(g * 2 - 1, 0, 1)
    out = np.where(g < 0.5, lo, hi)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def tone(im, mode, spec):
    if mode == "mono":
        g = ImageOps.grayscale(im)
        g = ImageOps.autocontrast(g, cutoff=spec.get("cutoff", 0.4))
        if spec.get("gamma"):
            g = g.point(lambda v: 255 * (v / 255) ** spec["gamma"])
        if spec.get("invert"):
            g = ImageOps.invert(g)
        return duotone(g)
    if mode == "paper":                       # documents: keep a little of the paper colour
        g = duotone(ImageOps.autocontrast(ImageOps.grayscale(im), cutoff=0.2))
        c = ImageEnhance.Color(im.convert("RGB")).enhance(0.55)
        return Image.blend(g, c, spec.get("keep", 0.45))
    if mode == "color":                       # present-day photographs
        c = ImageEnhance.Color(im.convert("RGB")).enhance(spec.get("sat", 0.82))
        c = ImageEnhance.Contrast(c).enhance(1.04)
        warm = Image.new("RGB", c.size, (255, 236, 205))
        return Image.blend(c, Image.composite(warm, c, Image.new("L", c.size, 26)), 0.5)
    return im.convert("RGB")


def backdrop(im):
    b = ImageOps.fit(im, (480, 270), Image.LANCZOS)
    b = ImageOps.autocontrast(b, cutoff=2)
    b = ImageEnhance.Contrast(b).enhance(0.55)
    b = b.filter(ImageFilter.GaussianBlur(22))
    b = ImageEnhance.Brightness(b).enhance(0.50)
    return b


def calligraphy(im, spec):
    """Ink on paper -> paper-coloured strokes with alpha."""
    g = ImageOps.grayscale(im)
    a = np.asarray(g, dtype=np.float32) / 255.0
    if not spec.get("light_ink"):
        a = 1 - a
    lo, hi = spec.get("levels", [0.35, 0.75])
    a = np.clip((a - lo) / (hi - lo), 0, 1)
    rgba = np.zeros(a.shape + (4,), dtype=np.uint8)
    rgba[..., :3] = spec.get("ink", [238, 229, 208])
    rgba[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def main(raws):
    os.makedirs(OUT, exist_ok=True)
    spec_all = json.load(open(os.path.join(ROOT, "images.json"), encoding="utf-8"))
    meta = {}
    for d in reversed(raws):                      # earlier directories win
        for k, v in json.load(open(os.path.join(d, "meta.json"), encoding="utf-8")).items():
            meta[k] = dict(v, dir=d)
    manifest = {}
    for key, spec in spec_all.items():
        src = spec.get("src", key)
        if src not in meta:
            print("  (not downloaded yet)", key)
            continue
        m = meta[src]
        im = Image.open(os.path.join(m["dir"], m["file"]))
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        if "crop" in spec:
            l, t, r, b = spec["crop"]
            im = im.crop((int(l * im.width), int(t * im.height), int(r * im.width), int(b * im.height)))
        if spec.get("rotate"):
            im = im.rotate(spec["rotate"], expand=True, resample=Image.BICUBIC)
        if max(im.size) > MAXSIDE:
            im.thumbnail((MAXSIDE, MAXSIDE), Image.LANCZOS)
        mode = spec.get("tone", "mono")
        entry = {"title": m["title"], "license": m["license"], "artist": m["artist"], "credit": m["credit"],
                 "source": "https://commons.wikimedia.org/wiki/File:" + m["title"].replace(" ", "_")}
        if mode == "calligraphy":
            out = calligraphy(im, spec)
            fn = f"img/{key}.png"
            out.save(os.path.join(ROOT, "assets", fn), optimize=True)
        else:
            out = tone(im, mode, spec)
            if spec.get("sharpen", True):
                out = out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=45, threshold=2))
            fn = f"img/{key}.jpg"
            out.save(os.path.join(ROOT, "assets", fn), quality=90, optimize=True, subsampling=0)
            backdrop(out).save(os.path.join(ROOT, "assets", f"img/{key}.bg.jpg"), quality=80)
            entry["bg"] = f"img/{key}.bg.jpg"
        entry.update({"file": fn, "w": out.width, "h": out.height})
        entry["cover"] = bool(spec.get("cover", mode == "color"))
        for k in ("focus", "zoom"):
            if k in spec:
                entry[k] = spec[k]
        manifest[key] = entry
    json.dump(manifest, open(os.path.join(ROOT, "assets", "manifest.json"), "w"), ensure_ascii=False, indent=1)
    # static film-grain tile
    rng = np.random.default_rng(1866)
    n = np.clip(128 + rng.normal(0, 38, (512, 512)), 0, 255).astype(np.uint8)
    Image.fromarray(n, "L").filter(ImageFilter.GaussianBlur(0.6)).save(os.path.join(ROOT, "assets", "grain.png"))
    print("images:", len(manifest))


if __name__ == "__main__":
    main(sys.argv[1:])
