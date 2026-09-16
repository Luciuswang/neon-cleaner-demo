"""Download CC0 Poly Haven PBR sources; idempotent checksum manifest, no secrets."""
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.local/assets/surfaces'
MANIFEST = ROOT / 'docs/assets/cinematic-surfaces.json'
HEADERS = {'User-Agent': 'NeonCleaner/1.0 (asset-research)'}


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    assets = []
    for asset, metres in [('asphalt_02', 3), ('concrete_wall_006', 2)]:
        request = urllib.request.Request('https://api.polyhaven.com/files/' + asset, headers=HEADERS)
        metadata = json.load(urllib.request.urlopen(request, timeout=60))
        for channel, ext in [('diff', 'jpg'), ('rough', 'jpg'), ('nor_dx', 'png')]:
            record = metadata[{'diff': 'Diffuse', 'rough': 'Rough', 'nor_dx': 'nor_dx'}[channel]]['4k'][ext]
            url = record['url']
            path = CACHE / url.rsplit('/', 1)[-1]
            if not path.exists() or path.stat().st_size != record['size']:
                temporary = path.with_suffix('.download')
                with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=120) as response:
                    temporary.write_bytes(response.read())
                if temporary.stat().st_size != record['size']:
                    raise RuntimeError('Incomplete download: ' + url)
                temporary.replace(path)
            assets.append(dict(asset=asset, channel=channel, tile_metres=metres,
                               license='CC0-1.0', license_url='https://polyhaven.com/license',
                               source_url='https://polyhaven.com/a/' + asset, download_url=url,
                               source=str(path.relative_to(ROOT)).replace('\\', '/'),
                               bytes=path.stat().st_size, sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                               ue_path='/Game/CinematicSurfaces/' + path.stem))
            print(asset, channel, path.stat().st_size, flush=True)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(dict(schema=1, sources=assets), indent=2) + '\n', encoding='utf8')


if __name__ == '__main__':
    main()
