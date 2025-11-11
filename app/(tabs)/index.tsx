import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { Button } from '@react-navigation/elements';
import { useRouter } from 'expo-router';
import { HelloWave } from '../../components/HelloWave';
import ParallaxScrollView from '../../components/ParallaxScrollView';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';

export default function HomeScreen() {
  const router = useRouter();
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Bombeke Beyond Data Platform</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ThemedText style={{ fontWeight: 700, padding: 4}}>Call Credits</ThemedText>
            <ThemedView style={ styles.creditContainer}>
              <ThemedView style={ styles.callTime}>
                <ThemedText>Remaining Time: </ThemedText>
                <ThemedText>5 min </ThemedText>
              </ThemedView>
              <ThemedView style={ styles.callTime}>
                <ThemedText>Spent Time:</ThemedText>
                <ThemedText>100 min </ThemedText>
              </ThemedView>
            </ThemedView>
          <Button style={ styles.buyCredits} onPress={() => router.navigate('/(tabs)/explore')}>
            Buy Credits
          </Button>
        </ThemedView>
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
  creditContainer:{
    flexDirection: 'column',
    padding: 4
  },
  callTime:{
    flexDirection: 'row',
    padding: 4
  },
  buyCredits:{
    marginBottom: 4
  }
});
