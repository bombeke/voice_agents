extern "C"
JNIEXPORT void JNICALL
Java_org_bombeke_visioncameraexecutorch_TagsDetectorInstaller_nativeInstall(
  JNIEnv* env,
  jobject thiz,
  jlong runtimePtr,
  jlong callInvokerPtr
) {
  auto runtime = reinterpret_cast<facebook::jsi::Runtime*>(runtimePtr);

  auto hostObject = std::make_shared<DetectTagsHostObject>();

  runtime->global().setProperty(
    *runtime,
    "__detectTags",
    facebook::jsi::Object::createFromHostObject(*runtime, hostObject)
  );
}