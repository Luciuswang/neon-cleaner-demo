import unreal


LEVEL_PATH = "/Game/LinxiaChase/LVL_Linxia_MotorcycleChase"
MATERIAL_DIR = "/Game/LinxiaChase/Materials"
PAWN_CLASS = "/Script/NeonCleanerUE.LinxiaMotorcyclePawn"
GAMEMODE_CLASS = "/Script/NeonCleanerUE.LinxiaMotorcycleChaseGameMode"


def log(message):
    unreal.log("[LinxiaMotorcycleChaseLevel] " + message)


def set_prop(obj, name, value):
    try:
        obj.set_editor_property(name, value)
        return True
    except Exception:
        return False


def spawn_actor(cls, location, rotation=None, label=None):
    rotation = rotation or unreal.Rotator(0.0, 0.0, 0.0)
    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(cls, location, rotation)
    actor.set_actor_location(location, False, False)
    actor.set_actor_rotation(rotation, False)
    if label:
        actor.set_actor_label(label)
    return actor


def look_at(location, target):
    return unreal.MathLibrary.find_look_at_rotation(location, target)


def create_material(name, color, emissive=False):
    unreal.EditorAssetLibrary.make_directory(MATERIAL_DIR)
    path = MATERIAL_DIR + "/" + name
    existing = unreal.EditorAssetLibrary.load_asset(path + "." + name)
    if existing:
        unreal.EditorAssetLibrary.delete_asset(path + "." + name)

    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
    material = asset_tools.create_asset(name, MATERIAL_DIR, unreal.Material, unreal.MaterialFactoryNew())
    if not material:
        return unreal.EditorAssetLibrary.load_asset("/Engine/EngineMaterials/WorldGridMaterial.WorldGridMaterial")

    try:
        base = unreal.MaterialEditingLibrary.create_material_expression(
            material, unreal.MaterialExpressionConstant3Vector, -360, 0
        )
        base.set_editor_property("constant", unreal.LinearColor(color[0], color[1], color[2], 1.0))
        unreal.MaterialEditingLibrary.connect_material_property(base, "", unreal.MaterialProperty.MP_BASE_COLOR)

        roughness = unreal.MaterialEditingLibrary.create_material_expression(
            material, unreal.MaterialExpressionConstant, -360, 140
        )
        roughness.set_editor_property("r", color[3])
        unreal.MaterialEditingLibrary.connect_material_property(roughness, "", unreal.MaterialProperty.MP_ROUGHNESS)

        specular = unreal.MaterialEditingLibrary.create_material_expression(
            material, unreal.MaterialExpressionConstant, -360, 220
        )
        specular.set_editor_property("r", 0.08)
        unreal.MaterialEditingLibrary.connect_material_property(specular, "", unreal.MaterialProperty.MP_SPECULAR)

        if emissive:
            glow = unreal.MaterialEditingLibrary.create_material_expression(
                material, unreal.MaterialExpressionConstant3Vector, -360, 300
            )
            glow.set_editor_property("constant", unreal.LinearColor(color[0] * 8.0, color[1] * 8.0, color[2] * 8.0, 1.0))
            unreal.MaterialEditingLibrary.connect_material_property(glow, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)

        unreal.MaterialEditingLibrary.recompile_material(material)
        unreal.EditorAssetLibrary.save_loaded_asset(material)
    except Exception as exc:
        log("Material graph fallback for " + name + ": " + str(exc))

    return material


def mesh_actor(label, mesh, material, location, scale, rotation=None):
    actor = spawn_actor(unreal.StaticMeshActor, location, rotation, label)
    comp = actor.get_component_by_class(unreal.StaticMeshComponent)
    comp.set_static_mesh(mesh)
    set_prop(comp, "mobility", unreal.ComponentMobility.MOVABLE)
    set_prop(comp, "collision_enabled", unreal.CollisionEnabled.QUERY_AND_PHYSICS)
    if material:
        comp.set_material(0, material)
    actor.set_actor_scale3d(scale)
    return actor


def add_box(label, cube, material, x, y, z, sx, sy, sz, pitch=0.0, yaw=0.0, roll=0.0):
    return mesh_actor(
        label,
        cube,
        material,
        unreal.Vector(x, y, z),
        unreal.Vector(sx, sy, sz),
        unreal.Rotator(pitch, yaw, roll),
    )


def setup_level():
    unreal.EditorAssetLibrary.make_directory("/Game/LinxiaChase")
    if unreal.EditorAssetLibrary.does_asset_exist(LEVEL_PATH):
        unreal.EditorLevelLibrary.load_level(LEVEL_PATH)
        for actor in unreal.EditorLevelLibrary.get_all_level_actors():
            unreal.EditorLevelLibrary.destroy_actor(actor)
    else:
        unreal.EditorLevelLibrary.new_level(LEVEL_PATH)

    cube = unreal.EditorAssetLibrary.load_asset("/Engine/BasicShapes/Cube.Cube")
    sphere = unreal.EditorAssetLibrary.load_asset("/Engine/BasicShapes/Sphere.Sphere")
    pawn_class = unreal.load_class(None, PAWN_CLASS)
    game_mode_class = unreal.load_class(None, GAMEMODE_CLASS)
    if not all([cube, sphere, pawn_class, game_mode_class]):
        raise RuntimeError("Missing motorcycle chase class or engine shape")

    mat_road = create_material("M_NC_ChaseWetRoad", (0.012, 0.014, 0.018, 0.35))
    mat_lane = create_material("M_NC_ChaseLaneCyan", (0.0, 0.75, 1.0, 0.15), True)
    mat_magenta = create_material("M_NC_ChaseMagenta", (0.95, 0.02, 0.38, 0.12), True)
    mat_barrier = create_material("M_NC_ChaseConcrete", (0.22, 0.23, 0.24, 0.66))
    mat_debris = create_material("M_NC_ChaseDebris", (0.06, 0.06, 0.065, 0.72))
    mat_target = create_material("M_NC_ChaseTargetAmber", (1.0, 0.48, 0.06, 0.18), True)

    pawn = spawn_actor(pawn_class, unreal.Vector(0.0, 0.0, 0.0), unreal.Rotator(0.0, 0.0, 0.0), "Linxia_MotorcyclePawn")
    set_prop(pawn, "auto_possess_player", unreal.AutoReceiveInput.PLAYER0)

    # Straight first, then gentle slalom. This keeps the first playable frame readable.
    add_box("Gate3_Road_Main", cube, mat_road, 1850.0, 0.0, -5.0, 42.0, 8.0, 0.06)
    add_box("Gate3_Road_Extension", cube, mat_road, 4750.0, 160.0, -5.0, 24.0, 8.0, 0.06, yaw=6.0)
    for i, x in enumerate(range(300, 5200, 420)):
        y = 0.0 if x < 2300 else (x - 2300) * 0.08
        add_box(f"Gate3_CenterGuide_{i:02d}", cube, mat_lane, float(x), y, 2.0, 0.42, 0.035, 0.012, yaw=6.0 if x >= 2300 else 0.0)

    for i, x in enumerate(range(-300, 5600, 560)):
        lane_y = 0.0 if x < 2300 else (x - 2300) * 0.08
        add_box(f"Gate3_LeftBarrier_{i:02d}", cube, mat_barrier, float(x), lane_y - 445.0, 52.0, 2.8, 0.14, 0.52, yaw=-2.0)
        add_box(f"Gate3_RightBarrier_{i:02d}", cube, mat_barrier, float(x), lane_y + 445.0, 52.0, 2.8, 0.14, 0.52, yaw=2.0)

    obstacle_specs = [
        ("Gate3_DebrisGap_Left_01", 820.0, -170.0, 38.0, 0.9, 0.9, 0.24, 18.0),
        ("Gate3_DebrisGap_Right_01", 1320.0, 190.0, 40.0, 1.1, 0.65, 0.28, -12.0),
        ("Gate3_LaneShift_Barrier_01", 1980.0, -80.0, 56.0, 1.5, 0.16, 0.5, 12.0),
        ("Gate3_LaneShift_Barrier_02", 2860.0, 215.0, 56.0, 1.7, 0.16, 0.5, -14.0),
        ("Gate3_FinalDebris_01", 3920.0, 385.0, 42.0, 1.15, 0.86, 0.28, 8.0),
    ]
    for label, x, y, z, sx, sy, sz, yaw in obstacle_specs:
        add_box(label, cube, mat_debris, x, y, z, sx, sy, sz, yaw=yaw)

    target_body = add_box("Gate3_ChaseTarget_Body", cube, mat_target, 4350.0, 340.0, 78.0, 1.2, 0.72, 0.34, yaw=7.0)
    set_prop(target_body, "tags", [unreal.Name("Gate3ChaseTarget")])
    add_box("Gate3_ChaseTarget_Signal", cube, mat_magenta, 4210.0, 340.0, 142.0, 0.08, 0.86, 0.1, yaw=7.0)
    add_box("Gate3_FinishBeacon_Left", cube, mat_magenta, 5000.0, -80.0, 95.0, 0.12, 0.12, 0.9)
    add_box("Gate3_FinishBeacon_Right", cube, mat_magenta, 5000.0, 760.0, 95.0, 0.12, 0.12, 0.9)

    key = spawn_actor(unreal.DirectionalLight, unreal.Vector(-520.0, -420.0, 720.0), unreal.Rotator(-38.0, -28.0, 0.0), "Gate3_KeyLight_Cold")
    key_comp = key.get_component_by_class(unreal.DirectionalLightComponent)
    set_prop(key_comp, "mobility", unreal.ComponentMobility.MOVABLE)
    set_prop(key_comp, "intensity", 2.1)
    set_prop(key_comp, "light_color", unreal.LinearColor(0.62, 0.76, 1.0, 1.0))

    sky = spawn_actor(unreal.SkyLight, unreal.Vector(0.0, 0.0, 340.0), label="Gate3_SkyLight")
    sky_comp = sky.get_component_by_class(unreal.SkyLightComponent)
    set_prop(sky_comp, "mobility", unreal.ComponentMobility.MOVABLE)
    set_prop(sky_comp, "intensity", 0.68)

    start_rim = spawn_actor(unreal.PointLight, unreal.Vector(-90.0, -210.0, 175.0), label="Gate3_StartMagentaRim")
    start_rim_comp = start_rim.get_component_by_class(unreal.PointLightComponent)
    set_prop(start_rim_comp, "mobility", unreal.ComponentMobility.MOVABLE)
    set_prop(start_rim_comp, "intensity", 1200.0)
    set_prop(start_rim_comp, "attenuation_radius", 780.0)
    set_prop(start_rim_comp, "light_color", unreal.LinearColor(1.0, 0.08, 0.44, 1.0))

    start_fill = spawn_actor(unreal.PointLight, unreal.Vector(120.0, 180.0, 150.0), label="Gate3_StartCyanFill")
    start_fill_comp = start_fill.get_component_by_class(unreal.PointLightComponent)
    set_prop(start_fill_comp, "mobility", unreal.ComponentMobility.MOVABLE)
    set_prop(start_fill_comp, "intensity", 900.0)
    set_prop(start_fill_comp, "attenuation_radius", 700.0)
    set_prop(start_fill_comp, "light_color", unreal.LinearColor(0.18, 0.74, 1.0, 1.0))

    start_camera = spawn_actor(
        unreal.CameraActor,
        unreal.Vector(-500.0, -120.0, 170.0),
        look_at(unreal.Vector(-500.0, -120.0, 170.0), unreal.Vector(95.0, 0.0, 92.0)),
        "Gate3_FirstPlayableFrameCamera",
    )
    set_prop(start_camera.camera_component, "field_of_view", 50.0)

    target_camera = spawn_actor(
        unreal.CameraActor,
        unreal.Vector(3080.0, -530.0, 260.0),
        look_at(unreal.Vector(3080.0, -530.0, 260.0), unreal.Vector(4350.0, 340.0, 95.0)),
        "Gate3_TargetPreviewCamera",
    )
    set_prop(target_camera.camera_component, "field_of_view", 42.0)

    try:
        world_settings = unreal.EditorLevelLibrary.get_editor_world().get_world_settings()
        set_prop(world_settings, "default_game_mode", game_mode_class)
    except Exception as exc:
        log("Could not set world game mode override: " + str(exc))

    try:
        unreal.get_editor_subsystem(unreal.EditorActorSubsystem).set_selected_level_actors([pawn])
    except Exception:
        pass

    unreal.EditorLevelLibrary.set_level_viewport_camera_info(
        start_camera.get_actor_location(),
        start_camera.get_actor_rotation(),
    )

    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    log("Saved playable motorcycle chase level: " + LEVEL_PATH)


setup_level()
