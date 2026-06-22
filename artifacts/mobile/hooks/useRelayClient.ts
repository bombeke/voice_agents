import { RelayClient } from '@signalwire/sdk';
import { useEffect, useState } from 'react';
import { AGENT_PROJECT_ID } from '../constants/Config';
import { getAuthToken } from './useSipApiCall';

export default function useRelayClient(
  options: any,
  onRinging: (call: any) => void,
) {
  const [client, setClient] = useState<null | RelayClient>(null);
  const [connected, setConnected] = useState(false);
  const [call, setCall] = useState(null);

  useEffect(() => {
    let _client: RelayClient | undefined;
    
    async function createClient() {
        const token = await getAuthToken();
        options.token = token?.data?.jwt_token;
        options.project = AGENT_PROJECT_ID;
      _client = new RelayClient(options);

      _client.on('signalwire.ready', () => {
        setConnected(true);
      });

      _client.on('signalwire.error', (e: any) => {
        console.error(e);
      });

      _client.on('signalwire.notification', async (notification: any) => {
        switch (notification.type) {
          case 'callUpdate':
            await onCallUpdate(notification.call);
        }
      });

      _client.iceServers = [{urls: ['stun:stun.l.google.com:19302']}];

      _client.on('signalwire.socket.open', () => {
        console.log('Socket Open');
      });
      _client.on('signalwire.socket.close', (e: any) => {
        console.log('Socket Close', e);
      });
      _client.on('signalwire.socket.error', () => {
        console.log('Socket Error');
      });

      await _client?.connect();
      setClient(_client);

      return () => {
        _client?.disconnect();
      };
    }

    async function onCallUpdate(call: any) {
      switch (call.state) {
        case 'ringing': {
          onRinging(call);
          break;
        }
        case 'active':
          setCall(call);
          break;
        case 'destroy':
          setCall(null);
          break;
      }
    }
    createClient();
  }, [options.token]);

  return {client, connected, call};
}