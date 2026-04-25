#!/usr/bin/env python3
"""
Home Hub - Build Script
Assembles source files into a single deployable HTML file.
All source files live flat at the project root (no src/ subdirectory).

Usage:
    python build.py               -> App_V6_29.html (minified)
    python build.py --dev         -> unminified build for debugging
    python build.py --version=6.30 -> force specific version
"""

import os, sys, re, datetime

ROOT    = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = ROOT

JS_FILES = [
    "01-core.js", "02-dashboard.js", "03-finance.js",
    "04-planning.js", "05-household.js", "06-insights.js", "07-upload.js",
]

def read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    lines = len(content.splitlines())
    size  = len(content.encode("utf-8"))
    print("  Written: {}  ({:,} lines, {:.1f} KB)".format(
        os.path.basename(path), lines, size / 1024))

def next_version():
    pattern = re.compile(r"App_V(\d+)_(\d+)\.html")
    maj, mn = 6, 27
    for fname in os.listdir(OUT_DIR):
        m = pattern.match(fname)
        if m:
            mj, mi = int(m.group(1)), int(m.group(2))
            if (mj, mi) > (maj, mn):
                maj, mn = mj, mi
    return maj, mn + 1

def minify_js(src):
    """Conservative JS minifier - pure Python stdlib."""
    # Step 1: remove block comments /* ... */ but keep /*! licence headers
    cleaned = []
    i, n = 0, len(src)
    while i < n:
        if src[i:i+3] == "/*!":
            end = src.find("*/", i + 3)
            if end == -1:
                cleaned.append(src[i:]); break
            cleaned.append(src[i:end + 2]); i = end + 2
        elif src[i:i+2] == "/*":
            end = src.find("*/", i + 2)
            if end == -1:
                cleaned.append(src[i:]); break
            cleaned.append(" "); i = end + 2
        else:
            cleaned.append(src[i]); i += 1
    src = "".join(cleaned)

    # Step 2: remove full-line // comments
    kept = []
    for line in src.split("\n"):
        if not line.strip().startswith("//"):
            kept.append(line)
    src = "\n".join(kept)

    # Step 3: collapse 3+ blank lines to 1
    src = re.sub(r"\n{3,}", "\n\n", src)
    return src

def minify_css(src):
    """CSS minifier - removes comments and excess blank lines."""
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.DOTALL)
    src = re.sub(r"\n{3,}", "\n\n", src)
    return src

def build(version_str=None, dev_mode=False):
    print("\nHome Hub Build Script")
    print("=" * 44)

    if version_str:
        parts = version_str.split(".")
        major, minor = int(parts[0]), int(parts[1])
    else:
        major, minor = next_version()

    out_filename  = "App_V{}_{}.html".format(major, minor)
    out_path      = os.path.join(OUT_DIR, out_filename)
    version_label = "{}.{}".format(major, minor)

    print("  Target : V{}".format(version_label))
    print("  File   : {}".format(out_filename))
    print("  Mode   : {}".format("DEV (unminified)" if dev_mode else "PROD (minified)"))
    print("  Time   : {}".format(datetime.datetime.now().strftime("%Y-%m-%d %H:%M")))
    print()

    css    = read(os.path.join(ROOT, "style.css"))
    shell  = read(os.path.join(ROOT, "shell.html"))
    modals = read(os.path.join(ROOT, "modals.html"))
    tail   = read(os.path.join(ROOT, "tail.html"))

    js_parts = []
    for fname in JS_FILES:
        raw = read(os.path.join(ROOT, fname))
        js_parts.append("// -- {} ".format(fname) + "-" * (60 - len(fname)) + "\n")
        js_parts.append(raw)
        js_parts.append("\n")
    js_combined = "\n".join(js_parts)

    js_raw  = len(js_combined.encode("utf-8"))
    css_raw = len(css.encode("utf-8"))

    if not dev_mode:
        print("  Minifying...")
        js_combined = minify_js(js_combined)
        css         = minify_css(css)
        js_min  = len(js_combined.encode("utf-8"))
        css_min = len(css.encode("utf-8"))
        print("  JS:  {:6.1f} KB -> {:.1f} KB  (saved {:.1f} KB)".format(
            js_raw/1024, js_min/1024, (js_raw-js_min)/1024))
        print("  CSS: {:6.1f} KB -> {:.1f} KB  (saved {:.1f} KB)".format(
            css_raw/1024, css_min/1024, (css_raw-css_min)/1024))
        print()
    else:
        print("  JS:  {:.1f} KB  (unminified)".format(js_raw/1024))
        print("  CSS: {:.1f} KB  (unminified)".format(css_raw/1024))
        print()

    # Inject CSS (lambda avoids backslash issues in replacement string)
    css_block = "<style>\n" + css + "\n</style>"
    shell = re.sub(r"<style>.*?</style>", lambda m: css_block,
                   shell, count=1, flags=re.DOTALL)

    # Inline Chart.js
    chart_path = os.path.join(ROOT, "chart.umd.min.js")
    if os.path.exists(chart_path):
        chart_js  = read(chart_path)
        chart_kb  = len(chart_js.encode("utf-8")) / 1024
        chart_blk = "<script>\n" + chart_js + "\n</script>"
        shell = re.sub(r"<script[^>]+Chart\.js[^>]*></script>",
                       lambda m: chart_blk, shell)
        print("  Chart.js inlined: {:.1f} KB".format(chart_kb))
    else:
        print("  WARNING: chart.umd.min.js not found - CDN fallback active")

    # Assemble
    output = (shell + "\n\n" + modals
              + "\n\n<script>\n" + js_combined
              + "\n</script>\n\n" + tail + "\n</html>")

    # Version stamp - broad replace across entire output
    vl = version_label
    output = re.sub(r"Home Hub V\d+\.\d+", "Home Hub V" + vl, output)
    output = re.sub(r"_version:\s*\'[\d.]+'", "_version: '" + vl + "'", output)
    output = re.sub(r"badge\.textContent\s*=\s*\'v[\d.]+\';",
                    "badge.textContent = \'v" + vl + "\';", output)

    write_file(out_path, output)

    lines   = output.count("\n") + 1
    size_kb = len(output.encode("utf-8")) / 1024
    tag     = "(under 600 KB target)" if size_kb < 600 else "(WARNING: over 600 KB)"
    print()
    print("Build complete!")
    print("  File : {}".format(out_filename))
    print("  Lines: {:,}".format(lines))
    print("  Size : {:.1f} KB  {}".format(size_kb, tag if not dev_mode else ""))
    print()
    return out_path

if __name__ == "__main__":
    dev_mode    = "--dev" in sys.argv
    version_arg = None
    args = sys.argv[1:]
    for idx, arg in enumerate(args):
        if arg.startswith("--version="):
            version_arg = arg.split("=", 1)[1]
        elif arg == "--version" and idx + 1 < len(args):
            version_arg = args[idx + 1]
    build(version_arg, dev_mode=dev_mode)
