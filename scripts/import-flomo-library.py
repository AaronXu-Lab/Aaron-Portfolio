"""Import the supplied Swift catalog snapshot, without executing source code.
Usage: python3 scripts/import-flomo-library.py /path/to/FlomoComponents/FlomoComponents
"""
from pathlib import Path
import base64
import json
import re
import sys

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
target = root / 'src/design-libraries/flomo/catalog.json'
assets = root / 'public/design-libraries/flomo'
assets.mkdir(parents=True, exist_ok=True)

def record(line):
    # Generated Swift records contain only named fields, literals and arrays.
    tokens = re.findall(r'"(?:\\.|[^"\\])*"|\.init|[A-Za-z_][\w]*|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|[][():,]', line)
    pos = 0
    def parse():
        nonlocal pos
        token = tokens[pos]
        pos += 1
        if token == '.init':
            assert tokens[pos] == '('
            pos += 1
            result = {}
            while tokens[pos] != ')':
                key = tokens[pos]
                assert tokens[pos + 1] == ':'
                pos += 2
                result[key] = parse()
                if tokens[pos] == ',': pos += 1
            pos += 1
            return result
        if token == '[':
            result = []
            while tokens[pos] != ']':
                result.append(parse())
                if tokens[pos] == ',': pos += 1
            pos += 1
            return result
        if token == 'nil': return None
        if token in ('true', 'false'): return token == 'true'
        return json.loads(token)
    return parse()

def records(file):
    text = (source/file).read_text()
    result = []
    for match in re.finditer(r'\.init\(id:', text):
        start = match.start()
        depth = 0
        quoted = False
        escaped = False
        for index in range(start, len(text)):
            char = text[index]
            if quoted:
                if escaped: escaped = False
                elif char == '\\': escaped = True
                elif char == '"': quoted = False
            elif char == '"': quoted = True
            elif char == '(': depth += 1
            elif char == ')':
                depth -= 1
                if depth == 0:
                    result.append(record(text[start:index+1]))
                    break
    return result

variables = records('FigmaVariables.generated.swift')
components = records('FigmaComponents.generated.swift')
styles = records('FigmaStyles.generated.swift')
families = []
s = (source/'DesignInventory.swift').read_text().split('static let componentFamilies:')[1].split('static let componentFamilyCount')[0]
for block in re.findall(r'\.init\((.*?)\)', s, re.S):
    fields = dict(re.findall(r'(id|name|nodeID|note):\s*("(?:\\.|[^"\\])*")', block))
    if len(fields) >= 3:
        families.append({k: json.loads(v) for k,v in fields.items()})
icons = {}
for file in sorted((source/'Assets.xcassets').glob('*.imageset/*.svg')):
    (assets/file.name).write_text(file.read_text().rstrip() + '\n')
    icons[file.stem.replace('FigmaIcon_', '').replace('_', ':')] = '/design-libraries/flomo/' + file.name
rasters = {}
for name, encoded in re.findall(r'"([\w]+)":\s*"([A-Za-z0-9+/=]+)"', (source/'FigmaRasterAssets.generated.swift').read_text()):
    (assets/f'{name}.png').write_bytes(base64.b64decode(encoded))
    rasters[name] = f'/design-libraries/flomo/{name}.png'
assert len(components) == 381 and len(styles) == 39 and len(families) == 23
assert len({v['id'] for v in variables}) == len(variables)
assert all(v.get('values') for v in variables)
target.write_text(json.dumps(dict(variables=variables, components=components, styles=styles, families=families, icons=icons, rasters=rasters), ensure_ascii=False, indent=2) + '\n')
print(f'Imported {len(variables)} variables, {len(styles)} styles, {len(components)} definitions, {len(families)} families, {len(icons)} icons, {len(rasters)} rasters.')
