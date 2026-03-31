import React, { useState } from 'react';
import { 
  View, Text, ScrollView, Image, TouchableOpacity, StyleSheet, FlatList, Modal, ActivityIndicator 
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';

const EventDetailsScreen = ({ event }) => {
  const [selectedImage, setSelectedImage] = useState(event.images[0]);
  const [shareVisible, setShareVisible] = useState(false);

  if (!event) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text>Loading event details...</Text>
      </View>
    );
  }

  const renderThumbnail = (img, index) => (
    <TouchableOpacity key={index} onPress={() => setSelectedImage(img)}>
      <Image source={{ uri: img }} style={[styles.thumbnail, selectedImage === img && styles.activeThumbnail]} />
    </TouchableOpacity>
  );

  const renderTicket = ({ item }) => (
    <View style={[
      styles.ticketCard,
      item.soldOut ? styles.ticketSoldOut : item.earlyBird && styles.ticketEarlyBird
    ]}>
      <View style={styles.ticketHeader}>
        <Text style={styles.ticketTitle}>{item.name}</Text>
        {item.earlyBird && <Text style={styles.earlyBirdLabel}>Early Bird</Text>}
      </View>
      <Text style={styles.ticketPrice}>{item.soldOut ? "Sold Out" : `$${item.price}`}</Text>
      <Text style={styles.ticketDescription}>{item.description}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Quick Actions */}
      <View style={styles.quickActionBar}>
        <TouchableOpacity style={styles.quickBtn}><Text>Share</Text></TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn}><Text>Bookmark</Text></TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn}><Text>Directions</Text></TouchableOpacity>
      </View>

      {/* Hero Section */}
      <View style={styles.heroSection}>
        <Image source={{ uri: selectedImage }} style={styles.mainImage} />
        <View style={styles.thumbnailRow}>
          {event.images.map(renderThumbnail)}
        </View>
      </View>

      {/* Event Info */}
      <View style={styles.eventInfo}>
        <Text style={styles.title}>{event.title}</Text>
        <View style={styles.badgesRow}>
          {event.badges.map((b, i) => (
            <View key={i} style={[styles.badge, b.type === 'early-bird' && styles.badgeEarlyBird]}>
              <Text>{b.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.tagsRow}>
          {event.tags.map((t, i) => <Text key={i} style={styles.tag}>{t}</Text>)}
        </View>
        <View style={styles.metaRow}>
          <Text>{event.date}</Text>
          <Text>{event.location}</Text>
        </View>
      </View>

      {/* Early Bird Alert */}
      {event.earlyBirdAlert && (
        <View style={styles.earlyBirdAlert}>
          <Ionicons name="ios-flame" size={32} color="#92400e" />
          <View>
            <Text style={styles.alertText}>{event.earlyBirdAlert}</Text>
          </View>
        </View>
      )}

      {/* Venue Section */}
      <View style={styles.venueSection}>
        <Text style={styles.sectionTitle}>Venue</Text>
        <View style={styles.venueCard}>
          <Text style={styles.venueText}><Text style={styles.bold}>Name:</Text> {event.venue.name}</Text>
          <Text style={styles.venueText}><Text style={styles.bold}>Address:</Text> {event.venue.address}</Text>
          <TouchableOpacity style={styles.directionsBtn}><Text>Get Directions</Text></TouchableOpacity>
        </View>
      </View>

      {/* Ticket Types */}
      <View style={styles.ticketSection}>
        <Text style={styles.sectionTitle}>Tickets</Text>
        <FlatList
          data={event.tickets}
          renderItem={renderTicket}
          keyExtractor={(item, index) => index.toString()}
          horizontal={false}
        />
      </View>

      {/* Organizer */}
      <View style={styles.organizerSection}>
        <Text style={styles.sectionTitle}>Organizer</Text>
        <View style={styles.organizerCard}>
          <Image source={{ uri: event.organizer.avatar }} style={styles.organizerAvatar} />
          <View>
            <Text style={styles.organizerName}>{event.organizer.name}</Text>
            <Text style={styles.organizerRating}>{event.organizer.rating} ⭐</Text>
            <TouchableOpacity style={styles.contactBtn}><Text>Contact</Text></TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Similar Events */}
      <View style={styles.similarSection}>
        <Text style={styles.sectionTitle}>Similar Events</Text>
        {event.similarEvents.map((sim, i) => (
          <View key={i} style={styles.similarItem}>
            <Image source={{ uri: sim.image }} style={styles.similarImage} />
            <View>
              <Text>{sim.title}</Text>
              <Text style={styles.similarPrice}>${sim.price}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Share Modal */}
      <Modal visible={shareVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.shareModal}>
            <Text style={styles.modalTitle}>Share this event</Text>
            <View style={styles.shareButtons}>
              <TouchableOpacity style={[styles.shareBtn, { backgroundColor: '#25d366' }]}><Text>WhatsApp</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.shareBtn, { backgroundColor: '#1da1f2' }]}><Text>Twitter</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.shareBtn, { backgroundColor: '#1877f2' }]}><Text>Facebook</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.shareBtn, { backgroundColor: '#0a66c2' }]}><Text>LinkedIn</Text></TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setShareVisible(false)} style={styles.closeModal}><Text>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  quickActionBar: { flexDirection: 'row', justifyContent: 'space-around', padding: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, marginBottom: 10 },
  quickBtn: { padding: 10, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  heroSection: { marginBottom: 20 },
  mainImage: { width: '100%', height: 250, borderRadius: 16 },
  thumbnailRow: { flexDirection: 'row', marginTop: 10, gap: 10 },
  thumbnail: { width: 60, height: 60, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  activeThumbnail: { borderColor: '#3b82f6' },
  eventInfo: { padding: 10 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 10 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: '#eff6ff', color: '#1e40af' },
  badgeEarlyBird: { backgroundColor: '#fde68a' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 },
  tag: { backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16 },
  metaRow: { flexDirection: 'row', gap: 15 },
  earlyBirdAlert: { flexDirection: 'row', padding: 15, backgroundColor: '#fde68a', borderRadius: 12, marginVertical: 15 },
  alertText: { fontWeight: '600', fontSize: 16 },
  venueSection: { padding: 10, marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
  venueCard: { padding: 15, backgroundColor: '#dbeafe', borderRadius: 12 },
  venueText: { fontSize: 16, marginBottom: 5 },
  bold: { fontWeight: '700', color: '#1e40af' },
  directionsBtn: { marginTop: 10, padding: 10, backgroundColor: '#3b82f6', borderRadius: 10 },
  ticketSection: { padding: 10, marginBottom: 20 },
  ticketCard: { padding: 15, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 10 },
  ticketSoldOut: { opacity: 0.5, backgroundColor: '#f9fafb' },
  ticketEarlyBird: { backgroundColor: '#fffbeb', borderColor: '#f59e0b' },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  ticketTitle: { fontSize: 16, fontWeight: '700' },
  earlyBirdLabel: { fontSize: 12, fontWeight: '600', backgroundColor: '#f59e0b', color: '#fff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12 },
  ticketPrice: { fontSize: 18, fontWeight: '700', color: '#10b981' },
  ticketDescription: { fontSize: 14, color: '#6b7280', marginTop: 5 },
  organizerSection: { padding: 10, marginBottom: 20 },
  organizerCard: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#f9fafb', borderRadius: 12, gap: 10 },
  organizerAvatar: { width: 60, height: 60, borderRadius: 30 },
  organizerName: { fontSize: 16, fontWeight: '700' },
  organizerRating: { fontSize: 14, color: '#6b7280' },
  contactBtn: { marginTop: 5, padding: 8, backgroundColor: '#3b82f6', borderRadius: 8 },
  similarSection: { padding: 10, marginBottom: 30 },
  similarItem: { flexDirection: 'row', gap: 10, padding: 10, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  similarImage: { width: 60, height: 60, borderRadius: 8 },
  similarPrice: { color: '#10b981', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  shareModal: { backgroundColor: '#fff', padding: 20, borderRadius: 16, width: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 15 },
  shareButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
  shareBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center' },
  closeModal: { padding: 10, backgroundColor: '#f3f4f6', borderRadius: 8, alignItems: 'center' },
});

export default EventDetailsScreen;