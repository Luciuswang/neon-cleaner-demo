#include "LinxiaMotorcyclePawn.h"

#include "Camera/CameraComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Animation/AnimationAsset.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/SkeletalMesh.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"
#include "HAL/FileManager.h"
#include "GameFramework/SpringArmComponent.h"
#include "InputCoreTypes.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInterface.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "UObject/ConstructorHelpers.h"
#include "UnrealClient.h"

namespace
{
constexpr float MaxForwardSpeed = 2050.0f;
constexpr float MaxReverseSpeed = -420.0f;
constexpr float AccelerationInterp = 2.4f;
constexpr float BrakeInterp = 5.2f;
constexpr float CoastingInterp = 1.15f;
constexpr float MaxTurnRateDegrees = 92.0f;
constexpr float CameraMouseYawScale = 0.18f;
constexpr float CameraMousePitchScale = 0.12f;
constexpr float CameraFollowInterp = 7.5f;
constexpr float SmokeTestDuration = 4.0f;
constexpr float CaptureRequestTime = 2.0f;
constexpr float CaptureExitTime = 3.8f;
constexpr float ChaseCatchDistance = 520.0f;

const TCHAR* PhaseMeshPath = TEXT("/Game/ParagonPhase/Characters/Heroes/Phase/Meshes/Phase_GDC.Phase_GDC");
const TCHAR* LinxiaRideAnimationPath = TEXT("/Game/LinxiaRig/Animations/AN_Linxia_MotorcycleRide_Idle.AN_Linxia_MotorcycleRide_Idle");
}

ALinxiaMotorcyclePawn::ALinxiaMotorcyclePawn()
{
	PrimaryActorTick.bCanEverTick = true;
	AutoPossessPlayer = EAutoReceiveInput::Player0;
	bFindCameraComponentWhenViewTarget = true;

	SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("SceneRoot"));
	SetRootComponent(SceneRoot);

	VisualRoot = CreateDefaultSubobject<USceneComponent>(TEXT("VisualRoot"));
	VisualRoot->SetupAttachment(SceneRoot);
	VisualRoot->SetRelativeLocation(FVector(0.0f, 0.0f, 0.0f));

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderMesh(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> ImportedBikeMesh(TEXT("/Game/LinxiaChase/Imported/SM_PlayerMotorcycle.SM_PlayerMotorcycle"));
	static ConstructorHelpers::FObjectFinder<USkeletalMesh> PhaseMesh(PhaseMeshPath);
	static ConstructorHelpers::FObjectFinder<UAnimationAsset> RideAnimation(LinxiaRideAnimationPath);

	const bool bHasImportedBike = ImportedBikeMesh.Succeeded();

	ImportedMotorcycle = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("ImportedMotorcycle"));
	ImportedMotorcycle->SetupAttachment(VisualRoot);
	if (bHasImportedBike)
	{
		ImportedMotorcycle->SetStaticMesh(ImportedBikeMesh.Object);
	}
	ImportedMotorcycle->SetRelativeLocation(FVector(6.0f, 0.0f, 58.0f));
	ImportedMotorcycle->SetRelativeRotation(FRotator(0.0f, 0.0f, 0.0f));
	ImportedMotorcycle->SetRelativeScale3D(FVector(230.0f, 230.0f, 230.0f));
	ImportedMotorcycle->SetVisibility(bHasImportedBike, true);
	ImportedMotorcycle->SetHiddenInGame(!bHasImportedBike);
	ImportedMotorcycle->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	BikeBody = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("BikeBody"));
	BikeBody->SetupAttachment(VisualRoot);
	BikeBody->SetStaticMesh(CubeMesh.Object);
	BikeBody->SetRelativeLocation(FVector(-12.0f, 0.0f, 64.0f));
	BikeBody->SetRelativeRotation(FRotator(-4.0f, 0.0f, 0.0f));
	BikeBody->SetRelativeScale3D(FVector(2.6f, 0.34f, 0.2f));
	BikeBody->SetVisibility(!bHasImportedBike, true);
	BikeBody->SetHiddenInGame(bHasImportedBike);

	Seat = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Seat"));
	Seat->SetupAttachment(VisualRoot);
	Seat->SetStaticMesh(CubeMesh.Object);
	Seat->SetRelativeLocation(FVector(-64.0f, 0.0f, 88.0f));
	Seat->SetRelativeRotation(FRotator(-5.0f, 0.0f, 0.0f));
	Seat->SetRelativeScale3D(FVector(1.0f, 0.38f, 0.1f));
	Seat->SetVisibility(!bHasImportedBike, true);
	Seat->SetHiddenInGame(bHasImportedBike);

	FrontFairing = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("FrontFairing"));
	FrontFairing->SetupAttachment(VisualRoot);
	FrontFairing->SetStaticMesh(CubeMesh.Object);
	FrontFairing->SetRelativeLocation(FVector(104.0f, 0.0f, 90.0f));
	FrontFairing->SetRelativeRotation(FRotator(-8.0f, 0.0f, 0.0f));
	FrontFairing->SetRelativeScale3D(FVector(0.62f, 0.54f, 0.4f));
	FrontFairing->SetVisibility(!bHasImportedBike, true);
	FrontFairing->SetHiddenInGame(bHasImportedBike);

	FrontWheel = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("FrontWheel"));
	FrontWheel->SetupAttachment(VisualRoot);
	FrontWheel->SetStaticMesh(CylinderMesh.Object);
	FrontWheel->SetRelativeLocation(FVector(150.0f, 0.0f, 35.0f));
	FrontWheel->SetRelativeRotation(FRotator(0.0f, 0.0f, 90.0f));
	FrontWheel->SetRelativeScale3D(FVector(0.75f, 0.75f, 0.16f));
	FrontWheel->SetVisibility(!bHasImportedBike, true);
	FrontWheel->SetHiddenInGame(bHasImportedBike);

	RearWheel = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("RearWheel"));
	RearWheel->SetupAttachment(VisualRoot);
	RearWheel->SetStaticMesh(CylinderMesh.Object);
	RearWheel->SetRelativeLocation(FVector(-146.0f, 0.0f, 35.0f));
	RearWheel->SetRelativeRotation(FRotator(0.0f, 0.0f, 90.0f));
	RearWheel->SetRelativeScale3D(FVector(0.82f, 0.82f, 0.18f));
	RearWheel->SetVisibility(!bHasImportedBike, true);
	RearWheel->SetHiddenInGame(bHasImportedBike);

	Handlebar = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Handlebar"));
	Handlebar->SetupAttachment(VisualRoot);
	Handlebar->SetStaticMesh(CubeMesh.Object);
	Handlebar->SetRelativeLocation(FVector(86.0f, 0.0f, 118.0f));
	Handlebar->SetRelativeScale3D(FVector(0.08f, 0.78f, 0.055f));
	Handlebar->SetVisibility(!bHasImportedBike, true);
	Handlebar->SetHiddenInGame(bHasImportedBike);

	NoseLight = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("NoseLight"));
	NoseLight->SetupAttachment(VisualRoot);
	NoseLight->SetStaticMesh(CubeMesh.Object);
	NoseLight->SetRelativeLocation(FVector(152.0f, 0.0f, 94.0f));
	NoseLight->SetRelativeScale3D(FVector(0.16f, 0.36f, 0.06f));
	NoseLight->SetVisibility(!bHasImportedBike, true);
	NoseLight->SetHiddenInGame(bHasImportedBike);

	RiderMesh = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("LinxiaRiderMesh"));
	RiderMesh->SetupAttachment(VisualRoot);
	if (PhaseMesh.Succeeded())
	{
		RiderMesh->SetSkeletalMesh(PhaseMesh.Object);
	}
	if (RideAnimation.Succeeded())
	{
		RiderMesh->SetAnimationMode(EAnimationMode::AnimationSingleNode);
		RiderMesh->SetAnimation(RideAnimation.Object);
		RiderMesh->PlayAnimation(RideAnimation.Object, true);
	}
	RiderMesh->SetRelativeLocation(FVector(28.0f, 0.0f, -16.0f));
	RiderMesh->SetRelativeRotation(FRotator(10.0f, 270.0f, 0.0f));
	RiderMesh->SetRelativeScale3D(FVector(0.88f, 0.88f, 0.88f));
	RiderMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	CameraBoom->SetupAttachment(SceneRoot);
	CameraBoom->SetRelativeLocation(FVector(-38.0f, 0.0f, 102.0f));
	CameraBoom->TargetArmLength = 540.0f;
	CameraBoom->SocketOffset = FVector(0.0f, 58.0f, 28.0f);
	CameraBoom->bUsePawnControlRotation = false;
	CameraBoom->bDoCollisionTest = true;
	CameraBoom->ProbeSize = 9.0f;
	CameraBoom->bEnableCameraLag = true;
	CameraBoom->CameraLagSpeed = 8.0f;
	CameraBoom->bEnableCameraRotationLag = true;
	CameraBoom->CameraRotationLagSpeed = 10.0f;

	FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
	FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
	FollowCamera->bUsePawnControlRotation = false;
	FollowCamera->bAutoActivate = true;
	FollowCamera->SetFieldOfView(70.0f);

	for (UActorComponent* Component : GetComponents())
	{
		if (UPrimitiveComponent* Primitive = Cast<UPrimitiveComponent>(Component))
		{
			Primitive->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		}
	}
}

void ALinxiaMotorcyclePawn::CalcCamera(float DeltaTime, FMinimalViewInfo& OutResult)
{
	if (FollowCamera && FollowCamera->IsActive())
	{
		FollowCamera->GetCameraView(DeltaTime, OutResult);
		return;
	}

	Super::CalcCamera(DeltaTime, OutResult);
}

float ALinxiaMotorcyclePawn::GetCurrentSpeedKmh() const
{
	return FMath::Abs(CurrentSpeed) * 0.036f;
}

float ALinxiaMotorcyclePawn::GetChaseTargetDistance() const
{
	if (!ChaseTarget)
	{
		return -1.0f;
	}

	return FVector::Dist2D(GetActorLocation(), ChaseTarget->GetActorLocation());
}

void ALinxiaMotorcyclePawn::BeginPlay()
{
	Super::BeginPlay();

	StartLocation = GetActorLocation();
	StartRotation = GetActorRotation();
	SmokeTestStartLocation = StartLocation;
	bSmokeTestActive = FParse::Param(FCommandLine::Get(), TEXT("LinxiaMotorcycleSmokeTest"));
	bCaptureTestActive = FParse::Value(FCommandLine::Get(), TEXT("LinxiaMotorcycleCapture="), CaptureOutputPath);
	if (bCaptureTestActive && CaptureOutputPath.IsEmpty())
	{
		CaptureOutputPath = FPaths::ProjectSavedDir() / TEXT("Screenshots/LinxiaMotorcycleCapture.png");
	}
	if (bCaptureTestActive)
	{
		FParse::Value(FCommandLine::Get(), TEXT("LinxiaMotorcycleCaptureView="), CaptureViewMode);
		ConfigureCaptureCamera();
	}
	ApplyMaterial(BikeBody, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_TacticalBlack.M_NC_TacticalBlack"));
	ApplyMaterial(Seat, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_BattleGraphite.M_NC_BattleGraphite"));
	ApplyMaterial(FrontFairing, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_TacticalBlack.M_NC_TacticalBlack"));
	ApplyMaterial(FrontWheel, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_RubberBlack.M_NC_RubberBlack"));
	ApplyMaterial(RearWheel, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_RubberBlack.M_NC_RubberBlack"));
	ApplyMaterial(Handlebar, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_BattleGraphite.M_NC_BattleGraphite"));
	ApplyMaterial(NoseLight, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_CyanDiagnostic.M_NC_CyanDiagnostic"));
	StartRiderAnimation();
	UE_LOG(LogTemp, Display, TEXT("[LinxiaMotorcycle] Visual alignment bikeRot=%s riderRot=%s"),
		ImportedMotorcycle ? *ImportedMotorcycle->GetRelativeRotation().ToCompactString() : TEXT("None"),
		RiderMesh ? *RiderMesh->GetRelativeRotation().ToCompactString() : TEXT("None"));

	for (TActorIterator<AActor> It(GetWorld()); It; ++It)
	{
		if (It->ActorHasTag(TEXT("Gate3ChaseTarget")))
		{
			ChaseTarget = *It;
			break;
		}
	}

	EnsurePlayerPossession();
	if (bSmokeTestActive)
	{
		UE_LOG(LogTemp, Display, TEXT("[LinxiaMotorcycleSmokeTest] Started at %s"), *SmokeTestStartLocation.ToCompactString());
	}
	UpdateTargetDistanceLog();
}

void ALinxiaMotorcyclePawn::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	EnsurePlayerPossession();
	PollDirectPlayerInput(DeltaSeconds);
	RunSmokeTest(DeltaSeconds);
	RunCaptureTest(DeltaSeconds);
	UpdateMotorcycleMotion(DeltaSeconds);
	UpdateVisuals(DeltaSeconds);
	UpdateTargetDistanceLog();
}

void ALinxiaMotorcyclePawn::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);
}

void ALinxiaMotorcyclePawn::EnsurePlayerPossession()
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
	PlayerController->SetShowMouseCursor(false);
	if (!bLoggedPossession && PlayerController->GetPawn() == this)
	{
		PlayerController->SetControlRotation(FRotator(CameraPitch, GetActorRotation().Yaw + CameraYawOffset, 0.0f));
		UE_LOG(LogTemp, Display, TEXT("[LinxiaMotorcycle] Player0 now controls %s at %s"),
			*GetName(),
			*GetActorLocation().ToCompactString());
		bLoggedPossession = true;
	}
}

void ALinxiaMotorcyclePawn::PollDirectPlayerInput(float DeltaSeconds)
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

	ThrottleInput = FMath::Clamp(Forward, -1.0f, 1.0f);
	SteerInput = FMath::Clamp(Right, -1.0f, 1.0f);
	bHandbrakeHeld = PlayerController->IsInputKeyDown(EKeys::SpaceBar);

	float MouseX = 0.0f;
	float MouseY = 0.0f;
	PlayerController->GetInputMouseDelta(MouseX, MouseY);
	CameraYawOffset = FMath::Clamp(CameraYawOffset + MouseX * CameraMouseYawScale, -55.0f, 55.0f);
	CameraPitch = FMath::Clamp(CameraPitch - MouseY * CameraMousePitchScale, -24.0f, 8.0f);

	if (FMath::Abs(MouseX) < 0.02f && FMath::Abs(SteerInput) < 0.1f && ThrottleInput > 0.1f)
	{
		CameraYawOffset = FMath::FInterpTo(CameraYawOffset, 0.0f, DeltaSeconds, CameraFollowInterp);
	}

	if (PlayerController->IsInputKeyDown(EKeys::BackSpace) || PlayerController->IsInputKeyDown(EKeys::R))
	{
		ResetToStart();
		bTargetCaught = false;
	}
}

void ALinxiaMotorcyclePawn::UpdateMotorcycleMotion(float DeltaSeconds)
{
	if (ThrottleInput > 0.05f)
	{
		TargetSpeed = MaxForwardSpeed * ThrottleInput;
		CurrentSpeed = FMath::FInterpTo(CurrentSpeed, TargetSpeed, DeltaSeconds, AccelerationInterp);
	}
	else if (ThrottleInput < -0.05f)
	{
		TargetSpeed = MaxReverseSpeed * -ThrottleInput;
		CurrentSpeed = FMath::FInterpTo(CurrentSpeed, TargetSpeed, DeltaSeconds, BrakeInterp);
	}
	else
	{
		TargetSpeed = 0.0f;
		CurrentSpeed = FMath::FInterpTo(CurrentSpeed, TargetSpeed, DeltaSeconds, CoastingInterp);
	}

	if (bHandbrakeHeld)
	{
		CurrentSpeed = FMath::FInterpTo(CurrentSpeed, 0.0f, DeltaSeconds, 5.8f);
	}

	const float SpeedFactor = FMath::Clamp(FMath::Abs(CurrentSpeed) / MaxForwardSpeed, 0.0f, 1.0f);
	const float DirectionSign = CurrentSpeed >= 0.0f ? 1.0f : -1.0f;
	const float TurnAmount = SteerInput * MaxTurnRateDegrees * (0.18f + SpeedFactor * 0.82f) * DirectionSign * DeltaSeconds;
	AddActorWorldRotation(FRotator(0.0f, TurnAmount, 0.0f));
	AddActorWorldOffset(GetActorForwardVector() * CurrentSpeed * DeltaSeconds, false);

	const FRotator CameraRotation(CameraPitch, GetActorRotation().Yaw + CameraYawOffset, 0.0f);
	CameraBoom->SetWorldRotation(CameraRotation);
}

void ALinxiaMotorcyclePawn::UpdateVisuals(float DeltaSeconds)
{
	const float LeanRoll = FMath::Clamp(-SteerInput * 13.0f * FMath::Clamp(FMath::Abs(CurrentSpeed) / 900.0f, 0.0f, 1.0f), -13.0f, 13.0f);
	const float NosePitch = FMath::Clamp(-ThrottleInput * 2.0f + (bHandbrakeHeld ? 3.0f : 0.0f), -4.0f, 4.0f);
	VisualRoot->SetRelativeRotation(FMath::RInterpTo(VisualRoot->GetRelativeRotation(), FRotator(NosePitch, 0.0f, LeanRoll), DeltaSeconds, 7.0f));

	const float WheelCircumference = 2.0f * PI * 37.0f;
	WheelSpinDegrees = FMath::Fmod(WheelSpinDegrees + (CurrentSpeed * DeltaSeconds / WheelCircumference) * 360.0f, 360.0f);
	FrontWheel->SetRelativeRotation(FRotator(WheelSpinDegrees, SteerInput * 18.0f, 90.0f));
	RearWheel->SetRelativeRotation(FRotator(WheelSpinDegrees, 0.0f, 90.0f));
}

void ALinxiaMotorcyclePawn::RunSmokeTest(float DeltaSeconds)
{
	if (!bSmokeTestActive || bSmokeTestCompleted)
	{
		return;
	}

	SmokeTestElapsed += DeltaSeconds;
	ThrottleInput = 1.0f;
	SteerInput = SmokeTestElapsed > 1.0f ? 0.22f : 0.0f;

	if (SmokeTestElapsed >= SmokeTestDuration)
	{
		const float Distance = FVector::Dist2D(SmokeTestStartLocation, GetActorLocation());
		const float TargetDistance = ChaseTarget ? FVector::Dist2D(GetActorLocation(), ChaseTarget->GetActorLocation()) : -1.0f;
		UE_LOG(LogTemp, Display, TEXT("[LinxiaMotorcycleSmokeTest] Completed distance=%.1f targetDistance=%.1f speed=%.1f start=%s end=%s"),
			Distance,
			TargetDistance,
			CurrentSpeed,
			*SmokeTestStartLocation.ToCompactString(),
			*GetActorLocation().ToCompactString());
		bSmokeTestCompleted = true;
		FPlatformMisc::RequestExit(false);
	}
}

void ALinxiaMotorcyclePawn::RunCaptureTest(float DeltaSeconds)
{
	if (!bCaptureTestActive)
	{
		return;
	}

	CaptureTestElapsed += DeltaSeconds;
	if (!bCaptureRequested && CaptureTestElapsed >= CaptureRequestTime)
	{
		IFileManager::Get().MakeDirectory(*FPaths::GetPath(CaptureOutputPath), true);
		UE_LOG(LogTemp, Display, TEXT("[LinxiaMotorcycleCapture] Requesting screenshot %s"), *CaptureOutputPath);
		FScreenshotRequest::RequestScreenshot(CaptureOutputPath, true, false);
		bCaptureRequested = true;
	}

	if (bCaptureRequested && CaptureTestElapsed >= CaptureExitTime)
	{
		UE_LOG(LogTemp, Display, TEXT("[LinxiaMotorcycleCapture] Completed"));
		FPlatformMisc::RequestExit(false);
	}
}

void ALinxiaMotorcyclePawn::ResetToStart()
{
	SetActorLocation(StartLocation, false);
	SetActorRotation(StartRotation);
	CurrentSpeed = 0.0f;
	TargetSpeed = 0.0f;
	CameraYawOffset = 0.0f;
	VisualRoot->SetRelativeRotation(FRotator::ZeroRotator);
	UE_LOG(LogTemp, Display, TEXT("[LinxiaMotorcycle] Reset to start"));
}

void ALinxiaMotorcyclePawn::UpdateTargetDistanceLog()
{
	if (!ChaseTarget)
	{
		return;
	}

	TargetLogElapsed += GetWorld() ? GetWorld()->GetDeltaSeconds() : 0.0f;
	if (TargetLogElapsed < 2.0f)
	{
		return;
	}
	TargetLogElapsed = 0.0f;

	const float Distance = FVector::Dist2D(GetActorLocation(), ChaseTarget->GetActorLocation());
	if (!bTargetCaught && Distance <= ChaseCatchDistance)
	{
		bTargetCaught = true;
		CurrentSpeed = FMath::Min(CurrentSpeed, MaxForwardSpeed * 0.42f);
		UE_LOG(LogTemp, Display, TEXT("[LinxiaMotorcycle] Chase target caught distance=%.1f"), Distance);
	}

	if (FMath::Abs(Distance - LastTargetDistance) > 75.0f)
	{
		UE_LOG(LogTemp, Display, TEXT("[LinxiaMotorcycle] ChaseTargetDistance=%.1f"), Distance);
		LastTargetDistance = Distance;
	}
}

void ALinxiaMotorcyclePawn::StartRiderAnimation()
{
	if (!RiderMesh)
	{
		return;
	}

	UAnimationAsset* RideAnimation = LoadObject<UAnimationAsset>(nullptr, LinxiaRideAnimationPath);
	if (!RideAnimation)
	{
		UE_LOG(LogTemp, Warning, TEXT("[LinxiaMotorcycle] Missing rider animation asset: %s"), LinxiaRideAnimationPath);
		return;
	}

	RiderMesh->SetAnimationMode(EAnimationMode::AnimationSingleNode);
	RiderMesh->SetAnimation(RideAnimation);
	RiderMesh->PlayAnimation(RideAnimation, true);
	UE_LOG(LogTemp, Display, TEXT("[LinxiaMotorcycle] Rider animation=%s"), LinxiaRideAnimationPath);
	LogRiderContactPose();
}

void ALinxiaMotorcyclePawn::LogRiderContactPose()
{
	if (!RiderMesh)
	{
		return;
	}

	const FVector HandL = RiderMesh->GetBoneLocation(TEXT("hand_l"), EBoneSpaces::ComponentSpace);
	const FVector HandR = RiderMesh->GetBoneLocation(TEXT("hand_r"), EBoneSpaces::ComponentSpace);
	const FVector FootL = RiderMesh->GetBoneLocation(TEXT("foot_l"), EBoneSpaces::ComponentSpace);
	const FVector FootR = RiderMesh->GetBoneLocation(TEXT("foot_r"), EBoneSpaces::ComponentSpace);
	UE_LOG(LogTemp, Display, TEXT("[LinxiaMotorcycle] Rider contact pose handL=%s handR=%s footL=%s footR=%s"),
		*HandL.ToCompactString(),
		*HandR.ToCompactString(),
		*FootL.ToCompactString(),
		*FootR.ToCompactString());
}

void ALinxiaMotorcyclePawn::ConfigureCaptureCamera()
{
	if (!CameraBoom)
	{
		return;
	}

	const FString View = CaptureViewMode.ToLower();
	if (View == TEXT("side"))
	{
		CameraYawOffset = 82.0f;
		CameraPitch = -5.0f;
		CameraBoom->TargetArmLength = 650.0f;
		CameraBoom->SocketOffset = FVector(0.0f, 0.0f, 18.0f);
		FollowCamera->SetFieldOfView(54.0f);
	}
	else if (View == TEXT("rear"))
	{
		CameraYawOffset = -24.0f;
		CameraPitch = -7.0f;
		CameraBoom->TargetArmLength = 560.0f;
		CameraBoom->SocketOffset = FVector(0.0f, 26.0f, 24.0f);
		FollowCamera->SetFieldOfView(62.0f);
	}

	UE_LOG(LogTemp, Display, TEXT("[LinxiaMotorcycleCapture] View=%s yawOffset=%.1f pitch=%.1f arm=%.1f"),
		*CaptureViewMode,
		CameraYawOffset,
		CameraPitch,
		CameraBoom->TargetArmLength);
}

void ALinxiaMotorcyclePawn::ApplyMaterial(UStaticMeshComponent* Component, const TCHAR* MaterialPath)
{
	if (!Component)
	{
		return;
	}

	if (UMaterialInterface* Material = LoadObject<UMaterialInterface>(nullptr, MaterialPath))
	{
		Component->SetMaterial(0, Material);
	}
}
