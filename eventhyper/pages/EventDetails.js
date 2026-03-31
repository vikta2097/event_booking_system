import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  StyleSheet,
} from 'react-native';

const { width, height } = Dimensions.get('window');

const EventDetails = ({ eventData }) => {
  const [selectedImage, setSelectedImage] = useState(eventData.images?.[0] || null);
  const [selectedTicket, setSelectedTicket] = useState(eventData.tickets?.[0] || null);

  const renderThumbnail = ({ item }) => (
    <TouchableOpacity onPress={() => setSelectedImage(item)}>
      <Image
        source={{ uri: item }}
        style={[
          styles.imageThumbnail,
          item === selectedImage && { borderColor: '#3b82f6' },
        ]}
      />
    </TouchableOpacity>
  );

  const renderTicket = (ticket) => (
    <TouchableOpacity
      key={ticket.id}
      onPress={() => setSelectedTicket(ticket)}
      style={[
        styles.ticketTypeCard,
        ticket.earlyBird && styles.ticketTypeCardEarlyBird,
        ticket.soldOut && { opacity: 0.6, backgroundColor: '#f9fafb' },
        selectedTicket?.id === ticket.id && { borderColor: '#3b82f6', borderWidth: 2 },
      ]}
      disabled={ticket.soldOut}
    >
      <View style={styles.ticketHeader}>
        <Text style={styles.ticketTitle}>{ticket.name}</Text>
      </View>
      <Text style={styles.ticketPrice}>
        {ticket.earlyBird ? ticket.discountedPrice : ticket.price} USD
      </Text>
      <Text style={styles.ticketDescription}>{ticket.description}</Text>
      {ticket.soldOut && <Text style={styles.soldOutText}>Sold Out</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Image source={{ uri: selectedImage }} style={styles.mainImage} />
          <FlatList
            data={eventData.images}
            renderItem={renderThumbnail}
            horizontal
            keyExtractor={(item, idx) => idx.toString()}
            style={styles.thumbnailList}
            showsHorizontalScrollIndicator={false}
          />
        </View>

        {/* Event Info */}
        <View style={styles.eventInfo}>
          <View style={styles.badgeContainer}>
            {eventData.badges?.map((badge, idx) => (
              <View
                key={idx}
                style={[
                  styles.badge,
                  badge.type === 'category' && styles.badgeCategory,
                  badge.type === 'soldOut' && styles.badgeSoldOut,
                  badge.type === 'earlyBird' && styles.badgeEarlyBird,
                ]}
              >
                <Text style={styles.badgeText}>{badge.text}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.title}>{eventData.title}</Text>

          <View style={styles.tagContainer}>
            {eventData.tags?.map((tag, idx) => (
              <View key={idx} style={styles.tag}>
                <Text>{tag}</Text>
              </View>
            ))}
          </View>

          <View style={styles.metaContainer}>
            <Text style={styles.metaText}>{eventData.date}</Text>
            <Text style={styles.metaText}>{eventData.location}</Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{eventData.description}</Text>
        </View>

        {/* Venue */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Venue</Text>
          <View style={styles.venueCard}>
            <Text style={styles.venueDetail}>
              <Text style={styles.venueLabel}>Address: </Text>
              {eventData.venue.address}
            </Text>
            <Text style={styles.venueDetail}>
              <Text style={styles.venueLabel}>City: </Text>
              {eventData.venue.city}
            </Text>
          </View>
        </View>

        {/* Tickets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tickets</Text>
          {eventData.tickets?.map(renderTicket)}
        </View>

        {/* Organizer */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organizer</Text>
          <View style={styles.organizerCard}>
            <Image
              source={{ uri: eventData.organizer.avatar }}
              style={styles.organizerAvatar}
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.organizerName}>{eventData.organizer.name}</Text>
              <Text>{eventData.organizer.bio}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Book Ticket Bar */}
      {selectedTicket && !selectedTicket.soldOut && (
        <View style={styles.stickyBar}>
          <View>
            <Text style={styles.stickyTicketName}>{selectedTicket.name}</Text>
            <Text style={styles.stickyTicketPrice}>
              {selectedTicket.earlyBird
                ? selectedTicket.discountedPrice
                : selectedTicket.price}{' '}
              USD
            </Text>
          </View>
          <TouchableOpacity style={styles.stickyBookButton}>
            <Text style={styles.stickyBookButtonText}>Book Now</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  heroSection: { width, height: 300 },
  mainImage: { width: '100%', height: 300 },
  thumbnailList: { marginTop: 8, paddingLeft: 8 },
  imageThumbnail: {
    width: 70,
    height: 70,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  eventInfo: { padding: 16 },
  badgeContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 4,
    marginBottom: 4,
    backgroundColor: '#e5e7eb',
  },
  badgeCategory: { backgroundColor: '#3b82f6' },
  badgeEarlyBird: { backgroundColor: '#22c55e' },
  badgeSoldOut: { backgroundColor: '#ef4444' },
  badgeText: { color: '#fff', fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    marginRight: 4,
    marginBottom: 4,
  },
  metaContainer: { flexDirection: 'row', gap: 16 },
  metaText: { color: '#6b7280' },
  section: { paddingHorizontal: 16, paddingTop: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  description: { fontSize: 16, color: '#374151', lineHeight: 22 },
  venueCard: { padding: 16, backgroundColor: '#f9fafb', borderRadius: 12 },
  venueLabel: { fontWeight: '700' },
  venueDetail: { marginBottom: 4 },
  ticketTypeCard: {
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    marginBottom: 12,
  },
  ticketTypeCardEarlyBird: { borderColor: '#22c55e', borderWidth: 2 },
  ticketHeader: { marginBottom: 4 },
  ticketTitle: { fontSize: 18, fontWeight: '700' },
  ticketPrice: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  ticketDescription: { color: '#6b7280', marginBottom: 8 },
  soldOutText: { color: '#991b1b', fontWeight: '600', marginBottom: 8 },
  organizerCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    alignItems: 'center',
  },
  organizerAvatar: { width: 60, height: 60, borderRadius: 30 },
  organizerName: { fontSize: 18, fontWeight: '700', marginBottom: 4 },

  // Sticky Bar Styles
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stickyTicketName: { fontSize: 16, fontWeight: '700' },
  stickyTicketPrice: { fontSize: 16, color: '#6b7280' },
  stickyBookButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  stickyBookButtonText: { color: '#fff', fontWeight: '700' },
});

export default EventDetails;