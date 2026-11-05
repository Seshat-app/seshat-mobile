package expo.modules.seshatbubble

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SeshatBubbleModule : Module() {
  private val context get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("SeshatBubble")

    // Bubbles exist from Android 11.
    Function("isSupported") { BubbleController.isSupported }
    // The user (or the OS) can still switch bubbles off for the app in system settings.
    Function("bubblesAllowed") { BubbleController.bubblesAllowed(context) }
    Function("isShown") { BubbleController.isShown(context) }

    Function("show") { title: String, hint: String -> BubbleController.show(context, title, hint) }
    Function("hide") { BubbleController.hide(context) }

    Function("openSettings") { context.startActivity(BubbleController.settingsIntent(context)) }

    // Home-screen widgets: the app hands over the phone's capture token, the API address and the language, then
    // asks the widgets to redraw (they fetch /widget/summary themselves).
    Function("setWidgetConfig") { token: String, api: String, lang: String ->
      expo.modules.seshatbubble.widgets.WidgetStore.setConfig(context, token, api, lang)
    }
    Function("refreshWidgets") { expo.modules.seshatbubble.widgets.WidgetStore.redrawAll(context) }

    // Collapses the panel back to the floating bubble (the chat header's close button).
    Function("collapse") { appContext.currentActivity?.finish() }
  }
}
