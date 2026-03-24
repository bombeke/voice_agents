package org.bombeke.visioncameraexecutorch

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.RuntimeExecutor
import com.facebook.react.turbomodule.core.CallInvokerHolderImpl

object TagsDetectorInstaller {

  external fun nativeInstall(
    runtimePtr: Long,
    callInvokerPtr: Long
  )

  fun install(context: ReactApplicationContext?) {
    if (context == null) return

    val catalyst = context.catalystInstance ?: return

    val runtimePtr = catalyst.javaScriptContextHolder?.get() ?: return

    val callInvokerHolder =
      catalyst.jsCallInvokerHolder as? CallInvokerHolderImpl ?: return

    nativeInstall(
      runtimePtr,
      callInvokerHolder.jsCallInvokerHolder
    )
  }

  init {
    System.loadLibrary("visioncameraexecutorch")
  }
}