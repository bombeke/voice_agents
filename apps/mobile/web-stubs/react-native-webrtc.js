export const RTCPeerConnection = typeof window !== 'undefined' ? window.RTCPeerConnection : null;
export const RTCSessionDescription = typeof window !== 'undefined' ? window.RTCSessionDescription : null;
export const RTCIceCandidate = typeof window !== 'undefined' ? window.RTCIceCandidate : null;
export const MediaStream = typeof window !== 'undefined' ? window.MediaStream : null;
export const MediaStreamTrack = typeof window !== 'undefined' ? window.MediaStreamTrack : null;
export const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
export const registerGlobals = () => {};
export default { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, MediaStream, MediaStreamTrack, mediaDevices, registerGlobals };
