import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import React, { ReactNode, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Colors from '../ui/Colors';

import useRelayClient from '@/hooks/useRelayClient';
import { Relay } from '@signalwire/react-native';
import { RTCView } from 'react-native-webrtc-web-shim';
import { AssetCall } from './AssetCall';

export const GenericCall =(): ReactNode | Promise<ReactNode> =>{

  const {client, connected, call} = useRelayClient(
    {
      project: '',
      token: '',
    },
    function onRinging(call) {
      const {remoteCallerName, remoteCallerNumber} = call.options;
      const caller = remoteCallerName || remoteCallerNumber;
      Alert.alert(
        'Inbound Call',
        `Call from ${caller}`,
        [
          {
            text: 'Reject',
            onPress: () => call.hangup(),
            style: 'cancel',
          },
          {
            text: 'Answer',
            onPress: () => call.answer(),
          },
        ],
        {cancelable: false},
      );
    },
  );

  const [extension, setExtension] = useState('+12762700060');
  return (
    <KeyboardAvoidingView style={styles.container}>
      <View style={styles.wrapperTop}>
        <Text style={styles.welcome}>Call Agent</Text>
        <Text style={styles.instructions}>
          Status: {connected ? 'Connected' : 'Not connected'}
        </Text>
      </View>
      <Middle call={call} extension={extension} setExtension={setExtension} />
      {client && <Bottom call={call} client={client} extension={extension} />}
    </KeyboardAvoidingView>
  );
}

export const Middle =({
  call,
  extension,
  setExtension,
}: {
  call: any;
  extension: string;
  setExtension: (_: string) => void;
}) => {
  if (call) {
    return (
      <View style={styles.wrapperMiddle}>
        { call?.localStream && (
          <RTCView
            mirror={false}
            objectFit="contain"
            stream={ call?.localStream }
            style={{width: '100%', height: '100%'}}
            zOrder={1}
          />
        )}
        { call?.remoteStream && (
          <RTCView
            mirror={false}
            objectFit="contain"
            stream={ call?.remoteStream }
            style={{width: '100%', height: '100%'}}
            zOrder={1}
          />
        )}
      </View>
    );
  } 
  else {
    return (
      <>
        <View style={styles.wrapperMiddle}>
          <Text className='text-xl font-bold text-blue-500'>Enter a number:</Text>
          <TextInput
            style={styles.textInput}
            textAlign={'center'}
            onChangeText={extension => setExtension(extension)}
            value={extension}
          />
          
        </View>
        <AssetCall/>
      </>
    );
  }
}

export const Bottom =({
  client,
  call,
  extension,
}: {
  client: Relay;
  call: any;
  extension: string;
}) =>{
  const [btnMicActive, setBtnMicActive] = useState(false);
  const [btnCamActive, setBtnCamActive] = useState(false);
  const [btnDeafActive, setBtnDeafActive] = useState(false);

  const [btnSpeakerActive, setBtnSpeakerActive] = useState(false);

  function makeCall() {
    // @ts-ignore
    client.newCall({destinationNumber: extension, video: {facingMode: 'user'}});
  }

  function hangup() {
    call.hangup();
  }

  function toggleMic() {
    setBtnMicActive(i => !i);
    call.toggleAudioMute();
  }

  function toggleCam() {
    setBtnCamActive(u => !u);
    call.toggleVideoMute();
  }

  function toggleDeaf() {
    setBtnDeafActive(i => !i);
    call.toggleDeaf();
  }

  function switchCamera() {
    call.switchCamera();
  }

  function toggleSpeaker() {
    setBtnSpeakerActive(i => !i);
    setTimeout(() => {
      // only call on next render
      call.setSpeakerPhone(btnSpeakerActive);
    }, 0);
  }

  if (call) {
    return (
      <View style={styles.wrapperBottom}>
        <View style={styles.wrapperBottomRow}>
          <TouchableOpacity style={styles.button} onPress={toggleMic}>
            <Icon
              name="microphone"
              size={25}
              color={btnMicActive ? '#000' : 'gray'}
            />
            <Text style={styles.buttonText}>Mute</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={toggleDeaf}>
            <Icon
              name="volume-mute"
              size={25}
              color={btnDeafActive ? '#000' : 'gray'}
            />
            <Text style={styles.buttonText}>Deaf</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={toggleCam}>
            <Icon
              name="camera"
              size={25}
              color={btnCamActive ? '#000' : 'gray'}
            />
            <Text style={styles.buttonText}>Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={switchCamera}>
            <Icon name="camera-retake" size={25} color="#000" />
            <Text style={styles.buttonText}>Flip Cam</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={toggleSpeaker}>
            <Icon
              name="volume-high"
              size={25}
              color={btnSpeakerActive ? '#000' : 'gray'}
            />
            <Text style={styles.buttonText}>Speaker</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.wrapperBottomRow}>
          <TouchableOpacity
            style={[styles.button, {backgroundColor: Colors.red}]}
            onPress={hangup}>
            <Icon name="phone-hangup" size={25} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  } 
  else {
    return (
      <View style={styles.wrapperBottom}>
        <View style={styles.wrapperBottomRow}>
          <TouchableOpacity
            style={[styles.button, {backgroundColor: Colors.green}]}
            onPress={makeCall}>
            <Icon name="phone" size={25} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxHeight: 700,
  },
  wrapperTop: {
    flex: 0.5,
    justifyContent: 'center',
  },
  wrapperMiddle: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#000',
    borderTopWidth: 1,
  },
  wrapperBottom: {
    flex: 0.5,
    borderColor: '#000',
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  wrapperBottomRow: {
    flex: 0.5,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  textInput: {
    height: 40,
    width: '80%',
    borderColor: 'gray',
    borderWidth: 1,
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 100,
    height: 40,
    width: '20%',
  },
  buttonText: {
    textAlign: 'center',
    fontSize: 12,
  },
});