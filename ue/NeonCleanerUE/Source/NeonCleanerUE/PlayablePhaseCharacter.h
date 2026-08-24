#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "PlayablePhaseCharacter.generated.h"

class UCameraComponent;
class USpringArmComponent;
class APlayerController;

UCLASS()
class NEONCLEANERUE_API APlayablePhaseCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	APlayablePhaseCharacter();
	virtual void CalcCamera(float DeltaTime, FMinimalViewInfo& OutResult) override;

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

private:
	void ApplyReferencePoseIfRequested();
	void EnsurePlayerPossession();
	void PollDirectPlayerInput(float DeltaSeconds);
	void RunSmokeTest(float DeltaSeconds);
	void AutoAlignCameraToMovement(APlayerController* PlayerController, const FVector& MoveDirection, float DeltaSeconds);
	FRotator GetMovementYawRotation() const;
	void MoveForward(float Value);
	void MoveRight(float Value);
	void Turn(float Value);
	void LookUp(float Value);

	bool bDirectJumpHeld = false;
	bool bLoggedPossession = false;
	bool bSmokeTestActive = false;
	bool bSmokeTestCompleted = false;
	float SmokeTestElapsed = 0.0f;
	FVector SmokeTestStartLocation = FVector::ZeroVector;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Camera", meta = (AllowPrivateAccess = "true"))
	TObjectPtr<USpringArmComponent> CameraBoom;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Camera", meta = (AllowPrivateAccess = "true"))
	TObjectPtr<UCameraComponent> FollowCamera;
};
