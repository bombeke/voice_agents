#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>
#import <VisionCamera/VisionCameraProxyHolder.h>
#import <VisionCamera/Frame.h>

@interface TagsDetectorFrameProcessor : FrameProcessorPlugin

@end

@implementation TagsDetectorFrameProcessor

- (instancetype _Nonnull)initWithProxy:(VisionCameraProxyHolder*)proxy
                           withOptions:(NSDictionary* _Nullable)options {
  self = [super initWithProxy:proxy withOptions:options];
  return self;
}

- (id _Nullable)callback:(Frame* _Nonnull)frame
           withArguments:(NSDictionary* _Nullable)arguments {
  // code goes here
  return nil;
}

VISION_EXPORT_FRAME_PROCESSOR(TagsDetectorFrameProcessor, detectTags)

@end