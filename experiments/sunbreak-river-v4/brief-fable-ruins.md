Return one COMPLETE ES module, JavaScript only, max 160 lines. No markdown, prose,
tools, planning, imports or hidden work. Model contribution for a browser FPS.

export function fracturedSlab(T, width, height, thickness, seed=1) returns a
THREE.BufferGeometry. A weathered concrete/brick slab fragment that has a coherent
angular chipped silhouette with 6-9 outline vertices, real finite thickness,
front/back flat surfaces, differently oriented fractured edge facets, outward
winding/normals and UVs in metre coordinates. Include geometry groups: material0
for broad intact surface, material1 for rough fractured edges. Geometry centered
about x=0,y=0,z=0, lies in XY with thickness along Z. Bounding extent must fit
width/height/thickness, no degenerate faces, no random dependence outside seed.
Use actual closed manifold triangles (not overlapping thin planes or many boxes).
No material or scene effects, physics, allocations per frame, textures or globals.
Make broken edges angular rather than rounded stones; few triangular chips are
fine, triangles should be flat shaded with proper UVs and zero NaN. Keep shape
scale in metres. Main integrator will place/review/collide/batch meshes. Do not
implement terrain, gameplay, houses or placement. This is a static art geometry
contribution, not dynamic destruction. Include concise code comments for API.
