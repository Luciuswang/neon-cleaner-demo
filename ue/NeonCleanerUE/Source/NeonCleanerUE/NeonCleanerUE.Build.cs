using UnrealBuildTool;

public class NeonCleanerUE : ModuleRules
{
	public NeonCleanerUE(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"MediaAssets",
			"Slate",
			"SlateCore",
			"UMG"
		});
	}
}
