#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "NeonOffscreenCaptureSubsystem.generated.h"

class ASceneCapture2D;
class UTextureRenderTarget2D;

/** Opt-in QA renderer. Reads an engine render target, never the OS desktop or viewport. */
UCLASS()
class NEONCLEANERUE_API UNeonOffscreenCaptureSubsystem : public UTickableWorldSubsystem
{
    GENERATED_BODY()
public:
    virtual bool DoesSupportWorldType(EWorldType::Type WorldType) const override;
    virtual void OnWorldBeginPlay(UWorld& InWorld) override;
    virtual void Tick(float DeltaTime) override;
    virtual TStatId GetStatId() const override;
    virtual bool IsTickable() const override { return bEnabled && !IsTemplate(); }
    virtual void Deinitialize() override;
private:
    UPROPERTY(Transient) TObjectPtr<ASceneCapture2D> Capture;
    UPROPERTY(Transient) TObjectPtr<UTextureRenderTarget2D> Target;
    FString OutputDirectory;
    FString CaptureId;
    FString View;
    int32 Frame = 0;
    int32 FrameCount = 360;
    int32 WarmupFrames = 120;
    bool bEnabled = false;
    bool bProfile = false;
    double ProfileStarted = 0;
    double LastProfileTick = 0;
    FString ProfileRows;
    bool bPreviousFixedStep = false;
    double PreviousFixedDelta = 0;
};
