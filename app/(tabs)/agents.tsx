import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Searchbar } from 'react-native-paper';

import { AssetCall } from '../../components/agents/AssetCall';
import H5PViewer from '../../components/H5pViewer';
import ParallaxScrollView from '../../components/ParallaxScrollView';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';

export default function AgentsScreen() {
    const [searchQuery, setSearchQuery] = useState('');
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={ null }
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">AI Agents</ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">List of Agents</ThemedText>
        <Searchbar
            style={ styles.search }
            placeholder="Search Agents"
            onChangeText ={ setSearchQuery}
            value ={ searchQuery}
        />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <AssetCall/>
        <H5PViewer/>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  search: {
    padding: 2,
    margin: 8
  }
});
