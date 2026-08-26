#include "LinxiaMotorcycleChaseGameMode.h"

#include "LinxiaMotorcycleHud.h"
#include "LinxiaMotorcyclePawn.h"

ALinxiaMotorcycleChaseGameMode::ALinxiaMotorcycleChaseGameMode()
{
	DefaultPawnClass = ALinxiaMotorcyclePawn::StaticClass();
	HUDClass = ALinxiaMotorcycleHud::StaticClass();
}
