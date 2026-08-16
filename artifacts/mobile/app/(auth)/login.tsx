import {
  makeRedirectUri,
  ResponseType,
  useAuthRequest,
} from "expo-auth-session";
import * as Haptics from "expo-haptics";
import {
  coolDownAsync,
  maybeCompleteAuthSession,
  warmUpAsync,
} from "expo-web-browser";
import { memo, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

const NATIVE_DRIVER = Platform.OS !== "web";

import { API_URL } from "@/constants/Config";
import { useAuth } from "@/providers/AuthProvider";
import axios from "axios";

maybeCompleteAuthSession();

function LoginScreen() {
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const handledRef = useRef<string | null>(null);

  // Entry animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  // Button press animation
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const redirectUri = makeRedirectUri({ scheme: "mobile" });

  // Safe fallback endpoint so the hook doesn't cause a relative-URL navigation
  const safeEndpoint = API_URL
    ? `${API_URL}/auth/login`
    : "https://localhost/auth/login";

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: "dummy",
      redirectUri,
      responseType: ResponseType.Code,
    },
    { authorizationEndpoint: safeEndpoint },
  );

  useEffect(() => {
    // Entrance animation on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: NATIVE_DRIVER,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 55,
        friction: 9,
        useNativeDriver: NATIVE_DRIVER,
      }),
    ]).start();

    if (Platform.OS !== "web") warmUpAsync();
    return () => {
      if (Platform.OS !== "web") coolDownAsync();
    };
  }, []);

  useEffect(() => {
    if (response?.type !== "success") return;
    if (!response?.params?.code) {
      Alert.alert("Login failed", "Missing authorization code.");
      return;
    }
    if (handledRef.current === response?.params?.code) return;
    handledRef.current = response?.params?.code;

    const completeLogin = async () => {
      try {
        setSubmitting(true);
        const res = await axios.post(`${API_URL}/auth/callback`, {
          code: response?.params?.code,
          state: response?.params?.state,
        });
        const token = res.data?.token ?? res.data?.access_token;
        if (!token || !res.data.expires_in) {
          Alert.alert("Login failed", "Please try again");
          handledRef.current = null;
          setSubmitting(false);
          return;
        }
        await login(token, res.data.expires_in, res.data.claims);
        setSubmitting(false);
      } catch {
        handledRef.current = null;
        setSubmitting(false);
        Alert.alert("Login failed", "Could not reach the server. Please try again.");
      }
    };

    completeLogin();
  }, [response?.params?.code, response?.params?.state, response?.type, login]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: NATIVE_DRIVER,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: NATIVE_DRIVER,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const promptLogin = async () => {
    if (!API_URL) {
      Alert.alert(
        "Not Configured",
        "Please configure server url settings",
      );
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await promptAsync();
  };

  if (submitting) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#EFF6FF",
        }}
      >
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ marginTop: 16, color: "#6B7280", fontSize: 15 }}>
          Logging you in…
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
        backgroundColor: "#EFF6FF",
      }}
    >
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          width: "100%",
          maxWidth: 400,
          backgroundColor: "#FFFFFF",
          borderRadius: 24,
          paddingVertical: 36,
          paddingHorizontal: 32,
          alignItems: "center",
          shadowColor: "#1E3A8A",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.1,
          shadowRadius: 24,
          elevation: 8,
        }}
      >
        {/* Logo */}
        <Image
          source={require("../../assets/images/logo.jpg")}
          style={{ width: 88, height: 88, borderRadius: 20, marginBottom: 24 }}
          resizeMode="contain"
        />

        {/* Title */}
        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: "#111827",
            marginBottom: 8,
            textAlign: "center",
            letterSpacing: -0.3,
          }}
        >
          Bombeke PoleVision AI
        </Text>

        <Text
          style={{
            fontSize: 13,
            color: "#6B7280",
            marginBottom: 32,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          AI Agents for Disease Surveillance, Pole Defects, Sanitation, Roads &
          Traffic Analytics
        </Text>

        {/* Animated login button */}
        <Animated.View
          style={{ width: "100%", transform: [{ scale: scaleAnim }] }}
        >
          <Pressable
            onPress={promptLogin}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={({ pressed }) => ({
              backgroundColor: pressed ? "#1D4ED8" : "#2563EB",
              paddingVertical: 15,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
            })}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontWeight: "700",
                fontSize: 16,
                letterSpacing: 0.2,
              }}
            >
              Sign In
            </Text>
          </Pressable>
        </Animated.View>

        <Text
          style={{
            color: "#9CA3AF",
            fontSize: 11,
            marginTop: 20,
            textAlign: "center",
            lineHeight: 17,
          }}
        >
          By signing in you agree to our Terms of Service & Privacy Policy
        </Text>
      </Animated.View>
    </View>
  );
}

export default memo(LoginScreen);
