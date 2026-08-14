import Clarity from '@microsoft/clarity'
if(import.meta.env.PROD){
    Clarity.init(import.meta.env.VITE_CLARITY_ID)
}