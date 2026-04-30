#!/usr/bin/env python3
"""
Home Hub - GitHub Pages Deploy Script

Usage:
    python deploy_github.py           -> creates index.html redirect, prints instructions
    python deploy_github.py --push    -> also git add, commit, and push automatically

Prerequisite: run  python build.py  first to produce a fresh App_VX_Y.html
"""

import os, re, sys, subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))

def find_latest_app():
    """Return (major, minor, filename) for the highest-versioned App_VX_Y.html."""
    pattern = re.compile(r"App_V(\d+)_(\d+)\.html")
    best_maj, best_min, best_name = 0, 0, None
    for fname in os.listdir(ROOT):
        m = pattern.match(fname)
        if m:
            mj, mi = int(m.group(1)), int(m.group(2))
            if (mj, mi) > (best_maj, best_min):
                best_maj, best_min, best_name = mj, mi, fname
    return best_maj, best_min, best_name

def write_redirect(app_filename):
    """Write index.html that auto-redirects to the latest app file."""
    content = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url={app}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Home Hub</title>
  <style>
    body {{ font-family: sans-serif; display: flex; justify-content: center;
           align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }}
    a {{ color: #6366f1; font-size: 16px; }}
  </style>
</head>
<body>
  <a href="{app}">Click here if not redirected automatically</a>
</body>
</html>
""".format(app=app_filename)
    index_path = os.path.join(ROOT, "index.html")
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("  Created: index.html  (redirects to {})".format(app_filename))
    return index_path

def git_push(app_filename, version_label):
    """Stage, commit, and push the app file + index.html."""
    try:
        subprocess.run(["git", "add", "-f", app_filename, "index.html"], cwd=ROOT, check=True)
        msg = "Deploy Home Hub v{}".format(version_label)
        subprocess.run(["git", "commit", "-m", msg], cwd=ROOT, check=True)
        subprocess.run(["git", "push"], cwd=ROOT, check=True)
        print("\n  Git push successful!")
    except FileNotFoundError:
        print("\n  ERROR: git not found. Install Git and try again.")
    except subprocess.CalledProcessError as e:
        print("\n  ERROR during git operation: {}".format(e))
        print("  Try running the git commands manually (see instructions above).")

def main():
    do_push = "--push" in sys.argv

    print("\nHome Hub — GitHub Pages Deploy")
    print("=" * 44)

    major, minor, app_file = find_latest_app()
    if not app_file:
        print("  ERROR: No App_VX_Y.html found in this folder.")
        print("  Run  python build.py  first, then try again.")
        sys.exit(1)

    version_label = "{}.{}".format(major, minor)
    print("  Latest build : {} (v{})".format(app_file, version_label))

    write_redirect(app_file)

    print()
    print("GitHub Pages setup (one-time, if not done yet):")
    print("-" * 44)
    print("  1. Push this folder to a GitHub repo")
    print("     Matt's repo: https://github.com/msindall/HomeHub")
    print("  2. Go to:  Settings → Pages")
    print("     Source: main branch, / (root folder)")
    print("  3. Your app will be live at:")
    print("     https://msindall.github.io/HomeHub/")
    print("  4. index.html auto-redirects to the latest version.")
    print()
    print("To deploy manually (if not using --push):")
    print("  git add -f {} index.html".format(app_file))
    print("  git commit -m \"Deploy Home Hub v{}\"".format(version_label))
    print("  git push")
    print()

    if do_push:
        print("  --push flag detected. Running git push now...")
        git_push(app_file, version_label)
    else:
        print("  Tip: run  python deploy_github.py --push  to push automatically.")

    print()

if __name__ == "__main__":
    main()
