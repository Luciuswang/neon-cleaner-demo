"""Prepare the user-downloaded jacket; optionally import an UNRIGGED candidate.

Ordinary Python: python import_leather_jacket.py --prepare-only [--zip PATH]
Unreal Python: execute this file, or call prepare() then import_candidate().
No character, level, skeleton, wardrobe item or gameplay assignment is changed.
Existing differing source files and existing UE destination assets are refused.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zipfile
import zlib

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / '.local/private-sources/MetaHumanLeatherJacket'
DEFAULT_ZIP = Path.home() / 'Downloads/female-leather-jacket-free-model.zip'
ZIP_SHA256 = '70b22abf3fb2ffe048587aaff00e6de654e9a96cf8bc70767f16650bde797d39'
DEST = '/Game/MetaHumanWorkspace/Clothing/LeatherJacketSource'
LISTING = 'https://www.fab.com/listings/d541ccae-385a-4f98-b678-ea57a60c5f85'
EXPECTED = {'source/jacket.fbx', 'textures/[Metalness].jpg',
            'textures/[Roughness].jpg', 'textures/internal_ground_ao_texture.jpeg',
            'textures/Ao.jpg', 'textures/[Normal].jpeg'}
MAPS = {'BaseColor': 'embedded/Albedo.jpg', 'Normal': 'embedded/Normal.jpg',
        'Metallic': 'textures/[Metalness].jpg', 'Roughness': 'textures/[Roughness].jpg',
        'AO': 'textures/Ao.jpg'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_output(relative):
    if '\\' in relative or ':' in relative or '..' in relative.split('/'):
        raise ValueError('Unsafe source path: ' + relative)
    target = (SOURCE / relative).resolve()
    if not target.is_relative_to(SOURCE.resolve()):
        raise ValueError('Source path escaped preparation folder')
    return target


def preserve_bytes(relative, data):
    target = safe_output(relative)
    if target.exists():
        if target.read_bytes() != data:
            raise RuntimeError('Preserving differing existing source: ' + str(target))
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('xb') as stream:
        stream.write(data)
    if digest(target.read_bytes()) != digest(data):
        raise RuntimeError('Prepared file checksum mismatch: ' + relative)


def fbx_nodes(data):
    """Read the known FBX 7.7 binary without executing embedded content."""
    if not data.startswith(b'Kaydara FBX Binary  \x00\x1a\x00'):
        raise ValueError('Expected binary FBX')
    if struct.unpack_from('<I', data, 23)[0] != 7700:
        raise ValueError('This preparation parser expects the audited FBX 7700')

    def property_at(pos):
        kind = chr(data[pos]); pos += 1
        formats = {'Y': 'h', 'C': '?', 'I': 'i', 'F': 'f', 'D': 'd', 'L': 'q'}
        if kind in formats:
            fmt = '<' + formats[kind]
            return struct.unpack_from(fmt, data, pos)[0], pos + struct.calcsize(fmt)
        if kind in ('S', 'R'):
            size = struct.unpack_from('<I', data, pos)[0]; pos += 4
            if pos + size > len(data): raise ValueError('Truncated FBX property')
            raw = data[pos:pos + size]
            return (raw.decode('utf8') if kind == 'S' else raw), pos + size
        if kind not in 'fdlibc': raise ValueError('Unsupported FBX property: ' + kind)
        count, encoding, size = struct.unpack_from('<III', data, pos); pos += 12
        if size > len(data) - pos or count > 10_000_000:
            raise ValueError('Invalid FBX array size')
        raw = data[pos:pos + size]
        if encoding not in (0, 1): raise ValueError('Invalid FBX array encoding')
        if encoding: raw = zlib.decompress(raw)
        fmt = {'f': 'f', 'd': 'd', 'l': 'q', 'i': 'i', 'b': '?', 'c': 'b'}[kind]
        if len(raw) != count * struct.calcsize(fmt): raise ValueError('FBX array length mismatch')
        return struct.unpack('<' + str(count) + fmt, raw), pos + size

    def children(pos, limit, depth=0):
        if depth > 40: raise ValueError('Unexpected FBX nesting')
        result = []
        while pos + 25 <= limit:
            end, count, props_size, name_size = struct.unpack_from('<QQQB', data, pos)
            if not end: break
            if end <= pos or end > limit or count > 10000: raise ValueError('Invalid FBX node')
            pos += 25
            name = data[pos:pos + name_size].decode('ascii'); pos += name_size
            start = pos; props = []
            for _ in range(count):
                value, pos = property_at(pos); props.append(value)
            if pos - start != props_size or pos > end: raise ValueError('Invalid FBX properties')
            result.append((name, props, children(pos, end, depth + 1)))
            pos = end
        return result
    return children(27, len(data))


def walk(nodes):
    for node in nodes:
        yield node
        yield from walk(node[2])


def prepare(zip_path=None):
    if zip_path is None:
        zip_path = DEFAULT_ZIP if DEFAULT_ZIP.is_file() else safe_output('female-leather-jacket-free-model.zip')
    archive = Path(zip_path).read_bytes()
    if digest(archive) != ZIP_SHA256:
        raise ValueError('ZIP differs from the audited user download; inspect before importing')
    with zipfile.ZipFile(zip_path) as package:
        if set(package.namelist()) != EXPECTED or len(package.namelist()) != len(EXPECTED):
            raise ValueError('Unexpected/duplicate ZIP entry')
        content = {name: package.read(name) for name in sorted(EXPECTED)}
    nodes = list(walk(fbx_nodes(content['source/jacket.fbx'])))
    if any(name == 'Deformer' or (name == 'Model' and props[-1:] == ['LimbNode'])
           for name, props, _ in nodes):
        raise ValueError('Source unexpectedly contains a rig; re-inspect')
    geometry = [node for node in nodes if node[0] == 'Geometry']
    if len(geometry) != 1: raise ValueError('Expected one jacket geometry')
    vertices = next(props[0] for name, props, _ in nodes if name == 'Vertices')
    indices = next(props[0] for name, props, _ in nodes if name == 'PolygonVertexIndex')
    for name, _, children in nodes:
        if name != 'Video': continue
        filename = next(p[0] for n, p, _ in children if n == 'RelativeFilename')
        embedded = next(p[0] for n, p, _ in children if n == 'Content')
        label = 'Albedo' if '[Albedo]' in filename else 'Normal' if '[Normal]' in filename else None
        if label is None or not embedded.startswith(b'\xff\xd8'):
            raise ValueError('Unexpected embedded image')
        content['embedded/' + label + '.jpg'] = embedded
    if not all(path in content for path in MAPS.values()):
        raise ValueError('Required PBR texture missing')
    metadata = {
        'schema': 1, 'source_url': LISTING, 'author': 'CG StudioX',
        'source_zip_sha256': ZIP_SHA256, 'source_status': 'user supplied download',
        'license': {'name': 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
                    'url': 'https://creativecommons.org/licenses/by/4.0/',
                    'verification': 'User-provided screenshot of this exact Fab listing displays Creative Commons Attribution (CC BY 4.0); observed by integrator on 2026-11-09.',
                    'credit': 'Female Leather Jacket - Free Model by CG StudioX. ' + LISTING + ' . Licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ . Adapted for Neon Cleaner; fitting/skinning/material changes must be identified.'},
        'fbx_version': 7700, 'unit': 'centimeters', 'up_axis': 'Y',
        'mesh_count': 1, 'control_vertices': len(vertices) // 3,
        'polygons': sum(i < 0 for i in indices),
        'triangles_after_triangulation': len(indices) - 2 * sum(i < 0 for i in indices),
        'source_bounds': {'min': [min(vertices[i::3]) for i in range(3)],
                          'max': [max(vertices[i::3]) for i in range(3)]},
        'rigged': False, 'fitted_to_user_metahuman': False,
        'normal_convention': 'not verified; compare material relief in engine before acceptance',
        'maps': MAPS, 'files': {name: {'bytes': len(raw), 'sha256': digest(raw)}
                              for name, raw in sorted(content.items())},
        'status': 'SOURCE_PREPARED_UNRIGGED_NOT_GAMEPLAY_READY'}
    # Preflight every existing output before writing any source file.
    content['female-leather-jacket-free-model.zip'] = archive
    content['manifest.json'] = (json.dumps(metadata, indent=2, sort_keys=True) + '\n').encode()
    for name, raw in content.items():
        target = safe_output(name)
        if target.exists() and target.read_bytes() != raw:
            raise RuntimeError('Preserving differing existing source: ' + str(target))
    for name, raw in content.items(): preserve_bytes(name, raw)
    print('[LeatherJacket] SOURCE PREPARED:', SOURCE, '; unrigged; fitting required')
    return metadata


def import_candidate():
    import unreal
    metadata = json.loads(safe_output('manifest.json').read_text(encoding='utf8'))
    if metadata['source_zip_sha256'] != ZIP_SHA256: raise ValueError('Unexpected preparation manifest')
    for relative, entry in metadata['files'].items():
        if digest(safe_output(relative).read_bytes()) != entry['sha256']:
            raise ValueError('Prepared source changed: ' + relative)
    texture_names = {key: 'T_LeatherJacket_' + key for key in MAPS}
    names = list(texture_names.values()) + ['M_LeatherJacket_Source', 'SM_LeatherJacket_Unfitted']
    for name in names:
        if unreal.EditorAssetLibrary.does_asset_exist(DEST + '/' + name):
            raise RuntimeError('Existing candidate preserved; inspect instead of reimporting: ' + name)
    tools = unreal.AssetToolsHelpers.get_asset_tools()

    def import_file(relative, name, options=None):
        task = unreal.AssetImportTask()
        task.filename = str(safe_output(relative)); task.destination_path = DEST
        task.destination_name = name; task.automated = True
        task.replace_existing = False; task.save = False
        if options is not None: task.options = options
        tools.import_asset_tasks([task])
        asset = unreal.EditorAssetLibrary.load_asset(DEST + '/' + name)
        if asset is None: raise RuntimeError('Jacket import failed: ' + name)
        return asset

    def save(asset):
        unreal.EditorAssetLibrary.set_metadata_tag(asset, 'NeonSourceZipSHA256', ZIP_SHA256)
        unreal.EditorAssetLibrary.set_metadata_tag(asset, 'NeonStatus', 'UNFITTED_UNRIGGED_CANDIDATE')
        if not unreal.EditorAssetLibrary.save_loaded_asset(asset, only_if_is_dirty=False):
            raise RuntimeError('Could not save jacket candidate: ' + asset.get_path_name())

    textures = {}
    for label, relative in MAPS.items():
        texture = import_file(relative, texture_names[label])
        if not isinstance(texture, unreal.Texture2D): raise TypeError('Expected texture: ' + label)
        texture.set_editor_property('srgb', label == 'BaseColor')
        if label == 'Normal':
            texture.set_editor_property('compression_settings', unreal.TextureCompressionSettings.TC_NORMALMAP)
            texture.set_editor_property('flip_green_channel', False)
        elif label != 'BaseColor':
            texture.set_editor_property('compression_settings', unreal.TextureCompressionSettings.TC_MASKS)
        save(texture); textures[label] = texture
    material = tools.create_asset('M_LeatherJacket_Source', DEST, unreal.Material, unreal.MaterialFactoryNew())
    if material is None: raise RuntimeError('Jacket material creation failed')
    material.set_editor_property('two_sided', True)
    lib = unreal.MaterialEditingLibrary
    properties = {'BaseColor': 'MP_BASE_COLOR', 'Normal': 'MP_NORMAL',
                  'Metallic': 'MP_METALLIC', 'Roughness': 'MP_ROUGHNESS', 'AO': 'MP_AMBIENT_OCCLUSION'}
    for index, (label, texture) in enumerate(textures.items()):
        expression = lib.create_material_expression(material, unreal.MaterialExpressionTextureSample, -400, index * 200)
        expression.set_editor_property('texture', texture)
        sampler = 'SAMPLERTYPE_COLOR' if label == 'BaseColor' else 'SAMPLERTYPE_NORMAL' if label == 'Normal' else 'SAMPLERTYPE_MASKS'
        expression.set_editor_property('sampler_type', getattr(unreal.MaterialSamplerType, sampler))
        pin = 'RGB' if label in ('BaseColor', 'Normal') else 'R'
        if not lib.connect_material_property(expression, pin, getattr(unreal.MaterialProperty, properties[label])):
            raise RuntimeError('Material connection failed: ' + label)
    lib.recompile_material(material); save(material)
    options = unreal.FbxImportUI()
    for key, value in {'import_materials': False, 'import_textures': False, 'import_mesh': True,
                       'import_as_skeletal': False, 'automated_import_should_detect_type': False,
                       'mesh_type_to_import': unreal.FBXImportType.FBXIT_STATIC_MESH}.items():
        options.set_editor_property(key, value)
    static = options.get_editor_property('static_mesh_import_data')
    for key, value in {'combine_meshes': True, 'convert_scene': True, 'convert_scene_unit': True,
                       'import_uniform_scale': 1.0, 'generate_lightmap_u_vs': False,
                       'auto_generate_collision': False,
                       'normal_import_method': unreal.FBXNormalImportMethod.FBXNIM_IMPORT_NORMALS}.items():
        static.set_editor_property(key, value)
    mesh = import_file('source/jacket.fbx', 'SM_LeatherJacket_Unfitted', options)
    if not isinstance(mesh, unreal.StaticMesh): raise TypeError('Expected unrigged static jacket mesh')
    for index in range(len(mesh.get_editor_property('static_materials'))): mesh.set_material(index, material)
    save(mesh)
    bounds = mesh.get_bounds()
    size = [bounds.box_extent.x * 2, bounds.box_extent.y * 2, bounds.box_extent.z * 2]
    unreal.log('[LeatherJacket] SOURCE CANDIDATE IMPORTED: ' + DEST + '; bounds_cm=' + str(size)
               + '; no rig, body fit, wardrobe or gameplay assignment. Normal convention needs visual review.')


if __name__ == '__main__':
    try:
        import unreal
    except ImportError:
        parser = argparse.ArgumentParser(description=__doc__)
        parser.add_argument('--prepare-only', action='store_true', required=True)
        parser.add_argument('--zip', type=Path, help='Explicit ZIP; otherwise Downloads or restored private source')
        prepare(parser.parse_args().zip)
    else:
        prepare()
        import_candidate()
