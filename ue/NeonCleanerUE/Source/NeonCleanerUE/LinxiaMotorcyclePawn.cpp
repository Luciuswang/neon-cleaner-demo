#include "LinxiaMotorcyclePawn.h"

#include "Camera/CameraComponent.h"
#include "Components/BoxComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/PoseableMeshComponent.h"
#include "Components/SpotLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"
#include "HAL/FileManager.h"
#include "GameFramework/SpringArmComponent.h"
#include "InputCoreTypes.h"
#include "Kismet/GameplayStatics.h"
#include "LinxiaMotorcycleChaseGameMode.h"
#include "Materials/MaterialInterface.h"
#include "Misc/CommandLine.h"
#include "Misc/App.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "UObject/ConstructorHelpers.h"
#include "UnrealClient.h"

namespace
{
constexpr float MaxForwardSpeed = 2050.0f;
constexpr float MaxBoostSpeed = 2750.0f;
constexpr float MaxReverseSpeed = -420.0f;
constexpr float AccelerationInterp = 2.4f;
constexpr float BrakeInterp = 5.2f;
constexpr float CoastingInterp = 1.15f;
constexpr float MaxTurnRateDegrees = 92.0f;
constexpr float MaxLaneOffset = 480.0f;
constexpr float MaxLaneSpeed = 760.0f;
constexpr float CameraMouseYawScale = 0.18f;
constexpr float CameraMousePitchScale = 0.12f;
constexpr float CameraFollowInterp = 7.5f;
constexpr float SmokeTestDuration = 4.0f;
constexpr float CaptureRequestTime = 8.0f;
constexpr float CaptureExitTime = 10.5f;
constexpr float ChaseCatchDistance = 520.0f;
constexpr float RiderContactToleranceCm = 3.0f;

const TCHAR* KellyMeshPath = TEXT("/Game/KellyLowSource/asda.asda");
// Measured on source OBJ grip geometry, not fitted to the rider's wrist.
// Import transform: visual = (6 + 230*x, -230*z, 58 + 230*y).
const FVector RiderLeftGripVisual(38.5f, -38.5f, 108.5f);
const FVector RiderRightGripVisual(38.5f, 38.5f, 108.5f);
const FVector WristToGripVisual(5.3f, 0.0f, -1.8f);
const FVector RiderLeftFootVisual(-4.0f, -32.0f, 48.0f);
const FVector RiderRightFootVisual(-4.0f, 32.0f, 48.0f);
const FVector RiderFootPegCenterVisual(-4.0f, 0.0f, 44.0f);
}

ALinxiaMotorcyclePawn::ALinxiaMotorcyclePawn()
{
	PrimaryActorTick.bCanEverTick = true;
	AutoPossessPlayer = EAutoReceiveInput::Player0;
	bFindCameraComponentWhenViewTarget = true;

	SceneRoot = CreateDefaultSubobject<UBoxComponent>(TEXT("VehicleCollision"));
	SceneRoot->InitBoxExtent(FVector(165.0f, 62.0f, 64.0f));
	SceneRoot->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	SceneRoot->SetCollisionObjectType(ECC_Pawn);
	SceneRoot->SetCollisionResponseToAllChannels(ECR_Ignore);
	SceneRoot->SetCollisionResponseToChannel(ECC_WorldStatic, ECR_Block);
	SceneRoot->SetCollisionResponseToChannel(ECC_WorldDynamic, ECR_Block);
	SceneRoot->SetCanEverAffectNavigation(false);
	SetRootComponent(SceneRoot);

	VisualRoot = CreateDefaultSubobject<USceneComponent>(TEXT("VisualRoot"));
	VisualRoot->SetupAttachment(SceneRoot);
	VisualRoot->SetRelativeLocation(FVector(0.0f, 0.0f, 0.0f));

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderMesh(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> ImportedBikeMesh(TEXT("/Game/LinxiaChase/Imported/SM_PlayerMotorcycle.SM_PlayerMotorcycle"));
	static ConstructorHelpers::FObjectFinder<USkeletalMesh> KellyMesh(KellyMeshPath);

	const bool bHasImportedBike = ImportedBikeMesh.Succeeded();

	ImportedMotorcycle = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("ImportedMotorcycle"));
	ImportedMotorcycle->SetupAttachment(VisualRoot);
	if (bHasImportedBike)
	{
		ImportedMotorcycle->SetStaticMesh(ImportedBikeMesh.Object);
	}
	ImportedMotorcycle->SetRelativeLocation(FVector(6.0f, 0.0f, 58.0f));
	ImportedMotorcycle->SetRelativeRotation(FRotator(0.0f, 0.0f, 90.0f));
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
	Seat->SetRelativeScale3D(FVector(0.74f, 0.3f, 0.07f));
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
	const FVector HandlebarVector = RiderRightGripVisual - RiderLeftGripVisual;
	Handlebar->SetRelativeLocation((RiderLeftGripVisual + RiderRightGripVisual) * 0.5f);
	Handlebar->SetRelativeRotation(FRotationMatrix::MakeFromY(HandlebarVector).Rotator());
	Handlebar->SetRelativeScale3D(FVector(0.07f, HandlebarVector.Size() / 100.0f, 0.04f));
	Handlebar->SetVisibility(!bHasImportedBike, true);
	Handlebar->SetHiddenInGame(bHasImportedBike);

	FootPegBar = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("FootPegBar"));
	FootPegBar->SetupAttachment(VisualRoot);
	FootPegBar->SetStaticMesh(CubeMesh.Object);
	FootPegBar->SetRelativeLocation(RiderFootPegCenterVisual);
	FootPegBar->SetRelativeScale3D(FVector(0.14f, 0.64f, 0.032f));
	FootPegBar->SetVisibility(true, true);
	FootPegBar->SetHiddenInGame(false);

	NoseLight = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("NoseLight"));
	NoseLight->SetupAttachment(VisualRoot);
	NoseLight->SetStaticMesh(CubeMesh.Object);
	NoseLight->SetRelativeLocation(FVector(152.0f, 0.0f, 94.0f));
	NoseLight->SetRelativeScale3D(FVector(0.16f, 0.36f, 0.06f));
	NoseLight->SetVisibility(!bHasImportedBike, true);
	NoseLight->SetHiddenInGame(bHasImportedBike);

	Headlight = CreateDefaultSubobject<USpotLightComponent>(TEXT("MotorcycleHeadlight"));
	Headlight->SetupAttachment(VisualRoot);
	Headlight->SetRelativeLocation(FVector(155.0f, 0.0f, 100.0f));
	Headlight->SetRelativeRotation(FRotator(-6.0f, 0.0f, 0.0f));
	Headlight->SetIntensityUnits(ELightUnits::Lumens);
	Headlight->SetIntensity(1600.0f);
	Headlight->SetLightColor(FLinearColor(0.82f, 0.90f, 1.0f), false);
	Headlight->SetAttenuationRadius(3400.0f);
	Headlight->SetInnerConeAngle(17.0f);
	Headlight->SetOuterConeAngle(29.0f);
	Headlight->SetCastShadows(true);
	Headlight->SetSourceRadius(9.0f);
	Headlight->SetVolumetricScatteringIntensity(0.35f);

	Underglow = CreateDefaultSubobject<UPointLightComponent>(TEXT("MotorcycleUnderglow"));
	Underglow->SetupAttachment(VisualRoot);
	Underglow->SetRelativeLocation(FVector(-20.0f, 0.0f, 42.0f));
	Underglow->SetIntensityUnits(ELightUnits::Lumens);
	Underglow->SetIntensity(18.0f);
	Underglow->SetLightColor(FLinearColor(0.0f, 0.72f, 1.0f), false);
	Underglow->SetAttenuationRadius(380.0f);
	Underglow->SetCastShadows(false);
	Underglow->SetVolumetricScatteringIntensity(0.1f);

	WeaponBarrel = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("WeaponBarrel"));
	WeaponBarrel->SetupAttachment(VisualRoot);
	WeaponBarrel->SetStaticMesh(CylinderMesh.Object);
	WeaponBarrel->SetRelativeLocation(FVector(126.0f, 0.0f, 78.0f));
	WeaponBarrel->SetRelativeRotation(FRotator(90.0f, 0.0f, 0.0f));
	WeaponBarrel->SetRelativeScale3D(FVector(0.055f, 0.055f, 0.48f));

	WeaponTrace = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("WeaponTrace"));
	WeaponTrace->SetupAttachment(SceneRoot);
	WeaponTrace->SetStaticMesh(CubeMesh.Object);
	WeaponTrace->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	WeaponTrace->SetCastShadow(false);
	WeaponTrace->SetVisibility(false);

	RiderMesh = CreateDefaultSubobject<UPoseableMeshComponent>(TEXT("LinxiaRiderMesh"));
	RiderMesh->SetupAttachment(VisualRoot);
	if (KellyMesh.Succeeded())
	{
		RiderMesh->SetSkinnedAssetAndUpdate(KellyMesh.Object);
	}
	RiderMesh->SetRelativeLocation(FVector(-30.0f, 0.0f, -5.0f));
	RiderMesh->SetRelativeRotation(FRotator(0.0f, 270.0f, 0.0f));
	RiderMesh->SetRelativeScale3D(FVector(1.0f, 1.0f, 1.0f));
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
			if (Primitive != SceneRoot)
			{
				Primitive->SetCollisionEnabled(ECollisionEnabled::NoCollision);
			}
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

bool ALinxiaMotorcyclePawn::IsGameplayReady() const
{
	return SceneRoot && RiderMesh && RiderMesh->GetSkinnedAsset();
}

void ALinxiaMotorcyclePawn::PrepareForEncounter()
{
	SceneRoot->SetCollisionEnabled(IsLegacyTest() ? ECollisionEnabled::NoCollision : ECollisionEnabled::QueryOnly);
	bGameplayFrozen = true;
	ThrottleInput = 0.0f;
	SteerInput = 0.0f;
	bHandbrakeHeld = false;
	bFireHeld = false;
	bBoostHeld = false;
	bBoosting = false;
	UpdateCamera();
}

void ALinxiaMotorcyclePawn::ResetEncounter()
{
	SetActorLocationAndRotation(StartLocation, StartRotation, false, nullptr, ETeleportType::TeleportPhysics);
	CurrentSpeed = 0.0f;
	TargetSpeed = 0.0f;
	ThrottleInput = 0.0f;
	SteerInput = 0.0f;
	SmoothedSteer = 0.0f;
	LateralSpeed = 0.0f;
	CameraYawOffset = 0.0f;
	CameraPitch = -8.0f;
	Health = 100.0f;
	BoostEnergy = 100.0f;
	BoostCooldown = 0.0f;
	DamageCooldown = 0.0f;
	DamageFlash = 0.0f;
	HitFlash = 0.0f;
	WeaponCooldown = 0.0f;
	WeaponTraceTime = 0.0f;
	bFireHeld = false;
	bBoostHeld = false;
	bBoosting = false;
	bHandbrakeHeld = false;
	bTargetCaught = false;
	bGameplayFrozen = true;
	ChaseTarget = nullptr;
	VisualRoot->SetRelativeRotation(FRotator::ZeroRotator);
	WeaponTrace->SetVisibility(false);
	UpdateCamera();
	UE_LOG(LogTemp, Display, TEXT("[NeonChase] RiderReset location=%s"), *StartLocation.ToCompactString());
}

void ALinxiaMotorcyclePawn::FreezeGameplay()
{
	bGameplayFrozen = true;
	ThrottleInput = 0.0f;
	SteerInput = 0.0f;
	bHandbrakeHeld = false;
	bFireHeld = false;
	bBoostHeld = false;
	bBoosting = false;
	WeaponTraceTime = 0.0f;
	if (WeaponTrace)
	{
		WeaponTrace->SetVisibility(false);
	}
}

void ALinxiaMotorcyclePawn::StepGameplay(
	float DeltaSeconds,
	bool bAutomated,
	float Forward,
	float Steer,
	bool bFire,
	bool bBoost)
{
	ALinxiaMotorcycleChaseGameMode* Mode = GetWorld()
		? GetWorld()->GetAuthGameMode<ALinxiaMotorcycleChaseGameMode>()
		: nullptr;
	if (!Mode || !Mode->IsPlaying())
	{
		return;
	}

	bGameplayFrozen = false;
	if (bAutomated)
	{
		ThrottleInput = FMath::Clamp(Forward, -1.0f, 1.0f);
		SteerInput = FMath::Clamp(Steer, -1.0f, 1.0f);
		bFireHeld = bFire;
		bBoostHeld = bBoost;
		bHandbrakeHeld = Forward < -0.5f && CurrentSpeed > 120.0f;
	}

	BoostCooldown = FMath::Max(0.0f, BoostCooldown - DeltaSeconds);
	DamageCooldown = FMath::Max(0.0f, DamageCooldown - DeltaSeconds);
	DamageFlash = FMath::Max(0.0f, DamageFlash - DeltaSeconds * 2.1f);
	HitFlash = FMath::Max(0.0f, HitFlash - DeltaSeconds * 3.5f);
	WeaponCooldown = FMath::Max(0.0f, WeaponCooldown - DeltaSeconds);
	WeaponTraceTime = FMath::Max(0.0f, WeaponTraceTime - DeltaSeconds);
	if (WeaponTraceTime <= 0.0f && WeaponTrace)
	{
		WeaponTrace->SetVisibility(false);
	}

	bBoosting = bBoostHeld && ThrottleInput > 0.25f && !bHandbrakeHeld
		&& BoostCooldown <= 0.0f && BoostEnergy > 0.0f;
	if (bBoosting)
	{
		BoostEnergy = FMath::Max(0.0f, BoostEnergy - DeltaSeconds * 31.0f);
		if (BoostEnergy <= 0.0f)
		{
			bBoosting = false;
			BoostCooldown = 2.0f;
		}
	}
	else if (BoostCooldown <= 0.0f)
	{
		BoostEnergy = FMath::Min(100.0f, BoostEnergy + DeltaSeconds * 17.0f);
	}

	if (bFireHeld && WeaponCooldown <= 0.0f)
	{
		WeaponCooldown = 0.18f;
		Mode->FirePlayerWeapon();
	}

	UpdateMotorcycleMotion(DeltaSeconds);
	UpdateGroundAlignment(DeltaSeconds);
	UpdateVisuals(DeltaSeconds);
	UpdateCamera();
}

void ALinxiaMotorcyclePawn::ReceiveChaseDamage(float Amount, FName Source)
{
	ALinxiaMotorcycleChaseGameMode* Mode = GetWorld()
		? GetWorld()->GetAuthGameMode<ALinxiaMotorcycleChaseGameMode>()
		: nullptr;
	if (!Mode || !Mode->IsPlaying() || DamageCooldown > 0.0f || Amount <= 0.0f)
	{
		return;
	}

	Health = FMath::Max(0.0f, Health - Amount);
	DamageCooldown = 0.42f;
	DamageFlash = 1.0f;
	CurrentSpeed *= 0.72f;
	UE_LOG(LogTemp, Display, TEXT("[NeonChase] RiderDamage amount=%.1f health=%.1f source=%s"),
		Amount, Health, *Source.ToString());
}

void ALinxiaMotorcyclePawn::ShowWeaponTrace(const FVector& Start, const FVector& End, bool bHit)
{
	if (!WeaponTrace)
	{
		return;
	}

	const FVector Delta = End - Start;
	WeaponTrace->SetWorldLocation((Start + End) * 0.5f);
	WeaponTrace->SetWorldRotation(FRotationMatrix::MakeFromX(Delta).Rotator());
	WeaponTrace->SetWorldScale3D(FVector(
		FMath::Max(0.01f, Delta.Size() / 100.0f),
		bHit ? 0.045f : 0.025f,
		bHit ? 0.045f : 0.025f));
	WeaponTrace->SetVisibility(true);
	WeaponTraceTime = bHit ? 0.09f : 0.045f;
	if (bHit)
	{
		HitFlash = 1.0f;
	}
}

void ALinxiaMotorcyclePawn::BeginPlay()
{
	Super::BeginPlay();

	StartLocation = GetActorLocation();
	StartRotation = GetActorRotation();
	SmokeTestStartLocation = StartLocation;
	bRiderMotionCapture = FParse::Param(FCommandLine::Get(), TEXT("LinxiaRiderMotionCapture"));
	bRiderVideoCapture = FParse::Param(FCommandLine::Get(), TEXT("LinxiaRiderVideo"));
	bSmokeTestActive = FParse::Param(FCommandLine::Get(), TEXT("LinxiaMotorcycleSmokeTest"));
	bCaptureTestActive = FParse::Value(FCommandLine::Get(), TEXT("LinxiaMotorcycleCapture="), CaptureOutputPath);
	if (bCaptureTestActive && CaptureOutputPath.IsEmpty())
	{
		CaptureOutputPath = FPaths::ProjectSavedDir() / TEXT("Screenshots/LinxiaMotorcycleCapture.png");
	}
	if (bCaptureTestActive)
	{
		if (bRiderVideoCapture)
		{
			bRiderMotionCapture = true;
			FApp::SetUseFixedTimeStep(true);
			FApp::SetFixedDeltaTime(1.0 / 30.0);
			UE_LOG(LogTemp, Display, TEXT("[NeonRiderVideo] FixedSimulationStep=30fps requestedFrames=360 NOT_A_PERFORMANCE_BENCHMARK"));
		}
		FParse::Value(FCommandLine::Get(), TEXT("LinxiaMotorcycleCaptureView="), CaptureViewMode);
		ConfigureCaptureCamera();
	}
	ApplyMaterial(BikeBody, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_TacticalBlack.M_NC_TacticalBlack"));
	ApplyMaterial(Seat, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_BattleGraphite.M_NC_BattleGraphite"));
	ApplyMaterial(FrontFairing, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_TacticalBlack.M_NC_TacticalBlack"));
	ApplyMaterial(FrontWheel, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_RubberBlack.M_NC_RubberBlack"));
	ApplyMaterial(RearWheel, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_RubberBlack.M_NC_RubberBlack"));
	ApplyMaterial(Handlebar, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_BattleGraphite.M_NC_BattleGraphite"));
	ApplyMaterial(FootPegBar, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_BattleGraphite.M_NC_BattleGraphite"));
	ApplyMaterial(NoseLight, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_CyanDiagnostic.M_NC_CyanDiagnostic"));
	ApplyMaterial(WeaponBarrel, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_BattleGraphite.M_NC_BattleGraphite"));
	ApplyMaterial(WeaponTrace, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_CyanDiagnostic.M_NC_CyanDiagnostic"));
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
	ALinxiaMotorcycleChaseGameMode* Mode = GetWorld()
		? GetWorld()->GetAuthGameMode<ALinxiaMotorcycleChaseGameMode>()
		: nullptr;
	if (IsLegacyTest())
	{
		EnsurePlayerPossession();
		PollDirectPlayerInput(DeltaSeconds);
		RunSmokeTest(DeltaSeconds);
		RunCaptureTest(DeltaSeconds);
		UpdateMotorcycleMotion(DeltaSeconds);
		UpdateVisuals(DeltaSeconds);
		UpdateTargetDistanceLog();
	}
	else if (Mode && Mode->IsPlaying())
	{
		PollDirectPlayerInput(DeltaSeconds);
	}
	if (!bLoggedRiderContactPoseAfterAnimation)
	{
		RiderPoseLogElapsed += DeltaSeconds;
		if (RiderPoseLogElapsed >= 0.5f)
		{
			LogRiderContactPose();
			bLoggedRiderContactPoseAfterAnimation = true;
		}
	}
	UpdateCamera();
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
	bFireHeld = PlayerController->IsInputKeyDown(EKeys::LeftMouseButton)
		|| PlayerController->IsInputKeyDown(EKeys::LeftControl);
	bBoostHeld = PlayerController->IsInputKeyDown(EKeys::LeftShift)
		|| PlayerController->IsInputKeyDown(EKeys::RightShift);

	float MouseX = 0.0f;
	float MouseY = 0.0f;
	PlayerController->GetInputMouseDelta(MouseX, MouseY);
	CameraYawOffset = FMath::Clamp(CameraYawOffset + MouseX * CameraMouseYawScale, -55.0f, 55.0f);
	CameraPitch = FMath::Clamp(CameraPitch - MouseY * CameraMousePitchScale, -24.0f, 8.0f);

	if (FMath::Abs(MouseX) < 0.02f && FMath::Abs(SteerInput) < 0.1f && ThrottleInput > 0.1f)
	{
		CameraYawOffset = FMath::FInterpTo(CameraYawOffset, 0.0f, DeltaSeconds, CameraFollowInterp);
	}

	if (IsLegacyTest()
		&& (PlayerController->IsInputKeyDown(EKeys::BackSpace) || PlayerController->IsInputKeyDown(EKeys::R)))
	{
		ResetToStart();
		bTargetCaught = false;
	}
}

void ALinxiaMotorcyclePawn::UpdateMotorcycleMotion(float DeltaSeconds)
{
	if (ThrottleInput > 0.05f)
	{
		TargetSpeed = (bBoosting ? MaxBoostSpeed : MaxForwardSpeed) * ThrottleInput;
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
	SmoothedSteer = FMath::FInterpTo(SmoothedSteer, SteerInput, DeltaSeconds, 4.5f);
	if (IsLegacyTest() && !bRiderMotionCapture)
	{
		const float DirectionSign = CurrentSpeed >= 0.0f ? 1.0f : -1.0f;
		const float TurnAmount = SmoothedSteer * MaxTurnRateDegrees
			* (0.18f + SpeedFactor * 0.82f) * DirectionSign * DeltaSeconds;
		AddActorWorldRotation(FRotator(0.0f, TurnAmount, 0.0f));
		AddActorWorldOffset(GetActorForwardVector() * CurrentSpeed * DeltaSeconds, false);
		return;
	}

	const float DesiredLaneSpeed = SmoothedSteer * MaxLaneSpeed * SpeedFactor;
	LateralSpeed = FMath::FInterpTo(LateralSpeed, DesiredLaneSpeed, DeltaSeconds, 5.0f);
	const float LaneSpeed = LateralSpeed;
	const FVector Before = GetActorLocation();
	FVector Delta(CurrentSpeed * DeltaSeconds, LaneSpeed * DeltaSeconds, 0.0f);
	const float TargetY = FMath::Clamp(Before.Y + Delta.Y, -MaxLaneOffset, MaxLaneOffset);
	Delta.Y = TargetY - Before.Y;
	FHitResult MoveHit;
	AddActorWorldOffset(Delta, true, &MoveHit);
	if (MoveHit.bBlockingHit)
	{
		// A blocked diagonal sweep must not discard its free tangential motion.
		// Retain the unconsumed movement and sweep along the contact plane so
		// steering can clear a vehicle's rear/side without tunnelling through it.
		FVector SurfaceNormal = MoveHit.Normal;
		SurfaceNormal.Z = 0.0f;
		if (SurfaceNormal.Normalize())
		{
			if (MoveHit.bStartPenetrating && MoveHit.PenetrationDepth > 0.0f)
			{
				FVector Separation = SurfaceNormal * (MoveHit.PenetrationDepth + 0.5f);
				Separation.Y = FMath::Clamp(GetActorLocation().Y + Separation.Y, -MaxLaneOffset, MaxLaneOffset) - GetActorLocation().Y;
				FHitResult SeparationHit;
				AddActorWorldOffset(Separation, true, &SeparationHit);
			}
			const FVector RemainingDelta = Delta * (1.0f - FMath::Clamp(MoveHit.Time, 0.0f, 1.0f));
			FVector SlideDelta = FVector::VectorPlaneProject(RemainingDelta, SurfaceNormal);
			SlideDelta.Z = 0.0f;
			SlideDelta.Y = FMath::Clamp(GetActorLocation().Y + SlideDelta.Y, -MaxLaneOffset, MaxLaneOffset) - GetActorLocation().Y;
			if (!SlideDelta.IsNearlyZero())
			{
				FHitResult SlideHit;
				AddActorWorldOffset(SlideDelta, true, &SlideHit);
			}
		}
		CurrentSpeed *= 0.38f;
		ReceiveChaseDamage(
			12.0f,
			MoveHit.GetActor() && MoveHit.GetActor()->ActorHasTag(TEXT("NeonChaseEnemy"))
				? FName(TEXT("VehicleImpact"))
				: FName(TEXT("ObstacleImpact")));
	}
	const float ActualLateralSpeed = (GetActorLocation().Y - Before.Y) / FMath::Max(DeltaSeconds, 0.001f);
	const float DesiredYaw = FMath::RadiansToDegrees(FMath::Atan2(ActualLateralSpeed, FMath::Max(FMath::Abs(CurrentSpeed), 350.0f)));
	SetActorRotation(FMath::RInterpTo(GetActorRotation(), FRotator(0.0f, DesiredYaw, 0.0f), DeltaSeconds, 6.0f));
	// At a lane boundary the bike settles instead of leaning into a stationary slide.
	LateralSpeed = ActualLateralSpeed;
}

void ALinxiaMotorcyclePawn::UpdateVisuals(float DeltaSeconds)
{
	const float EffectiveSteer = IsLegacyTest() && !bRiderMotionCapture ? SmoothedSteer : LateralSpeed / MaxLaneSpeed;
	const float LeanRoll = FMath::Clamp(-EffectiveSteer * 17.0f * FMath::Clamp(FMath::Abs(CurrentSpeed) / 900.0f, 0.0f, 1.0f), -17.0f, 17.0f);
	const float NosePitch = FMath::Clamp(-ThrottleInput * 2.0f + (bHandbrakeHeld ? 3.0f : 0.0f), -4.0f, 4.0f);
	VisualRoot->SetRelativeRotation(FMath::RInterpTo(VisualRoot->GetRelativeRotation(), FRotator(NosePitch, 0.0f, LeanRoll), DeltaSeconds, 7.0f));

	const float WheelCircumference = 2.0f * PI * 37.0f;
	WheelSpinDegrees = FMath::Fmod(WheelSpinDegrees + (CurrentSpeed * DeltaSeconds / WheelCircumference) * 360.0f, 360.0f);
	FrontWheel->SetRelativeRotation(FRotator(WheelSpinDegrees, SmoothedSteer * 8.0f, 90.0f));
	RearWheel->SetRelativeRotation(FRotator(WheelSpinDegrees, 0.0f, 90.0f));
	UpdateRiderPose();
	RiderMotionElapsed += DeltaSeconds;
	RiderMotionLogElapsed += DeltaSeconds;
	if (RiderMotionLogElapsed >= 0.5f)
	{
		RiderMotionLogElapsed = 0.0f;
		const FTransform ToVisual = RiderMesh->GetRelativeTransform();
		const FVector Left = ToVisual.TransformPosition(RiderMesh->GetBoneLocationByName(TEXT("bone_LeftHand"), EBoneSpaces::ComponentSpace)) + WristToGripVisual;
		const FVector Right = ToVisual.TransformPosition(RiderMesh->GetBoneLocationByName(TEXT("bone_RightHand"), EBoneSpaces::ComponentSpace)) + WristToGripVisual;
		UE_LOG(LogTemp, Display, TEXT("[NeonRiderMotion] t=%.3f input=%.3f steer=%.3f lateral=%.2f yaw=%.2f lean=%.2f palmProxyErrorL=%.3f palmProxyErrorR=%.3f actualSurfaceContact=UNVERIFIED location=%s braking=%d speed=%.2f"),
			RiderMotionElapsed, SteerInput, SmoothedSteer, LateralSpeed, GetActorRotation().Yaw, VisualRoot->GetRelativeRotation().Roll,
			FVector::Distance(Left, RiderLeftGripVisual), FVector::Distance(Right, RiderRightGripVisual), *GetActorLocation().ToCompactString(), bHandbrakeHeld ? 1 : 0, CurrentSpeed);
	}
}

void ALinxiaMotorcyclePawn::UpdateGroundAlignment(float DeltaSeconds)
{
	if (IsLegacyTest() || !GetWorld() || !SceneRoot)
	{
		return;
	}

	const FVector Location = GetActorLocation();
	FHitResult GroundHit;
	FCollisionQueryParams Query(SCENE_QUERY_STAT(NeonChaseGround), false, this);
	const FVector TraceStart(Location.X, Location.Y, Location.Z + 180.0f);
	const FVector TraceEnd(Location.X, Location.Y, Location.Z - 360.0f);
	if (GetWorld()->LineTraceSingleByChannel(GroundHit, TraceStart, TraceEnd, ECC_Visibility, Query)
		&& GroundHit.ImpactNormal.Z > 0.65f
		&& (!GroundHit.GetActor() || (!GroundHit.GetActor()->ActorHasTag(TEXT("NeonChaseObstacle"))
			&& !GroundHit.GetActor()->ActorHasTag(TEXT("NeonChaseEnemy")))))
	{
		// GameMode sets decorative road geometry to ignore ECC_Pawn. Keep the
		// collision box for obstacles; align actual tire bottom, not box bottom.
		// Imported OBJ minimum visual Z is -4.666cm at the current mesh transform.
		const float TargetZ = GroundHit.ImpactPoint.Z + 4.666f;
		FVector Aligned = Location;
		Aligned.Z = FMath::FInterpTo(Location.Z, TargetZ, DeltaSeconds, 12.0f);
		SetActorLocation(Aligned, false);
	}
}

void ALinxiaMotorcyclePawn::UpdateCamera()
{
	if (!CameraBoom)
	{
		return;
	}

	const FRotator CameraRotation(
		CameraPitch,
		GetActorRotation().Yaw + CameraYawOffset,
		0.0f);
	CameraBoom->SetWorldRotation(CameraRotation);
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
	if (bRiderMotionCapture)
	{
		// Settle, steer through both directions, then brake and recover to neutral.
		const bool bBraking = CaptureTestElapsed >= 14.0f && CaptureTestElapsed < 16.5f;
		const bool bBrakeRecovery = CaptureTestElapsed >= 14.0f;
		bHandbrakeHeld = bBraking;
		ThrottleInput = bBrakeRecovery ? 0.0f : 0.65f;
		SteerInput = CaptureTestElapsed < 4.0f || bBrakeRecovery ? 0.0f : 0.42f * FMath::Sin((CaptureTestElapsed - 4.0f) * 2.0f * PI / 6.0f);
		if (bRiderVideoCapture)
		{
			if (CaptureTestElapsed >= 4.0f && VideoCaptureFrame < 360 && !FScreenshotRequest::IsScreenshotRequested())
			{
				IFileManager::Get().MakeDirectory(*FPaths::GetPath(CaptureOutputPath), true);
				const FString FramePath = FPaths::GetPath(CaptureOutputPath) / FString::Printf(TEXT("video-%05d.png"), VideoCaptureFrame);
				FScreenshotRequest::RequestScreenshot(FramePath, false, false);
				UE_LOG(LogTemp, Display, TEXT("[NeonRiderVideo] frame=%d t=%.6f path=%s"), VideoCaptureFrame, CaptureTestElapsed, *FramePath);
				++VideoCaptureFrame;
			}
			if (VideoCaptureFrame >= 360 && CaptureTestElapsed >= 17.0f)
			{
				UE_LOG(LogTemp, Display, TEXT("[NeonRiderVideo] Completed requestedFrames=%d"), VideoCaptureFrame);
				FPlatformMisc::RequestExit(false);
			}
			return;
		}
		const float Times[] = {4.0f, 5.5f, 7.0f, 8.5f, 10.0f, 11.5f, 13.0f, 14.5f, 16.0f};
		if (MotionCaptureFrame < UE_ARRAY_COUNT(Times) && CaptureTestElapsed >= Times[MotionCaptureFrame])
		{
			IFileManager::Get().MakeDirectory(*FPaths::GetPath(CaptureOutputPath), true);
			const FString FramePath = FPaths::GetPath(CaptureOutputPath) / FString::Printf(TEXT("%s-motion-%02d.png"), *FPaths::GetBaseFilename(CaptureOutputPath), MotionCaptureFrame);
			FScreenshotRequest::RequestScreenshot(FramePath, false, false);
			UE_LOG(LogTemp, Display, TEXT("[NeonRiderMotionCapture] frame=%d t=%.3f path=%s"), MotionCaptureFrame, CaptureTestElapsed, *FramePath);
			++MotionCaptureFrame;
		}
		if (CaptureTestElapsed >= 17.0f) FPlatformMisc::RequestExit(false);
		return;
	}
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
	SmoothedSteer = 0.0f;
	LateralSpeed = 0.0f;
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
	if (IsLegacyTest() && !bTargetCaught && Distance <= ChaseCatchDistance)
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

	USkeletalMesh* KellyMesh = LoadObject<USkeletalMesh>(nullptr, KellyMeshPath);
	if (!KellyMesh)
	{
		UE_LOG(LogTemp, Error, TEXT("[LinxiaMotorcycle] Missing Kelly rider mesh: %s"), KellyMeshPath);
		return;
	}

	RiderMesh->SetSkinnedAssetAndUpdate(KellyMesh);
	RiderMesh->RefreshBoneTransforms();

	bRiderPoseInitialized = true;
	UpdateRiderPose();
	bLogIK = false;
}

void ALinxiaMotorcyclePawn::UpdateRiderPose()
{
	if (!bRiderPoseInitialized || !RiderMesh) return;
	// Rebuild from reference bones each update: never integrate yesterday's IK pose.
	for (int32 BoneIndex = 0; BoneIndex < RiderMesh->GetNumBones(); ++BoneIndex)
	{
		RiderMesh->ResetBoneTransformByName(RiderMesh->GetBoneName(BoneIndex));
	}
	RiderMesh->RefreshBoneTransforms();
	for (const TPair<FName, float>& SpineLean : {
		TPair<FName, float>(TEXT("bone_Spine"), -42.0f),
		TPair<FName, float>(TEXT("bone_Spine1"), -38.0f)})
	{
		const FTransform Current = RiderMesh->GetBoneTransformByName(
			SpineLean.Key, EBoneSpaces::ComponentSpace);
		const FQuat Lean(
			FVector::ForwardVector,
			FMath::DegreesToRadians(SpineLean.Value));
		RiderMesh->SetBoneRotationByName(
			SpineLean.Key,
			(FQuat(FVector::RightVector, FMath::DegreesToRadians(SmoothedSteer * 2.5f)) * Lean * Current.GetRotation()).Rotator(),
			EBoneSpaces::ComponentSpace);
		RiderMesh->RefreshBoneTransforms();
	}

	// Counter-rotate the neck so the seated forward flex keeps gaze on the road.
	const FTransform Neck = RiderMesh->GetBoneTransformByName(TEXT("bone_Neck"), EBoneSpaces::ComponentSpace);
	RiderMesh->SetBoneRotationByName(TEXT("bone_Neck"),
		(FQuat(FVector::ForwardVector, FMath::DegreesToRadians(32.0f)) * Neck.GetRotation()).Rotator(), EBoneSpaces::ComponentSpace);
	RiderMesh->RefreshBoneTransforms();
	const bool bLeftHandPassed = SolveRiderTwoBoneIK(
		TEXT("LeftHand"),
		TEXT("bone_LeftArm"), TEXT("bone_LeftForeArm"), TEXT("bone_LeftHand"),
		RiderLeftGripVisual - WristToGripVisual,
		FVector(-2.0f, -66.0f, 116.0f));
	const bool bRightHandPassed = SolveRiderTwoBoneIK(
		TEXT("RightHand"),
		TEXT("bone_RightArm"), TEXT("bone_RightForeArm"), TEXT("bone_RightHand"),
		RiderRightGripVisual - WristToGripVisual,
		FVector(-2.0f, 66.0f, 116.0f));
	const bool bLeftFootPassed = SolveRiderTwoBoneIK(
		TEXT("LeftFoot"),
		TEXT("bone_LeftLegUpper"), TEXT("bone_LeftLeg"), TEXT("bone_LeftAnkle"),
		RiderLeftFootVisual,
		FVector(24.0f, -24.0f, 76.0f));
	const bool bRightFootPassed = SolveRiderTwoBoneIK(
		TEXT("RightFoot"),
		TEXT("bone_RightLegUpper"), TEXT("bone_RightLeg"), TEXT("bone_RightAnkle"),
		RiderRightFootVisual,
		FVector(24.0f, 24.0f, 76.0f));

	OrientRiderHand(true);
	OrientRiderHand(false);
	const bool bAllContactsPassed =
		bLeftHandPassed && bRightHandPassed && bLeftFootPassed && bRightFootPassed;
	if (bLogIK) UE_LOG(LogTemp, Display,
		TEXT("[LinxiaMotorcycle] Rider source=%s pose=ProceduralTwoBoneIK contacts=%s metric=WristSolverOnly visualContact=UNVERIFIED gripSource=ImportedOBJ"),
		KellyMeshPath,
		bAllContactsPassed ? TEXT("PASS") : TEXT("FAIL"));
}

void ALinxiaMotorcyclePawn::OrientRiderHand(bool bLeft)
{
	// Kelly low rig has three deforming finger chains. Use its measured knuckle
	// frame, not guessed bone Euler axes, to put the palm over the existing grip.
	const FString Side = bLeft ? TEXT("Left") : TEXT("Right");
	const FName Hand(*FString::Printf(TEXT("bone_%sHand"), *Side));
	const FName Index(*FString::Printf(TEXT("bone_%s_Finger11"), *Side));
	const FName Outer(*FString::Printf(TEXT("bone_%s_Finger21"), *Side));
	const FVector Wrist = RiderMesh->GetBoneLocationByName(Hand, EBoneSpaces::ComponentSpace);
	const FVector A = RiderMesh->GetBoneLocationByName(Index, EBoneSpaces::ComponentSpace);
	const FVector B = RiderMesh->GetBoneLocationByName(Outer, EBoneSpaces::ComponentSpace);
	const FQuat SourceFrame = FRotationMatrix::MakeFromXY((A + B) * 0.5f - Wrist, A - B).ToQuat();
	const FTransform RiderToVisual = RiderMesh->GetRelativeTransform();
	const FVector Forward = RiderToVisual.InverseTransformVectorNoScale(FVector::ForwardVector);
	const FVector Across = RiderToVisual.InverseTransformVectorNoScale(FVector(0.0f, bLeft ? 1.0f : -1.0f, 0.0f));
	const FQuat DesiredFrame = FRotationMatrix::MakeFromXY(Forward, Across).ToQuat();
	const FQuat Existing = RiderMesh->GetBoneTransformByName(Hand, EBoneSpaces::ComponentSpace).GetRotation();
	RiderMesh->SetBoneRotationByName(Hand, (DesiredFrame * SourceFrame.Inverse() * Existing).Rotator(), EBoneSpaces::ComponentSpace);
	RiderMesh->RefreshBoneTransforms();

	auto AimFinger = [this, &RiderToVisual](FName Bone, FName Child, const FVector& VisualDirection)
	{
		const FVector From = RiderMesh->GetBoneLocationByName(Bone, EBoneSpaces::ComponentSpace);
		const FVector To = RiderMesh->GetBoneLocationByName(Child, EBoneSpaces::ComponentSpace);
		const FQuat ExistingRotation = RiderMesh->GetBoneTransformByName(Bone, EBoneSpaces::ComponentSpace).GetRotation();
		const FQuat Aim = FQuat::FindBetweenNormals((To - From).GetSafeNormal(), RiderToVisual.InverseTransformVectorNoScale(VisualDirection).GetSafeNormal());
		RiderMesh->SetBoneRotationByName(Bone, (Aim * ExistingRotation).Rotator(), EBoneSpaces::ComponentSpace);
		RiderMesh->RefreshBoneTransforms();
	};
	for (int32 Finger = 1; Finger <= 2; ++Finger)
	{
		const FName Proximal(*FString::Printf(TEXT("bone_%s_Finger%d1"), *Side, Finger));
		const FName Distal(*FString::Printf(TEXT("bone_%s_Finger%d2"), *Side, Finger));
		const FName Tip(*FString::Printf(TEXT("Bip01-%s-Finger%dNub"), bLeft ? TEXT("L") : TEXT("R"), Finger));
		AimFinger(Proximal, Distal, FVector(0.15f, 0.0f, -0.99f));
		AimFinger(Distal, Tip, FVector(-0.96f, 0.0f, -0.28f));
	}
	const FName Thumb(*FString::Printf(TEXT("bone_%s_Finger01"), *Side));
	const FName ThumbEnd(*FString::Printf(TEXT("bone_%s_Finger02"), *Side));
	const FName ThumbTip(*FString::Printf(TEXT("Bip01-%s-Finger0Nub"), bLeft ? TEXT("L") : TEXT("R")));
	AimFinger(Thumb, ThumbEnd, FVector(0.65f, bLeft ? -0.35f : 0.35f, -0.68f));
	AimFinger(ThumbEnd, ThumbTip, FVector(0.65f, bLeft ? -0.55f : 0.55f, 0.20f));
}

bool ALinxiaMotorcyclePawn::SolveRiderTwoBoneIK(
	FName ChainName,
	FName UpperBone,
	FName LowerBone,
	FName EndBone,
	const FVector& TargetInVisualSpace,
	const FVector& BendHintInVisualSpace)
{
	if (!RiderMesh)
	{
		UE_LOG(LogTemp, Error,
			TEXT("[LinxiaMotorcycleIK] chain=%s error=-1.000 passed=0 reason=MissingRiderMesh"),
			*ChainName.ToString());
		return false;
	}

	const FTransform RiderToVisual = RiderMesh->GetRelativeTransform();
	const FVector Target = RiderToVisual.InverseTransformPosition(TargetInVisualSpace);
	const FVector BendHint = RiderToVisual.InverseTransformPosition(BendHintInVisualSpace);
	const FVector Root = RiderMesh->GetBoneLocationByName(
		UpperBone, EBoneSpaces::ComponentSpace);
	const FVector Joint = RiderMesh->GetBoneLocationByName(
		LowerBone, EBoneSpaces::ComponentSpace);
	const FVector End = RiderMesh->GetBoneLocationByName(
		EndBone, EBoneSpaces::ComponentSpace);
	const float UpperLength = FVector::Distance(Root, Joint);
	const float LowerLength = FVector::Distance(Joint, End);
	const FVector RootToTarget = Target - Root;
	const float RawDistance = RootToTarget.Size();
	if (UpperLength < 1.0f || LowerLength < 1.0f || RawDistance < 1.0f)
	{
		UE_LOG(LogTemp, Error,
			TEXT("[LinxiaMotorcycle] Invalid IK chain %s -> %s -> %s"),
			*UpperBone.ToString(), *LowerBone.ToString(), *EndBone.ToString());
		UE_LOG(LogTemp, Error,
			TEXT("[LinxiaMotorcycleIK] chain=%s error=-1.000 passed=0 reason=InvalidChain"),
			*ChainName.ToString());
		return false;
	}

	const FVector Direction = RootToTarget / RawDistance;
	const float Distance = FMath::Clamp(
		RawDistance,
		FMath::Abs(UpperLength - LowerLength) + 0.1f,
		UpperLength + LowerLength - 0.1f);
	const float Along = (
		UpperLength * UpperLength
		- LowerLength * LowerLength
		+ Distance * Distance) / (2.0f * Distance);
	const float Height = FMath::Sqrt(FMath::Max(
		0.0f, UpperLength * UpperLength - Along * Along));
	FVector BendDirection = BendHint - Root;
	BendDirection -= Direction * FVector::DotProduct(BendDirection, Direction);
	if (!BendDirection.Normalize())
	{
		BendDirection = FVector::UpVector;
	}
	const FVector DesiredJoint = Root + Direction * Along + BendDirection * Height;

	auto AimBoneAtChild = [this](FName Bone, FName ChildBone, const FVector& AimDirection)
	{
		const FTransform Current = RiderMesh->GetBoneTransformByName(
			Bone, EBoneSpaces::ComponentSpace);
		const FVector BoneLocation = RiderMesh->GetBoneLocationByName(
			Bone, EBoneSpaces::ComponentSpace);
		const FVector ChildLocation = RiderMesh->GetBoneLocationByName(
			ChildBone, EBoneSpaces::ComponentSpace);
		const FVector CurrentDirection = (ChildLocation - BoneLocation).GetSafeNormal();
		const FVector DesiredDirection = AimDirection.GetSafeNormal();
		if (CurrentDirection.IsNearlyZero() || DesiredDirection.IsNearlyZero())
		{
			return false;
		}
		const FQuat DeltaRotation = FQuat::FindBetweenNormals(
			CurrentDirection, DesiredDirection);
		const FQuat Rotation = DeltaRotation * Current.GetRotation();
		RiderMesh->SetBoneRotationByName(
			Bone, Rotation.Rotator(), EBoneSpaces::ComponentSpace);
		RiderMesh->RefreshBoneTransforms();
		return true;
	};

	if (!AimBoneAtChild(UpperBone, LowerBone, DesiredJoint - Root))
	{
		UE_LOG(LogTemp, Error,
			TEXT("[LinxiaMotorcycleIK] chain=%s error=-1.000 passed=0 reason=UpperAimFailed"),
			*ChainName.ToString());
		return false;
	}
	const FVector UpdatedJoint = RiderMesh->GetBoneLocationByName(
		LowerBone, EBoneSpaces::ComponentSpace);
	if (!AimBoneAtChild(LowerBone, EndBone, Target - UpdatedJoint))
	{
		UE_LOG(LogTemp, Error,
			TEXT("[LinxiaMotorcycleIK] chain=%s error=-1.000 passed=0 reason=LowerAimFailed"),
			*ChainName.ToString());
		return false;
	}

	const FVector SolvedEnd = RiderMesh->GetBoneLocationByName(
		EndBone, EBoneSpaces::ComponentSpace);
	const FVector SolvedEndVisual = RiderToVisual.TransformPosition(SolvedEnd);
	const float EndpointError = FVector::Distance(SolvedEndVisual, TargetInVisualSpace);
	const bool bPassed = FMath::IsFinite(EndpointError)
		&& EndpointError <= RiderContactToleranceCm;
	if (bLogIK) UE_LOG(LogTemp, Display,
		TEXT("[LinxiaMotorcycleIK] chain=%s target=%s solved=%s error=%.3f passed=%d"),
		*ChainName.ToString(),
		*TargetInVisualSpace.ToCompactString(),
		*SolvedEndVisual.ToCompactString(),
		EndpointError,
		bPassed ? 1 : 0);
	return bPassed;
}

void ALinxiaMotorcyclePawn::LogRiderContactPose()
{
	if (!RiderMesh)
	{
		return;
	}

	const FVector HandL = RiderMesh->GetBoneLocationByName(TEXT("bone_LeftHand"), EBoneSpaces::ComponentSpace);
	const FVector HandR = RiderMesh->GetBoneLocationByName(TEXT("bone_RightHand"), EBoneSpaces::ComponentSpace);
	const FVector FootL = RiderMesh->GetBoneLocationByName(TEXT("bone_LeftAnkle"), EBoneSpaces::ComponentSpace);
	const FVector FootR = RiderMesh->GetBoneLocationByName(TEXT("bone_RightAnkle"), EBoneSpaces::ComponentSpace);
	const FTransform RiderToVisual = RiderMesh->GetRelativeTransform();
	const FVector HandLVisual = RiderToVisual.TransformPosition(HandL);
	const FVector HandRVisual = RiderToVisual.TransformPosition(HandR);
	const FVector FootLVisual = RiderToVisual.TransformPosition(FootL);
	const FVector FootRVisual = RiderToVisual.TransformPosition(FootR);
	UE_LOG(LogTemp, Display, TEXT("[LinxiaMotorcycle] Rider contact pose handL=%s handR=%s footL=%s footR=%s"),
		*HandL.ToCompactString(),
		*HandR.ToCompactString(),
		*FootL.ToCompactString(),
		*FootR.ToCompactString());
	UE_LOG(LogTemp, Display, TEXT("[LinxiaMotorcycle] Rider contact visual handL=%s handR=%s footL=%s footR=%s handlebar=%s seat=%s"),
		*HandLVisual.ToCompactString(),
		*HandRVisual.ToCompactString(),
		*FootLVisual.ToCompactString(),
		*FootRVisual.ToCompactString(),
		Handlebar ? *Handlebar->GetRelativeLocation().ToCompactString() : TEXT("None"),
		Seat ? *Seat->GetRelativeLocation().ToCompactString() : TEXT("None"));
	UE_LOG(LogTemp, Display,
		TEXT("[LinxiaMotorcycle] Rider contact anchors gripL=%s gripR=%s footL=%s footR=%s handlebar=%s footpeg=%s"),
		*RiderLeftGripVisual.ToCompactString(),
		*RiderRightGripVisual.ToCompactString(),
		*RiderLeftFootVisual.ToCompactString(),
		*RiderRightFootVisual.ToCompactString(),
		Handlebar ? *Handlebar->GetRelativeLocation().ToCompactString() : TEXT("None"),
		FootPegBar ? *FootPegBar->GetRelativeLocation().ToCompactString() : TEXT("None"));
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
	else if (View == TEXT("hands") || View == TEXT("handsright"))
	{
		CameraYawOffset = View == TEXT("handsright") ? -125.0f : 125.0f;
		CameraPitch = -14.0f;
		CameraBoom->SetRelativeLocation(FVector(25.0f, 0.0f, 110.0f));
		CameraBoom->TargetArmLength = 230.0f;
		CameraBoom->SocketOffset = FVector::ZeroVector;
		FollowCamera->SetFieldOfView(36.0f);
	}
	else if (View == TEXT("bridge"))
	{
		CameraYawOffset = 58.0f;
		CameraPitch = -18.0f;
		CameraBoom->SetRelativeLocation(FVector(0.0f, 0.0f, -650.0f));
		CameraBoom->TargetArmLength = 4000.0f;
		CameraBoom->SocketOffset = FVector::ZeroVector;
		CameraBoom->bDoCollisionTest = false;
		FollowCamera->SetFieldOfView(58.0f);
	}
	else if (View == TEXT("establishing"))
	{
		CameraYawOffset = 58.0f;
		CameraPitch = -12.0f;
		CameraBoom->TargetArmLength = 1450.0f;
		CameraBoom->SocketOffset = FVector(0.0f, 0.0f, 180.0f);
		FollowCamera->SetFieldOfView(58.0f);
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
