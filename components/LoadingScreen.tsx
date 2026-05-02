import React, { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";

const SPLASH_ICON = require("@/assets/images/splash-icon.png");
const DOT_COUNT = 3;
const DOT_STAGGER = 300;
const DOT_DURATION = 600;
const BAR_WIDTH = 200;
const BAR_FILL_WIDTH = 80;
const BAR_DURATION = 1200;

function AnimatedDot({ index }: { index: number }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      index * DOT_STAGGER,
      withRepeat(
        withSequence(
          withTiming(1, { duration: DOT_DURATION, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.15, { duration: DOT_DURATION, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, [index, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.Text style={[styles.dot, style]}>.</Animated.Text>;
}

export function LoadingScreen() {
  const iconOpacity = useSharedValue(0);
  const iconTranslateY = useSharedValue(30);
  const textOpacity = useSharedValue(0);
  const barTranslateX = useSharedValue(-BAR_FILL_WIDTH);

  useEffect(() => {
    iconOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.ease) });
    iconTranslateY.value = withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) });

    textOpacity.value = withDelay(
      400,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) })
    );

    barTranslateX.value = withDelay(
      600,
      withRepeat(
        withTiming(BAR_WIDTH, { duration: BAR_DURATION, easing: Easing.inOut(Easing.ease) }),
        -1,
        false
      )
    );
  }, [iconOpacity, iconTranslateY, textOpacity, barTranslateX]);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ translateY: iconTranslateY.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const barFillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: barTranslateX.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={iconStyle}>
        <Image source={SPLASH_ICON} style={styles.icon} resizeMode="contain" />
      </Animated.View>

      <Animated.View style={[styles.textRow, textStyle]}>
        <Animated.Text style={styles.loadingText}>Loading</Animated.Text>
        {Array.from({ length: DOT_COUNT }).map((_, i) => (
          <AnimatedDot key={i} index={i} />
        ))}
      </Animated.View>

      <Animated.View style={[styles.barTrack, textStyle]}>
        <Animated.View style={[styles.barFill, barFillStyle]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 120,
    height: 120,
    marginBottom: 32,
  },
  textRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 20,
    color: "#a29bfe",
    fontWeight: "600",
    letterSpacing: 1,
  },
  dot: {
    fontSize: 20,
    color: "#a29bfe",
    fontWeight: "600",
  },
  barTrack: {
    width: BAR_WIDTH,
    height: 4,
    backgroundColor: "rgba(162, 155, 254, 0.15)",
    borderRadius: 2,
    overflow: "hidden",
  },
  barFill: {
    width: BAR_FILL_WIDTH,
    height: 4,
    backgroundColor: "#a29bfe",
    borderRadius: 2,
  },
});
