#pragma once

#include "CoreMinimal.h"
#include "Engine/World.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "NeonCinematicBridgeSubsystem.generated.h"

class UNeonCinematicBridgeWidget;

UCLASS()
class NEONCLEANERUE_API UNeonCinematicBridgeSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

private:
	UPROPERTY()
	UNeonCinematicBridgeWidget* ActiveBridge = nullptr;

	UPROPERTY()
	APlayerController* CachedPlayerController = nullptr;

	bool bHasShownBridge = false;

	void HandleWorldPostInitialization(UWorld* World, const UWorld::InitializationValues IVS);
	void ShowBridgeForWorld(TWeakObjectPtr<UWorld> WorldPtr);

	UFUNCTION()
	void HandleBridgeFinished();
};
