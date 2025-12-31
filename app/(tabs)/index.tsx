import { API_URL, APP_SECURE_AUTH_STATE_KEY } from "@/constants/Config";
import { axiosClient } from "@/services/Api";
import { getSecret, saveSecret } from "@/services/AuthHelpers";
import { makeRedirectUri, ResponseType, useAuthRequest } from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { ActivityIndicator, Button, Platform, ScrollView, Text, View } from "react-native";

WebBrowser.maybeCompleteAuthSession();


export default function HomeScreen() {
  const router = useRouter();
  const [loggedIn,setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  const redirectUri = makeRedirectUri({
    scheme: "voiceagents",
    path: "callback",
  });

  const [request, response, promptAsync] = useAuthRequest(
      {
        clientId: "dummy",
        redirectUri,
        responseType: ResponseType.Code,
      },
      {
        authorizationEndpoint: `${API_URL}/login`,
      }
    );
    
  useEffect(() => {
    const bootstrapAuth = async () => {
      if (Platform.OS === "web") {
        setLoading(false);
        return;
      }

      const token = await getSecret(APP_SECURE_AUTH_STATE_KEY);
      if (token) {
        setLoggedIn(true);
        router.replace("/"); 
      }
      setLoading(false);
    };

    bootstrapAuth();
  }, []);

  useEffect(() => {
    const authenticate=async()=>{
      if (response?.type !== "success") return;

      const { code, state } = response.params;

      const res = await axiosClient.post(`/callback`, {
        code,
        state,
      });

      if (res.data?.token) {
        setLoggedIn(true);
        if (Platform.OS !== "web") {
          await saveSecret(APP_SECURE_AUTH_STATE_KEY, res.data.token);
        }
        router.replace("/");
      } else {
        setLoggedIn(false);
      }
    }
    authenticate();
  }, [response]);
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if(!loggedIn){
      return (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Button
            title="Login"
            onPress={() => promptAsync()}
            disabled={!request}
          />
        </View>
      );
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} className="bg-white">
      <View className="gap-4">
        <Text className="text-3xl font-bold text-primary">
          BYOD Environment AI Toolkit
        </Text>
        <Text className="text-base">
          Manage AI Agents for Disease Surveillance and Response, Pole defects and pollution, 
          sanitation and roads & traffic reporting.
        </Text>
      </View>
    </ScrollView>
  );
}
