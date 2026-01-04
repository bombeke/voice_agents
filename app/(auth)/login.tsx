import { makeRedirectUri, ResponseType, useAuthRequest } from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";

import { API_URL } from "@/constants/Config";
import { useAuth } from "@/providers/AuthProvider";
import { axiosClient } from "@/services/Api";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { login, redirectAfterLogin, setRedirectAfterLogin } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const redirectUri = makeRedirectUri({
    scheme: "voiceagents",
    //path: "callback",
  });

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: "dummy",
      redirectUri,
      responseType: ResponseType.Code,
      state: undefined
    },
    {
      authorizationEndpoint: `${API_URL}/auth/login`,
    }
  );
  const promptLogin =async (e: any)=>{
    return await promptAsync();
  }
  console.log("Request:",request);
  console.log("Response:",response);

  useEffect(() => {
    const completeLogin = async () => {
      if (response?.type !== "success") return;

      setSubmitting(true);
      const { code, state } = response.params;
      //const { publicKey } = await getDeviceKeypair();
      const res = await axiosClient.post("/auth/callback", {
        code,
        state,
        //device_public_key: publicKey,
      });

      await login(res.data.token, res.data.expires_at);

      const target = redirectAfterLogin ?? "/(tabs)";
      setRedirectAfterLogin(undefined);

      router.replace(target as any);
    };

    completeLogin();
  }, [response, redirectAfterLogin]);

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
      <View className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 items-center">
        {/* Logo */}
        <Image
          source={require('../../assets/images/logo.jpg')}
          className="w-24 h-24 mb-6"
          resizeMode="contain"
        />

        {/* Title */}
        <Text className="text-2xl font-bold text-gray-800 mb-2 text-center">
          Bombeke PoleVision AI Toolkit
        </Text>

        <Text className="text-center text-gray-500 mb-6">
          AI Agents for Disease Surveillance, Pole Defects, Sanitation, Roads & Traffic Analytics.
        </Text>

        {/* Login Button */}
        <Pressable
          className="w-full bg-blue-600 py-3 rounded-xl items-center justify-center"
          onPress={ promptLogin }
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
