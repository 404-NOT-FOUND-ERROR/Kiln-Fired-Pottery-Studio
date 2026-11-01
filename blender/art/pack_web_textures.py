from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parents[1]/'assets'/'art';OUT.mkdir(parents=True,exist_ok=True)
for view in ['full','detail','above']:
    Image.open(ROOT/'web-renders'/('colorfield-'+view+'.png')).convert('RGB').save(OUT/('colorfield-'+view+'.webp'),quality=95,method=6)
for name in ['art-specimen','art-normal','art-roughness']:
    Image.open(ROOT/'web-bakes'/(name+'.png')).convert('RGB').save(OUT/(name+'.webp'),quality=95,method=6,lossless=name!='art-specimen')
print('ART_WEB_TEXTURES_READY')
