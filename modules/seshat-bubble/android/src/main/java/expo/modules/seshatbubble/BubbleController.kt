package expo.modules.seshatbubble

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.os.Build
import android.app.Person
import android.provider.Settings
import android.content.LocusId

/**
 * Posts and removes the Seshat chat bubble. Android draws the floating bubble itself from a
 * notification that carries BubbleMetadata, so no "display over other apps" permission is needed.
 * Bubbles are a platform feature from Android 11 (API 30).
 */
object BubbleController {
  // Bubbles need a channel of at least default importance, and a channel's importance cannot be
  // raised once created, so this is a new id (the earlier low-importance "seshat_bubble" is removed).
  private const val CHANNEL_ID = "seshat_chat_bubble"
  private const val OLD_CHANNEL_ID = "seshat_bubble"
  private const val NOTIFICATION_ID = 7101
  private const val SHORTCUT_ID = "seshat_chat"

  val isSupported: Boolean get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R

  private fun manager(ctx: Context) = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  /** Bubbles allowed for this app, both by the system setting and the app's own bubble preference. */
  fun bubblesAllowed(ctx: Context): Boolean = isSupported && manager(ctx).areBubblesAllowed()

  fun isShown(ctx: Context): Boolean =
    isSupported && manager(ctx).activeNotifications.any { it.id == NOTIFICATION_ID }

  fun hide(ctx: Context) {
    if (!isSupported) return
    manager(ctx).cancel(NOTIFICATION_ID)
  }

  /** Opens the system screen where the user lets Seshat bubble. */
  fun settingsIntent(ctx: Context): Intent =
    Intent(Settings.ACTION_APP_NOTIFICATION_BUBBLE_SETTINGS)
      .putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

  fun show(ctx: Context, title: String, hint: String): Boolean {
    if (!isSupported) return false
    val nm = manager(ctx)
    nm.deleteNotificationChannel(OLD_CHANNEL_ID)
    if (nm.getNotificationChannel(CHANNEL_ID) == null) {
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, title, NotificationManager.IMPORTANCE_DEFAULT).apply {
          setAllowBubbles(true)
          setShowBadge(false)
          setSound(null, null)       // the bubble is always there; it should never ping
          enableVibration(false)
        }
      )
    }

    val person = Person.Builder().setName(title).setKey("seshat").build()
    val appIcon = Icon.createWithResource(ctx, ctx.applicationInfo.icon)

    val open = Intent(ctx, BubbleActivity::class.java).setAction(Intent.ACTION_VIEW)
    val shortcut = ShortcutInfo.Builder(ctx, SHORTCUT_ID)
      .setShortLabel(title)
      .setLongLived(true)
      .setCategories(setOf("android.shortcut.conversation"))
      .setIcon(appIcon)
      .setIntent(open)
      .setPerson(person)
      .setLocusId(LocusId(SHORTCUT_ID))
      .build()
    (ctx.getSystemService(Context.SHORTCUT_SERVICE) as ShortcutManager).pushDynamicShortcut(shortcut)

    // The bubble opens through the conversation shortcut (whose intent is BubbleActivity), the
    // route Android recommends for bubbles: it skips the intent-only checks.
    val bubble = Notification.BubbleMetadata.Builder(SHORTCUT_ID)
      .setDesiredHeightResId(R.dimen.seshat_bubble_height)
      .setAutoExpandBubble(false)
      .setSuppressNotification(true)
      .build()

    val smallIcon = ctx.resources.getIdentifier("notification_icon", "drawable", ctx.packageName)
      .takeIf { it != 0 } ?: ctx.applicationInfo.icon
    val notification = Notification.Builder(ctx, CHANNEL_ID)
      .setSmallIcon(smallIcon)
      .setContentTitle(title)
      .setContentText(hint)
      .setCategory(Notification.CATEGORY_MESSAGE)
      .setOnlyAlertOnce(true)
      .setShortcutId(SHORTCUT_ID)
      .setLocusId(LocusId(SHORTCUT_ID))
      .setStyle(
        Notification.MessagingStyle(person)
          .addMessage(Notification.MessagingStyle.Message(hint, System.currentTimeMillis(), person))
      )
      .setBubbleMetadata(bubble)
      .build()

    // Cancel first so a bubble the user swiped away comes back when they turn it on again.
    nm.cancel(NOTIFICATION_ID)
    nm.notify(NOTIFICATION_ID, notification)
    return true
  }
}
