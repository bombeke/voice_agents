import { useEffect, useState } from "react";
import { useTensorflowModel } from "react-native-fast-tflite";

export const useCachedModel =()=>{
    const {model, state} = useTensorflowModel(require('@/assets/ssd_mobilenet_v1.tflite'));
    
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