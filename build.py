"""Build a self-contained, editable HTML workbench and its starter project.

Run `python tools/presentation-studio/build.py` from any directory.
The generated HTML needs no server, installation, or network connection.
"""
import base64
import copy
import json
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parent.parent
PAPER = WORKSPACE / 'literature/精读笔记/编译与程序优化/07_Guess-Sketch_精读笔记'
style = dict(fill='transparent', color='#27313d', border='#cbd2d9', borderWidth=0,
             radius=8, opacity=1, fontSize=24, fontFamily='Microsoft YaHei',
             fontWeight=400, lineHeight=1.5, align='left', padding=0, shadow=0)


def starter():
    source = (PAPER / 'Guess-Sketch_交互汇报.html').read_text(encoding='utf-8')
    old = json.loads(re.search(r'<script id="presentation-data" type="application/json">(.*?)</script>', source, re.S)[1])
    names = ['主题', '提出问题', '手写转译器', '神经模型', '符号合成', '现有不足', '引出本文', '三个创新点', '框架原图', 'GUESS 原理', 'SKETCH 原理', '实验设置', '实验结果', '总结']
    p = dict(schemaVersion=1, id='guess-sketch-starter', title='Guess & Sketch · 文献汇报',
             canvas=dict(width=1440, height=6700, background='#f7f6f1', grid=True, snap=True),
             nodes=[], edges=[], groups=[], assets={},
             steps=[dict(id=f'step-{i}', name=name, duration=7000, note='', camera=None) for i, name in enumerate(names)])
    count = 0

    def add(kind, name, x, y, w, h, step, **props):
        nonlocal count
        count += 1
        n = dict(id=f'n-{count}', type=kind, name=name, x=x, y=y, w=w, h=h, rotation=0,
                 locked=False, hidden=False, parentId=None, stepId=f'step-{step}',
                 animation=dict(type='rise', duration=650, delay=0), style=copy.deepcopy(style),
                 action=dict(type='none', value=''))
        n.update(props)
        p['nodes'].append(n)
        return n

    def text(name, content, x, y, w, h, step, size=24, color='#27313d', weight=400, align='left'):
        n = add('text', name, x, y, w, h, step, text=content)
        n['style'].update(fontSize=size, color=color, fontWeight=weight, align=align)
        return n

    def box(name, x, y, w, h, step, fill='#fffefb', border='#d9dcd7'):
        n = add('shape', name, x, y, w, h, step, shape='rect')
        n['style'].update(fill=fill, border=border, borderWidth=1.5, radius=18)
        return n

    def icon(name, key, x, y, size, step, color='#7b61a7'):
        n = add('icon', name, x, y, size, size, step, icon=key, strokeWidth=2)
        n['style']['color'] = color
        return n

    def group(name, nodes):
        p['groups'].append(dict(id=f'group-{len(p["groups"])}', name=name, nodeIds=[n['id'] for n in nodes]))

    def connect(a, b, step, color='#9a86b9'):
        p['edges'].append(dict(id=f'edge-{len(p["edges"])}', **{'from':a['id']}, to=b['id'],
                               fromAnchor='bottom', toAnchor='top', route='elbow', color=color,
                               width=2.5, arrow=True, dash=False, label='', labelSize=18,
                               stepId=f'step-{step}', animation=dict(type='draw', duration=1000, delay=0)))

    for key, item in old['figures'].items():
        path = PAPER / item['src']
        raw = path.read_bytes()
        width, height = struct.unpack('>II', raw[16:24])
        p['assets'][key] = dict(name=item['title'], data='data:image/png;base64,' + base64.b64encode(raw).decode(), width=width, height=height)

    def picture(key, x, y, w, step):
        asset = p['assets'][key]
        h = round(w * asset['height'] / asset['width'])
        n = add('image', asset['name'], x, y, w, h, step, assetId=key, fit='contain', positionX=50, positionY=50)
        n['style'].update(fill='#ffffff', radius=10)
        n['action'] = dict(type='image', value='')
        return n

    def note(name, content, x, y, w, step, action_type='note'):
        n = add('button', name, x, y, w, 48, step, text=name)
        n['style'].update(fill='#eee8f7', color='#71569f', fontSize=20, align='center', padding=8)
        n['action'] = dict(type=action_type, value=content)
        return n

    text('页眉小字', 'LITERATURE REVIEW / 文献调研', 220, 35, 1000, 35, 0, 18, '#84909c', align='center')
    title = text('主题', old['map']['title'], 140, 95, 1160, 95, 0, 64, weight=700, align='center')
    text('主题副标题', old['map']['subtitle'], 220, 200, 1000, 50, 0, 28, '#77828e', align='center')
    qbox = box('问题卡片背景', 100, 310, 1240, 190, 1)
    qicon = icon('醒目问号', 'question', 145, 348, 110, 1, '#d1a538')
    qtitle = text('问题', old['map']['question'], 300, 342, 980, 65, 1, 39, weight=650)
    qsub = text('问题说明小字', old['map']['questionNote'], 300, 420, 950, 52, 1, 22, '#78838d')
    group('问题', [qbox,qicon,qtitle,qsub])
    connect(title,qbox,1,'#bcc2c8')
    cards = []
    for i, key in enumerate(['manual','neural','solver']):
        x = 60+i*450
        b = box(old['text'][f'routes.{key}Title']+'背景', x, 615, 420, 355, i+2)
        ico = icon('方向图标', ['file','network','branch'][i], x+28, 645, 55, i+2)
        heading = text('方向标题', old['text'][f'routes.{key}Title'], x+28, 720, 365, 50, i+2, 32, weight=600)
        body = text('方法说明', old['text'][f'routes.{key}Body'], x+28, 780, 365, 95, i+2, 24, '#78838d')
        limitation = box('不足背景',x,890,420,140,5,'#faf0e9','#e5d6cc')
        small = text('不足标签小字','仍然存在的困难',x+28,910,365,30,5,18,'#a47662')
        cost = text('不足内容',old['text'][f'routes.{key}Cost'],x+28,950,365,72,5,23,'#805a4d')
        for item in [limitation,small,cost]:item['animation']['delay']=i*180
        group(old['text'][f'routes.{key}Title'],[b,ico,heading,body,limitation,small,cost])
        cards.append(limitation)
        connect(qbox,b,i+2,'#bcc2c8')
    text('引入问题',old['map']['bridgeQuestion'],140,1160,1160,70,6,28,align='center')
    paper = box('论文标题背景',320,1260,800,155,6,'#f1d36c','#384354')
    paper_title = text('论文名','GUESS & SKETCH',350,1284,740,70,6,54,weight=700,align='center')
    paper_sub = text('论文英文副标题','Language Model Guided Transpilation · ICLR 2024',350,1360,740,35,6,19,align='center')
    group('论文标题',[paper,paper_title,paper_sub])
    for card in cards:connect(card,paper,6)
    text('创新点总述',old['map']['innovationTitle'],80,1485,1280,75,7,36,weight=600,align='center')
    for i, item in enumerate(old['map']['ideas']):
        x=65+i*450
        ico=icon('灵感灯泡','bulb',x+150,1590,80,7,'#c19b2f')
        ico['animation'].update(type='pulse',delay=i*250,duration=900)
        heading=text('创新点标题',item['title'],x,1690,410,48,7,27,weight=600)
        body=text('创新点说明',item['body'],x,1750,410,155,7,23,'#78838d')
        heading['animation']['delay']=i*250;body['animation']['delay']=i*250
        group(f'创新点 {i+1}',[ico,heading,body])
    overview=picture('framework',80,1980,1280,8)
    text('图1图注小字',old['figures']['framework']['title']+' · 点击图片放大',80,1980+overview['h']+15,1280,40,8,18,'#89929b')
    guess_y=1980+overview['h']+130
    g=box('GUESS 阶段背景',60,guess_y,1320,640,9)
    gh=text('GUESS 标题',old['map']['guessTitle'],100,guess_y+35,1040,70,9,34,weight=600)
    guess_notes=next(s['notes'] for s in old['scenes'] if s['id']=='guess')
    gn=note('讲解备注','\n\n'.join(guess_notes),1180,guess_y+40,155,9)
    guess_nodes=[g,gh,gn]
    for i,key in enumerate(['guessProbability','guessReference']):
        x=100+i*640
        guess_nodes.append(text('线索标题',old['map'][key],x,guess_y+140,580,45,9,27,weight=600))
        guess_nodes.append(text('线索说明',old['map'][key+'Body'],x,guess_y+200,580,125,9,23,'#77828d'))
    guess_nodes.append(text('低概率公式',old['text']['guess.probability'],100,guess_y+330,600,65,9,32,'#7655a2'))
    guess_nodes.append(text('注意力对齐说明',old['map']['guessAlignmentBody'],100,guess_y+450,740,135,9,24,'#77828d'))
    guess_nodes.append(picture('alignment',960,guess_y+370,340,9))
    group('GUESS 阶段',guess_nodes)
    sketch_y=guess_y+770
    sketch_nodes=[box('SKETCH 阶段背景',60,sketch_y,1320,1000,10),text('SKETCH 标题',old['map']['sketchTitle'],100,sketch_y+35,1120,75,10,34,weight=600)]
    for i,item in enumerate(old['map']['sketchSteps']):
        x=100+i*320
        sketch_nodes.append(text('求解步骤标题',item['title'],x,sketch_y+140,285,48,10,26,weight=600))
        sketch_nodes.append(text('求解步骤说明',item['body'],x,sketch_y+205,285,190,10,22,'#77828d'))
    sketch_nodes.append(text('语义约束公式',old['text']['sketch.constraint'],100,sketch_y+415,1200,70,10,31,'#7655a2'))
    sketch_nodes.append(picture('algorithm',145,sketch_y+520,1150,10))
    sketch_nodes.append(text('算法图注小字',old['figures']['algorithm']['title'],145,sketch_y+930,880,32,10,18,'#89929b'))
    sketch_nodes.append(note('图 4 · 真实修复案例','example',100,sketch_y+990,280,10,'image'))
    sketch_nodes.append(note('图 5 · 求解模板','template',400,sketch_y+990,260,10,'image'))
    group('SKETCH 阶段',sketch_nodes)
    setup_y=sketch_y+1180
    text('实验设置标题',old['map']['setupTitle'],100,setup_y,1240,80,11,40,weight=600)
    table=add('table','实验设置表格',100,setup_y+110,1240,660,11,cells=[['设置','论文中的安排']]+old['map']['setupRows'],headerFill='#e9e7f0')
    table['style'].update(fill='#fffefb',borderWidth=1,fontSize=23,padding=12)
    text('实验设置来源小字','来源 · 论文 §5 Experimental Setup',100,setup_y+790,1240,35,11,18,'#89929b')
    results_y=setup_y+940
    text('实验结果标题',old['map']['resultsTitle'],100,results_y,1240,80,12,40,weight=600)
    result_image=picture('results',100,results_y+115,1240,12)
    cursor=results_y+115+result_image['h']+35
    text('原表图注小字',old['figures']['results']['title'],100,cursor,1240,40,12,18,'#89929b')
    for i,row in enumerate(old['results']):
        x=100+i*430
        text('结果方向小字',row['direction'],x,cursor+80,400,35,12,19,'#89929b')
        text('结果数据集',row['dataset'],x,cursor+125,400,50,12,28,weight=600)
        text('结果数字',f"{row['before']}% → {row['afterLabel']}%",x,cursor+185,400,60,12,34,'#7655a2')
        text('结果说明',row['gain'],x,cursor+255,400,40,12,22,'#89929b')
    note('表 2 · 错误分析','errors',100,cursor+340,250,12,'image')
    summary_y=cursor+520
    sb=box('总结背景',80,summary_y,1280,330,13,'#27313d','#27313d')
    st=text('总结标题',old['map']['summaryTitle'],130,summary_y+40,1180,110,13,38,'#f4d976',600,'center')
    sp=text('总结正文',old['map']['summaryBody'],150,summary_y+180,1140,120,13,26,'#c6d0d9',align='center')
    group('总结',[sb,st,sp])
    p['canvas']['height']=round(summary_y+450)
    p['steps'][9]['note']='\n\n'.join(guess_notes)
    p['steps'][10]['note']='\n\n'.join(next(s['notes'] for s in old['scenes'] if s['id']=='sketch'))
    p['steps'][12]['note']='\n\n'.join(next(s['notes'] for s in old['scenes'] if s['id']=='results'))
    return p


def render_html(project):
    serialized=json.dumps(project,ensure_ascii=False,indent=2)
    html=(ROOT/'index.template.html').read_text(encoding='utf-8')
    for marker,content in {
        '__STYLE__':(ROOT/'studio.css').read_text(encoding='utf-8')+'\n'+(ROOT/'editor-shell.css').read_text(encoding='utf-8'),
        '__PREVIEW__':(ROOT/'preview-renderer.js').read_text(encoding='utf-8'),
        '__UI__':(ROOT/'editor-ui.js').read_text(encoding='utf-8'),
        '__CORE__':(ROOT/'core.js').read_text(encoding='utf-8'),
        '__STEPNAV__':(ROOT/'step-navigation.js').read_text(encoding='utf-8'),
        '__TOOLS__':(ROOT/'editor-tools.js').read_text(encoding='utf-8'),
        '__LAYERS__':(ROOT/'layer-tools.js').read_text(encoding='utf-8'),
        '__MOTION__':(ROOT/'motion-editor.js').read_text(encoding='utf-8'),
        '__COMPONENTS__':(ROOT/'component-library.js').read_text(encoding='utf-8'),
        '__TEMPLATE_EDITOR__':(ROOT/'template-editor.js').read_text(encoding='utf-8'),
        '__WELCOME__':(ROOT/'welcome.js').read_text(encoding='utf-8'),
        '__EFFECTS__':(ROOT/'effects.js').read_text(encoding='utf-8'),
        '__PROJECTS__':(ROOT/'project-manager.js').read_text(encoding='utf-8'),
        '__SIDEBAR__':(ROOT/'sidebar-layout.js').read_text(encoding='utf-8'),
        '__APP__':(ROOT/'app.js').read_text(encoding='utf-8'),
        '__PROJECT__':serialized.replace('<','\\u003c'),
        '__AGENT_GUIDE__':json.dumps((ROOT/'agent/AGENT_GUIDE.md').read_text(encoding='utf-8'),ensure_ascii=False).replace('<','\\u003c'),
        '__AGENT_EXAMPLE__':(ROOT/'agent/example.studio.json').read_text(encoding='utf-8').replace('<','\\u003c'),
    }.items():
        html=html.replace(marker,content)
    return html


def main():
    project=json.loads((ROOT/'projects/Guess-Sketch.studio.json').read_text(encoding='utf-8'))
    (ROOT/'projects').mkdir(exist_ok=True)
    (ROOT/'projects/Guess-Sketch.studio.json').write_text(json.dumps(project,ensure_ascii=False,indent=2),encoding='utf-8')
    html=render_html(project)
    output=ROOT/'汇报工作台.html'
    output.write_text(html,encoding='utf-8')
    print(f'Built {len(project["nodes"])} editable objects, {len(project["edges"])} connectors, {len(project["steps"])} presentation steps')
    print(f'HTML size: {output.stat().st_size / 1024 / 1024:.2f} MiB')


if __name__=='__main__':
    main()
