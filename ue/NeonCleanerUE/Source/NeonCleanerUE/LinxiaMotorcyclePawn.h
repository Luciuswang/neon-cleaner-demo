#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "LinxiaMotorcyclePawn.generated.h"

class UCameraComponent;
class UBoxComponent;
class UPointLightComponent;
class UPoseableMeshComponent;
class USceneComponent;
class USpringArmComponent;
class USpotLightComponent;
class UStaticMeshComponent;

UCLASS()
class NEONCLEANERUE_API ALinxiaMotorcyclePawn : public APawn
{
	GENERATED_BODY()

public:
	ALinxiaMotorcyclePawn();
	virtual void CalcCamera(float DeltaTime, FMinimalViewInfo& OutResult) override;
	float GetCurrentSpeedKmh() const;
	float GetChaseTargetDistance() const;
	bool HasCaughtChaseTarget() const { return bTargetCaught; }
	float GetHealth() const { return Health; }
	float GetBoostEnergy() const { return BoostEnergy; }
	float GetBoostCooldown() const { return BoostCooldown; }
	float GetDamageFlash() const { return DamageFlash; }
	float GetHitFlash() const { return HitFlash; }
	float GetForwardSpeed() const { return CurrentSpeed; }
	bool IsBoosting() const { return bBoosting; }
	bool IsLegacyTest() const { return bSmokeTestActive || bCaptureTestActive; }
	bool IsGameplayReady() const;
	void PrepareForEncounter();
	void ResetEncounter();
	void FreezeGameplay();
	void StepGameplay(float DeltaSeconds, bool bAutomated, float Forward, float Steer, bool bFire, bool bBoost);
	void ReceiveChaseDamage(float Amount, FName Source);
	void SetChaseTarget(AActor* Target) { ChaseTarget = Target; }
	void MarkConvoyDisabled() { bTargetCaught = true; }
	void ShowWeaponTrace(const FVector& Start, const FVector& End, bool bHit);

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

private:
	void EnsurePlayerPossession();
	void PollDirectPlayerInput(float DeltaSeconds);
	void UpdateMotorcycleMotion(float DeltaSeconds);
	void UpdateVisuals(float DeltaSeconds);
	void UpdateGroundAlignment(float DeltaSeconds);
	void UpdateCamera();
	void RunSmokeTest(float DeltaSeconds);
	void RunCaptureTest(float DeltaSeconds);
	void ResetToStart();
	void UpdateTargetDistanceLog();
	void StartRiderAnimation();
	bool SolveRiderTwoBoneIK(
		FName ChainName,
		FName UpperBone,
		FName LowerBone,
		FName EndBone,
		const FVector& TargetInVisualSpace,
		const FVector& BendHintInVisualSpace);
	void LogRiderContactPose();
	void ConfigureCaptureCamera();
	void ApplyMaterial(UStaticMeshComponent* Component, const TCHAR* MaterialPath);

	float CurrentSpeed = 0.0f;
	float TargetSpeed = 0.0f;
	float ThrottleInput = 0.0f;
	float SteerInput = 0.0f;
	float CameraYawOffset = 0.0f;
	float CameraPitch = -8.0f;
	float LastTargetDistance = 0.0f;
	float TargetLogElapsed = 0.0f;
	float SmokeTestElapsed = 0.0f;
	float CaptureTestElapsed = 0.0f;
	float RiderPoseLogElapsed = 0.0f;
	float WheelSpinDegrees = 0.0f;
	float Health = 100.0f;
	float BoostEnergy = 100.0f;
	float BoostCooldown = 0.0f;
	float DamageCooldown = 0.0f;
	float DamageFlash = 0.0f;
	float HitFlash = 0.0f;
	float WeaponCooldown = 0.0f;
	float WeaponTraceTime = 0.0f;
	bool bFireHeld = false;
	bool bBoostHeld = false;
	bool bBoosting = false;
	bool bGameplayFrozen = true;

	bool bHandbrakeHeld = false;
	bool bLoggedPossession = false;
	bool bSmokeTestActive = false;
	bool bSmokeTestCompleted = false;
	bool bCaptureTestActive = false;
	bool bCaptureRequested = false;
	bool bLoggedRiderContactPoseAfterAnimation = false;
	bool bTargetCaught = false;

	FString CaptureOutputPath;
	FString CaptureViewMode;
	FVector StartLocation = FVector::ZeroVector;
	FRotator StartRotation = FRotator::ZeroRotator;
	FVector SmokeTestStartLocation = FVector::ZeroVector;

	UPROPERTY()
	TObjectPtr<AActor> ChaseTarget;

	UPROPERTY(VisibleAnywhere, Category = "Motorcycle")
	TObjectPtr<UBoxComponent> SceneRoot;

	UPROPERTY()
	TObjectPtr<UStaticMeshComponent> WeaponTrace;

	UPROPERTY()
	TObjectPtr<UStaticMeshComponent> WeaponBarrel;

	UPROPERTY(VisibleAnywhere, Category = "Motorcycle")
	TObjectPtr<USceneComponent> VisualRoot;

	UPROPERTY(VisibleAnywhere, Category = "Motorcycle")
	TObjectPtr<UStaticMeshComponent> BikeBody;

	UPROPERTY(VisibleAnywhere, Category = "Motorcycle")
	TObjectPtr<UStaticMeshComponent> ImportedMotorcycle;

	UPROPERTY(VisibleAnywhere, Category = "Motorcycle")
	TObjectPtr<UStaticMeshComponent> Seat;

	UPROPERTY(VisibleAnywhere, Category = "Motorcycle")
	TObjectPtr<UStaticMeshComponent> FrontFairing;

	UPROPERTY(VisibleAnywhere, Category = "Motorcycle")
	TObjectPtr<UStaticMeshComponent> FrontWheel;

	UPROPERTY(VisibleAnywhere, Category = "Motorcycle")
	TObjectPtr<UStaticMeshComponent> RearWheel;

	UPROPERTY(VisibleAnywhere, Category = "Motorcycle")
	TObjectPtr<UStaticMeshComponent> Handlebar;

	UPROPERTY(VisibleAnywhere, Category = "Motorcycle")
	TObjectPtr<UStaticMeshComponent> FootPegBar;

	UPROPERTY(VisibleAnywhere, Category = "Motorcycle")
	TObjectPtr<UStaticMeshComponent> NoseLight;

	UPROPERTY(VisibleAnywhere, Category = "Lighting")
	TObjectPtr<USpotLightComponent> Headlight;

	UPROPERTY(VisibleAnywhere, Category = "Lighting")
	TObjectPtr<UPointLightComponent> Underglow;

	UPROPERTY(VisibleAnywhere, Category = "Motorcycle")
	TObjectPtr<UPoseableMeshComponent> RiderMesh;

	UPROPERTY(VisibleAnywhere, Category = "Camera")
	TObjectPtr<USpringArmComponent> CameraBoom;

	UPROPERTY(VisibleAnywhere, Category = "Camera")
	TObjectPtr<UCameraComponent> FollowCamera;
};
