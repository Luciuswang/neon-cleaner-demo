#include "NeonCinematicBridgeSubsystem.h"

#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "HAL/PlatformTime.h"
#include "NeonCinematicBridgeWidget.h"

DEFINE_LOG_CATEGORY_STATIC(LogNeonFilmBridge, Log, All);

void UNeonCinematicBridgeSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	bShuttingDown = false;
	FWorldDelegates::OnWorldBeginTearDown.AddUObject(this, &ThisClass::HandleWorldBeginTearDown);
	FWorldDelegates::OnWorldCleanup.AddUObject(this, &ThisClass::HandleWorldCleanup);
	// Core ticker and wall-clock deadlines work even when gameplay time is paused.
	TickHandle = FTSTicker::GetCoreTicker().AddTicker(
		FTickerDelegate::CreateUObject(this, &ThisClass::TickPresentation));
}

void UNeonCinematicBridgeSubsystem::Deinitialize()
{
	bShuttingDown = true;
	FTSTicker::GetCoreTicker().RemoveTicker(TickHandle);
	TickHandle.Reset();
	FWorldDelegates::OnWorldBeginTearDown.RemoveAll(this);
	FWorldDelegates::OnWorldCleanup.RemoveAll(this);
	CancelFilm();
	OnFilmFinished.Clear();
	Super::Deinitialize();
}

void UNeonCinematicBridgeSubsystem::PlayFilm(APlayerController* PlayerController,
	ENeonChaseFilm Film, uint32 RequestId)
{
	check(IsInGameThread());
	CancelFilm();
	if (bShuttingDown)
	{
		return;
	}
	ActiveRequestId = RequestId;
	ActiveFilm = Film;
	bFilmActive = true;
	PendingFailure = NAME_None;
	UE_LOG(LogNeonFilmBridge, Log, TEXT("NEON_FILM_REQUEST film=%s request=%u"),
		UNeonCinematicBridgeWidget::FilmName(Film), RequestId);
	if (RequestId == 0)
	{
		PendingFailure = TEXT("InvalidRequestId");
		return;
	}

	UWorld* World = IsValid(PlayerController) ? PlayerController->GetWorld() : nullptr;
	if (!World || World->bIsTearingDown || World->GetGameInstance() != GetGameInstance()
		|| !PlayerController->IsLocalController() || !PlayerController->GetLocalPlayer())
	{
		PendingFailure = TEXT("InvalidController");
		return;
	}
	ActiveController = PlayerController;
	ActiveWorld = World;
	ActiveBridge = CreateWidget<UNeonCinematicBridgeWidget>(PlayerController);
	if (!ActiveBridge)
	{
		PendingFailure = TEXT("WidgetUnavailable");
		return;
	}
	ActiveBridge->OnPresentationFinished.BindUObject(this, &ThisClass::HandleBridgeFinished);
	ActiveBridge->AddToViewport(1000);
	ActiveBridge->BeginFilm(Film, RequestId);
}

void UNeonCinematicBridgeSubsystem::CancelFilm()
{
	check(IsInGameThread());
	if (bFilmActive)
	{
		UE_LOG(LogNeonFilmBridge, Log, TEXT("NEON_FILM_CANCEL film=%s request=%u completion=0"),
			UNeonCinematicBridgeWidget::FilmName(ActiveFilm), ActiveRequestId);
	}
	bFilmActive = false;
	PendingFailure = NAME_None;
	ReleasePresentation();
}

void UNeonCinematicBridgeSubsystem::ReleasePresentation()
{
	if (ActiveBridge)
	{
		ActiveBridge->OnPresentationFinished.Unbind();
		ActiveBridge->CancelPresentation();
		ActiveBridge->RemoveFromParent();
		ActiveBridge = nullptr;
	}
	ActiveController.Reset();
	ActiveWorld.Reset();
}

bool UNeonCinematicBridgeSubsystem::TickPresentation(float)
{
	if (!bFilmActive)
	{
		return true;
	}
	if (!PendingFailure.IsNone())
	{
		HandleBridgeFinished(ActiveRequestId, PendingFailure);
		return true;
	}
	if (!ActiveWorld.IsValid() || ActiveWorld->bIsTearingDown || !ActiveController.IsValid()
		|| ActiveController->GetWorld() != ActiveWorld.Get())
	{
		CancelFilm();
		return true;
	}
	if (ActiveBridge)
	{
		ActiveBridge->AdvancePresentation(FPlatformTime::Seconds());
	}
	return true;
}

void UNeonCinematicBridgeSubsystem::HandleWorldBeginTearDown(UWorld* World)
{
	if (World == ActiveWorld.Get())
	{
		CancelFilm();
	}
}

void UNeonCinematicBridgeSubsystem::HandleWorldCleanup(UWorld* World, bool, bool)
{
	HandleWorldBeginTearDown(World);
}

void UNeonCinematicBridgeSubsystem::HandleBridgeFinished(uint32 RequestId, FName Reason)
{
	if (!bFilmActive || RequestId != ActiveRequestId)
	{
		return;
	}
	const ENeonChaseFilm FinishedFilm = ActiveFilm;
	bFilmActive = false;
	PendingFailure = NAME_None;
	ReleasePresentation();
	UE_LOG(LogNeonFilmBridge, Log, TEXT("NEON_FILM_COMPLETE film=%s request=%u reason=%s completion=1"),
		UNeonCinematicBridgeWidget::FilmName(FinishedFilm), RequestId, *Reason.ToString());
	// Release everything before a listener can synchronously start another film.
	OnFilmFinished.Broadcast(RequestId, Reason);
}
