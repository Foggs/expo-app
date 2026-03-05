import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { calculateStrokeBounds } from "@/lib/strokeBounds";
import { useThemeColors } from "@/hooks/useThemeColors";

export type StrokeLike = {
  id: string;
  path: string;
  color: string;
  strokeWidth: number;
};

interface DrawingThumbnailProps {
  strokes: StrokeLike[];
  size?: number;
  borderRadius?: number;
  borderWidth?: number;
}

export default function DrawingThumbnail({
  strokes,
  size = 120,
  borderRadius = 12,
  borderWidth = 1,
}: DrawingThumbnailProps) {
  const { colors } = useThemeColors();
  const viewBox = calculateStrokeBounds(strokes);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          borderWidth,
          borderColor: colors.border,
        },
      ]}
    >
      <Svg
        width={size}
        height={size}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
      >
        {strokes.map((stroke) => (
          <Path
            key={stroke.id}
            d={stroke.path}
            stroke={stroke.color}
            strokeWidth={stroke.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
});
