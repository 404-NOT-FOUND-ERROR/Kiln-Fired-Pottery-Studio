from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parents[1]/'assets'/'living'
for name in ['window-full','window-above','window-detail']:
    Image.open(ROOT/'web-renders'/(name+'.png')).convert('RGB').save(OUT/(name+'.webp'),quality=95,method=6)
print([(p.name,p.stat().st_size) for p in OUT.iterdir()])
