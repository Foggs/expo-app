import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState } from "react-native";
import {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const SHINE_DURATION = 900;
const SHINE_PERIOD = 6000;

/** Home-only sheen; it pauses when the screen is inactive or motion is reduced. */
export function useHomeShine(isFocused: boolean) {
  const [reduceMotion, setReduceMotion] = useState(true);
  const [isForeground, setIsForeground] = useState(AppState.currentState === "active");
  const motionSettingChanged = useRef(false);
  const randomProgress = useSharedValue(0);
  const friendsProgress = useSharedValue(0);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted && !motionSettingChanged.current) setReduceMotion(enabled);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      motionSettingChanged.current = true;
      setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setIsForeground(state === "active");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const canAnimate = isFocused && isForeground && !reduceMotion;
    if (!canAnimate) {
      cancelAnimation(randomProgress);
      cancelAnimation(friendsProgress);
      randomProgress.value = 0;
      friendsProgress.value = 0;
      return;
    }

    const makeLoop = (delay: number) =>
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: SHINE_DURATION, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 1 }),
            withTiming(0, { duration: SHINE_PERIOD - SHINE_DURATION - 1 }),
          ),
          -1,
          false,
        ),
      );

    randomProgress.value = makeLoop(0);
    friendsProgress.value = makeLoop(3000);
    return () => {
      cancelAnimation(randomProgress);
      cancelAnimation(friendsProgress);
    };
  }, [isFocused, isForeground, reduceMotion, randomProgress, friendsProgress]);

  const randomShineStyle = useAnimatedStyle(() => ({
    opacity:
      randomProgress.value < 0.08
        ? (randomProgress.value / 0.08) * 0.28
        : randomProgress.value > 0.9
          ? ((1 - randomProgress.value) / 0.1) * 0.28
          : 0.28,
    transform: [{ translateX: interpolate(randomProgress.value, [0, 1], [-150, 390]) }, { rotate: "22deg" }],
  }));

  const friendsShineStyle = useAnimatedStyle(() => ({
    opacity:
      friendsProgress.value < 0.08
        ? (friendsProgress.value / 0.08) * 0.28
        : friendsProgress.value > 0.9
          ? ((1 - friendsProgress.value) / 0.1) * 0.28
          : 0.28,
    transform: [{ translateX: interpolate(friendsProgress.value, [0, 1], [-150, 390]) }, { rotate: "22deg" }],
  }));

  return { randomShineStyle, friendsShineStyle, canAnimate: isFocused && isForeground && !reduceMotion };
}
