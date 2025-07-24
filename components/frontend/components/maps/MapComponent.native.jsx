// MobileMap.js
import React, { useRef } from 'react';
import { View, TextInput, Button, ScrollView, Text, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSharedMapLogic } from '../chat/ChatWithMap';
import styles from '../../MobileAppStyles'; // Импортируем стили

const defaultRegion = {
  latitude: 51.513,
  longitude: -0.1,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function MobileMap({ apiKey }) {
  const scrollViewRef = useRef(null);
  
  const {
    messages,
    text,
    setText,
    expanded,
    path,
    handleSend,
    toggleExpand,
  } = useSharedMapLogic(apiKey);

  return (
    <View style={styles.app}>
      <ScrollView 
        style={styles.messages} 
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
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
                      latitude: path[0].lat,
                      longitude: path[0].lng,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    } : defaultRegion}
                  >
                    {path.length > 0 && (
                      <>
                        <Marker coordinate={{ latitude: path[0].lat, longitude: path[0].lng }} title="Start" />
                        <Marker coordinate={{ 
                          latitude: path[path.length - 1].lat, 
                          longitude: path[path.length - 1].lng 
                        }} title="End" />
                        <Polyline
                          coordinates={path.map(p => ({
                            latitude: p.lat,
                            longitude: p.lng
                          }))}
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