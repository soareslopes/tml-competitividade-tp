"""Pos-processamento do .pptx gerado pelo pptxgenjs (evita o dialogo de reparacao do PowerPoint).

1) remove <Override> de [Content_Types].xml cujo PartName nao existe no pacote;
2) torna unicos os ids de shape (p:cNvPr id) em cada slide/layout/master (so reatribui duplicados);
3) verifica: rels resolvidos, XML bem formado, tabelas coerentes (celulas por linha = gridCol).
Uso: python3 code/40_fix_pptx.py reports/TML_pitch_competitividade_TP.pptx
"""
import collections, posixpath, re, sys, zipfile
from lxml import etree

src = sys.argv[1]
zin = zipfile.ZipFile(src)
data = {n: zin.read(n) for n in zin.namelist()}
order = zin.namelist()
zin.close()

# 1) content types
ct = data["[Content_Types].xml"].decode("utf-8")
names = set(data)
def keep(m):
    return m.group(0) if m.group(1).lstrip("/") in names else ""
ct2 = re.sub(r'<Override PartName="([^"]+)"[^>]*/>', keep, ct)
removed = len(re.findall(r"<Override ", ct)) - len(re.findall(r"<Override ", ct2))
data["[Content_Types].xml"] = ct2.encode("utf-8")

# 2) ids unicos
fixed = 0
for n in list(data):
    if re.match(r"ppt/(slides|slideLayouts|slideMasters)/[^/]+\.xml$", n):
        x = data[n].decode("utf-8")
        ids = re.findall(r'<p:cNvPr id="(\d+)"', x)
        seen, mx = set(), max(map(int, ids)) if ids else 0
        def rep(m):
            global fixed
            i = m.group(1)
            if i in seen:
                nonlocal_mx[0] += 1
                fixed += 1
                return f'<p:cNvPr id="{nonlocal_mx[0]}"'
            seen.add(i)
            return m.group(0)
        nonlocal_mx = [mx]
        x2 = re.sub(r'<p:cNvPr id="(\d+)"', rep, x)
        data[n] = x2.encode("utf-8")

# 3) verificacoes
problems = []
for n, b in data.items():
    if n.endswith((".xml", ".rels")):
        try:
            etree.fromstring(b)
        except Exception as e:
            problems.append(f"XML invalido {n}: {e}")
for n, b in data.items():
    if n.endswith(".rels"):
        base = posixpath.dirname(posixpath.dirname(n))
        for m in re.finditer(rb'<Relationship [^>]*>', b):
            t = re.search(rb'Target="([^"]+)"', m.group(0)).group(1).decode()
            if b'TargetMode="External"' in m.group(0):
                continue
            p = posixpath.normpath(posixpath.join(base, t)) if not t.startswith("/") else t.lstrip("/")
            if p not in names:
                problems.append(f"rel quebrada {n} -> {t}")
ns = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
for n, b in data.items():
    if re.match(r"ppt/slides/slide\d+\.xml$", n):
        r = etree.fromstring(b)
        for tbl in r.iterfind(".//a:tbl", ns):
            ncol = len(tbl.findall("a:tblGrid/a:gridCol", ns))
            for tr in tbl.findall("a:tr", ns):
                if len(tr.findall("a:tc", ns)) != ncol:
                    problems.append(f"tabela incoerente em {n}")
        ids = re.findall(rb'<p:cNvPr id="(\d+)"', b)
        if len(ids) != len(set(ids)):
            problems.append(f"ids duplicados {n}")
with zipfile.ZipFile(src, "w", zipfile.ZIP_DEFLATED) as zout:
    for n in order:
        zout.writestr(n, data[n])
print(f"overrides removidos: {removed}; ids reatribuidos: {fixed}; problemas: {len(problems)}")
for p in problems:
    print(" -", p)
