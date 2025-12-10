import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function PhotoModal({ visible, onClose, feature }: any) {
  if (!feature) return null;
  const { properties } = feature;
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Image source={{ uri: properties.uri }} style={styles.image} resizeMode="contain" />
          <View style={styles.meta}>
            <Text style={styles.title}>{properties.id || 'Photo'}</Text>
            <Text>Created: {properties.created || properties.createdAt || ''}</Text>
            <Text>Source: {properties.source || 'photo'}</Text>
            <Text>Coordinates: {feature.geometry.coordinates[1]}, {feature.geometry.coordinates[0]}</Text>
          </View>

          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={{ color: '#fff' }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  card: { width: '90%', backgroundColor: '#fff', borderRadius: 8, padding: 12 },
  image: { width: '100%', height: 300, borderRadius: 6, backgroundColor: '#ddd' },
  meta: { marginTop: 8 },
  title: { fontWeight: '700', fontSize: 16 },
  closeBtn: { marginTop: 12, backgroundColor: '#007aff', padding: 10, borderRadius: 6, alignItems: 'center' },
});
