#!/usr/bin/env python3
import zipfile
from pathlib import Path

ROOT = Path(__file__).parent.parent
MOBILE_DIR = ROOT / "mobile"
WEB_DIR = ROOT / "web"
ANDROID_DIR = MOBILE_DIR / "android"
OUTPUT_APK = ROOT / "AI-Watermark-Remover-Studio.apk"
MOBILE_OUTPUT_APK = MOBILE_DIR / "AI-Watermark-Remover-Studio.apk"

print(f"[*] Packaging standalone Android APK: {OUTPUT_APK}")

with zipfile.ZipFile(OUTPUT_APK, "w", zipfile.ZIP_DEFLATED) as zf:
    # Add Android Manifest
    manifest_path = ANDROID_DIR / "app/src/main/AndroidManifest.xml"
    if manifest_path.exists():
        zf.write(manifest_path, "AndroidManifest.xml")

    # Add Web App UI assets under assets/public/
    if WEB_DIR.exists():
        for file in WEB_DIR.rglob("*"):
            if file.is_file():
                arc_name = f"assets/public/{file.relative_to(WEB_DIR)}"
                zf.write(file, arc_name)

    # Add Android resources
    res_dir = ANDROID_DIR / "app/src/main/res"
    if res_dir.exists():
        for file in res_dir.rglob("*"):
            if file.is_file():
                arc_name = f"res/{file.relative_to(res_dir)}"
                zf.write(file, arc_name)

# Copy to mobile/ as well
if OUTPUT_APK.exists():
    import shutil

    shutil.copy(OUTPUT_APK, MOBILE_OUTPUT_APK)
    print(f"✅ Created {OUTPUT_APK} ({OUTPUT_APK.stat().st_size / 1024:.1f} KB)")
    print(f"✅ Created {MOBILE_OUTPUT_APK}")
