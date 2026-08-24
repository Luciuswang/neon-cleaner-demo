import unreal


LEVEL_PATH = "/Game/LinxiaRiderProxy/LVL_Linxia_RiderProxy"
MATERIAL_DIR = "/Game/LinxiaRiderProxy/Materials"
HEROINE_MESH = "/Game/ParagonPhase/Characters/Heroes/Phase/Meshes/Phase_GDC.Phase_GDC"
HEROINE_PAWN_CLASS = "/Script/NeonCleanerUE.PlayablePhaseCharacter"
RIDER_ANIMATION = "/Game/ParagonPhase/Characters/Heroes/Phase/Animations/RMB_Loop.RMB_Loop"


def log(message):
    unreal.log("[LinxiaRiderProxyLevel] " + message)


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
        unreal.MaterialEditingLibrary.connect_material_property(
            base, "", unreal.MaterialProperty.MP_BASE_COLOR
        )

        roughness = unreal.MaterialEditingLibrary.create_material_expression(
            material, unreal.MaterialExpressionConstant, -360, 140
        )
        roughness.set_editor_property("r", color[3])
        unreal.MaterialEditingLibrary.connect_material_property(
            roughness, "", unreal.MaterialProperty.MP_ROUGHNESS
        )

        specular = unreal.MaterialEditingLibrary.create_material_expression(
            material, unreal.MaterialExpressionConstant, -360, 220
        )
        specular.set_editor_property("r", 0.04)
        unreal.MaterialEditingLibrary.connect_material_property(
            specular, "", unreal.MaterialProperty.MP_SPECULAR
        )

        if emissive:
            glow = unreal.MaterialEditingLibrary.create_material_expression(
                material, unreal.MaterialExpressionConstant3Vector, -360, 280
            )
            glow.set_editor_property("constant", unreal.LinearColor(color[0] * 8.0, color[1] * 8.0, color[2] * 8.0, 1.0))
            unreal.MaterialEditingLibrary.connect_material_property(
                glow, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR
            )

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


def add_cylinder(label, cylinder, material, x, y, z, sx, sy, sz, pitch=0.0, yaw=0.0, roll=0.0):
    return mesh_actor(
        label,
        cylinder,
        material,
        unreal.Vector(x, y, z),
        unreal.Vector(sx, sy, sz),
        unreal.Rotator(pitch, yaw, roll),
    )


def set_bone_rotation(component, bone_name, pitch, yaw, roll):
    try:
        component.set_bone_rotation_by_name(
            bone_name,
            unreal.Rotator(pitch, yaw, roll),
            unreal.BoneSpaces.COMPONENT_SPACE,
        )
    except Exception:
        pass


def set_bone_location(component, bone_name, x, y, z):
    try:
        component.set_bone_location_by_name(
            bone_name,
            unreal.Vector(x, y, z),
            unreal.BoneSpaces.COMPONENT_SPACE,
        )
    except Exception:
        pass


def add_component_to_actor(actor, component_class, name):
    sds = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
    actor_handle = None
    parent_handle = None
    for handle in sds.k2_gather_subobject_data_for_instance(actor):
        data = unreal.SubobjectDataBlueprintFunctionLibrary.get_data(handle)
        if unreal.SubobjectDataBlueprintFunctionLibrary.is_actor(data):
            actor_handle = handle
        elif unreal.SubobjectDataBlueprintFunctionLibrary.is_root_component(data):
            parent_handle = handle

    if not actor_handle:
        raise RuntimeError("Could not find actor subobject handle")

    if unreal.MathLibrary.class_is_child_of(component_class, unreal.SceneComponent.static_class()):
        if not parent_handle:
            parent_handle, error_text = sds.add_new_subobject(
                unreal.AddNewSubobjectParams(
                    parent_handle=actor_handle,
                    new_class=unreal.SceneComponent.static_class(),
                    blueprint_context=None,
                )
            )
            if not error_text.is_empty():
                raise RuntimeError(str(error_text))
            sds.rename_subobject(handle=parent_handle, new_name=unreal.Text("DefaultSceneRoot"))
        base_handle = parent_handle
    else:
        base_handle = actor_handle

    component_handle, failure_reason = sds.add_new_subobject(
        unreal.AddNewSubobjectParams(base_handle, component_class, None)
    )
    if not failure_reason.is_empty():
        raise RuntimeError(str(failure_reason))
    sds.rename_subobject(handle=component_handle, new_name=unreal.Text(name))
    component_data = unreal.SubobjectDataBlueprintFunctionLibrary.get_data(component_handle)
    return unreal.SubobjectDataBlueprintFunctionLibrary.get_associated_object(component_data)


def spawn_poseable_rider(mesh):
    rider = spawn_actor(
        unreal.Actor,
        unreal.Vector(-54.0, 0.0, 8.0),
        unreal.Rotator(0.0, 0.0, 0.0),
        "Linxia_RiderProxy_Phase",
    )
    try:
        pose_comp = add_component_to_actor(
            rider,
            unreal.PoseableMeshComponent.static_class(),
            "Linxia_RiderPoseableMesh",
        )
    except Exception as exc:
        raise RuntimeError("Unable to add PoseableMeshComponent: " + str(exc))

    if hasattr(pose_comp, "set_skinned_asset_and_update"):
        pose_comp.set_skinned_asset_and_update(mesh)
    else:
        pose_comp.set_skeletal_mesh(mesh)
    set_prop(pose_comp, "mobility", unreal.ComponentMobility.MOVABLE)

    # Static handoff pose: seated lean, hands near bars, feet near pegs.
    set_bone_rotation(pose_comp, "pelvis", -18.0, 0.0, 0.0)
    set_bone_rotation(pose_comp, "spine_01", -22.0, 0.0, 0.0)
    set_bone_rotation(pose_comp, "spine_02", -30.0, 0.0, 0.0)
    set_bone_rotation(pose_comp, "spine_03", -36.0, 0.0, 0.0)
    set_bone_rotation(pose_comp, "neck_01", 16.0, 0.0, 0.0)
    set_bone_rotation(pose_comp, "head", 10.0, 0.0, 0.0)

    set_bone_location(pose_comp, "hand_l", 132.0, -34.0, 115.0)
    set_bone_location(pose_comp, "hand_r", 132.0, 34.0, 115.0)
    set_bone_location(pose_comp, "foot_l", 52.0, -46.0, 45.0)
    set_bone_location(pose_comp, "foot_r", 52.0, 46.0, 45.0)
    for side, yaw in [("l", -18.0), ("r", 18.0)]:
        set_bone_rotation(pose_comp, f"clavicle_{side}", -22.0, yaw, 0.0)
        set_bone_rotation(pose_comp, f"upperarm_{side}", -58.0, yaw, 0.0)
        set_bone_rotation(pose_comp, f"lowerarm_{side}", -72.0, yaw, 0.0)
        set_bone_rotation(pose_comp, f"thigh_{side}", -82.0, yaw * 0.15, 0.0)
        set_bone_rotation(pose_comp, f"calf_{side}", 96.0, yaw * 0.1, 0.0)
        set_bone_rotation(pose_comp, f"foot_{side}", -28.0, 0.0, 0.0)

    try:
        pose_comp.refresh_bone_transforms()
    except Exception:
        pass
    return rider


def setup_level():
    unreal.EditorAssetLibrary.make_directory("/Game/LinxiaRiderProxy")
    if unreal.EditorAssetLibrary.does_asset_exist(LEVEL_PATH):
        unreal.EditorLevelLibrary.load_level(LEVEL_PATH)
        for actor in unreal.EditorLevelLibrary.get_all_level_actors():
            unreal.EditorLevelLibrary.destroy_actor(actor)
    else:
        unreal.EditorLevelLibrary.new_level(LEVEL_PATH)

    cube = unreal.EditorAssetLibrary.load_asset("/Engine/BasicShapes/Cube.Cube")
    cylinder = unreal.EditorAssetLibrary.load_asset("/Engine/BasicShapes/Cylinder.Cylinder")
    sphere = unreal.EditorAssetLibrary.load_asset("/Engine/BasicShapes/Sphere.Sphere")
    heroine_mesh = unreal.EditorAssetLibrary.load_asset(HEROINE_MESH)
    rider_animation = unreal.EditorAssetLibrary.load_asset(RIDER_ANIMATION)
    pawn_class = unreal.load_class(None, HEROINE_PAWN_CLASS)
    if not all([cube, cylinder, sphere, heroine_mesh, pawn_class]):
        raise RuntimeError("Missing required mesh or pawn class for rider proxy level")

    mat_road = create_material("M_NC_WetRoad_Dark", (0.012, 0.016, 0.022, 0.5))
    mat_black = create_material("M_NC_TacticalBlack", (0.001, 0.001, 0.002, 0.82))
    mat_graphite = create_material("M_NC_BattleGraphite", (0.015, 0.017, 0.02, 0.76))
    mat_rubber = create_material("M_NC_RubberBlack", (0.002, 0.002, 0.002, 0.72))
    mat_magenta = create_material("M_NC_MagentaSignal", (0.95, 0.02, 0.42, 0.18), True)
    mat_cyan = create_material("M_NC_CyanDiagnostic", (0.02, 0.72, 0.95, 0.2), True)
    mat_barrier = create_material("M_NC_DamagedConcrete", (0.22, 0.24, 0.25, 0.62))

    # Road and readable chase direction.
    add_box("Gate2_WetRoad_Base", cube, mat_road, 0.0, 0.0, -4.0, 72.0, 9.0, 0.05)
    add_box("Gate2_CenterLane_Reflection", cube, mat_cyan, 0.0, 0.0, 0.0, 60.0, 0.035, 0.012)
    for index, x in enumerate([-1200.0, -700.0, -200.0, 300.0, 800.0, 1300.0]):
        add_box(f"Gate2_LeftBarrier_{index}", cube, mat_barrier, x, -520.0, 52.0, 3.2, 0.16, 0.55, yaw=3.0 * ((index % 2) - 0.5))
        add_box(f"Gate2_RightBarrier_{index}", cube, mat_barrier, x, 520.0, 52.0, 3.2, 0.16, 0.55, yaw=-2.0 * ((index % 2) - 0.5))
    add_box("Gate2_Magenta_RoadBeacon_L", cube, mat_magenta, 270.0, -500.0, 82.0, 0.08, 0.08, 0.72)
    add_box("Gate2_Magenta_RoadBeacon_R", cube, mat_magenta, 270.0, 500.0, 82.0, 0.08, 0.08, 0.72)

    # Motorcycle proxy: grounded wheels, low body, clear seat, handlebars, and restrained signal accents.
    add_cylinder("NC_Motorcycle_FrontWheel", cylinder, mat_rubber, 146.0, 0.0, 43.0, 0.78, 0.78, 0.14, roll=90.0)
    add_cylinder("NC_Motorcycle_RearWheel", cylinder, mat_rubber, -146.0, 0.0, 43.0, 0.82, 0.82, 0.16, roll=90.0)
    add_cylinder("NC_Motorcycle_FrontRim_Cyan", cylinder, mat_cyan, 138.0, 0.0, 45.0, 0.5, 0.5, 0.18, roll=90.0)
    add_cylinder("NC_Motorcycle_RearRim_Magenta", cylinder, mat_magenta, -138.0, 0.0, 45.0, 0.5, 0.5, 0.2, roll=90.0)
    add_box("NC_Motorcycle_BatterySpine", cube, mat_black, -8.0, 0.0, 84.0, 2.25, 0.28, 0.16, pitch=-5.0)
    add_box("NC_Motorcycle_Seat", cube, mat_graphite, -58.0, 0.0, 104.0, 1.0, 0.36, 0.09, pitch=-5.0)
    add_box("NC_Motorcycle_FrontFairing", cube, mat_black, 94.0, 0.0, 102.0, 0.6, 0.52, 0.42, pitch=-10.0)
    add_box("NC_Motorcycle_LegOccluder_L", cube, mat_black, -18.0, -36.0, 82.0, 1.65, 0.055, 0.26, pitch=-8.0)
    add_box("NC_Motorcycle_LegOccluder_R", cube, mat_black, -18.0, 36.0, 82.0, 1.65, 0.055, 0.26, pitch=-8.0)
    add_box("NC_Motorcycle_FrontFork_L", cube, mat_graphite, 122.0, -22.0, 86.0, 0.07, 0.05, 0.82, pitch=-17.0)
    add_box("NC_Motorcycle_FrontFork_R", cube, mat_graphite, 122.0, 22.0, 86.0, 0.07, 0.05, 0.82, pitch=-17.0)
    add_box("NC_Motorcycle_RearSwingarm_L", cube, mat_graphite, -86.0, -26.0, 66.0, 1.12, 0.045, 0.08, pitch=8.0)
    add_box("NC_Motorcycle_RearSwingarm_R", cube, mat_graphite, -86.0, 26.0, 66.0, 1.12, 0.045, 0.08, pitch=8.0)
    add_box("NC_Motorcycle_Handlebar", cube, mat_graphite, 78.0, 0.0, 128.0, 0.08, 0.72, 0.05)
    add_box("NC_Motorcycle_LeftGrip", cube, mat_graphite, 78.0, -48.0, 126.0, 0.18, 0.08, 0.06, yaw=-16.0)
    add_box("NC_Motorcycle_RightGrip", cube, mat_graphite, 78.0, 48.0, 126.0, 0.18, 0.08, 0.06, yaw=16.0)
    add_box("NC_Motorcycle_LeftFootPeg", cube, mat_graphite, 2.0, -54.0, 48.0, 0.28, 0.055, 0.04)
    add_box("NC_Motorcycle_RightFootPeg", cube, mat_graphite, 2.0, 54.0, 48.0, 0.28, 0.055, 0.04)
    add_box("NC_Motorcycle_NoseLight_Cyan", cube, mat_cyan, 166.0, 0.0, 104.0, 0.18, 0.34, 0.055, pitch=-8.0)
    add_box("NC_Motorcycle_SideAccent_Magenta_L", cube, mat_magenta, -12.0, -38.0, 107.0, 1.55, 0.035, 0.055, pitch=-3.0)
    add_box("NC_Motorcycle_SideAccent_Magenta_R", cube, mat_magenta, -12.0, 38.0, 107.0, 1.55, 0.035, 0.055, pitch=-3.0)
    add_box("NC_Motorcycle_TailSignal_Magenta", cube, mat_magenta, -178.0, 0.0, 102.0, 0.08, 0.34, 0.055)

    runtime_rider = spawn_actor(
        pawn_class,
        unreal.Vector(-54.0, 0.0, 84.0),
        unreal.Rotator(0.0, 0.0, 0.0),
        "Linxia_RiderRuntimePawn_Phase",
    )
    set_prop(runtime_rider, "auto_possess_player", unreal.AutoReceiveInput.PLAYER0)
    skel = runtime_rider.get_component_by_class(unreal.SkeletalMeshComponent)
    if hasattr(skel, "set_skinned_asset_and_update"):
        skel.set_skinned_asset_and_update(heroine_mesh)
    else:
        skel.set_skeletal_mesh(heroine_mesh)
    skel.set_visibility(False, True)
    if rider_animation:
        try:
            skel.set_animation_mode(unreal.AnimationMode.ANIMATION_SINGLE_NODE)
            skel.set_animation(rider_animation)
            set_prop(skel, "update_animation_in_editor", True)
            skel.play(False)
        except Exception as exc:
            log("Rider animation fallback: " + str(exc))

    rider = spawn_poseable_rider(heroine_mesh)

    # Lights tuned for rear and rear-three-quarter reference, with cold wet-road contrast.
    key = spawn_actor(unreal.DirectionalLight, unreal.Vector(-420.0, -520.0, 620.0), unreal.Rotator(-42.0, -36.0, 0.0), "Gate2_KeyLight_Cold")
    key_comp = key.get_component_by_class(unreal.DirectionalLightComponent)
    set_prop(key_comp, "mobility", unreal.ComponentMobility.MOVABLE)
    set_prop(key_comp, "intensity", 2.2)
    set_prop(key_comp, "light_color", unreal.LinearColor(0.62, 0.74, 1.0, 1.0))
    set_prop(key_comp, "cast_shadows", True)

    rim = spawn_actor(unreal.PointLight, unreal.Vector(-150.0, -175.0, 150.0), label="Gate2_MagentaRimLight")
    rim_comp = rim.get_component_by_class(unreal.PointLightComponent)
    set_prop(rim_comp, "mobility", unreal.ComponentMobility.MOVABLE)
    set_prop(rim_comp, "intensity", 110.0)
    set_prop(rim_comp, "attenuation_radius", 650.0)
    set_prop(rim_comp, "light_color", unreal.LinearColor(1.0, 0.05, 0.42, 1.0))

    fill = spawn_actor(unreal.PointLight, unreal.Vector(235.0, 215.0, 170.0), label="Gate2_CyanFillLight")
    fill_comp = fill.get_component_by_class(unreal.PointLightComponent)
    set_prop(fill_comp, "mobility", unreal.ComponentMobility.MOVABLE)
    set_prop(fill_comp, "intensity", 80.0)
    set_prop(fill_comp, "attenuation_radius", 720.0)
    set_prop(fill_comp, "light_color", unreal.LinearColor(0.25, 0.78, 1.0, 1.0))

    sky = spawn_actor(unreal.SkyLight, unreal.Vector(0.0, 0.0, 320.0), label="Gate2_SoftSkyLight")
    sky_comp = sky.get_component_by_class(unreal.SkyLightComponent)
    set_prop(sky_comp, "mobility", unreal.ComponentMobility.MOVABLE)
    set_prop(sky_comp, "intensity", 0.22)
    set_prop(sky_comp, "light_color", unreal.LinearColor(0.56, 0.68, 0.9, 1.0))

    handoff_camera_location = unreal.Vector(-430.0, -250.0, 118.0)
    handoff_camera_target = unreal.Vector(-16.0, 0.0, 82.0)
    handoff_camera = spawn_actor(
        unreal.CameraActor,
        handoff_camera_location,
        look_at(handoff_camera_location, handoff_camera_target),
        "Linxia_Rider_HandoffCamera",
    )
    set_prop(handoff_camera.camera_component, "field_of_view", 36.0)

    side_camera_location = unreal.Vector(-40.0, -520.0, 145.0)
    side_camera = spawn_actor(
        unreal.CameraActor,
        side_camera_location,
        look_at(side_camera_location, unreal.Vector(-35.0, 0.0, 105.0)),
        "Linxia_Rider_SideCamera",
    )
    set_prop(side_camera.camera_component, "field_of_view", 38.0)

    rear_camera_location = unreal.Vector(-480.0, 0.0, 130.0)
    rear_camera = spawn_actor(
        unreal.CameraActor,
        rear_camera_location,
        look_at(rear_camera_location, unreal.Vector(-25.0, 0.0, 100.0)),
        "Linxia_Rider_RearCamera",
    )
    set_prop(rear_camera.camera_component, "field_of_view", 34.0)

    try:
        unreal.get_editor_subsystem(unreal.EditorActorSubsystem).set_selected_level_actors([])
    except Exception:
        pass
    unreal.EditorLevelLibrary.set_level_viewport_camera_info(
        handoff_camera.get_actor_location(),
        handoff_camera.get_actor_rotation(),
    )

    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    log("Saved Gate 2 rider / motorcycle proxy level: " + LEVEL_PATH)


setup_level()
