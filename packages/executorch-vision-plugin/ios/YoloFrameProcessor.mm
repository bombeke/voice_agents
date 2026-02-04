#import <VisionCamera/FrameProcessorPlugin.h>
#import <executorch/runtime/executor/module.h>
#import <atomic>

using namespace facebook;

@interface YoloFrameProcessor : FrameProcessorPlugin
@end

@implementation YoloFrameProcessor {
  std::unique_ptr<executorch::runtime::Method> _method;
  std::atomic<bool> _busy;
}

- (instancetype)init {
  if (self = [super init]) {
    auto module = executorch::runtime::Module("yolov26n.pte");
    _method = module.load_method("forward");
    _busy = false;
  }
  return self;
}

- (id)callback:(Frame*)frame withArguments:(NSArray*)arguments {
  if (_busy.exchange(true)) return nil;

  uint8_t* data = frame.data;

  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    // TODO: preprocess + _method->execute(...)
    _busy.store(false);
  });

  return nil;
}

@end

VISIONCAMERA_EXPORT_FRAME_PROCESSOR(YoloFrameProcessor)
