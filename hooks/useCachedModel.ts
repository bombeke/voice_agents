import { useEffect, useState } from "react";
import { useTensorflowModel } from "react-native-fast-tflite";

export const useCachedModel =()=>{
    const model = useTensorflowModel(require('@/assets/yolo11n_float16.tflite'));
    
    const [cachedModel, setCachedModel] = useState<any | null>(null);

    useEffect(() => {
        async function load() {
            const actualModel = model.state === 'loaded' ? model.model : null;
            if(actualModel){
                setCachedModel(actualModel);
            }
        }
        load();
    }, [model.state, model.model]);

    return { 
        model: cachedModel 
    }
}