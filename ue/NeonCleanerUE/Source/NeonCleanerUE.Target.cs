using UnrealBuildTool;
using System.Collections.Generic;

public class NeonCleanerUETarget : TargetRules
{
	public NeonCleanerUETarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.V2;
		bOverrideBuildEnvironment = true;
		GlobalDefinitions.Add("__has_feature(x)=0");
		ExtraModuleNames.Add("NeonCleanerUE");
	}
}
