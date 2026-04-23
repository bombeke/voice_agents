import {
  makeRedirectUri,
  ResponseType,
  useAuthRequest,
} from "expo-auth-session";
import { memo, useEffect, useRef, useState } from "react";
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
import { useRouter } from "expo-router";
import {
  coolDownAsync,
  maybeCompleteAuthSession,
  warmUpAsync,
} from "expo-web-browser";

maybeCompleteAuthSession();

function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const handledRef = useRef<string | null>(null);
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
    //console.log("Screen start1")
    //if (response === null) return;
     console.log("Screen start2")
    if (response?.type !== "success") return;
     console.log("Screen start3")
    //const { code, state } = response.params ?? {};

    if (!response?.params?.code) {
      Alert.alert("Login failed", "Missing authorization code.");
      return;
    }
    if (handledRef.current === response?.params?.code ) return;
     console.log("Screen start4")
    handledRef.current = response?.params?.code;

    const completeLogin = async () => {
      try {
        setSubmitting(true);
        //const { publicKey } = await getDeviceKeypair();
         console.log("Screen start5")
        const res = await axios.post(`${API_URL}/auth/callback`, {
          code: response?.params?.code,
          state: response?.params?.state
          //device_public_key: publicKey,
        });
        console.log("Callback token:",res)
        const token = res.data?.token ?? res.data?.access_token;
        if (!token || !res.data.expires_at) {
          Alert.alert("Login failed", "Please try again");
          handledRef.current = null;
          setSubmitting(false);  
          return;
        }
        console.log("Screen start")
        await login(token, res.data.expires_at, res.data.claims);
        console.log("Screen look")
        //router.replace(`${ Routes.TABS}`);
      } 
      catch (e) {
        console.log("Login Screen failure:",e)
        handledRef.current = null;
        setSubmitting(false);
        Alert.alert("Login failed", "Please try again.");
      }
    };

    completeLogin();
    //@ts-ignore
  }, [response?.params?.code,response?.params?.state,response?.type, login]);

  if (submitting) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-gray-600 text-base">Logging you in...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center items-center px-6">
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

export default memo(LoginScreen);
