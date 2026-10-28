# Liquid Glass simge konseptlerini üretir.
# Kullanım: python3 scripts/icon-concepts/liquid-glass.py assets/icon-concepts/liquid-glass <meta-çıktı-klasörü>
import os, json, sys, math
OUT, METAOUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

def receipt(x, y, w, h, n=8, d=None, r=24):
    step = w / n; d = d if d is not None else step * 0.42
    p = [f"M{x},{y+r} A{r},{r} 0 0 1 {x+r},{y} H{x+w-r} A{r},{r} 0 0 1 {x+w},{y+r} V{y+h}"]
    for i in range(n):
        p.append(f"L{x+w-step*i-step/2:.1f},{y+h-d:.1f} L{x+w-step*(i+1):.1f},{y+h}")
    return " ".join(p) + " Z"

def lira(cx, cy, s, color, sw):
    P = lambda a, b: f"{cx+a*s:.1f},{cy+b*s:.1f}"
    return (f'<g fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">'
            f'<path d="M{P(-0.18,-0.55)} V{cy+0.5*s:.1f} C{P(0.2,0.5)} {P(0.46,0.28)} {P(0.46,-0.06)}"/>'
            f'<path d="M{P(-0.44,0.04)} L{P(0.12,-0.2)}"/><path d="M{P(-0.44,-0.2)} L{P(0.12,-0.44)}"/></g>')

def pills(x, y, w, color, rows, gap=56, h=22, op=1):
    o = []
    for i, (a, b) in enumerate(rows):
        yy = y + i * gap
        if a: o.append(f'<rect x="{x}" y="{yy}" width="{a}" height="{h}" rx="{h/2}" fill="{color}" opacity="{op}"/>')
        if b: o.append(f'<rect x="{x+w-b}" y="{yy}" width="{b}" height="{h}" rx="{h/2}" fill="{color}" opacity="{op}"/>')
    return "".join(o)

def star(cx, cy, s, k=.14):
    q = s * k
    return (f"M{cx},{cy-s} C{cx+q},{cy-q} {cx+q},{cy-q} {cx+s},{cy} C{cx+q},{cy+q} {cx+q},{cy+q} {cx},{cy+s} "
            f"C{cx-q},{cy+q} {cx-q},{cy+q} {cx-s},{cy} C{cx-q},{cy-q} {cx-q},{cy-q} {cx},{cy-s} Z")

def circle(cx, cy, r):
    return f"M{cx-r},{cy} A{r},{r} 0 1 0 {cx+r},{cy} A{r},{r} 0 1 0 {cx-r},{cy} Z"

def capsule(x1, y1, x2, y2, w):
    dx, dy = x2-x1, y2-y1; L = math.hypot(dx, dy); nx, ny = -dy/L*w/2, dx/L*w/2
    r = w/2
    return (f"M{x1+nx:.1f},{y1+ny:.1f} L{x2+nx:.1f},{y2+ny:.1f} A{r},{r} 0 0 0 {x2-nx:.1f},{y2-ny:.1f} "
            f"L{x1-nx:.1f},{y1-ny:.1f} A{r},{r} 0 0 0 {x1+nx:.1f},{y1+ny:.1f} Z")

class Icon:
    def __init__(s, mode):
        s.mode, s.defs, s.body, s.n = mode, [], [], 0
        s.dark = mode == "dark"
    def id(s, p="i"):
        s.n += 1; return f"{p}{s.n}"
    def lg(s, stops, x1=0, y1=0, x2=0, y2=1):
        i = s.id("g")
        st = "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
        s.defs.append(f'<linearGradient id="{i}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{st}</linearGradient>')
        return f"url(#{i})"
    def rg(s, stops, cx=.5, cy=.5, r=.5, fx=None, fy=None):
        i = s.id("r"); f = f' fx="{fx}" fy="{fy}"' if fx is not None else ""
        st = "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
        s.defs.append(f'<radialGradient id="{i}" cx="{cx}" cy="{cy}" r="{r}"{f}>{st}</radialGradient>')
        return f"url(#{i})"
    def blur(s, sd):
        i = s.id("b")
        s.defs.append(f'<filter id="{i}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="{sd}"/></filter>')
        return f"url(#{i})"
    def bg(s, light, dark):
        a, b = dark if s.dark else light
        s.add(f'<rect width="1024" height="1024" fill="{s.lg([(0,a,1),(1,b,1)])}"/>')
    def add(s, x): s.body.append(x); return x
    def glass(s, d, behind="", tf="", tint="#FFFFFF", strength=1.0, rule="nonzero"):
        """Liquid Glass katmanı: altındakini buzlu gösterir, kenarda parlama, altında yumuşak gölge."""
        t = f' transform="{tf}"' if tf else ""
        top, bot = ((.30, .10) if s.dark else (.62, .30))
        top, bot = top*strength, bot*strength
        cid, mid = s.id("c"), s.id("m")
        s.defs.append(f'<clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{d}"{t} clip-rule="{rule}"/></clipPath>')
        s.defs.append(f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="#fff"/><path d="{d}"{t} fill="#000" fill-rule="{rule}"/></mask>')
        sh = s.blur(20)
        fill = s.lg([(0, tint, top), (1, tint, bot)])
        rim = s.lg([(0, "#FFFFFF", .95), (.42, "#FFFFFF", .12), (.7, "#FFFFFF", .05), (1, "#FFFFFF", .55)], 0, 0, 1, 1)
        inner = s.lg([(0, "#FFFFFF", .0), (1, "#FFFFFF", .22 if not s.dark else .10)])
        so = .40 if s.dark else .16
        out = (f'<g mask="url(#{mid})"><path d="{d}" fill="#000" fill-rule="{rule}" opacity="{so}" filter="{sh}" transform="translate(0 18) {tf}"/></g>'
               f'<g clip-path="url(#{cid})"><g filter="{s.blur(26)}">{behind}</g>'
               f'<path d="{d}"{t} fill="{fill}" fill-rule="{rule}"/><path d="{d}"{t} fill="{inner}" fill-rule="{rule}"/></g>'
               f'<path d="{d}"{t} fill="none" fill-rule="{rule}" stroke="{rim}" stroke-width="7"/>')
        return s.add(out)
    def svg(s):
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><defs>{"".join(s.defs)}</defs>{"".join(s.body)}</svg>'

ICONS = []
def icon(slug, name, desc):
    def deco(fn): ICONS.append((slug, name, desc, fn)); return fn
    return deco

W = "#FFFFFF"

@icon("cam-fis", "Cam Fiş", "Turuncu bir güneşin önünde buzlu cam fiş, üstünde ₺. Sıcak ve sade.")
def _(I):
    I.bg(("#FFF1DE", "#FFC98A"), ("#2A1A0D", "#0C0704"))
    sun = f'<circle cx="650" cy="360" r="215" fill="{I.lg([(0,"#FF9A3D",1),(1,"#FF3D6E",1)],0,0,1,1)}"/>'
    I.add(sun)
    I.glass(receipt(292, 236, 380, 584, n=10, r=52), sun)
    I.add(lira(482, 500, 250, "#F2551E" if not I.dark else W, 46))

@icon("tarama-isigi", "Tarama Işığı", "Cam fişin arkasından geçen mavi ışık bandı; tarama anını anlatır.")
def _(I):
    I.bg(("#EAF2FF", "#B9D3FF"), ("#0A1428", "#02050C"))
    beam = (f'<rect x="120" y="448" width="784" height="128" rx="64" fill="{I.lg([(0,"#00D1FF",1),(.5,"#2F6BFF",1),(1,"#8B5CFF",1)],0,0,1,0)}"/>')
    I.add(f'<g filter="{I.blur(40)}" opacity=".7">{beam}</g>' + beam)
    I.glass(receipt(332, 186, 360, 650, n=10, r=52), beam)
    c = "#2F4A80" if not I.dark else W
    I.add(pills(392, 270, 240, c, [(240, 0), (130, 60)], gap=64, op=.55))
    I.add(pills(392, 640, 240, c, [(150, 50)], op=.55))
    I.add(f'<rect x="300" y="502" width="424" height="20" rx="10" fill="#FFFFFF"/>')

@icon("katmanlar", "Katmanlar", "Derinlik sırasıyla dizilmiş üç fiş: renkli arka, iki cam ön katman. Toplu tarama.")
def _(I):
    I.bg(("#F0ECFF", "#CBBFFF"), ("#150E33", "#05030E"))
    back = f'<path d="{receipt(212,160,320,520,n=9,r=44)}" fill="{I.lg([(0,"#8A6BFF",1),(1,"#C04BFF",1)],0,0,1,1)}"/>'
    I.add(back)
    mid = receipt(352, 270, 320, 520, n=9, r=44)
    I.glass(mid, back)
    I.glass(receipt(492, 380, 320, 520, n=9, r=44), back + f'<path d="{mid}" fill="#FFFFFF" opacity=".5"/>')
    I.add(pills(552, 450, 200, "#6B4BE0" if not I.dark else W, [(200, 0), (110, 50)], gap=60, op=.6))

@icon("lens", "Lens", "Kamera merceği; göz bebeğinde küçük bir fiş. Kameradan okuma fikri.")
def _(I):
    I.bg(("#F4F6F9", "#D3D9E3"), ("#1D2028", "#040507"))
    I.add(f'<circle cx="512" cy="512" r="318" fill="{"#1B2232" if not I.dark else "#2A3142"}"/>')
    iris = f'<circle cx="512" cy="512" r="236" fill="{I.rg([(0,"#5FD3FF",1),(.45,"#3D6BFF",1),(.8,"#7A3CFF",1),(1,"#140B3A",1)])}"/>'
    I.add(iris)
    I.glass(circle(512, 512, 236), iris, strength=.35)
    I.add(f'<path d="{receipt(450,402,124,196,n=5,r=14)}" fill="#FFFFFF"/>')
    I.add(f'<path d="M370 380 A190 190 0 0 1 520 300" fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round" opacity=".85"/>')

@icon("geometri", "Geometri", "Sarı daire, mercan çeyrek daire ve cam fiş. Bauhaus esintili, cesur ve düz.")
def _(I):
    I.bg(("#FFFFFF", "#EEF1F6"), ("#1A1C22", "#060709"))
    shapes = (f'<circle cx="372" cy="392" r="206" fill="#FFC21A"/>'
              f'<path d="M820 860 V520 A340 340 0 0 0 480 860 Z" fill="#FF5A4E"/>')
    I.add(shapes)
    I.glass(receipt(428, 222, 330, 560, n=9, r=48), shapes)
    I.add(pills(486, 300, 214, "#1C2230" if not I.dark else W, [(214, 0), (120, 50), (90, 50)], gap=62, op=.7))

@icon("madeni-para", "Madeni Para", "Fişin önünde altın renkli cam madeni para ve ₺.")
def _(I):
    I.bg(("#FFF4D9", "#FFD27E"), ("#2A1E06", "#0B0802"))
    r = f'<path d="{receipt(228,170,330,560,n=9,r=44)}" fill="{"#FFFFFF" if not I.dark else "#3B3428"}"/>' + \
        pills(288, 250, 210, "#E9D3A6" if not I.dark else "#5A5040", [(210, 0), (120, 50), (100, 50), (140, 40)], gap=62)
    I.add(r)
    coin = f'<circle cx="610" cy="610" r="236" fill="{I.lg([(0,"#FFD54A",1),(1,"#F29A00",1)],0,0,1,1)}"/>'
    I.add(f'<circle cx="610" cy="628" r="236" fill="#B86A00" opacity=".5"/>')
    I.add(coin)
    I.glass(circle(610, 610, 236), coin + r, tint="#FFF6D8", strength=.55)
    I.add(f'<circle cx="610" cy="610" r="182" fill="none" stroke="#FFFFFF" stroke-width="10" opacity=".55"/>')
    I.add(lira(610, 612, 230, "#FFFFFF", 40))

@icon("yuzde", "Yüzde", "İki parlak küre ve aralarından geçen cam çubuk: KDV yüzdesi.")
def _(I):
    I.bg(("#FFE6EE", "#FF9FBC"), ("#2A0A15", "#0A0205"))
    ball = lambda cx, cy: f'<circle cx="{cx}" cy="{cy}" r="126" fill="{I.rg([(0,"#FFD0DE",1),(.35,"#FF4D7E",1),(1,"#B3003C",1)],.5,.5,.6,.35,.3)}"/>'
    balls = ball(370, 370) + ball(654, 654)
    I.add(balls)
    I.glass(capsule(700, 250, 324, 774, 120), balls)

@icon("kivilcim", "Kıvılcım", "Renkli fişin önünde büyük cam parıltı: yapay zekâ ile okuma.")
def _(I):
    I.bg(("#ECE9FF", "#BCC8FF"), ("#0D0B25", "#030208"))
    r = f'<path d="{receipt(240,250,340,560,n=9,r=48)}" fill="{I.lg([(0,"#4F7BFF",1),(1,"#A65BFF",1)],0,0,1,1)}"/>' + \
        pills(300, 330, 220, "#FFFFFF", [(220, 0), (120, 50), (90, 50), (150, 40)], gap=62, op=.45)
    I.add(r)
    I.glass(star(650, 400, 250), r)
    I.add(f'<path d="{star(808,742,64)}" fill="{"#7A5CFF" if not I.dark else W}"/>')

@icon("cam-vizor", "Cam Vizör", "Kalın cam köşelerle çerçevelenmiş yeşil fiş.")
def _(I):
    I.bg(("#E2F8F0", "#A0E6CD"), ("#05221B", "#010A08"))
    r = f'<path d="{receipt(372,256,280,510,n=8,r=40)}" fill="{I.lg([(0,"#00D49A",1),(1,"#0096B8",1)],0,0,1,1)}"/>' + \
        pills(424, 330, 176, "#FFFFFF", [(176, 0), (100, 40), (80, 40)], gap=56, op=.6)
    I.add(r)
    x0 = y0 = 190; L = 200; t = 72; R = 96; ri = R - t
    d = (f"M{x0},{y0+L} V{y0+R} A{R},{R} 0 0 1 {x0+R},{y0} H{x0+L} A{t/2},{t/2} 0 0 1 {x0+L},{y0+t} "
         f"H{x0+t+ri} A{ri},{ri} 0 0 0 {x0+t},{y0+t+ri} V{y0+L} A{t/2},{t/2} 0 0 1 {x0},{y0+L} Z")
    for a in (0, 90, 180, 270):
        I.glass(d, "", tf=f"rotate({a} 512 512)", strength=1.15)

@icon("halka", "Halka", "Kategori renklerinin üstünde cam halka, ortada ₺: harcama dağılımı.")
def _(I):
    I.bg(("#F5F7FB", "#DCE2EE"), ("#15181F", "#040507"))
    def arc(r, a0, a1):
        p = lambda a: (512 + r*math.cos(math.radians(a)), 512 + r*math.sin(math.radians(a)))
        (x0, y0), (x1, y1) = p(a0), p(a1)
        return f"M{x0:.1f},{y0:.1f} A{r},{r} 0 {1 if a1-a0>180 else 0} 1 {x1:.1f},{y1:.1f}"
    segs = [(-90, 30, "#2F6BFF"), (30, 140, "#FF9F0A"), (140, 220, "#30D158"), (220, 270, "#FF375F")]
    s = "".join(f'<path d="{arc(250,a+4,b-4)}" fill="none" stroke="{c}" stroke-width="130" stroke-linecap="round"/>' for a, b, c in segs)
    I.add(s)
    ring = circle(512, 512, 300) + " " + circle(512, 512, 200)
    I.glass(ring, s, rule="evenodd", strength=.75)
    I.add(lira(512, 514, 210, "#1C2230" if not I.dark else W, 38))

@icon("yazici", "Yazıcı", "Cam yazar kasa gövdesinden çıkan fiş; POS fişinin doğduğu an.")
def _(I):
    I.bg(("#E6F3FF", "#A6D2FF"), ("#061628", "#01060D"))
    r = f'<path d="{receipt(362,380,300,470,n=8,r=0)}" fill="{"#FFFFFF" if not I.dark else "#E9EEF6"}"/>' + \
        pills(414, 560, 196, "#9DB7D8", [(196, 0), (110, 46), (90, 46)], gap=58)
    I.add(r)
    I.add(f'<rect x="414" y="740" width="196" height="26" rx="13" fill="#0A6CFF"/>')
    blob = f'<rect x="262" y="250" width="500" height="200" rx="60" fill="{I.lg([(0,"#0A84FF",1),(1,"#8B5CFF",1)],0,0,1,0)}"/>'
    I.glass("M222,300 A80,80 0 0 1 302,220 H722 A80,80 0 0 1 802,300 V400 A80,80 0 0 1 722,480 H302 A80,80 0 0 1 222,400 Z", blob + r)
    I.add('<rect x="342" y="430" width="340" height="14" rx="7" fill="#0D2340" opacity=".55"/>')
    I.add('<circle cx="712" cy="320" r="22" fill="#30D158"/>')

@icon("aurora", "Aurora", "Kuzey ışıklarını andıran renk bulutlarının önünde cam fiş.")
def _(I):
    I.bg(("#F3F5FF", "#FFFFFF"), ("#060918", "#020309"))
    a = (f'<g filter="{I.blur(70)}"><circle cx="300" cy="320" r="230" fill="#22D3B6"/><circle cx="720" cy="360" r="240" fill="#7C4DFF"/>'
         f'<circle cx="560" cy="760" r="240" fill="#FF4FA3"/></g>')
    I.add(a)
    I.glass(receipt(342, 206, 340, 610, n=9, r=52), a, strength=.9)
    I.add(pills(400, 290, 224, "#3A3F8F" if not I.dark else W, [(224, 0), (120, 50), (90, 50), (140, 40)], gap=64, op=.5))
    I.add(f'<rect x="400" y="650" width="224" height="34" rx="17" fill="{"#3A3F8F" if not I.dark else W}" opacity=".8"/>')

@icon("renkli-satirlar", "Renkli Satırlar", "Her satırı bir kategori rengi olan fiş ve cam toplam etiketi.")
def _(I):
    I.bg(("#FFFFFF", "#ECEFF4"), ("#1B1D23", "#06070A"))
    sh = I.blur(24)
    rp = receipt(292, 180, 380, 640, n=10, r=52)
    I.add(f'<path d="{rp}" fill="#0B1A3A" opacity="{.15 if not I.dark else .5}" filter="{sh}" transform="translate(0 20)"/>')
    I.add(f'<path d="{rp}" fill="{"#FFFFFF" if not I.dark else "#2A2E37"}"/>')
    rows = [(360, 270, 220, "#FF9F0A"), (360, 340, 150, "#30D158"), (360, 410, 250, "#2F6BFF"), (360, 480, 120, "#FF375F"), (360, 550, 190, "#BF5AF2")]
    sr = "".join(f'<rect x="{x}" y="{y}" width="{w}" height="34" rx="17" fill="{c}"/>' for x, y, w, c in rows)
    I.add(sr)
    I.glass("M470,610 A60,60 0 0 1 530,550 H770 A60,60 0 0 1 830,610 V650 A60,60 0 0 1 770,710 H530 A60,60 0 0 1 470,650 Z", sr, strength=1.1)
    I.add(lira(650, 630, 110, "#1C2230" if not I.dark else W, 20))

@icon("muhur", "Mühür", "Eğik fişin üstüne basılmış yeşil cam onay mührü.")
def _(I):
    I.bg(("#E8FAEC", "#A9E9B7"), ("#06200D", "#020A04"))
    r = (f'<g transform="rotate(-9 420 470)"><path d="{receipt(250,170,340,580,n=9,r=46)}" fill="{"#FFFFFF" if not I.dark else "#2C3A30"}"/>'
         + pills(310, 250, 220, "#BFE5C8" if not I.dark else "#4A6050", [(220, 0), (120, 50), (90, 50), (150, 40)], gap=62) + '</g>')
    I.add(r)
    seal = f'<circle cx="640" cy="650" r="200" fill="#30C25A"/>'
    I.add(f'<g opacity=".9">{seal}</g>')
    I.glass(circle(640, 650, 200), seal + r, tint="#E9FFEF", strength=.5)
    I.add('<path d="M560 652 L616 708 L724 596" fill="none" stroke="#FFFFFF" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>')

@icon("arsiv", "Arşiv", "Turuncu klasörden çıkan fiş, önde cam cep: fişleriniz düzenli.")
def _(I):
    I.bg(("#FFF1E2", "#FFC690"), ("#2A1606", "#0C0602"))
    back = (f'<path d="M212,300 A60,60 0 0 1 272,240 H420 Q450,240 470,265 L500,300 H752 A60,60 0 0 1 812,360 V760 A60,60 0 0 1 752,820 H272 A60,60 0 0 1 212,760 Z" fill="{I.lg([(0,"#FF9A2E",1),(1,"#FF6A00",1)])}"/>')
    rc = f'<path d="{receipt(362,200,300,300,n=8,r=40)}" fill="#FFFFFF"/>' + pills(412, 270, 200, "#F3D8BC", [(200, 0), (110, 46)], gap=58)
    I.add(back + rc)
    I.glass("M212,520 A60,60 0 0 1 272,460 H752 A60,60 0 0 1 812,520 V760 A60,60 0 0 1 752,820 H272 A60,60 0 0 1 212,760 Z", back + rc)

@icon("hizli-ekle", "Hızlı Ekle", "Mavi fiş ve önünde cam artı düğmesi: tek dokunuşla fiş ekle.")
def _(I):
    I.bg(("#E5F2FF", "#9ECBFF"), ("#061325", "#01050C"))
    r = f'<path d="{receipt(250,190,350,580,n=9,r=50)}" fill="{I.lg([(0,"#0A84FF",1),(1,"#5E5CE6",1)],0,0,1,1)}"/>' + \
        pills(312, 270, 226, "#FFFFFF", [(226, 0), (120, 50), (90, 50), (150, 40)], gap=62, op=.5)
    I.add(r)
    I.glass(circle(650, 660, 178), r)
    I.add('<path d="M650 580 V740 M570 660 H730" stroke="#FFFFFF" stroke-width="44" stroke-linecap="round"/>' if I.dark else
          '<path d="M650 580 V740 M570 660 H730" stroke="#0A6CFF" stroke-width="44" stroke-linecap="round"/>')

@icon("damla", "Damla", "Liquid Glass'a selam: içinde ₺ olan cam bir damla.")
def _(I):
    I.bg(("#E2F7FF", "#8EDAFF"), ("#02192A", "#00070C"))
    blobs = (f'<circle cx="420" cy="660" r="170" fill="#00B4FF"/><circle cx="640" cy="560" r="150" fill="#3D5BFF"/>'
             f'<circle cx="560" cy="780" r="110" fill="#00E0C6"/>')
    I.add(f'<g opacity=".85">{blobs}</g>')
    I.glass("M512,160 C600,300 772,420 772,610 A260,260 0 0 1 252,610 C252,420 424,300 512,160 Z", blobs)
    I.add(lira(512, 618, 250, W if I.dark else "#0A5CE0", 44))
    I.add('<path d="M340 560 A190 190 0 0 1 400 440" fill="none" stroke="#FFFFFF" stroke-width="22" stroke-linecap="round" opacity=".8"/>')

@icon("mozaik", "Mozaik", "Dört karo: üç kategori rengi ve bir cam fiş karosu.")
def _(I):
    I.bg(("#F4F5F9", "#E0E4EC"), ("#17191F", "#050608"))
    rr = lambda x, y, s=250, r=70: f"M{x},{y+r} A{r},{r} 0 0 1 {x+r},{y} H{x+s-r} A{r},{r} 0 0 1 {x+s},{y+r} V{y+s-r} A{r},{r} 0 0 1 {x+s-r},{y+s} H{x+r} A{r},{r} 0 0 1 {x},{y+s-r} Z"
    t = (f'<path d="{rr(242,242)}" fill="#FF9F0A"/><path d="{rr(532,242)}" fill="#30D158"/><path d="{rr(242,532)}" fill="#2F6BFF"/>'
         f'')
    I.add(t)
    t += '<circle cx="680" cy="680" r="110" fill="#FF375F"/><circle cx="600" cy="600" r="70" fill="#BF5AF2"/>'
    I.glass(rr(532, 532), t)
    I.add(f'<path d="{receipt(612,592,90,130,n=4,r=10)}" fill="{"#1C2230" if not I.dark else W}"/>')

@icon("yorunge", "Yörünge", "Etrafında cam bir halka dönen fiş; gezegen gibi.")
def _(I):
    I.bg(("#EEF0FF", "#C5CBFF"), ("#0A0B23", "#020208"))
    tf = "translate(512 540) rotate(-18)"
    I.add(f'<path d="M-370,0 A370,110 0 0 1 370,0" transform="{tf}" fill="none" stroke="{"#8E95E8" if not I.dark else "#4A4F9A"}" stroke-width="44"/>')
    r = f'<path d="{receipt(372,220,280,500,n=8,r=40)}" fill="{I.lg([(0,"#FF8A3D",1),(1,"#FF3D7F",1)],0,0,1,1)}"/>' + \
        pills(424, 290, 176, "#FFFFFF", [(176, 0), (100, 40), (80, 40)], gap=56, op=.55)
    I.add(r)
    I.glass("M-394,0 A394,132 0 0 0 394,0 L346,0 A346,88 0 0 1 -346,0 Z", r, tf=tf, strength=1.2)

@icon("kose-kivrimi", "Köşe Kıvrımı", "Gün batımı zemininde köşesi kıvrık cam fiş.")
def _(I):
    I.bg(("#FFB199", "#FF4F7B"), ("#2B0A16", "#0B0206"))
    sun = f'<circle cx="420" cy="620" r="250" fill="{I.lg([(0,"#FFE26A",1),(1,"#FF8A3D",1)])}"/>'
    I.add(f'<g opacity="{.95 if not I.dark else .9}">{sun}</g>')
    x, y, w, h, n = 312, 190, 400, 650, 10
    step = w / n; dz = step * .42; f = 120
    d = f"M{x},{y+48} A48,48 0 0 1 {x+48},{y} H{x+w-f} L{x+w},{y+f} V{y+h}"
    for i in range(n): d += f" L{x+w-step*i-step/2:.1f},{y+h-dz:.1f} L{x+w-step*(i+1):.1f},{y+h}"
    d += " Z"
    I.glass(d, sun)
    I.add(f'<path d="M{x+w-f},{y} L{x+w-f},{y+f-24} A24,24 0 0 0 {x+w-f+24},{y+f} L{x+w},{y+f} Z" fill="#FFFFFF" opacity=".92"/>')
    I.add(pills(372, 300, 220, "#B0204A" if not I.dark else W, [(180, 0), (120, 50), (90, 50)], gap=62, op=.55))

meta = []
for k, (slug, name, desc, fn) in enumerate(ICONS, 21):
    files = {}
    for mode in ("light", "dark"):
        I = Icon(mode); fn(I)
        f = f"{k}-{slug}{'' if mode == 'light' else '-dark'}.svg"
        open(os.path.join(OUT, f), "w").write(I.svg() + "\n")
        files[mode] = f
    meta.append({"n": k, "name": name, "desc": desc, **files})
json.dump(meta, open(os.path.join(METAOUT, "meta2.json"), "w"), ensure_ascii=False, indent=1)
print(len(meta))
