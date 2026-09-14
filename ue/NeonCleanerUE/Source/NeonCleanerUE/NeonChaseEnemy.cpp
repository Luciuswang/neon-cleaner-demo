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
	Collision->InitBoxExtent(FVector(165.0f, 76.0f, 66.0f));
	Collision->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	Collision->SetCollisionObjectType(ECC_WorldDynamic);
	Collision->SetCollisionResponseToAllChannels(ECR_Block);
	Collision->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);
	Collision->SetCanEverAffectNavigation(false);
	Body = CreateDefaultSubobject<USceneComponent>(TEXT("VehicleBody"));
	Body->SetupAttachment(Collision);

	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cylinder(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Sphere(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	const auto Part = [this](const TCHAR* Name, UStaticMesh* Mesh, const FVector& Position,
		const FVector& Scale, const FRotator& Rotation = FRotator::ZeroRotator)
	{
		UStaticMeshComponent* MeshPart = CreateDefaultSubobject<UStaticMeshComponent>(Name);
		MeshPart->SetupAttachment(Body);
		MeshPart->SetStaticMesh(Mesh);
		MeshPart->SetRelativeLocation(Position);
		MeshPart->SetRelativeScale3D(Scale);
		MeshPart->SetRelativeRotation(Rotation);
		MeshPart->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		return MeshPart;
	};
	Part(TEXT("ArmoredChassis"), Cube.Object, FVector(0, 0, -6), FVector(3.2, 1.35, .45));
	Part(TEXT("SlopedNose"), Cube.Object, FVector(108, 0, 24), FVector(.85, 1.30, .40), FRotator(-18, 0, 0));
	Part(TEXT("Cabin"), Cube.Object, FVector(28, 0, 41), FVector(1.15, 1.15, .60));
	Part(TEXT("Windshield"), Cube.Object, FVector(86, 0, 45), FVector(.04, 1.02, .32), FRotator(-18, 0, 0));
	Part(TEXT("ArmoredCargo"), Cube.Object, FVector(-90, 0, 31), FVector(1.18, 1.27, .64));
	Part(TEXT("FrontBumper"), Cylinder.Object, FVector(162, 0, -9), FVector(.13, .13, 1.55), FRotator(0, 0, 90));
	Part(TEXT("RearBumper"), Cylinder.Object, FVector(-165, 0, -9), FVector(.13, .13, 1.55), FRotator(0, 0, 90));
	Part(TEXT("LeftArmorRail"), Cube.Object, FVector(-20, -71, 10), FVector(2.6, .10, .22));
	Part(TEXT("RightArmorRail"), Cube.Object, FVector(-20, 71, 10), FVector(2.6, .10, .22));
	Part(TEXT("RoofRailLeft"), Cylinder.Object, FVector(-85, -55, 70), FVector(.055, .055, 1.20), FRotator(90, 0, 0));
	Part(TEXT("RoofRailRight"), Cylinder.Object, FVector(-85, 55, 70), FVector(.055, .055, 1.20), FRotator(90, 0, 0));
	Part(TEXT("TurretBase"), Sphere.Object, FVector(-96, 0, 78), FVector(.48, .50, .28));
	Turret = Part(TEXT("RearFacingWeapon"), Cylinder.Object, FVector(-143, 0, 80), FVector(.075, .075, .85), FRotator(90, 0, 0));
	Part(TEXT("Antenna"), Cylinder.Object, FVector(-62, 49, 108), FVector(.02, .02, .80));
	Part(TEXT("HeadlampLeft"), Cube.Object, FVector(151, -44, 22), FVector(.045, .32, .10));
	Part(TEXT("HeadlampRight"), Cube.Object, FVector(151, 44, 22), FVector(.045, .32, .10));
	Part(TEXT("TailLampLeft"), Cube.Object, FVector(-151, -50, 20), FVector(.045, .22, .10));
	Part(TEXT("TailLampRight"), Cube.Object, FVector(-151, 50, 20), FVector(.045, .22, .10));
	for (int32 Index = 0; Index < 4; ++Index)
	{
		const FVector Position(Index < 2 ? 103.0f : -105.0f, Index % 2 ? 76.0f : -76.0f, -35.0f);
		const FString TireName = FString::Printf(TEXT("Tire%d"), Index);
		Wheels.Add(Part(*TireName, Cylinder.Object, Position, FVector(.65, .65, .23), FRotator(0, 0, 90)));
		const FString HubName = FString::Printf(TEXT("Hub%d"), Index);
		Part(*HubName, Cylinder.Object, Position + FVector(0, Index % 2 ? 13 : -13, 0), FVector(.28, .28, .025), FRotator(0, 0, 90));
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
	UMaterialInterface* ArmorMaterial = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_BattleGraphite.M_NC_BattleGraphite"));
	UMaterialInterface* Black = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_TacticalBlack.M_NC_TacticalBlack"));
	UMaterialInterface* Rubber = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_RubberBlack.M_NC_RubberBlack"));
	UMaterialInterface* Amber = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/LinxiaChase/Materials/M_NC_ChaseTargetAmber.M_NC_ChaseTargetAmber"));
	UMaterialInterface* Cyan = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/LinxiaRiderProxy/Materials/M_NC_CyanDiagnostic.M_NC_CyanDiagnostic"));
	TInlineComponentArray<UStaticMeshComponent*> Meshes(this);
	for (UStaticMeshComponent* Mesh : Meshes)
	{
		const FString Name = Mesh->GetName();
		UMaterialInterface* Material = ArmorMaterial;
		if (Name.Contains(TEXT("Tire"))) Material = Rubber;
		else if (Name.Contains(TEXT("Windshield")) || Name.Contains(TEXT("Cargo"))) Material = Black;
		else if (Name.Contains(TEXT("TailLamp")) || Mesh == Beam) Material = Amber;
		else if (Name.Contains(TEXT("Headlamp"))) Material = Cyan;
		if (Material) Mesh->SetMaterial(0, Material);
	}
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
		Body->SetRelativeScale3D(FVector(1.32f, 1.30f, 1.10f));
		Body->SetRelativeLocation(FVector(0, 0, 7));
		Collision->SetBoxExtent(FVector(218, 106, 75));
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
	WheelAngle = FMath::Fmod(WheelAngle + Travel / (2.0f * PI * 32.5f) * 360.0f, 360.0f);
	for (UStaticMeshComponent* Wheel : Wheels) Wheel->SetRelativeRotation(FRotator(WheelAngle, 0, 90));

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
