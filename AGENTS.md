# 汇报工作台开发指南

遵循 D:/codex_workspace/AGENTS.md。

## 每次任务的必做事项（初始化时保留）

- 开始前显式读取工作空间规则、本文件、目标目录内的更具体规则、README 和 `docs/PROJECT_LOG.md`；确认仓库根目录及 Git 状态。父级规则无法访问时说明情况，并执行本文件的基本规范。
- 所有项目源码、文档和交付成果保存在本项目内；保护已有改动，不修改无关项目。
- 开发任务缺少规则或日志时先补齐；纯咨询和只读评审不触发初始化、日志写入或提交。
- 遇到问题、重要选择或结果变化时，立即更新 `docs/PROJECT_LOG.md`，再继续下一项实质工作。每个事项从用户的“出发问题/目标”开始，写明验收标准与当前结论。
- 同一事项按实际顺序逐行记录：`日期｜问题/现象 → 具体处理 → 实际结果（证据/命令编号）`；下一次尝试承接前次结果，必要时补分析/下一步。事实、假设与结论修正明确区分，不把 HTTP/命令成功当成业务成功；独立维护问题另列。
- `docs/COMMAND_LOG.md` 按“命令/操作 → 目的 → 结果 → 分析”记录重点调用及失败重试，与项目事项相互链接；统一注明环境、目录、权限，保留真实参数与退出码。区分本轮执行、历史整理与未执行建议；编辑工具记录实际修改，不编造命令，敏感值脱敏。重写历史前逐字节归档并校验 SHA-256，交付时提供两份日志路径。
- 修改前明确验收标准；完成后运行与风险相称的检查，记录实际结果；无法执行或失败时说明原因。
- 可独立理解的变更验证通过后主动本地提交，除非用户要求不提交。检查差异和暂存区，仅暂存本次工作的明确路径，并同步提交相关日志与文档；不夹带用户改动。
- Git 身份缺失、权限受限或他人暂存内容无法安全隔离时保留改动并报告；不编造身份、不改全局配置。未经明确要求不推送、不改写历史、不强制推送、不合并分支。
- 密钥、令牌、个人信息和生产数据不得写入源码、日志或提交；使用环境变量及不含真实秘密的示例配置。
- 交付前更新日志当前状态，检查 Git 状态，说明成果路径、验证结果、遗留事项和提交哈希；未提交时说明原因。


## 项目定位与唯一维护入口

- 当前源码版本：1.11.0（2026-11-16；安装版本以 docs/deployment-result.json 为准）。面向组件化汇报、流程图、长画布和交互式逐步演示；不是任意网页的可视化编辑器，也不是完整 PowerPoint 替代品。
- 正式开发目录与独立 Git 根目录：`D:/codex_workspace/presentation-studio`。旧源码 `D:/GraduateDesign/tools/presentation-studio` 是历史保留，不再写回或从那里打包更新。
- 安装目录：`D:/PresentationStudio`；桌面快捷方式指向其中的 `汇报工作台.exe`。
- 数据实体：`D:/PresentationStudio/data/projects`。`%APPDATA%/PresentationStudio` 是指向 D 盘 data 的兼容目录链接，不能当作另一份数据删除、再次搬迁或重复备份。
- 技术栈：原生 JavaScript/CSS、Electron 45.3.2、Python 打包。未配置格式化器，沿用现有风格；没有新增生产依赖。

## 模块与文档职责

- `core.js`：纯数据模型、校验、复制/粘贴、引用修复、步骤、连线、布局与动效时间计算；公共接口应有回归测试。
- `app.js`：编辑状态、画布渲染、指针交互、撤销、保存、演示和导入导出。不要把新工具全部继续堆入此文件。
- `project-manager.js`：项目管理、回收站清空确认、导入入口与返回导航；主页面关闭/Esc退出，子页面按钮/Esc返回项目管理。清空仅处理确认时的ID，存储层重新检查deletedAt，禁止正常项目被清空。
- `welcome.js`：桌面欢迎页、最近项目与首页切换，不承担项目保存实现。UI翻新评审见 docs/UI_REVIEW.md；整体编辑器改版仍为建议。
- `component-library.js`：个人模板捕获、插入及管理，限高快捷列表、矩阵选择和独立画布预览；预览传入模板项目，不借用当前项目assets或改变编辑状态。持久化与项目数据隔离。
- `template-editor.js`：组件模板隔离草稿、小画布编辑、局部撤销与保存；不得借用主项目或全局undo，返回/Esc取消草稿。图片使用草稿assets，已有连线保留；不开放步骤/动效编排。
- `sidebar-layout.js`：左右边栏宽度、本机偏好、键盘拖动和属性折叠排序；不写项目或撤销数据。左190–360px、右260–420px，窄窗口自动收敛，<=760px属性覆盖显示；导出清除本机布局后重新安装手柄。
- `editor-tools.js`：搜索、图层筛选折叠、视野历史、格式操作、系统剪贴板、右键粘贴、吸附提示和动效编排入口。
- `step-navigation.js`：编号解析、标签和可复用跳转入口；编号只用于当前排序，引用必须保留步骤ID。
- `motion-editor.js`：静态画布与动作选中联动、动作参数编辑、预览返回上下文；复用 app 渲染器，不写步骤镜头。
- `layer-tools.js`：按出现步骤组织图层、编辑可见性、步骤画面模拟与恢复操作；导出的纯函数用于可见性回归。
- `editor-ui.js`：编辑器主题与强调色本机偏好（studio-editor-accent-v1，导出时移除body内联样式）、导轨与工具图标、属性栏对象标题区及“设计/演示”分页、步骤真实预览与画布下方步骤轨（data-track-step，单击selectStep、双击focusStep、悬停预览），不写项目。`preview-renderer.js`：共享隔离作品渲染，必须显式传入project与assets；模板编辑仍复用其节点标记。`editor-shell.css`：仅作用于editor-chrome及明确外壳/选择控件，不允许主题改变作品样式。
- `studio.css`、`index.template.html`、`build.py`：界面与离线页面生成。`build.py` 的正常入口读取仓库内示例；历史 `starter()` 仍依赖旧文献，不用于常规构建。
- `desktop/`：窗口、预加载接口、磁盘存储、构建、部署与隔离桌面验收；不得让渲染页面直接获得 Node 权限。
- `projects/`：只保留构建所需 `Guess-Sketch.studio.json`，不混入个人修订稿、真实自动保存记录和历史备份。
- 本文件管理开发约束；`README.md` 面向使用与维护；`agent/AGENT_GUIDE.md` 面向模型编辑项目数据。三者职责不同，不新建竞争性的 agent.md。
- `docs/manual/用户使用教程.md` 面向最终用户，是完整教程正文；`python docs/manual/build_manual.py` 生成带内嵌配图和练习项目的离线 HTML。截图和合成练习由 `node docs/manual/capture.cjs` 生成，阅读器验收用 `node docs/manual/verify.cjs`，沿用项目内测试目录。修改用户操作时同步教程；它不替代 Agent 教程。
- `agent/AGENT_GUIDE.md` 是教程唯一源文件，发布后同步至安装目录 `Agent教程/AGENT_GUIDE.md` 和 HTML 的 `#agent-guide` 数据段；不能只改外部副本。
- `docs/PROJECT_LOG.md`、`docs/COMMAND_LOG.md` 保留事项和重点调用；`docs/qa`、`docs/test-runtime`、部署备份不提交。历史日志中的 PID、时间和命令不作为今后的执行参数。

## 必须保持的交互约定

- 图层单击仅选择，双击才聚焦；原位更新选择标记，避免重建条目吞掉双击。“上一视野”用于恢复搜索/聚焦前位置。
- 画布和图层的 Ctrl / Shift 单击均支持追加选择；画布空白拖动为平移，Shift 拖动为框选。组合仍是单击整组、双击内部对象、选中文字后再单击或 F2 编辑。
- 网格/对象吸附、拖入连线和导图快捷键默认开启，不展示开关。Alt临时跳过吸附和插线；Tab/Enter仅在画布焦点且单选时创建子/兄弟节点，Alt+Enter回到文字编辑，输入框与面板Tab仍导航。旧canvas.snap字段保留兼容，当前交互不以它关闭默认吸附。
- Ctrl+S 保存本机项目，Ctrl+Shift+S 导出 JSON；F5/Shift+F5 从头/当前步骤演示。输入框焦点下保存与演示仍可使用；对话框与输入法组合输入不能被全局快捷键干扰。
- Ctrl+K / Ctrl+F 搜索对象、文字、表格、步骤和命令；Ctrl+Shift+C / V 复制/粘贴整组件格式，文本输入中的原生剪贴板操作不能被拦截。
- 拖动至少达到 4 个屏幕像素；参考线按屏幕距离容差吸附，Alt 临时关闭网格和对象吸附。锁定目前明确指位置/尺寸，不可宣称完整防删除保护。

- 桌面启动/重新激活默认原生窗口最大化，保留标题栏及三个系统按钮；不得自动调用独占全屏。浏览器也不自动请求全屏；F11和演示中的全屏为用户主动操作。
- 桌面启动进入欢迎页，不自动加载seed或上一项目；hasProject=false时禁止保存幽灵项目。新建/导入/点击最近项目后才loadProject。已导出HTML保持直达内嵌项目。首页不加教程向导或占位入口。
- 不开放画布边界和组件坐标/宽高手填，不显示原始 JSON 编辑器；保留数据格式、导入导出、自动扩展和组件拖动缩放。
- Ctrl+J按当前编号选择/跳转步骤；搜索纯数字优先准确步骤，#N/第N步仅查步骤；图层数字筛选只保留该步，包括空步骤。动效、目标步骤和播放标题显示编号。不得截获正在组合输入的按键或覆盖已打开对话框。
- 步骤单击选择、双击聚焦；单击不得重建步骤 DOM。镜头取景方式、临时查看、播放入口分组。
- 编排预览退出恢复步骤、选中动作、列表滚动和编辑隐藏；普通演示保持 1.3 的当前镜头返回。Esc 必须取消默认动作，防止新恢复的 dialog 被立即关闭。切换项目清空编排返回上下文。

## 数据和动效约定

- 图层眼睛只控制编辑可见性，保存在本机记录 `view.editor` 的 hidden/shown/previewStep，禁止写入项目对象的 hidden 或导出 seed-project。旧 hidden 保留“正式演示中始终隐藏”，旧数据不能擅自转换。
- 图层按对象出现步骤分组；跨步组合只分片展示，不拆分项目中的组合。整步眼睛批量作用于该步当前对象及连线；混合可见状态需有标记。
- 隐藏对象不参与画布框选、画布全选、拖动吸附或拖拽手柄；图层仍能选择隐藏对象并显示/修改。隐藏连接端点同时隐藏关联线，主动显示关联线同时显示端点。
- 模拟步骤尊重 stepId/endStepId，且支持手动可见性覆盖；恢复全部清除模拟及覆盖。演示忽略本机编辑隐藏，退出后恢复编辑状态；导入副本从全部可见开始。
- 撤销项同时记录 project 与 editor 可见性；删除对象/步骤后的撤销应恢复先前的隐藏状态，不能先用新项目过滤旧历史。仅折叠/展开不产生内容撤销。

- 继续支持 `schemaVersion: 1` 的已有项目和导出 HTML；导入只提取 `seed-project`，不执行导入脚本。
- 复制/剪切后点击画布记录粘贴中心；粘贴保持选区相对布局，拖动/平移不更新落点，新复制或切项目重置落点；文字输入仍使用系统剪贴板。
- 自由线可选fromAttachment/toAttachment引用节点，from/to仍为null；edgePoints解析关联端点，edgeNodeIds用于可见性和删除；复制映射关联，单独复制或主动拖动自由线解除相应关联。
- 画布右键仅粘贴且以右键位置为中心，格式/尺寸/视野/重叠选择在右栏；Ctrl+J列表编号配完整名称，选择不移动视野。默认浅色外壳，支持本机深色偏好；两种主题共用ui颜色角色。1.11起整套外壳只用一个强调色（默认墨蓝#1f4e79，可本机自选，浅/深色由同一基准色推导，强调色上的文字按对比度自动取白或近黑），其余为冷调中性灰；左侧图标导轨独立成列（不计入左栏宽度），步骤轨位于画布下方，属性栏对象标题区明显区别于浅灰分组标题。避免说明性小字，用法放title。不得改写项目配色或用主题CSS隐藏用户网格；画布阴影仅在编辑状态显示。
- 品牌卡片图标及文字统一返回主页；不再有独立首页按钮。画布设置不显示取消选择叉与项目数据分组。
- 复制使用 `copyFragment` / `pasteFragment` 或 `duplicate`：内部组合交互映射到副本；跨项目清除不可用外部目标；素材 ID 冲突不能覆盖目标项目素材。
- 删除步骤将对象及步骤跳转重定向到替代步骤；删除/解组清理失效组合引用。不要绕开这些纯数据操作而留下悬空引用。
- 动画仍是单一进入效果和可选退场步骤；`animation.start` 为 step / with / after，默认 step 保持旧延迟行为；界面用秒，数据用毫秒。
- `steps[].animationOrder` 为不重复 ID 数组；`animationPlan` 计算开始/结束时间。无效果且有等待的对象也应在约定时间出现；自动播放不能截断本步最长动画。
- 已支持新增 slide-left、slide-right、drop、zoom-out；不得把该顺序面板描述为多轨时间轴、关键帧或运动路径编辑器。
- 未实现：同一对象多段效果、完整运动路径、多轨时间轴、局部富文本；大项目性能尚未专项验收。

## 验证、发布与回退

在本项目根目录执行，按变更风险选择检查；文档同步不必重跑整套 UI：

```powershell
python build.py
python desktop/build_desktop.py --resources-only
node --check core.js
node --check app.js
node --check editor-tools.js
node --check sidebar-layout.js
node --check project-manager.js
node --check layer-tools.js
node --check motion-editor.js
node --check step-navigation.js
node --check welcome.js
node --check template-editor.js
node --test core.test.cjs layout.test.cjs junction.test.cjs steps.test.cjs free-lines.test.cjs curve-visibility.test.cjs workflow.test.cjs layers.test.cjs desktop/store.test.cjs
node agent/examples.cjs self-test
```

- UI 回归：`node desktop/editor-shell-ui.test.cjs`（六状态×1280×800/1440×900与主题隔离）、`node desktop/refinement-ui.test.cjs`、`node desktop/components-ui.test.cjs`、`node desktop/experience-ui.test.cjs`、`node desktop/sidebar-ui.test.cjs`、`node desktop/workflow-ui.test.cjs` 及 `node desktop/layers-ui.test.cjs`、`node desktop/workspace-ui.test.cjs`、`node desktop/step-navigation-ui.test.cjs`、`node desktop/welcome-ui.test.cjs`、`node desktop/redesign-ui.test.cjs`（步骤轨、属性分页、图层按需操作、强调色本机保存与导出隔离、组件悬停预览、主页封面）；实际安装桌面验收：`node desktop/desktop-smoke.test.cjs`。使用环境提供的 Playwright（已验证 1.62.1），先发现当前包位置再设置 NODE_PATH，不硬编码旧运行时版本路径。UI 默认 Edge，可通过 STUDIO_BROWSER 指定 Chromium 程序。
- 隐藏Electron窗口时，状态等待使用定时轮询（如polling:100），不可依赖暂停的requestAnimationFrame；欢迎页就绪不代表项目已加载。新增启动入口检查见 desktop/startup-desktop.test.cjs。
- 所有测试 profile、截图和下载落在本项目 `docs/test-runtime` / `docs/qa`；运行前将 TMP/TEMP 指向 `docs/test-runtime`。桌面测试必须使用独立 `--data-dir`，不得以真实项目做写入试验。
- 完整打包依赖官方 Electron 运行时及 SHA-256 校验；已有运行时仅更新资源使用 `--resources-only`，不要对资源包宣称可单独运行。
- 程序更新使用 `desktop/deploy.ps1`，前提是应用正常退出。逐文件备份、校验、替换，仅更新 resources/app 和 Agent教程；不得覆盖、删除或打包 data。当前部署及回退路径查 `docs/deployment-result.json`。
- 教程文档单独同步使用 `python desktop/sync-guide.py`，需更新安装副本时加 `--installed`；只替换教程文件与 HTML 数据段，保留执行脚本和 CSP，已有窗口下次打开教程仍可能是旧内存内容，重开应用后生效。
- `python desktop/verify-installed.py` 核对安装脚本与维护源码和 CSP；功能发布还需实际桌面保存/重载验证，不以文件哈希代替业务验收。
- Git 姓名/邮箱缺失时保留已验证改动并说明，不能编造身份；不擅自推送、清空既有暂存区或把个人项目并入提交。
