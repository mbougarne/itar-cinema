/**
 * @format
 */

import { AppRegistry, LogBox, NativeModules, Platform } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

if (__DEV__ && Platform.OS === 'ios' && Platform.isTV) {
  // React Native's debugger tip takes Siri Remote focus from the first button.
  LogBox.ignoreLogs([/^Open debugger to view warnings\.$/]);

  const source = NativeModules.SourceCode?.getConstants?.().scriptURL;

  if (source?.startsWith('file:')) {
    NativeModules.DevLoadingView?.hide();
  }
}

AppRegistry.registerComponent(appName, () => App);
