"""Create an isolated, private high-bike review map; never change active rider fit."""
import unreal

DEST = '/Game/CinematicBike/LVL_CinematicBike_AssetReview'
if unreal.EditorAssetLibrary.does_asset_exist(DEST):
    unreal.EditorLevelLibrary.load_level(DEST)
    for old_actor in unreal.EditorLevelLibrary.get_all_level_actors():
        if isinstance(old_actor, (unreal.Light, unreal.PostProcessVolume, unreal.StaticMeshActor)):
            unreal.EditorLevelLibrary.destroy_actor(old_actor)
else:
    unreal.EditorLevelLibrary.new_level(DEST)
for old_actor in unreal.EditorLevelLibrary.get_all_level_actors():
    if old_actor.get_actor_label() == 'HighBikeCandidate_NotRiderApproved':
        unreal.EditorLevelLibrary.destroy_actor(old_actor)
pawn = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.load_class(None, '/Script/NeonCleanerUE.LinxiaMotorcyclePawn'), unreal.Vector(0, 0, 0))
pawn.set_actor_label('HighBikeCandidate_NotRiderApproved')
for component in pawn.get_components_by_class(unreal.StaticMeshComponent):
    if component.get_name() == 'ImportedMotorcycle':
        component.set_static_mesh(unreal.load_asset('/Game/CinematicBike/SM_CinematicBike'))
        component.set_material(0, unreal.load_asset('/Game/CinematicBike/M_CinematicBike'))
        component.set_relative_location(unreal.Vector(0, 0, 0), False, False)
        component.set_relative_rotation(unreal.Rotator(pitch=0, yaw=0, roll=0), False, False)
        component.set_relative_scale3d(unreal.Vector(1, 1, 1))
    else:
        component.set_hidden_in_game(True)
pawn.get_component_by_class(unreal.PoseableMeshComponent).set_hidden_in_game(True)
for component in pawn.get_components_by_class(unreal.LightComponent):
    component.set_intensity(0)
ground = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, -6))
ground.static_mesh_component.set_static_mesh(unreal.load_asset('/Engine/BasicShapes/Cube'))
ground.static_mesh_component.set_material(0, unreal.load_asset('/Game/LinxiaChase/Materials/M_NC_ChaseConcrete'))
ground.set_actor_scale3d(unreal.Vector(30, 30, .1))
key = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 400), unreal.Rotator(pitch=-40, yaw=-35, roll=0))
key.get_component_by_class(unreal.DirectionalLightComponent).set_intensity(4)
key.get_component_by_class(unreal.DirectionalLightComponent).set_mobility(unreal.ComponentMobility.MOVABLE)
for position in [(-250, -250, 300), (200, 200, 300)]:
    light = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.PointLight, unreal.Vector(*position))
    light.point_light_component.set_intensity(1200)
    light.point_light_component.set_mobility(unreal.ComponentMobility.MOVABLE)
    light.point_light_component.set_editor_property('attenuation_radius', 1500)
volume = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 0))
volume.set_editor_property('unbound', True)
settings = volume.get_editor_property('settings')
for key, value in [('auto_exposure_method', unreal.AutoExposureMethod.AEM_MANUAL),
                   ('auto_exposure_apply_physical_camera_exposure', False), ('auto_exposure_bias', -3.0)]:
    settings.set_editor_property('override_' + key, True)
    settings.set_editor_property(key, value)
volume.set_editor_property('settings', settings)
unreal.EditorLevelLibrary.get_editor_world().get_world_settings().set_editor_property(
    'default_game_mode', unreal.load_class(None, '/Script/Engine.GameModeBase'))
unreal.EditorLevelLibrary.save_current_level()
unreal.log('[CinematicBikeReview] Created private isolated candidate view; active chase unchanged')
