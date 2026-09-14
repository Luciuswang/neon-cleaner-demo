#include "NeonFilmRecorderSubsystem.h"

#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Camera/CameraTypes.h"
#include "Engine/GameViewportClient.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"
#include "HAL/FileManager.h"
#include "ImageUtils.h"
#include "Kismet/KismetMathLibrary.h"
#include "Misc/CommandLine.h"
#include "Misc/FileHelper.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "UnrealClient.h"

void UNeonFilmRecorderSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    bEnabled = GetWorld()->IsGameWorld()
        && FParse::Value(FCommandLine::Get(), TEXT("NeonRecordFilm="), Film);
    if (!bEnabled)
    {
        return;
    }
    if (Film != TEXT("Intro") && Film != TEXT("Clean")
        && Film != TEXT("Damaged") && Film != TEXT("Lost"))
    {
        UE_LOG(LogTemp, Error, TEXT("[NeonFilmRecord] Invalid film %s"), *Film);
        bEnabled = false;
        FPlatformMisc::RequestExit(true);
        return;
    }
    OutputDirectory = FPaths::ProjectSavedDir() / TEXT("FilmFrames") / Film;
    IFileManager::Get().MakeDirectory(*OutputDirectory, true);
    UGameViewportClient::OnScreenshotCaptured().AddUObject(this,
        &UNeonFilmRecorderSubsystem::CaptureFrame);
}

void UNeonFilmRecorderSubsystem::Deinitialize()
{
    UGameViewportClient::OnScreenshotCaptured().RemoveAll(this);
    Super::Deinitialize();
}

bool UNeonFilmRecorderSubsystem::IsTickable() const
{
    return bEnabled && !bFinished && !IsTemplate();
}

TStatId UNeonFilmRecorderSubsystem::GetStatId() const
{
    RETURN_QUICK_DECLARE_CYCLE_STAT(UNeonFilmRecorderSubsystem, STATGROUP_Tickables);
}

void UNeonFilmRecorderSubsystem::Tick(float DeltaTime)
{
    APlayerController* PC = GetWorld()->GetFirstPlayerController();
    if (!PC || !PC->GetPawn())
    {
        Warmup += DeltaTime;
        if (Warmup > 30.0f)
        {
            UE_LOG(LogTemp, Error, TEXT("[NeonFilmRecord] Pawn readiness timeout"));
            FPlatformMisc::RequestExit(true);
        }
        return;
    }
    if (!ShotPawn)
    {
        ShotPawn = PC->GetPawn();
        const float X = Film == TEXT("Intro") ? 0.0f
            : Film == TEXT("Clean") ? 97000.0f
            : Film == TEXT("Damaged") ? 86000.0f : 62000.0f;
        ShotPawn->SetActorLocation(FVector(X, 0.0f, 0.0f));
        ShotPawn->SetActorRotation(FRotator::ZeroRotator);
        Warmup = 0.0f;
    }
    Warmup += DeltaTime;
    if (Warmup < 6.0f)
    {
        return;
    }
    if (!ShotCamera)
    {
        FMinimalViewInfo View;
        ShotPawn->CalcCamera(0.0f, View);
        EndLocation = View.Location;
        EndRotation = View.Rotation;
        EndFov = View.FOV;
        ShotCamera = GetWorld()->SpawnActor<ACameraActor>();
        UE_LOG(LogTemp, Display,
            TEXT("[NeonFilmRecord] Started film=%s frames=%d endpoint=%s fov=%.2f"),
            *Film, FrameCount, *EndLocation.ToCompactString(), EndFov);
    }
    PC->SetViewTarget(ShotCamera);
    if (bPending)
    {
        PendingElapsed += DeltaTime;
        if (PendingElapsed > 15.0f)
        {
            UE_LOG(LogTemp, Error, TEXT("[NeonFilmRecord] Screenshot timeout"));
            FPlatformMisc::RequestExit(true);
        }
        return;
    }
    UpdateShot();
    bPending = true;
    PendingElapsed = 0.0f;
    FScreenshotRequest::RequestScreenshot(TEXT("NeonFilmFrame"), false, false);
}

void UNeonFilmRecorderSubsystem::UpdateShot()
{
    const float T = static_cast<float>(FrameIndex) / (FrameCount - 1);
    const float Smooth = T * T * (3.0f - 2.0f * T);
    const FVector Focus = ShotPawn->GetActorLocation() + FVector(20.0f, 0.0f, 105.0f);
    if (Film == TEXT("Intro"))
    {
        const FVector Opening = ShotPawn->GetActorLocation() + FVector(-320.0f, -420.0f, 175.0f);
        ShotCamera->SetActorLocation(FMath::Lerp(Opening, EndLocation, Smooth));
        const FRotator OpeningRotation = UKismetMathLibrary::FindLookAtRotation(Opening, Focus);
        ShotCamera->SetActorRotation(FQuat::Slerp(OpeningRotation.Quaternion(),
            EndRotation.Quaternion(), Smooth));
        ShotCamera->GetCameraComponent()->SetFieldOfView(FMath::Lerp(52.0f, EndFov, Smooth));
    }
    else
    {
        const float Side = Film == TEXT("Lost") ? -1.0f : 1.0f;
        const FVector Closing = ShotPawn->GetActorLocation()
            + FVector(-680.0f, Side * 380.0f, 260.0f);
        ShotCamera->SetActorLocation(FMath::Lerp(EndLocation, Closing, Smooth));
        const FRotator ClosingRotation = UKismetMathLibrary::FindLookAtRotation(Closing, Focus);
        ShotCamera->SetActorRotation(FQuat::Slerp(EndRotation.Quaternion(),
            ClosingRotation.Quaternion(), Smooth));
        ShotCamera->GetCameraComponent()->SetFieldOfView(FMath::Lerp(EndFov, 52.0f, Smooth));
    }
}

void UNeonFilmRecorderSubsystem::CaptureFrame(int32 Width, int32 Height,
    const TArray<FColor>& Pixels)
{
    if (!bEnabled || !bPending || bFinished)
    {
        return;
    }
    TArray64<uint8> Compressed;
    FImageUtils::PNGCompressImageArray(Width, Height,
        TArrayView64<const FColor>(Pixels.GetData(), Pixels.Num()), Compressed);
    const FString Filename = OutputDirectory / FString::Printf(TEXT("frame_%05d.png"), FrameIndex);
    if (!FFileHelper::SaveArrayToFile(Compressed, *Filename))
    {
        UE_LOG(LogTemp, Error, TEXT("[NeonFilmRecord] Write failed %s"), *Filename);
        FPlatformMisc::RequestExit(true);
        return;
    }
    ++FrameIndex;
    bPending = false;
    if (FrameIndex >= FrameCount)
    {
        bFinished = true;
        UE_LOG(LogTemp, Display, TEXT("[NeonFilmRecord] Completed film=%s frames=%d size=%dx%d"),
            *Film, FrameIndex, Width, Height);
        FPlatformMisc::RequestExit(false);
    }
}
