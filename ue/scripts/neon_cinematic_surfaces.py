"""Source-backed PBR import. Texture dimensions/UV scale come from source metadata."""
import hashlib
import json
from pathlib import Path
import unreal

ROOT = Path(__file__).resolve().parents[2]
DEST = '/Game/CinematicSurfaces'


def texture(path, normal=False, linear=False, flip_green=False):
    name = path.stem
    asset_path = DEST + '/' + name
    tex = unreal.load_asset(asset_path)
    if tex is None:
        task = unreal.AssetImportTask()
        task.filename = str(path)
        task.destination_path = DEST
        task.destination_name = name
        task.automated = True
        task.save = True
        unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
        tex = unreal.load_asset(asset_path)
    if not isinstance(tex, unreal.Texture2D):
        raise RuntimeError('Missing PBR texture ' + str(path))
    tex.set_editor_property('srgb', not (normal or linear))
    if normal:
        tex.set_editor_property('compression_settings', unreal.TextureCompressionSettings.TC_NORMALMAP)
        tex.set_editor_property('flip_green_channel', flip_green)
    elif linear:
        tex.set_editor_property('compression_settings', unreal.TextureCompressionSettings.TC_MASKS)
    unreal.EditorAssetLibrary.save_loaded_asset(tex)
    return tex


def sample(g, tex, normal=False, linear=False):
    node = g.node('TextureSample', texture=tex)
    node.set_editor_property('sampler_type', unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL if normal else
                            unreal.MaterialSamplerType.SAMPLERTYPE_MASKS if linear else
                            unreal.MaterialSamplerType.SAMPLERTYPE_COLOR)
    return node


def channel(g, node, component):
    mask = g.node('ComponentMask', r=component == 'r', g=component == 'g', b=component == 'b', a=False)
    g.wire_single(node, mask)
    return mask


def apply_surfaces(materials, directory, Graph):
    manifest_path = ROOT / 'docs/assets/cinematic-surfaces.json'
    if not manifest_path.exists():
        raise RuntimeError('Run tools/assets/fetch_cinematic_surfaces.py before generating final environment')
    records = json.loads(manifest_path.read_text(encoding='utf8'))['sources']
    textures = {}
    for entry in records:
        path = ROOT / entry['source']
        if hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']:
            raise RuntimeError('PBR source checksum mismatch: ' + str(path))
        textures[entry['asset'], entry['channel']] = texture(path, entry['channel'] == 'nor_dx', entry['channel'] == 'rough')
    # Versioned immutable PBR graphs: never delete expressions rooted by a native
    # CDO's imported mesh/material dependency during commandlet construction.
    for key, source, tile_cm, name in [('road', 'asphalt_02', 300, 'M_NC_CinematicRoadPBR_v2'),
                                        ('concrete', 'concrete_wall_006', 200, 'M_NC_CinematicConcretePBR_v2')]:
        cached = unreal.load_asset(DEST + '/' + name)
        if cached is not None:
            materials[key] = cached
            continue
        g = Graph(DEST, name)
        position = g.binary('Divide', g.node('WorldPosition'), g.scalar(tile_cm))
        # Triplanar diffuse/roughness avoids centimetre-scale stretch on bridge piers.
        normal = g.node('VertexNormalWS')
        absolute = g.node('Abs')
        g.wire_single(normal, absolute)
        weights = [channel(g, absolute, c) for c in 'rgb']
        weight_sum = g.binary('Add', g.binary('Add', weights[0], weights[1]), weights[2])
        uvs = []
        for axes in [('g', 'b'), ('r', 'b'), ('r', 'g')]:
            uv = g.node('ComponentMask', r='r' in axes, g='g' in axes, b='b' in axes, a=False)
            g.wire_single(position, uv)
            uvs.append(uv)
        mapped = {}
        for ch in ['diff', 'rough']:
            nodes = []
            for uv, weight in zip(uvs, weights):
                tex = sample(g, textures[source, ch], linear=ch == 'rough')
                g.wire(uv, tex, 'UVs')
                nodes.append(g.binary('Multiply', tex, weight))
            mapped[ch] = g.binary('Divide', g.binary('Add', g.binary('Add', nodes[0], nodes[1]), nodes[2]), weight_sum)
        if key == 'road':
            wet = g.noise(.003, 2)
            g.output(g.binary('Multiply', mapped['diff'], g.lerp(g.scalar(.42), g.scalar(.72), wet)), 'BASE_COLOR')
            g.output(g.lerp(g.scalar(.19), mapped['rough'], wet), 'ROUGHNESS')
            n = sample(g, textures[source, 'nor_dx'], normal=True)
            g.wire(uvs[2], n, 'UVs')
            g.output(n, 'NORMAL')
        else:
            g.output(mapped['diff'], 'BASE_COLOR')
            g.output(mapped['rough'], 'ROUGHNESS')
            projected = []
            for axis, uv, weight in zip('rgb', uvs, weights):
                n = sample(g, textures[source, 'nor_dx'], normal=True)
                g.wire(uv, n, 'UVs')
                nx, ny, nz = [channel(g, n, c) for c in 'rgb']
                sign = g.node('Sign')
                g.wire_single(channel(g, normal, axis), sign)
                nz = g.binary('Multiply', nz, sign)
                components = {'r': (nz, nx, ny), 'g': (nx, nz, ny), 'b': (nx, ny, nz)}[axis]
                vector = g.binary('AppendVector', g.binary('AppendVector', components[0], components[1]), components[2])
                projected.append(g.binary('Multiply', vector, weight))
            blended = g.node('Normalize')
            g.wire_single(g.binary('Add', g.binary('Add', projected[0], projected[1]), projected[2]), blended)
            tangent = g.node('Transform',
                             transform_source_type=unreal.MaterialVectorCoordTransformSource.TRANSFORMSOURCE_WORLD,
                             transform_type=unreal.MaterialVectorCoordTransform.TRANSFORM_TANGENT)
            g.wire_single(blended, tangent)
            g.output(tangent, 'NORMAL')
        g.output(g.scalar(0), 'METALLIC')
        g.output(g.scalar(.5), 'SPECULAR')
        materials[key] = g.finish()
    # Restore the actual authored motorcycle PBR, including OpenGL normal conversion.
    source = ROOT / 'web/models/player-motorcycle-obj/textures'
    ident = '68fa4d52-54ee-46b9-af70-22149dd48be6'
    color = texture(source / ('Color_' + ident + '.jpg'))
    norm = texture(source / ('NormalGL_' + ident + '.png'), normal=True, flip_green=True)
    orm = texture(source / ('ORM_' + ident + '.png'), linear=True)
    bike_material = unreal.load_asset(DEST + '/M_PlayerMotorcycle_PBR')
    if bike_material is None:
        g = Graph(DEST, 'M_PlayerMotorcycle_PBR')
        g.output(sample(g, color), 'BASE_COLOR')
        g.output(sample(g, norm, normal=True), 'NORMAL')
        packed = sample(g, orm, linear=True)
        for c, prop in [('r', 'AMBIENT_OCCLUSION'), ('g', 'ROUGHNESS'), ('b', 'METALLIC')]:
            g.output(channel(g, packed, c), prop)
        bike_material = g.finish()
    unreal.EditorAssetLibrary.save_loaded_asset(bike_material)
    bike = unreal.load_asset('/Game/LinxiaChase/Imported/SM_PlayerMotorcycle')
    if bike is None:
        raise RuntimeError('Missing imported motorcycle')
    for index in range(len(bike.get_editor_property('static_materials'))):
        bike.set_material(index, bike_material)
    unreal.EditorAssetLibrary.save_loaded_asset(bike)
    unreal.log('[NeonCinematicSurfaces] Verified 4K CC0 road/concrete and restored motorcycle PBR')
