"""Build an offline Windows x64 application from the official Electron runtime.
No global Node/npm installation is needed. The lock records the pinned checksum.
"""
from pathlib import Path
import base64, hashlib, html, importlib.util, json, re, shutil, sys, urllib.request, zipfile

ROOT=Path(__file__).resolve().parent
STUDIO=ROOT.parent
VERSION='45.3.2'
RUNTIME_HASH='cd1ab0d49c2f76838c0c9ff75afefb4d9d85ca59036691932bf35be8eceba98b'
NAME=f'electron-v{VERSION}-win32-x64.zip'
VENDOR=ROOT/'vendor'
OUTPUT=STUDIO/'release/汇报工作台-Windows-x64'

def icon(destination):
    from PIL import Image,ImageDraw
    im=Image.new('RGBA',(256,256),(0,0,0,0));d=ImageDraw.Draw(im)
    d.rounded_rectangle((8,8,248,248),radius=52,fill='#7658a4')
    d.line([(128,61),(128,128),(62,128),(62,190)],fill='white',width=12)
    d.line([(128,128),(194,128),(194,190)],fill='white',width=12)
    for x,y in [(128,61),(62,190),(194,190)]:d.rounded_rectangle((x-24,y-20,x+24,y+20),radius=9,fill='white')
    im.save(destination,format='ICO',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])

def main():
    spec=importlib.util.spec_from_file_location('studio_build',STUDIO/'build.py')
    builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
    resources_only='--resources-only' in sys.argv
    VENDOR.mkdir(exist_ok=True)
    archive=VENDOR/NAME
    if not resources_only:
        if not archive.exists():urllib.request.urlretrieve(f'https://github.com/electron/electron/releases/download/v{VERSION}/{NAME}',archive)
        if hashlib.sha256(archive.read_bytes()).hexdigest()!=RUNTIME_HASH:raise RuntimeError('Electron runtime checksum mismatch')
    OUTPUT.mkdir(parents=True,exist_ok=True)
    if not resources_only and not (OUTPUT/'汇报工作台.exe').exists():
        with zipfile.ZipFile(archive) as z:z.extractall(OUTPUT)
        (OUTPUT/'electron.exe').rename(OUTPUT/'汇报工作台.exe')
    app=OUTPUT/'resources/app';app.mkdir(parents=True,exist_ok=True)
    for name in ['package.json','main.cjs','preload.cjs','store.cjs']:shutil.copy2(ROOT/name,app/name)
    shutil.copy2(STUDIO/'core.js',app/'core.js')
    guide=OUTPUT/'Agent教程';guide.mkdir(exist_ok=True)
    for name in ['AGENT_GUIDE.md','examples.cjs','example.studio.json']:shutil.copy2(STUDIO/'agent'/name,guide/name)
    shutil.copy2(STUDIO/'core.js',guide/'core.js')
    source=builder.render_html(json.loads((STUDIO/'projects/Guess-Sketch.studio.json').read_text(encoding='utf-8')))
    hashes=[]
    for script in re.finditer(r'<script id="studio-(?:core|preview|ui|stepnav|tools|projects|sidebar|layers|components|template|motion|welcome|effects|app)">([\s\S]*?)</script>',source):
        hashes.append("'sha256-"+base64.b64encode(hashlib.sha256(script[1].encode()).digest()).decode()+"'")
    policy="default-src 'none'; script-src "+' '.join(hashes)+"; style-src 'unsafe-inline'; img-src data: blob:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'"
    source=source.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+html.escape(policy,quote=True)+'">',1)
    (app/'汇报工作台.html').write_text(source,encoding='utf-8')
    icon(app/'studio.ico')
    version=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
    (OUTPUT/'使用说明.txt').write_text(f'汇报工作台 Windows 桌面版 {version}\n\n双击 汇报工作台.exe 启动，无需安装。请保留整个文件夹。\n本机项目位于 D:/PresentationStudio/data/projects；其他电脑默认使用 %APPDATA%/PresentationStudio/projects。更新程序不清除项目。\n图层按步骤展开；眼睛仅隐藏编辑画布，Ctrl+H 隐藏所选，Ctrl+Shift+H 恢复全部。“模拟本步画面”预览出现与退场。\n临时隐藏会在本机保存，不影响正式演示和导出。\n导入支持项目 JSON 和工作台导出的 HTML；导出支持离线演示与继续编辑。\n模型教程在 Agent教程/AGENT_GUIDE.md；开发规范在 D:/codex_workspace/presentation-studio/AGENTS.md。\n',encoding='utf-8-sig')
    (OUTPUT/'runtime-lock.json').write_text(json.dumps({'electron':VERSION,'sha256':RUNTIME_HASH,'source':f'https://github.com/electron/electron/releases/tag/v{VERSION}'},indent=2),encoding='utf-8')
    if '--zip' in sys.argv and resources_only:raise RuntimeError('--resources-only cannot create a standalone runtime ZIP')
    if '--zip' in sys.argv:
        destination=STUDIO/'release/汇报工作台-Windows-x64.zip'
        with zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
            for file in OUTPUT.rglob('*'):
                if file.is_file():z.write(file,file.relative_to(OUTPUT.parent))
        print(destination)
    print(app/'汇报工作台.html' if resources_only else OUTPUT/'汇报工作台.exe')

if __name__=='__main__':main()
