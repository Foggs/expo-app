import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import FriendInviteBanner from "@/components/FriendInviteBanner";
import { LoadingScreen } from "@/components/LoadingScreen";
import { queryClient } from "@/lib/query-client";
import { PlayerIdentityProvider } from "@/contexts/PlayerIdentityContext";
import { SocialProvider } from "@/contexts/SocialContext";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { PreferencesProvider, usePreferences } from "@/contexts/PreferencesContext";
import { useThemeColors } from "@/hooks/useThemeColors";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { colors } = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="game"
        options={{
          gestureEnabled: false,
          animation: "fade",
        }}
      />
      <Stack.Screen
        name="results"
        options={{
          gestureEnabled: false,
          animation: "slide_from_bottom",
          headerBackVisible: false,
        }}
      />
      <Stack.Screen name="friend-list" />
      <Stack.Screen name="settings" />
      <Stack.Screen
        name="gallery"
        options={{
          animation: "slide_from_right",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <PreferencesProvider>
      <RootContent />
    </PreferencesProvider>
  );
}

function RootContent() {
  const { loaded: preferencesLoaded } = usePreferences();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    const globalWindow =
      typeof window !== "undefined" ? window : null;
    if (
      !globalWindow ||
      typeof globalWindow.addEventListener !== "function"
    ) {
      return;
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("[UnhandledRejection]", event.reason);
    };

    globalWindow.addEventListener(
      "unhandledrejection",
      handleUnhandledRejection,
    );

    return () => {
      globalWindow.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  }, []);

  if (!fontsLoaded || !preferencesLoaded) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <PlayerIdentityProvider>
              <WebSocketProvider>
                <SocialProvider>
                  <RootLayoutNav />
                  <FriendInviteBanner />
                </SocialProvider>
              </WebSocketProvider>
            </PlayerIdentityProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
