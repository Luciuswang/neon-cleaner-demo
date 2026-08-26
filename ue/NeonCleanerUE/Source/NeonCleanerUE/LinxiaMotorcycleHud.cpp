#include "LinxiaMotorcycleHud.h"

#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "GameFramework/PlayerController.h"
#include "LinxiaMotorcyclePawn.h"

void ALinxiaMotorcycleHud::DrawHUD()
{
	Super::DrawHUD();

	if (!Canvas)
	{
		return;
	}

	ALinxiaMotorcyclePawn* MotorcyclePawn = nullptr;
	if (APlayerController* PlayerController = GetOwningPlayerController())
	{
		MotorcyclePawn = Cast<ALinxiaMotorcyclePawn>(PlayerController->GetPawn());
	}

	const float X = 32.0f;
	float Y = 30.0f;
	UFont* Font = GEngine ? GEngine->GetSmallFont() : nullptr;

	DrawRect(FLinearColor(0.0f, 0.0f, 0.0f, 0.58f), 22.0f, 22.0f, 300.0f, 112.0f);
	DrawText(TEXT("NEON CLEANER  /  LINXIA CHASE"), FColor(0, 230, 255), X, Y, Font, 1.18f, false);
	Y += 28.0f;

	if (!MotorcyclePawn)
	{
		DrawText(TEXT("Waiting for Linxia motorcycle pawn..."), FColor::White, X, Y, Font, 1.0f, false);
		return;
	}

	const float Distance = MotorcyclePawn->GetChaseTargetDistance();
	const FString DistanceText = Distance >= 0.0f
		? FString::Printf(TEXT("Target: %.0fm"), Distance / 100.0f)
		: TEXT("Target: searching");
	const FString SpeedText = FString::Printf(TEXT("Speed: %.0f km/h"), MotorcyclePawn->GetCurrentSpeedKmh());
	const FString StatusText = MotorcyclePawn->HasCaughtChaseTarget()
		? TEXT("STATUS: TARGET CAUGHT")
		: TEXT("STATUS: PURSUIT ACTIVE");

	DrawText(SpeedText, FColor::White, X, Y, Font, 1.0f, false);
	Y += 22.0f;
	DrawText(DistanceText, FColor(255, 186, 64), X, Y, Font, 1.0f, false);
	Y += 22.0f;
	DrawText(StatusText, MotorcyclePawn->HasCaughtChaseTarget() ? FColor::Green : FColor(255, 80, 170), X, Y, Font, 1.0f, false);

	const float HelpY = Canvas->ClipY - 52.0f;
	DrawRect(FLinearColor(0.0f, 0.0f, 0.0f, 0.55f), 22.0f, HelpY - 8.0f, 470.0f, 32.0f);
	DrawText(TEXT("W/S throttle  A/D steer  Mouse camera  Space brake  R reset"), FColor(190, 220, 235), X, HelpY, Font, 0.9f, false);
}
