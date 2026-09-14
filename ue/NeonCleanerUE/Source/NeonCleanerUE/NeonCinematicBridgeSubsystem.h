#pragma once

#include "CoreMinimal.h"
#include "Containers/Ticker.h"
#include "NeonChaseTypes.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "NeonCinematicBridgeSubsystem.generated.h"

class APlayerController;
class UNeonCinematicBridgeWidget;
class UWorld;

DECLARE_MULTICAST_DELEGATE_TwoParams(FNeonFilmFinished, uint32, FName);

UCLASS()
class NEONCLEANERUE_API UNeonCinematicBridgeSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	// Game-thread API. Caller owns phase, possession, input mode and request IDs.
	// Subscribe and enter the film phase first. Even failures complete asynchronously.
	void PlayFilm(APlayerController* PlayerController, ENeonChaseFilm Film, uint32 RequestId);
	// Replacement, restart and teardown cancel silently, never completing the request.
	void CancelFilm();
	bool IsFilmActive() const { return bFilmActive; }
	FNeonFilmFinished OnFilmFinished;

private:
	UPROPERTY(Transient)
	TObjectPtr<UNeonCinematicBridgeWidget> ActiveBridge;

	TWeakObjectPtr<APlayerController> ActiveController;
	TWeakObjectPtr<UWorld> ActiveWorld;
	FTSTicker::FDelegateHandle TickHandle;
	uint32 ActiveRequestId = 0;
	ENeonChaseFilm ActiveFilm = ENeonChaseFilm::Intro;
	FName PendingFailure;
	bool bFilmActive = false;
	bool bShuttingDown = false;

	bool TickPresentation(float);
	void HandleWorldBeginTearDown(UWorld* World);
	void HandleWorldCleanup(UWorld* World, bool, bool);
	void HandleBridgeFinished(uint32 RequestId, FName Reason);
	void ReleasePresentation();
};
