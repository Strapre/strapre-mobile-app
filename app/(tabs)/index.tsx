import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TextInput,
  FlatList,
  RefreshControl,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { 
  Search, 
  Filter, 
  MapPin, 
  Heart, 
  Star, 
  ChevronLeft, 
  ChevronRight,
  Bell
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface Product {
  id: string;
  name: string;
  slug: string;
  price: string;
  images: Array<{ url: string }>;
  store: {
    name: string;
    store_lga?: string;
    store_state?: string;
  };
  average_rating: number;
  is_featured: number;
}

interface Advert {
  id: string;
  title: string;
  image: string;
  link: string;
}

export default function HomeScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [adverts, setAdverts] = useState<Advert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [wishlistItems, setWishlistItems] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkAuth();
    fetchProducts();
    fetchAdverts();
  }, []);

  // Auto-scroll adverts
  useEffect(() => {
    if (adverts.length > 1) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % adverts.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [adverts.length]);

  const checkAuth = async () => {
    // Check if user is logged in (implement your auth logic)
    // const token = await AsyncStorage.getItem('auth_token');
    // setIsAuthenticated(!!token);
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://api.strapre.com/api/v1/products?page=1');
      const data = await response.json();
      setProducts(data.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add this function near the top of your component
  const handleNotificationPress = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        // No token, just redirect to login
        await AsyncStorage.setItem('redirect_after_login', '/notifications');
        router.push('/login');
        return;
      }

      // Check if token is valid by fetching notifications
      const response = await fetch('https://api.strapre.com/api/v1/notifications', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.status === 401 || data.message === 'Unauthenticated.') {
        // Token expired or invalid, just redirect to login
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.setItem('redirect_after_login', '/notifications');
        router.push('/login');
        return;
      }

      // Valid token, navigate to notifications page
      router.push('/notifications');
    } catch (error) {
      console.error('Error checking authentication:', error);
      // Even on error, just navigate to notifications - it will handle auth there
      router.push('/notifications');
    }
  };

  const fetchAdverts = async () => {
    try {
      const response = await fetch('https://api.strapre.com/api/v1/adverts/dummy');
      const data = await response.json();
      setAdverts(data.data || []);
    } catch (error) {
      console.error('Error fetching adverts:', error);
      setAdverts([
        {
          id: '1',
          title: 'Strapre - Gadget Home',
          image: 'https://via.placeholder.com/800x400',
          link: '#',
        },
      ]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProducts();
    await fetchAdverts();
    setRefreshing(false);
  };

  const toggleWishlist = (productId: string) => {
    if (wishlistItems.includes(productId)) {
      setWishlistItems(wishlistItems.filter(id => id !== productId));
    } else {
      setWishlistItems([...wishlistItems, productId]);
    }
  };

  const formatPrice = (price: string) => {
    const numPrice = parseFloat(price);
    return `₦${numPrice.toLocaleString()}`;
  };

  const renderProductCard = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.productCard}
      activeOpacity={0.7}
      onPress={() => router.push(`/product/${item.slug}`)}
    >
      <View style={styles.productImageContainer}>
        <Image
          source={{ uri: item.images[0]?.url || 'https://via.placeholder.com/200' }}
          style={styles.productImage}
          resizeMode="cover"
        />
        {item.is_featured === 1 && (
          <View style={styles.adBadge}>
            <Text style={styles.adBadgeText}>Ad</Text>
          </View>
        )}
        {isAuthenticated && (
          <TouchableOpacity
            style={[
              styles.wishlistButton,
              wishlistItems.includes(item.id) && styles.wishlistButtonActive,
            ]}
            onPress={() => toggleWishlist(item.id)}
          >
            <Heart
              size={18}
              color={wishlistItems.includes(item.id) ? '#fff' : '#666'}
              fill={wishlistItems.includes(item.id) ? '#fff' : 'none'}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
        
        <View style={styles.ratingContainer}>
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              size={12}
              color="#FCD34D"
              fill={i < Math.floor(item.average_rating) ? '#FCD34D' : 'none'}
            />
          ))}
          <Text style={styles.ratingText}>({item.average_rating || 0})</Text>
        </View>

        <View style={styles.locationContainer}>
          <MapPin size={12} color="#999" />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.store.store_lga || 'N/A'}, {item.store.store_state || 'N/A'}
          </Text>
        </View>

        <Text style={styles.storeName} numberOfLines={1}>
          Store: {item.store.name}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      {/* Add this StatusBar component */}
      <StatusBar 
        barStyle="dark-content"  // Use "dark-content" for light backgrounds
        backgroundColor="#ffffff" // Android only
      />
      
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Image 
              source={require('@/assets/images/head.png')} 
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <TouchableOpacity 
              style={styles.notificationButton}
              onPress={handleNotificationPress}
            >
              <Bell size={24} color="#CB0207" />
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}></Text>
              </View>
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <Search size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
            <TouchableOpacity style={styles.filterButton}>
              <Filter size={20} color="#CB0207" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#CB0207']} />
          }
        >
          {/* Hero Carousel */}
          <View style={styles.heroContainer}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: false }
              )}
              scrollEventThrottle={16}
            >
              {adverts.map((advert) => (
                <TouchableOpacity
                  key={advert.id}
                  style={styles.heroSlide}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{ uri: advert.image }}
                    style={styles.heroImage}
                    resizeMode="cover"
                  />
                  <View style={styles.heroOverlay}>
                    <Text style={styles.heroTitle}>{advert.title}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Pagination Dots */}
            <View style={styles.pagination}>
              {adverts.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.paginationDot,
                    currentSlide === index && styles.paginationDotActive,
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Products Section */}
          <View style={styles.productsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🔥 Hot Sales</Text>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#CB0207" />
              </View>
            ) : (
              <FlatList
                data={products}
                renderItem={renderProductCard}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={styles.productRow}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLogo: {
    width: 90,  // Adjust based on your logo size
    height: 40,  // Adjust based on your logo size
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#CB0207',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize:10,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  filterButton: {
    padding: 8,
  },
  heroContainer: {
    height: 150,
    marginTop: 12,
    position: 'relative',
  },
  heroSlide: {
    width: width,
    height: 150,
    paddingHorizontal: 16,
  },
  heroImage: {
    width: width - 32,
    height: 150,
    borderRadius: 16,
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 32,
    right: 32,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  pagination: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#fff',
    width: 24,
  },
  productsSection: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    paddingVertical: 40,
  },
  productRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productImageContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  adBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#CB0207',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  adBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  wishlistButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wishlistButtonActive: {
    backgroundColor: '#CB0207',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    height: 36,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#CB0207',
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingText: {
    fontSize: 10,
    color: '#666',
    marginLeft: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 11,
    color: '#999',
    marginLeft: 4,
    flex: 1,
  },
  storeName: {
    fontSize: 11,
    color: '#999',
  },
});