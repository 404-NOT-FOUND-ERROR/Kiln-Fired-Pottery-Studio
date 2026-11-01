from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parent
OUT=ROOT.parents[1]/'assets'/'workshop'
for name in ('bisque-albedo','bisque-normal','bisque-roughness','bisque-ao'):
    image=Image.open(ROOT/'bakes'/(name+'.png')).convert('RGB')
    if name=='bisque-normal':image=image.resize((1536,1536),Image.Resampling.LANCZOS)
    image.save(OUT/(name+'.webp'),format='WEBP',lossless=name!='bisque-albedo',quality=94,method=6)
    print(name,image.size,(OUT/(name+'.webp')).stat().st_size)
