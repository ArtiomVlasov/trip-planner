// MobileMap.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, TextInput, Button, ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import polyline from '@mapbox/polyline';

const defaultRegion = {
  latitude: 51.513,
  longitude: -0.1,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function MobileMap({ apiKey }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState({});
  const [routeData, setRouteData] = useState([]);

  const scrollViewRef = useRef(null);

  const path = useMemo(() => {
    let points = [];
    routeData.forEach((segment) => {
      const decoded = polyline.decode(segment.polyline.encodedPolyline);
      const coords = decoded.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
      points = points.concat(coords);
    });
    return points;
  }, [routeData]);

  const handleSend = async () => {
    if (!text.trim()) return;
    const id = Date.now().toString();
    const userMessage = text;
    setText('');

    try {
      await fetch('http://localhost:8000/prompt/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage, user_id: 'user123' }),
      });

      const response = await fetch('http://localhost:8000/route/');
      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        console.warn('Нет маршрутов в ответе');
        return;
      }

      const encodedPolyline = data.routes[0].polyline.encodedPolyline;
      setRouteData([{ polyline: { encodedPolyline } }]);
      setMessages((prev) => [...prev, { id, text: userMessage }]);
      setExpanded((prev) => ({ ...prev, [id]: true }));
    } catch (err) {
      console.error('Ошибка при обращении к серверу:', err);
    }
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <View style={styles.app}>
      <ScrollView style={styles.messages} ref={scrollViewRef}>
        {[...messages].reverse().map((msg, index) => {
          const isLatest = index === 0;

          return (
            <View key={msg.id} style={{ width: '100%', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <View style={styles.messageBubble}>
                  <Text style={styles.messageText}>{msg.text}</Text>
                  {isLatest && (
                    <TouchableOpacity onPress={() => toggleExpand(msg.id)} style={styles.toggleBtn}>
                      <Text style={{ color: '#007AFF' }}>
                        {expanded[msg.id] ? 'Свернуть карту' : 'Показать карту'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {isLatest && expanded[msg.id] && (
                <View style={styles.mapContainer}>
                  <MapView
                    style={styles.map}
                    initialRegion={path.length > 0 ? {
                      latitude: path[0].latitude,
                      longitude: path[0].longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    } : defaultRegion}
                  >
                    {path.length > 0 && (
                      <>
                        <Marker coordinate={path[0]} title="Start" />
                        <Marker coordinate={path[path.length - 1]} title="End" />
                        <Polyline
                          coordinates={path}
                          strokeColor="#007AFF"
                          strokeWidth={5}
                        />
                      </>
                    )}
                  </MapView>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.inputWrapper}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Введите сообщение"
          style={styles.input}
        />
        <Button title="↑" onPress={handleSend} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    padding: 10,
  },
  messages: {
    flex: 1,
    marginBottom: 10,
  },
  messageBubble: {
    backgroundColor: '#eee',
    borderRadius: 10,
    padding: 10,
    maxWidth: '80%',
  },
  messageText: {
    fontSize: 16,
  },
  toggleBtn: {
    marginTop: 5,
  },
  mapContainer: {
    height: 200,
    marginTop: 10,
  },
  map: {
    flex: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    marginRight: 10,
  },
});