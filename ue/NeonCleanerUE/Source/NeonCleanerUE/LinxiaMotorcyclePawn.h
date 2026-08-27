#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "LinxiaMotorcyclePawn.generated.h"

class UCameraComponent;
class UPoseableMeshComponent;
class USceneComponent;
class USpringArmComponent;
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

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

private:
	void EnsurePlayerPossession();
	void PollDirectPlayerInput(float DeltaSeconds);
	void UpdateMotorcycleMotion(float DeltaSeconds);
	void UpdateVisuals(float DeltaSeconds);
	void RunSmokeTest(float DeltaSeconds);
	void RunCaptureTest(float DeltaSeconds);
	void ResetToStart();
	void UpdateTargetDistanceLog();
	void ApplyRiderLocalPose();
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
	float WheelSpinDegrees = 0.0f;

	bool bHandbrakeHeld = false;
	bool bLoggedPossession = false;
	bool bSmokeTestActive = false;
	bool bSmokeTestCompleted = false;
	bool bCaptureTestActive = false;
	bool bCaptureRequested = false;
	bool bTargetCaught = false;

	FString CaptureOutputPath;
	FString CaptureViewMode;
	FVector StartLocation = FVector::ZeroVector;
	FRotator StartRotation = FRotator::ZeroRotator;
	FVector SmokeTestStartLocation = FVector::ZeroVector;

	UPROPERTY()
	TObjectPtr<AActor> ChaseTarget;

	UPROPERTY(VisibleAnywhere, Category = "Motorcycle")
	TObjectPtr<USceneComponent> SceneRoot;

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
	TObjectPtr<UStaticMeshComponent> NoseLight;

	UPROPERTY(VisibleAnywhere, Category = "Motorcycle")
	TObjectPtr<UPoseableMeshComponent> RiderMesh;

	UPROPERTY(VisibleAnywhere, Category = "Camera")
	TObjectPtr<USpringArmComponent> CameraBoom;

	UPROPERTY(VisibleAnywhere, Category = "Camera")
	TObjectPtr<UCameraComponent> FollowCamera;
};
