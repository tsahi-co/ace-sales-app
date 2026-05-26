import * as Notifications from 'expo-notifications';

// Call this once on app start — not at module level
export function initNotifications(): void {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {}
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function showFetchingNotification(step: string): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🛒 ACE Sales',
      body: step,
      sticky: true,
      autoDismiss: false,
    },
    trigger: null,
  });
  return id;
}

export async function updateNotification(id: string, body: string): Promise<void> {
  await Notifications.dismissNotificationAsync(id);
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: '🛒 ACE Sales',
      body,
      sticky: true,
      autoDismiss: false,
    },
    trigger: null,
  });
}

export async function showCompleteNotification(orders: number, skus: number): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✅ ACE Sales — Report Ready',
      body: `${orders} orders · ${skus} SKUs — tap to view`,
      autoDismiss: true,
    },
    trigger: null,
  });
}

export async function showErrorNotification(message: string): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '❌ ACE Sales — Fetch Failed',
      body: message,
      autoDismiss: true,
    },
    trigger: null,
  });
}

export async function dismissAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
}
