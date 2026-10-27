"""由 data/questions.json + data/meta.json 生成题库 Markdown、练习网页和 CSV。

用法：python D:\\ontario-g1\\tools\\build.py
"""
import csv
import argparse
import hashlib
import html
import json
import pathlib
import random
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
KEYS = "ABCD"


def load():
    qs = json.loads((DATA / "questions.json").read_text(encoding="utf-8"))
    meta = json.loads((DATA / "meta.json").read_text(encoding="utf-8"))
    return qs, meta


def fixed_order(q):
    """题库文档里的选项顺序：按题号做确定性打乱，避免答案集中在某个字母。"""
    seed = int(hashlib.md5(q["id"].encode()).hexdigest(), 16)
    order = list(range(4))
    random.Random(seed).shuffle(order)
    return order


def md_question(q):
    order = fixed_order(q)
    ans_pos = order.index(q["answer_index"])
    diff = {"easy": "易", "medium": "中", "hard": "难"}[q["difficulty"]]
    out = [f"### {q['id']}　〔{q['topic_zh']}〕 难度：{diff}", ""]
    if q.get("image_url"):
        out += [f'<img src="{q["image_url"]}" width="150" alt="{q.get("sign_desc_zh") or "交通标志"}">', ""]
        if q.get("sign_desc_zh"):
            out += [f"（图示：{q['sign_desc_zh']}）", ""]
    out += [f"**{q['question_zh']}**  ", f"*{q['question_en']}*", ""]
    for pos, oi in enumerate(order):
        o = q["options"][oi]
        out.append(f"- {KEYS[pos]}. {o['zh']} ／ {o['en']}")
    correct = q["options"][q["answer_index"]]
    out += [
        "",
        f"**答案：{KEYS[ans_pos]}**　{correct['zh']}（{correct['en']}）  ",
        f"**解析：** {q['explanation_zh']}  ",
        f"依据：[{q['source_title']}]({q['source_url']})",
        "",
        "---",
        "",
    ]
    return "\n".join(out)


def write_md(qs, meta, section, path, title, intro):
    groups = [g for g in meta["groups"] if g["section"] == section]
    lines = [f"# {title}", "", intro, ""]
    lines.append("| 分类 | 题数 |")
    lines.append("|---|---|")
    for g in groups:
        n = sum(1 for q in qs if q["group"] == g["id"])
        lines.append(f"| [{g['id']} {g['title_zh']}](#{g['id'].lower()}) | {n} |")
    lines += ["", f"合计 {sum(1 for q in qs if q['section'] == section)} 题。", ""]
    for g in groups:
        gq = [q for q in qs if q["group"] == g["id"]]
        lines += [f'<a id="{g["id"].lower()}"></a>', "", f"## {g['id']} {g['title_zh']}（{len(gq)} 题）", ""]
        lines += [md_question(q) for q in gq]
    path.write_text("\n".join(lines), encoding="utf-8")


LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")
LIST_RE = re.compile(r"^([-*]|\d+\.)\s+(.*)$")
BLOCK_START_RE = re.compile(r"^(#|\||>|([-*]|\d+\.)\s|-{3,}$)")


def inline_html(text):
    """Markdown 行内格式（**粗体**、[链接](网址)）转成转义后的 HTML。"""
    out, last = [], 0
    for m in LINK_RE.finditer(text):
        out.append(html.escape(text[last:m.start()], quote=False))
        label, url = html.escape(m.group(1), quote=False), m.group(2)
        if url.startswith(("https://", "http://")):
            out.append(f'<a href="{html.escape(url)}" target="_blank" rel="noopener noreferrer">{label}</a>')
        else:
            out.append(label)
        last = m.end()
    out.append(html.escape(text[last:], quote=False))
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", "".join(out))


def plain_text(text):
    return re.sub(r"\*\*(.+?)\*\*", r"\1", LINK_RE.sub(r"\1", text)).strip()


def parse_list(lines, i):
    indent = lambda line: len(line) - len(line.lstrip(" "))
    base, ordered, items = indent(lines[i]), bool(re.match(r"^\d+\.\s", lines[i].strip())), []
    while i < len(lines):
        line, s = lines[i], lines[i].strip()
        if not s:
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines) and LIST_RE.match(lines[j].strip()) and indent(lines[j]) >= base:
                i = j
                continue
            break
        m = LIST_RE.match(s)
        if not m:
            if items and indent(line) > base:
                items[-1]["html"] += " " + inline_html(s)
                i += 1
                continue
            break
        if indent(line) < base:
            break
        if indent(line) > base:
            child, i = parse_list(lines, i)
            if items:
                items[-1].setdefault("children", []).append(child)
            continue
        items.append({"html": inline_html(m.group(2))})
        i += 1
    return {"t": "ol" if ordered else "ul", "items": items}, i


def parse_markdown(md):
    """把必背要点、考试须知用到的 markdown 子集解析成网页速查页使用的块结构。"""
    lines, blocks, i = md.split("\n"), [], 0
    while i < len(lines):
        s = lines[i].strip()
        if not s or re.match(r"^-{3,}$", s):
            i += 1
        elif s.startswith("#"):
            level = len(s) - len(s.lstrip("#"))
            blocks.append({"t": f"h{level}", "html": inline_html(s[level:].strip())})
            i += 1
        elif s.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            body = [r for r in rows[1:] if not all(re.match(r"^:?-{2,}:?$", c) for c in r)]
            blocks.append({"t": "table", "head": [inline_html(c) for c in rows[0]], "rows": [[inline_html(c) for c in r] for r in body]})
        elif s.startswith(">"):
            quote = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip()[1:].strip())
                i += 1
            blocks.append({"t": "quote", "html": inline_html(" ".join(q for q in quote if q))})
        elif LIST_RE.match(s):
            block, i = parse_list(lines, i)
            blocks.append(block)
        else:
            para = []
            while i < len(lines) and lines[i].strip() and not BLOCK_START_RE.match(lines[i].strip()):
                para.append(lines[i].strip())
                i += 1
            text = " ".join(para)
            if re.fullmatch(r"\*\*[^*]+\*\*", text):
                blocks.append({"t": "h4", "html": inline_html(text[2:-2])})
            elif LINK_RE.search(text) and not re.sub(r"^出处：|[\s·、，]", "", LINK_RE.sub("", text)):
                blocks.append({"t": "links", "html": inline_html(text)})
            else:
                blocks.append({"t": "p", "html": inline_html(text)})
    return blocks


def reference_doc(doc_id, md, extra_sections=()):
    """按二级标题切成章节；一级标题是文档名，第一个二级标题之前的内容作为导语。"""
    title, intro, sections = doc_id, [], []
    for block in parse_markdown(md):
        if block["t"] == "h1":
            title = html.unescape(re.sub(r"<[^>]+>", "", block["html"]))
        elif block["t"] == "h2":
            sections.append({"title": html.unescape(re.sub(r"<[^>]+>", "", block["html"])), "blocks": []})
        elif sections:
            sections[-1]["blocks"].append(block)
        else:
            intro.append(block)
    return {"id": doc_id, "title": title, "intro": intro, "sections": sections + list(extra_sections)}


def reference_data(qs):
    """必背要点（cheat.json）和考试须知（info.json），内容与 write_docs 生成的两份 md 一致。"""
    docs = []
    cheat_f, info_f = DATA / "cheat.json", DATA / "info.json"
    if cheat_f.exists():
        cheat = json.loads(cheat_f.read_text(encoding="utf-8"))
        extra = []
        changed = [q for q in qs if q.get("law_changed")]
        if changed:
            extra.append({"title": "手册与现行规定不一致的题", "blocks": [
                {"t": "p", "html": inline_html("手册第 22 节的部分旧数字与现行规定不同。下面几题已对照现行政府资料更新；不要根据旧选项推测考试答案，规则以官方最新资料为准：")},
                {"t": "ul", "items": [{"html": inline_html(f"{q['id']}：{q['question_zh']}")} for q in changed]},
            ]})
        docs.append(reference_doc("cheat", cheat["markdown_zh"], extra))
    if info_f.exists():
        info = json.loads(info_f.read_text(encoding="utf-8"))
        docs.append(reference_doc("info", info["markdown_zh"], [
            {"title": "附：未能确认的事项", "blocks": [{"t": "ul", "items": [{"html": inline_html(u)} for u in info["uncertain"]]}]},
            {"title": "附：参考来源", "blocks": [{"t": "ul", "items": [{"html": inline_html(f"[{s['title']}]({s['url']})")} for s in info["sources"]]}]},
        ]))
    return {"docs": docs}


def render_html(qs, meta):
    tpl = (ROOT / "tools" / "quiz_template.html").read_text(encoding="utf-8")
    styles = (ROOT / "tools" / "quiz_styles.css").read_text(encoding="utf-8")
    app = (ROOT / "tools" / "quiz_app.js").read_text(encoding="utf-8")
    slim = [{k: q[k] for k in ("id", "group", "section", "topic_zh", "question_en", "question_zh", "options",
                                "answer_index", "explanation_zh", "explanation_en", "source_url", "source_title",
                                "image_url", "sign_desc_en", "sign_desc_zh", "difficulty")} for q in qs]
    page_meta = {
        "groups": meta["groups"],
        "exam": meta["exam"],
        "footer": meta["footer"],
        "handbook_url": meta["handbook_url"],
    }
    # Keep the distributable self-contained and data safe inside an inline script.
    def script_json(value):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")

    body = (tpl.replace("/*__STYLES__*/", styles)
               .replace("/*__APP__*/", app)
               .replace("/*__DATA__*/", script_json(slim))
               .replace("/*__META__*/", script_json(page_meta))
               .replace("/*__REF__*/", script_json(reference_data(qs))))
    head, rest = body.split("</style>", 1)
    return f'<!doctype html>\n<html lang="zh-CN">\n<head>\n{head}</style>\n</head>\n<body>\n{rest}\n</body>\n</html>\n'


def write_html(qs, meta, path):
    path.write_text(render_html(qs, meta), encoding="utf-8")


def write_csv(qs, path):
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "分类", "部分", "子主题", "题目(中)", "题目(EN)", "A", "B", "C", "D", "答案", "解析", "图片", "依据"])
        for q in qs:
            order = fixed_order(q)
            opts = [f"{q['options'][oi]['zh']} / {q['options'][oi]['en']}" for oi in order]
            w.writerow([q["id"], q["group"], "标志" if q["section"] == "signs" else "交规", q["topic_zh"],
                        q["question_zh"], q["question_en"], *opts, KEYS[order.index(q["answer_index"])],
                        q["explanation_zh"], q.get("image_url", ""), q["source_url"]])


def write_docs(qs):
    info_f, cheat_f = DATA / "info.json", DATA / "cheat.json"
    if info_f.exists():
        info = json.loads(info_f.read_text(encoding="utf-8"))
        parts = [info["markdown_zh"].rstrip(), "", "## 附：未能确认的事项", ""]
        parts += [f"- {u}" for u in info["uncertain"]]
        parts += ["", "## 附：参考来源", ""]
        parts += [f"- [{s['title']}]({s['url']})" for s in info["sources"]]
        (ROOT / "01_考试须知.md").write_text("\n".join(parts) + "\n", encoding="utf-8")
    if cheat_f.exists():
        cheat = json.loads(cheat_f.read_text(encoding="utf-8"))
        (ROOT / "02_必背要点.md").write_text(cheat["markdown_zh"].rstrip() + "\n", encoding="utf-8")
    changed = [q for q in qs if q.get("law_changed")]
    if changed:
        lines = ["", "## 手册与现行规定不一致的题", "",
                 "手册第 22 节的部分旧数字与现行规定不同。下面几题已对照现行政府资料更新；不要根据旧选项推测考试答案，规则以官方最新资料为准：", ""]
        lines += [f"- {q['id']}：{q['question_zh']}" for q in changed]
        with (ROOT / "02_必背要点.md").open("a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html-only", action="store_true", help="只更新练习网页，保留题库文档和 CSV")
    parser.add_argument("--check", action="store_true", help="只检查练习网页是否已按源文件重新生成，不写文件")
    args = parser.parse_args()
    qs, meta = load()
    if args.check:
        page = ROOT / "05_模拟练习.html"
        if not page.exists() or page.read_text(encoding="utf-8") != render_html(qs, meta):
            print("05_模拟练习.html 与源文件不一致，请运行 python tools/build.py --html-only")
            sys.exit(1)
        print("05_模拟练习.html is up to date")
        return
    if args.html_only:
        write_html(qs, meta, ROOT / "05_模拟练习.html")
        print(f"Updated quiz: {len(qs)} questions")
        return
    write_docs(qs)
    write_md(qs, meta, "rules", ROOT / "03_题库_交通规则.md", "安省 G1 笔试题库：交通规则",
             meta["intro_rules"])
    write_md(qs, meta, "signs", ROOT / "04_题库_标志信号标线.md", "安省 G1 笔试题库：标志、信号灯与路面标线",
             meta["intro_signs"])
    write_html(qs, meta, ROOT / "05_模拟练习.html")
    write_csv(qs, DATA / "questions.csv")
    counts = {}
    for q in qs:
        counts[q["group"]] = counts.get(q["group"], 0) + 1
    print("total", len(qs), counts)


if __name__ == "__main__":
    main()
