// index.js — Polyfill bootstrap. Import order is CRITICAL.
import 'react-native-get-random-values'; // 1. crypto.getRandomValues()
import 'react-native-url-polyfill/auto'; // 2. URL API
import 'text-encoding'; // 3. TextEncoder / TextDecoder (Hermes lacks these)
import {AppRegistry} from 'react-native';
import App from './src/app/App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
