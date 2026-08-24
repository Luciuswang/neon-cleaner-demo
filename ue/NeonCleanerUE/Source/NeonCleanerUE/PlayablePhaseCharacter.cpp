#include "PlayablePhaseCharacter.h"

#include "Animation/AnimationAsset.h"
#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/Controller.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/SpringArmComponent.h"
#include "InputCoreTypes.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
constexpr float PhaseInitialCameraYawDegrees = -90.0f;
constexpr float KeyboardCameraFollowSpeed = 7.0f;
const TCHAR* PhaseReferenceIdlePath = TEXT("/Game/ParagonPhase/Characters/Heroes/Phase/Animations/Idle_Straight.Idle_Straight");
}

APlayablePhaseCharacter::APlayablePhaseCharacter()
{
	PrimaryActorTick.bCanEverTick = true;
	AutoPossessPlayer = EAutoReceiveInput::Player0;
	bFindCameraComponentWhenViewTarget = true;

	GetCapsuleComponent()->InitCapsuleSize(42.0f, 96.0f);

	bUseControllerRotationPitch = false;
	bUseControllerRotationYaw = false;
	bUseControllerRotationRoll = false;

	UCharacterMovementComponent* Movement = GetCharacterMovement();
	Movement->bOrientRotationToMovement = true;
	Movement->RotationRate = FRotator(0.0f, 540.0f, 0.0f);
	Movement->JumpZVelocity = 500.0f;
	Movement->AirControl = 0.35f;
	Movement->MaxWalkSpeed = 500.0f;
	Movement->MinAnalogWalkSpeed = 20.0f;
	Movement->BrakingDecelerationWalking = 2000.0f;

	static ConstructorHelpers::FObjectFinder<USkeletalMesh> PhaseMesh(
		TEXT("/Game/ParagonPhase/Characters/Heroes/Phase/Meshes/Phase_GDC.Phase_GDC"));
	if (PhaseMesh.Succeeded())
	{
		GetMesh()->SetSkeletalMesh(PhaseMesh.Object);
	}

	static ConstructorHelpers::FClassFinder<UAnimInstance> PhaseAnim(
		TEXT("/Game/ParagonPhase/Characters/Heroes/Phase/Phase_AnimBlueprint"));
	if (PhaseAnim.Succeeded())
	{
		GetMesh()->SetAnimInstanceClass(PhaseAnim.Class);
	}

	GetMesh()->SetRelativeLocation(FVector(0.0f, 0.000856f, -97.0f));
	GetMesh()->SetRelativeRotation(FRotator(0.0f, 270.0f, 0.0f));

	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	CameraBoom->SetupAttachment(RootComponent);
	CameraBoom->SetRelativeLocation(FVector(0.0f, 0.0f, 72.0f));
	CameraBoom->TargetArmLength = 430.0f;
	CameraBoom->SocketOffset = FVector(0.0f, 55.0f, 0.0f);
	CameraBoom->bUsePawnControlRotation = true;
	CameraBoom->bDoCollisionTest = false;

	FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
	FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
	FollowCamera->bUsePawnControlRotation = false;
	FollowCamera->bAutoActivate = true;
}

void APlayablePhaseCharacter::CalcCamera(float DeltaTime, FMinimalViewInfo& OutResult)
{
	if (FollowCamera && FollowCamera->IsActive())
	{
		FollowCamera->GetCameraView(DeltaTime, OutResult);
		return;
	}

	Super::CalcCamera(DeltaTime, OutResult);
}

void APlayablePhaseCharacter::BeginPlay()
{
	Super::BeginPlay();
	ApplyReferencePoseIfRequested();
	EnsurePlayerPossession();
	bSmokeTestActive = FParse::Param(FCommandLine::Get(), TEXT("LinxiaSmokeTest"));
	if (bSmokeTestActive)
	{
		SmokeTestStartLocation = GetActorLocation();
		UE_LOG(LogTemp, Display, TEXT("[LinxiaSmokeTest] Started at %s"), *SmokeTestStartLocation.ToCompactString());
	}
}

void APlayablePhaseCharacter::ApplyReferencePoseIfRequested()
{
	if (!FParse::Param(FCommandLine::Get(), TEXT("LinxiaReferencePose")))
	{
		return;
	}

	UAnimationAsset* ReferenceIdle = LoadObject<UAnimationAsset>(nullptr, PhaseReferenceIdlePath);
	if (!ReferenceIdle)
	{
		UE_LOG(LogTemp, Warning, TEXT("[LinxiaReferencePose] Missing reference idle: %s"), PhaseReferenceIdlePath);
		return;
	}

	GetMesh()->PlayAnimation(ReferenceIdle, true);
	UE_LOG(LogTemp, Display, TEXT("[LinxiaReferencePose] Using %s"), *ReferenceIdle->GetPathName());
}

void APlayablePhaseCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	EnsurePlayerPossession();
	RunSmokeTest(DeltaSeconds);
	PollDirectPlayerInput(DeltaSeconds);
}

void APlayablePhaseCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	PlayerInputComponent->BindAction(TEXT("Jump"), IE_Pressed, this, &ACharacter::Jump);
	PlayerInputComponent->BindAction(TEXT("Jump"), IE_Released, this, &ACharacter::StopJumping);
}

void APlayablePhaseCharacter::EnsurePlayerPossession()
{
	APlayerController* PlayerController = UGameplayStatics::GetPlayerController(this, 0);
	if (!PlayerController)
	{
		return;
	}

	if (PlayerController->GetPawn() != this)
	{
		PlayerController->Possess(this);
	}

	PlayerController->SetViewTarget(this);
	if (!bLoggedPossession && PlayerController->GetPawn() == this)
	{
		PlayerController->SetControlRotation(FRotator(-8.0f, PhaseInitialCameraYawDegrees, 0.0f));
		UE_LOG(LogTemp, Display, TEXT("[LinxiaPlayable] Player0 now controls %s at %s"),
			*GetName(),
			*GetActorLocation().ToCompactString());
		bLoggedPossession = true;
	}
}

void APlayablePhaseCharacter::PollDirectPlayerInput(float DeltaSeconds)
{
	APlayerController* PlayerController = Cast<APlayerController>(Controller);
	if (!PlayerController || !PlayerController->IsLocalController())
	{
		return;
	}

	float Forward = 0.0f;
	Forward += PlayerController->IsInputKeyDown(EKeys::W) || PlayerController->IsInputKeyDown(EKeys::Up) ? 1.0f : 0.0f;
	Forward -= PlayerController->IsInputKeyDown(EKeys::S) || PlayerController->IsInputKeyDown(EKeys::Down) ? 1.0f : 0.0f;

	float Right = 0.0f;
	Right += PlayerController->IsInputKeyDown(EKeys::D) || PlayerController->IsInputKeyDown(EKeys::Right) ? 1.0f : 0.0f;
	Right -= PlayerController->IsInputKeyDown(EKeys::A) || PlayerController->IsInputKeyDown(EKeys::Left) ? 1.0f : 0.0f;

	float MouseX = 0.0f;
	float MouseY = 0.0f;
	PlayerController->GetInputMouseDelta(MouseX, MouseY);
	Turn(MouseX * 0.45f);
	LookUp(MouseY * -0.35f);

	const FRotator YawRotation = GetMovementYawRotation();
	const FVector ForwardAxis = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X);
	const FVector RightAxis = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y);
	const FVector MoveDirection = (ForwardAxis * FMath::Clamp(Forward, -1.0f, 1.0f)
		+ RightAxis * FMath::Clamp(Right, -1.0f, 1.0f)).GetClampedToMaxSize(1.0f);

	if (!MoveDirection.IsNearlyZero())
	{
		AddMovementInput(MoveDirection, 1.0f);
		if (Forward > 0.25f && FMath::Abs(Right) < 0.35f && FMath::Abs(MouseX) < 0.1f)
		{
			AutoAlignCameraToMovement(PlayerController, MoveDirection, DeltaSeconds);
		}
	}

	const bool bJumpHeld = PlayerController->IsInputKeyDown(EKeys::SpaceBar);
	if (bJumpHeld && !bDirectJumpHeld)
	{
		Jump();
	}
	else if (!bJumpHeld && bDirectJumpHeld)
	{
		StopJumping();
	}
	bDirectJumpHeld = bJumpHeld;
}

void APlayablePhaseCharacter::AutoAlignCameraToMovement(APlayerController* PlayerController, const FVector& MoveDirection, float DeltaSeconds)
{
	if (!PlayerController || MoveDirection.IsNearlyZero())
	{
		return;
	}

	const FRotator CurrentRotation = PlayerController->GetControlRotation();
	const float TargetYaw = MoveDirection.Rotation().Yaw;
	const FRotator TargetRotation(CurrentRotation.Pitch, TargetYaw, 0.0f);
	PlayerController->SetControlRotation(FMath::RInterpTo(CurrentRotation, TargetRotation, DeltaSeconds, KeyboardCameraFollowSpeed));
}

void APlayablePhaseCharacter::RunSmokeTest(float DeltaSeconds)
{
	if (!bSmokeTestActive || bSmokeTestCompleted)
	{
		return;
	}

	SmokeTestElapsed += DeltaSeconds;
	AddMovementInput(FRotationMatrix(GetMovementYawRotation()).GetUnitAxis(EAxis::X), 1.0f);

	if (SmokeTestElapsed >= 2.0f)
	{
		const float Distance = FVector::Dist2D(SmokeTestStartLocation, GetActorLocation());
		UE_LOG(LogTemp, Display, TEXT("[LinxiaSmokeTest] Completed distance=%.1f start=%s end=%s"),
			Distance,
			*SmokeTestStartLocation.ToCompactString(),
			*GetActorLocation().ToCompactString());
		bSmokeTestCompleted = true;
		FPlatformMisc::RequestExit(false);
	}
}

FRotator APlayablePhaseCharacter::GetMovementYawRotation() const
{
	const float ControlYaw = Controller ? Controller->GetControlRotation().Yaw : GetActorRotation().Yaw;
	return FRotator(0.0f, ControlYaw, 0.0f);
}

void APlayablePhaseCharacter::MoveForward(float Value)
{
	if (Controller == nullptr || FMath::IsNearlyZero(Value))
	{
		return;
	}

	AddMovementInput(FRotationMatrix(GetMovementYawRotation()).GetUnitAxis(EAxis::X), Value);
}

void APlayablePhaseCharacter::MoveRight(float Value)
{
	if (Controller == nullptr || FMath::IsNearlyZero(Value))
	{
		return;
	}

	AddMovementInput(FRotationMatrix(GetMovementYawRotation()).GetUnitAxis(EAxis::Y), Value);
}

void APlayablePhaseCharacter::Turn(float Value)
{
	AddControllerYawInput(Value);
}

void APlayablePhaseCharacter::LookUp(float Value)
{
	AddControllerPitchInput(Value);
}
