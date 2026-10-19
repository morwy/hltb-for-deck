import asyncio
from functools import lru_cache
import json
import os
from pathlib import Path
import re
import ssl
import time
import urllib.request
import decky

REPO = "morwy/hltb-for-deck"
ASSET_NAME = "hltb-for-deck.zip"
TAG = re.compile(r"^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
MARKER_TTL = 300

CA_FILES = (
    "/etc/ssl/certs/ca-certificates.crt",
    "/etc/ca-certificates/extracted/tls-ca-bundle.pem",
    "/etc/pki/tls/certs/ca-bundle.crt",
)


@lru_cache(maxsize=1)
def _ssl_context():
    context = ssl.create_default_context()
    for filename in CA_FILES:
        if Path(filename).is_file():
            try:
                context.load_verify_locations(cafile=filename)
            except (OSError, ssl.SSLError):
                continue
    return context


def _path(name: str) -> str:
    return os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, name)


def _read_json(path: str):
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _write_json(path: str, value):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp_path = path + ".tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(value, f)
    os.replace(temp_path, path)


def current_version() -> str:
    try:
        pkg_path = os.path.join(decky.DECKY_PLUGIN_DIR, "package.json")
        return str(_read_json(pkg_path).get("version", "unknown"))
    except Exception:
        return "unknown"


def version_key(version: str):
    match = TAG.fullmatch("v" + version if not version.startswith("v") else version)
    if not match:
        raise ValueError(f"Invalid semver version: {version}")
    return tuple(map(int, match.groups()))


def expected_asset_url(version: str) -> str:
    version_key(version)
    clean_ver = version[1:] if version.startswith("v") else version
    return f"https://github.com/{REPO}/releases/download/v{clean_ver}/{ASSET_NAME}"


def normalise_releases(raw_releases):
    releases = {}
    for release in raw_releases:
        if not isinstance(release, dict):
            continue
        tag = str(release.get("tag_name", ""))
        if not TAG.fullmatch(tag) or release.get("draft") or release.get("prerelease"):
            continue
        version = tag[1:]
        url = expected_asset_url(version)
        asset = next(
            (
                a
                for a in (release.get("assets") or [])
                if a.get("name") == ASSET_NAME and a.get("browser_download_url") == url
            ),
            None,
        )
        if asset is None:
            continue
        releases[tag] = {
            "tag": tag,
            "version": version,
            "assetUrl": url,
            "notes": str(release.get("body") or ""),
            "publishedAt": str(release.get("published_at") or ""),
        }
    return sorted(releases.values(), key=lambda r: version_key(r["version"]), reverse=True)


def check_updates_sync():
    current = current_version()
    result = {
        "success": False,
        "currentVersion": current,
        "releases": [],
        "latest": None,
        "updateAvailable": False,
        "stale": False,
    }
    cache_file = _path("plugin-releases-cache.json")
    try:
        raw = []
        for page in range(1, 4):
            req = urllib.request.Request(
                f"https://api.github.com/repos/{REPO}/releases?per_page=100&page={page}",
                headers={
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "HLTB-For-Deck/updater",
                },
            )
            with urllib.request.urlopen(req, timeout=20, context=_ssl_context()) as response:
                batch = json.load(response)
            if not isinstance(batch, list):
                raise ValueError("GitHub returned an invalid release list")
            raw.extend(batch)
            if len(batch) < 100:
                break
        releases = normalise_releases(raw)
        result.update(success=True, releases=releases)
        try:
            _write_json(cache_file, {"raw": raw, "checkedAt": time.time()})
        except OSError:
            pass
    except Exception as exc:
        decky.logger.warning(f"HLTB update check failed: {exc}")
        cached = _read_json(cache_file)
        result.update(
            error=f"Could not check GitHub: {exc}",
            stale=True,
            releases=normalise_releases(cached.get("raw", [])),
            checkedAt=cached.get("checkedAt"),
        )

    releases = result["releases"]
    if releases:
        result["latest"] = releases[0]
        try:
            result["updateAvailable"] = version_key(releases[0]["version"]) > version_key(current)
        except ValueError:
            pass
    return result


class Plugin:
    async def plugin_update_status(self):
        return await asyncio.get_running_loop().run_in_executor(None, check_updates_sync)

    async def plugin_prepare_replacement(self, version: str, url: str):
        try:
            if url != expected_asset_url(version):
                raise ValueError("Refusing untrusted plugin package URL")
            _write_json(
                _path("decky-replacement.json"),
                {"createdAt": time.time(), "version": version, "url": url},
            )
            return {"success": True}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def plugin_cancel_replacement(self):
        try:
            os.remove(_path("decky-replacement.json"))
        except FileNotFoundError:
            pass
        return True

    async def _main(self):
        await self.plugin_cancel_replacement()
        decky.logger.info("HLTB backend initialized")