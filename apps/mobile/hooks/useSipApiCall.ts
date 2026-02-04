import { Relay } from "@signalwire/js";
import axios from 'axios';
import { useState } from 'react';
import { AGENT_PROJECT_ID, AGENT_TOKEN, AGENT_URL } from "../constants/Config";

export  const getAuthToken = async()=>{
      const response = await axios.post(
        `https://${AGENT_URL}/api/relay/rest/jwt`,
        {}, 
        {
          auth: {
            username: `${AGENT_PROJECT_ID}`,
            password: `${AGENT_TOKEN}`
          },
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      return response;
 }
export const useSipApi=()=> {
  const [callStatus, setCallStatus] = useState<string>('idle');
  const [activeCall, setActiveCall] = useState<string | null>(null);
  const [phoneClient, setPhoneClient] = useState<any>(null);
 


  const initiateCall = async (toNumber: string | null) => {
    try {
      setCallStatus('calling');
      const token = await getAuthToken();
      console.log("Token:",token);

      const client = new Relay({
        project: `${AGENT_PROJECT_ID}`,
        token: token?.data?.jwt_token
      });
      setPhoneClient(client);
      client.on('signalwire.ready', (ct: any) => {
         console.log("You are connected with Relay!",ct)
      })
      await client.connect()

      const success = await client.checkPermissions()
      if (success) {
        console.log("User gave the permission");
      } else {
        console.log("User didn't gave the permission");
      }
      const odevices = await client.getAudioOutDevices()
       console.log("Speaker list0:",odevices);
      odevices.forEach(device => {
        console.log(device.kind + ': ' + device.label + ' id: ' + device.deviceId);
      })

      const devices = await client.getDevices()
       console.log("Speaker list2:",devices);
      devices.forEach(device => {
        console.log(device.kind + ': ' + device.label + ' id: ' + device.deviceId);
      })
      const speakerList = client.devices
      console.log("Speaker list:",speakerList);
      //if (speakerList.length) {
      //  client.speaker = speakerList[0].deviceId
      //}
      const options: any = { destinationNumber: toNumber }
      const newCall = await client.newCall(options).catch(console.error)
      console.log("XXX:::",newCall);
      
      /*const call = await makeSipCall(
        process.env.EXPO_PUBLIC_SIP_ENDPOINT,
        `sip:${toNumber}@${process.env.EXPO_PUBLIC_DOMAIN}`
      );*/
      //setActiveCall(call.sid);
      setActiveCall(toNumber);
      setCallStatus('in-call');
    } 
    catch (error) {
      setCallStatus('error');
      setActiveCall(null);
      console.error('Call failed:', error);
    }
  };

  const terminateCall = async () => {
    if (!activeCall) return;
    
    try {
      //await endCall(activeCall);
      if(phoneClient){
        phoneClient.disconnect();
        setCallStatus('ended');
      }
    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      setActiveCall(null);
    }
  };

  return {
    callStatus,
    activeCall,
    initiateCall,
    terminateCall
  };
}