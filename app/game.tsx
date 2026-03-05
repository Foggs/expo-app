import { useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BrushSizePicker from "@/components/BrushSizePicker";
import ColorPicker from "@/components/ColorPicker";
import GameCanvasSection from "@/components/GameCanvasSection";
import GameHeader from "@/components/GameHeader";
import GameStatusOverlays from "@/components/GameStatusOverlays";
import GameToolbar from "@/components/GameToolbar";
import GameTurnIndicator from "@/components/GameTurnIndicator";
import { useGameScreenController } from "@/hooks/useGameScreenController";
import { useScreenPadding } from "@/hooks/useScreenPadding";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { PlayerId } from "@/hooks/useTurnFlow";

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();
  const { topPadding, bottomPadding } = useScreenPadding(insets);

  const params = useLocalSearchParams<{
    gameId: string;
    playerRole: string;
    opponentName: string;
  }>();

  const playerRole = (params.playerRole as PlayerId) ?? "player1";
  const opponentName = params.opponentName ?? "Opponent";

  const game = useGameScreenController({
    playerRole,
    opponentName,
    colors,
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <GameHeader
        colors={colors}
        topPadding={topPadding}
        onBack={game.handleBack}
        timerAnimatedStyle={game.timerAnimatedStyle}
        timerColor={game.timerColor}
        formattedTime={game.timer.formattedTime}
        roundDisplay={game.roundDisplay}
      />

      <GameTurnIndicator
        colors={colors}
        currentPlayer={game.currentPlayer}
        turnDisplay={game.turnDisplay}
        isMyTurn={game.isMyTurn}
        opponentName={opponentName}
      />

      <GameCanvasSection
        canvasRef={game.canvasRef}
        isMyTurn={game.isMyTurn}
        isSubmitting={game.isSubmitting}
        activeColor={game.activeColor}
        strokeWidth={game.strokeWidth}
        strokes={game.strokes}
        opponentStrokes={game.opponentStrokes}
        backgroundStrokes={game.backgroundStrokes}
        onStrokesChange={game.handleStrokesChange}
        onStrokeComplete={game.handleStrokeComplete}
      />

      <GameToolbar
        colors={colors}
        bottomPadding={bottomPadding}
        isMyTurn={game.isMyTurn}
        isSubmitting={game.isSubmitting}
        isEraser={game.isEraser}
        strokeColor={game.strokeColor}
        strokeCount={game.strokes.length}
        onBrushPress={game.handleBrushPress}
        onColorPress={game.handleColorPress}
        onEraserToggle={game.handleEraserToggle}
        onUndo={game.handleUndo}
        onClear={game.handleClear}
        onSubmit={game.handleSubmit}
      />

      <ColorPicker
        selectedColor={game.strokeColor}
        onColorChange={(color) => {
          game.setStrokeColor(color);
          game.setIsEraser(false);
        }}
        visible={game.showColorPicker}
        onClose={() => game.setShowColorPicker(false)}
      />

      <BrushSizePicker
        selectedSize={game.strokeWidth}
        onSizeChange={game.setStrokeWidth}
        visible={game.showBrushPicker}
        onClose={() => game.setShowBrushPicker(false)}
        currentColor={game.strokeColor}
      />

      <GameStatusOverlays
        colors={colors}
        showGetReady={game.showGetReady}
        getReadyCountdown={game.getReadyCountdown}
        getReadyAnimatedStyle={game.getReadyAnimatedStyle}
        isRetrying={game.turnState === "submit_retrying"}
        showSubmitFailed={game.turnState === "submit_failed"}
        showSyncFatal={game.turnState === "sync_error_fatal"}
        lastErrorMessage={game.lastError?.message}
        onRetrySubmit={game.retrySubmit}
        onExitGame={game.handleExitToHome}
        onReturnHome={game.handleExitToHome}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
