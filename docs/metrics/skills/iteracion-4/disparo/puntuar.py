import json,os,re,sys
D=os.path.dirname(os.path.abspath(__file__))+'/'  # carpeta de este script
clave=json.load(open(D+'clave.json')); por_msg={v['mensaje']:(k,v) for k,v in clave.items()}
def cargar(tag):
    orden=[l.split('. ',1)[1].strip() for l in open(D+f'mensajes-{tag}.md') if re.match(r'\d+\. ',l)]
    res={}
    for l in open(D+f'resultado-{tag}.md'):
        m=re.match(r'\|\s*(\d+)\s*\|\s*([\w-]+)\s*\|',l)
        if m: res[int(m.group(1))]=m.group(2)
    return {por_msg[orden[n-1]][0]:s for n,s in res.items()}
tags=sys.argv[1:]
runs={t:cargar(t) for t in tags}
ok=0;tot=0;fallos=[]
for k,v in clave.items():
    elegidas=[runs[t].get(k) for t in tags]
    for t,e in zip(tags,elegidas):
        tot+=1
        if e==v['esperada']: ok+=1
        else: fallos.append((k,v['tipo'],v['esperada'],e,t,v['mensaje']))
print(f'aciertos {ok}/{tot}')
for tipo in ('claro','frontera','negativo'):
    o=n=0
    for k,v in clave.items():
        if v['tipo']!=tipo: continue
        for t in tags:
            n+=1; o+= runs[t].get(k)==v['esperada']
    print(f'  {tipo}: {o}/{n}')
for f in fallos: print('FALLO',f)
