# 安省 G1 笔试题库：给 Claude 的项目说明

用户在多伦多备考安大略省 G1 驾照笔试。本仓库是中英对照的练习题库（723 题）和一个单文件练习网页「G1 Studio」（`05_模拟练习.html`）。全程用中文交流，PR 描述也用中文。

## 结构

| 路径 | 内容 |
|---|---|
| `data/questions.json` | 全部题目（唯一数据源）；`data/meta.json` 是分组、模拟考配置和页脚文字 |
| `tools/quiz_template.html`、`tools/quiz_styles.css`、`tools/quiz_app.js` | 练习网页的结构、样式、交互源文件 |
| `tools/build.py` | 生成 `03`、`04` 两份题库 md、`data/questions.csv` 和 `05_模拟练习.html`（把 CSS、JS、题库，以及由 `data/cheat.json`、`data/info.json` 解析出的必背速查内容全部内嵌） |
| `05_模拟练习.html` | 生成结果，用户直接双击打开使用。**不要手改**，改源文件后重新生成 |
| `handbook_text/` | 官方 MTO Driver's Handbook 和现行法规的纯文本副本，出题、核对都以它为准 |
| `01_考试须知.md`、`02_必背要点.md` | 由 `data/info.json`、`data/cheat.json` 生成 |

改完网页源文件运行 `python tools/build.py --html-only`；改了题目数据运行 `python tools/build.py`。生成出来的文件和源文件一起提交。

## 必须遵守

- **网页保持单文件、可离线**：所有 CSS、JS、数据都内嵌，不引入 CDN、外部字体、npm 包或前端框架，用原生 JS。
- **标志图片**：题目里的 `image_url` 指向 files.ontario.ca 的官方图片。不要下载、打包或替换这些图片（用户还没同意）。云端环境多半访问不到这个域名，图片加载失败是预期的；要保证失败时的兜底显示（练习模式显示文字描述，模拟考试不提前透露描述）正常。
- **不破坏已有学习记录**：用户的进度存在 localStorage，键名为 `g1-hist`、`g1-wrong`、`g1-bookmarks`、`g1-notes`、`g1-activity`、`g1-sessions`、`g1-session`、`g1-preferences`、`g1-lang`、`g1-groups`、`g1-count`、`g1-random`、`g1-unseen`、`g1-srs`（复习计划）。不要改键名和已有字段的含义；确实要改格式就写迁移代码。「偏好与数据」里的 JSON 导出文件，新版必须还能导入旧版导出的文件。
- **模拟考试**：按 `data/meta.json` 的 `exam`（20 道标志 + 20 道交规，每部分 80% 才算通过）。交卷前不显示对错、解析和图片的文字描述。
- **题目内容**：只能依据 `handbook_text/` 和 ontario.ca 现行规定原创，不能抄第三方题库。界面和功能类任务不改题目；发现明确错误时单独提交，并在 PR 里写明依据（文件名和原文）。
- 界面以中文为主，保留中英 / 中文 / 英文三种显示切换。
- 功能有变化时同步更新 `README.md` 的功能介绍。

## 怎么验证

环境里有 Python 3 和 Node 22（含 chromedriver）。改完网页后：

1. 重新生成 `05_模拟练习.html`。
2. 用无头浏览器（Playwright 或 Selenium 都行）打开生成的 HTML 跑一遍主要流程：首页、分类练习答题、模拟考试交卷、错题复习、收藏、统计、偏好设置、导出导入、刷新后续练。
3. 分别在桌面宽度（1280）、手机宽度（390）、深色模式下截图检查布局，截图放 `screenshots/`（不提交），挑重点贴进 PR 描述。
4. 自动化测试放 `tests/`，不能依赖外网。一条命令运行：`node tests/run.js`；截图脚本：`node tests/screenshots.js`。
