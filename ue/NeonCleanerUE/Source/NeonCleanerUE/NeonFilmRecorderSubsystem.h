#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "NeonFilmRecorderSubsystem.generated.h"

class ACameraActor;
class APawn;

UCLASS()
class NEONCLEANERUE_API UNeonFilmRecorderSubsystem : public UTickableWorldSubsystem
{
    GENERATED_BODY()

public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;
    virtual void Tick(float DeltaTime) override;
    virtual TStatId GetStatId() const override;
    virtual bool IsTickable() const override;

private:
    void CaptureFrame(int32 Width, int32 Height, const TArray<FColor>& Pixels);
    void UpdateShot();

    UPROPERTY()
    TObjectPtr<ACameraActor> ShotCamera;

    UPROPERTY()
    TObjectPtr<APawn> ShotPawn;

    FString Film;
    FString OutputDirectory;
    FVector EndLocation = FVector::ZeroVector;
    FRotator EndRotation = FRotator::ZeroRotator;
    float EndFov = 70.0f;
    float Warmup = 0.0f;
    float PendingElapsed = 0.0f;
    int32 FrameIndex = 0;
    int32 FrameCount = 120;
    bool bEnabled = false;
    bool bPending = false;
    bool bFinished = false;
};
