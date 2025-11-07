import { Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export default function H5PViewer() {
  const sourceUri = (Platform.OS === 'android' ? 'file:///android_asset/' : '') + 'Web.bundle/loader.html';
  const injectedJS = `
    if (!window.location.search) {
      var link = document.getElementById('progress-bar');
      // Redirect to your H5P's main file, potentially with parameters
      link.href = './index.html?platform=${Platform.OS}';
      link.click();
    }
  `;

  return (
    <WebView
      source={{ uri: sourceUri }}
      injectedJavaScript={injectedJS}
      javaScriptEnabled={true}
      originWhitelist={['*']}
      allowFileAccess={true} 
    />
  );
}