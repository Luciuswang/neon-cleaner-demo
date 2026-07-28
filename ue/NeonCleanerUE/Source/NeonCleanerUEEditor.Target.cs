using UnrealBuildTool;
using System.Collections.Generic;

public class NeonCleanerUEEditorTarget : TargetRules
{
	public NeonCleanerUEEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V2;
		bOverrideBuildEnvironment = true;
		GlobalDefinitions.Add("__has_feature(x)=0");
		ExtraModuleNames.Add("NeonCleanerUE");
	}
}
