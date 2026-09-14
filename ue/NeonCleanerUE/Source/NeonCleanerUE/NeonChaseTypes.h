#pragma once

#include "CoreMinimal.h"
#include "NeonChaseTypes.generated.h"

UENUM(BlueprintType)
enum class ENeonChasePhase : uint8
{
    Preparing, Intro, Playing, Outro, Results
};

UENUM(BlueprintType)
enum class ENeonChaseOutcome : uint8
{
    None, Clean, Damaged, Lost
};

UENUM(BlueprintType)
enum class ENeonChaseFilm : uint8
{
    Intro, Clean, Damaged, Lost
};
