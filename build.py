#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
축구창고 정적 페이지 빌더 (SEO)

index.html(라이브 우선, 실패 시 로컬)을 파싱해 검색엔진이 색인할 독립 페이지를 생성한다.
  tools/<id>/index.html   활성 도구 각각 (정적 섹션 + MINI_ALL - MINI_DISABLED)
  tools/index.html        카테고리별 도구 목차
  news/<날짜>/index.html  네이버블로그/데이터의 수집결과 기반 일자별 뉴스
  news/index.html         날짜 목차
  transfer/index.html     최신 이적 소식
  sitemap.xml             전체 사이트맵 (해시 URL 제외)

실행:  py -3 build.py [--quiet]
"""
import glob
import html
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

BASE = os.path.dirname(os.path.abspath(__file__))
SITE = "https://chukguchanggo.com"
GA_ID = "G-TKC505GRGB"
DATA_DIR = os.path.join(BASE, "네이버블로그", "데이터")
QUIET = "--quiet" in sys.argv
KST = timezone(timedelta(hours=9))
TODAY = datetime.now(KST).strftime("%Y-%m-%d")


def log(*args):
    if not QUIET:
        print(*args)


# ──────────────────────────── index.html 로드 ────────────────────────────

def load_index():
    try:
        import urllib.request
        req = urllib.request.Request(SITE + "/index.html",
                                     headers={"User-Agent": "chukgu-build/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            t = r.read().decode("utf-8", "replace")
        if "MINI_ALL" in t and len(t) > 100000:
            log("[index] 라이브 사이트에서 로드 (%d bytes)" % len(t))
            return t
        log("[index] 라이브 응답이 비정상 — 로컬로 폴백")
    except Exception as e:
        log("[index] 라이브 로드 실패(%s) — 로컬로 폴백" % e)
    p = os.path.join(BASE, "homepage-refresh", "index.html")
    if not os.path.isfile(p):
        p = os.path.join(BASE, "index.html")
    t = open(p, encoding="utf-8").read()
    log("[index] 로컬 파일 사용 (%d bytes) — 주의: 로컬본이 구버전일 수 있음" % len(t))
    return t


# ──────────────────────────── 파싱 유틸 ────────────────────────────

def strip_tags(s):
    s = re.sub(r"<script[\s\S]*?</script>", "", s)
    s = re.sub(r"<[^>]+>", " ", s)
    return html.unescape(re.sub(r"\s+", " ", s)).strip()


def js_str(s):
    """JS 문자열 리터럴 내용 → 파이썬 문자열"""
    return (s.replace('\\"', '"').replace("\\'", "'")
             .replace("\\n", " ").replace("\\\\", "\\"))


def match_bracket(s, start, open_ch="[", close_ch="]"):
    """s[start] == open_ch 라고 가정, 대응하는 닫힘 위치+1 반환"""
    depth, i, in_str, esc, q = 0, start, False, False, ""
    while i < len(s):
        c = s[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == q:
                in_str = False
        else:
            if c in "\"'":
                in_str, q = True, c
            elif c == open_ch:
                depth += 1
            elif c == close_ch:
                depth -= 1
                if depth == 0:
                    return i + 1
        i += 1
    return -1


def extract_strings(seg):
    """세그먼트 안의 큰따옴표 JS 문자열 리터럴들을 순서대로 추출"""
    out, i, n = [], 0, len(seg)
    while i < n:
        if seg[i] == '"':
            j, buf = i + 1, []
            while j < n:
                c = seg[j]
                if c == "\\" and j + 1 < n:
                    buf.append(seg[j:j + 2]); j += 2; continue
                if c == '"':
                    break
                buf.append(c); j += 1
            out.append(js_str("".join(buf)))
            i = j + 1
        else:
            i += 1
    return out


# ──────────────────────────── 도구 추출 ────────────────────────────

def parse_static_tools(src):
    tools = []
    for m in re.finditer(r'<section class="tool" id="([^"]+)"[\s\S]*?</section>', src):
        sec, tid = m.group(0), m.group(1)
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", tid):
            continue  # JS 템플릿 문자열 오탐 방지
        h2 = re.search(r"<h2>([\s\S]*?)</h2>", sec)
        title = strip_tags(h2.group(1)) if h2 else tid
        parts = title.split(" ", 1)
        icon, name = (parts[0], parts[1]) if len(parts) == 2 else ("🧰", title)
        desc_m = re.search(r'<div class="desc">([\s\S]*?)</div>', sec)
        desc = strip_tags(desc_m.group(1)) if desc_m else ""
        notes = [strip_tags(x) for x in re.findall(r'<div class="note"[^>]*>([\s\S]*?)</div>', sec)]
        tools.append({"id": tid, "icon": icon, "name": name, "desc": desc,
                      "notes": [n for n in notes if n], "kind": "static",
                      "cat": None, "opts": [], "fields": []})
    return tools


def parse_mini_tools(src):
    m = re.search(r"MINI_ALL\s*=\s*\[", src)
    if not m:
        return []
    end = match_bracket(src, m.end() - 1)
    arr = src[m.end():end - 1]
    dis_m = re.search(r"MINI_DISABLED\s*=\s*\[([\s\S]*?)\]", src)
    disabled = set(re.findall(r'"([^"]+)"', dis_m.group(1))) if dis_m else set()

    # 배열 최상위 객체 단위로 분리
    objs, i, n = [], 0, len(arr)
    while i < n:
        if arr[i] == "{":
            j = match_bracket(arr, i, "{", "}")
            if j < 0:
                break
            objs.append(arr[i:j])
            i = j
        else:
            i += 1

    tools = []
    for o in objs:
        def fld(k):
            fm = re.search(k + r':"((?:[^"\\]|\\.)*)"', o)
            return js_str(fm.group(1)) if fm else ""
        tid = fld("id")
        if not tid or tid in disabled:
            continue
        t = {"id": tid, "cat": fld("cat"), "icon": fld("icon"), "name": fld("name"),
             "desc": fld("desc"), "kind": fld("kind") or "calc",
             "opts": [], "fields": [], "notes": []}
        if t["kind"] == "select":
            om = re.search(r"opts\s*:\s*\[", o)
            if om:
                oend = match_bracket(o, om.end() - 1)
                inner = o[om.end():oend - 1]
                # [["항목","답"],...] — 문자열을 순서대로 뽑아 2개씩 짝짓기
                strs = extract_strings(inner)
                t["opts"] = [(strs[k], strs[k + 1]) for k in range(0, len(strs) - 1, 2)]
        elif t["kind"] == "calc":
            fm = re.search(r"fields\s*:\s*\[", o)
            if fm:
                fend = match_bracket(o, fm.end() - 1)
                t["fields"] = [js_str(x) for x in
                               re.findall(r'label:"((?:[^"\\]|\\.)*)"', o[fm.end():fend - 1])]
        tools.append(t)
    return tools


def parse_core_cats(src):
    m = re.search(r"CORE_CATS\s*=\s*\{([\s\S]*?)\}", src)
    if not m:
        return {}
    return dict(re.findall(r'"([^"]+)"\s*:\s*"([^"]+)"', m.group(1)))


# ──────────────────────────── 페이지 템플릿 ────────────────────────────

CSS = """*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;background:#f6f5fb;color:#1c1830;line-height:1.75}
a{color:#5b47c9;text-decoration:none}a:hover{text-decoration:underline}
.hd{background:linear-gradient(135deg,#1e1b4b,#4c1d95);color:#fff;padding:26px 18px}
.hd a{color:#fff;font-weight:800;font-size:19px}.hd a b{color:#facc15}
.hd .sub{font-size:12.5px;opacity:.8;margin-top:4px}
.wrap{max-width:760px;margin:0 auto;padding:24px 18px 60px}
h1{font-size:25px;line-height:1.4;margin:6px 0 12px}
h2{font-size:18px;margin:30px 0 10px;padding-left:10px;border-left:4px solid #facc15}
p{margin:8px 0}
.lead{color:#4a4468;font-size:15.5px}
.card{background:#fff;border:1px solid #e5e1f5;border-radius:14px;padding:18px 20px;margin:14px 0}
.cta{display:block;text-align:center;background:#facc15;color:#3b2b00;font-weight:800;font-size:17px;
 padding:15px 20px;border-radius:99px;margin:22px 0;box-shadow:0 3px 10px rgba(250,204,21,.35)}
.cta:hover{text-decoration:none;filter:brightness(1.05)}
table{width:100%;border-collapse:collapse;margin:10px 0;font-size:14px}
th,td{border:1px solid #e5e1f5;padding:9px 11px;text-align:left;vertical-align:top}
th{background:#f1eefc;white-space:nowrap}
ul{padding-left:22px;margin:8px 0}li{margin:5px 0}
.meta{color:#8a84a8;font-size:12.5px}
.art{border-bottom:1px solid #eeeaf8;padding:13px 0}.art:last-child{border-bottom:none}
.art h3{font-size:15.5px;line-height:1.5;margin-bottom:4px}
.rel a{display:inline-block;background:#fff;border:1px solid #ddd7f0;border-radius:99px;
 padding:7px 14px;margin:4px 4px 0 0;font-size:13.5px}
.nav2{display:flex;justify-content:space-between;margin:18px 0;font-size:14px}
.ft{border-top:1px solid #e5e1f5;margin-top:40px;padding:20px 18px;text-align:center;font-size:13px;color:#8a84a8}
.ft a{margin:0 8px}
@media(min-width:700px){h1{font-size:29px}}"""

GA_SNIPPET = ('<script async src="https://www.googletagmanager.com/gtag/js?id=%s"></script>'
              '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}'
              "gtag('js',new Date());gtag('config','%s');</script>") % (GA_ID, GA_ID)

# Google AdSense — 사이트 소유 확인·광고 게재용 (전 정적 페이지 공통)
GA_SNIPPET += ('<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
               '?client=ca-pub-2139001800218485" crossorigin="anonymous"></script>')


def page(title, desc, canonical, body, jsonld=None, depth=1, noindex=False):
    rel = "../" * depth
    desc = html.escape(desc[:155])
    ld = ('<script type="application/ld+json">%s</script>'
          % json.dumps(jsonld, ensure_ascii=False)) if jsonld else ""
    robots = "noindex,follow" if noindex else "index,follow"
    return """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>%s</title>
<meta name="description" content="%s">
<meta name="robots" content="%s">
<link rel="canonical" href="%s">
<link rel="icon" type="image/png" href="%sbrand-logo.png">
<meta property="og:title" content="%s">
<meta property="og:description" content="%s">
<meta property="og:type" content="website">
<meta property="og:url" content="%s">
<meta property="og:image" content="%s/og-image-v2.png">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="%s">
<meta name="twitter:description" content="%s">
%s%s
<style>%s</style>
<link rel="stylesheet" href="/internal.css?v=0908-review1">
</head>
<body class="sg-static">
<header class="hd"><a href="/" style="display:flex;align-items:center;gap:10px">
<img src="%sbrand-logo.png" alt="축구창고 로고" width="42" height="42" style="border-radius:50%%">
<span>축구<b>창고</b></span></a>
<div class="sub">축구 팬을 위한 무료 축구 도구 · 매일 축구 뉴스 · 이적 소식</div></header>
<main class="wrap">
%s
</main>
<footer class="ft">
<a href="/">홈</a><a href="/tools/">도구 전체</a><a href="/news/">뉴스</a><a href="/transfer/">이적시장</a><a href="/privacy.html">개인정보처리방침</a>
<div style="margin-top:8px">ⓒ 축구창고 · chukguchanggo.com</div>
</footer>
<script src="/internal.js?v=0908-review1"></script>
</body>
</html>""" % (html.escape(title), desc, robots, canonical, rel, html.escape(title), desc,
              canonical, SITE, html.escape(title), desc, GA_SNIPPET, ld, CSS, rel, body)


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)


def clean_answer_html(s):
    """select 답변 HTML — 스크립트/이벤트 제거 후 그대로 게재"""
    s = re.sub(r"<script[\s\S]*?</script>", "", s)
    s = re.sub(r'\son\w+="[^"]*"', "", s)
    return s


# ──────────────────────────── 도구 페이지 ────────────────────────────

KIND_USAGE = {
    "calc": "아래 값을 입력하면 결과가 즉시 계산됩니다.",
    "select": "항목을 선택하면 해당 내용을 바로 보여주는 사전형 도구입니다. 아래 표에서 전체 내용을 미리 볼 수 있습니다.",
    "random": "버튼을 누를 때마다 무작위 결과를 뽑아 주는 도구입니다.",
    "custom": "축구창고에서 바로 실행되는 인터랙티브 도구입니다.",
    "static": "축구창고에서 바로 실행되는 무료 도구입니다.",
}


# 카테고리 → 관련 매거진 글 (mag key)
CAT_MAG = {
    "👟 사이즈·장비": ["boots", "jersey", "futsal"],
    "🕐 시간·일정": ["calendar", "watch"],
    "📊 기록·통계": ["xg", "glossary", "fpl"],
    "🤝 동호회 운영": ["futsal", "dawn"],
    "🏟️ 직관·집관": ["kleague", "seats", "london"],
    "⚖️ 규칙 도우미": ["glossary", "xg"],
    "📚 리그·구단 사전": ["glossary", "ucl"],
    "🔁 변환기": ["watch", "london"],
    "💪 훈련·피지컬": ["futsal", "dawn"],
    "🎲 재미·랜덤": ["glossary", "fm"],
    "🏆 역사 조회": ["wchistory", "ucl"],
}

# 검색 잠재력 상위 도구 전용 가이드 — 계산 기준(basis)·결과 해석(interp)·FAQ
TOOL_GUIDE = {
    "kickoff": {
        "basis": "경기 도시의 시간대와 서머타임(DST) 적용 여부를 반영해 한국 표준시(KST, UTC+9)로 환산합니다. 한국은 서머타임이 없어서, 유럽이 서머타임인 기간(3월 말~10월 말)에는 시차가 1시간 줄어듭니다.",
        "interp": "예를 들어 영국 20:00 킥오프는 서머타임 기간엔 한국 새벽 4시, 그 외 기간엔 새벽 5시입니다. 유럽 저녁 경기는 대부분 한국 새벽이라, 시청 계획은 종료 시각까지 함께 확인하는 게 좋습니다.",
        "faq": [("서머타임이 정확히 뭔가요?", "유럽 등지에서 3월 마지막 일요일~10월 마지막 일요일에 시계를 1시간 앞당기는 제도입니다. 이 기간엔 한국과 영국의 시차가 9시간에서 8시간으로 줄어듭니다."),
                 ("결과가 현지 발표와 다르면요?", "구단·리그 공식 발표 시간이 항상 우선입니다. 이 도구는 시간대 환산을 자동화해 주는 보조 도구입니다.")]},
    "boot-size": {
        "basis": "발 길이(mm) 실측값을 국제 사이즈 대응표(EU·UK·US)에 매핑합니다. 브랜드·모델마다 라스트(발 형틀)가 달라 같은 표기라도 착화감이 다를 수 있습니다.",
        "interp": "이 표는 참고용입니다. 구매할 브랜드·모델의 실측표와 착화감을 기준으로 고르세요.",
        "faq": [("나이키와 아디다스는 같은 사이즈를 사면 되나요?", "표기는 같아도 라스트가 달라 착화감이 다릅니다. 구매 후기와 모델별 사이즈 팁을 함께 확인하는 걸 권합니다."),
                 ("풋살화도 같은 기준인가요?", "모델별 사이즈표와 사용 구장 조건을 확인하세요.")]},
    "points-sim": {
        "basis": "승리 3점, 무승부 1점, 패배 0점의 표준 승점제로 계산합니다. 목표 승점에서 현재 승점을 빼고 남은 경기 수와 비교합니다.",
        "interp": "목표 승점은 사용자가 정한 값입니다. 이 계산만으로 우승이나 잔류를 확정할 수는 없습니다.",
        "faq": [("남은 경기를 다 이겨도 목표에 못 미치면요?", "산술적으로 불가능하다는 뜻입니다. 이 경우 도구가 달성 불가로 안내합니다.")]},
    "winrate": {
        "basis": "승률 = 승 ÷ 전체 경기, 승점 = 3×승 + 1×무. 경기당 평균 승점 = 승점 ÷ 전체 경기.",
        "interp": "같은 대회와 기간의 기록을 비교하세요. 평균 승점만으로 최종 순위를 확정할 수는 없습니다.",
        "faq": [("무승부는 승률에 어떻게 반영되나요?", "승률 계산에서는 패배와 동일하게 분모에만 들어갑니다. 대신 승점에는 1점으로 반영됩니다.")]},
    "fee-convert": {
        "basis": "백만 유로(€m) 금액을 입력한 환율로 원화 환산합니다.",
        "interp": "언론 보도 이적료는 고정 이적료와 옵션(성과 조건부)이 섞인 총액인 경우가 많습니다. '+옵션' 표기가 있으면 실제 지급액은 조건 달성에 따라 달라집니다.",
        "faq": [("환율은 언제 기준인가요?", "화면의 환율 값과 기준 시점을 확인하세요. 입력한 값이나 외부 조회값을 사용하는 도구에 따라 다릅니다.")]},
    "fx-calc": {
        "basis": "해외 직구 가격(유로·파운드·달러 등)을 조회 시점의 실시간 환율로 원화 환산합니다.",
        "interp": "실제 결제액은 카드사 환율·수수료, 배송비와 세금에 따라 달라집니다. 세금 적용은 관세청의 최신 안내를 확인하세요.",
        "faq": [("표시 금액이 결제액과 왜 다른가요?", "카드사 환율·수수료가 별도로 붙기 때문입니다. 이 도구의 결과는 기준 환율 환산액입니다.")]},
    "dues-calc": {
        "basis": "잔액 = 월회비 × 납부 인원 − 지출. 이월금은 별도 입력 항목이 없습니다.",
        "interp": "월별 잔액 흐름을 기록해 두면 회비 인상·지출 조정 논의가 쉬워집니다.",
        "faq": [("기록이 저장되나요?", "브라우저에서 계산만 합니다. 장기 기록은 스프레드시트에 결과를 옮겨 관리하세요.")]},
    "stud-pick": {
        "basis": "구장 바닥(천연잔디 FG · 인조잔디 AG · 터프 TF · 실내 IC/IN)별로 적합한 밑창 규격을 안내합니다. 밑창은 스터드 길이·개수·배열이 다릅니다.",
        "interp": "제조사에서 안내하는 사용 구장과 시설의 신발 규정을 함께 확인하세요.",
        "faq": [("하나로 다 신을 수는 없나요?", "모든 바닥에 공통으로 적합한 제품이라고 단정할 수 없습니다. 제품별 사용 조건을 확인하세요.")]},
    "endtime": {
        "basis": "전·후반 각 45분 + 하프타임 15분 + 추가시간을 반영해 예상 종료 시각을 계산합니다.",
        "interp": "추가시간은 통상 전반 1~5분, 후반 3~10분 이상까지도 나옵니다. 실제 종료는 예상보다 ±10분 정도 차이 날 수 있습니다.",
        "faq": [("연장전이 있는 경기는요?", "토너먼트 연장 시 30분(+휴식)과 승부차기가 더해집니다. 넉넉히 40~50분을 더 잡으세요.")]},
    "depart-time": {
        "basis": "킥오프 시각에서 이동 시간과 입장 여유 시간을 역산해 출발 시각을 계산합니다.",
        "interp": "빅매치·더비는 입장 대기줄이 깁니다. 평소보다 30분 이상 여유를 더 두는 걸 권합니다.",
        "faq": [("경기장 도착은 얼마나 일찍이 적당한가요?", "일반 경기는 킥오프 40~60분 전, 빅매치는 90분 전 도착이 무난합니다.")]},
    "hr-zone": {
        "basis": "최대심박수를 통용 추정식(220 − 나이)으로 구하고, 그 비율(%)로 훈련 존을 나눕니다. 개인차가 있는 추정치입니다.",
        "interp": "Zone 2(최대심박의 60~70%)는 회복·유산소 기초, Zone 4~5(80% 이상)는 고강도 인터벌 영역입니다. 축구 체력은 두 영역을 섞어 훈련하는 것이 일반적입니다.",
        "faq": [("추정식이 정확한가요?", "통계적 평균식이라 개인 오차가 있습니다. 정확한 값은 운동부하검사로만 알 수 있습니다.")]},
    "sprint-speed": {
        "basis": "속도 = 거리 ÷ 시간을 km/h로 환산합니다.",
        "interp": "프로 리그 트래킹 데이터에서 최상위권 선수의 최고 속도는 시속 35km 안팎으로 보고됩니다. 아마추어가 시속 30km를 넘기면 매우 빠른 편입니다.",
        "faq": [("정확히 재려면 어떻게 하나요?", "20~40m 구간을 정하고 출발·도착을 영상으로 찍어 프레임으로 시간을 재면 오차가 줄어듭니다.")]},
    "futsal-cal": {
        "basis": "체중 × 운동 시간 × 운동 강도(MET 계수)로 소모 칼로리를 추정하는 표준 방식입니다.",
        "interp": "풋살은 달리기와 정지·방향전환이 섞여 강도 변동이 큽니다. 결과는 참고용 추정치로 보세요.",
        "faq": [("정확한 측정은 불가능한가요?", "심박 기반 스포츠워치가 더 정밀합니다. 이 도구는 장비 없이 대략치를 빠르게 보는 용도입니다.")]},
    "seasonpass-break": {
        "basis": "시즌권 가격 ÷ 회당 티켓 가격 = 손익분기 경기 수. 그 이상 직관하면 시즌권이 이득입니다.",
        "interp": "좌석 등급 차이, 예매 수수료, 시즌권 전용 혜택(선예매·할인)은 계산 밖의 플러스 요인입니다.",
        "faq": [("몇 경기나 갈지 모르겠어요.", "지난 시즌 실제로 간 횟수를 기준으로 판단하는 게 가장 현실적입니다.")]},
    "player-age": {
        "basis": "생년월일로 만 나이를 계산합니다. 연령별 대회(U-17·U-20·U-23) 자격은 각 대회가 정한 기준일에 따라 달라집니다.",
        "interp": "축구계에서 흔히 쓰는 나이는 만 나이입니다. 언론의 '몇 년생 유망주' 표기와 만 나이가 헷갈릴 때 유용합니다.",
        "faq": [("올림픽 축구는 왜 U-23인가요?", "올림픽 남자 축구는 와일드카드 3명을 제외하고 23세 이하로 출전 연령을 제한하기 때문입니다.")]},
    "wage-calc": {
        "basis": "영국 등 유럽 축구계는 급여를 주급(weekly wage)으로 발표하는 관행이 있습니다. 연봉 = 주급 × 52주, 원화 환산은 조회 시점의 실시간 환율(£→₩)을 적용합니다.",
        "interp": "언론에 보도되는 주급·연봉은 통상 세전(gross) 기준이며, 보너스·초상권 수입은 별도인 경우가 많습니다. 실수령액은 영국 소득세율(최고 45%) 등을 감안하면 크게 줄어듭니다.",
        "faq": [("주급 20만 파운드면 연봉이 얼마인가요?", "£200,000 × 52 = 연봉 £10.4m입니다. 환율 1,700원 기준 약 177억 원(세전)입니다."),
                 ("왜 유럽은 주급으로 말하나요?", "영국 축구의 오랜 급여 지급 관행에서 온 표기입니다. 스페인·이탈리아 언론은 연봉(세후 기준도 흔함)으로 쓰는 경우가 많아 비교 시 주의가 필요합니다.")]},
    "ga-point": {
        "basis": "공격포인트 = 골 + 도움. 경기당 생산성 = 공격포인트 ÷ 출전 경기.",
        "interp": "경기당 0.5포인트면 준수한 공격 자원, 1.0에 가까우면 리그 정상급 생산성이라는 게 통상적인 눈높이입니다.",
        "faq": [("도움 기준은 어디까지인가요?", "공식 기록 기준(득점 직전 마지막 패스)이 일반적이지만, 리그·기록원마다 세부 기준이 조금씩 다릅니다.")]},
}

COMMON_FAQ = [
    ("이 도구는 무료인가요?", "네. 축구창고의 모든 도구는 무료이며 회원가입 없이 바로 사용할 수 있습니다."),
    ("모바일에서도 되나요?", "네. 스마트폰 브라우저에서 동일하게 작동합니다."),
]


def build_tool_pages(tools, articles=None):
    by_cat = {}
    for t in tools:
        by_cat.setdefault(t["cat"], []).append(t)

    for t in tools:
        url = "%s/tools/%s/" % (SITE, t["id"])
        h1 = "%s %s" % (t["icon"], t["name"])
        body = ['<p class="meta"><a href="/tools/">🧰 도구 전체</a> › %s</p>' % html.escape(t["cat"]),
                "<h1>%s</h1>" % html.escape(h1),
                '<p class="lead">%s</p>' % html.escape(t["desc"]),
                '<a class="cta" href="/#%s">지금 바로 사용하기 → (무료 · 가입 없음)</a>' % t["id"],
                "<h2>사용 방법</h2>",
                '<div class="card"><p>%s</p>' % KIND_USAGE.get(t["kind"], KIND_USAGE["static"])]
        if t["kind"] == "calc" and t["fields"]:
            body.append("<p><b>입력하는 값</b></p><ul>%s</ul>"
                        % "".join("<li>%s</li>" % html.escape(f) for f in t["fields"]))
        body.append("<p>입력값으로 확인하는 축구창고의 무료 도구입니다. 회원가입·설치 없이 브라우저에서 바로 쓸 수 있습니다.</p></div>")
        if t["kind"] == "select" and t["opts"]:
            body.append("<h2>%s 전체 내용</h2>" % html.escape(t["name"]))
            rows = "".join("<tr><th>%s</th><td>%s</td></tr>"
                           % (html.escape(k), clean_answer_html(v)) for k, v in t["opts"])
            body.append('<div class="card" style="overflow-x:auto"><table><tr><th>항목</th><th>내용</th></tr>%s</table></div>' % rows)
        if t["notes"]:
            body.append("<h2>참고</h2><div class=\"card\"><ul>%s</ul></div>"
                        % "".join("<li>%s</li>" % html.escape(n) for n in t["notes"]))
        g = TOOL_GUIDE.get(t["id"], {})
        if g.get("basis"):
            body.append("<h2>계산 기준</h2><div class=\"card\"><p>%s</p></div>" % html.escape(g["basis"]))
        if g.get("interp"):
            body.append("<h2>결과 해석</h2><div class=\"card\"><p>%s</p></div>" % html.escape(g["interp"]))
        faqs = list(g.get("faq", [])) + COMMON_FAQ
        body.append("<h2>자주 묻는 질문</h2><div class=\"card\">%s</div>"
                    % "".join("<p><b>Q. %s</b><br>A. %s</p>" % (html.escape(q), html.escape(a))
                              for q, a in faqs))
        mag_keys = CAT_MAG.get(t["cat"], [])
        if articles:
            mag_links = ['<li><a href="/mag/%s/">%s</a></li>' % (k, html.escape(articles[k]["t"]))
                         for k in mag_keys if k in articles]
            if mag_links:
                body.append("<h2>관련 읽을거리</h2><div class=\"card\"><ul>%s</ul>"
                            '<p style="margin-top:6px"><a href="/mag/">킥오프 매거진 전체 →</a></p></div>'
                            % "".join(mag_links[:3]))
        rel = [r for r in by_cat.get(t["cat"], []) if r["id"] != t["id"]][:4]
        if len(rel) < 2:
            extra = [r for r in tools if r["id"] != t["id"] and r not in rel]
            rel += extra[:2 - len(rel)]
        body.append("<h2>함께 쓰면 좋은 도구</h2><div class=\"rel\">%s</div>"
                    % "".join('<a href="/tools/%s/">%s %s</a>' % (r["id"], r["icon"], html.escape(r["name"]))
                              for r in rel))
        body.append('<a class="cta" href="/#%s">%s 바로 쓰기 →</a>' % (t["id"], html.escape(t["name"])))
        jsonld = {"@context": "https://schema.org", "@type": "WebApplication",
                  "name": t["name"], "url": url, "applicationCategory": "SportsApplication",
                  "operatingSystem": "Web",
                  "offers": {"@type": "Offer", "price": "0", "priceCurrency": "KRW"},
                  "description": t["desc"]}
        title = "%s — 무료 축구 도구 | 축구창고" % t["name"]
        desc = t["desc"] or ("%s. 축구창고가 제공하는 무료 축구 도구입니다." % t["name"])
        write(os.path.join(BASE, "tools", t["id"], "index.html"),
              page(title, desc, url, "\n".join(body), jsonld, depth=2))
    log("[tools] 도구 페이지 %d개 생성" % len(tools))

    # 목차(허브)
    def tool_li(t, desc_len=60):
        return ('<li><a href="/tools/%s/">%s %s</a> — %s</li>'
                % (t["id"], t["icon"], html.escape(t["name"]), html.escape(t["desc"][:desc_len])))

    def cat_anchor(cat):
        return "cat-" + re.sub(r"[^a-z0-9]+", "-", (cat or "etc").encode("unicode_escape").decode()[:24].lower()).strip("-")

    tmap = {t["id"]: t for t in tools}
    cats_sorted = sorted(by_cat, key=lambda c: (c is None, c))
    body = ["<h1>🧰 축구 도구 허브 — 전체 %d종</h1>" % len(tools),
            '<p class="lead">축구창고의 무료 도구 전부 — 회원가입 없이 바로 사용할 수 있습니다.</p>']
    # 카테고리 빠른 이동
    body.append('<div class="rel">%s</div>'
                % "".join('<a href="#%s">%s</a>' % (cat_anchor(c), html.escape(c or "🧰 기본 도구"))
                          for c in cats_sorted))
    # ⭐ 추천 도구 (에디터 픽 — 검색·활용도 기준)
    picks = [tmap[i] for i in ["kickoff", "boot-size", "points-sim", "winrate", "fee-convert", "stud-pick"] if i in tmap]
    if picks:
        body.append("<h2>⭐ 추천 도구</h2><div class=\"card\"><ul>%s</ul></div>"
                    % "".join(tool_li(t) for t in picks))
    # 🆕 새로 나온 도구
    new_ids = ["best11", "wage-calc"]
    news_t = [tmap[i] for i in new_ids if i in tmap]
    if news_t:
        body.append("<h2>🆕 새로 나온 도구</h2><div class=\"card\"><ul>%s</ul></div>"
                    % "".join(tool_li(t) for t in news_t))
    # 🎲 오늘의 발견 (날짜 회전 — 매일 다른 도구 4종 노출)
    seed = int(TODAY.replace("-", ""))
    found = [tools[(seed * 7 + k * 13) % len(tools)] for k in range(4)]
    found = list({t["id"]: t for t in found}.values())
    body.append("<h2>🎲 오늘의 발견</h2><div class=\"card\"><ul>%s</ul>"
                '<p class="meta">매일 자정에 바뀝니다 — 몰랐던 도구를 발견해 보세요.</p></div>'
                % "".join(tool_li(t) for t in found))
    # 카테고리별 전체 목록
    for cat in cats_sorted:
        items = by_cat[cat]
        body.append("<h2 id=\"%s\">%s</h2><div class=\"card\"><ul>%s</ul></div>"
                    % (cat_anchor(cat), html.escape(cat or "🧰 기본 도구"),
                       "".join(tool_li(t) for t in items)))
    body.append('<a class="cta" href="/#tools">축구창고에서 전체 도구 열기 →</a>')
    write(os.path.join(BASE, "tools", "index.html"),
          page("무료 축구 도구 %d종 전체 목록 | 축구창고" % len(tools),
               "킥오프 한국시간 변환, 축구화 사이즈, 승점 계산 등 축구창고의 무료 도구 전체 목록입니다.",
               SITE + "/tools/", "\n".join(body)))
    log("[tools] 목차 생성")


# ──────────────────────────── 뉴스 페이지 ────────────────────────────

def latest_result(date_dir):
    files = glob.glob(os.path.join(date_dir, "수집결과*.json"))
    if not files:
        return None
    return max(files, key=os.path.getmtime)


def art_html(a):
    t = html.escape(a.get("title_src") or a.get("title") or "")
    summ = ""  # Unreviewed automated summaries are not published.
    summ = html.escape(strip_tags(summ)[:220])
    src = html.escape(a.get("source") or "")
    pub = html.escape((a.get("published") or "")[:16].replace("T", " "))
    url = html.escape(a.get("url") or "#")
    s = ['<div class="art"><h3>%s</h3>' % t]
    if summ:
        s.append("<p>%s</p>" % summ)
    s.append('<p class="meta">%s%s · <a href="%s" target="_blank" rel="noopener">원문 기사 보기 →</a></p></div>'
             % (src, (" · " + pub) if pub else "", url))
    return "".join(s)


def related_block(date, articles, tools):
    """날짜 기반으로 매거진 2편 + 도구 2종을 회전 추천 — 페이지마다 다른 내부링크"""
    if not (articles or tools):
        return ""
    seed = int(date.replace("-", ""))
    items = []
    if articles:
        keys = sorted(articles.keys())
        for k in range(2):
            key = keys[(seed + k) % len(keys)]
            items.append('<li><a href="/mag/%s/">%s</a></li>' % (key, html.escape(articles[key]["t"])))
    if tools:
        for k in range(2):
            t = tools[(seed * 3 + k) % len(tools)]
            items.append('<li><a href="/tools/%s/">%s %s</a> — %s</li>'
                         % (t["id"], t.get("icon", "🧰"), html.escape(t["name"]),
                            html.escape((t.get("desc") or "")[:50])))
    return ('<h2>📚 함께 보면 좋은 콘텐츠</h2><div class="card"><ul>%s</ul>'
            '<p style="margin-top:8px"><a href="/mag/">킥오프 매거진 전체</a> · '
            '<a href="/tools/">무료 축구 도구 전체</a></p></div>' % "".join(items))


# 뉴스 색인 정책: 최근 N일만 색인 허용(고유 콘텐츠 비율 확보 — AdSense 저가치 판정 대응).
# 오래된 날짜 페이지는 보존하되 noindex (삭제 아님, 아카이브 접근 가능)
NEWS_INDEX_DAYS = 14


def news_indexable(date):
    try:
        from datetime import datetime, timedelta
        return (datetime.strptime(TODAY, "%Y-%m-%d") - datetime.strptime(date, "%Y-%m-%d")
                ) <= timedelta(days=NEWS_INDEX_DAYS)
    except Exception:
        return True


def build_news(dates_sorted, articles=None, tools=None):
    for idx, (date, path) in enumerate(dates_sorted):
        d = json.load(open(path, encoding="utf-8"))
        body = ["<h1>📰 %s 축구 뉴스 정리</h1>" % date,
                '<p class="lead">해외축구·이적시장·국내 축구 소식을 축구창고가 정리했습니다.</p>']
        nav = []
        if idx > 0:
            nav.append('<a href="/news/%s/">← %s</a>' % (dates_sorted[idx - 1][0], dates_sorted[idx - 1][0]))
        else:
            nav.append("<span></span>")
        if idx < len(dates_sorted) - 1:
            nav.append('<a href="/news/%s/">%s →</a>' % (dates_sorted[idx + 1][0], dates_sorted[idx + 1][0]))
        else:
            nav.append("<span></span>")
        body.append('<div class="nav2">%s</div>' % "".join(nav))
        for key, label, n in [("intl", "🌍 해외축구", 8), ("transfer", "🔁 이적시장", 8),
                              ("domestic", "🇰🇷 국내 축구", 8)]:
            arts = d.get(key) or []
            if arts:
                body.append("<h2>%s</h2><div class=\"card\">%s</div>"
                            % (label, "".join(art_html(a) for a in arts[:n])))
        fx = d.get("fixtures") or []
        if fx:
            rows = "".join("<tr><td>%s</td><td>%s %s : %s %s</td><td>%s</td><td>%s</td></tr>"
                           % (html.escape(f.get("league") or f.get("tag") or ""),
                              html.escape(f.get("h", "")), html.escape(str(f.get("hs", ""))),
                              html.escape(str(f.get("as", ""))), html.escape(f.get("a", "")),
                              html.escape(f.get("date", "")),
                              "종료" if f.get("done") else "예정") for f in fx)
            body.append('<h2>⚽ 경기 결과·일정</h2><div class="card" style="overflow-x:auto">'
                        "<table><tr><th>리그</th><th>경기</th><th>일시</th><th>상태</th></tr>%s</table></div>" % rows)
        hl = d.get("highlights") or []
        if hl:
            body.append("<h2>🎬 공식 하이라이트</h2><div class=\"card\"><ul>%s</ul></div>"
                        % "".join('<li><a href="%s" target="_blank" rel="noopener">%s</a></li>'
                                  % (html.escape(h.get("l") or "#"), html.escape(h.get("t") or "")) for h in hl))
        rb = related_block(date, articles, tools)
        if rb:
            body.append(rb)
        body.append('<a class="cta" href="/#intl">실시간 축구 뉴스 더 보기 → 축구창고</a>')
        url = "%s/news/%s/" % (SITE, date)
        write(os.path.join(BASE, "news", date, "index.html"),
              page("%s 축구 뉴스 — 해외축구·이적시장·K리그 정리 | 축구창고" % date,
                   "%s 해외축구, 이적시장, 국내 축구 주요 소식 정리. 경기 결과와 공식 하이라이트까지." % date,
                   url, "\n".join(body), depth=2, noindex=not news_indexable(date)))
    log("[news] 날짜 페이지 %d개 생성" % len(dates_sorted))

    body = ["<h1>📰 날짜별 축구 뉴스</h1>",
            '<p class="lead">매일 수집·정리되는 축구 소식 아카이브입니다.</p>', '<div class="card"><ul>']
    for date, _ in reversed(dates_sorted):
        body.append('<li><a href="/news/%s/">%s 축구 뉴스 정리</a></li>' % (date, date))
    body.append("</ul></div>")
    body.append('<a class="cta" href="/#intl">오늘의 실시간 뉴스 보러 가기 →</a>')
    write(os.path.join(BASE, "news", "index.html"),
          page("날짜별 축구 뉴스 아카이브 | 축구창고",
               "해외축구·이적시장·K리그 소식을 날짜별로 정리한 축구창고 뉴스 아카이브.",
               SITE + "/news/", "\n".join(body)))
    log("[news] 목차 생성")


def build_transfer(dates_sorted):
    if not dates_sorted:
        return
    date, path = dates_sorted[-1]
    d = json.load(open(path, encoding="utf-8"))
    arts = d.get("transfer") or []
    body = ["<h1>🔁 최신 이적시장 소식</h1>",
            '<p class="lead">%s 기준 이적시장 헤드라인입니다. 외부 기사이며 이적 확정 여부는 구단 공식 발표를 확인하세요.</p>' % date,
            '<a class="cta" href="/#transfer">이적 관련 기사 더 보기 →</a>',
            '<div class="card">%s</div>' % "".join(art_html(a) for a in arts[:12]),
            '<p class="meta"><a href="/news/%s/">%s 전체 뉴스 정리 →</a></p>' % (date, date)]
    write(os.path.join(BASE, "transfer", "index.html"),
          page("이적시장 최신 소식 · 이적 관련 보도 | 축구창고",
               "오늘의 축구 이적시장 헤드라인과 외부 이적 관련 보도. 매일 갱신됩니다.",
               SITE + "/transfer/", "\n".join(body)))
    log("[transfer] 생성 (%s 기준)" % date)


# ──────────────────────────── 한국 선수 페이지 ────────────────────────────

def parse_players(src):
    """index.html의 SG_PLAYERS_DB(단일 원본, JSON 마커 사이)를 추출 — 별도 하드코딩 없음"""
    m = re.search(r"/\*SG_PLAYERS_DB_JSON\*/\s*var SG_PLAYERS_DB = (\[[\s\S]*?\]);\s*/\*END_SG_PLAYERS_DB_JSON\*/", src)
    if not m:
        log("[players] SG_PLAYERS_DB 마커 없음 — 선수 페이지 생략")
        return []
    try:
        return json.loads(m.group(1))
    except Exception as e:
        log("[players] JSON 파싱 실패(%s) — 선수 페이지 생략" % e)
        return []


# 선수별 검증된 소개문(이적 등 시점성 정보는 넣지 않음 — 소속팀은 SG_PLAYERS_DB가 단일 원본)
PLAYER_INTRO = {
    "son-heung-min": "손흥민은 대한민국을 대표하는 공격수로, 프리미어리그 토트넘에서 아시아 선수 최초로 EPL 득점왕(2021-22)에 오른 뒤 미국 MLS 무대로 활동 영역을 넓혔습니다. 대한민국 축구대표팀의 간판 스타로 오랫동안 주장을 맡아 왔습니다.",
    "lee-kang-in": "이강인은 발렌시아 유스 출신으로 2019 U-20 월드컵에서 골든볼(대회 MVP)을 수상하며 이름을 알린 미드필더입니다. 스페인 라리가와 프랑스 리그1을 거치며 성장했고, 정교한 왼발 킥과 탈압박이 강점으로 꼽힙니다.",
    "kim-min-jae": "김민재는 '괴물'이라는 별명으로 불리는 대한민국 대표팀의 핵심 센터백입니다. K리그와 중국, 튀르키예를 거쳐 이탈리아 세리에A 나폴리의 우승(2022-23)에 기여했고, 유럽 무대에서 활동해 왔습니다.",
    "hwang-hee-chan": "황희찬은 저돌적인 돌파가 강점인 공격수로, 오스트리아 잘츠부르크와 독일 분데스리가를 거쳐 프리미어리그 무대에서 활약해 온 대한민국 대표팀 공격 자원입니다.",
    "hwang-in-beom": "황인범은 대한민국 대표팀 중원의 핵심 미드필더로, 정확한 패스와 경기 조율 능력이 강점입니다. K리그에서 시작해 미국, 러시아, 그리스, 네덜란드 등 여러 리그를 경험했습니다.",
    "yang-min-hyeok": "양민혁은 강원FC에서 활동한 뒤 프리미어리그 토트넘으로 이적한 유망주 윙어입니다. 한국 축구의 차세대 공격 자원으로 꼽힙니다.",
}

# 팀명 → 리그·시청 안내(2026-27 시즌 국내 중계권 기준, watch 매거진과 동일 소스)
LEAGUE_GUIDE = {}


def build_players(players):
    if not players:
        return
    crumb_base = [
        {"@type": "ListItem", "position": 1, "name": "홈", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": "한국 선수", "item": SITE + "/players/korean/"},
    ]
    cards = []
    for p in players:
        slug, ko, en = p["slug"], p["nameKo"], p["nameEn"]
        url = "%s/players/%s/" % (SITE, slug)
        meta = " · ".join(x for x in [p.get("team"), p.get("position")] if x)
        title = "%s 최신 소식·영상 | 축구창고" % ko
        desc = "%s(%s) 최신 소식, 축구창고 영상, 관련 뉴스 모음.%s" % (ko, en, (" %s." % meta) if meta else "")
        body = ['<nav style="font-size:13px;margin:6px 0"><a href="/">홈</a> › <a href="/players/korean/">한국 선수</a> › %s</nav>' % html.escape(ko),
                "<h1>%s <small style=\"font-weight:400;color:#666\">%s</small></h1>" % (html.escape(ko), html.escape(en))]
        if meta:
            body.append("<p><b>%s</b></p>" % html.escape(meta))
        intro = PLAYER_INTRO.get(slug)
        if intro:
            body.append("<h2>선수 소개</h2><p>%s</p>" % html.escape(intro))
        lg = LEAGUE_GUIDE.get(p.get("team") or "")
        body.append("<h2>경기는 어디서 보나요?</h2>")
        if lg:
            body.append("<p>%s 소속으로 %s에서 뛰고 있습니다. %s 최신 중계권은 시즌마다 바뀔 수 있으니 <a href=\"/mag/watch/\">해외축구 합법 시청 가이드</a>에서 확인하세요.</p>"
                        % (html.escape(p["team"]), lg[0], lg[1]))
        else:
            body.append("<p>소속팀 리그의 국내 중계권은 시즌마다 바뀝니다. <a href=\"/mag/watch/\">해외축구 합법 시청 가이드</a>에서 리그별 시청 방법을 확인하세요.</p>")
        body.append("<p>새벽 경기 킥오프가 한국시간으로 몇 시인지 헷갈린다면 <a href=\"/tools/kickoff/\">킥오프 한국시간 변환기</a>가 해결해 줍니다. "
                    "중계 일정표 읽는 법은 <a href=\"/mag/calendar/\">서머타임 완전 정복</a>에서 다룹니다.</p>")
        body.append("<h2>최신 소식·영상</h2>")
        body.append('<p>%s 선수의 최신 영상·관련 뉴스는 축구창고 선수 페이지에서 모아서 볼 수 있습니다.</p>' % html.escape(ko))
        body.append('<p><a class="btn" href="/#player-%s">%s 최신 소식·영상 보러가기 →</a></p>' % (slug, html.escape(ko)))
        body.append("<h2>함께 보면 좋은 콘텐츠</h2><ul>"
                    '<li><a href="/news/">오늘의 축구 뉴스</a> — 국내 언론 기사 매일 정리</li>'
                    '<li><a href="/transfer/">이적시장</a> — 최신 이적 소식</li>'
                    '<li><a href="/mag/jersey/">유니폼 정품 vs 레플리카 구분법</a> — 응원 준비물</li>'
                    "</ul>")
        body.append('<p><a href="/players/korean/">다른 한국 선수 보기</a> · <a href="/#players">한국 선수 허브</a></p>')
        ld = [{"@context": "https://schema.org", "@type": "BreadcrumbList",
               "itemListElement": crumb_base + [{"@type": "ListItem", "position": 3, "name": ko, "item": url}]}]
        # Person 구조화 데이터는 검증된 정보(소속팀+포지션)가 있는 선수에만 적용
        if p.get("team") and p.get("position"):
            ld.append({"@context": "https://schema.org", "@type": "Person",
                       "name": en, "alternateName": ko, "url": url,
                       "affiliation": {"@type": "SportsTeam", "name": p["team"]}})
        write(os.path.join(BASE, "players", slug, "index.html"),
              page(title, desc, url, "\n".join(body), ld, depth=2))
        cards.append('<li><a href="/players/%s/"><b>%s</b> %s%s</a></li>'
                     % (slug, html.escape(ko), html.escape(en), (" — " + html.escape(meta)) if meta else ""))
    hub_url = SITE + "/players/korean/"
    hub_ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": crumb_base}
    write(os.path.join(BASE, "players", "korean", "index.html"),
          page("한국 선수 최신 소식·영상 모음 | 축구창고",
               "손흥민·이강인·김민재 등 한국 선수 %d인의 최신 소식과 축구창고 영상을 선수별로 모아 봅니다." % len(players),
               hub_url,
               "<h1>한국 선수 허브</h1><p>선수를 선택하면 최신 소식·영상 페이지로 이동합니다.</p><ul>%s</ul>"
               '<p><a class="btn" href="/#players">축구창고에서 모아서 보기 →</a></p>' % "".join(cards),
               hub_ld, depth=2))
    log("[players] 허브 1 + 선수 %d 페이지 생성" % len(players))


# ──────────────────────────── 팀 허브 ────────────────────────────
# 시점성 데이터(순위·스쿼드·우승 횟수) 미기재 원칙 — 창단연도·홈구장 등 불변 사실만 [확실]

TEAMS = [
    {"slug": "korea", "ko": "대한민국 축구대표팀", "en": "Korea Republic", "league": "국가대표",
     "stadium": "서울월드컵경기장(주 경기장)", "founded": "",
     "intro": "아시아를 대표하는 강호로, 월드컵 본선 단골 진출국입니다. 홈 A매치는 주로 서울월드컵경기장과 지방 주요 경기장에서 열립니다.",
     "match_players": ["손흥민", "이강인", "김민재", "황희찬", "황인범", "양민혁"],
     "mag": ["coachvoid", "kleague", "seats"]},
    {"slug": "tottenham", "ko": "토트넘 홋스퍼", "en": "Tottenham Hotspur", "league": "잉글랜드 프리미어리그",
     "stadium": "토트넘 홋스퍼 스타디움", "founded": "1882",
     "intro": "북런던을 연고로 하는 프리미어리그 명문으로, 손흥민이 10시즌 동안 뛰며 주장까지 맡았던 팀입니다. 현재는 양민혁이 소속돼 있어 한국 팬들의 관심이 이어지고 있습니다.",
     "match_players": ["양민혁"], "mag": ["watch", "calendar", "london"]},
    {"slug": "arsenal", "ko": "아스날", "en": "Arsenal", "league": "잉글랜드 프리미어리그",
     "stadium": "에미레이트 스타디움", "founded": "1886",
     "intro": "북런던의 전통 명문으로, 2003-04시즌 프리미어리그 무패 우승이라는 상징적인 기록을 보유하고 있습니다.",
     "match_players": [], "mag": ["watch", "calendar", "london"]},
    {"slug": "liverpool", "ko": "리버풀", "en": "Liverpool", "league": "잉글랜드 프리미어리그",
     "stadium": "안필드", "founded": "1892",
     "intro": "잉글랜드 최고 수준의 우승 전통을 가진 명문으로, 안필드의 응원 문화와 You'll Never Walk Alone으로 상징되는 팀입니다.",
     "match_players": [], "mag": ["watch", "calendar", "london"]},
    {"slug": "man-city", "ko": "맨체스터 시티", "en": "Manchester City", "league": "잉글랜드 프리미어리그",
     "stadium": "에티하드 스타디움", "founded": "1880",
     "intro": "2010년대 이후 프리미어리그 최강팀 중 하나로 자리 잡은 맨체스터 연고 구단입니다.",
     "match_players": [], "mag": ["watch", "calendar"]},
    {"slug": "man-utd", "ko": "맨체스터 유나이티드", "en": "Manchester United", "league": "잉글랜드 프리미어리그",
     "stadium": "올드 트래퍼드", "founded": "1878",
     "intro": "세계에서 가장 팬이 많은 축구 클럽 중 하나로, '꿈의 극장' 올드 트래퍼드를 홈으로 씁니다. 박지성이 뛰었던 팀으로 한국 팬들에게 특별한 의미가 있습니다.",
     "match_players": [], "mag": ["watch", "calendar"]},
    {"slug": "chelsea", "ko": "첼시", "en": "Chelsea", "league": "잉글랜드 프리미어리그",
     "stadium": "스탬퍼드 브리지", "founded": "1905",
     "intro": "런던 서부를 연고로 하는 명문으로, 2000년대 이후 잉글랜드와 유럽 무대에서 꾸준히 정상급 성적을 낸 팀입니다.",
     "match_players": [], "mag": ["watch", "calendar", "london"]},
    {"slug": "real-madrid", "ko": "레알 마드리드", "en": "Real Madrid", "league": "스페인 라리가",
     "stadium": "산티아고 베르나베우", "founded": "1902",
     "intro": "유럽 챔피언스리그 최다 우승 구단이자 세계 축구를 상징하는 클럽입니다.",
     "match_players": [], "mag": ["watch", "ucl"]},
    {"slug": "barcelona", "ko": "FC 바르셀로나", "en": "FC Barcelona", "league": "스페인 라리가",
     "stadium": "캄 노우", "founded": "1899",
     "intro": "'클럽 그 이상'이라는 모토로 유명한 카탈루냐의 상징으로, 라 마시아 유스 시스템과 패스 축구의 대명사입니다.",
     "match_players": [], "mag": ["watch", "ucl"]},
    {"slug": "atletico", "ko": "아틀레티코 마드리드", "en": "Atletico Madrid", "league": "스페인 라리가",
     "stadium": "메트로폴리타노", "founded": "1903",
     "intro": "마드리드의 또 다른 명문으로, 강한 조직력과 투쟁심의 팀 컬러로 유명합니다. 이강인이 소속돼 있어 한국 팬들의 시선이 쏠리는 팀입니다.",
     "match_players": ["이강인"], "mag": ["watch", "ucl"]},
]

LEAGUE_WATCH = {
    "잉글랜드 프리미어리그": "프리미어리그는 한국에서 쿠팡플레이가 전 경기를 중계합니다(2026-27시즌 기준). 킥오프는 주로 한국시간 밤~새벽입니다.",
    "스페인 라리가": "라리가는 한국에서 쿠팡플레이가 중계합니다(2026-27시즌 기준). 킥오프는 주로 한국시간 새벽입니다.",
    "국가대표": "A매치는 지상파·주요 스포츠 채널에서 중계하는 경우가 많습니다. 경기별 편성은 대회·방송사 발표를 확인하세요.",
}


def build_teams(players, articles):
    pmap = {p["nameKo"]: p for p in (players or [])}
    crumb_base = [
        {"@type": "ListItem", "position": 1, "name": "홈", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": "팀 정보", "item": SITE + "/teams/"},
    ]
    cards = []
    for t in TEAMS:
        url = "%s/teams/%s/" % (SITE, t["slug"])
        title = "%s — 팀 정보·한국에서 보는 법 | 축구창고" % t["ko"]
        desc = "%s(%s) 팀 소개, 한국에서 경기 보는 법, 관련 한국 선수와 축구 도구 모음." % (t["ko"], t["en"])
        body = ['<nav style="font-size:13px;margin:6px 0"><a href="/">홈</a> › <a href="/teams/">팀 정보</a> › %s</nav>' % html.escape(t["ko"]),
                "<h1>%s <small style=\"font-weight:400;color:#666\">%s</small></h1>" % (html.escape(t["ko"]), html.escape(t["en"]))]
        facts = []
        if t["league"] != "국가대표":
            facts.append("리그: %s" % t["league"])
        if t["founded"]:
            facts.append("창단: %s년" % t["founded"])
        facts.append("홈: %s" % t["stadium"])
        body.append('<p class="lead">%s</p>' % " · ".join(html.escape(f) for f in facts))
        body.append("<h2>어떤 팀인가</h2><p>%s</p>" % html.escape(t["intro"]))
        body.append("<h2>한국에서 경기 보는 법</h2><p>%s 자세한 시청 가이드는 <a href=\"/mag/watch/\">해외축구 합법 시청 방법 총정리</a>, 새벽 킥오프 환산은 <a href=\"/tools/kickoff/\">킥오프 한국시간 변환기</a>를 이용하세요.</p>"
                    % html.escape(LEAGUE_WATCH.get(t["league"], "")))
        linked = [pmap[n] for n in t["match_players"] if n in pmap]
        if linked:
            body.append("<h2>이 팀의 한국 선수</h2><ul>%s</ul>"
                        % "".join('<li><a href="/players/%s/">%s (%s)</a></li>'
                                  % (p["slug"], html.escape(p["nameKo"]), html.escape(p.get("position", "")))
                                  for p in linked))
        mag_links = ['<li><a href="/mag/%s/">%s</a></li>' % (k, html.escape(articles[k]["t"]))
                     for k in t["mag"] if k in (articles or {})]
        if mag_links:
            body.append("<h2>관련 읽을거리</h2><div class=\"card\"><ul>%s</ul></div>" % "".join(mag_links))
        body.append("<h2>함께 쓰면 좋은 도구</h2><div class=\"rel\">"
                    '<a href="/tools/kickoff/">🕐 킥오프 한국시간 변환기</a>'
                    '<a href="/tools/endtime/">⏱️ 경기 종료 시각 계산기</a>'
                    '<a href="/tools/fee-convert/">💶 이적료 원화 환산기</a></div>')
        body.append('<p><a href="/teams/">다른 팀 보기</a> · <a href="/news/">오늘의 축구 뉴스</a></p>')
        ld = [{"@context": "https://schema.org", "@type": "BreadcrumbList",
               "itemListElement": crumb_base + [{"@type": "ListItem", "position": 3, "name": t["ko"], "item": url}]},
              {"@context": "https://schema.org", "@type": "SportsTeam", "name": t["en"],
               "alternateName": t["ko"], "sport": "Soccer", "url": url}]
        write(os.path.join(BASE, "teams", t["slug"], "index.html"),
              page(title, desc, url, "\n".join(body), ld, depth=2))
        cards.append('<li><a href="/teams/%s/"><b>%s</b> %s</a></li>'
                     % (t["slug"], html.escape(t["ko"]), html.escape(t["en"])))
    hub_ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": crumb_base}
    write(os.path.join(BASE, "teams", "index.html"),
          page("축구 팀 정보 허브 — 대표팀·EPL·라리가 주요 구단 | 축구창고",
               "대한민국 대표팀부터 토트넘·레알 마드리드까지 — 팀 소개, 한국에서 보는 법, 관련 선수·도구를 팀별로 모았습니다.",
               SITE + "/teams/",
               "<h1>⚽ 팀 정보 허브</h1><p class=\"lead\">팀을 고르면 소개·시청 방법·관련 선수와 도구로 이어집니다.</p><div class=\"card\"><ul>%s</ul></div>"
               '<p><a href="/players/korean/">한국 선수 허브</a> · <a href="/mag/">킥오프 매거진</a></p>' % "".join(cards),
               hub_ld, depth=1))
    log("[teams] 허브 1 + 팀 %d 페이지 생성" % len(TEAMS))


# ──────────────────────────── 킥오프 매거진 정적화 ────────────────────────────

# 매거진 카테고리 → 관련 도구 (CAT_MAG의 역방향)
MAG_TOOLS = {
    "축구 역사": ["wc-winner", "wc-host", "ballon-hist"],
    "해외축구": ["kickoff", "endtime", "euro-clock", "fee-convert"],
    "국내축구": ["depart-time", "seasonpass-break", "kickoff"],
    "데이터": ["winrate", "ga-point", "goal-pace"],
    "생활축구": ["futsal-split", "dues-calc", "stud-pick", "pk-helper"],
    "장비": ["boot-size", "uniform", "ball-size", "marking"],
    "FM·FPL": ["fpl-budget", "pos-abbr", "formation"],
}

# 글별 작성일·(수정일) — 확인된 날짜만 기록한다(추정 날짜 기입 금지). 새 글 발행 시 여기에 추가.
MAG_DATES = {
    "coachvoid": ("2026-08-09", "2026-08-22"),  # 임시체제 확정·공개채용 반영
    "rules": ("2026-08-09", None),
    "stats": ("2026-08-09", None),
    "wchistory": ("2026-08-22", None),
    "kangin": ("2026-08-28", None),
    "youngguns": ("2026-09-02", None),
}

def parse_articles(src):
    """index.html의 ARTICLES JS 객체를 파싱 — {key: {t, cat, body(html)}}"""
    i = src.find("ARTICLES={")
    if i < 0:
        log("[mag] ARTICLES 없음 — 매거진 페이지 생략")
        return {}
    end = src.find("\n};", i)
    blk = src[i:end]
    out = {}
    pat = re.compile(r'(\w+):\{t:"((?:[^"\\]|\\.)*)",cat:"((?:[^"\\]|\\.)*)",body:\n((?:"(?:[^"\\]|\\.)*"(?:\n\+)?)+)\}')
    for m in pat.finditer(blk):
        key, t, cat, raw = m.group(1), m.group(2), m.group(3), m.group(4)
        segs = re.findall(r'"((?:[^"\\]|\\.)*)"', raw)
        body = "".join(segs).replace('\\"', '"').replace("\\\\", "\\")
        out[key] = {"t": t, "cat": cat, "body": body}
    log("[mag] 매거진 글 %d편 파싱" % len(out))
    return out


def _mag_fix_links(body, tool_ids):
    """본문 내 SPA 전용 링크를 정적 URL로 변환"""
    body = re.sub(r'href=["\']#["\']\s+onclick="return openArticle\(\'(\w+)\'\)"',
                  r'href="/mag/\1/"', body)

    def tool_href(m):
        tid = m.group(1)
        if tid in tool_ids:
            return 'href="/tools/%s/"' % tid
        return 'href="https://chukguchanggo.com/#tools"'

    body = re.sub(r'href=["\']#["\']\s+onclick="return navToolA\(\'([\w-]+)\'\)"', tool_href, body)
    return clean_answer_html(body)


def build_mag(articles, tools):
    if not articles:
        return
    tool_ids = {t["id"] for t in tools}
    cards = {}
    for key, a in articles.items():
        url = "%s/mag/%s/" % (SITE, key)
        title = "%s | 킥오프 매거진 - 축구창고" % a["t"]
        tmp = re.sub(r"<[^>]+>", " ", a["body"])
        desc = re.sub(r"\s+", " ", tmp).strip()[:150]
        body_html = _mag_fix_links(a["body"], tool_ids)
        art_ld = {"@context": "https://schema.org", "@type": "Article",
                  "headline": a["t"], "articleSection": a["cat"],
                  "author": {"@type": "Organization", "name": "축구창고"},
                  "publisher": {"@type": "Organization", "name": "축구창고",
                                "logo": {"@type": "ImageObject", "url": SITE + "/brand-logo.png"}},
                  "mainEntityOfPage": url}
        dt = (MAG_DATES.get(key, ("2026-09-08", None))[0], "2026-09-08")
        if dt:
            art_ld["datePublished"] = dt[0]
            art_ld["dateModified"] = dt[1] or dt[0]
        ld = [
            art_ld,
            {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "홈", "item": SITE + "/"},
                {"@type": "ListItem", "position": 2, "name": "킥오프 매거진", "item": SITE + "/mag/"},
                {"@type": "ListItem", "position": 3, "name": a["t"], "item": url}]},
        ]
        date_line = ""
        if dt:
            date_line = " · 작성 %s" % dt[0]
            if dt[1] and dt[1] != dt[0]:
                date_line += " · 수정 %s" % dt[1]
        # 다음 읽을 글: 같은 카테고리 우선, 부족하면 다른 카테고리로 채움 (최대 3)
        same = [k for k, v in articles.items() if k != key and v["cat"] == a["cat"]]
        others = [k for k, v in articles.items() if k != key and v["cat"] != a["cat"]]
        next_keys = (same + others)[:3]
        next_html = "".join('<li><a href="/mag/%s/">%s</a></li>'
                            % (k, html.escape(articles[k]["t"])) for k in next_keys)
        # 관련 도구: 카테고리 매핑에서 실존 도구만 (최대 3)
        rel_tools = [i for i in MAG_TOOLS.get(a["cat"], []) if i in tool_ids][:3]
        tools_by_id = {t["id"]: t for t in tools}
        tool_html = "".join('<a href="/tools/%s/">%s %s</a>'
                            % (i, tools_by_id[i].get("icon", "🧰"), html.escape(tools_by_id[i]["name"]))
                            for i in rel_tools)
        explore = "<h2>📖 다음 읽을 글</h2><div class=\"card\"><ul>%s</ul></div>" % next_html
        if tool_html:
            explore += "<h2>🧰 이 주제의 도구</h2><div class=\"rel\">%s</div>" % tool_html
        page_body = ('<nav style="font-size:13px;margin:6px 0"><a href="/">홈</a> › '
                     '<a href="/mag/">킥오프 매거진</a> › %s</nav>'
                     '<p style="color:#888;font-size:13px">%s | 킥오프 매거진%s</p>'
                     "<h1>%s</h1>\n%s\n"
                     '<hr style="border:none;border-top:1px solid #eee;margin:26px 0">'
                     "%s"
                     '<p><a class="btn" href="/mag/">📖 매거진 다른 글 보기</a> '
                     '<a class="btn" href="/tools/">🧰 무료 축구 도구</a></p>'
                     % (html.escape(a["cat"]), html.escape(a["cat"]), date_line,
                        html.escape(a["t"]), body_html, explore))
        write(os.path.join(BASE, "mag", key, "index.html"),
              page(title, desc, url, page_body, ld, depth=2))
        cards.setdefault(a["cat"], []).append(
            '<li><a href="/mag/%s/"><b>%s</b></a></li>' % (key, html.escape(a["t"])))

    toc = ""
    for cat in sorted(cards):
        toc += "<h2>%s</h2><ul>%s</ul>" % (html.escape(cat), "".join(cards[cat]))
    hub_ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "홈", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": "킥오프 매거진", "item": SITE + "/mag/"}]}
    write(os.path.join(BASE, "mag", "index.html"),
          page("킥오프 매거진 — 축구 가이드·분석 %d편 | 축구창고" % len(articles),
               "해외축구 시청법, 축구화 고르는 법, xG 읽는 법까지 — 축구창고가 직접 쓰는 축구 가이드 모음.",
               SITE + "/mag/",
               "<h1>킥오프 매거진</h1><p>축구를 즐길 때 참고할 가이드입니다. 내용별 기준과 공식 안내를 함께 확인하세요.</p>" + toc,
               hub_ld, depth=1))
    log("[mag] 목차 1 + 글 %d 페이지 생성" % len(articles))


# ──────────────────────────── sitemap ────────────────────────────

def build_sitemap(tools, dates, player_slugs=None, mag_keys=None):
    urls = [("/", TODAY), ("/links", TODAY), ("/tools/", TODAY),
            ("/news/", TODAY), ("/transfer/", TODAY),
            ("/about.html", TODAY), ("/contact.html", TODAY), ("/terms.html", TODAY)]
    urls += [("/tools/%s/" % t["id"], TODAY) for t in tools]
    urls += [("/news/%s/" % d, d) for d in dates if news_indexable(d)]
    if player_slugs:
        urls += [("/players/korean/", TODAY)]
        urls += [("/players/%s/" % s, TODAY) for s in player_slugs]
    if mag_keys:
        urls += [("/mag/", TODAY)]
        urls += [("/mag/%s/" % k, TODAY) for k in mag_keys]
    urls += [("/teams/", TODAY)]
    urls += [("/teams/%s/" % t["slug"], TODAY) for t in TEAMS]
    items = "".join("<url><loc>%s%s</loc><lastmod>%s</lastmod></url>\n" % (SITE, u, lm)
                    for u, lm in urls)
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % items)
    write(os.path.join(BASE, "sitemap.xml"), xml)
    log("[sitemap] URL %d개" % len(urls))


# ──────────────────────────── main ────────────────────────────

def copy_brand_logo():
    import shutil
    src_logo = os.path.join(BASE, "유튜브", "브랜딩", "축구창고_SNS_원형로고.png")
    dst = os.path.join(BASE, "brand-logo.png")
    # 이미 최적화본(100KB 이하)이 있으면 유지 — 1.2MB 원본으로 되돌리지 않는다
    if os.path.exists(dst) and os.path.getsize(dst) <= 100 * 1024:
        return
    if os.path.exists(src_logo):
        try:
            from PIL import Image
            im = Image.open(src_logo).convert("RGBA")
            im = im.resize((256, 256), Image.LANCZOS)
            im.quantize(colors=256, method=Image.FASTOCTREE).save(dst, optimize=True)
        except Exception:
            pass  # PIL 없으면 기존 파일 유지(1.2MB 원본 복사 금지)
        log("[brand] brand-logo.png 갱신")
    else:
        log("[brand] 브랜딩 로고 원본 없음 — 기존 brand-logo.png 유지")


def main():
    copy_brand_logo()
    src = load_index()
    static = parse_static_tools(src)
    mini = parse_mini_tools(src)
    cats = parse_core_cats(src)
    for t in static:
        t["cat"] = cats.get(t["id"], "🧰 기본 도구")
    tools = static + mini
    log("[parse] 정적 %d + 미니 %d = 활성 도구 %d종" % (len(static), len(mini), len(tools)))
    if len(tools) < 40:
        print("경고: 추출된 도구가 %d개뿐입니다. index.html 구조 변경 여부를 확인하세요." % len(tools))

    articles = parse_articles(src)
    build_tool_pages(tools, articles)

    dates = []
    if os.path.isdir(DATA_DIR):
        for name in sorted(os.listdir(DATA_DIR)):
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", name):
                p = latest_result(os.path.join(DATA_DIR, name))
                if p:
                    dates.append((name, p))
    if dates:
        build_news(dates, articles, tools)
        build_transfer(dates)
    else:
        log("[news] 수집 데이터 없음 — 뉴스 페이지 생략")

    players = parse_players(src)
    build_players(players)

    build_teams(players, articles)

    build_mag(articles, tools)

    build_sitemap(tools, [d for d, _ in dates], [p["slug"] for p in players],
                  sorted(articles.keys()))
    log("완료 ✓")
    return 0


if __name__ == "__main__":
    sys.exit(main())
