import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class NotificationService {
  static async requestPermissions(): Promise<boolean> {
    // Notifications are not supported on web
    if (Platform.OS === 'web') {
      console.log('Notifications not supported on web platform');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return false;
    }
    
    return true;
  }

  static async scheduleAnnouncementNotification(announcement: {
    id: string;
    title: string;
    description: string;
    priority: string;
  }) {
    // Notifications are not supported on web
    if (Platform.OS === 'web') {
      console.log('Announcement notification skipped on web platform:', announcement.title);
      return null;
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New Announcement',
        body: `${announcement.title} - ${announcement.description.substring(0, 100)}...`,
        data: { 
          type: 'announcement',
          announcementId: announcement.id,
          priority: announcement.priority
        },
        sound: 'default',
      },
      trigger: null, // Show immediately
    });

    console.log('Scheduled announcement notification:', notificationId);
    return notificationId;
  }

  static async schedulePickupReminder(schedule: {
    id: string;
    date: Date;
    time: string;
    type: string;
  }) {
    // Notifications are not supported on web
    if (Platform.OS === 'web') {
      console.log('Pickup reminder notification skipped on web platform for:', schedule.id);
      return;
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return;

    const scheduleDate = new Date(schedule.date);
    const [hours, minutes] = schedule.time.split(':').map(Number);
    scheduleDate.setHours(hours, minutes, 0, 0);

    const now = new Date();
    const timeDiff = scheduleDate.getTime() - now.getTime();

    // Don't schedule if the time has already passed
    if (timeDiff <= 0) return;

    // Schedule notification for 1 hour before
    const oneHourBefore = new Date(scheduleDate.getTime() - 60 * 60 * 1000);
    if (oneHourBefore > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Pickup Reminder',
          body: `Your ${schedule.type} pickup is in 1 hour`,
          data: { 
            type: 'pickup_reminder',
            scheduleId: schedule.id,
            reminderType: '1hour'
          },
          sound: 'default',
        },
        trigger: { date: oneHourBefore },
      });
    }

    // Schedule notification for tomorrow (24 hours before)
    const tomorrow = new Date(scheduleDate.getTime() - 24 * 60 * 60 * 1000);
    if (tomorrow > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Pickup Tomorrow',
          body: `Your ${schedule.type} pickup is scheduled for tomorrow`,
          data: { 
            type: 'pickup_reminder',
            scheduleId: schedule.id,
            reminderType: 'tomorrow'
          },
          sound: 'default',
        },
        trigger: { date: tomorrow },
      });
    }

    console.log('Scheduled pickup reminders for:', schedule.id);
  }

  static async cancelNotification(notificationId: string) {
    // Notifications are not supported on web
    if (Platform.OS === 'web') {
      console.log('Cancel notification skipped on web platform');
      return;
    }
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  static async cancelAllNotifications() {
    // Notifications are not supported on web
    if (Platform.OS === 'web') {
      console.log('Cancel all notifications skipped on web platform');
      return;
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  static async getScheduledNotifications() {
    // Notifications are not supported on web
    if (Platform.OS === 'web') {
      console.log('Get scheduled notifications skipped on web platform');
      return [];
    }
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  static buildReminderIds(scheduleId: string) {
    return {
      tomorrowId: `sched_${scheduleId}_tomorrow`,
      oneHourId: `sched_${scheduleId}_1hour`,
    };
  }

  static async cancelReminderById(identifier: string) {
    if (Platform.OS === 'web') return;
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch {}
  }

  static async getAllScheduledIdentifiers(): Promise<string[]> {
    if (Platform.OS === 'web') return [];
    const list = await Notifications.getAllScheduledNotificationsAsync();
    return list.map(n => n.identifier);
  }

  static async upsertPickupReminders(schedule: { id: string; date: Date; time: string; type: string; }) {
    if (Platform.OS === 'web') return;

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return;

    const { tomorrowId, oneHourId } = this.buildReminderIds(schedule.id);

    // Cancel existing ones for this schedule
    await this.cancelReminderById(tomorrowId);
    await this.cancelReminderById(oneHourId);

    const scheduleDate = new Date(schedule.date);
    const [hours, minutes] = schedule.time.split(':').map(Number);
    scheduleDate.setHours(hours, minutes, 0, 0);

    const now = new Date();
    if (scheduleDate <= now) return;

    // 1 hour before
    const oneHourBefore = new Date(scheduleDate.getTime() - 60 * 60 * 1000);
    if (oneHourBefore > now) {
      await Notifications.scheduleNotificationAsync({
        identifier: oneHourId,
        content: {
          title: 'Pickup Reminder',
          body: `Your ${schedule.type} pickup is in 1 hour`,
          data: { type: 'pickup_reminder', scheduleId: schedule.id, reminderType: '1hour' },
          sound: 'default',
        },
        trigger: { date: oneHourBefore },
      });
    }

    // 24 hours before
    const tomorrow = new Date(scheduleDate.getTime() - 24 * 60 * 60 * 1000);
    if (tomorrow > now) {
      await Notifications.scheduleNotificationAsync({
        identifier: tomorrowId,
        content: {
          title: 'Pickup Tomorrow',
          body: `Your ${schedule.type} pickup is scheduled for tomorrow`,
          data: { type: 'pickup_reminder', scheduleId: schedule.id, reminderType: 'tomorrow' },
          sound: 'default',
        },
        trigger: { date: tomorrow },
      });
    }
  }
}
