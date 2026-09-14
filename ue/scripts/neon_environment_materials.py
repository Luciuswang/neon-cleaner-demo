"""Texture-free, world-scaled wet city surfaces; no shared asset deletion."""

import unreal


class Graph:
    def __init__(self, directory, name):
        path = directory + "/" + name
        self.material = (
            unreal.EditorAssetLibrary.load_asset(path)
            if unreal.EditorAssetLibrary.does_asset_exist(path)
            else None
        )
        if self.material is None:
            self.material = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
                name, directory, unreal.Material, unreal.MaterialFactoryNew()
            )
        if not isinstance(self.material, unreal.Material):
            raise RuntimeError("Expected editable material at " + path)
        unreal.MaterialEditingLibrary.delete_all_material_expressions(self.material)
        self.material.set_editor_property("two_sided", False)
        self.material.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_DEFAULT_LIT)
        self.material.set_editor_property("blend_mode", unreal.BlendMode.BLEND_OPAQUE)
        self.index = 0

    def node(self, kind, **properties):
        self.index += 1
        node = unreal.MaterialEditingLibrary.create_material_expression(
            self.material, getattr(unreal, "MaterialExpression" + kind),
            -1200 + (self.index % 5) * 200, (self.index // 5) * 170
        )
        for key, value in properties.items():
            node.set_editor_property(key, value)
        return node

    def scalar(self, value):
        return self.node("Constant", r=float(value))

    def color(self, value):
        return self.node("Constant3Vector", constant=unreal.LinearColor(*value, 1))

    def wire(self, source, destination, pin):
        if not unreal.MaterialEditingLibrary.connect_material_expressions(source, "", destination, pin):
            raise RuntimeError("Cannot connect material input " + pin)

    def wire_first(self, source, destination, pins):
        for pin in pins:
            if unreal.MaterialEditingLibrary.connect_material_expressions(
                    source, "", destination, pin):
                return
        raise RuntimeError("Cannot connect material inputs " + ", ".join(pins))

    def wire_single(self, source, destination):
        self.wire_first(source, destination, ("", "Input"))

    def output(self, node, prop):
        if not unreal.MaterialEditingLibrary.connect_material_property(
            node, "", getattr(unreal.MaterialProperty, "MP_" + prop)
        ):
            raise RuntimeError("Cannot connect material output " + prop)

    def binary(self, kind, a, b):
        node = self.node(kind)
        self.wire(a, node, "A")
        self.wire(b, node, "B")
        return node

    def lerp(self, a, b, alpha):
        node = self.binary("LinearInterpolate", a, b)
        self.wire(alpha, node, "Alpha")
        return node

    def noise(self, scale, levels=2):
        position = self.node("WorldPosition")
        noise = self.node("Noise", scale=scale, levels=levels,
                          quality=1, output_min=0.0, output_max=1.0)
        self.wire_first(position, noise, ("World Position", "Position"))
        return noise

    def finish(self):
        unreal.MaterialEditingLibrary.layout_material_expressions(self.material)
        unreal.MaterialEditingLibrary.recompile_material(self.material)
        return self.material


def surface(directory, name, color, roughness, metallic=0, wet=False, emission=0):
    g = Graph(directory, name)
    macro = g.noise(0.006 if wet else 0.013)
    grain = g.noise(0.65 if wet else 0.16, 1)
    # Centimetre world coordinates keep puddles consistent across road tile sizes.
    dirt = g.lerp(g.color(tuple(c * 0.62 for c in color)), g.color(color), macro)
    tint = g.lerp(g.color((0.72, 0.72, 0.72)), g.color((1, 1, 1)), grain)
    g.output(g.binary("Multiply", dirt, tint), "BASE_COLOR")
    dry_roughness = g.lerp(g.scalar(roughness * 0.8), g.scalar(roughness), grain)
    if wet:
        threshold = g.binary("Subtract", macro, g.scalar(0.48))
        puddle = g.node("Saturate")
        g.wire_single(g.binary("Multiply", threshold, g.scalar(5.5)), puddle)
        g.output(g.lerp(dry_roughness, g.scalar(0.12), puddle), "ROUGHNESS")
    else:
        g.output(dry_roughness, "ROUGHNESS")
    g.output(g.scalar(metallic), "METALLIC")
    g.output(g.scalar(0.5), "SPECULAR")
    if emission:
        g.output(g.color(tuple(c * emission for c in color)), "EMISSIVE_COLOR")
    return g.finish()


def sky_material(directory):
    g = Graph(directory, "M_NC_EnvironmentSky")
    g.material.set_editor_property("two_sided", True)
    g.material.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
    g.material.set_editor_property("is_sky", True)
    z = g.node("ComponentMask", r=False, g=False, b=True, a=False)
    g.wire_single(g.node("WorldPosition"), z)
    altitude = g.node("Saturate")
    g.wire_single(g.binary("Divide", z, g.scalar(130000)), altitude)
    color = g.lerp(
        g.color((0.025, 0.045, 0.075)),
        g.color((0.004, 0.012, 0.035)),
        altitude,
    )
    g.output(color, "EMISSIVE_COLOR")
    return g.finish()


def rain_material(directory):
    g = Graph(directory, "M_NC_Rain")
    g.material.set_editor_property("two_sided", True)
    g.material.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
    g.material.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
    g.output(g.color((0.34, 0.56, 0.72)), "EMISSIVE_COLOR")
    g.output(g.scalar(0.34), "OPACITY")
    return g.finish()


def build_materials(directory):
    unreal.EditorAssetLibrary.make_directory(directory)
    # Linear reflectances: concrete/steel dominate; emissives are local accents.
    specs = {
        "road": ("M_NC_ChaseWetRoad", (0.075, 0.082, 0.088), 0.72, 0, True, 0),
        "puddle": ("M_NC_EnvironmentPuddle", (0.018, 0.034, 0.043), 0.08, 0.12, True, 0),
        "shoulder": ("M_NC_ChaseWetRoadEdge", (0.14, 0.15, 0.15), 0.8, 0, True, 0),
        "concrete": ("M_NC_ChaseConcrete", (0.32, 0.33, 0.32), 0.86, 0, False, 0),
        "facade": ("M_NC_ChaseCityMass", (0.24, 0.265, 0.28), 0.82, 0, False, 0),
        "far": ("M_NC_ChaseCityFar", (0.19, 0.215, 0.235), 0.84, 0, False, 0),
        "steel": ("M_NC_ChaseUnderpassSteel", (0.21, 0.24, 0.25), 0.48, 0.7, False, 0),
        "rubber": ("M_NC_ChaseDebris", (0.025, 0.028, 0.03), 0.88, 0, False, 0),
        "paint": ("M_NC_EnvironmentRoadPaint", (0.62, 0.64, 0.59), 0.54, 0, True, 0),
        "yellow": ("M_NC_EnvironmentSafetyPaint", (0.72, 0.43, 0.09), 0.6, 0, False, 0),
        "glass": ("M_NC_EnvironmentDarkGlass", (0.055, 0.095, 0.11), 0.23, 0.35, False, 0),
        "window": ("M_NC_EnvironmentWarmWindow", (0.7, 0.50, 0.29), 0.45, 0, False, 1.7),
        "cool_window": ("M_NC_ChaseWindowCyan", (0.32, 0.48, 0.52), 0.4, 0, False, 1.1),
        "amber": ("M_NC_ChaseTargetAmber", (1.0, 0.59, 0.24), 0.4, 0, False, 4),
        "cyan": ("M_NC_ChaseLaneCyan", (0.1, 0.48, 0.55), 0.4, 0, False, 3),
        "magenta": ("M_NC_ChaseMagenta", (0.45, 0.055, 0.19), 0.4, 0, False, 2),
        "container": ("M_NC_EnvironmentContainer", (0.12, 0.22, 0.22), 0.65, 0.3, False, 0),
        "container_gray": ("M_NC_EnvironmentContainerGray", (0.30, 0.32, 0.31), 0.68, 0.3, False, 0),
        "vehicle": ("M_NC_EnvironmentFleetPaint", (0.35, 0.38, 0.36), 0.37, 0.35, False, 0),
        "water": ("M_NC_EnvironmentHarborWater", (0.04, 0.095, 0.12), 0.36, 0.15, True, 0),
    }
    materials = {key: surface(directory, *spec) for key, spec in specs.items()}
    materials["sky"] = sky_material(directory)
    materials["rain"] = rain_material(directory)
    return materials
