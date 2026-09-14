#include "NeonWeatherSubsystem.h"

#include "Components/InstancedStaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"
#include "LinxiaMotorcycleChaseGameMode.h"
#include "Materials/MaterialInterface.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"

void UNeonWeatherSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    bEnabled = GetWorld()->IsGameWorld()
        && GetWorld()->GetMapName().Contains(TEXT("Linxia_MotorcycleChase"))
        && !FParse::Param(FCommandLine::Get(), TEXT("nullrhi"));
}

void UNeonWeatherSubsystem::Deinitialize()
{
    bEnabled = false;
    Drops.Empty();
    Super::Deinitialize();
}

bool UNeonWeatherSubsystem::IsTickable() const
{
    return bEnabled && !IsTemplate();
}

TStatId UNeonWeatherSubsystem::GetStatId() const
{
    RETURN_QUICK_DECLARE_CYCLE_STAT(UNeonWeatherSubsystem, STATGROUP_Tickables);
}

void UNeonWeatherSubsystem::Tick(float DeltaTime)
{
    const APlayerController* PC = GetWorld()->GetFirstPlayerController();
    if (!PC || !PC->GetPawn())
    {
        return;
    }
    if (const auto* Mode = GetWorld()->GetAuthGameMode<ALinxiaMotorcycleChaseGameMode>())
    {
        if (Mode->IsEncounterPaused()) return;
    }
    if (!Rain)
    {
        UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
        UMaterialInterface* Material = LoadObject<UMaterialInterface>(nullptr,
            TEXT("/Game/LinxiaChase/Materials/M_NC_Rain.M_NC_Rain"));
        if (!Cube || !Material)
        {
            bEnabled = false;
            UE_LOG(LogTemp, Warning, TEXT("[NeonWeather] Rain assets unavailable"));
            return;
        }
        RainActor = GetWorld()->SpawnActor<AActor>();
        Rain = NewObject<UInstancedStaticMeshComponent>(RainActor, TEXT("LocalRain"));
        RainActor->SetRootComponent(Rain);
        RainActor->AddInstanceComponent(Rain);
        Rain->SetMobility(EComponentMobility::Movable);
        Rain->SetStaticMesh(Cube);
        Rain->SetMaterial(0, Material);
        Rain->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        Rain->SetCastShadow(false);
        Rain->RegisterComponent();
        FRandomStream Random(9142037);
        for (int32 Index = 0; Index < 420; ++Index)
        {
            Drops.Add(FVector(Random.FRandRange(-1500, 1500),
                Random.FRandRange(-1000, 1000), Random.FRandRange(0, 1200)));
            Rain->AddInstance(FTransform(FRotator(7, 0, 0), Drops.Last(), FVector(.0015, .0015, .24)));
        }
        UE_LOG(LogTemp, Display, TEXT("[NeonWeather] Rain initialized instances=%d"), Drops.Num());
    }
    RainActor->SetActorLocation(PC->GetPawn()->GetActorLocation());
    const float Step = FMath::Min(DeltaTime, .1f);
    for (int32 Index = 0; Index < Drops.Num(); ++Index)
    {
        FVector& Drop = Drops[Index];
        Drop.Z -= Step * (1150.0f + (Index % 11) * 19.0f);
        Drop.X += Step * 140.0f;
        if (Drop.Z < 0) Drop.Z += 1200.0f;
        if (Drop.X > 1500) Drop.X -= 3000.0f;
        Rain->UpdateInstanceTransform(Index,
            FTransform(FRotator(7, 0, 0), Drop, FVector(.0015, .0015, .24)),
            false, Index == Drops.Num() - 1, true);
    }
}
