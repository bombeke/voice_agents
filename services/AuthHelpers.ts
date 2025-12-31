import { getItemAsync, setItemAsync } from "expo-secure-store";

export const saveSecret = async(key: string, value: any) =>{
  await setItemAsync(key, value);
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