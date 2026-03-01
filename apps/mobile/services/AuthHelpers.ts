import { getItemAsync, SecureStoreOptions, setItemAsync } from "expo-secure-store";

export const saveSecret = async(key: string, value: any, options: SecureStoreOptions | undefined =undefined) =>{
  await setItemAsync(key, value, options);
  return true;
}

export const getSecret =async (key: string) =>{
  const value = await getItemAsync(key);
  if (value) {
    return value;
  } 
  else {
    return null;
  }
}