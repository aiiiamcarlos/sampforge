# Convert supplied GTA glyph atlases to scalable launcher font outlines.
import sys, pathlib
if len(sys.argv)!=2:
 raise SystemExit('Uso: python scripts/convert-user-fonts.py <carpeta de atlas PNG>')
import cv2,numpy as np
from PIL import Image
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
source=pathlib.Path(sys.argv[1])
out=pathlib.Path(__file__).resolve().parents[1]/'web'/'assets'
accents='ÀÁÂÄÆÇÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜßàáâäæçèéêëìíîïòóôöùúûüÑñ¿'
def build(filename,family,display=False):
 a=np.array(Image.open(source/filename).convert('RGBA'))[:,:,3]
 mapping={chr(c):c-32 for c in range(32,127)}
 mapping.update({c:96+i for i,c in enumerate(accents)})
 if display:
  for i,c in enumerate('ABCDEFGHIJKLMNOPQRSTUVWXYZ'):mapping[c]=mapping[c.lower()]=155+i
  for i,c in enumerate('0123456789'):mapping[c]=144+i
 glyphs={};metrics={};cmap={};order=['.notdef']
 p=TTGlyphPen(None);glyphs['.notdef']=p.glyph();metrics['.notdef']=(500,0)
 for ch,index in mapping.items():
  name='uni%04X'%ord(ch);order.append(name);cmap[ord(ch)]=name
  cell=a[(index//16)*320:(index//16+1)*320,(index%16)*256:(index%16+1)*256]
  mask=np.uint8(cell>100)*255
  contours,_=cv2.findContours(mask,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
  pen=TTGlyphPen(None);xs=[]
  if ch!=' ':
   for contour in contours:
    contour=cv2.approxPolyDP(contour,0.55,True)
    if len(contour)<3:continue
    points=[(int(pt[0][0]*3.125),int((260-pt[0][1])*3.125)) for pt in contour]
    pen.moveTo(points[0]);xs.extend(x for x,y in points)
    for pt in points[1:]:pen.lineTo(pt)
    pen.closePath()
  glyphs[name]=pen.glyph();metrics[name]=((max(xs)+48 if xs else 340),min(xs) if xs else 0)
 # Map common UI punctuation to supplied glyphs, keeping all text in these fonts.
 for dst,src in {'’':"'",'‘':"'",'“':'"','”':'"','–':'-','—':'-','…':'.','·':'.','→':'>','←':'<','↓':'v','↗':'>','＋':'+','×':'x','★':'*','☆':'*','▶':'>'}.items():cmap[ord(dst)]=cmap[ord(src)]
 fb=FontBuilder(1000,isTTF=True);fb.setupGlyphOrder(order);fb.setupCharacterMap(cmap);fb.setupGlyf(glyphs);fb.setupHorizontalMetrics(metrics);fb.setupHorizontalHeader(ascent=850,descent=-220);fb.setupNameTable({'familyName':family,'styleName':'Regular','uniqueFontIdentifier':family+'-DJDarkoAtlas','fullName':family,'psName':family});fb.setupOS2(sTypoAscender=850,sTypoDescender=-220,usWinAscent=950,usWinDescent=250);fb.setupPost();fb.setupMaxp();fb.save(out/(family+'.ttf'))
build('Pricedown and TW Century (X) (Plain).png','SampCentury')
build('Pricedown and TW Century (X) (Plain).png','SampPricedown',True)
build('Bank Gothic and Beckett (1) (Plain).png','SampBeckett')
print('Converted supplied glyphs: Century, Pricedown, Beckett')
