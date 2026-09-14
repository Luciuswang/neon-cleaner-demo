#include "NeonCinematicBridgeWidget.h"

#include "Blueprint/WidgetTree.h"
#include "Components/Button.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/Image.h"
#include "Components/TextBlock.h"
#include "FileMediaSource.h"
#include "GameFramework/PlayerController.h"
#include "HAL/FileManager.h"
#include "HAL/PlatformTime.h"
#include "IMediaTextureSample.h"
#include "InputCoreTypes.h"
#include "MediaPlayer.h"
#include "MediaPlayerFacade.h"
#include "MediaSampleSink.h"
#include "MediaSoundComponent.h"
#include "MediaTexture.h"
#include "Misc/CommandLine.h"
#include "Misc/FileHelper.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "Misc/ScopeLock.h"
#include "Styling/SlateBrush.h"

DEFINE_LOG_CATEGORY_STATIC(LogNeonFilm, Log, All);

namespace
{
	constexpr float DissolveSeconds = 0.18f;
	constexpr float MinimumViewportDimension = 2.0f;

	float ReadBoundedSeconds(const TCHAR* Key, float DefaultValue, float Minimum, float Maximum)
	{
		float Value = DefaultValue;
		if (!FParse::Value(FCommandLine::Get(), Key, Value) || !FMath::IsFinite(Value))
		{
			return DefaultValue;
		}
		return FMath::Clamp(Value, Minimum, Maximum);
	}

	void FillCanvas(UWidget* Widget)
	{
		if (UCanvasPanelSlot* Slot = Cast<UCanvasPanelSlot>(Widget->Slot))
		{
			Slot->SetAnchors(FAnchors(0.0f, 0.0f, 1.0f, 1.0f));
			Slot->SetOffsets(FMargin(0.0f));
		}
	}
}

// Observe actual decoded samples without retaining frames or draining the texture's queue.
// No UObject access occurs on the media thread.
class FNeonFilmSampleObserver final : public FMediaTextureSampleSink
{
public:
	virtual bool Enqueue(const TSharedRef<IMediaTextureSample, ESPMode::ThreadSafe>& Sample) override
	{
		const FIntPoint Dimensions = Sample->GetOutputDim();
		if (Dimensions.X > 0 && Dimensions.Y > 0)
		{
			FScopeLock Lock(&Mutex);
			LastTicks = Sample->GetTime().Time.GetTicks();
			++SampleCount;
		}
		return true;
	}

	virtual int32 Num() const override { return 0; }
	virtual void RequestFlush() override
	{
		FScopeLock Lock(&Mutex);
		++FlushCount;
	}
	virtual uint32 GetFlushCount() const override
	{
		FScopeLock Lock(&Mutex);
		return FlushCount;
	}
	void Snapshot(int64& OutTicks, uint64& OutCount) const
	{
		FScopeLock Lock(&Mutex);
		OutTicks = LastTicks;
		OutCount = SampleCount;
	}

private:
	mutable FCriticalSection Mutex;
	int64 LastTicks = MIN_int64;
	uint64 SampleCount = 0;
	uint32 FlushCount = 0;
};

const TCHAR* UNeonCinematicBridgeWidget::FilmName(ENeonChaseFilm InFilm)
{
	switch (InFilm)
	{
	case ENeonChaseFilm::Intro: return TEXT("Intro");
	case ENeonChaseFilm::Clean: return TEXT("Clean");
	case ENeonChaseFilm::Damaged: return TEXT("Damaged");
	case ENeonChaseFilm::Lost: return TEXT("Lost");
	default: return TEXT("Invalid");
	}
}

void UNeonCinematicBridgeWidget::NativeOnInitialized()
{
	Super::NativeOnInitialized();
	SetIsFocusable(true);
	BuildWidgetTree();
}

void UNeonCinematicBridgeWidget::BeginFilm(ENeonChaseFilm InFilm, uint32 InRequestId)
{
	check(IsInGameThread());
	if (bStarted)
	{
		return;
	}
	bStarted = true;
	bActive = true;
	Film = InFilm;
	RequestId = InRequestId;
	StartedAt = LastProgressAt = LastStatusAt = FPlatformTime::Seconds();
	OpenTimeout = ReadBoundedSeconds(TEXT("NeonFilmOpenTimeout="), 8.0f, 0.25f, 30.0f);
	StallTimeout = ReadBoundedSeconds(TEXT("NeonFilmStallTimeout="), 4.0f, 0.25f, 30.0f);
	MaxDuration = ReadBoundedSeconds(TEXT("NeonFilmMaxDuration="), 180.0f, 1.0f, 600.0f);
	FParse::Value(FCommandLine::Get(), TEXT("NeonFilmTest="), TestMode);

	UE_LOG(LogNeonFilm, Log,
		TEXT("NEON_FILM_BEGIN film=%s request=%u test=%s open_timeout=%.2f stall_timeout=%.2f max_duration=%.2f"),
		FilmName(Film), RequestId, TestMode.IsEmpty() ? TEXT("None") : *TestMode,
		OpenTimeout, StallTimeout, MaxDuration);

	if (!FilmCanvas || !VideoImage || !SkipButton)
	{
		RequestFinish(TEXT("WidgetUnavailable"));
		return;
	}
	if (!GetWorld())
	{
		RequestFinish(TEXT("WorldUnavailable"));
		return;
	}
	SetFilmOpacity(0.0f);
	SkipButton->SetUserFocus(GetOwningPlayer());
	if (const APlayerController* Controller = GetOwningPlayer())
	{
		bSkipKeyDown = Controller->IsInputKeyDown(EKeys::Enter)
			|| Controller->IsInputKeyDown(EKeys::SpaceBar)
			|| Controller->IsInputKeyDown(EKeys::Escape);
	}

	if (InFilm != ENeonChaseFilm::Intro && InFilm != ENeonChaseFilm::Clean
		&& InFilm != ENeonChaseFilm::Damaged && InFilm != ENeonChaseFilm::Lost)
	{
		RequestFinish(TEXT("InvalidFilm"));
		return;
	}

	FString MoviePath = ResolveMoviePath();
	if (TestMode.Equals(TEXT("Missing"), ESearchCase::IgnoreCase))
	{
		MoviePath = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("NeonFilmTests"),
			FGuid::NewGuid().ToString(EGuidFormats::Digits) + TEXT("_missing.mp4"));
		UE_LOG(LogNeonFilm, Log, TEXT("NEON_FILM_TEST film=%s request=%u mode=Missing action=nonexistent_path"),
			FilmName(Film), RequestId);
	}
	else if (TestMode.Equals(TEXT("Corrupt"), ESearchCase::IgnoreCase))
	{
		const FString TestDirectory = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("NeonFilmTests"));
		IFileManager::Get().MakeDirectory(*TestDirectory, true);
		TemporaryCorruptPath = FPaths::Combine(TestDirectory,
			FGuid::NewGuid().ToString(EGuidFormats::Digits) + TEXT("_corrupt.mp4"));
		if (!FFileHelper::SaveStringToFile(TEXT("Neon film test: deliberately invalid MP4 bytes.\n"),
			*TemporaryCorruptPath, FFileHelper::EEncodingOptions::ForceAnsi))
		{
			RequestFinish(TEXT("TestSetupFailed"));
			return;
		}
		MoviePath = TemporaryCorruptPath;
		UE_LOG(LogNeonFilm, Log, TEXT("NEON_FILM_TEST film=%s request=%u mode=Corrupt action=real_invalid_mp4"),
			FilmName(Film), RequestId);
	}
	else if (!TestMode.IsEmpty() && !TestMode.Equals(TEXT("Stall"), ESearchCase::IgnoreCase))
	{
		UE_LOG(LogNeonFilm, Warning, TEXT("NEON_FILM_TEST film=%s request=%u mode=%s action=ignored_unknown_mode"),
			FilmName(Film), RequestId, *TestMode);
	}

	if (!IFileManager::Get().FileExists(*MoviePath))
	{
		UE_LOG(LogNeonFilm, Warning, TEXT("NEON_FILM_MISSING film=%s request=%u path=%s"),
			FilmName(Film), RequestId, *MoviePath);
		RequestFinish(TEXT("Missing"));
		return;
	}

	MediaPlayer = NewObject<UMediaPlayer>(this);
	MediaTexture = NewObject<UMediaTexture>(this);
	FileMediaSource = NewObject<UFileMediaSource>(this);
	MediaPlayer->PlayOnOpen = false;
	MediaPlayer->SetLooping(false);
	MediaPlayer->OnMediaOpened.AddDynamic(this, &ThisClass::HandleMediaOpened);
	MediaPlayer->OnMediaOpenFailed.AddDynamic(this, &ThisClass::HandleMediaOpenFailed);
	MediaPlayer->OnEndReached.AddDynamic(this, &ThisClass::HandleMediaEnded);
	MediaPlayer->OnMediaClosed.AddDynamic(this, &ThisClass::HandleMediaClosed);
	SampleObserver = MakeShared<FNeonFilmSampleObserver, ESPMode::ThreadSafe>();
	MediaPlayer->GetPlayerFacade()->AddVideoSampleSink(SampleObserver.ToSharedRef());

	// Keep the last decoded frame during the reveal, including an unexpected close.
	MediaTexture->AutoClear = false;
	MediaTexture->ClearColor = FLinearColor::Transparent;
	MediaTexture->NewStyleOutput = true;
	MediaTexture->SetMediaPlayer(MediaPlayer);
	MediaTexture->UpdateResource();
	FSlateBrush Brush;
	Brush.SetResourceObject(MediaTexture);
	Brush.ImageSize = FVector2D(1920.0f, 1080.0f);
	VideoImage->SetBrush(Brush);

	MediaSound = NewObject<UMediaSoundComponent>(this);
	MediaSound->bIsUISound = true;
	MediaSound->bAllowSpatialization = false;
	MediaSound->Channels = EMediaSoundChannels::Stereo;
	MediaSound->SetMediaPlayer(MediaPlayer);
	MediaSound->RegisterComponentWithWorld(GetWorld());
	MediaSound->SetVolumeMultiplier(0.0f);
	MediaSound->Start();

	FileMediaSource->SetFilePath(MoviePath);
	// This may synchronously reject, or synchronously invoke a callback. Callbacks
	// only latch the first terminal reason; completion always happens on a later tick.
	const bool bAccepted = MediaPlayer->OpenSource(FileMediaSource);
	UE_LOG(LogNeonFilm, Log, TEXT("NEON_FILM_OPEN_SOURCE film=%s request=%u accepted=%d path=%s"),
		FilmName(Film), RequestId, bAccepted, *MoviePath);
	if (!bAccepted)
	{
		RequestFinish(TEXT("OpenRejected"));
	}
}

void UNeonCinematicBridgeWidget::HandleMediaOpened(FString OpenedUrl)
{
	if (!bActive || !FinishReason.IsNone() || bOpened)
	{
		return;
	}
	bOpened = true;
	const int32 VideoTracks = MediaPlayer->GetNumTracks(EMediaPlayerTrack::Video);
	const int32 AudioTracks = MediaPlayer->GetNumTracks(EMediaPlayerTrack::Audio);
	UE_LOG(LogNeonFilm, Log,
		TEXT("NEON_FILM_OPENED film=%s request=%u video_tracks=%d audio_tracks=%d url=%s"),
		FilmName(Film), RequestId, VideoTracks, AudioTracks, *OpenedUrl);
	if (VideoTracks <= 0)
	{
		RequestFinish(TEXT("NoVideoTrack"));
		return;
	}
	// Sound registration happens before opening; explicitly update its sink now.
	if (MediaSound)
	{
		MediaSound->UpdatePlayer();
	}
	if (!MediaPlayer->Play())
	{
		RequestFinish(TEXT("PlayRejected"));
	}
}

void UNeonCinematicBridgeWidget::HandleMediaOpenFailed(FString FailedUrl)
{
	UE_LOG(LogNeonFilm, Warning, TEXT("NEON_FILM_OPEN_FAILED film=%s request=%u url=%s"),
		FilmName(Film), RequestId, *FailedUrl);
	RequestFinish(TEXT("OpenFailed"));
}

void UNeonCinematicBridgeWidget::HandleMediaEnded()
{
	RequestFinish(bDecodedReady ? FName(TEXT("Ended")) : FName(TEXT("EndedBeforeFrame")));
}

void UNeonCinematicBridgeWidget::HandleMediaClosed()
{
	if (FinishReason.IsNone())
	{
		SetFilmOpacity(0.0f);
	}
	RequestFinish(TEXT("Closed"));
}

void UNeonCinematicBridgeWidget::HandleSkipClicked()
{
	RequestFinish(TEXT("Skipped"));
}

void UNeonCinematicBridgeWidget::RequestFinish(FName Reason)
{
	if (!bActive || !FinishReason.IsNone())
	{
		return;
	}
	FinishReason = Reason;
	UE_LOG(LogNeonFilm, Log, TEXT("NEON_FILM_TERMINAL film=%s request=%u reason=%s decoded_ready=%d"),
		FilmName(Film), RequestId, *Reason.ToString(), bDecodedReady);
}

void UNeonCinematicBridgeWidget::AdvancePresentation(double Now)
{
	if (!bActive)
	{
		return;
	}
	if (const APlayerController* Controller = GetOwningPlayer())
	{
		const bool bSkipDownNow = Controller->IsInputKeyDown(EKeys::Enter)
			|| Controller->IsInputKeyDown(EKeys::SpaceBar)
			|| Controller->IsInputKeyDown(EKeys::Escape);
		if (bSkipDownNow && !bSkipKeyDown)
		{
			RequestFinish(TEXT("Skipped"));
		}
		bSkipKeyDown = bSkipDownNow;
	}
	if (!FinishReason.IsNone())
	{
		if (!bRevealing)
		{
			bRevealing = true;
			RevealAt = Now;
			RevealOpacity = FilmCanvas ? FilmCanvas->GetRenderOpacity() : 0.0f;
			UE_LOG(LogNeonFilm, Log, TEXT("NEON_FILM_REVEAL film=%s request=%u reason=%s opacity=%.3f"),
				FilmName(Film), RequestId, *FinishReason.ToString(), RevealOpacity);
			// Stop the media clock without closing/clearing the texture underneath the fade.
			if (MediaPlayer)
			{
				MediaPlayer->Pause();
			}
		}
		const float Alpha = FMath::Clamp(static_cast<float>((Now - RevealAt) / DissolveSeconds), 0.0f, 1.0f);
		SetFilmOpacity(RevealOpacity * (1.0f - Alpha));
		if (RevealOpacity <= 0.0f || Alpha >= 1.0f || !IsInViewport())
		{
			CompletePresentation();
		}
		return;
	}
	if (!MediaPlayer || !MediaTexture || !SampleObserver || MediaPlayer->HasError())
	{
		SetFilmOpacity(0.0f);
		RequestFinish(TEXT("PlaybackError"));
		return;
	}
	if (Now - StartedAt >= MaxDuration)
	{
		RequestFinish(TEXT("DurationTimeout"));
		return;
	}

	int64 SampleTicks = MIN_int64;
	uint64 SampleCount = 0;
	SampleObserver->Snapshot(SampleTicks, SampleCount);
	if (SampleCount > LastSampleCount && SampleTicks != LastSampleTicks)
	{
		LastSampleCount = SampleCount;
		LastSampleTicks = SampleTicks;
		LastProgressAt = Now;
	}
	if (SampleCount > 0 && !bDecodeLogged)
	{
		bDecodeLogged = true;
		UE_LOG(LogNeonFilm, Log, TEXT("NEON_FILM_DECODE_OBSERVED film=%s request=%u sample_ticks=%lld"),
			FilmName(Film), RequestId, SampleTicks);
	}

	if (!bDecodedReady)
	{
		// Track metadata/IsPlaying alone do not prove a frame. The observer must see
		// a decoded video sample, and the texture must have a sample aspect and an
		// allocated video-sized resource (the engine's clear texture is 2x2).
		const FVector2D ViewportSize = FilmCanvas->GetCachedGeometry().GetLocalSize();
		if (bOpened && SampleCount > 0 && MediaTexture->GetCurrentAspectRatio() > 0.0f
			&& MediaTexture->GetWidth() > 2 && MediaTexture->GetHeight() > 2
			&& ViewportSize.X > MinimumViewportDimension && ViewportSize.Y > MinimumViewportDimension)
		{
			bDecodedReady = true;
			ReadyAt = LastProgressAt = Now;
			UpdateAspectFit();
			UE_LOG(LogNeonFilm, Log,
				TEXT("NEON_FILM_DECODED_READY film=%s request=%u texture=%dx%d aspect=%.4f sample_ticks=%lld elapsed=%.3f"),
				FilmName(Film), RequestId, MediaTexture->GetWidth(), MediaTexture->GetHeight(),
				MediaTexture->GetCurrentAspectRatio(), SampleTicks, Now - StartedAt);
			if (TestMode.Equals(TEXT("Stall"), ESearchCase::IgnoreCase))
			{
				bTestStallInjected = MediaPlayer->Pause();
				UE_LOG(LogNeonFilm, Log,
					TEXT("NEON_FILM_TEST film=%s request=%u mode=Stall action=pause_real_player accepted=%d"),
					FilmName(Film), RequestId, bTestStallInjected);
				if (!bTestStallInjected)
				{
					RequestFinish(TEXT("TestSetupFailed"));
					return;
				}
			}
		}
		else if (Now - StartedAt >= OpenTimeout)
		{
			RequestFinish(bOpened ? FName(TEXT("FirstFrameTimeout")) : FName(TEXT("OpenTimeout")));
			return;
		}
	}
	if (bDecodedReady)
	{
		UpdateAspectFit();
		const float Alpha = FMath::Clamp(static_cast<float>((Now - ReadyAt) / DissolveSeconds), 0.0f, 1.0f);
		SetFilmOpacity(Alpha);
		if (Now - LastProgressAt >= StallTimeout)
		{
			RequestFinish(TEXT("StallTimeout"));
			return;
		}
	}
	if (Now - LastStatusAt >= 1.0)
	{
		LastStatusAt = Now;
		UE_LOG(LogNeonFilm, Log,
			TEXT("NEON_FILM_STATUS film=%s request=%u opened=%d playing=%d decoded_ready=%d samples=%llu sample_ticks=%lld progress_age=%.3f media_time=%.3f audio_output=%d"),
			FilmName(Film), RequestId, bOpened, MediaPlayer->IsPlaying(), bDecodedReady,
			SampleCount, SampleTicks, Now - LastProgressAt, MediaPlayer->GetTime().GetTotalSeconds(),
			MediaSound && MediaSound->IsRegistered());
	}
}

void UNeonCinematicBridgeWidget::SetFilmOpacity(float Opacity)
{
	if (FilmCanvas)
	{
		FilmCanvas->SetRenderOpacity(Opacity);
	}
	if (MediaSound)
	{
		MediaSound->SetVolumeMultiplier(Opacity);
	}
}

void UNeonCinematicBridgeWidget::UpdateAspectFit()
{
	if (!MediaTexture || !VideoImage || !FilmCanvas)
	{
		return;
	}
	const FVector2D Area = FilmCanvas->GetCachedGeometry().GetLocalSize();
	const float Aspect = MediaTexture->GetCurrentAspectRatio();
	if (Area.X <= 0.0 || Area.Y <= 0.0 || !FMath::IsFinite(Aspect) || Aspect <= 0.0f)
	{
		return;
	}
	FVector2D Size(Area.Y * Aspect, Area.Y);
	if (Size.X > Area.X)
	{
		Size = FVector2D(Area.X, Area.X / Aspect);
	}
	if (UCanvasPanelSlot* VideoSlot = Cast<UCanvasPanelSlot>(VideoImage->Slot))
	{
		VideoSlot->SetSize(Size);
	}
}

void UNeonCinematicBridgeWidget::CompletePresentation()
{
	if (!bActive)
	{
		return;
	}
	const uint32 FinishedRequestId = RequestId;
	const FName Reason = FinishReason;
	const FNeonPresentationFinished Completion = OnPresentationFinished;
	if (TestMode.Equals(TEXT("Stall"), ESearchCase::IgnoreCase) && !bTestStallInjected)
	{
		UE_LOG(LogNeonFilm, Warning,
			TEXT("NEON_FILM_TEST_NOT_EXERCISED film=%s request=%u mode=Stall reason=%s"),
			FilmName(Film), RequestId, *Reason.ToString());
	}
	CancelPresentation();
	// Execute a copy: the subsystem can remove this widget or replace the request here.
	Completion.ExecuteIfBound(FinishedRequestId, Reason);
}

void UNeonCinematicBridgeWidget::CancelPresentation()
{
	bActive = false;
	OnPresentationFinished.Unbind();
	SetFilmOpacity(0.0f);
	ReleaseMedia();
}

void UNeonCinematicBridgeWidget::ReleaseMedia()
{
	if (MediaPlayer)
	{
		MediaPlayer->OnMediaOpened.RemoveAll(this);
		MediaPlayer->OnMediaOpenFailed.RemoveAll(this);
		MediaPlayer->OnEndReached.RemoveAll(this);
		MediaPlayer->OnMediaClosed.RemoveAll(this);
	}
	if (MediaSound)
	{
		MediaSound->SetVolumeMultiplier(0.0f);
		MediaSound->Stop();
		MediaSound->SetMediaPlayer(nullptr);
		if (MediaSound->IsRegistered())
		{
			MediaSound->UnregisterComponent();
		}
		MediaSound = nullptr;
	}
	if (MediaPlayer)
	{
		MediaPlayer->Close();
	}
	if (MediaTexture)
	{
		MediaTexture->SetMediaPlayer(nullptr);
		MediaTexture = nullptr;
	}
	MediaPlayer = nullptr;
	FileMediaSource = nullptr;
	SampleObserver.Reset();
	if (!TemporaryCorruptPath.IsEmpty())
	{
		if (!IFileManager::Get().Delete(*TemporaryCorruptPath, false, true, true))
		{
			UE_LOG(LogNeonFilm, Warning, TEXT("NEON_FILM_TEST_CLEANUP film=%s request=%u retained_fixture=%s"),
				FilmName(Film), RequestId, *TemporaryCorruptPath);
		}
		TemporaryCorruptPath.Empty();
	}
}

FString UNeonCinematicBridgeWidget::ResolveMoviePath() const
{
	const FString MoviesDirectory = FPaths::Combine(FPaths::ProjectContentDir(), TEXT("Movies"));
	const FString SelectedPath = FPaths::Combine(MoviesDirectory,
		FString::Printf(TEXT("NeonCleaner_%s.mp4"), FilmName(Film)));
	if (IFileManager::Get().FileExists(*SelectedPath) || Film != ENeonChaseFilm::Intro)
	{
		return SelectedPath;
	}

	const FString LegacyIntroPath = FPaths::Combine(MoviesDirectory, TEXT("NeonCleaner_A0_Bridge.mp4"));
	if (IFileManager::Get().FileExists(*LegacyIntroPath))
	{
		UE_LOG(LogNeonFilm, Log, TEXT("NEON_FILM_LEGACY_INTRO request=%u path=%s"),
			RequestId, *LegacyIntroPath);
		return LegacyIntroPath;
	}
	return SelectedPath;
}

void UNeonCinematicBridgeWidget::NativeDestruct()
{
	// If removed externally while the world still exists, unblock the owner next tick.
	// Normal subsystem cancellation already marked this inactive before removal.
	if (bActive)
	{
		RequestFinish(TEXT("PresentationRemoved"));
		SetFilmOpacity(0.0f);
	}
	ReleaseMedia();
	Super::NativeDestruct();
}

FReply UNeonCinematicBridgeWidget::NativeOnPreviewKeyDown(const FGeometry& InGeometry, const FKeyEvent& InKeyEvent)
{
	const FKey Key = InKeyEvent.GetKey();
	if (bActive && (Key == EKeys::Enter || Key == EKeys::SpaceBar || Key == EKeys::Escape))
	{
		if (!InKeyEvent.IsRepeat())
		{
			HandleSkipClicked();
		}
		return FReply::Handled();
	}
	return Super::NativeOnPreviewKeyDown(InGeometry, InKeyEvent);
}

void UNeonCinematicBridgeWidget::BuildWidgetTree()
{
	UCanvasPanel* Root = WidgetTree->ConstructWidget<UCanvasPanel>(UCanvasPanel::StaticClass(), TEXT("FilmRoot"));
	Root->SetVisibility(ESlateVisibility::SelfHitTestInvisible);
	WidgetTree->RootWidget = Root;
	FilmCanvas = WidgetTree->ConstructWidget<UCanvasPanel>(UCanvasPanel::StaticClass(), TEXT("FilmCanvas"));
	FilmCanvas->SetVisibility(ESlateVisibility::HitTestInvisible);
	FilmCanvas->SetRenderOpacity(0.0f);
	Root->AddChild(FilmCanvas);
	FillCanvas(FilmCanvas);

	UImage* Matte = WidgetTree->ConstructWidget<UImage>(UImage::StaticClass(), TEXT("FilmMatte"));
	Matte->SetColorAndOpacity(FLinearColor::Black);
	FilmCanvas->AddChild(Matte);
	FillCanvas(Matte);

	VideoImage = WidgetTree->ConstructWidget<UImage>(UImage::StaticClass(), TEXT("FilmImage"));
	FilmCanvas->AddChild(VideoImage);
	if (UCanvasPanelSlot* VideoSlot = Cast<UCanvasPanelSlot>(VideoImage->Slot))
	{
		VideoSlot->SetAnchors(FAnchors(0.5f, 0.5f));
		VideoSlot->SetAlignment(FVector2D(0.5f, 0.5f));
		VideoSlot->SetPosition(FVector2D::ZeroVector);
		VideoSlot->SetSize(FVector2D::ZeroVector);
	}

	SkipButton = WidgetTree->ConstructWidget<UButton>(UButton::StaticClass(), TEXT("FilmSkip"));
	SkipButton->SetToolTipText(NSLOCTEXT("NeonFilm", "SkipTooltip", "Skip film"));
	SkipButton->OnClicked.AddDynamic(this, &ThisClass::HandleSkipClicked);
	Root->AddChild(SkipButton);
	if (UCanvasPanelSlot* ButtonSlot = Cast<UCanvasPanelSlot>(SkipButton->Slot))
	{
		ButtonSlot->SetAnchors(FAnchors(1.0f, 1.0f));
		ButtonSlot->SetAlignment(FVector2D(1.0f, 1.0f));
		ButtonSlot->SetPosition(FVector2D(-24.0f, -24.0f));
		ButtonSlot->SetSize(FVector2D(64.0f, 44.0f));
	}
	UTextBlock* SkipLabel = WidgetTree->ConstructWidget<UTextBlock>(UTextBlock::StaticClass(), TEXT("FilmSkipLabel"));
	SkipLabel->SetText(NSLOCTEXT("NeonFilm", "Skip", "Skip"));
	SkipLabel->SetJustification(ETextJustify::Center);
	FSlateFontInfo Font = SkipLabel->GetFont();
	Font.Size = 14;
	SkipLabel->SetFont(Font);
	SkipButton->AddChild(SkipLabel);
}
