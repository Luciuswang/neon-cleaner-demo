#include "NeonOffscreenCaptureSubsystem.h"
#include "Camera/CameraTypes.h"
#include "Components/SceneCaptureComponent2D.h"
#include "Components/PoseableMeshComponent.h"
#include "Engine/Engine.h"
#include "Engine/SceneCapture2D.h"
#include "Engine/TextureRenderTarget2D.h"
#include "Engine/World.h"
#include "Engine/GameViewportClient.h"
#include "UnrealClient.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/Pawn.h"
#include "HAL/FileManager.h"
#include "HAL/PlatformTime.h"
#include "HAL/IConsoleManager.h"
#include "ImageUtils.h"
#include "Misc/App.h"
#include "Misc/CommandLine.h"
#include "Misc/FileHelper.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "TextureResource.h"

bool UNeonOffscreenCaptureSubsystem::DoesSupportWorldType(EWorldType::Type WorldType) const
{
    return WorldType == EWorldType::Game || WorldType == EWorldType::PIE;
}

void UNeonOffscreenCaptureSubsystem::OnWorldBeginPlay(UWorld& InWorld)
{
    Super::OnWorldBeginPlay(InWorld);
    bProfile = FParse::Value(FCommandLine::Get(), TEXT("NeonRealtimeProfile="), OutputDirectory);
    if (bProfile)
    {
        const IConsoleVariable* OverrideFPS = IConsoleManager::Get().FindConsoleVariable(TEXT("t.OverrideFPS"));
        if (FApp::UseFixedTimeStep() || (GEngine && GEngine->bUseFixedFrameRate) || FApp::IsBenchmarking() ||
            (OverrideFPS && OverrideFPS->GetFloat() > 0) || FParse::Param(FCommandLine::Get(), TEXT("UseFixedTimeStep")) ||
            FParse::Param(FCommandLine::Get(), TEXT("NullRHI")) ||
            FParse::Value(FCommandLine::Get(), TEXT("NeonOffscreenVideo="), CaptureId))
        {
            UE_LOG(LogTemp, Error, TEXT("[NeonPerformance] Invalid fixed/offscreen-video/null-RHI profiling mode"));
            FPlatformMisc::RequestExitWithStatus(false, 1);
            return;
        }
        IFileManager::Get().MakeDirectory(*OutputDirectory, true);
        ProfileRows = TEXT("timestamp_seconds,frame_ms\n");
        ProfileStarted = FPlatformTime::Seconds();
        bEnabled = true;
        return;
    }
    if (!FParse::Value(FCommandLine::Get(), TEXT("NeonOffscreenVideo="), OutputDirectory)) return;
    CaptureId = TEXT("neon-offscreen");
    FParse::Value(FCommandLine::Get(), TEXT("NeonCaptureId="), CaptureId);
    FParse::Value(FCommandLine::Get(), TEXT("LinxiaMotorcycleCaptureView="), View);
    FParse::Value(FCommandLine::Get(), TEXT("NeonOffscreenFrames="), FrameCount);
    FrameCount = FMath::Clamp(FrameCount, 1, 1800);
    OutputDirectory = FPaths::ConvertRelativePathToFull(OutputDirectory);
    TArray<FString> Existing;
    IFileManager::Get().FindFiles(Existing, *(OutputDirectory / TEXT("frame-*.png")), true, false);
    if (OutputDirectory.IsEmpty() || Existing.Num() || !IFileManager::Get().MakeDirectory(*OutputDirectory, true))
    {
        UE_LOG(LogTemp, Error, TEXT("[NeonOffscreenCapture] Refusing missing/nonempty output directory"));
        FPlatformMisc::RequestExitWithStatus(false, 1);
        return;
    }
    bPreviousFixedStep = FApp::UseFixedTimeStep();
    PreviousFixedDelta = FApp::GetFixedDeltaTime();
    FApp::SetUseFixedTimeStep(true);
    FApp::SetFixedDeltaTime(1.0 / 30.0);
    Capture = InWorld.SpawnActor<ASceneCapture2D>();
    Target = NewObject<UTextureRenderTarget2D>(this);
    Target->RenderTargetFormat = RTF_RGBA8;
    Target->TargetGamma = 2.2f;
    Target->InitAutoFormat(1920, 1080);
    Target->UpdateResourceImmediate(true);
    auto* Component = Capture->GetCaptureComponent2D();
    Component->TextureTarget = Target;
    Component->CaptureSource = SCS_FinalColorLDR;
    Component->bCaptureEveryFrame = false;
    Component->bCaptureOnMovement = false;
    Component->bAlwaysPersistRenderingState = true;
    Component->PostProcessSettings.bOverride_DynamicGlobalIlluminationMethod = true;
    Component->PostProcessSettings.DynamicGlobalIlluminationMethod = EDynamicGlobalIlluminationMethod::Lumen;
    Component->PostProcessSettings.bOverride_ReflectionMethod = true;
    Component->PostProcessSettings.ReflectionMethod = EReflectionMethod::Lumen;
    Component->PostProcessSettings.bOverride_MotionBlurAmount = true;
    Component->PostProcessSettings.MotionBlurAmount = 0.0f;
    Component->PostProcessBlendWeight = 1.0f;
    bEnabled = true;
    UE_LOG(LogTemp, Display, TEXT("[NeonOffscreenCapture] id=%s method=SceneCapture2D width=1920 height=1080"), *CaptureId);
    UE_LOG(LogTemp, Display, TEXT("[NeonOffscreenCapture] fixedTimestep=1 fps=30 warmup=120 view=%s NOT_A_PERFORMANCE_BENCHMARK"), *View);
}

void UNeonOffscreenCaptureSubsystem::Tick(float DeltaTime)
{
    if (bProfile)
    {
        const IConsoleVariable* OverrideFPS = IConsoleManager::Get().FindConsoleVariable(TEXT("t.OverrideFPS"));
        if (FApp::UseFixedTimeStep() || (GEngine && GEngine->bUseFixedFrameRate) || FApp::IsBenchmarking() ||
            (OverrideFPS && OverrideFPS->GetFloat() > 0))
        {
            UE_LOG(LogTemp, Error, TEXT("[NeonPerformance] Fixed timing became active; rejecting sample"));
            bEnabled = false;
            FPlatformMisc::RequestExitWithStatus(false, 1);
            return;
        }
        const double Now = FPlatformTime::Seconds();
        if (Now - ProfileStarted < 5.0) return;
        if (LastProfileTick == 0)
        {
            const auto* Viewport = GetWorld()->GetGameViewport();
            const FIntPoint Size = Viewport && Viewport->Viewport ? Viewport->Viewport->GetSizeXY() : FIntPoint::ZeroValue;
            UE_LOG(LogTemp, Display, TEXT("[NeonPerformance] realtime=1 fixedTimestep=%d width=%d height=%d"), FApp::UseFixedTimeStep() ? 1 : 0, Size.X, Size.Y);
            UE_LOG(LogTemp, Display, TEXT("[NeonPerformance] engineFixedFrameRate=0 benchmarking=0 overrideFPS=0"));
            LastProfileTick = Now;
            return;
        }
        ProfileRows += FString::Printf(TEXT("%.9f,%.6f\n"), Now - ProfileStarted, (Now - LastProfileTick) * 1000.0);
        LastProfileTick = Now;
        if (Now - ProfileStarted >= 40.0)
        {
            const bool Saved = FFileHelper::SaveStringToFile(ProfileRows, *(OutputDirectory / TEXT("realtime.csv")), FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM);
            UE_LOG(LogTemp, Display, TEXT("[NeonPerformance] Completed saved=%d duration=%.3f"), Saved ? 1 : 0, Now - ProfileStarted - 5.0);
            bEnabled = false;
            FPlatformMisc::RequestExitWithStatus(false, Saved ? 0 : 1);
        }
        return;
    }
    auto* PC = GetWorld()->GetFirstPlayerController();
    APawn* Pawn = PC ? PC->GetPawn().Get() : nullptr;
    if (!Pawn || !Capture || !Target) return;
    FMinimalViewInfo Camera;
    Pawn->CalcCamera(DeltaTime, Camera);
    // Gameplay spring-arm lag intentionally trails at speed. Diagnostic cameras
    // must track their subject directly or closeups show only road during motion.
    FVector Focus = Pawn->GetActorLocation() + FVector(0, 0, 95);
    FVector Offset;
    bool bDiagnosticCamera = true;
    if (View.Equals(TEXT("Hands"), ESearchCase::IgnoreCase) || View.Equals(TEXT("HandsRight"), ESearchCase::IgnoreCase))
    {
        const bool bRight = View.Equals(TEXT("HandsRight"), ESearchCase::IgnoreCase);
        if (auto* Rider = Pawn->FindComponentByClass<UPoseableMeshComponent>())
            Focus = Rider->GetBoneLocationByName(bRight ? TEXT("bone_RightHand") : TEXT("bone_LeftHand"), EBoneSpaces::WorldSpace);
        Offset = FVector(70, bRight ? 100 : -100, 55);
        Camera.FOV = 40;
    }
    else if (View.Equals(TEXT("Side"), ESearchCase::IgnoreCase)) { Offset = FVector(110, -540, 115); Camera.FOV = 54; }
    else if (View.Equals(TEXT("Establishing"), ESearchCase::IgnoreCase)) { Offset = FVector(-1800, -2400, 850); Camera.FOV = 62; }
    else if (View.Equals(TEXT("Bridge"), ESearchCase::IgnoreCase)) { Focus.Z = -600; Offset = FVector(-1200, 3400, -150); Camera.FOV = 62; }
    else bDiagnosticCamera = false;
    if (bDiagnosticCamera)
    {
        Camera.Location = Focus + Pawn->GetActorQuat().RotateVector(Offset);
        Camera.Rotation = (Focus - Camera.Location).Rotation();
    }
    auto* Component = Capture->GetCaptureComponent2D();
    Component->SetWorldLocationAndRotation(Camera.Location, Camera.Rotation);
    Component->FOVAngle = Camera.FOV;
    Component->CaptureScene();
    if (WarmupFrames-- > 0) return;
    TArray<FColor> Pixels;
    FReadSurfaceDataFlags Flags(RCM_UNorm);
    Flags.SetLinearToGamma(false);
    if (!Target->GameThread_GetRenderTargetResource()->ReadPixels(Pixels, Flags) || Pixels.Num() != 1920 * 1080)
    {
        UE_LOG(LogTemp, Error, TEXT("[NeonOffscreenCapture] Render-target readback failed"));
        bEnabled = false;
        FPlatformMisc::RequestExitWithStatus(false, 1);
        return;
    }
    for (FColor& Pixel : Pixels) Pixel.A = 255;
    TArray64<uint8> PNG;
    FImageUtils::PNGCompressImageArray(1920, 1080, Pixels, PNG);
    const FString Path = OutputDirectory / FString::Printf(TEXT("frame-%05d.png"), Frame);
    if (!FFileHelper::SaveArrayToFile(PNG, *Path))
    {
        UE_LOG(LogTemp, Error, TEXT("[NeonOffscreenCapture] Frame save failed"));
        bEnabled = false;
        FPlatformMisc::RequestExitWithStatus(false, 1);
        return;
    }
    UE_LOG(LogTemp, Display, TEXT("[NeonOffscreenFrame] frame=%d t=%.6f x=%.3f y=%.3f z=%.3f fov=%.2f"),
        Frame, GetWorld()->GetTimeSeconds(), Camera.Location.X, Camera.Location.Y, Camera.Location.Z, Camera.FOV);
    if (++Frame >= FrameCount)
    {
        UE_LOG(LogTemp, Display, TEXT("[NeonOffscreenCapture] Completed frames=%d"), Frame);
        bEnabled = false;
        FPlatformMisc::RequestExit(false);
    }
}

TStatId UNeonOffscreenCaptureSubsystem::GetStatId() const
{
    RETURN_QUICK_DECLARE_CYCLE_STAT(UNeonOffscreenCaptureSubsystem, STATGROUP_Tickables);
}

void UNeonOffscreenCaptureSubsystem::Deinitialize()
{
    if (Capture)
    {
        FApp::SetUseFixedTimeStep(bPreviousFixedStep);
        FApp::SetFixedDeltaTime(PreviousFixedDelta);
    }
    Super::Deinitialize();
}
