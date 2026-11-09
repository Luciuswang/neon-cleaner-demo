/* EXPERIMENTAL garment fitting. Run only in a separate 3dsmaxbatch process.
   Required -mxsString keys: bodyFbx, jacketFbx, outputDir (absolute paths).
   outputDir must not exist. No implicit source or workstation defaults.
   See fit_metahuman_jacket.md. Originals are imported read-only. */
(
fn requiredPath key = (
 -- 3dsmaxbatch registers Dictionary keys as MAXScript names, not strings.
 local value=try (maxOps.mxsCmdLineArgs[key as name]) catch (undefined)
 if value==undefined or (value as string)=="" do throw ("Missing -mxsString " + key)
 local pathClass=dotNetClass "System.IO.Path"
 if not (pathClass.IsPathRooted (value as string)) do throw ("Absolute path required: " + key)
 pathClass.GetFullPath (value as string)
)
local bodyPath=requiredPath "bodyFbx"
local jacketPath=requiredPath "jacketFbx"
local dst=requiredPath "outputDir"
local fileClass=dotNetClass "System.IO.File"
local dirClass=dotNetClass "System.IO.Directory"
for sourcePath in #(bodyPath,jacketPath) do (
 if not (fileClass.Exists sourcePath) do throw ("Missing input FBX: " + sourcePath)
 if toLower(getFilenameType sourcePath)!=".fbx" do throw ("Input must be FBX: " + sourcePath)
 if (getFileSize sourcePath)<=0 do throw ("Empty input FBX: " + sourcePath)
)
if toLower bodyPath==toLower jacketPath do throw "Body and jacket must be different files"
if (dirClass.Exists dst) or (fileClass.Exists dst) do throw "Refusing occupied outputDir; choose a new scratch directory"
dirClass.CreateDirectory dst
-- CreateNew is atomic: competing runs cannot both own this output directory.
local claim=dotNetObject "System.IO.FileStream" (dst + @"\.experiment.lock") (dotNetClass "System.IO.FileMode").CreateNew (dotNetClass "System.IO.FileAccess").Write (dotNetClass "System.IO.FileShare").None
resetMaxFile #noPrompt
units.SystemType = #centimeters
units.SystemScale = 1.0
local report = createFile (dst + @"\jacket-fit-experimental-report.txt")
try (
 format "Body %\nJacket %\nOutput %\n" bodyPath jacketPath dst to:report
 pluginManager.loadClass FBXIMP
 FBXImporterSetParam "Skin" true
 FBXImporterSetParam "Mode" #create
 format "FBX import Skin=% Mode=%\n" (FBXImporterGetParam "Skin") (FBXImporterGetParam "Mode") to:report
 importFile bodyPath #noPrompt using:FBXIMP
 local body = getNodeByName "Heroine_MetaHuman_FittingCopy_Body"
 if body==undefined do throw "Expected body mesh Heroine_MetaHuman_FittingCopy_Body missing"
 local bodySkin=undefined
 for md in body.modifiers where classOf md==Skin do bodySkin=md
 format "BODY_BEFORE_JACKET modifiers=% hasSkin=%\n" body.modifiers.count (bodySkin!=undefined) to:report
 if bodySkin==undefined do throw "Body import has no Skin; refusing jacket fitting"
 format "BODY_SKIN bones=% vertices=%\n" (skinOps.GetNumberBones bodySkin) (skinOps.GetNumberVertices bodySkin) to:report
 importFile jacketPath #noPrompt using:FBXIMP
 local bodySkinAfter=undefined
 for md in body.modifiers where classOf md==Skin do bodySkinAfter=md
 format "BODY_AFTER_JACKET modifiers=% hasSkin=%\n" body.modifiers.count (bodySkinAfter!=undefined) to:report
 if bodySkinAfter==undefined do (
  saveMaxFile (dst + @"\body-skin-lost-on-jacket-import.max") quiet:true
  throw "Jacket import removed body Skin; refusing garment fitting/transfer"
 )
 local jacket = getNodeByName "polySurface4"
 if jacket==undefined do throw "Expected jacket mesh polySurface4 missing"
 jacket.name = "Experimental_MetaHuman_LeatherJacket"
 format "Imported bounds % % transform % objectTransform %\n" jacket.min jacket.max jacket.transform jacket.objectTransform to:report
 local csv = createFile (dst + @"\jacket-fitted-world-vertices.csv")
 format "id,x,y,z\n" to:csv
 fn clamp01 x = (amax 0.0 (amin 1.0 x))
 fn smooth01 x = (local t=clamp01 x; t*t*(3-2*t))
 local originalCount = polyop.getNumVerts jacket
 local shoulderL=(getNodeByName "upperarm_l").pos
 local elbowL=(getNodeByName "lowerarm_l").pos
 local wristL=(getNodeByName "hand_l").pos
 local shoulderR=(getNodeByName "upperarm_r").pos
 local elbowR=(getNodeByName "lowerarm_r").pos
 local wristR=(getNodeByName "hand_r").pos
 local changedSleeves=0
 for i = 1 to polyop.getNumVerts jacket do (
  local p = (polyop.getVert jacket.baseObject i) * jacket.objectTransform
  local side=if p.x>=0 then 1.0 else -1.0
  local ax=abs p.x
  local torso=[p.x*0.8,p.y*0.85-5.0,(p.z-147.5)*0.8+133.0]
  local result=torso
  if ax>12.0 do (
   local shoulder=if side>0 then shoulderL else shoulderR
   local elbow=if side>0 then elbowL else elbowR
   local wrist=if side>0 then wristL else wristR
   local t=clamp01 ((ax-17.0)/42.3)
   local center=if t<0.5 then shoulder+(elbow-shoulder)*(t*2) else elbow+(wrist-elbow)*((t-0.5)*2)
   local blend=smooth01 ((t-0.38)/0.24)
   local direction=normalize ((normalize(elbow-shoulder))*(1-blend)+(normalize(wrist-elbow))*blend)
   local yaxis=normalize ([0,1,0]-direction*(dot [0,1,0] direction))
   local zaxis=(normalize(cross direction yaxis))*side
   local sleeve=center+yaxis*((p.y-8.0)*0.88)+zaxis*((p.z-147.5)*0.88)
   local attach=smooth01 ((ax-12.0)/11.0)
   result=torso*(1-attach)+sleeve*attach
   changedSleeves+=1
  )
  polyop.setVert jacket.baseObject i (result * inverse jacket.objectTransform)
  format "%,%,%,%\n" i result.x result.y result.z to:csv
 )
 update jacket
 close csv
 format "EXPERIMENTAL only. No visual/production acceptance.\nVertices % sleeveDeformed %\n" originalCount changedSleeves to:report
 format "Bounds % %\n" jacket.min jacket.max to:report
 saveMaxFile (dst + @"\jacket-fitted-UNSKINNED-experimental.max") quiet:true
 flush report
 local sw = Skin_Wrap()
 addModifier jacket sw
 sw.engine=1
 sw.falloff=0.2
 sw.distance=1.0
 sw.faceLimit=3
 sw.weightAllVerts=true
 sw.meshList=#(body)
 format "Wrap assigned meshList count % body % bodySkinModifiers %\n" sw.meshList.count body.name body.modifiers.count to:report
 select jacket
 max modify mode
 modPanel.setCurrentObject sw
 sw.meshDeformOps.fullReset()
 format "Wrap post-reset meshList count %\n" sw.meshList.count to:report
 update jacket
 local evaluated=snapshotAsMesh jacket
 format "Wrap evaluated vertices % controlPoints %\n" evaluated.numverts (sw.meshDeformOps.getNumberOfControlPoints 1) to:report
 free evaluated
 sw.meshDeformOps.ConvertToSkin true
 format "After conversion modifier count %\n" jacket.modifiers.count to:report
 for md in jacket.modifiers do format "Modifier %\n" (classOf md) to:report
 local skinMod=undefined
 for md in jacket.modifiers where classOf md==Skin do skinMod=md
 if skinMod==undefined then (
  saveMaxFile (dst + @"\jacket-fitted-FAILED-SKIN-WRAP-experimental.max") quiet:true
  throw "Skin Wrap did not create Skin; no skinned export. Unskinned fit preserved for inspection."
 )
 modPanel.setCurrentObject skinMod
 format "SkinBones % SkinVertices %\n" (skinOps.GetNumberBones skinMod) (skinOps.GetNumberVertices skinMod) to:report
 local unweighted=0
 local badsum=0
 local maxInfluences=0
 for i=1 to skinOps.GetNumberVertices skinMod do (
  local count=skinOps.GetVertexWeightCount skinMod i
  maxInfluences=amax maxInfluences count
  local total=0.0
  for k=1 to count do total+=skinOps.GetVertexWeight skinMod i k
  if total<0.00001 do unweighted+=1
  if abs(total-1.0)>0.001 do badsum+=1
 )
 format "unweighted % nonNormalized % maxInfluences %\n" unweighted badsum maxInfluences to:report
 if unweighted>0 or badsum>0 or (skinOps.GetNumberVertices skinMod)!=originalCount do throw "Skin coverage/normalization invalid; refusing skinned export"
 for b=1 to skinOps.GetNumberBones skinMod do format "Bone % %\n" b (skinOps.GetBoneName skinMod b 0) to:report
 saveMaxFile (dst + @"\jacket-fitted-experimental.max") quiet:true
 local nodes=for o in objects where o!=body collect o
 select nodes
 FBXExporterSetParam "Animation" false
 FBXExporterSetParam "Skin" true
 FBXExporterSetParam "EmbedTextures" false
 exportFile (dst + @"\jacket-fitted-experimental.fbx") #noPrompt selectedOnly:true using:FBXEXP
 format "FIT_EXPORT_DONE\n" to:report
) catch (
 local reason=getCurrentException()
 format "ERROR %\n" reason to:report
 close report
 claim.Close()
 throw()
)
close report
claim.Close()
)
