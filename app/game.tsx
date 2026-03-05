import { useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BrushSizePicker from "@/components/BrushSizePicker";
import ColorPicker from "@/components/ColorPicker";
import GameCanvasSection from "@/components/GameCanvasSection";
import GameHeader from "@/components/GameHeader";
import GameStatusOverlays from "@/components/GameStatusOverlays";
import GameToolbar from "@/components/GameToolbar";
import GameTurnIndicator from "@/components/GameTurnIndicator";
import { useGameWebSocket } from "@/contexts/WebSocketContext";
import { useGameScreenController } from "@/hooks/useGameScreenController";
import { useScreenPadding } from "@/hooks/useScreenPadding";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { PlayerId } from "@/hooks/useTurnFlow";

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function toPlayerId(value: string | undefined): PlayerId | null {
  if (value === "player1" || value === "player2") {
    return value;
  }
  return null;
}

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();
  const { topPadding, bottomPadding } = useScreenPadding(insets);
  const { matchInfo, requestGameState, flowState } = useGameWebSocket();

  const params = useLocalSearchParams<{
    gameId?: string | string[];
    playerRole?: string | string[];
    opponentName?: string | string[];
  }>();

  const routeGameId = firstParam(params.gameId);
  const routePlayerRole = toPlayerId(firstParam(params.playerRole));
  const routeOpponentName = firstParam(params.opponentName);

  const matchInfoForRoute =
    matchInfo && (!routeGameId || matchInfo.gameId === routeGameId)
      ? matchInfo
      : null;
  const playerRole = matchInfoForRoute?.playerRole ?? routePlayerRole ?? "player1";
  const opponentName = matchInfoForRoute?.opponentName ?? routeOpponentName ?? "Opponent";

  const game = useGameScreenController({
    playerRole,
    opponentName,
    colors,
  });

  useEffect(() => {
    if (matchInfoForRoute?.matchType !== "friend") return;
    requestGameState();
    const retry = setTimeout(() => {
      requestGameState();
    }, 500);
    return () => clearTimeout(retry);
  }, [matchInfoForRoute?.matchType, requestGameState]);

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
        canDraw={game.canDraw}
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
        canDraw={game.canDraw}
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

      {__DEV__ && (
        <View style={styles.debugBadge} pointerEvents="none">
          <Text style={styles.debugText}>role: {playerRole}</Text>
          <Text style={styles.debugText}>current: {game.currentPlayer ?? "null"}</Text>
          <Text style={styles.debugText}>turnState: {game.turnState}</Text>
          <Text style={styles.debugText}>flow: {flowState}</Text>
          <Text style={styles.debugText}>canDraw: {String(game.canDraw)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  debugBadge: {
    position: "absolute",
    top: 96,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  debugText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
});
