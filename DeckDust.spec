# PyInstaller onedir build. WebView2 is provided by the Windows runtime.
from PyInstaller.utils.hooks import collect_all

datas = [("web-dist", "web-dist"), ("hearthstone_cards_latest.json", ".")]
binaries = []
hiddenimports = []
for package in ("webview", "clr_loader", "pythonnet", "psycopg", "psycopg_binary", "psycopg_c"):
    try:
        package_datas, package_binaries, package_hidden = collect_all(package)
        datas += package_datas
        binaries += package_binaries
        hiddenimports += package_hidden
    except Exception:
        pass

a = Analysis(
    ["desktop_app.py"],
    pathex=["."],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name="DeckDust", console=False,
          icon="assets/app-icons/deck-dust.ico")
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=True, name="DeckDust")

