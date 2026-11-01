"""Prepare bounded texture resolution and compact mesh buffers for the web build.
Source art and the original offline delivery are never overwritten.
"""
import base64, gzip, io, json, math, re
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'dist/pottery-studio.html').read_text(encoding='utf8')
bundle=json.loads(re.search(r'<script id="pottery-bundle" type="application/json">([\s\S]*?)</script>',html)[1])
out=ROOT/'qa-artifacts/platform-assets'
out.mkdir(parents=True,exist_ok=True)

def hdr_small(data):
    stream=io.BytesIO(data)
    while stream.readline().strip(): pass
    dims=stream.readline().decode().split()
    h,w=int(dims[1]),int(dims[3])
    rows=np.empty((h,w,4),dtype=np.uint8)
    for y in range(h):
        tag=stream.read(4)
        if tag[:2]!=b'\x02\x02': raise ValueError('Unexpected HDR scanline')
        for c in range(4):
            x=0
            while x<w:
                n=stream.read(1)[0]
                if n>128:
                    rows[y,x:x+n-128,c]=stream.read(1)[0];x+=n-128
                else:
                    rows[y,x:x+n,c]=np.frombuffer(stream.read(n),dtype=np.uint8);x+=n
    rgb=rows[:,:,:3].astype(np.float32)*np.exp2(rows[:,:,3].astype(np.float32)-136)[:,:,None]
    ratio=max(1,math.ceil(w/512))
    if ratio>1 and w%ratio==0 and h%ratio==0:
        rgb=rgb.reshape(h//ratio,ratio,w//ratio,ratio,3).mean(axis=(1,3))
    elif ratio>1:
        rgb=np.stack([np.asarray(Image.fromarray(rgb[:,:,c]).resize((512,round(h*512/w)),Image.Resampling.BOX)) for c in range(3)],axis=2)
    h,w=rgb.shape[:2];maximum=rgb.max(axis=2)
    exponent=np.floor(np.log2(np.maximum(maximum,1e-32))).astype(np.int32)+1
    pixels=np.zeros((h,w,4),dtype=np.uint8)
    pixels[:,:,:3]=np.clip(rgb*np.exp2(8-exponent)[:,:,None],0,255).astype(np.uint8)
    pixels[:,:,3]=np.where(maximum>1e-30,exponent+128,0).astype(np.uint8)
    result=bytearray(f'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y {h} +X {w}\n'.encode())
    for row in pixels:
        result.extend([2,2,w>>8,w&255])
        for c in range(4):
            values=row[:,c].tobytes()
            for i in range(0,w,127):
                block=values[i:i+127];result.append(len(block));result.extend(block)
    return bytes(result),[w,h]

manifests={}
for name,item in bundle['assets'].items():
    if name.endswith('manifest.json'):
        doc=json.loads(base64.b64decode(item['data']))
        for entry in doc.values():
            if isinstance(entry,dict) and 'vertices' in entry:
                manifests[str(Path(name).parent/entry['file']).replace('\\','/')]=entry

assets={};report=[]
for name,item in bundle['assets'].items():
    raw=base64.b64decode(item['data']);data=raw;record={'type':item['type']}
    note=None
    if name in manifests:
        info=manifests[name];v=info['vertices'];count=info['indices']
        values=np.frombuffer(raw,dtype='<f4',count=v*8).reshape(v,8)
        low=values.min(axis=0);high=values.max(axis=0);span=high-low
        unit=np.where(span>0,span,1)
        quant=np.rint((values-low)/unit*65535).clip(0,65535).astype('<u2')
        indices=np.frombuffer(raw,dtype='<u4',count=count,offset=v*32)
        assert v<65536
        # Keep equal channels together, then byte-shuffle and delta-code indices.
        # This only changes storage ordering; mesh topology is preserved.
        delta=np.diff(indices.astype(np.int64),prepend=0).astype('<u2')
        packed=np.concatenate([quant.T.reshape(-1),delta]).astype('<u2')
        shuffled=packed.view(np.uint8).reshape(-1,2).T.tobytes()
        data=gzip.compress(shuffled,compresslevel=9,mtime=0)
        record.update(encoding='mesh16-planar-gzip',vertices=v,indices=count,low=low.tolist(),span=span.tolist())
        note={'positionError':float(max(span[:3])/65535/2),'vertices':v}
    elif name.endswith('.hdr'):
        data,dims=hdr_small(raw)
        data=gzip.compress(data,compresslevel=9,mtime=0);record['encoding']='gzip'
        note={'resolution':dims}
    elif name.endswith('.webp'):
        im=Image.open(io.BytesIO(raw));limit=1024 if 'normal' in name else 2048
        if max(im.size)>limit:
            im.thumbnail((limit,limit),Image.Resampling.LANCZOS)
            if 'normal' in name:
                normals=np.asarray(im.convert('RGB')).astype(np.float32)/127.5-1
                normals/=np.maximum(np.linalg.norm(normals,axis=2,keepdims=True),1e-6)
                im=Image.fromarray(np.clip((normals+1)*127.5,0,255).astype(np.uint8))
            buffer=io.BytesIO();im.save(buffer,format='WEBP',quality=90,method=6);data=buffer.getvalue()
            note={'resolution':list(im.size)}
    assert len(data)<=1024*1024,(name,len(data))
    mime='application/gzip' if record.get('encoding') else item['type']
    record['uri']='data:'+mime+';base64,'+base64.b64encode(data).decode()
    assets[name]=record;report.append({'file':name,'before':len(raw),'after':len(data),'detail':note})
(out/'assets.json').write_text(json.dumps(assets,separators=(',',':')),encoding='utf8')
(out/'report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({'originalBytes':sum(x['before'] for x in report),'preparedBytes':sum(x['after'] for x in report),'files':len(report),'largestBytes':max(x['after'] for x in report)}))
