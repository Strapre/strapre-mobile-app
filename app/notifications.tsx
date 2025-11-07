import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  Check,
  RefreshCw,
  X,
  Eye,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationData {
  subject?: string;
  message?: string;
  store_id?: string;
  store_name?: string;
  slug?: string;
  url?: string;
}

interface Notification {
  id: string;
  type: string;
  data: NotificationData;
  read_at: string | null;
  created_at: string;
}

interface NotificationResponse {
  notifications: {
    current_page: number;
    data: Notification[];
    next_page_url: string | null;
    total: number;
  };
  unread_count: number;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAsRead, setMarkingAsRead] = useState<string[]>([]);
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) {
      Alert.alert('Login Required', 'Please login to view notifications', [
        {
          text: 'Login',
          onPress: () => router.replace('/login'),
        },
      ]);
      return;
    }
    fetchNotifications(1);
  };

  const fetchNotifications = async (page: number = 1, append: boolean = false) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) return;

    try {
      if (!append) setLoading(true);

      const response = await fetch(
        `https://api.strapre.com/api/v1/notifications?page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }
      );

      if (response.status === 401) {
        await AsyncStorage.removeItem('auth_token');
        Alert.alert('Session Expired', 'Please login again', [
          { text: 'Login', onPress: () => router.replace('/login') },
        ]);
        return;
      }

      const data: NotificationResponse = await response.json();

      if (append) {
        setNotifications((prev) => [...prev, ...data.notifications.data]);
      } else {
        setNotifications(data.notifications.data);
      }

      setUnreadCount(data.unread_count);
      setCurrentPage(data.notifications.current_page);
      setHasMore(data.notifications.next_page_url !== null);
    } catch (error) {
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCurrentPage(1);
    setHasMore(true);
    fetchNotifications(1);
  }, []);

  const loadMore = () => {
    if (hasMore && !loadingMore && !loading) {
      setLoadingMore(true);
      fetchNotifications(currentPage + 1, true);
    }
  };

  const markAsRead = async (notificationId: string) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) return;

    setMarkingAsRead((prev) => [...prev, notificationId]);

    try {
      const response = await fetch(
        `https://api.strapre.com/api/v1/notifications/${notificationId}/mark-as-read`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }
      );

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === notificationId
              ? { ...notification, read_at: new Date().toISOString() }
              : notification
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    } finally {
      setMarkingAsRead((prev) => prev.filter((id) => id !== notificationId));
    }
  };

  const markAllAsRead = async () => {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) return;

    setMarkingAllAsRead(true);

    try {
      const response = await fetch(
        'https://api.strapre.com/api/v1/notifications/mark-as-read',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }
      );

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notification) => ({
            ...notification,
            read_at: notification.read_at || new Date().toISOString(),
          }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to mark all as read');
    } finally {
      setMarkingAllAsRead(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type: string) => {
    if (type.includes('StoreApproved')) return '✅';
    if (type.includes('Store')) return '🏪';
    if (type.includes('Order')) return '📦';
    if (type.includes('Payment')) return '💳';
    return '🔔';
  };

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification);
    setShowModal(true);

    if (!notification.read_at) {
      markAsRead(notification.id);
    }
  };

  const handleNotificationAction = (notification: Notification) => {
    setShowModal(false);

    if (notification.data.store_id) {
      router.push(`/store/${notification.data.slug}`);
    }
  };

  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#CB0207" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={20} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerIconContainer}>
            <Bell size={20} color="#CB0207" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity onPress={onRefresh} style={styles.iconButton}>
            <RefreshCw size={16} color="#666" />
          </TouchableOpacity>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllAsRead}
              disabled={markingAllAsRead}
              style={styles.markAllButton}
            >
              {markingAllAsRead ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <CheckCheck size={14} color="#fff" />
                  <Text style={styles.markAllText}>Mark All</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Notifications List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#CB0207']} />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isCloseToBottom =
            layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
          if (isCloseToBottom) {
            loadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Bell size={40} color="#ccc" />
            </View>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyText}>
              We'll notify you when something important happens.
            </Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationCard,
                  !notification.read_at && styles.unreadCard,
                ]}
                onPress={() => handleNotificationClick(notification)}
                activeOpacity={0.7}
              >
                <View style={styles.notificationContent}>
                  {/* Icon */}
                  <Text style={styles.notificationIcon}>
                    {getNotificationIcon(notification.type)}
                  </Text>

                  {/* Content */}
                  <View style={styles.notificationBody}>
                    <Text
                      style={[
                        styles.notificationSubject,
                        !notification.read_at && styles.unreadText,
                      ]}
                      numberOfLines={1}
                    >
                      {notification.data.subject || 'Notification'}
                    </Text>
                    <Text style={styles.notificationMessage} numberOfLines={2}>
                      {notification.data.message}
                    </Text>
                    <View style={styles.notificationMeta}>
                      <Text style={styles.metaText}>{formatTimeAgo(notification.created_at)}</Text>
                      {notification.data.store_name && (
                        <>
                          <Text style={styles.metaDot}>•</Text>
                          <Text style={styles.storeName} numberOfLines={1}>
                            {notification.data.store_name}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.notificationActions}>
                    {!notification.read_at && (
                      <>
                        <View style={styles.unreadDot} />
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          disabled={markingAsRead.includes(notification.id)}
                          style={styles.actionButton}
                        >
                          {markingAsRead.includes(notification.id) ? (
                            <ActivityIndicator size="small" color="#CB0207" />
                          ) : (
                            <Check size={14} color="#666" />
                          )}
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            {loadingMore && (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color="#CB0207" />
              </View>
            )}

            {!hasMore && notifications.length > 0 && (
              <View style={styles.endMessage}>
                <Text style={styles.endMessageText}>You've reached the end</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalIcon}>
                  {selectedNotification ? getNotificationIcon(selectedNotification.type) : '🔔'}
                </Text>
                <Text style={styles.modalTitle}>Notification Details</Text>
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeButton}>
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            {selectedNotification && (
              <View style={styles.modalBody}>
                <Text style={styles.modalSubject}>
                  {selectedNotification.data.subject || 'Notification'}
                </Text>
                <Text style={styles.modalMessage}>{selectedNotification.data.message}</Text>

                <View style={styles.modalMeta}>
                  <Text style={styles.modalMetaText}>
                    {formatTimeAgo(selectedNotification.created_at)}
                  </Text>
                  {selectedNotification.data.store_name && (
                    <Text style={styles.modalStoreName}>
                      {selectedNotification.data.store_name}
                    </Text>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setShowModal(false)}
                  >
                    <Text style={styles.modalCloseBtnText}>Close</Text>
                  </TouchableOpacity>
                  {(selectedNotification.data.url || selectedNotification.data.store_id) && (
                    <TouchableOpacity
                      style={styles.modalActionBtn}
                      onPress={() => handleNotificationAction(selectedNotification)}
                    >
                      <Text style={styles.modalActionBtnText}>
                        {selectedNotification.data.url ? 'Open Link' : 'View Store'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerIconContainer: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#999',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    marginRight: 8,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CB0207',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markAllText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  notificationsList: {
    padding: 16,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: '#EBF5FF',
    borderLeftWidth: 3,
    borderLeftColor: '#CB0207',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  notificationBody: {
    flex: 1,
  },
  notificationSubject: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  unreadText: {
    color: '#000',
  },
  notificationMessage: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 11,
    color: '#999',
  },
  metaDot: {
    fontSize: 11,
    color: '#999',
    marginHorizontal: 6,
  },
  storeName: {
    fontSize: 11,
    color: '#CB0207',
    fontWeight: '600',
    flex: 1,
  },
  notificationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CB0207',
    marginRight: 8,
  },
  actionButton: {
    padding: 4,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  endMessage: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  endMessageText: {
    fontSize: 12,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  modalSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  modalMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginBottom: 20,
  },
  modalMetaText: {
    fontSize: 12,
    color: '#999',
  },
  modalStoreName: {
    fontSize: 12,
    color: '#CB0207',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
  },
  modalCloseBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    alignItems: 'center',
    marginRight: 8,
  },
  modalCloseBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  modalActionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#CB0207',
    alignItems: 'center',
    marginLeft: 8,
  },
  modalActionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});