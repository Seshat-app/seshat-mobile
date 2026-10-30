package expo.modules.seshatbubble

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * The floating chat panel: a second React root ("SeshatChatPanel", see index.js) in the bubble.
 * It uses React Native's own delegate rather than Expo's wrapper: a module cannot depend on the
 * `expo` module (which depends on every module), and the chat needs none of the wrapper's hooks.
 */
class BubbleActivity : ReactActivity() {
  override fun getMainComponentName(): String = "SeshatChatPanel"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
