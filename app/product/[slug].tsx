import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
  Share,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Heart,
  Phone,
  MessageCircle,
  Star,
  Shield,
  AlertTriangle,
  Send,
  Share2,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  wholesale_price?: string;
  brand?: string;
  average_rating?: number;
  images: Array<{ id: string; url: string }>;
  store: {
    id: string;
    name: string;
    store_lga: string;
    store_state: string;
    store_image?: string;
    phone_number: string;
  };
  reviews?: Array<{
    id: string;
    rating: number;
    comment: string;
    user: { name: string };
    created_at: string;
  }>;
}

interface SimilarProduct {
  id: string;
  name: string;
  slug: string;
  price: string;
  average_rating: number;
  images: Array<{ url: string }>;
  store: {
    name: string;
    store_lga: string;
    store_state: string;
  };
}

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams();
  const router = useRouter();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isMerchant, setIsMerchant] = useState(false);
  const [wishlistItems, setWishlistItems] = useState<string[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [similarProducts, setSimilarProducts] = useState<SimilarProduct[]>([]);
  
  // Review form states
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  
  // Image swipe
  const scrollX = useRef(new Animated.Value(0)).current;
  const imageScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    checkAuth();
    if (slug) {
      fetchProduct(slug as string);
    }
  }, [slug]);

  const checkAuth = async () => {
    const token = await AsyncStorage.getItem('auth_token');
    setIsAuthenticated(!!token);
    if (token) {
      fetchWishlist(token);
      checkMerchantStatus(token);
    }
  };

  const checkMerchantStatus = async (token: string) => {
    try {
      const response = await fetch('https://api.strapre.com/api/v1/mystore', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setIsMerchant(!!data && Object.keys(data).length > 0);
      }
    } catch (error) {
      console.error('Error checking merchant status:', error);
    }
  };

  const fetchWishlist = async (token: string) => {
    try {
      const response = await fetch('https://api.strapre.com/api/v1/wishlist', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        const productIds = data.data?.map((item: any) => item.product_id) || [];
        setWishlistItems(productIds);
      }
    } catch (error) {
      console.error('Error fetching wishlist:', error);
    }
  };

  const fetchProduct = async (productSlug: string) => {
    try {
      setLoading(true);
      const response = await fetch(`https://api.strapre.com/api/v1/products/${productSlug}`);
      const data = await response.json();
      
      if (response.ok) {
        setProduct(data.data);
        if (data.data.reviews) {
          setReviews(data.data.reviews);
        }
        fetchSimilarProducts(data.data.name, data.data.id);
      } else {
        Alert.alert('Error', 'Product not found');
        router.back();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load product');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const fetchSimilarProducts = async (productName: string, currentProductId: string) => {
    try {
      const params = new URLSearchParams({
        search: productName,
        limit: '6',
      });
      
      const response = await fetch(`https://api.strapre.com/api/v1/products/search?${params.toString()}`);
      const data = await response.json();
      
      if (response.ok) {
        const filtered = data.data
          .filter((p: any) => p.id !== currentProductId)
          .slice(0, 5);
        setSimilarProducts(filtered);
      }
    } catch (error) {
      console.error('Error fetching similar products:', error);
    }
  };

  const formatPrice = (price: string) => {
    const numPrice = parseFloat(price);
    return `₦${numPrice.toLocaleString()}`;
  };

  const handleWhatsApp = () => {
    if (!product) return;
    
    const message = `Hello, I saw an advert you placed on Strapre. I am interested. Is it still available?`;
    const phoneNumber = product.store.phone_number.replace(/\D/g, '');
    const formattedPhone = phoneNumber.startsWith('234') ? phoneNumber : `234${phoneNumber.replace(/^0/, '')}`;
    
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(whatsappUrl);
  };

  const handleCall = () => {
    if (!product) return;
    Linking.openURL(`tel:${product.store.phone_number}`);
  };

  const handleShare = async () => {
    if (!product) return;
    
    try {
      await Share.share({
        message: `Check out ${product.name} on Strapre - ${formatPrice(product.price)}`,
        title: product.name,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const toggleWishlist = async () => {
    if (!isAuthenticated) {
      Alert.alert('Login Required', 'Please login to add items to wishlist');
      return;
    }

    if (!product) return;

    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const isInWishlist = wishlistItems.includes(product.id);

      if (isInWishlist) {
        // Remove from wishlist
        const response = await fetch(`https://api.strapre.com/api/v1/wishlist/${product.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          setWishlistItems(wishlistItems.filter(id => id !== product.id));
        }
      } else {
        // Add to wishlist
        const response = await fetch('https://api.strapre.com/api/v1/wishlist', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ product_id: product.id }),
        });
        if (response.ok) {
          setWishlistItems([...wishlistItems, product.id]);
        }
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
    }
  };

  const submitReview = async () => {
    if (!isAuthenticated) {
      Alert.alert('Login Required', 'Please login to write a review');
      return;
    }

    if (reviewRating === 0 || !reviewComment.trim()) {
      Alert.alert('Error', 'Please provide a rating and comment');
      return;
    }

    setReviewLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch('https://api.strapre.com/api/v1/reviews', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: product?.id,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Review submitted successfully');
        setShowReviewForm(false);
        setReviewRating(0);
        setReviewComment('');
        // Refresh product to get updated reviews
        if (slug) {
          fetchProduct(slug as string);
        }
      } else {
        Alert.alert('Error', 'Failed to submit review');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to submit review');
    } finally {
      setReviewLoading(false);
    }
  };

  const StarRating = ({ rating, onRate, interactive = false }: any) => (
    <View style={styles.starContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
            key={star}
            onPress={() => interactive && onRate?.(star)}
            disabled={!interactive}
            style={{ marginRight: star < 5 ? 4 : 0 }}
        >
            <Star
            size={20}
            color="#FCD34D"
            fill={star <= rating ? '#FCD34D' : 'none'}
            />
        </TouchableOpacity>
        ))}
    </View>
  );

  const renderImagePagination = () => {
    if (!product || product.images.length <= 1) return null;

    return (
      <View style={styles.pagination}>
        {product.images.map((_, index) => (
            <View
                key={index}
                style={[
                styles.paginationDot,
                selectedImageIndex === index && styles.paginationDotActive,
                { marginHorizontal: 3 },
                ]}
            />
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#CB0207" />
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar style="dark" />
        <Text style={styles.errorText}>Product not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle} numberOfLines={1}>
          {product.name}
        </Text>
        
        <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleShare} style={[styles.headerButton, { marginRight: 8 }]}>
                <Share2 size={22} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleWishlist} style={styles.headerButton}>
            <Heart
              size={22}
              color={wishlistItems.includes(product.id) ? '#CB0207' : '#333'}
              fill={wishlistItems.includes(product.id) ? '#CB0207' : 'none'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Carousel */}
        <View style={styles.imageCarouselContainer}>
          <ScrollView
            ref={imageScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              {
                useNativeDriver: false,
                listener: (event: any) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / width);
                  setSelectedImageIndex(index);
                },
              }
            )}
            scrollEventThrottle={16}
          >
            {product.images && product.images.length > 0 && product.images.map((image, index) => (
                <View key={image.id} style={styles.imageSlide}>
                <Image
                  source={{ uri: image.url }}
                  style={styles.productImage}
                  resizeMode="cover"
                />
              </View>
            ))}
          </ScrollView>

          {renderImagePagination()}

          {/* Image Counter */}
          {product.images.length > 1 && (
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>
                {selectedImageIndex + 1} / {product.images.length}
              </Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.contentContainer}>
          {/* Title and Brand */}
          <View style={styles.titleSection}>
            <Text style={styles.productTitle}>{product.name}</Text>
            {product.brand && product.brand.trim() !== '' && (
              <View style={styles.brandBadge}>
                <Text style={styles.brandText}>{product.brand}</Text>
              </View>
            )}
          </View>

          {/* Rating */}
          {product.average_rating !== undefined && product.average_rating !== null && (
          <View style={styles.ratingSection}>
              <StarRating rating={product.average_rating} />
              <Text style={styles.ratingText}>
              {product.average_rating.toFixed(1)} <Text>({reviews.length} reviews)</Text>
              </Text>
          </View>
          )}

          {/* Price Section */}
          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Retail Price</Text>
              <Text style={styles.priceValue}>{formatPrice(product.price)}</Text>
            </View>
            
            {isMerchant && product.wholesale_price && product.wholesale_price !== '0' && product.wholesale_price !== '0.00' && (
              <>
                <View style={styles.priceDivider} />
                <View style={styles.priceRow}>
                  <Text style={styles.merchantPriceLabel}>Merchant Price</Text>
                  <Text style={styles.merchantPriceValue}>
                    {formatPrice(product.wholesale_price)}
                  </Text>
                </View>
                <Text style={styles.merchantNote}>Vendor to Vendor price</Text>
              </>
            )}
          </View>

          {/* Store Info */}
          <View style={styles.storeCard}>
            <View style={styles.storeHeader}>
              <View style={styles.storeAvatar}>
                {product.store.store_image ? (
                  <Image
                    source={{ uri: product.store.store_image }}
                    style={styles.storeAvatarImage}
                  />
                ) : (
                  <Text style={styles.storeAvatarText}>
                    {product.store.name.charAt(0)}
                  </Text>
                )}
              </View>
              <View style={styles.storeInfo}>
                <Text style={styles.storeName}>{product.store.name}</Text>
                <Text style={styles.storeLocation}>
                    <Text>📍 </Text>
                    {product.store.store_lga}, {product.store.store_state}
                </Text>
              </View>
            </View>
          </View>

          {/* Safety Tips */}
          <View style={styles.safetyCard}>
            <View style={styles.safetyHeader}>
                <View style={{ marginRight: 8 }}>
                    <Shield size={20} color="#F59E0B" />
                </View>
                <Text style={styles.safetyTitle}>Safety Tips</Text>
            </View>
            <View style={styles.safetyTip}>
                <View style={{ marginRight: 8 }}>
                    <AlertTriangle size={16} color="#F59E0B" />
                </View>
                <Text style={styles.safetyText}>
                    Always inspect the product thoroughly before making any payment
                </Text>
            </View>
            <View style={styles.safetyTip}>
                <View style={{ marginRight: 8 }}>
                    <AlertTriangle size={16} color="#F59E0B" />
                </View>
                <Text style={styles.safetyText}>
                Meet in a safe, public location when possible
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
                style={styles.whatsappButton}
                onPress={handleWhatsApp}
                activeOpacity={0.8}
                >
                <View style={{ marginRight: 8 }}>
                    <MessageCircle size={20} color="#fff" />
                </View>
                <Text style={styles.whatsappButtonText}>Message on WhatsApp</Text>
            </TouchableOpacity>

            <View style={styles.secondaryActions}>
              <TouchableOpacity
                style={styles.callButton}
                onPress={handleCall}
                activeOpacity={0.8}
                >
                <View style={{ marginRight: 8 }}>
                    <Phone size={20} color="#CB0207" />
                </View>
                <Text style={styles.callButtonText}>Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShare}
                activeOpacity={0.8}
                >
                <View style={{ marginRight: 8 }}>
                    <Share2 size={20} color="#666" />
                </View>
                <Text style={styles.shareButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Description */}
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionTitle}>
                <Text>📋 </Text>
                Product Details
            </Text>
            <Text style={styles.descriptionText}>{product.description}</Text>
          </View>

          {/* Reviews Section */}
          <View style={styles.reviewsSection}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.reviewsTitle}>Customer Reviews</Text>
              {isAuthenticated && (
                <TouchableOpacity
                  style={styles.writeReviewButton}
                  onPress={() => setShowReviewForm(true)}
                >
                  <Text style={styles.writeReviewText}>Write Review</Text>
                </TouchableOpacity>
              )}
            </View>

            {reviews.length > 0 ? (
              reviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerAvatar}>
                      <Text style={styles.reviewerInitial}>
                        {review.user.name.charAt(0)}
                      </Text>
                    </View>
                    <View style={styles.reviewerInfo}>
                      <Text style={styles.reviewerName}>{review.user.name}</Text>
                      <StarRating rating={review.rating} />
                    </View>
                  </View>
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                  <Text style={styles.reviewDate}>{review.created_at}</Text>
                </View>
              ))
            ) : (
              <View style={styles.noReviewsCard}>
                <Star size={40} color="#ccc" />
                <Text style={styles.noReviewsTitle}>No reviews yet</Text>
                <Text style={styles.noReviewsText}>
                  Be the first to review this product!
                </Text>
              </View>
            )}
          </View>

          {/* Similar Products */}
          {similarProducts.length > 0 && (
            <View style={styles.similarSection}>
              <Text style={styles.similarTitle}>Similar Products</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {similarProducts.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.similarCard}
                    onPress={() => router.push(`/product/${item.slug}`)}
                    >
                    {item.images && item.images[0] && (
                        <Image
                        source={{ uri: item.images[0].url }}
                        style={styles.similarImage}
                        />
                    )}
                    {!item.images || !item.images[0] && (
                        <View style={styles.similarImage} />
                    )}
                    <Text style={styles.similarName} numberOfLines={2}>
                        {item.name}
                    </Text>
                    <Text style={styles.similarPrice}>
                        {formatPrice(item.price)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Review Modal */}
      <Modal
        visible={showReviewForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReviewForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Write Your Review</Text>
            
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Rating</Text>
              <StarRating
                rating={reviewRating}
                onRate={setReviewRating}
                interactive
              />
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Comment</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="Share your experience..."
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSubmitButton}
                onPress={submitReview}
                disabled={reviewLoading || reviewRating === 0}
              >
                {reviewLoading ? (
                    <ActivityIndicator color="#fff" />
                    ) : (
                    <>
                        <View style={{ marginRight: 8 }}>
                        <Send size={16} color="#fff" />
                        </View>
                        <Text style={styles.modalSubmitText}>Submit</Text>
                    </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowReviewForm(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: '#f5f5f5',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#CB0207',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 12,
  },
  headerActions: {
    flexDirection: 'row',
  },
  imageCarouselContainer: {
    height: width,
    backgroundColor: '#f0f0f0',
  },
  imageSlide: {
    width: width,
    height: width,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  pagination: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  paginationDotActive: {
    backgroundColor: '#fff',
    width: 24,
  },
  imageCounter: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  contentContainer: {
    padding: 16,
  },
  titleSection: {
    marginBottom: 12,
  },
  productTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  brandBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  brandText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  starContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
  },
  priceCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  priceRow: {
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  priceValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#e5e5e5',
    marginVertical: 12,
  },
  merchantPriceLabel: {
    fontSize: 12,
    color: '#CB0207',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  merchantPriceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#CB0207',
  },
  merchantNote: {
    fontSize: 11,
    color: '#CB0207',
    marginTop: 4,
  },
  storeCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  storeAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  storeAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#CB0207',
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  storeLocation: {
    fontSize: 13,
    color: '#666',
  },
  safetyCard: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  safetyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginLeft: 8,
  },
  safetyTip: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  safetyText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    marginLeft: 8,
  },
  actionsContainer: {
    marginBottom: 16,
  },
  whatsappButton: {
    backgroundColor: '#CB0207',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  whatsappButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CB0207',
    marginRight: 12,
  },
  callButtonText: {
    color: '#CB0207',
    fontSize: 15,
    fontWeight: '600',
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  shareButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  descriptionCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  reviewsSection: {
    marginBottom: 16,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  writeReviewButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CB0207',
  },
  writeReviewText: {
    color: '#CB0207',
    fontSize: 14,
    fontWeight: '600',
  },
  reviewCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reviewerInitial: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reviewComment: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: '#999',
  },
  noReviewsCard: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  noReviewsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 4,
  },
  noReviewsText: {
    fontSize: 14,
    color: '#666',
  },
  similarSection: {
    marginTop: 8,
  },
  similarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  similarCard: {
    backgroundColor: '#fff',
    width: 150,
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  similarImage: {
    width: 150,
    height: 150,
    backgroundColor: '#f0f0f0',
  },
  similarName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    padding: 8,
    paddingBottom: 4,
    height: 42,
  },
  similarPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#CB0207',
    paddingHorizontal: 8,
    paddingBottom: 8,
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
    padding: 24,
    maxHeight: height * 0.8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  modalTextInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#333',
    minHeight: 100,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 24,
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: '#CB0207',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginRight: 12,
  },
  modalSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalCancelText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});