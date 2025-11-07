import Constants from 'expo-constants';

const env = Constants.expoConfig?.extra;

export const AGENT_URL = env?.URL;
export const AGENT_PROJECT_ID = env?.PROJECT_ID;
export const AGENT_TOKEN = env?.API_TOKEN;