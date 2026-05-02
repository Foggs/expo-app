import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/hooks/useThemeColors";

const ANIM_DURATION = 280;
const SLIDE_OFFSET = 30;
const EASING_IN = Easing.out(Easing.cubic);
const EASING_OUT = Easing.in(Easing.cubic);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface BaseModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  closeLabel?: string;
  dismissOnOverlay?: boolean;
  maxWidth?: number;
  statusBarTranslucent?: boolean;
  cardStyle?: StyleProp<ViewStyle>;
  overlayStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export default function BaseModal({
  visible,
  onClose,
  title,
  closeLabel = "Close",
  dismissOnOverlay = true,
  maxWidth = 320,
  statusBarTranslucent,
  cardStyle,
  overlayStyle,
  children,
}: BaseModalProps) {
  const { colors } = useThemeColors();
  const [modalVisible, setModalVisible] = useState(visible);

  const overlayOpacity = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(SLIDE_OFFSET);

  const hideModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      overlayOpacity.value = withTiming(1, { duration: ANIM_DURATION, easing: EASING_IN });
      cardOpacity.value = withTiming(1, { duration: ANIM_DURATION, easing: EASING_IN });
      cardTranslateY.value = withTiming(0, { duration: ANIM_DURATION, easing: EASING_IN });
    } else if (modalVisible) {
      overlayOpacity.value = withTiming(0, { duration: ANIM_DURATION, easing: EASING_OUT });
      cardOpacity.value = withTiming(0, { duration: ANIM_DURATION, easing: EASING_OUT });
      cardTranslateY.value = withTiming(SLIDE_OFFSET, { duration: ANIM_DURATION, easing: EASING_OUT }, () => {
        runOnJS(hideModal)();
      });
    }
  }, [visible, modalVisible, overlayOpacity, cardOpacity, cardTranslateY, hideModal]);

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const animatedCardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={statusBarTranslucent}
    >
      <AnimatedPressable
        style={[styles.overlay, overlayStyle, animatedOverlayStyle]}
        onPress={dismissOnOverlay ? onClose : undefined}
      >
        <Animated.View
          style={[
            styles.card,
            styles.shadow,
            { backgroundColor: colors.card, maxWidth },
            cardStyle,
            animatedCardStyle,
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            {title && (
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>
                  {title}
                </Text>
                <Pressable
                  onPress={onClose}
                  style={styles.closeButton}
                  accessibilityRole="button"
                  accessibilityLabel={closeLabel}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
            )}
            {children}
          </Pressable>
        </Animated.View>
      </AnimatedPressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    borderRadius: 24,
    padding: 24,
  },
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
    }),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
});
