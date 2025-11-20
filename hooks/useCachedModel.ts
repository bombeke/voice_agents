import { useTensorflowModel } from "react-native-fast-tflite"

export const useCachedModel =()=>{
    const model = useTensorflowModel(require('../../../assets/yolo11n_float16.tflite'))
    const actualModel = model.state === 'loaded' ? model.model : undefined
    return { 
        model: actualModel 
    }
}