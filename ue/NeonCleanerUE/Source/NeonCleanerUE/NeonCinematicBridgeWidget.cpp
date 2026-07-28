#include "NeonCinematicBridgeWidget.h"

#include "Blueprint/WidgetTree.h"
#include "Components/Button.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/Image.h"
#include "Components/TextBlock.h"
#include "FileMediaSource.h"
#include "MediaPlayer.h"
#include "MediaTexture.h"
#include "Misc/Paths.h"
#include "Styling/SlateBrush.h"

void UNeonCinematicBridgeWidget::NativeConstruct()
{
	Super::NativeConstruct();

	BuildWidgetTree();

	MediaPlayer = NewObject<UMediaPlayer>(this, TEXT("NeonBridgeMediaPlayer"));
	MediaTexture = NewObject<UMediaTexture>(this, TEXT("NeonBridgeMediaTexture"));
	FileMediaSource = NewObject<UFileMediaSource>(this, TEXT("NeonBridgeFileSource"));

	const FString MoviePath = FPaths::Combine(FPaths::ProjectContentDir(), TEXT("Movies/NeonCleaner_A0_Bridge.mp4"));
	FileMediaSource->SetFilePath(MoviePath);

	MediaTexture->SetMediaPlayer(MediaPlayer);
	MediaTexture->UpdateResource();

	FSlateBrush VideoBrush;
	VideoBrush.SetResourceObject(MediaTexture);
	VideoBrush.ImageSize = FVector2D(1920.0f, 1080.0f);
	if (VideoImage)
	{
		VideoImage->SetBrush(VideoBrush);
	}

	MediaPlayer->OnEndReached.AddDynamic(this, &UNeonCinematicBridgeWidget::HandleMediaEnded);
	MediaPlayer->OnMediaOpenFailed.AddDynamic(this, &UNeonCinematicBridgeWidget::HandleMediaOpenFailed);
	MediaPlayer->PlayOnOpen = true;
	MediaPlayer->OpenSource(FileMediaSource);

	if (StatusText)
	{
		StatusText->SetText(FText::FromString(TEXT("Cinematic bridge playing. Vehicle scene is preloaded behind it.")));
	}
}

void UNeonCinematicBridgeWidget::NativeDestruct()
{
	if (MediaPlayer)
	{
		MediaPlayer->Close();
	}

	Super::NativeDestruct();
}

void UNeonCinematicBridgeWidget::BuildWidgetTree()
{
	UCanvasPanel* RootCanvas = WidgetTree->ConstructWidget<UCanvasPanel>(UCanvasPanel::StaticClass(), TEXT("RootCanvas"));
	WidgetTree->RootWidget = RootCanvas;

	VideoImage = WidgetTree->ConstructWidget<UImage>(UImage::StaticClass(), TEXT("BridgeVideoImage"));
	RootCanvas->AddChild(VideoImage);
	if (UCanvasPanelSlot* VideoSlot = Cast<UCanvasPanelSlot>(VideoImage->Slot))
	{
		VideoSlot->SetAnchors(FAnchors(0.0f, 0.0f, 1.0f, 1.0f));
		VideoSlot->SetOffsets(FMargin(0.0f));
	}

	StatusText = WidgetTree->ConstructWidget<UTextBlock>(UTextBlock::StaticClass(), TEXT("BridgeStatusText"));
	StatusText->SetText(FText::FromString(TEXT("FILM TO PLAY HANDOFF")));
	StatusText->SetColorAndOpacity(FSlateColor(FLinearColor(0.82f, 0.92f, 1.0f, 0.95f)));
	StatusText->SetShadowOffset(FVector2D(1.0f, 1.0f));
	RootCanvas->AddChild(StatusText);
	if (UCanvasPanelSlot* TextSlot = Cast<UCanvasPanelSlot>(StatusText->Slot))
	{
		TextSlot->SetAnchors(FAnchors(0.0f, 1.0f, 0.0f, 1.0f));
		TextSlot->SetPosition(FVector2D(42.0f, -86.0f));
		TextSlot->SetSize(FVector2D(760.0f, 42.0f));
	}

	SkipButton = WidgetTree->ConstructWidget<UButton>(UButton::StaticClass(), TEXT("BridgeSkipButton"));
	SkipButton->OnClicked.AddDynamic(this, &UNeonCinematicBridgeWidget::HandleSkipClicked);
	RootCanvas->AddChild(SkipButton);
	if (UCanvasPanelSlot* ButtonSlot = Cast<UCanvasPanelSlot>(SkipButton->Slot))
	{
		ButtonSlot->SetAnchors(FAnchors(1.0f, 0.0f, 1.0f, 0.0f));
		ButtonSlot->SetPosition(FVector2D(-210.0f, 38.0f));
		ButtonSlot->SetSize(FVector2D(168.0f, 44.0f));
	}

	UTextBlock* SkipLabel = WidgetTree->ConstructWidget<UTextBlock>(UTextBlock::StaticClass(), TEXT("BridgeSkipLabel"));
	SkipLabel->SetText(FText::FromString(TEXT("Take Control")));
	SkipLabel->SetJustification(ETextJustify::Center);
	SkipLabel->SetColorAndOpacity(FSlateColor(FLinearColor::White));
	SkipButton->AddChild(SkipLabel);
}

void UNeonCinematicBridgeWidget::HandleMediaEnded()
{
	FinishBridge();
}

void UNeonCinematicBridgeWidget::HandleSkipClicked()
{
	FinishBridge();
}

void UNeonCinematicBridgeWidget::HandleMediaOpenFailed(FString FailedUrl)
{
	if (StatusText)
	{
		StatusText->SetText(FText::FromString(FString::Printf(TEXT("Video failed to open: %s. Click Take Control to continue."), *FailedUrl)));
	}
}

void UNeonCinematicBridgeWidget::FinishBridge()
{
	if (MediaPlayer)
	{
		MediaPlayer->Close();
	}

	OnBridgeFinished.Broadcast();
	RemoveFromParent();
}
