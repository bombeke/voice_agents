import { Platform } from "react-native";

const MODEL_NAME = "model.pte";

export async function prepareModel(): Promise<string> {
  if (Platform.OS === 'web') {
    return '';
  }

  const { Asset } = await import("expo-asset");
  const { File, Paths } = await import("expo-file-system");

  const destination = new File(Paths.document, MODEL_NAME);

  if (destination.exists) {
    console.log("App cached model at:", destination.uri);
    return destination.uri.replace("file://", "");
  }

  const asset = Asset.fromModule(require("../assets/model.pte"));

  await asset.downloadAsync();

  if (!asset.localUri) {
    throw new Error("Model failed to download.");
  }

  new File(asset.localUri).copy(destination);

  console.log("App Model copied to:", destination.uri);

  return destination.uri.replace("file://", "");
}

export async function prepareAndInitializeModel() {
  return await prepareModel();
}
