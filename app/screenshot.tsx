import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import React, { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import BaseModal from "@/components/BaseModal";
import ColorPicker from "@/components/ColorPicker";
import DrawingCanvas, { type DrawingCanvasRef, type Stroke } from "@/components/DrawingCanvas";
import DrawingThumbnail from "@/components/DrawingThumbnail";
import FriendsMatchModal from "@/components/FriendsMatchModal";
import GalleryCard from "@/components/GalleryCard";
import GameCanvasSection from "@/components/GameCanvasSection";
import GameHeader from "@/components/GameHeader";
import GameStatusOverlays from "@/components/GameStatusOverlays";
import GameToolbar from "@/components/GameToolbar";
import GameTurnIndicator from "@/components/GameTurnIndicator";
import HomeHero from "@/components/HomeHero";
import HomePrimaryActions from "@/components/HomePrimaryActions";
import MatchmakingModal from "@/components/MatchmakingModal";
import ResultsActionButtons from "@/components/ResultsActionButtons";
import ResultsPlayersInfo from "@/components/ResultsPlayersInfo";
import ResultsRoundGallery from "@/components/ResultsRoundGallery";
import ResultsStatsCard from "@/components/ResultsStatsCard";
import { useScreenPadding } from "@/hooks/useScreenPadding";
import { useThemeColors, type ThemeColors } from "@/hooks/useThemeColors";

const NOOP = () => undefined;
const FROZEN_STYLE = { opacity: 1, transform: [{ scale: 1 }] };

function makeStroke(id: string, color: string, width: number, path: string): Stroke {
  return { id, color, strokeWidth: width, path };
}

const HOUSE_STROKES: Stroke[] = [
  makeStroke("h1", "#1a1a2e", 8, "M60,260 L60,160 L200,90 L340,160 L340,260 Z"),
  makeStroke("h2", "#FF6B6B", 8, "M40,165 L200,75 L360,165"),
  makeStroke("h3", "#1DD1A1", 6, "M150,260 L150,200 L210,200 L210,260"),
  makeStroke("h4", "#48DBFB", 6, "M80,200 L120,200 L120,235 L80,235 Z"),
  makeStroke("h5", "#48DBFB", 6, "M260,200 L300,200 L300,235 L260,235 Z"),
  makeStroke("h6", "#FECA57", 10, "M310,40 m-22,0 a22,22 0 1,0 44,0 a22,22 0 1,0 -44,0"),
  makeStroke("h7", "#FECA57", 4, "M310,8 L310,18 M340,18 L334,26 M280,18 L286,26 M268,40 L278,40 M352,40 L342,40"),
  makeStroke("h8", "#5F27CD", 4, "M40,275 Q200,260 360,275"),
];

const CAT_STROKES: Stroke[] = [
  makeStroke("c1", "#5F27CD", 9, "M120,180 Q90,120 130,90 Q170,70 200,100 Q230,70 270,90 Q310,120 280,180 Q300,240 240,260 Q200,275 160,260 Q100,240 120,180 Z"),
  makeStroke("c2", "#5F27CD", 6, "M130,90 L115,55 L155,80"),
  makeStroke("c3", "#5F27CD", 6, "M270,90 L285,55 L245,80"),
  makeStroke("c4", "#FECA57", 5, "M170,160 m-10,0 a10,10 0 1,0 20,0 a10,10 0 1,0 -20,0"),
  makeStroke("c5", "#FECA57", 5, "M230,160 m-10,0 a10,10 0 1,0 20,0 a10,10 0 1,0 -20,0"),
  makeStroke("c6", "#1a1a2e", 4, "M170,160 m-3,0 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0"),
  makeStroke("c7", "#1a1a2e", 4, "M230,160 m-3,0 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0"),
  makeStroke("c8", "#FD79A8", 5, "M195,195 L205,195 L200,205 Z"),
  makeStroke("c9", "#1a1a2e", 3, "M165,210 Q200,225 235,210"),
  makeStroke("c10", "#1a1a2e", 2, "M150,205 L120,200 M150,215 L120,220 M250,205 L280,200 M250,215 L280,220"),
];

const ROCKET_STROKES: Stroke[] = [
  makeStroke("r1", "#FF6B6B", 10, "M200,40 Q160,80 160,180 L160,240 L240,240 L240,180 Q240,80 200,40 Z"),
  makeStroke("r2", "#48DBFB", 6, "M200,130 m-18,0 a18,18 0 1,0 36,0 a18,18 0 1,0 -36,0"),
  makeStroke("r3", "#48DBFB", 4, "M200,130 m-10,0 a10,10 0 1,0 20,0 a10,10 0 1,0 -20,0"),
  makeStroke("r4", "#FECA57", 8, "M160,220 L120,260 L160,250 Z"),
  makeStroke("r5", "#FECA57", 8, "M240,220 L280,260 L240,250 Z"),
  makeStroke("r6", "#FF8E53", 9, "M180,250 Q200,310 220,250"),
  makeStroke("r7", "#FECA57", 6, "M190,290 L210,290"),
  makeStroke("r8", "#A29BFE", 4, "M70,80 L80,80 M80,75 L80,85 M310,60 L320,60 M315,55 L315,65 M90,180 L100,180 M95,175 L95,185"),
];

const FLOWER_STROKES: Stroke[] = [
  makeStroke("f1", "#1DD1A1", 6, "M200,290 L200,180"),
  makeStroke("f2", "#1DD1A1", 5, "M200,230 Q170,210 150,230"),
  makeStroke("f3", "#1DD1A1", 5, "M200,250 Q230,230 250,250"),
  makeStroke("f4", "#FD79A8", 12, "M200,140 m-30,0 a30,30 0 1,0 60,0 a30,30 0 1,0 -60,0"),
  makeStroke("f5", "#FD79A8", 12, "M150,170 m-30,0 a30,30 0 1,0 60,0 a30,30 0 1,0 -60,0"),
  makeStroke("f6", "#FD79A8", 12, "M250,170 m-30,0 a30,30 0 1,0 60,0 a30,30 0 1,0 -60,0"),
  makeStroke("f7", "#FD79A8", 12, "M170,210 m-25,0 a25,25 0 1,0 50,0 a25,25 0 1,0 -50,0"),
  makeStroke("f8", "#FD79A8", 12, "M230,210 m-25,0 a25,25 0 1,0 50,0 a25,25 0 1,0 -50,0"),
  makeStroke("f9", "#FECA57", 14, "M200,180 m-15,0 a15,15 0 1,0 30,0 a15,15 0 1,0 -30,0"),
];

const MOUNTAIN_STROKES: Stroke[] = [
  makeStroke("m1", "#5F27CD", 7, "M20,260 L120,140 L180,200 L260,100 L380,260 Z"),
  makeStroke("m2", "#FFFFFF", 5, "M105,155 L120,140 L135,155 L125,165 Z"),
  makeStroke("m3", "#FFFFFF", 5, "M250,115 L260,100 L275,120 L262,128 Z"),
  makeStroke("m4", "#FECA57", 12, "M310,60 m-18,0 a18,18 0 1,0 36,0 a18,18 0 1,0 -36,0"),
  makeStroke("m5", "#48DBFB", 4, "M30,220 Q60,200 90,220"),
  makeStroke("m6", "#1DD1A1", 4, "M30,260 Q200,275 380,260"),
];

function FullscreenWrapper({ colors, isDark, children }: { colors: ThemeColors; isDark: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDark ? ["#1a1a2e", "#2d2d4a", "#1a1a2e"] : ["#f8f9ff", "#e8e9ff", "#f8f9ff"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {children}
    </View>
  );
}

function HomeView({ colors, isDark }: { colors: ThemeColors; isDark: boolean }) {
  const insets = useSafeAreaInsets();
  const { topPadding, bottomPadding } = useScreenPadding(insets);
  return (
    <FullscreenWrapper colors={colors} isDark={isDark}>
      <View style={[styles.homeContent, { paddingTop: topPadding + 40, paddingBottom: bottomPadding + 20 }]}>
        <HomeHero colors={colors} />
        <HomePrimaryActions
          colors={colors}
          pulseStyle={FROZEN_STYLE}
          buttonAnimatedStyle={FROZEN_STYLE}
          isSearching={false}
          onOpenGallery={NOOP}
          onOpenFriends={NOOP}
          onFindMatch={NOOP}
          onPressIn={NOOP}
          onPressOut={NOOP}
        />
      </View>
    </FullscreenWrapper>
  );
}

function MatchmakingView({ colors, isDark }: { colors: ThemeColors; isDark: boolean }) {
  return (
    <>
      <HomeView colors={colors} isDark={isDark} />
      <MatchmakingModal
        visible
        colors={colors}
        flowState="queueing"
        backoffCountdown={0}
        queuePosition={2}
        searchPulseStyle={FROZEN_STYLE}
        onCancel={NOOP}
        onRetry={NOOP}
      />
    </>
  );
}

function FriendsView({ colors, isDark }: { colors: ThemeColors; isDark: boolean }) {
  return (
    <>
      <HomeView colors={colors} isDark={isDark} />
      <FriendsMatchModal
        visible
        colors={colors}
        status="waiting_for_friend"
        roomCode="DUEL42"
        roomError={null}
        roomInput=""
        onRoomInputChange={NOOP}
        onCreateRoom={NOOP}
        onJoinRoom={NOOP}
        onClose={NOOP}
      />
    </>
  );
}

function GameSkeleton({
  colors,
  isDark,
  strokes,
  opponentStrokes = [],
  isMyTurn = true,
  turnDisplay,
  strokeColor,
  isEraser = false,
  formattedTime = "0:42",
  roundDisplay = "Round 2 of 3",
}: {
  colors: ThemeColors;
  isDark: boolean;
  strokes: Stroke[];
  opponentStrokes?: Stroke[];
  isMyTurn?: boolean;
  turnDisplay: string;
  strokeColor: string;
  isEraser?: boolean;
  formattedTime?: string;
  roundDisplay?: string;
}) {
  const insets = useSafeAreaInsets();
  const { topPadding, bottomPadding } = useScreenPadding(insets);
  const canvasRef = useRef<DrawingCanvasRef>(null);
  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background }]}>
      <GameHeader
        colors={colors}
        topPadding={topPadding}
        onBack={NOOP}
        timerAnimatedStyle={FROZEN_STYLE}
        timerColor={colors.timerActive}
        formattedTime={formattedTime}
        roundDisplay={roundDisplay}
      />
      <GameTurnIndicator
        colors={colors}
        currentPlayer={isMyTurn ? "player1" : "player2"}
        turnDisplay={turnDisplay}
        isMyTurn={isMyTurn}
        opponentName="Alex"
      />
      <GameCanvasSection
        canvasRef={canvasRef}
        isMyTurn={isMyTurn}
        canDraw={isMyTurn}
        isSubmitting={false}
        activeColor={strokeColor}
        strokeWidth={6}
        strokes={isMyTurn ? strokes : []}
        opponentStrokes={opponentStrokes}
        backgroundStrokes={[]}
        onStrokesChange={NOOP}
        onStrokeComplete={NOOP}
      />
      <GameToolbar
        colors={colors}
        bottomPadding={bottomPadding}
        canDraw={isMyTurn}
        isSubmitting={false}
        isEraser={isEraser}
        strokeColor={strokeColor}
        strokeCount={isMyTurn ? strokes.length : 0}
        onBrushPress={NOOP}
        onColorPress={NOOP}
        onEraserToggle={NOOP}
        onUndo={NOOP}
        onClear={NOOP}
        onSubmit={NOOP}
      />
    </View>
  );
}

function GetReadyView({ colors, isDark }: { colors: ThemeColors; isDark: boolean }) {
  return (
    <>
      <GameSkeleton
        colors={colors}
        isDark={isDark}
        strokes={[]}
        turnDisplay="Get ready..."
        strokeColor="#1a1a2e"
        formattedTime="1:00"
        roundDisplay="Round 1 of 3"
      />
      <GameStatusOverlays
        colors={colors}
        showGetReady
        getReadyCountdown={3}
        getReadyAnimatedStyle={FROZEN_STYLE}
        isRetrying={false}
        showSubmitFailed={false}
        showSyncFatal={false}
        onRetrySubmit={NOOP}
        onExitGame={NOOP}
        onReturnHome={NOOP}
      />
    </>
  );
}

function YourTurnView({ colors, isDark }: { colors: ThemeColors; isDark: boolean }) {
  return (
    <GameSkeleton
      colors={colors}
      isDark={isDark}
      strokes={HOUSE_STROKES}
      turnDisplay="Your Turn"
      strokeColor="#FF6B6B"
      formattedTime="0:38"
      roundDisplay="Round 1 of 3"
    />
  );
}

function ColorPickerView({ colors, isDark }: { colors: ThemeColors; isDark: boolean }) {
  return (
    <>
      <GameSkeleton
        colors={colors}
        isDark={isDark}
        strokes={ROCKET_STROKES}
        turnDisplay="Your Turn"
        strokeColor="#FF6B6B"
        formattedTime="0:24"
        roundDisplay="Round 2 of 3"
      />
      <ColorPicker selectedColor="#FF6B6B" onColorChange={NOOP} visible onClose={NOOP} />
    </>
  );
}

function OpponentView({ colors, isDark }: { colors: ThemeColors; isDark: boolean }) {
  return (
    <GameSkeleton
      colors={colors}
      isDark={isDark}
      strokes={[]}
      opponentStrokes={CAT_STROKES}
      isMyTurn={false}
      turnDisplay="Opponent's Turn"
      strokeColor="#1a1a2e"
      formattedTime="0:31"
      roundDisplay="Round 2 of 3"
    />
  );
}

function ResultsView({ colors, isDark }: { colors: ThemeColors; isDark: boolean }) {
  const insets = useSafeAreaInsets();
  const { topPadding, bottomPadding } = useScreenPadding(insets);
  const drawings = [
    { round: 1, playerRole: "player1" as const, strokes: HOUSE_STROKES },
    { round: 1, playerRole: "player2" as const, strokes: CAT_STROKES },
    { round: 2, playerRole: "player1" as const, strokes: ROCKET_STROKES },
    { round: 2, playerRole: "player2" as const, strokes: FLOWER_STROKES },
    { round: 3, playerRole: "player1" as const, strokes: MOUNTAIN_STROKES },
    { round: 3, playerRole: "player2" as const, strokes: HOUSE_STROKES },
  ];
  return (
    <FullscreenWrapper colors={colors} isDark={isDark}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.resultsContent, { paddingTop: topPadding + 20, paddingBottom: bottomPadding + 20 }]}
      >
        <View style={styles.resultsHeader}>
          <Text style={[styles.resultsTitle, { color: colors.text }]}>Game Complete!</Text>
          <Text style={[styles.resultsSubtitle, { color: colors.textSecondary }]}>Great match!</Text>
        </View>
        <ResultsStatsCard colors={colors} cardStyle={FROZEN_STYLE} />
        <ResultsRoundGallery
          colors={colors}
          roundNumbers={[1, 2, 3]}
          drawings={drawings}
          playerRole="player1"
          opponentName="Alex"
        />
        <ResultsPlayersInfo colors={colors} opponentName="Alex" />
        <ResultsActionButtons
          colors={colors}
          drawingsLength={drawings.length}
          isSaving={false}
          isSaved={false}
          onSaveToGallery={NOOP}
          onPlayAgain={NOOP}
          onHome={NOOP}
          onViewGallery={NOOP}
        />
      </ScrollView>
    </FullscreenWrapper>
  );
}

function GalleryView({ colors, isDark }: { colors: ThemeColors; isDark: boolean }) {
  const insets = useSafeAreaInsets();
  const { topPadding, bottomPadding } = useScreenPadding(insets);
  const items = [
    { id: "g1", playerName: "You", opponentName: "Alex", strokes: HOUSE_STROKES, roundCount: 3, createdAt: "2025-04-12T18:30:00Z" },
    { id: "g2", playerName: "You", opponentName: "Sam", strokes: CAT_STROKES, roundCount: 3, createdAt: "2025-04-09T20:14:00Z" },
    { id: "g3", playerName: "You", opponentName: "Riley", strokes: ROCKET_STROKES, roundCount: 3, createdAt: "2025-04-04T11:02:00Z" },
    { id: "g4", playerName: "You", opponentName: "Jordan", strokes: FLOWER_STROKES, roundCount: 3, createdAt: "2025-03-28T09:45:00Z" },
    { id: "g5", playerName: "You", opponentName: "Casey", strokes: MOUNTAIN_STROKES, roundCount: 3, createdAt: "2025-03-21T15:21:00Z" },
  ];
  const fmt = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background }]}>
      <View style={[styles.galleryHeader, { paddingTop: topPadding + 8 }]}>
        <Pressable style={[styles.backButton, { backgroundColor: colors.card }]}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.galleryTitle, { color: colors.text }]}>Gallery</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={[styles.galleryList, { paddingBottom: bottomPadding + 20 }]}>
        {items.map((it) => (
          <GalleryCard key={it.id} drawing={it} colors={colors} formattedDate={fmt(it.createdAt)} onDelete={NOOP} />
        ))}
      </ScrollView>
    </View>
  );
}

function DetailView({ colors, isDark }: { colors: ThemeColors; isDark: boolean }) {
  const insets = useSafeAreaInsets();
  const { topPadding, bottomPadding } = useScreenPadding(insets);
  return (
    <FullscreenWrapper colors={colors} isDark={isDark}>
      <View style={[styles.detailContainer, { paddingTop: topPadding + 16, paddingBottom: bottomPadding + 16 }]}>
        <View style={styles.galleryHeader}>
          <Pressable style={[styles.backButton, { backgroundColor: colors.card }]}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.galleryTitle, { color: colors.text }]}>Drawing</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.detailThumb}>
          <DrawingThumbnail strokes={ROCKET_STROKES} size={360} borderRadius={24} borderWidth={2} />
        </View>
        <View style={[styles.detailMeta, { backgroundColor: colors.card }]}>
          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={20} color={colors.tint} />
            <Text style={[styles.detailLabel, { color: colors.text }]}>vs Alex</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={20} color={colors.accent} />
            <Text style={[styles.detailLabel, { color: colors.text }]}>April 12, 2025</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="layers-outline" size={20} color={colors.accentSecondary} />
            <Text style={[styles.detailLabel, { color: colors.text }]}>3 rounds</Text>
          </View>
        </View>
      </View>
    </FullscreenWrapper>
  );
}

const VIEWS: Record<string, React.ComponentType<{ colors: ThemeColors; isDark: boolean }>> = {
  home: HomeView,
  matchmaking: MatchmakingView,
  friends: FriendsView,
  "get-ready": GetReadyView,
  "your-turn": YourTurnView,
  "color-picker": ColorPickerView,
  opponent: OpponentView,
  results: ResultsView,
  gallery: GalleryView,
  detail: DetailView,
};

export default function ScreenshotScreen() {
  const params = useLocalSearchParams<{ state?: string }>();
  const stateKey = (Array.isArray(params.state) ? params.state[0] : params.state) ?? "home";
  const { isDark, colors } = useThemeColors();
  const View = VIEWS[stateKey] ?? HomeView;
  return <View colors={colors} isDark={isDark} />;
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  flex: { flex: 1 },
  homeContent: { flex: 1, paddingHorizontal: 24 },
  resultsContent: { paddingHorizontal: 24 },
  resultsHeader: { alignItems: "center", gap: 8, marginBottom: 24 },
  resultsTitle: { fontSize: 32, fontFamily: "Inter_700Bold" },
  resultsSubtitle: { fontSize: 16, fontFamily: "Inter_400Regular" },
  galleryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  galleryTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  galleryList: { paddingHorizontal: 16, paddingTop: 8, gap: 16 },
  detailContainer: { flex: 1, paddingHorizontal: 24, gap: 24 },
  detailThumb: { alignItems: "center", marginTop: 20 },
  detailMeta: { borderRadius: 20, padding: 20, gap: 14, marginTop: 12 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  detailLabel: { fontSize: 16, fontFamily: "Inter_500Medium" },
});
