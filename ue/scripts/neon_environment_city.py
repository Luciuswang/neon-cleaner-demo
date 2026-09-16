"""Elevated industrial expressway, in centimetres along the +X route.

The integrator runs this through create_linxia_motorcycle_chase_level.py.
Repeated meshes are batched by 100 m sector/material, with persistent editor
instance components. No transient Python-owned components or generated BPs.
"""

from collections import defaultdict
import math
import random

import unreal


START_X = -2000
END_X = 110000
ROAD_WIDTH = 1200
ROAD_Z = -5
ROAD_THICKNESS = 6
SEED = 9142026
ACTOR_BUDGET = 750
INSTANCE_BUDGET = 30000
LIGHT_BUDGET = 64
GROUND_Z = -1800


def load_meshes():
    meshes = {}
    for key, name in (("box", "Cube"), ("cylinder", "Cylinder"), ("sphere", "Sphere")):
        meshes[key] = unreal.EditorAssetLibrary.load_asset(
            f"/Engine/BasicShapes/{name}.{name}"
        )
        if meshes[key] is None:
            raise RuntimeError("Missing engine primitive " + name)
    return meshes


def instance_component(actor):
    # The same persistent subobject API is used by the repo's rider generator.
    subsystem = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
    library = unreal.SubobjectDataBlueprintFunctionLibrary
    handles = subsystem.k2_gather_subobject_data_for_instance(actor)
    parent = next(h for h in handles if library.is_root_component(library.get_data(h)))
    handle, reason = subsystem.add_new_subobject(unreal.AddNewSubobjectParams(
        parent_handle=parent, new_class=unreal.InstancedStaticMeshComponent.static_class(),
        blueprint_context=None
    ))
    if not reason.is_empty():
        raise RuntimeError("Cannot create persistent environment instances: " + str(reason))
    return library.get_associated_object(library.get_data(handle))


class City:
    def __init__(self, meshes, materials):
        self.meshes = meshes
        self.materials = materials
        self.rng = random.Random(SEED)
        self.batches = defaultdict(list)
        self.actor_count = 0
        self.instance_count = 0
        self.light_count = 0
        self.z_offset = 0

    def spawn(self, cls, label, xyz, rotation=(0, 0, 0)):
        actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
            cls, unreal.Vector(xyz[0], xyz[1], xyz[2] + self.z_offset),
            unreal.Rotator(pitch=rotation[0], yaw=rotation[1], roll=rotation[2])
        )
        if actor is None:
            raise RuntimeError("Cannot spawn " + label)
        actor.set_actor_label(label)
        actor.set_actor_location(unreal.Vector(xyz[0], xyz[1], xyz[2] + self.z_offset), False, True)
        actor.set_editor_property("tags", [unreal.Name("NeonEnvironment")])
        self.actor_count += 1
        if self.actor_count > ACTOR_BUDGET:
            raise RuntimeError("Environment actor budget exceeded")
        return actor

    def solid(self, label, material, xyz, size, collision=False, shape="box", rotation=(0, 0, 0)):
        actor = self.spawn(unreal.StaticMeshActor, label, xyz, rotation)
        component = actor.static_mesh_component
        component.set_static_mesh(self.meshes[shape])
        component.set_material(0, self.materials[material])
        actor.set_actor_scale3d(unreal.Vector(*(s / 100 for s in size)))
        component.set_collision_profile_name("BlockAll" if collision else "NoCollision")
        component.set_collision_enabled(unreal.CollisionEnabled.QUERY_AND_PHYSICS if collision
                                        else unreal.CollisionEnabled.NO_COLLISION)
        component.set_mobility(unreal.ComponentMobility.STATIC)
        return actor

    def part(self, material, xyz, size, rotation=(0, 0, 0), shape="box", shadow=True, distant=False):
        if min(size) <= 0:
            raise ValueError("Environment part has nonpositive dimensions")
        sector = max(0, int((xyz[0] - START_X) // 10000))
        key = (sector, material, shape, shadow, distant)
        self.batches[key].append(unreal.Transform(
            location=unreal.Vector(xyz[0], xyz[1], xyz[2] + self.z_offset),
            rotation=unreal.Rotator(pitch=rotation[0], yaw=rotation[1], roll=rotation[2]),
            scale=unreal.Vector(*(s / 100 for s in size))
        ))
        self.instance_count += 1
        if self.instance_count > INSTANCE_BUDGET:
            raise RuntimeError("Environment instance budget exceeded")

    def beam(self, material, a, b, width, depth=None):
        delta = [b[i] - a[i] for i in range(3)]
        length = math.sqrt(sum(v * v for v in delta))
        rotation = unreal.MathLibrary.find_look_at_rotation(unreal.Vector(*a), unreal.Vector(*b))
        self.part(material, tuple((a[i] + b[i]) / 2 for i in range(3)),
                  (length, width, depth or width),
                  (rotation.pitch, rotation.yaw, rotation.roll))

    def text(self, label, content, xyz, size=64, yaw=180, color=(200, 215, 213)):
        actor = self.spawn(unreal.TextRenderActor, label, xyz, (0, yaw, 0))
        component = actor.get_component_by_class(unreal.TextRenderComponent)
        component.set_text(unreal.Text(content))
        component.set_world_size(size)
        component.set_horizontal_alignment(unreal.HorizTextAligment.EHTA_CENTER)
        component.set_text_render_color(unreal.Color(*color, 255))
        component.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
        return actor

    def camera(self, label, xyz, target, fov):
        rotation = unreal.MathLibrary.find_look_at_rotation(unreal.Vector(*xyz), unreal.Vector(*target))
        actor = self.spawn(unreal.CameraActor, label, xyz, (rotation.pitch, rotation.yaw, rotation.roll))
        actor.camera_component.set_editor_property("field_of_view", float(fov))
        # All cameras inherit the unbound volume's manual exposure.
        actor.camera_component.set_editor_property("post_process_blend_weight", 0.0)
        return actor

    def flush(self):
        for index, (key, transforms) in enumerate(sorted(self.batches.items())):
            sector, material, shape, shadow, distant = key
            actor = self.spawn(unreal.StaticMeshActor, f"NC_Instances_{sector:02d}_{material}_{index}", (0, 0, 0))
            actor.static_mesh_component.set_mobility(unreal.ComponentMobility.STATIC)
            actor.static_mesh_component.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
            component = instance_component(actor)
            component.set_static_mesh(self.meshes[shape])
            component.set_material(0, self.materials[material])
            component.set_mobility(unreal.ComponentMobility.STATIC)
            component.set_collision_profile_name("NoCollision")
            component.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
            component.set_editor_property("cast_shadow", shadow)
            component.set_editor_property("affect_distance_field_lighting", shadow)
            component.set_cull_distances(0, 0 if distant else (42000 if shadow else 24000))
            component.add_instances(transforms, False, True, False)
        self.batches.clear()

    def road(self):
        for label, left, right in (("Gate3_Road_Main", START_X, 30000),
                                   ("Gate3_Road_Extension", 30000, END_X)):
            self.solid(label, "road", ((left + right) / 2, 0, ROAD_Z),
                       (right - left, ROAD_WIDTH, ROAD_THICKNESS), collision=True)
        # Continuous deck with believable 1.8 m deep box girders over an 18 m drop.
        self.solid("NC_RoadSubstructure", "concrete", (54000, 0, -47), (112000, 1560, 78), True)
        for y in (-470, 470):
            self.part("concrete", (54000, y, -145), (112000, 200, 150))
        for x in range(-1000, END_X, 3200):
            self.part("concrete", (x, 0, -265), (260, 1510, 150))
            for y in (-430, 430):
                self.part("concrete", (x, y, (GROUND_Z - 330) / 2), (175, 210, -GROUND_Z - 330))
                self.part("concrete", (x, y, GROUND_Z + 70), (380, 430, 140))
                self.part("rubber", (x, y, -194), (150, 180, 18))
        self.solid("NC_LowerCityGround", "concrete", (54000, -6500, GROUND_Z - 30),
                   (140000, 16000, 60))
        self.solid("NC_BridgeWaterBelow", "water", (54000, 15000, GROUND_Z - 65),
                   (140000, 27000, 20))
        for x in range(2000, END_X, 13000):
            self.part("road", (x, -4000, GROUND_Z + 2), (1350, 20000, 8))
            for y in range(-13000, 6000, 700):
                self.part("paint", (x, y, GROUND_Z + 7), (10, 280, 1), shadow=False)
        # Expansion joints and concrete safety parapets define a highway deck.
        for x in range(START_X, END_X, 3200):
            self.part("rubber", (x, 0, -1), (12, 1200, 1), shadow=False)
        for x in range(START_X, END_X, 800):
            for side in (-1, 1):
                self.part("concrete", (x + 398, side * 684, 39), (792, 60, 80))
                self.part("concrete", (x + 398, side * 677, 86), (792, 32, 20))
                self.part("amber", (x + 398, side * 650, 83), (12, 3, 8), shadow=False)
        for x in range(START_X, END_X, 2000):
            for side in (-1, 1):
                self.part("concrete", (x + 1000, side * 790, 8), (2000, 380, 20))
                self.part("shoulder", (x + 1000, side * 552, -1.6), (2000, 94, 0.6), shadow=False)
                self.part("paint", (x + 1000, side * 493, -1.1), (2000, 9, 0.5), shadow=False)
                self.part("steel", (x + 1000, side * 620, 66), (2000, 12, 28))
                self.part("steel", (x + 1000, side * 620, 39), (2000, 10, 8))
                for offset in (250, 750, 1250, 1750):
                    self.part("steel", (x + offset, side * 632, 40), (9, 12, 84))
                self.part("paint", (x + 1000, side * 611, 70), (26, 3, 8), shadow=False)
                self.part("rubber", (x + 450, side * 565, -0.8), (90, 46, 0.8), shadow=False)
                for grate in range(7):
                    self.part("steel", (x + 414 + grate * 12, side * 565, -0.2),
                              (4, 43, 0.5), shadow=False)
            for offset in (200, 1000):
                self.part("paint", (x + offset, 0, -1.4), (290, 10, 0.5), shadow=False)
        # Low continuous collision boundaries have no damage tags. Their tops
        # coincide with the rail, and their inner faces are outside road width.
        for side in (-1, 1):
            boundary = self.solid("NC_ContinuousBoundary_" + str(side), "steel",
                                  (54000, side * 625, 39), (112000, 26, 82), True)
            boundary.set_actor_hidden_in_game(True)
            boundary.static_mesh_component.set_editor_property("cast_shadow", False)

    def puddles(self):
        # Broad, flat ellipses reinforce speed and wet-road continuity without
        # adding collision or obscuring the route markings.
        puddles = (
            (-250, -185, 360, 155, -8), (380, 205, 470, 190, 5),
            (1050, -45, 620, 220, -3), (4100, 265, 510, 160, 7),
            (9200, -260, 740, 210, -6), (13700, 120, 560, 180, 4),
            (20200, 290, 780, 205, -5), (27100, -210, 630, 190, 8),
            (33600, 40, 880, 240, -2), (39800, -280, 520, 175, 6),
            (47200, 220, 690, 200, -7), (53600, -70, 920, 230, 3),
            (61200, 275, 640, 180, -5), (68800, -180, 760, 215, 6),
            (75400, 70, 520, 185, -4), (83100, -270, 850, 225, 5),
            (90700, 180, 700, 205, -6), (97200, -80, 960, 235, 2),
            (104500, 250, 600, 190, -5),
        )
        for x, y, length, width, yaw in puddles:
            self.part("puddle", (x, y, -0.75), (length, width, 0.45),
                      (0, yaw, 0), "cylinder", shadow=False)

    def building(self, x, side, width, depth, floors, setback=0):
        height = floors * 320 + 100
        y = side * (1180 + setback + depth / 2)
        face = y - side * (depth / 2 + 4)
        material = self.rng.choice(("facade", "concrete", "facade"))
        self.part(material, (x, y, height / 2 + 18), (width, depth, height))
        self.part("steel", (x, y, height + 30), (width + 40, depth + 40, 28))
        # Plinth, shadow reveals, recessed window bays and visible floor slabs.
        self.part("steel", (x, face, 95), (width + 8, 20, 154))
        columns = max(2, int(width / 260))
        pitch = width / columns
        for floor in range(floors):
            z = 260 + floor * 320
            self.part("concrete", (x, face - side * 12, z - 125), (width + 32, 32, 26))
            for col in range(columns):
                wx = x - width / 2 + pitch * (col + 0.5)
                self.part("steel", (wx, face - side * 12, z), (pitch - 36, 18, 202), shadow=False)
                window = self.rng.choices(("glass", "window", "cool_window"), (0.63, 0.29, 0.08))[0]
                self.part(window, (wx, face - side * 23, z), (pitch - 58, 6, 174), shadow=False)
                self.part("steel", (wx, face - side * 28, z), (6, 9, 182), shadow=False)
        for edge in (-1, 1):
            self.part("concrete", (x + edge * (width / 2 - 26), face - side * 22, height / 2),
                      (48, 36, height))
        # Roof plant and parapets break the skyline without floating massing.
        self.part("steel", (x + width * 0.17, y, height + 112), (width * 0.36, 210, 145))
        self.part("concrete", (x, face + side * 16, height + 86), (width + 24, 35, 120))
        self.part("steel", (x - width * 0.31, face - side * 30, height / 2),
                  (12, 12, height), shape="cylinder")
        if floors <= 5:
            self.part("steel", (x, face - side * 100, 310), (width * 0.65, 200, 18), (side * 4, 0, 0))
            self.part("glass", (x, face - side * 20, 160), (220, 12, 270))
            for bar in range(5):
                self.part("steel", (x, face - side * 28, 65 + bar * 45), (220, 6, 7), shadow=False)

    def architecture(self):
        for side in (-1, 1):
            for i, x in enumerate(range(-1000, 35000, 2300)):
                self.building(x, side, self.rng.randint(1100, 1750), self.rng.randint(750, 1300),
                              self.rng.randint(3, 9), self.rng.randint(0, 280))
            for x in range(36000, 61000, 3900):
                # Waterfront is open on the right, allowing the sky/water to read.
                if side < 0:
                    self.building(x, side, 2100, 1800, self.rng.randint(2, 4), 250)
            for x in (64500, 84500, 104000):
                if side < 0:
                    self.building(x, side, 3200, 2300, 2, 700)
        for side in (-1, 1):
            for x in range(2000, 114000, 6500):
                h = self.rng.randint(3200, 8500)
                y = side * self.rng.randint(6000, 11000)
                width = self.rng.randint(1800, 3200)
                self.part("far", (x, y, h / 2 - 200), (width, 2200, h), distant=True)
                self.part("steel", (x, y, h - 50), (width * 0.65, 1200, 400), distant=True)
                for z in range(600, h - 300, 900):
                    self.part("glass", (x, y - side * 1108, z), (width * 0.88, 8, 90),
                              shadow=False, distant=True)

    def damaged_city_dressing(self):
        # Broken infrastructure stays beyond the collision rail, preserving a
        # clean gameplay lane while giving each district a post-war silhouette.
        for x, side, span, rise in (
            (8400, -1, 2600, 1550), (26800, 1, 3100, 2100),
            (36500, -1, 2400, 1800), (82500, -1, 3400, 2400),
            (95500, 1, 2800, 1950),
        ):
            y = side * 1850
            self.beam("steel", (x - span / 2, y, 120), (x + span / 2, y + side * 430, rise), 54)
            self.beam("concrete", (x - span * 0.3, y + side * 160, 120),
                      (x + span * 0.1, y - side * 230, rise * 0.7), 115)
            self.part("steel", (x + span * 0.32, y, 310), (55, 55, 620), (0, 14 * side, 0))
            for shard in range(6):
                self.part(
                    "rubber",
                    (x - 420 + shard * 165, y - side * (90 + shard * 34), 35 + shard * 9),
                    (150 + shard * 25, 65, 42),
                    (self.rng.randint(-12, 12), self.rng.randint(-28, 28), 0),
                )

    def broken_suspension_bridge(self):
        # A distant, incomplete bay crossing anchors the waterfront district
        # without competing with the chase corridor or requiring external art.
        y = 15400
        tower_xs = (45500, 65500)
        deck_z = 720
        for tower_x in tower_xs:
            for side in (-1, 1):
                tower_y = y + side * 620
                self.part("far", (tower_x, tower_y, 3300), (260, 310, 6600), distant=True)
                self.part("steel", (tower_x, tower_y, 6500), (440, 500, 160), distant=True)
                self.part("steel", (tower_x, tower_y, 4200), (420, 460, 140), distant=True)
            self.part("steel", (tower_x, y, 4210), (280, 1500, 150), distant=True)
            self.part("steel", (tower_x, y, 6500), (280, 1500, 170), distant=True)
        self.part("concrete", (50500, y, deck_z), (9700, 850, 130), distant=True)
        self.part("concrete", (61300, y, deck_z - 150), (6400, 850, 130),
                  (0, -3, 0), distant=True)
        cable_points = []
        for step in range(21):
            alpha = step / 20.0
            x = tower_xs[0] + (tower_xs[1] - tower_xs[0]) * alpha
            z = 6500 - math.sin(alpha * math.pi) * 4700
            cable_points.append((x, y, z))
        for side in (-1, 1):
            for a, b in zip(cable_points, cable_points[1:]):
                self.beam("steel", (a[0], y + side * 520, a[2]),
                          (b[0], y + side * 520, b[2]), 32)
            for x in range(46500, 64501, 1000):
                alpha = (x - tower_xs[0]) / (tower_xs[1] - tower_xs[0])
                cable_z = 6500 - math.sin(alpha * math.pi) * 4700
                if not 55200 < x < 58500:
                    self.beam("steel", (x, y + side * 520, deck_z + 70),
                              (x, y + side * 520, cable_z), 18)

    def container(self, x, y, z=18, gray=False):
        mat = "container_gray" if gray else "container"
        self.part(mat, (x, y, z + 130), (605, 244, 260))
        for side in (-1, 1):
            for i in range(19):
                self.part(mat, (x - 282 + i * 31, y + side * 125, z + 130), (9, 8, 235), shadow=False)
            for height in (12, 250):
                self.part("steel", (x, y + side * 126, z + height), (607, 12, 16))
            for yy in (-108, 108):
                self.part("steel", (x + side * 298, y + yy, z + 130), (16, 16, 260))
        for yy in (-58, 58):
            self.part("steel", (x - 307, y + yy, z + 130), (8, 5, 220), shadow=False)
            self.part("paint", (x - 308, y + yy, z + 196), (3, 58, 28), shadow=False)

    def truck(self, x, y):
        # Grounded six-wheel delivery vehicle, with cab, glazing, chassis and lamps.
        self.part("steel", (x, y, 75), (650, 215, 38))
        self.part("vehicle", (x + 220, y, 144), (180, 220, 170))
        self.part("glass", (x + 313, y, 178), (7, 188, 66), (0, 0, 0))
        self.part("steel", (x + 320, y, 83), (25, 232, 32))
        self.part("container_gray", (x - 100, y, 204), (420, 238, 270))
        for side in (-1, 1):
            self.part("glass", (x + 225, y + side * 113, 182), (133, 6, 72), shadow=False)
            self.part("steel", (x + 290, y + side * 140, 175), (28, 24, 40))
            for axle in (-230, -110, 230):
                self.part("rubber", (x + axle, y + side * 111, 40), (84, 84, 28),
                          (0, 0, 90), "cylinder")
                self.part("steel", (x + axle, y + side * 128, 40), (42, 42, 5),
                          (0, 0, 90), "cylinder", shadow=False)
            self.part("amber", (x + 337, y + side * 78, 114), (4, 36, 17), shadow=False)
            self.part("magenta", (x - 315, y + side * 86, 81), (4, 24, 14), shadow=False)
            for rail in range(8):
                self.part("steel", (x - 290 + rail * 52, y + side * 121, 204),
                          (7, 5, 250), shadow=False)

    def roadside(self):
        for x, y in ((2200, -930), (12300, 940), (28700, -950), (50600, -970),
                     (66200, 1020), (81900, -1050), (98000, 1100)):
            self.truck(x, y)
        for x in range(62000, 108000, 3200):
            for side in (-1, 1):
                for row in range(2):
                    xx = x + self.rng.randint(-160, 160)
                    yy = side * (1650 + row * 640)
                    self.container(xx, yy, gray=(x // 3200 + row) % 3 == 0)
                    if self.rng.random() > 0.45:
                        self.container(xx, yy, 280, gray=True)
        for x in range(500, END_X, 4300):
            self.part("steel", (x, -870, 118), (80, 130, 200))
            self.part("yellow", (x - 41, -870, 153), (3, 58, 36), shadow=False)
            self.part("rubber", (x + 100, -870, 63), (60, 60, 90), shape="cylinder")
        for index, x in enumerate(range(3500, END_X, 6200)):
            side = -1 if index % 2 == 0 else 1
            accent = "cyan" if index % 3 else "magenta"
            self.part(accent, (x, side * 611, 73), (860, 4, 6), shadow=False)
        self.text("NC_FirstBlockIdentity", "NORTH QUAY / 09", (1500, -1170, 550), 90, 90)
        self.part("steel", (1500, -1180, 575), (1100, 20, 180))
        self.part("cyan", (1500, -1165, 480), (1060, 8, 8), shadow=False)

    def gantry(self, x, label, sign):
        for side in (-1, 1):
            self.part("steel", (x, side * 875, 425), (45, 45, 850))
            self.part("concrete", (x, side * 875, 45), (110, 110, 90))
        self.part("steel", (x, 0, 840), (55, 1795, 60))
        self.part("container", (x - 35, 0, 724), (22, 980, 190))
        self.part("paint", (x - 48, 0, 635), (3, 955, 8), shadow=False)
        self.text(label, sign, (x - 50, 0, 730), 68)

    def crane(self, x, y):
        for dx in (-800, 800):
            for dy in (-650, 650):
                self.part("steel", (x + dx, y + dy, 1320), (80, 80, 2600))
            self.beam("yellow", (x + dx, y - 650, 400), (x + dx, y + 650, 2250), 55)
        self.part("steel", (x, y, 2630), (1850, 1420, 125))
        self.part("yellow", (x, y - 1000, 2890), (90, 5500, 100))
        self.part("steel", (x, y - 900, 3150), (65, 5300, 50))
        for i in range(9):
            yy = y - 3500 + i * 600
            self.beam("steel", (x, yy, 2900), (x, yy + 580, 3150), 25)
        self.part("vehicle", (x - 150, y - 760, 2520), (270, 270, 220))
        self.part("glass", (x - 292, y - 760, 2550), (8, 230, 120), shadow=False)
        self.part("steel", (x, y - 2850, 2220), (8, 8, 1300))
        self.part("yellow", (x, y - 2850, 1550), (130, 240, 60))

    def landmarks(self):
        self.gantry(4200, "NC_ElevatedEntry_Sign", "NORTH VIADUCT  /  PORT 09")
        self.gantry(18000, "NC_Encounter01_Sign", "01   NORTH QUAY")
        self.gantry(75000, "NC_Encounter03_Sign", "03   CONTAINER TERMINAL")
        self.gantry(100000, "NC_Finish_Sign", "PORT 09   /   CUSTOMS")
        # A real cross-route overpass at 450 m, with generous riding clearance.
        self.part("concrete", (45000, 0, 1150), (2400, 14500, 180))
        for x in (44000, 46000):
            self.part("steel", (x, 0, 1015), (90, 14500, 100))
            for y in (-4800, -1250, 1250, 4800):
                self.part("concrete", (x, y, 500), (130, 210, 1000))
                self.part("yellow", (x - 68, y, 200), (6, 216, 60), shadow=False)
        for y in range(-6800, 7200, 800):
            self.part("steel", (45000, y, 1300), (2460, 12, 110))
        self.text("NC_Encounter02_Sign", "02 / VIADUCT", (43785, 0, 1150), 86)
        # Harbor and cranes belong at city ground level below the expressway.
        self.z_offset = GROUND_Z
        self.part("water", (55500, 10500, -170), (52000, 18000, 20), distant=True, shadow=False)
        self.part("concrete", (55500, 1200, -180), (52000, 260, 400), distant=True)
        for x in range(30500, 80000, 1500):
            self.part("steel", (x, 1315, -30), (55, 55, 250), shape="cylinder")
            self.part("rubber", (x, 1350, -120), (130, 130, 45), (0, 0, 90), "cylinder")
        for x, y in ((74000, 4900), (90500, 5200), (103000, 5100)):
            self.crane(x, y)
        self.z_offset = 0
        # Terminal checkpoint cabins flank the through route at the finish.
        for side in (-1, 1):
            self.part("concrete", (100500, side * 1160, 170), (560, 420, 340))
            self.part("glass", (100213, side * 1160, 205), (8, 330, 130))
            self.part("steel", (100500, side * 1160, 355), (620, 480, 30))
        for dx in range(0, 600, 100):
            for side in (-1, 1):
                self.part("paint", (100000 + dx, side * 340, -1.2), (45, 250, 0.5), shadow=False)
        self.z_offset = GROUND_Z
        self.broken_suspension_bridge()
        self.z_offset = 0

    def hazards(self):
        specs = (("Gate3_Debris_01", 15500, -345), ("Gate3_Debris_02", 24800, 340),
                 ("Gate3_LaneShift_01", 42800, -330), ("Gate3_LaneShift_02", 58300, 335),
                 ("Gate3_FinalDebris_01", 72600, -340), ("Gate3_FinalDebris_02", 89100, 340))
        for label, x, y in specs:
            actor = self.solid(label, "concrete", (x, y, 46), (240, 110, 96), True)
            actor.set_editor_property("tags", [unreal.Name("NeonEnvironment"), unreal.Name("NeonChaseObstacle")])
            self.part("yellow", (x - 122, y, 52), (4, 108, 60), shadow=False)
            for offset in (-34, 0, 34):
                self.part("rubber", (x - 125, y + offset, 52), (3, 15, 59), (0, 0, 18), shadow=False)
            self.part("amber", (x, y, 103), (24, 24, 12), shadow=False)
        # Legacy validator contract only. Gameplay owns the visible convoy.
        for label, z in (("Gate3_ChaseTarget_Body", 80), ("Gate3_ChaseTarget_Signal", 110)):
            marker = self.solid(label, "steel", (4350, 0, z), (8, 8, 8))
            marker.set_actor_hidden_in_game(True)
            marker.static_mesh_component.set_editor_property("cast_shadow", False)
            if label.endswith("Body"):
                marker.set_editor_property("tags", [unreal.Name("Gate3ChaseTarget"), unreal.Name("NeonEnvironment")])

    def spot(self, label, xyz, target, lumens=6500, color=(1.0, 0.73, 0.44), shadow=False):
        rotation = unreal.MathLibrary.find_look_at_rotation(unreal.Vector(*xyz), unreal.Vector(*target))
        actor = self.spawn(unreal.SpotLight, label, xyz, (rotation.pitch, rotation.yaw, rotation.roll))
        light = actor.get_component_by_class(unreal.SpotLightComponent)
        light.set_mobility(unreal.ComponentMobility.MOVABLE)
        light.set_intensity_units(unreal.LightUnits.LUMENS)
        light.set_intensity(lumens)
        light.set_light_color(unreal.LinearColor(*color, 1), False)
        light.set_editor_property("attenuation_radius", 2600.0)
        light.set_editor_property("inner_cone_angle", 48.0)
        light.set_editor_property("outer_cone_angle", 68.0)
        light.set_editor_property("source_radius", 14.0)
        light.set_editor_property("soft_source_radius", 25.0)
        light.set_editor_property("cast_shadows", shadow)
        light.set_editor_property("max_draw_distance", 14000.0)
        light.set_editor_property("max_distance_fade_range", 2200.0)
        light.set_editor_property("volumetric_scattering_intensity", 0.25)
        self.light_count += 1
        if self.light_count > LIGHT_BUDGET:
            raise RuntimeError("Environment local-light budget exceeded")

    def lighting(self):
        dome = self.solid("NC_BlueGraySky", "sky", (54000, 0, 0),
                          (900000, 900000, 900000), shape="sphere")
        dome.static_mesh_component.set_editor_property("cast_shadow", False)
        dome.static_mesh_component.set_editor_property("affect_distance_field_lighting", False)
        key = self.spawn(unreal.DirectionalLight, "Gate3_KeyLight_Cold", (0, 0, 2000), (-24, -35, 0))
        light = key.get_component_by_class(unreal.DirectionalLightComponent)
        light.set_mobility(unreal.ComponentMobility.MOVABLE)
        light.set_intensity(2.2)
        light.set_light_color(unreal.LinearColor(0.52, 0.65, 1.0, 1), False)
        light.set_editor_property("light_source_angle", 5.0)
        sky = self.spawn(unreal.SkyLight, "Gate3_SkyLight", (0, 0, 3000))
        sky_light = sky.get_component_by_class(unreal.SkyLightComponent)
        sky_light.set_mobility(unreal.ComponentMobility.MOVABLE)
        sky_light.set_intensity(0.65)
        sky_light.set_editor_property("sky_distance_threshold", 150000.0)
        sky_light.set_editor_property("lower_hemisphere_is_black", True)
        sky_light.set_editor_property("real_time_capture", True)

        for i, x in enumerate(range(-500, END_X, 2200)):
            side = -1 if i % 2 == 0 else 1
            self.part("steel", (x, side * 810, 430), (18, 18, 860), shape="cylinder")
            self.part("concrete", (x, side * 810, 40), (80, 80, 80))
            self.beam("steel", (x, side * 810, 850), (x, side * 430, 890), 15)
            self.part("steel", (x, side * 420, 884), (100, 42, 16))
            self.part("amber", (x, side * 420, 873), (76, 26, 5), shadow=False)
            self.spot(f"NC_Streetlight_{i:02d}", (x, side * 420, 865), (x + 100, 0, 0))
        # Broad neutral start fill keeps Kelly readable and is motivated by a
        # warehouse flood fixture beside the launch bay, not a camera point light.
        self.part("steel", (-250, -1050, 590), (90, 40, 42))
        self.part("paint", (-250, -1025, 590), (70, 4, 24), shadow=False)
        self.spot("NC_StartWarehouseFlood", (-250, -1020, 580), (700, 0, 40),
                  4800, (0.79, 0.86, 1), shadow=True)
        for x in (44600, 45400):
            self.part("amber", (x, 0, 1005), (220, 32, 6), shadow=False)
            self.spot("NC_ViaductFlood_" + str(x), (x, 0, 990), (x, 0, 0), 7500)
        fog = self.spawn(unreal.ExponentialHeightFog, "Gate3_NightMist", (0, 0, -80))
        fog_component = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
        fog_component.set_editor_property("fog_density", 0.018)
        fog_component.set_editor_property("fog_height_falloff", 0.18)
        fog_component.set_editor_property("start_distance", 600.0)
        fog_component.set_editor_property("fog_max_opacity", 0.82)
        fog_component.set_fog_inscattering_color(
            unreal.LinearColor(0.05, 0.075, 0.11, 1)
        )
        fog_component.set_volumetric_fog(True)
        fog_component.set_volumetric_fog_distance(22000.0)

        volume = self.spawn(unreal.PostProcessVolume, "NC_ManualNightExposure", (0, 0, 0))
        volume.set_editor_property("unbound", True)
        volume.set_editor_property("priority", 100.0)
        settings = volume.get_editor_property("settings")
        overrides = {
            "auto_exposure_method": unreal.AutoExposureMethod.AEM_MANUAL,
            "auto_exposure_apply_physical_camera_exposure": False,
            "auto_exposure_bias": -0.75,
            "bloom_intensity": 0.38,
            "bloom_threshold": 1.0,
            "vignette_intensity": 0.18,
            "motion_blur_amount": 0.18,
            "screen_space_reflection_intensity": 80.0,
            "screen_space_reflection_quality": 70.0,
            "screen_space_reflection_max_roughness": 0.65,
        }
        for name, value in overrides.items():
            settings.set_editor_property("override_" + name, True)
            settings.set_editor_property(name, value)
        volume.set_editor_property("settings", settings)

    def build(self):
        self.road()
        # Wetness is blended in the PBR road shader; separate perfect discs read
        # as decals/geometry and introduce artificial edges in hero frames.
        self.z_offset = GROUND_Z
        self.architecture()
        self.damaged_city_dressing()
        self.roadside()
        self.z_offset = 0
        self.landmarks()
        self.hazards()
        self.lighting()
        self.flush()
        self.camera("NC_ElevatedHighwayEvidence", (-2400, -3400, 1500), (1600, 0, -700), 66)
        unreal.log(f"[NeonEnvironment] elevated_deck_z=-2 lower_ground_z={GROUND_Z} clearance_cm={-GROUND_Z-330}")
        unreal.log(f"[NeonEnvironment] seed={SEED} route={START_X}..{END_X}cm "
                   f"road={ROAD_WIDTH}cm actors={self.actor_count} "
                   f"instances={self.instance_count} local_lights={self.light_count}")
