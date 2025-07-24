// MapComponent.web.jsx
import React from 'react';
import {
  GoogleMap,
  Marker,
  Polyline,
  useJsApiLoader,
} from '@react-google-maps/api';
import { useSharedMapLogic } from '../chat/ChatWithMap';
import '../../App.css';

const containerStyle = {
  width: '100%',
  height: '200px',
};

const defaultCenter = {
  lat: 51.513,
  lng: -0.1,
};

export default function WebMap({ apiKey }) {
  const {
    messages,
    text,
    setText,
    expanded,
    path,
    handleSend,
    toggleExpand,
    messagesEndRef,
  } = useSharedMapLogic(apiKey);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
  });

  return (
    <div className="app">
      <div className="messages">
        {[...messages].reverse().map((msg, index) => {
          const isLatest = index === 0;

          return (
            <div key={msg.id} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div className="message-bubble">
                  <div className="message-text">{msg.text}</div>
                  {isLatest && (
                    <button onClick={() => toggleExpand(msg.id)} className="toggle-btn">
                      {expanded[msg.id] ? 'Свернуть карту' : 'Показать карту'}
                    </button>
                  )}
                </div>
              </div>

              {isLatest && expanded[msg.id] && (
                <div className="map-container">
                  <GoogleMap
                    mapContainerStyle={containerStyle}
                    center={path.length > 0 ? path[0] : defaultCenter}
                    zoom={16}
                  >
                    {path.length > 0 && (
                      <>
                        <Marker position={path[0]} label="Start" />
                        <Marker position={path[path.length - 1]} label="End" />
                        <Polyline
                          path={path}
                          options={{
                            strokeColor: '#007AFF',
                            strokeOpacity: 0.8,
                            strokeWeight: 5,
                          }}
                        />
                      </>
                    )}
                  </GoogleMap>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-wrapper">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="input"
          placeholder="Введите сообщение"
        />
        <button onClick={handleSend} className="send-button">↑</button>
      </div>
    </div>
  );
}