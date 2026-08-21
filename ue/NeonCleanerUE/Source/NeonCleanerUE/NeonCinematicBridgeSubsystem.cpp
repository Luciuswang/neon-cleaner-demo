#include "NeonCinematicBridgeSubsystem.h"

#include "Blueprint/UserWidget.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "NeonCinematicBridgeWidget.h"
#include "TimerManager.h"

void UNeonCinematicBridgeSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	FWorldDelegates::OnPostWorldInitialization.AddUObject(this, &UNeonCinematicBridgeSubsystem::HandleWorldPostInitialization);
}

void UNeonCinematicBridgeSubsystem::Deinitialize()
{
	FWorldDelegates::OnPostWorldInitialization.RemoveAll(this);
	Super::Deinitialize();
}

void UNeonCinematicBridgeSubsystem::HandleWorldPostInitialization(UWorld* World, const UWorld::InitializationValues IVS)
{
	if (bHasShownBridge || !World || !World->IsGameWorld())
	{
		return;
	}

	bHasShownBridge = true;
	TWeakObjectPtr<UWorld> WorldPtr(World);
	FTimerHandle BridgeTimer;
	World->GetTimerManager().SetTimer(BridgeTimer, FTimerDelegate::CreateUObject(this, &UNeonCinematicBridgeSubsystem::ShowBridgeForWorld, WorldPtr), 0.35f, false);
}

void UNeonCinematicBridgeSubsystem::ShowBridgeForWorld(TWeakObjectPtr<UWorld> WorldPtr)
{
	UWorld* World = WorldPtr.Get();
	if (!World)
	{
		return;
	}

	CachedPlayerController = World->GetFirstPlayerController();
	if (!CachedPlayerController)
	{
		return;
	}

	ActiveBridge = CreateWidget<UNeonCinematicBridgeWidget>(CachedPlayerController, UNeonCinematicBridgeWidget::StaticClass());
	if (!ActiveBridge)
	{
		return;
	}

	ActiveBridge->OnBridgeFinished.AddDynamic(this, &UNeonCinematicBridgeSubsystem::HandleBridgeFinished);
	ActiveBridge->AddToViewport(1000);

	FInputModeUIOnly InputMode;
	CachedPlayerController->SetInputMode(InputMode);
	CachedPlayerController->bShowMouseCursor = true;
	if (APawn* Pawn = CachedPlayerController->GetPawn())
	{
		Pawn->DisableInput(CachedPlayerController);
	}
}

void UNeonCinematicBridgeSubsystem::HandleBridgeFinished()
{
	if (!CachedPlayerController)
	{
		return;
	}

	FInputModeGameOnly InputMode;
	CachedPlayerController->SetInputMode(InputMode);
	CachedPlayerController->bShowMouseCursor = false;
	if (APawn* Pawn = CachedPlayerController->GetPawn())
	{
		Pawn->EnableInput(CachedPlayerController);
	}

	ActiveBridge = nullptr;
}
