#include "NeonChaseEnemy.h"

#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "LinxiaMotorcycleChaseGameMode.h"
#include "LinxiaMotorcyclePawn.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

ANeonChaseEnemy::ANeonChaseEnemy()
{
	PrimaryActorTick.bCanEverTick = false;
	Collision = CreateDefaultSubobject<UBoxComponent>(TEXT("VehicleCollision"));
	SetRootComponent(Collision);
	Collision->InitBoxExtent(FVector(240.0f, 108.0f, 64.0f));
	Collision->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	Collision->SetCollisionObjectType(ECC_WorldDynamic);
	Collision->SetCollisionResponseToAllChannels(ECR_Block);
	Collision->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);
	Collision->SetCanEverAffectNavigation(false);
	Body = CreateDefaultSubobject<USceneComponent>(TEXT("VehicleBody"));
	Body->SetupAttachment(Collision);

	// Authored automotive body and centered wheel meshes, measured in centimetres.
	// Enemy actor origin is Z=70; imported geometry has its ground at Z=0.
	Body->SetRelativeLocation(FVector(0, 0, -70));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cylinder(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CarBody(TEXT("/Game/LinxiaChase/CinematicCar/SM_CC_Body.SM_CC_Body"));
	UStaticMeshComponent* Exterior = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PursuitExterior"));
	Exterior->SetupAttachment(Body);
	Exterior->SetStaticMesh(CarBody.Object);
	Exterior->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	const TCHAR* WheelNames[] = {TEXT("WheelFrontL"), TEXT("WheelFrontR"), TEXT("WheelRearL"), TEXT("WheelRearR")};
	const FVector Pivots[] = {FVector(137.391f,-84.436f,42.301f), FVector(137.202f,84.495f,42.301f),
		FVector(-171.023f,-85.043f,42.301f), FVector(-171.023f,84.930f,42.301f)};
	for (int32 Index=0; Index<4; ++Index)
	{
		const FString Path = FString::Printf(TEXT("/Game/LinxiaChase/CinematicCar/SM_CC_%s.SM_CC_%s"), WheelNames[Index], WheelNames[Index]);
		UStaticMeshComponent* Wheel = CreateDefaultSubobject<UStaticMeshComponent>(WheelNames[Index]);
		Wheel->SetupAttachment(Body);
		Wheel->SetStaticMesh(LoadObject<UStaticMesh>(nullptr, *Path));
		Wheel->SetRelativeLocation(Pivots[Index]);
		Wheel->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		Wheels.Add(Wheel);
	}
	Beam = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("AttackTelegraph"));
	Beam->SetupAttachment(Collision);
	Beam->SetStaticMesh(Cylinder.Object);
	Beam->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Beam->SetCastShadow(false);
	Beam->SetVisibility(false);
}

void ANeonChaseEnemy::BeginPlay()
{
	Super::BeginPlay();
	// Keep authored car-paint, glass, rubber and interior material slots.
	UMaterialInterface* Amber = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/LinxiaChase/Materials/M_NC_ChaseTargetAmber.M_NC_ChaseTargetAmber"));
	if (Amber) Beam->SetMaterial(0, Amber);
	UE_LOG(LogTemp, Display, TEXT("[NeonVehicle] source=CarConcept dimensionsCm=480,220,126.56 wheelRadiusCm=42.3 visualQA=UNVERIFIED"));
	for (TActorIterator<AActor> It(GetWorld()); It; ++It)
	{
		if (*It != this && !It->ActorHasTag(TEXT("NeonChaseObstacle")) && !Cast<ANeonChaseEnemy>(*It)
			&& !Cast<ALinxiaMotorcyclePawn>(*It))
		{
			Collision->IgnoreActorWhenMoving(*It, true);
		}
	}
}

void ANeonChaseEnemy::InitializeVehicle(bool bPrimary, int32 Index)
{
	Tags.AddUnique(TEXT("NeonChaseEnemy"));
	bConvoy = bPrimary;
	MaxArmor = bConvoy ? 360.0f : 84.0f;
	Armor = MaxArmor;
	Speed = bConvoy ? 900.0f : 1080.0f + (Index % 2) * 45.0f;
	AttackCooldown = 1.5f + (Index % 3) * .65f;
	if (bConvoy)
	{
		Body->SetRelativeScale3D(FVector(1.05f));
		Body->SetRelativeLocation(FVector(0, 0, -70));
		Collision->SetBoxExtent(FVector(252, 114, 67));
		Tags.Add(TEXT("NeonChaseConvoy"));
	}
}

void ANeonChaseEnemy::StepCombat(float DeltaSeconds, ALinxiaMotorcyclePawn* Player)
{
	ALinxiaMotorcycleChaseGameMode* Mode = GetWorld()->GetAuthGameMode<ALinxiaMotorcycleChaseGameMode>();
	if (!Mode || !Mode->IsPlaying() || !Player) return;
	ShotFlashTime = FMath::Max(0.0f, ShotFlashTime - DeltaSeconds);
	HitFlashTime = FMath::Max(0.0f, HitFlashTime - DeltaSeconds);
	Body->SetRelativeRotation(FRotator(0, 0, HitFlashTime > 0 ? FMath::Sin(HitFlashTime * 65.0f) * 2.0f : 0));
	if (IsDisabled())
	{
		Beam->SetVisibility(false);
		return;
	}
	FHitResult MoveHit;
	const float Travel = FMath::Min(Speed * DeltaSeconds, FMath::Max(0.0f, 99000.0f - static_cast<float>(GetActorLocation().X)));
	AddActorWorldOffset(FVector(Travel, 0, 0), true, &MoveHit);
	if (MoveHit.GetActor() == Player) Player->ReceiveChaseDamage(16.0f, TEXT("VehicleImpact"));
	WheelAngle = FMath::Fmod(WheelAngle + Travel / (2.0f * PI * 42.3f * (bConvoy ? 1.05f : 1.0f)) * 360.0f, 360.0f);
	for (UStaticMeshComponent* Wheel : Wheels) Wheel->SetRelativeRotation(FRotator(-WheelAngle, 0, 0));

	const float Gap = GetActorLocation().X - Player->GetActorLocation().X;
	DistanceToPlayer = Gap;
	AttackCooldown = FMath::Max(0.0f, AttackCooldown - DeltaSeconds);
	if (ChargeTime <= 0.0f && AttackCooldown <= 0.0f && Gap > 480.0f && Gap < 3450.0f)
	{
		LockedLane = Player->GetActorLocation().Y;
		ChargeTime = 1.25f;
		UE_LOG(LogTemp, Display, TEXT("[NeonChase] AttackLock vehicle=%s lane=%.1f warning=1.25"), *GetName(), LockedLane);
	}
	if (ChargeTime > 0.0f)
	{
		ChargeTime = FMath::Max(0.0f, ChargeTime - DeltaSeconds);
		const FVector Start(GetActorLocation().X - (bConvoy ? 230.0f : 180.0f), LockedLane, 68.0f);
		const FVector End = Start - FVector(3600, 0, 0);
		UpdateBeam(Start, End, 2.5f + 2.5f * (1.0f - GetChargeFraction()));
		if (ChargeTime <= 0.0f)
		{
			FHitResult Hit;
			if (GetWorld()->SweepSingleByChannel(Hit, Start, End, FQuat::Identity, ECC_Visibility,
				FCollisionShape::MakeSphere(24.0f), Mode->MakeCombatQuery(this)) && Hit.GetActor() == Player)
			{
				Player->ReceiveChaseDamage(bConvoy ? 24.0f : 18.0f, TEXT("EnemyWeapon"));
			}
			ShotFlashTime = .12f;
			UpdateBeam(Start, Hit.bBlockingHit ? Hit.ImpactPoint : End, 9.0f);
			AttackCooldown = bConvoy ? 3.4f : 4.0f;
		}
	}
	else if (ShotFlashTime <= 0.0f) Beam->SetVisibility(false);
}

void ANeonChaseEnemy::ReceiveWeaponHit(float Damage)
{
	ALinxiaMotorcycleChaseGameMode* Mode = GetWorld()->GetAuthGameMode<ALinxiaMotorcycleChaseGameMode>();
	if (!Mode || !Mode->IsPlaying() || IsDisabled()) return;
	Armor = FMath::Max(0.0f, Armor - Damage);
	HitFlashTime = .16f;
	if (IsDisabled())
	{
		ClearCombatEffects();
		Collision->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);
		Body->SetRelativeRotation(FRotator(-3, 0, 4));
		Mode->NotifyEnemyDisabled(this);
	}
}

void ANeonChaseEnemy::UpdateBeam(const FVector& From, const FVector& To, float Width)
{
	const FVector Delta = To - From;
	Beam->SetWorldLocation((From + To) * .5f);
	Beam->SetWorldRotation(FRotationMatrix::MakeFromZ(Delta).Rotator());
	Beam->SetWorldScale3D(FVector(Width / 100.0f, Width / 100.0f, Delta.Size() / 100.0f));
	Beam->SetVisibility(true);
}

void ANeonChaseEnemy::ClearCombatEffects()
{
	Beam->SetVisibility(false);
	ChargeTime = 0;
	ShotFlashTime = 0;
}
