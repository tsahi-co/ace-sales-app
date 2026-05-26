// Proxy to avoid importing expo-notifications on web
export { 
  showFetchingNotification,
  showCompleteNotification,
  showErrorNotification,
  dismissAllNotifications,
} from '../services/notificationService';
