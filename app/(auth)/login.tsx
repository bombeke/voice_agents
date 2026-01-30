import {
  makeRedirectUri,
  ResponseType,
  useAuthRequest,
} from "expo-auth-session";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";

import { API_URL } from "@/constants/Config";
import { useAuth } from "@/providers/AuthProvider";
import axios from "axios";
import {
  coolDownAsync,
  maybeCompleteAuthSession,
  warmUpAsync,
} from "expo-web-browser";

maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { login, redirectAfterLogin, setRedirectAfterLogin } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const handledRef = useRef(false);
  /*const { data } = useQuery({
    queryKey: ["state"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/auth/state`);
      return res.data;
    },
  });
  */
  const redirectUri = makeRedirectUri({
    scheme: "voiceagents",
    //path: "callback",
  });

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: "dummy",
      redirectUri,
      responseType: ResponseType.Code,
      //state: data?.state
    },
    {
      authorizationEndpoint: `${API_URL}/auth/login`,
    },
  );
  const promptLogin = async (e: any) => {
    return await promptAsync();
  };
  useEffect(() => {
    warmUpAsync();

    return () => {
      coolDownAsync();
    };
  }, []);

  useEffect(() => {
    if (response?.type !== "success") return;
    if (handledRef.current) return;

    handledRef.current = true;

    const completeLogin = async () => {
      try {
        setSubmitting(true);

        const { code, state } = response.params;
        //const { publicKey } = await getDeviceKeypair();
        const res = await axios.post(`${API_URL}/auth/callback`, {
          code,
          state,
          //device_public_key: publicKey,
        });
        const token = res.data.token || res.data.access_token;
        if (!token) {
          Alert.alert("Login failed", "Please try again");
          return;
        }

        await login(token, res.data.expires_at);
      } catch (e) {
        handledRef.current = false;
        setSubmitting(false);
        Alert.alert("Login failed", "Please try again.");
      }
    };

    completeLogin();
  }, [response?.type]);

  if (submitting) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-gray-600 text-base">Logging you in...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center items-center bg-gray-50 px-6">
      {/* Card */}
      <View className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8 items-center">
        {/* Logo */}
        <Image
          source={require("../../assets/images/logo.jpg")}
          className="w-24 h-24 mb-6"
          resizeMode="contain"
        />

        {/* Title */}
        <Text className="text-2xl font-bold text-gray-800 mb-2 text-center">
          Bombeke PoleVision AI Toolkit
        </Text>

        <Text className="text-center text-gray-500 mb-6">
          AI Agents for Disease Surveillance, Pole Defects, Sanitation, Roads &
          Traffic Analytics.
        </Text>

        {/* Login Button */}
        <Pressable
          className="w-full bg-blue-600 py-3 rounded-xl items-center justify-center"
          onPress={promptLogin}
          //disabled={!request}
        >
          <Text className="text-white font-semibold text-lg">Login</Text>
        </Pressable>

        {/* Optional Terms */}
        <Text className="text-gray-400 text-sm mt-4 text-center">
          By logging in you agree to our Terms of Service & Privacy Policy.
        </Text>
      </View>
    </View>
  );
}
