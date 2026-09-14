#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "NeonWeatherSubsystem.generated.h"

class UInstancedStaticMeshComponent;

UCLASS()
class NEONCLEANERUE_API UNeonWeatherSubsystem : public UTickableWorldSubsystem
{
    GENERATED_BODY()

public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;
    virtual void Tick(float DeltaTime) override;
    virtual TStatId GetStatId() const override;
    virtual bool IsTickable() const override;

private:
    UPROPERTY()
    TObjectPtr<AActor> RainActor;
    UPROPERTY()
    TObjectPtr<UInstancedStaticMeshComponent> Rain;
    TArray<FVector> Drops;
    bool bEnabled = false;
};
