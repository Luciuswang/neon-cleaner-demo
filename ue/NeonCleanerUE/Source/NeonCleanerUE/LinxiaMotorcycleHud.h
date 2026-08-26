#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "LinxiaMotorcycleHud.generated.h"

UCLASS()
class NEONCLEANERUE_API ALinxiaMotorcycleHud : public AHUD
{
	GENERATED_BODY()

public:
	virtual void DrawHUD() override;
};
