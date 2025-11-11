import { AGENT_PROJECT_ID, AGENT_TOKEN, AGENT_URL } from '@/constants/Config';
import axios from 'axios';

const API_BASE: string = `https://${AGENT_URL}/api/laml/2010-04-01/Accounts`;

export const makeSipCall = async (from: string, to: string) => {
  const response = await axios.post(
    `${API_BASE}/${AGENT_PROJECT_ID}/Calls`,
    new URLSearchParams({
      From: from,
      To: to,
      Url: `${AGENT_URL}/call-handler`
    }),
    {
      auth: {
        username: AGENT_PROJECT_ID,
        password: AGENT_TOKEN
      }
    }
  );
  return response.data;
};

export const endCall = async (callSid: any) => {
  await axios.post(
    `${API_BASE}/${AGENT_PROJECT_ID}/Calls/${callSid}`,
    new URLSearchParams({ Status: 'completed' }),
    {
      auth: {
        username: AGENT_PROJECT_ID,
        password: AGENT_TOKEN
      }
    }
  );
};
