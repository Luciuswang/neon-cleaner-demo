#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "NeonChaseTypes.h"
#include "CollisionQueryParams.h"
#include "LinxiaMotorcycleChaseGameMode.generated.h"

class ALinxiaMotorcyclePawn;
class ANeonChaseEnemy;
class UNeonCinematicBridgeSubsystem;

UCLASS()
class NEONCLEANERUE_API ALinxiaMotorcycleChaseGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ALinxiaMotorcycleChaseGameMode();
	virtual void Tick(float DeltaSeconds) override;
	ENeonChasePhase GetPhase() const { return Phase; }
	ENeonChaseOutcome GetOutcome() const { return Outcome; }
	bool IsPlaying() const { return Phase == ENeonChasePhase::Playing && !bEncounterPaused; }
	bool IsEncounterPaused() const { return bEncounterPaused; }
	bool IsLegacyTest() const { return bLegacyTest; }
	bool IsFilmRecording() const { return bFilmRecording; }
	float GetTimeRemaining() const { return FMath::Max(0.0f, 95.0f - EncounterTime); }
	float GetElapsedTime() const { return EncounterTime; }
	float GetRouteProgress() const;
	float GetConvoyArmor() const;
	float GetFinishDistanceMeters() const;
	int32 GetKills() const { return Kills; }
	int32 GetZone() const { return NextZone; }
	int32 GetShotsFired() const { return ShotsFired; }
	int32 GetShotsHit() const { return ShotsHit; }
	bool IsConvoyDisabled() const { return bConvoyDisabled; }
	const TArray<TObjectPtr<ANeonChaseEnemy>>& GetEnemies() const { return Enemies; }
	ALinxiaMotorcyclePawn* GetRider() const { return Rider; }
	FCollisionQueryParams MakeCombatQuery(const AActor* Ignore) const;
	void FirePlayerWeapon();
	void NotifyEnemyDisabled(ANeonChaseEnemy* Enemy);
	void RestartEncounter();
	void ToggleEncounterPause();
	void ActivateMenuAt(float ScreenX, float ScreenY, float Width, float Height);

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	void TryPrepareEncounter();
	void SetPhase(ENeonChasePhase NewPhase);
	void RequestFilm(ENeonChaseFilm Film);
	void HandleFilmFinished(uint32 RequestId, FName Reason);
	void StartPlaying();
	void FinishEncounter(ENeonChaseOutcome Result);
	void StepEncounter(float DeltaSeconds);
	void SpawnZone(int32 Zone);
	ANeonChaseEnemy* SpawnEnemy(const FVector& Position, bool bConvoy, int32 Index);
	void BuildSmokeInput(float& Forward, float& Steer, bool& bFire, bool& bBoost);
	void CompleteSmoke(bool bTimedOut);
	void ConfigureController(bool bMenu);
	void TryCaptureGameplayProof();

	UPROPERTY()
	TObjectPtr<ALinxiaMotorcyclePawn> Rider;
	UPROPERTY()
	TObjectPtr<UNeonCinematicBridgeSubsystem> Bridge;
	UPROPERTY()
	TArray<TObjectPtr<ANeonChaseEnemy>> Enemies;
	UPROPERTY()
	TObjectPtr<ANeonChaseEnemy> Convoy;
	TArray<TWeakObjectPtr<AActor>> DecorativeActors;
	FDelegateHandle FilmFinishedHandle;
	ENeonChasePhase Phase = ENeonChasePhase::Preparing;
	ENeonChaseOutcome Outcome = ENeonChaseOutcome::None;
	uint32 FilmSerial = 0;
	uint32 PendingFilmId = 0;
	float EncounterTime = 0.0f;
	float SimulationAccumulator = 0.0f;
	float FilmWaitTime = 0.0f;
	float PreparingTime = 0.0f;
	float SmokeSpeed = 1.0f;
	float SmokeDesiredLane = 0.0f;
	double SmokeStartedAt = 0.0;
	double ProofCaptureRequestedAt = 0.0;
	FString SmokeScenario;
	FString ProofCaptureOutputPath;
	int32 NextZone = 0;
	int32 Kills = 0;
	int32 ShotsFired = 0;
	int32 ShotsHit = 0;
	bool bConvoyDisabled = false;
	bool bEncounterPaused = false;
	bool bLegacyTest = false;
	bool bFilmRecording = false;
	bool bSmokeCompleted = false;
	bool bProofCaptureRequested = false;
	bool bRestartDown = false;
	bool bPauseDown = false;
	bool bClickDown = false;
	bool bEnterDown = false;
};
