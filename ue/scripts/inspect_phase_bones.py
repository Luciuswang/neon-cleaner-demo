import unreal


MESH_PATH = "/Game/ParagonPhase/Characters/Heroes/Phase/Meshes/Phase_GDC.Phase_GDC"


def main():
    mesh = unreal.EditorAssetLibrary.load_asset(MESH_PATH)
    if not mesh:
        raise RuntimeError("Unable to load mesh: " + MESH_PATH)
    seen = set()
    roots = ["root", "Root", "pelvis", "Pelvis", "b_root"]

    def visit(name, depth=0):
        if name in seen:
            return
        seen.add(name)
        lower = name.lower()
        if any(token in lower for token in ["pelvis", "spine", "thigh", "calf", "foot", "clavicle", "upperarm", "lowerarm", "hand", "neck", "head", "root"]):
            try:
                parent = mesh.get_bone_parent(name)
            except Exception:
                parent = "<unknown>"
            unreal.log(f"[PhaseBones] {depth}: {name} parent={parent}")
        try:
            children = mesh.get_bone_children(name)
        except Exception:
            children = []
        for child in children:
            visit(str(child), depth + 1)

    for root in roots:
        visit(root)
    unreal.SystemLibrary.execute_console_command(None, "QUIT_EDITOR")


main()
