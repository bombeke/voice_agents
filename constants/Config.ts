import Constants from 'expo-constants';

const env = Constants.expoConfig?.extra;

export const AGENT_URL = env?.URL;
export const AGENT_PROJECT_ID = env?.PROJECT_ID;
export const AGENT_TOKEN = env?.API_TOKEN;
export const API_URL = env?.API_URL;
export const API_USERNAME = env?.API_USERNAME;
export const API_PASSWORD = env?.API_PASSWORD;
export const API_ACCESS_TOKEN = env?.API_ACCESS_TOKEN;

export const APP_SECURE_AUTH_STATE_KEY = 'PoleVisionAuthToken';
export const DEVICE_KEY_NAME = "device_keypair_v1";

export const ROTATION_KEY = "device_key_rotation_ts";
export const ROTATION_INTERVAL = 30 * 24 * 60 * 60; // 30 days