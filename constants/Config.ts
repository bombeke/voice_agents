import Constants from 'expo-constants';

const env = Constants.expoConfig?.extra;

export const AGENT_URL = env?.URL;
export const AGENT_PROJECT_ID = env?.PROJECT_ID;
export const AGENT_TOKEN = env?.API_TOKEN;
export const API_URL = env?.API_URL;
export const API_USERNAME = env?.API_USERNAME;
export const API_PASSWORD = env?.API_PASSWORD;
export const API_ACCESS_TOKEN = env?.API_ACCESS_TOKEN;