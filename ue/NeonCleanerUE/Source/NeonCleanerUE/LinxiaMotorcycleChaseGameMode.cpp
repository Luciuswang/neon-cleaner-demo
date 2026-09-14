#include "LinxiaMotorcycleChaseGameMode.h"

#include "LinxiaMotorcycleHud.h"
#include "LinxiaMotorcyclePawn.h"
#include "NeonChaseEnemy.h"
#include "NeonCinematicBridgeSubsystem.h"
#include "Components/PrimitiveComponent.h"
#include "Engine/GameInstance.h"
#include "Engine/GameViewportClient.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"
#include "HAL/FileManager.h"
#include "HAL/PlatformTime.h"
#include "InputCoreTypes.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "UnrealClient.h"

namespace
{
constexpr float SimulationStep = 1.0f / 60.0f;
constexpr float RouteStartX = -2000.0f;
constexpr float FinishX = 100000.0f;
constexpr float ZoneX[] = {18000.0f, 45000.0f, 75000.0f};
const TCHAR* PhaseName(ENeonChasePhase Phase)
{
	switch (Phase)
	{
	case ENeonChasePhase::Preparing: return TEXT("Preparing");
	case ENeonChasePhase::Intro: return TEXT("Intro");
	case ENeonChasePhase::Playing: return TEXT("Playing");
	case ENeonChasePhase::Outro: return TEXT("Outro");
	default: return TEXT("Results");
	}
}
const TCHAR* OutcomeName(ENeonChaseOutcome Outcome)
{
	switch (Outcome)
	{
	case ENeonChaseOutcome::Clean: return TEXT("Clean");
	case ENeonChaseOutcome::Damaged: return TEXT("Damaged");
	case ENeonChaseOutcome::Lost: return TEXT("Lost");
	default: return TEXT("None");
	}
}
}

ALinxiaMotorcycleChaseGameMode::ALinxiaMotorcycleChaseGameMode()
{
	DefaultPawnClass = ALinxiaMotorcyclePawn::StaticClass();
	HUDClass = ALinxiaMotorcycleHud::StaticClass();
	PrimaryActorTick.bCanEverTick = true;
}

void ALinxiaMotorcycleChaseGameMode::BeginPlay()
{
	Super::BeginPlay();
	FString Capture;
	bLegacyTest = FParse::Param(FCommandLine::Get(), TEXT("LinxiaMotorcycleSmokeTest"))
		|| FParse::Value(FCommandLine::Get(), TEXT("LinxiaMotorcycleCapture="), Capture);
	FString RecordFilm;
	bFilmRecording = FParse::Value(FCommandLine::Get(), TEXT("NeonRecordFilm="), RecordFilm);
	FParse::Value(FCommandLine::Get(), TEXT("NeonChaseSmoke="), SmokeScenario);
	FParse::Value(FCommandLine::Get(), TEXT("NeonChaseProofCapture="), ProofCaptureOutputPath);
	if (!ProofCaptureOutputPath.IsEmpty())
	{
		ProofCaptureOutputPath = FPaths::ConvertRelativePathToFull(ProofCaptureOutputPath);
		UE_LOG(LogTemp, Display, TEXT("[NeonChaseProof] Armed output=%s"), *ProofCaptureOutputPath);
	}
	if (!SmokeScenario.IsEmpty())
	{
		SmokeStartedAt = FPlatformTime::Seconds();
		SmokeSpeed = 8.0f;
		FParse::Value(FCommandLine::Get(), TEXT("NeonChaseSmokeSpeed="), SmokeSpeed);
		SmokeSpeed = FMath::Clamp(SmokeSpeed, 1.0f, 12.0f);
		if ((!SmokeScenario.Equals(TEXT("Clean"), ESearchCase::IgnoreCase)
			&& !SmokeScenario.Equals(TEXT("Damaged"), ESearchCase::IgnoreCase)
			&& !SmokeScenario.Equals(TEXT("Lost"), ESearchCase::IgnoreCase)) || bLegacyTest || bFilmRecording)
		{
			UE_LOG(LogTemp, Error, TEXT("[NeonChaseSmoke] FAIL reason=InvalidOrConflictingFlags scenario=%s"), *SmokeScenario);
			bSmokeCompleted = true;
			FPlatformMisc::RequestExitWithStatus(false, 1);
			return;
		}
		UE_LOG(LogTemp, Display, TEXT("[NeonChaseSmoke] START scenario=%s speed=%.1f fixedStep=0.016667"), *SmokeScenario, SmokeSpeed);
	}
	if (UGameInstance* Instance = GetGameInstance())
	{
		Bridge = Instance->GetSubsystem<UNeonCinematicBridgeSubsystem>();
		if (Bridge) FilmFinishedHandle = Bridge->OnFilmFinished.AddUObject(this, &ALinxiaMotorcycleChaseGameMode::HandleFilmFinished);
	}
	UE_LOG(LogTemp, Display, TEXT("[NeonChase] Phase=Preparing recording=%d legacy=%d"), bFilmRecording, bLegacyTest);
}

void ALinxiaMotorcycleChaseGameMode::EndPlay(const EEndPlayReason::Type Reason)
{
	PendingFilmId = 0;
	++FilmSerial;
	if (Bridge)
	{
		Bridge->OnFilmFinished.Remove(FilmFinishedHandle);
		Bridge->CancelFilm();
	}
	Super::EndPlay(Reason);
}

void ALinxiaMotorcycleChaseGameMode::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (bFilmRecording) return;
	if (bProofCaptureRequested)
	{
		if (FPlatformTime::Seconds() - ProofCaptureRequestedAt > 2.0)
		{
			UE_LOG(LogTemp, Display, TEXT("[NeonChaseProof] Completed output=%s"), *ProofCaptureOutputPath);
			FPlatformMisc::RequestExit(false);
		}
		return;
	}
	if (bSmokeCompleted) return;
	if (!SmokeScenario.IsEmpty() && FPlatformTime::Seconds() - SmokeStartedAt > 180.0)
	{
		CompleteSmoke(true);
		return;
	}
	APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0);
	if (PC && SmokeScenario.IsEmpty() && !bLegacyTest)
	{
		const bool RestartDown = PC->IsInputKeyDown(EKeys::R);
		const bool PauseDown = PC->IsInputKeyDown(EKeys::Escape);
		const bool ClickDown = PC->IsInputKeyDown(EKeys::LeftMouseButton);
		const bool EnterDown = PC->IsInputKeyDown(EKeys::Enter);
		const bool RestartPressed = RestartDown && !bRestartDown;
		const bool PausePressed = PauseDown && !bPauseDown;
		const bool ClickPressed = ClickDown && !bClickDown;
		const bool EnterPressed = EnterDown && !bEnterDown;
		bRestartDown = RestartDown;
		bPauseDown = PauseDown;
		bClickDown = ClickDown;
		bEnterDown = EnterDown;
		if (RestartPressed) { RestartEncounter(); return; }
		if (PausePressed) ToggleEncounterPause();
		if (EnterPressed && (bEncounterPaused || Phase == ENeonChasePhase::Results))
		{
			if (bEncounterPaused) ToggleEncounterPause();
			else RestartEncounter();
			return;
		}
		if (ClickPressed && (bEncounterPaused || Phase == ENeonChasePhase::Results))
		{
			float X = 0, Y = 0;
			int32 Width = 0, Height = 0;
			PC->GetViewportSize(Width, Height);
			if (PC->GetMousePosition(X, Y)) ActivateMenuAt(X, Y, Width, Height);
		}
	}
	if (Phase == ENeonChasePhase::Preparing)
	{
		PreparingTime += DeltaSeconds;
		TryPrepareEncounter();
		if (PreparingTime > 12.0f && Phase == ENeonChasePhase::Preparing)
		{
			UE_LOG(LogTemp, Error, TEXT("[NeonChase] SetupFailed reason=RiderNotReady"));
			if (!SmokeScenario.IsEmpty())
			{
				CompleteSmoke(false);
			}
			else
			{
				FinishEncounter(ENeonChaseOutcome::Lost);
			}
		}
		return;
	}
	if (Phase == ENeonChasePhase::Intro || Phase == ENeonChasePhase::Outro)
	{
		FilmWaitTime += DeltaSeconds;
		if (FilmWaitTime > 40.0f)
		{
			const uint32 ExpiredId = PendingFilmId;
			PendingFilmId = 0;
			if (Bridge) Bridge->CancelFilm();
			PendingFilmId = ExpiredId;
			HandleFilmFinished(ExpiredId, TEXT("GameModeWatchdog"));
		}
		return;
	}
	if (Phase == ENeonChasePhase::Results)
	{
		if (!SmokeScenario.IsEmpty()) CompleteSmoke(false);
		return;
	}
	if (!IsPlaying()) return;
	if (bLegacyTest) return;
	if (PC && SmokeScenario.IsEmpty() && !bLegacyTest && GetWorld()->GetGameViewport()
		&& GetWorld()->GetGameViewport()->Viewport && !GetWorld()->GetGameViewport()->Viewport->HasFocus())
	{
		ToggleEncounterPause();
		return;
	}
	// Acceleration changes the number of identical physics steps, never damage or outcome rules.
	SimulationAccumulator += FMath::Min(DeltaSeconds, .1f) * SmokeSpeed;
	int32 Steps = 0;
	while (SimulationAccumulator >= SimulationStep && IsPlaying() && ++Steps <= 120)
	{
		SimulationAccumulator -= SimulationStep;
		StepEncounter(SimulationStep);
	}
}

void ALinxiaMotorcycleChaseGameMode::TryPrepareEncounter()
{
	APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0);
	if (!PC) return;
	if (!IsValid(Rider))
	{
		Rider = Cast<ALinxiaMotorcyclePawn>(PC->GetPawn());
		if (!Rider)
		{
			for (TActorIterator<ALinxiaMotorcyclePawn> It(GetWorld()); It; ++It) { Rider = *It; break; }
		}
	}
	if (!Rider || !Rider->IsGameplayReady()) return;
	Rider->PrepareForEncounter();
	DecorativeActors.Reset();
	for (TActorIterator<AActor> It(GetWorld()); It; ++It)
	{
		AActor* Actor = *It;
		if (Actor == Rider || Cast<ANeonChaseEnemy>(Actor)) continue;
		if (Actor->ActorHasTag(TEXT("NeonChaseObstacle")))
		{
			TInlineComponentArray<UPrimitiveComponent*> Components(Actor);
			for (UPrimitiveComponent* Component : Components)
			{
				Component->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
				Component->SetCollisionResponseToChannel(ECC_Pawn, ECR_Block);
				Component->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
			}
		}
		else DecorativeActors.Add(Actor);
		if (!Actor->ActorHasTag(TEXT("NeonChaseObstacle")))
		{
			TInlineComponentArray<UPrimitiveComponent*> Components(Actor);
			for (UPrimitiveComponent* Component : Components)
			{
				Component->SetCollisionResponseToChannel(ECC_Pawn, ECR_Ignore);
			}
		}
		if (!bLegacyTest && Actor->ActorHasTag(TEXT("Gate3ChaseTarget")))
		{
			Actor->SetActorHiddenInGame(true);
			Actor->SetActorEnableCollision(false);
		}
	}
	if (!bLegacyTest)
	{
		Convoy = SpawnEnemy(FVector(30000, 0, 70), true, 0);
		if (!Convoy)
		{
			UE_LOG(LogTemp, Error, TEXT("[NeonChase] SetupFailed reason=ConvoySpawn"));
			FinishEncounter(ENeonChaseOutcome::Lost);
			return;
		}
		Rider->SetChaseTarget(Convoy);
	}
	SetPhase(ENeonChasePhase::Intro);
	RequestFilm(ENeonChaseFilm::Intro);
}

void ALinxiaMotorcycleChaseGameMode::SetPhase(ENeonChasePhase NewPhase)
{
	Phase = NewPhase;
	SimulationAccumulator = 0;
	FilmWaitTime = 0;
	if (Rider && Phase != ENeonChasePhase::Playing) Rider->FreezeGameplay();
	UE_LOG(LogTemp, Display, TEXT("[NeonChase] Phase=%s outcome=%s request=%u"), PhaseName(Phase), OutcomeName(Outcome), PendingFilmId);
}

void ALinxiaMotorcycleChaseGameMode::RequestFilm(ENeonChaseFilm Film)
{
	PendingFilmId = ++FilmSerial;
	if (PendingFilmId == 0) PendingFilmId = ++FilmSerial;
	FString FilmTestMode;
	const bool bMediaTest = FParse::Value(FCommandLine::Get(), TEXT("NeonFilmTest="), FilmTestMode)
		&& !FilmTestMode.IsEmpty();
	if (bLegacyTest || (!SmokeScenario.IsEmpty() && !bMediaTest)
		|| FParse::Param(FCommandLine::Get(), TEXT("NeonSkipFilms")))
	{
		HandleFilmFinished(PendingFilmId, TEXT("ExplicitBypass"));
		return;
	}
	if (Bridge) Bridge->PlayFilm(UGameplayStatics::GetPlayerController(this, 0), Film, PendingFilmId);
	else HandleFilmFinished(PendingFilmId, TEXT("MissingBridge"));
}

void ALinxiaMotorcycleChaseGameMode::HandleFilmFinished(uint32 RequestId, FName Reason)
{
	if (RequestId == 0 || RequestId != PendingFilmId
		|| (Phase != ENeonChasePhase::Intro && Phase != ENeonChasePhase::Outro))
	{
		UE_LOG(LogTemp, Display, TEXT("[NeonChase] FilmIgnored request=%u pending=%u"), RequestId, PendingFilmId);
		return;
	}
	PendingFilmId = 0;
	UE_LOG(LogTemp, Display, TEXT("[NeonChase] FilmFinished request=%u reason=%s"), RequestId, *Reason.ToString());
	if (Phase == ENeonChasePhase::Intro) StartPlaying();
	else
	{
		SetPhase(ENeonChasePhase::Results);
		ConfigureController(true);
	}
}

void ALinxiaMotorcycleChaseGameMode::ConfigureController(bool bMenu)
{
	if (APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0))
	{
		PC->ResetIgnoreMoveInput();
		PC->ResetIgnoreLookInput();
		PC->SetShowMouseCursor(bMenu);
		if (bMenu)
		{
			FInputModeGameAndUI Input;
			Input.SetHideCursorDuringCapture(false);
			PC->SetInputMode(Input);
		}
		else PC->SetInputMode(FInputModeGameOnly());
	}
}

void ALinxiaMotorcycleChaseGameMode::StartPlaying()
{
	if (!IsValid(Rider)) { FinishEncounter(ENeonChaseOutcome::Lost); return; }
	if (APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0))
	{
		if (PC->GetPawn() != Rider) PC->Possess(Rider);
		PC->SetViewTarget(Rider);
	}
	ConfigureController(false);
	SetPhase(ENeonChasePhase::Playing);
}

void ALinxiaMotorcycleChaseGameMode::RestartEncounter()
{
	if (bFilmRecording) return;
	PendingFilmId = 0;
	++FilmSerial;
	SetPhase(ENeonChasePhase::Preparing);
	if (Bridge) Bridge->CancelFilm();
	for (ANeonChaseEnemy* Enemy : Enemies) if (IsValid(Enemy)) Enemy->Destroy();
	Enemies.Reset();
	Convoy = nullptr;
	if (Rider) Rider->ResetEncounter();
	Outcome = ENeonChaseOutcome::None;
	bConvoyDisabled = false;
	bEncounterPaused = false;
	EncounterTime = 0;
	PreparingTime = 0;
	NextZone = Kills = ShotsFired = ShotsHit = 0;
	SmokeDesiredLane = 0;
	ConfigureController(false);
	UE_LOG(LogTemp, Display, TEXT("[NeonChase] Restart generation=%u"), FilmSerial);
}

void ALinxiaMotorcycleChaseGameMode::ToggleEncounterPause()
{
	if (Phase != ENeonChasePhase::Playing || bLegacyTest || !SmokeScenario.IsEmpty()) return;
	bEncounterPaused = !bEncounterPaused;
	SimulationAccumulator = 0;
	if (bEncounterPaused && Rider) Rider->FreezeGameplay();
	ConfigureController(bEncounterPaused);
	UE_LOG(LogTemp, Display, TEXT("[NeonChase] Paused=%d time=%.3f"), bEncounterPaused, EncounterTime);
}

void ALinxiaMotorcycleChaseGameMode::ActivateMenuAt(float X, float Y, float Width, float Height)
{
	const float ButtonWidth = FMath::Min(280.0f, Width - 48.0f);
	const float Left = (Width - ButtonWidth) * .5f;
	const float Top = Height * .5f + 60.0f;
	if (X < Left || X > Left + ButtonWidth) return;
	if (Y >= Top && Y <= Top + 44.0f)
	{
		if (bEncounterPaused) ToggleEncounterPause();
		else if (Phase == ENeonChasePhase::Results) RestartEncounter();
	}
	else if (bEncounterPaused && Y >= Top + 54.0f && Y <= Top + 98.0f) RestartEncounter();
}

ANeonChaseEnemy* ALinxiaMotorcycleChaseGameMode::SpawnEnemy(const FVector& Position, bool bPrimary, int32 Index)
{
	int32 Active = 0;
	for (ANeonChaseEnemy* Enemy : Enemies) if (IsValid(Enemy) && !Enemy->IsDisabled()) ++Active;
	if (Active >= 6) return nullptr;
	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	ANeonChaseEnemy* Enemy = GetWorld()->SpawnActor<ANeonChaseEnemy>(Position, FRotator::ZeroRotator, Params);
	if (Enemy)
	{
		Enemy->InitializeVehicle(bPrimary, Index);
		Enemies.Add(Enemy);
	}
	return Enemy;
}

void ALinxiaMotorcycleChaseGameMode::SpawnZone(int32 Zone)
{
	const float X = Rider->GetActorLocation().X;
	SpawnEnemy(FVector(X + 2400, Zone % 2 ? 280 : -280, 70), false, Zone * 2);
	SpawnEnemy(FVector(X + 3300, Zone % 2 ? -280 : 280, 70), false, Zone * 2 + 1);
	UE_LOG(LogTemp, Display, TEXT("[NeonChase] Zone=%d x=%.1f"), Zone + 1, X);
}

void ALinxiaMotorcycleChaseGameMode::StepEncounter(float DeltaSeconds)
{
	if (!Rider) { FinishEncounter(ENeonChaseOutcome::Lost); return; }
	float Forward = 0, Steer = 0;
	bool bFire = false, bBoost = false;
	if (!SmokeScenario.IsEmpty()) BuildSmokeInput(Forward, Steer, bFire, bBoost);
	Rider->StepGameplay(DeltaSeconds, !SmokeScenario.IsEmpty(), Forward, Steer, bFire, bBoost);
	if (bLegacyTest) return;
	EncounterTime += DeltaSeconds;
	while (NextZone < UE_ARRAY_COUNT(ZoneX) && Rider->GetActorLocation().X >= ZoneX[NextZone]) SpawnZone(NextZone++);
	for (ANeonChaseEnemy* Enemy : Enemies) if (IsValid(Enemy)) Enemy->StepCombat(DeltaSeconds, Rider);
	for (int32 Index = Enemies.Num() - 1; Index >= 0; --Index)
	{
		ANeonChaseEnemy* Enemy = Enemies[Index];
		if (!IsValid(Enemy) || (!Enemy->IsConvoy() && Enemy->GetActorLocation().X < Rider->GetActorLocation().X - 3500))
		{
			if (IsValid(Enemy)) Enemy->Destroy();
			Enemies.RemoveAt(Index);
		}
	}
	TryCaptureGameplayProof();
	if (Rider->GetHealth() <= 0 || EncounterTime >= 95.0f) FinishEncounter(ENeonChaseOutcome::Lost);
	else if (Rider->GetActorLocation().X >= FinishX)
	{
		FinishEncounter(!bConvoyDisabled ? ENeonChaseOutcome::Lost
			: Rider->GetHealth() >= 99.99f ? ENeonChaseOutcome::Clean : ENeonChaseOutcome::Damaged);
	}
}

void ALinxiaMotorcycleChaseGameMode::TryCaptureGameplayProof()
{
	if (ProofCaptureOutputPath.IsEmpty() || bProofCaptureRequested || !Rider
		|| NextZone < 1 || EncounterTime < 14.0f)
	{
		return;
	}
	bool bCombatVisible = false;
	for (ANeonChaseEnemy* Enemy : Enemies)
	{
		if (!IsValid(Enemy) || Enemy->IsDisabled())
		{
			continue;
		}
		const float Gap = Enemy->GetActorLocation().X - Rider->GetActorLocation().X;
		if (Gap >= 450.0f && Gap <= 3400.0f
			&& (Enemy->IsCharging() || ShotsFired > 0))
		{
			bCombatVisible = true;
			break;
		}
	}
	if (!bCombatVisible && EncounterTime < 24.0f)
	{
		return;
	}
	IFileManager::Get().MakeDirectory(*FPaths::GetPath(ProofCaptureOutputPath), true);
	FScreenshotRequest::RequestScreenshot(ProofCaptureOutputPath, true, false);
	bProofCaptureRequested = true;
	ProofCaptureRequestedAt = FPlatformTime::Seconds();
	UE_LOG(LogTemp, Display,
		TEXT("[NeonChaseProof] Requested time=%.3f zone=%d shots=%d hits=%d enemies=%d output=%s"),
		EncounterTime, NextZone, ShotsFired, ShotsHit, Enemies.Num(), *ProofCaptureOutputPath);
}

void ALinxiaMotorcycleChaseGameMode::FinishEncounter(ENeonChaseOutcome Result)
{
	if (Phase == ENeonChasePhase::Outro || Phase == ENeonChasePhase::Results) return;
	Outcome = Result;
	bEncounterPaused = false;
	for (ANeonChaseEnemy* Enemy : Enemies) if (IsValid(Enemy)) Enemy->ClearCombatEffects();
	UE_LOG(LogTemp, Display, TEXT("[NeonChase] Outcome=%s health=%.1f time=%.3f convoy=%d kills=%d"),
		OutcomeName(Outcome), Rider ? Rider->GetHealth() : 0, EncounterTime, bConvoyDisabled, Kills);
	SetPhase(ENeonChasePhase::Outro);
	const ENeonChaseFilm Film = Result == ENeonChaseOutcome::Clean ? ENeonChaseFilm::Clean
		: Result == ENeonChaseOutcome::Damaged ? ENeonChaseFilm::Damaged : ENeonChaseFilm::Lost;
	RequestFilm(Film);
}

FCollisionQueryParams ALinxiaMotorcycleChaseGameMode::MakeCombatQuery(const AActor* Ignore) const
{
	FCollisionQueryParams Query(SCENE_QUERY_STAT(NeonChaseCombat), false, Ignore);
	for (const TWeakObjectPtr<AActor>& Actor : DecorativeActors) if (Actor.IsValid()) Query.AddIgnoredActor(Actor.Get());
	return Query;
}

void ALinxiaMotorcycleChaseGameMode::FirePlayerWeapon()
{
	if (!IsPlaying() || !Rider) return;
	++ShotsFired;
	const FVector Start = Rider->GetActorLocation() + Rider->GetActorForwardVector() * 182.0f + FVector(0, 0, 76);
	const FVector End = Start + Rider->GetActorForwardVector() * 4200.0f;
	FHitResult Hit;
	GetWorld()->SweepSingleByChannel(Hit, Start, End, FQuat::Identity, ECC_Visibility,
		FCollisionShape::MakeSphere(14.0f), MakeCombatQuery(Rider));
	ANeonChaseEnemy* Enemy = Cast<ANeonChaseEnemy>(Hit.GetActor());
	const bool bDamagedTarget = Enemy && !Enemy->IsDisabled();
	if (bDamagedTarget)
	{
		++ShotsHit;
		Enemy->ReceiveWeaponHit(12.0f);
	}
	Rider->ShowWeaponTrace(Start, Hit.bBlockingHit ? Hit.ImpactPoint : End, bDamagedTarget);
}

void ALinxiaMotorcycleChaseGameMode::NotifyEnemyDisabled(ANeonChaseEnemy* Enemy)
{
	++Kills;
	if (Enemy == Convoy)
	{
		bConvoyDisabled = true;
		if (Rider) Rider->MarkConvoyDisabled();
	}
	UE_LOG(LogTemp, Display, TEXT("[NeonChase] Disabled vehicle=%s convoy=%d kills=%d"), *Enemy->GetName(), Enemy->IsConvoy(), Kills);
}

float ALinxiaMotorcycleChaseGameMode::GetRouteProgress() const
{
	return Rider ? FMath::Clamp(
		(static_cast<float>(Rider->GetActorLocation().X) - RouteStartX) / (FinishX - RouteStartX),
		0.0f,
		1.0f) : 0.0f;
}

float ALinxiaMotorcycleChaseGameMode::GetConvoyArmor() const
{
	return bConvoyDisabled ? 0.0f : IsValid(Convoy) ? Convoy->GetArmorFraction() : 1.0f;
}

float ALinxiaMotorcycleChaseGameMode::GetFinishDistanceMeters() const
{
	return Rider ? FMath::Max(0.0f, FinishX - static_cast<float>(Rider->GetActorLocation().X)) / 100.0f
		: (FinishX - RouteStartX) / 100.0f;
}

void ALinxiaMotorcycleChaseGameMode::BuildSmokeInput(float& Forward, float& Steer, bool& bFire, bool& bBoost)
{
	const FVector Position = Rider->GetActorLocation();
	Forward = 1;
	if (SmokeScenario.Equals(TEXT("Lost"), ESearchCase::IgnoreCase))
	{
		// Drive briefly, then brake and allow the real encounter deadline to expire.
		Forward = EncounterTime < 3.0f ? 1.0f : -1.0f;
		Steer = 0;
		return;
	}
	ANeonChaseEnemy* Target = nullptr;
	float Nearest = 4200;
	if (IsValid(Convoy) && !Convoy->IsDisabled())
	{
		const float ConvoyGap = Convoy->GetActorLocation().X - Position.X;
		if (ConvoyGap > 450.0f && ConvoyGap < Nearest)
		{
			Nearest = ConvoyGap;
			Target = Convoy;
		}
	}
	for (ANeonChaseEnemy* Enemy : Enemies)
	{
		if (!IsValid(Enemy) || Enemy->IsDisabled() || Target == Convoy) continue;
		const float Gap = Enemy->GetActorLocation().X - Position.X;
		if (Gap > 450 && Gap < Nearest) { Nearest = Gap; Target = Enemy; }
	}
	const bool bAcceptFirstHit = SmokeScenario.Equals(TEXT("Damaged"), ESearchCase::IgnoreCase) && Rider->GetHealth() >= 99.99f;
	if (bAcceptFirstHit)
	{
		for (ANeonChaseEnemy* Enemy : Enemies)
		{
			if (!IsValid(Enemy) || Enemy->IsDisabled() || !Enemy->IsCharging()) continue;
			SmokeDesiredLane = Enemy->GetLockedLane();
			Steer = FMath::Clamp((SmokeDesiredLane - static_cast<float>(Position.Y)) / 105.0f, -1.0f, 1.0f);
			bFire = false;
			bBoost = false;
			return;
		}
	}
	const float DesiredLane = Target ? Target->GetActorLocation().Y : 0.0f;
	float BestScore = TNumericLimits<float>::Max();
	float BestLane = SmokeDesiredLane;
	for (float Lane : {-420.0f, -280.0f, -140.0f, 0.0f, 140.0f, 280.0f, 420.0f})
	{
		float Score = FMath::Abs(Lane - DesiredLane) * .6f + FMath::Abs(Lane - SmokeDesiredLane) * .3f;
		FCollisionQueryParams Query = MakeCombatQuery(Rider);
		// Vehicle contact is scored separately so the planner can fire before passing.
		for (ANeonChaseEnemy* Enemy : Enemies) if (IsValid(Enemy)) Query.AddIgnoredActor(Enemy);
		FHitResult Hit;
		const FVector Ahead(Position.X + FMath::Max(1400.0f, Rider->GetForwardSpeed()), Lane, Position.Z + 60);
		if (GetWorld()->SweepSingleByChannel(Hit, FVector(Position.X, Lane, Position.Z + 60), Ahead,
			FQuat::Identity, ECC_Visibility, FCollisionShape::MakeBox(FVector(170, 62, 52)), Query)) Score += 100000;
		for (ANeonChaseEnemy* Enemy : Enemies)
		{
			if (!IsValid(Enemy)) continue;
			const float Gap = Enemy->GetActorLocation().X - Position.X;
			if (Enemy->IsCharging() && Gap > -100 && Gap < 3900 && !bAcceptFirstHit
				&& FMath::Abs(Lane - Enemy->GetLockedLane()) < 155) Score += 20000;
			if (Gap > -420 && Gap < (Enemy->IsDisabled() ? 1500 : 780)
				&& FMath::Abs(Lane - Enemy->GetActorLocation().Y) < Enemy->GetHalfWidth() + 90) Score += 50000;
		}
		if (Score < BestScore) { BestScore = Score; BestLane = Lane; }
	}
	SmokeDesiredLane = BestLane;
	Steer = FMath::Clamp((BestLane - static_cast<float>(Position.Y)) / 105.0f, -1.0f, 1.0f);
	bFire = Target && !bAcceptFirstHit && FMath::Abs(Steer) < .10f
		&& FMath::Abs(Target->GetActorLocation().Y - Position.Y) < Target->GetHalfWidth() + 10;
	bBoost = !Target && BestScore < 1000 && Rider->GetBoostEnergy() > 65 && EncounterTime > 4.0f;
	if (Target == Convoy && Nearest < 3000.0f && Rider->GetForwardSpeed() > 1050.0f)
	{
		Forward = -1.0f;
		bBoost = false;
	}
	if (BestScore >= 100000) Forward = -1;
}

void ALinxiaMotorcycleChaseGameMode::CompleteSmoke(bool bTimedOut)
{
	if (bSmokeCompleted) return;
	bSmokeCompleted = true;
	const bool bLost = SmokeScenario.Equals(TEXT("Lost"), ESearchCase::IgnoreCase);
	const bool bClean = SmokeScenario.Equals(TEXT("Clean"), ESearchCase::IgnoreCase);
	const bool bDamaged = SmokeScenario.Equals(TEXT("Damaged"), ESearchCase::IgnoreCase);
	const bool bHealthMatches = bClean ? Rider && Rider->GetHealth() >= 99.99f
		: bDamaged ? Rider && Rider->GetHealth() > 0.0f && Rider->GetHealth() < 99.99f
		: true;
	const bool bPass = !bTimedOut && Rider && Phase == ENeonChasePhase::Results
		&& SmokeScenario.Equals(OutcomeName(Outcome), ESearchCase::IgnoreCase)
		&& bHealthMatches
		&& (bLost ? EncounterTime >= 95.0f || Rider->GetHealth() <= 0
			: bConvoyDisabled && ShotsHit >= 30 && NextZone == 3 && GetRouteProgress() >= 1.0f);
	UE_LOG(LogTemp, Display, TEXT("[NeonChaseSmoke] %s scenario=%s outcome=%s phase=%s health=%.1f time=%.3f x=%.1f convoy=%d zones=%d shots=%d hits=%d reason=%s"),
		bPass ? TEXT("PASS") : TEXT("FAIL"), *SmokeScenario, OutcomeName(Outcome), PhaseName(Phase),
		Rider ? Rider->GetHealth() : 0, EncounterTime, Rider ? Rider->GetActorLocation().X : 0,
		bConvoyDisabled, NextZone, ShotsFired, ShotsHit, bTimedOut ? TEXT("WallClockTimeout") : bPass ? TEXT("VerifiedSimulation") : TEXT("UnexpectedResult"));
	FPlatformMisc::RequestExitWithStatus(false, bPass ? 0 : 1);
}
