#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "NeonChaseTypes.h"
#include "NeonCinematicBridgeWidget.generated.h"

class FNeonFilmSampleObserver;
class UButton;
class UCanvasPanel;
class UFileMediaSource;
class UImage;
class UMediaPlayer;
class UMediaSoundComponent;
class UMediaTexture;

DECLARE_DELEGATE_TwoParams(FNeonPresentationFinished, uint32, FName);

UCLASS()
class NEONCLEANERUE_API UNeonCinematicBridgeWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	// One fresh widget/player per request isolates delayed callbacks from old media.
	void BeginFilm(ENeonChaseFilm Film, uint32 RequestId);
	void AdvancePresentation(double Now);
	void CancelPresentation();
	static const TCHAR* FilmName(ENeonChaseFilm Film);
	FNeonPresentationFinished OnPresentationFinished;

protected:
	virtual void NativeOnInitialized() override;
	virtual void NativeDestruct() override;
	virtual FReply NativeOnPreviewKeyDown(const FGeometry& Geometry, const FKeyEvent& Event) override;

private:
	UPROPERTY(Transient)
	TObjectPtr<UMediaPlayer> MediaPlayer;
	UPROPERTY(Transient)
	TObjectPtr<UMediaTexture> MediaTexture;
	UPROPERTY(Transient)
	TObjectPtr<UFileMediaSource> FileMediaSource;
	UPROPERTY(Transient)
	TObjectPtr<UMediaSoundComponent> MediaSound;
	UPROPERTY(Transient)
	TObjectPtr<UCanvasPanel> FilmCanvas;
	UPROPERTY(Transient)
	TObjectPtr<UImage> VideoImage;
	UPROPERTY(Transient)
	TObjectPtr<UButton> SkipButton;

	TSharedPtr<FNeonFilmSampleObserver, ESPMode::ThreadSafe> SampleObserver;
	ENeonChaseFilm Film = ENeonChaseFilm::Intro;
	uint32 RequestId = 0;
	FName FinishReason;
	FString TestMode;
	FString TemporaryCorruptPath;
	double StartedAt = 0.0;
	double ReadyAt = 0.0;
	double LastProgressAt = 0.0;
	double RevealAt = 0.0;
	double LastStatusAt = 0.0;
	int64 LastSampleTicks = MIN_int64;
	uint64 LastSampleCount = 0;
	float OpenTimeout = 8.0f;
	float StallTimeout = 4.0f;
	float MaxDuration = 180.0f;
	float RevealOpacity = 0.0f;
	bool bActive = false;
	bool bStarted = false;
	bool bOpened = false;
	bool bDecodedReady = false;
	bool bDecodeLogged = false;
	bool bTestStallInjected = false;
	bool bRevealing = false;
	bool bSkipKeyDown = false;

	UFUNCTION()
	void HandleMediaOpened(FString OpenedUrl);
	UFUNCTION()
	void HandleMediaOpenFailed(FString FailedUrl);
	UFUNCTION()
	void HandleMediaEnded();
	UFUNCTION()
	void HandleMediaClosed();
	UFUNCTION()
	void HandleSkipClicked();

	void BuildWidgetTree();
	void RequestFinish(FName Reason);
	void CompletePresentation();
	void ReleaseMedia();
	void UpdateAspectFit();
	void SetFilmOpacity(float Opacity);
	FString ResolveMoviePath() const;
};
