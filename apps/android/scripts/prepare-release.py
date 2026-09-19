"""Validate a signed APK and prepare a GitHub asset plus the Pages update manifest.

No signing key/password is read, copied or uploaded by this script.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--apk", type=Path, default=ROOT / "app/build/outputs/apk/release/app-release.apk")
parser.add_argument("--notes", type=Path, default=ROOT / "release-notes.md")
parser.add_argument("--sdk", type=Path, default=Path(os.environ.get("ANDROID_HOME", os.environ.get("ANDROID_SDK_ROOT", str(Path.home() / "AppData/Local/Android/Sdk")))))
args = parser.parse_args()
tools = sorted((args.sdk / "build-tools").iterdir(), key=lambda p: tuple(int(n) for n in re.findall(r"\d+", p.name)))[-1]
suffix = ".bat" if os.name == "nt" else ""
certs = subprocess.check_output([str(tools / ("apksigner" + suffix)), "verify", "--print-certs", str(args.apk)], text=True)
expected = "c6c216827cfc5d2e43749a230245c92fddc4647c0c6dc392b7cb12196fd4489c"
if f"certificate SHA-256 digest: {expected}" not in certs:
    raise SystemExit("APK does not use the existing Garden Lab Online release key")
aapt = str(tools / ("aapt2.exe" if os.name == "nt" else "aapt2"))
badging = subprocess.check_output([aapt, "dump", "badging", str(args.apk)], text=True, encoding="utf-8")
package = re.search(r"package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'", badging)
if not package or package[1] != "com.gardenlab.online":
    raise SystemExit("Unexpected APK package")
code, version = int(package[2]), package[3]
if not re.fullmatch(r"\d+\.\d+\.\d+", version):
    raise SystemExit("Only stable x.y.z versions may be published")
public_manifest = ROOT.parent / "site/public/android/update.json"
apk_bytes = args.apk.read_bytes()
if public_manifest.exists():
    previous = json.loads(public_manifest.read_text(encoding="utf-8"))
    identical = code == previous["versionCode"] and hashlib.sha256(apk_bytes).hexdigest() == previous["sha256"]
    if code <= previous["versionCode"] and not identical:
        raise SystemExit("Increment versionCode before preparing another release")
if not 0 < len(apk_bytes) <= 50 * 1024 * 1024:
    raise SystemExit("APK outside supported size range")
notes = args.notes.read_text(encoding="utf-8").strip()
if len(notes) > 4000:
    raise SystemExit("Release notes exceed the app's limit")
name = f"Garden-Lab-{version}.apk"
manifest = {
    "versionCode": code,
    "versionName": version,
    "minSdk": int(re.search(r"(?:minSdkVersion|sdkVersion):'(\d+)'", badging)[1]),
    "apkUrl": f"https://github.com/ffffhx/garden-lab/releases/download/android-v{version}/{name}",
    "sizeBytes": len(apk_bytes),
    "sha256": hashlib.sha256(apk_bytes).hexdigest(),
    "releaseNotes": notes,
}
dist = ROOT / "dist"
dist.mkdir(exist_ok=True)
shutil.copyfile(args.apk, dist / name)
encoded = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
(dist / "update.json").write_text(encoded, encoding="utf-8")
public_manifest.parent.mkdir(parents=True, exist_ok=True)
public_manifest.write_text(encoded, encoding="utf-8")
print(f"Prepared {name}, code {code}, {len(apk_bytes)} bytes")
print("Upload the APK to the matching GitHub release BEFORE publishing public/android/update.json.")
