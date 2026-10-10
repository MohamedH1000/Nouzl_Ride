import { cssToReactNativeRuntime } from 'react-native-css-interop/dist/css-to-rn';
import { injectData } from 'react-native-css-interop/dist/runtime/native/styles';

/**
 * Jest has no Metro, so no Tailwind CSS is compiled and every className
 * resolves to nothing. This compiles a few real rules through the same
 * css-to-rn step NativeWind uses, so a test can prove a className reached
 * the rendered view.
 */
export function registerCss(css: string): void {
  injectData(cssToReactNativeRuntime(css));
}
