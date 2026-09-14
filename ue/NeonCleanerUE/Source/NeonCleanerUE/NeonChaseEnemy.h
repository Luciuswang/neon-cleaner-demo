#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "NeonChaseEnemy.generated.h"

class UBoxComponent;
class USceneComponent;
class UStaticMeshComponent;
class ALinxiaMotorcyclePawn;

UCLASS()
class NEONCLEANERUE_API ANeonChaseEnemy : public AActor
{
	GENERATED_BODY()

public:
	ANeonChaseEnemy();
	void InitializeVehicle(bool bPrimary, int32 Index);
	void StepCombat(float DeltaSeconds, ALinxiaMotorcyclePawn* Player);
	void ReceiveWeaponHit(float Damage);
	float GetArmorFraction() const { return Armor / MaxArmor; }
	bool IsDisabled() const { return Armor <= 0.0f; }
	bool IsConvoy() const { return bConvoy; }
	bool IsCharging() const { return ChargeTime > 0.0f; }
	float GetLockedLane() const { return LockedLane; }
	float GetChargeFraction() const { return FMath::Clamp(ChargeTime / 1.25f, 0.0f, 1.0f); }
	float GetHalfWidth() const { return bConvoy ? 106.0f : 76.0f; }
	float GetDistanceToPlayer() const { return DistanceToPlayer; }
	void ClearCombatEffects();

protected:
	virtual void BeginPlay() override;

private:
	void UpdateBeam(const FVector& From, const FVector& To, float Width);
	UPROPERTY()
	TObjectPtr<UBoxComponent> Collision;
	UPROPERTY()
	TObjectPtr<USceneComponent> Body;
	UPROPERTY()
	TObjectPtr<UStaticMeshComponent> Beam;
	UPROPERTY()
	TObjectPtr<UStaticMeshComponent> Turret;
	UPROPERTY()
	TArray<TObjectPtr<UStaticMeshComponent>> Wheels;
	float Armor = 84.0f;
	float MaxArmor = 84.0f;
	float Speed = 1080.0f;
	float AttackCooldown = 2.0f;
	float ChargeTime = 0.0f;
	float LockedLane = 0.0f;
	float ShotFlashTime = 0.0f;
	float HitFlashTime = 0.0f;
	float WheelAngle = 0.0f;
	float DistanceToPlayer = 0.0f;
	bool bConvoy = false;
};
