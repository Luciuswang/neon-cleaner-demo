#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "NeonCinematicBridgeWidget.generated.h"

class UButton;
class UFileMediaSource;
class UImage;
class UMediaPlayer;
class UMediaTexture;
class UTextBlock;

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FNeonCinematicBridgeFinished);

UCLASS()
class NEONCLEANERUE_API UNeonCinematicBridgeWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	UPROPERTY(BlueprintAssignable, Category = "Neon Cleaner")
	FNeonCinematicBridgeFinished OnBridgeFinished;

protected:
	virtual void NativeConstruct() override;
	virtual void NativeDestruct() override;

private:
	UPROPERTY()
	UMediaPlayer* MediaPlayer = nullptr;

	UPROPERTY()
	UMediaTexture* MediaTexture = nullptr;

	UPROPERTY()
	UFileMediaSource* FileMediaSource = nullptr;

	UPROPERTY()
	UImage* VideoImage = nullptr;

	UPROPERTY()
	UTextBlock* StatusText = nullptr;

	UPROPERTY()
	UButton* SkipButton = nullptr;

	UFUNCTION()
	void HandleMediaEnded();

	UFUNCTION()
	void HandleSkipClicked();

	UFUNCTION()
	void HandleMediaOpenFailed(FString FailedUrl);

	void FinishBridge();
	void BuildWidgetTree();
};
