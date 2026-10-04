"""Original procedural ink studies for distant gallery panels (Pillow + numpy)."""
from pathlib import Path
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT=Path(__file__).resolve().parent/'textures';ROOT.mkdir(exist_ok=True)
random.seed(51);rng=np.random.default_rng(51)
W,H=512,1800
base=np.zeros((H,W,3),dtype=np.float32)+[156,139,105]
grain=rng.normal(0,2.2,(H,W,1));base+=grain
for y in range(H):base[y]+=(math.sin(y*.055)*.7+math.sin(y*.8)*.35)
paper=Image.fromarray(np.clip(base,0,255).astype('uint8'))
im=paper.copy();d=ImageDraw.Draw(im,'RGBA')
for layer in range(7):
    bottom=1050+layer*90;ridge=[]
    for x in range(-40,W+50,7):
        y=bottom-220*math.sin(x*.003+layer*.44)-95*math.sin(x*.017+layer*.73)-random.random()*12
        ridge.append((x,y))
    color=(32+layer*2,38+layer*2,34+layer,25+layer*9)
    d.polygon(ridge+[(W+40,bottom+220),(-40,bottom+180)],fill=color)
    for _ in range(80):
        x=random.randint(0,W-1);y=bottom-random.randint(20,150)
        d.line([(x,y),(x+random.randint(-18,18),y+random.randint(20,80))],fill=(35,34,26,random.randint(8,45)),width=random.randint(1,3))
for i in range(4):
    x=95+i*93;y=1310-random.randint(0,130);d.line((x,y,x-5,y-240),fill=(31,33,24,140),width=3)
    for j in range(7):
        yy=y-j*30;span=(8-j)*8;d.line((x-span,yy+7,x,yy-12,x+span*.7,yy+3),fill=(29,34,24,115),width=3)
font=ImageFont.truetype('C:/Windows/Fonts/simsun.ttc',31)
for i,char in enumerate('山色入窑火'):d.text((387,180+i*49),char,font=font,fill=(40,40,27,220))
d.rectangle((390,465,418,495),fill=(111,49,32,200));im.save(ROOT/'mountain.png')
im=paper.copy();d=ImageDraw.Draw(im,'RGBA');font=ImageFont.truetype('C:/Windows/Fonts/simsun.ttc',40)
for col,text in enumerate(['土与火之间','时间留下颜色','一器一会','看见手作的温度']):
    for i,char in enumerate(text):d.text((390-col*96,160+i*64+col*50),char,font=font,fill=(39,37,26,205))
d.rectangle((83,935,120,981),fill=(105,43,26,190));im.save(ROOT/'poem.png')
print('Created original gallery panel textures')
