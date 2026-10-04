from PIL import Image
from pathlib import Path
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parents[1]/'assets'/'museum';OUT.mkdir(exist_ok=True,parents=True)
for name in ['glaze-normal','glaze-roughness','glaze-detail']:
    Image.open(ROOT/'web-bakes'/(name+'.png')).convert('RGB').save(OUT/(name+'.webp'),lossless=True,method=6)
Image.open(ROOT/'web-bakes/specimen-albedo.png').convert('RGB').save(OUT/'specimen-albedo.webp',quality=96,method=6)
Image.open(ROOT/'web-bakes/specimen-paint.png').convert('RGB').save(OUT/'specimen-paint.webp',quality=96,method=6)
for name in ['gallery-full','gallery-above']:
    Image.open(ROOT/'web-bakes'/(name+'.png')).convert('RGB').save(OUT/(name+'.webp'),quality=93,method=6)
print([(p.name,p.stat().st_size) for p in OUT.iterdir()])
