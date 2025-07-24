// App.js
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import MapComponent from './components/maps/MapComponent';

export default function App() {
  const [apiKey, setApiKey] = useState(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/maps-key')
      .then((res) => res.json())
      .then((data) => setApiKey(data.apiKey));
  }, []);

  if (!apiKey) {
     return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading API key...</Text>
      </View>
    );
  }

  return <MapComponent apiKey={apiKey} />;
}