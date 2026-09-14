#include "LinxiaMotorcycleHud.h"

#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "LinxiaMotorcycleChaseGameMode.h"
#include "LinxiaMotorcyclePawn.h"
#include "NeonChaseEnemy.h"

namespace
{
const TCHAR* PhaseLabel(ENeonChasePhase Phase)
{
	switch (Phase)
	{
	case ENeonChasePhase::Preparing: return TEXT("PREPARING");
	case ENeonChasePhase::Intro: return TEXT("INTRO");
	case ENeonChasePhase::Playing: return TEXT("PURSUIT");
	case ENeonChasePhase::Outro: return TEXT("OUTRO");
	default: return TEXT("RESULTS");
	}
}

const TCHAR* OutcomeLabel(ENeonChaseOutcome Outcome)
{
	switch (Outcome)
	{
	case ENeonChaseOutcome::Clean: return TEXT("CLEAN INTERCEPT");
	case ENeonChaseOutcome::Damaged: return TEXT("INTERCEPT COMPLETE");
	case ENeonChaseOutcome::Lost: return TEXT("TARGET LOST");
	default: return TEXT("PURSUIT ACTIVE");
	}
}
}

void ALinxiaMotorcycleHud::DrawHUD()
{
	Super::DrawHUD();
	if (!Canvas)
	{
		return;
	}

	APlayerController* PC = GetOwningPlayerController();
	ALinxiaMotorcycleChaseGameMode* Mode = GetWorld()
		? GetWorld()->GetAuthGameMode<ALinxiaMotorcycleChaseGameMode>()
		: nullptr;
	ALinxiaMotorcyclePawn* Rider = Mode ? Mode->GetRider()
		: PC ? Cast<ALinxiaMotorcyclePawn>(PC->GetPawn()) : nullptr;
	if (Mode && Mode->IsFilmRecording())
	{
		return;
	}
	UFont* SmallFont = GEngine ? GEngine->GetSmallFont() : nullptr;
	UFont* MediumFont = GEngine ? GEngine->GetMediumFont() : SmallFont;
	const float Width = Canvas->ClipX;
	const float Height = Canvas->ClipY;
	const FColor Cyan(0, 232, 255);
	const FColor Amber(255, 184, 58);
	const FColor Magenta(255, 66, 153);
	const FColor Pale(205, 226, 235);

	auto DrawBar = [this](float X, float Y, float W, float H, float Fraction,
		const FLinearColor& Fill, const FString& Label)
	{
		const float Value = FMath::Clamp(Fraction, 0.0f, 1.0f);
		DrawRect(FLinearColor(0.01f, 0.015f, 0.025f, 0.84f), X, Y, W, H);
		DrawRect(FLinearColor(0.08f, 0.11f, 0.14f, 0.95f), X + 2.0f, Y + 2.0f, W - 4.0f, H - 4.0f);
		DrawRect(Fill, X + 2.0f, Y + 2.0f, (W - 4.0f) * Value, H - 4.0f);
		if (!Label.IsEmpty())
		{
			DrawText(Label, FColor::White, X + 7.0f, Y + 1.0f,
				GEngine ? GEngine->GetSmallFont() : nullptr, 0.78f, false);
		}
	};

	if (!Rider)
	{
		DrawRect(FLinearColor(0.0f, 0.0f, 0.0f, 0.72f), 22.0f, 22.0f, 330.0f, 54.0f);
		DrawText(TEXT("NEON CLEANER  /  INITIALIZING RIDER"), Cyan, 34.0f, 38.0f, SmallFont, 1.0f, false);
		return;
	}

	if (!Mode || Mode->IsLegacyTest())
	{
		const float X = 32.0f;
		float Y = 30.0f;
		DrawRect(FLinearColor(0.0f, 0.0f, 0.0f, 0.58f), 22.0f, 22.0f, 300.0f, 112.0f);
		DrawText(TEXT("NEON CLEANER  /  LINXIA CHASE"), Cyan, X, Y, SmallFont, 1.18f, false);
		Y += 28.0f;
		const float Distance = Rider->GetChaseTargetDistance();
		DrawText(FString::Printf(TEXT("Speed: %.0f km/h"), Rider->GetCurrentSpeedKmh()),
			FColor::White, X, Y, SmallFont, 1.0f, false);
		Y += 22.0f;
		DrawText(Distance >= 0.0f
			? FString::Printf(TEXT("Target: %.0fm"), Distance / 100.0f)
			: TEXT("Target: searching"), Amber, X, Y, SmallFont, 1.0f, false);
		Y += 22.0f;
		DrawText(Rider->HasCaughtChaseTarget() ? TEXT("STATUS: TARGET CAUGHT") : TEXT("STATUS: PURSUIT ACTIVE"),
			Rider->HasCaughtChaseTarget() ? FColor::Green : Magenta, X, Y, SmallFont, 1.0f, false);
		const float HelpY = Height - 52.0f;
		DrawRect(FLinearColor(0.0f, 0.0f, 0.0f, 0.55f), 22.0f, HelpY - 8.0f, 470.0f, 32.0f);
		DrawText(TEXT("W/S throttle  A/D steer  Mouse camera  Space brake  R reset"),
			Pale, X, HelpY, SmallFont, 0.9f, false);
		return;
	}

	if (Mode->GetPhase() == ENeonChasePhase::Intro
		|| Mode->GetPhase() == ENeonChasePhase::Outro)
	{
		return;
	}

	if (Mode->GetPhase() == ENeonChasePhase::Preparing)
	{
		DrawRect(FLinearColor(0.0f, 0.0f, 0.0f, 0.68f), 24.0f, 24.0f, 300.0f, 48.0f);
		DrawText(TEXT("CHASE SYSTEM  /  PREPARING"), Cyan, 36.0f, 39.0f, SmallFont, 1.0f, false);
		return;
	}

	const float PanelX = 26.0f;
	const float PanelY = 24.0f;
	const float PanelW = FMath::Clamp(Width * 0.27f, 300.0f, 390.0f);
	DrawRect(FLinearColor(0.005f, 0.008f, 0.014f, 0.77f), PanelX, PanelY, PanelW, 166.0f);
	DrawText(TEXT("KELLY  /  INTERCEPT UNIT"), Cyan, PanelX + 14.0f, PanelY + 12.0f, SmallFont, 1.05f, false);
	DrawText(FString::Printf(TEXT("%03.0f KM/H"), Rider->GetCurrentSpeedKmh()),
		FColor::White, PanelX + PanelW - 92.0f, PanelY + 12.0f, SmallFont, 1.0f, false);
	DrawBar(PanelX + 14.0f, PanelY + 43.0f, PanelW - 28.0f, 18.0f,
		Rider->GetHealth() / 100.0f,
		Rider->GetHealth() > 35.0f ? FLinearColor(0.04f, 0.72f, 0.68f, 1.0f) : FLinearColor(0.95f, 0.12f, 0.2f, 1.0f),
		FString::Printf(TEXT("INTEGRITY  %03.0f"), Rider->GetHealth()));
	DrawBar(PanelX + 14.0f, PanelY + 70.0f, PanelW - 28.0f, 18.0f,
		Rider->GetBoostEnergy() / 100.0f,
		FLinearColor(0.08f, 0.48f, 0.95f, 1.0f),
		Rider->GetBoostCooldown() > 0.0f
			? FString::Printf(TEXT("BOOST COOLING  %.1f"), Rider->GetBoostCooldown())
			: Rider->IsBoosting() ? TEXT("BOOST ACTIVE") : TEXT("BOOST READY"));
	DrawBar(PanelX + 14.0f, PanelY + 97.0f, PanelW - 28.0f, 18.0f,
		1.0f - Mode->GetConvoyArmor(),
		FLinearColor(0.96f, 0.32f, 0.08f, 1.0f),
		Mode->IsConvoyDisabled()
			? TEXT("CONVOY DISABLED")
			: FString::Printf(TEXT("CONVOY BREACH  %02.0f%%"), (1.0f - Mode->GetConvoyArmor()) * 100.0f));
	DrawText(FString::Printf(TEXT("ZONE %d/3    DISABLED %d    HITS %d/%d"),
		Mode->GetZone(), Mode->GetKills(), Mode->GetShotsHit(), Mode->GetShotsFired()),
		Pale, PanelX + 14.0f, PanelY + 132.0f, SmallFont, 0.86f, false);

	const float ObjectiveW = FMath::Clamp(Width * 0.34f, 360.0f, 560.0f);
	const float ObjectiveX = (Width - ObjectiveW) * 0.5f;
	DrawRect(FLinearColor(0.005f, 0.008f, 0.014f, 0.72f), ObjectiveX, 24.0f, ObjectiveW, 77.0f);
	DrawText(Mode->IsConvoyDisabled() ? TEXT("REACH EXTRACTION") : TEXT("DISABLE THE ARMORED CONVOY"),
		Mode->IsConvoyDisabled() ? FColor::Green : Amber,
		ObjectiveX + 14.0f, 36.0f, MediumFont, 0.92f, false);
	DrawBar(ObjectiveX + 14.0f, 68.0f, ObjectiveW - 28.0f, 13.0f,
		Mode->GetRouteProgress(), FLinearColor(0.0f, 0.82f, 0.9f, 1.0f), TEXT(""));
	DrawText(FString::Printf(TEXT("%.0fm TO EXTRACTION"), Mode->GetFinishDistanceMeters()),
		Pale, ObjectiveX + 14.0f, 83.0f, SmallFont, 0.78f, false);

	const float TimerW = 146.0f;
	const float TimerX = Width - TimerW - 26.0f;
	DrawRect(FLinearColor(0.005f, 0.008f, 0.014f, 0.77f), TimerX, 24.0f, TimerW, 77.0f);
	DrawText(TEXT("WINDOW"), Pale, TimerX + 14.0f, 35.0f, SmallFont, 0.78f, false);
	DrawText(FString::Printf(TEXT("%02d.%01d"),
		FMath::FloorToInt(Mode->GetTimeRemaining()),
		FMath::FloorToInt(FMath::Fmod(Mode->GetTimeRemaining(), 1.0f) * 10.0f)),
		Mode->GetTimeRemaining() < 15.0f ? FColor::Red : FColor::White,
		TimerX + 14.0f, 54.0f, MediumFont, 1.25f, false);

	if (Mode->GetPhase() == ENeonChasePhase::Playing && !Mode->IsEncounterPaused())
	{
		const float CX = Width * 0.5f;
		const float CY = Height * 0.52f;
		DrawLine(CX - 13.0f, CY, CX - 4.0f, CY, Cyan, 1.5f);
		DrawLine(CX + 4.0f, CY, CX + 13.0f, CY, Cyan, 1.5f);
		DrawLine(CX, CY - 13.0f, CX, CY - 4.0f, Cyan, 1.5f);
		DrawLine(CX, CY + 4.0f, CX, CY + 13.0f, Cyan, 1.5f);

		for (ANeonChaseEnemy* Enemy : Mode->GetEnemies())
		{
			if (!IsValid(Enemy) || Enemy->IsDisabled() || !Enemy->IsCharging() || !PC)
			{
				continue;
			}
			FVector2D Screen;
			if (PC->ProjectWorldLocationToScreen(Enemy->GetActorLocation() + FVector(0.0f, 0.0f, 140.0f), Screen))
			{
				DrawText(TEXT("LOCK"), FColor::Red, Screen.X - 17.0f, Screen.Y - 18.0f, SmallFont, 0.82f, false);
				DrawBar(Screen.X - 32.0f, Screen.Y, 64.0f, 6.0f,
					1.0f - Enemy->GetChargeFraction(), FLinearColor(1.0f, 0.05f, 0.08f, 1.0f), TEXT(""));
			}
		}
	}

	if (Rider->GetDamageFlash() > 0.0f)
	{
		const float Alpha = FMath::Clamp(Rider->GetDamageFlash(), 0.0f, 0.42f);
		DrawRect(FLinearColor(0.85f, 0.0f, 0.03f, Alpha), 0.0f, 0.0f, Width, 7.0f);
		DrawRect(FLinearColor(0.85f, 0.0f, 0.03f, Alpha), 0.0f, Height - 7.0f, Width, 7.0f);
		DrawRect(FLinearColor(0.85f, 0.0f, 0.03f, Alpha), 0.0f, 0.0f, 7.0f, Height);
		DrawRect(FLinearColor(0.85f, 0.0f, 0.03f, Alpha), Width - 7.0f, 0.0f, 7.0f, Height);
	}

	const float HelpY = Height - 42.0f;
	DrawRect(FLinearColor(0.0f, 0.0f, 0.0f, 0.62f), 24.0f, HelpY - 8.0f,
		FMath::Min(720.0f, Width - 48.0f), 30.0f);
	DrawText(TEXT("W/S DRIVE   A/D EVADE   LMB FIRE   SHIFT BOOST   SPACE BRAKE   ESC PAUSE   R RESTART"),
		Pale, 36.0f, HelpY, SmallFont, 0.78f, false);

	if (Mode->IsEncounterPaused() || Mode->GetPhase() == ENeonChasePhase::Results)
	{
		DrawRect(FLinearColor(0.0f, 0.0f, 0.0f, 0.76f), 0.0f, 0.0f, Width, Height);
		const bool bResults = Mode->GetPhase() == ENeonChasePhase::Results;
		const FString Title = bResults ? OutcomeLabel(Mode->GetOutcome()) : TEXT("CHASE PAUSED");
		const FColor TitleColor = Mode->GetOutcome() == ENeonChaseOutcome::Lost ? FColor::Red
			: Mode->GetOutcome() == ENeonChaseOutcome::Clean ? FColor::Green : Cyan;
		DrawText(Title, TitleColor, Width * 0.5f - 145.0f, Height * 0.5f - 56.0f,
			MediumFont, 1.35f, false);
		if (bResults)
		{
			DrawText(FString::Printf(TEXT("%.1fs   INTEGRITY %.0f   VEHICLES %d"),
				Mode->GetElapsedTime(), Rider->GetHealth(), Mode->GetKills()),
				Pale, Width * 0.5f - 145.0f, Height * 0.5f - 18.0f, SmallFont, 0.92f, false);
		}
		else
		{
			DrawText(FString::Printf(TEXT("%s   %.1fs REMAINING"),
				PhaseLabel(Mode->GetPhase()), Mode->GetTimeRemaining()),
				Pale, Width * 0.5f - 145.0f, Height * 0.5f - 18.0f, SmallFont, 0.92f, false);
		}

		const float ButtonW = FMath::Min(280.0f, Width - 48.0f);
		const float ButtonX = (Width - ButtonW) * 0.5f;
		const float ButtonY = Height * 0.5f + 60.0f;
		DrawRect(FLinearColor(0.0f, 0.65f, 0.72f, 0.94f), ButtonX, ButtonY, ButtonW, 44.0f);
		DrawText(bResults ? TEXT("RESTART CHASE") : TEXT("RESUME"),
			FColor::White, ButtonX + 82.0f, ButtonY + 12.0f, SmallFont, 1.0f, false);
		if (!bResults)
		{
			DrawRect(FLinearColor(0.12f, 0.14f, 0.17f, 0.96f), ButtonX, ButtonY + 54.0f, ButtonW, 44.0f);
			DrawText(TEXT("RESTART CHASE"), FColor::White,
				ButtonX + 82.0f, ButtonY + 66.0f, SmallFont, 1.0f, false);
		}
	}
}
