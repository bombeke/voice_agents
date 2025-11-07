import { useSipApi } from '@/hooks/useSipApiCall';
import { FontAwesome6 } from '@expo/vector-icons';
import { Component, ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';


const calls = [
  {
    id: 1,
    tel: "+12762700060",
    title: "Information",
    subtitle: "",
    description: "Are you stuck? Dial the agent for more information."
  },
  {
    id: 2,
    tel: "125",
    title: "Emergency",
    description: "Are you in an emergency? Dial the agent for Help"
  },
  {
    id: 3,
    tel: "126",
    title: "Ambulance",
    description: "Do you need ambulance services or directions? Dial the agent for ambulance services available in your location."
  }
];

export const AssetCall = ({ children }: ReactNode | Component | any) => {
  const { initiateCall, terminateCall, callStatus, activeCall } = useSipApi();
  const [selectedMode, setSelectedMode] = useState<string>('elevated');

  const handleCall = (number: string | null) => {
    if (callStatus === 'in-call') {
      terminateCall();
    } 
    else {
      initiateCall(number);
    }
  };
  
  const getIcon = () => {
    switch (callStatus) {
      case 'in-call':
        return (<FontAwesome6 name="phone-volume" color={'white'} size={26} />);
      case 'calling':
        return (<FontAwesome6 name="phone-slash" color={'white'} size={26} />);
      default:
        return (<FontAwesome6 name="phone" color={'white'} size={26} />);
    }
  };
  
  const getButtonText = (tel: string | null = null) => {
    switch (callStatus) {
      case 'in-call':
        return `End Call ${tel??""}`;
      case 'calling':
        return `Calling ${tel??""}`;
      default:
        return `Call ${tel??""}`;
    }
  };
  
  return (
    <View style={ styles.container}>
      { children }
      {
        calls.map((call,i) => (
          <Card style={styles.card}  key={i} elevation ={0} mode={selectedMode as any}>
            <Card.Title
              title={ call.title}
              subtitle={call.subtitle}
              titleVariant="headlineMedium"
              subtitleVariant="bodyLarge"
            />
            <Card.Content>
              <Text variant="bodyMedium">
                { call.description}
              </Text>
            </Card.Content>
          <Card.Actions>
            <Button     
              mode={'contained'}        
              onPress={(_e: any) => handleCall(call.tel)}
              disabled={call.tel === activeCall && callStatus === 'calling'}
              icon={() => getIcon()}>{ getButtonText()}
            </Button>
          </Card.Actions>
        </Card>
        ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 150,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  button:{
    padding: 8,
    margin: 8
  },
  content: {
    padding: 4,
  },
  card: {
    margin: 8,
    padding:8
  },
  chip: {
    margin: 4,
  },
  preference: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  customCardRadius: {
    borderTopLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  customCoverRadius: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 24,
  },
});