"""Build dotted land masks for the animated maps (no borders drawn, land outline only).

Source: Natural Earth land polygons via the world-atlas package (public domain).
Usage: python3 tools/maps.py <dir containing land-110m.json and land-50m.json>
"""
import json, os, sys
import numpy as np
from matplotlib.path import Path

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)


def rings(topo_file):
    topo = json.load(open(topo_file))
    sc, tr = topo["transform"]["scale"], topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0; pts = []
        for dx, dy in arc:
            x += dx; y += dy
            pts.append((x * sc[0] + tr[0], y * sc[1] + tr[1]))
        arcs.append(pts)
    out = []
    def ring(idxs):
        pts = []
        for i in idxs:
            a = arcs[i] if i >= 0 else arcs[~i][::-1]
            pts += a[(1 if pts else 0):]
        return np.array(pts)
    def walk(g):
        if g["type"] == "GeometryCollection":
            for x in g["geometries"]: walk(x)
        elif g["type"] == "Polygon":
            out.extend(ring(r) for r in g["arcs"])
        elif g["type"] == "MultiPolygon":
            for poly in g["arcs"]: out.extend(ring(r) for r in poly)
    walk(topo["objects"]["land"])
    return out


def dots(rs, lon0, lon1, lat0, lat1, step):
    lats = np.arange(lat0, lat1, step * 0.866)
    pts = []
    for j, la in enumerate(lats):
        off = (step / 2) if j % 2 else 0.0
        for lo in np.arange(lon0 + off, lon1, step):
            pts.append((lo, la))
    pts = np.array(pts)
    inside = np.zeros(len(pts), dtype=int)
    for r in rs:
        x0, y0 = r.min(axis=0); x1, y1 = r.max(axis=0)
        m = (pts[:, 0] >= x0) & (pts[:, 0] <= x1) & (pts[:, 1] >= y0) & (pts[:, 1] <= y1)
        if m.any():
            inside[m] += Path(r).contains_points(pts[m]).astype(int)
    return [[round(float(a), 2), round(float(b), 2)] for a, b in pts[inside % 2 == 1]]


src = sys.argv[1]
maps = {
    "world": {"dots": dots(rings(os.path.join(src, "land-110m.json")), -180, 180, -56, 78, 1.15)},
    "schina": {"dots": dots(rings(os.path.join(src, "land-50m.json")), 94, 128, 12, 36, 0.27)},
}
json.dump(maps, open(os.path.join(ROOT, "assets", "maps.json"), "w"), separators=(",", ":"))
print({k: len(v["dots"]) for k, v in maps.items()})
