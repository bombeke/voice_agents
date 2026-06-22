import { useEffect, useState } from "react";
import { Button, SafeAreaView, StatusBar, View } from "react-native";
import { mediaDevices, RTCView } from "react-native-webrtc-web-shim";

export const CallRTCView = ({ callStream }: any)=> {
  const [stream, setStream] = useState<any>(null);

  const start = async () => {
    console.log("start");
    if (!stream) {
      let s;
      try {
        s = await mediaDevices.getUserMedia({ video: true });
        setStream(s);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const stop = () => {
    console.log("stop");
    if (stream) {
      stream.release();
      setStream(null);
    }
  };

  useEffect(()=>{
    if(callStream){
      setStream(callStream);
    }
  },[callStream]);
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1 }}>
        {stream && <RTCView streamURL={stream.toURL()} style={{ flex: 1 }} />}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
        <Button title="Start" onPress={start} />
        <Button title="Stop" onPress={stop} />
      </View>
    </SafeAreaView>
  );
}

export default CallRTCView;