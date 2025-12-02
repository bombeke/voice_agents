import { useEffect, useState } from "react";
import { useTensorflowModel } from "react-native-fast-tflite";

export const useCachedModel =()=>{
    const {model, state} = useTensorflowModel(require('@/assets/yolo11n_float16.tflite'));
    
    const [cachedModel, setCachedModel] = useState<any | null>(null);

    useEffect(() => {
        async function load() {
            const actualModel = state === 'loaded' ? model : null;
            if(actualModel){
                setCachedModel(actualModel);
            }
        }
        load();
    }, [state, model]);

    return { 
        model: cachedModel, 
        state: state
    }
}