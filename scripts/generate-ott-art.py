"""Original deterministic fixture artwork, not photographs or external film artwork."""
import hashlib,json,struct,zlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'ott/assets'
colors=[(34,78,96),(62,48,90),(25,88,83),(104,63,44),(60,78,48),(79,47,72),(37,61,104),(99,78,42)]
manifest=[]
for i,base in enumerate(colors):
 for shape,w,h in [('landscape',480,270),('poster',240,360)]:
  raw=bytearray()
  for y in range(h):
   raw.append(0)
   for x in range(w):
    sun=(x-w*.72)**2+(y-h*.3)**2<(w*.17)**2
    mountain=y>h*(.72-abs(x/w-.45)*.45)
    rgb=(224,190,126) if sun else tuple(max(0,int(c*(.55 if mountain else 1-y/h*.35))) for c in base)
    raw.extend(rgb)
  def chunk(tag,data):return struct.pack('!I',len(data))+tag+data+struct.pack('!I',zlib.crc32(tag+data)&0xffffffff)
  data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(raw)))+chunk(b'IEND',b'')
  name=f'{i}-{shape}.png';(root/name).write_bytes(data)
  manifest.append({'file':name,'sha256':hashlib.sha256(data).hexdigest(),'width':w,'height':h})
(root/'manifest.json').write_text(json.dumps({'credit':'Original procedural fixture illustrations authored for Itar Cinema. Reused motifs are intentional; all titles and people are fictional.','generator':'scripts/generate-art.py','files':manifest},indent=2)+'\n')
