// WebMap.jsx
import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  GoogleMap,
  Marker,
  Polyline,
  useJsApiLoader,
} from '@react-google-maps/api';
import polyline from '@mapbox/polyline';
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
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState({});
  const [routeData, setRouteData] = useState([]);
  const messagesEndRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
  });

  const path = useMemo(() => {
    let points = [];
    routeData.forEach((segment) => {
      const decoded = polyline.decode(segment.polyline.encodedPolyline);
      const coords = decoded.map(([lat, lng]) => ({ lat, lng }));
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isLoaded) return <div>Загрузка карты...</div>;

  return (
    <div className="app">
      <div className="messages">
        {[...messages].reverse().map((msg, index) => {
          const isLatest = index === 0; // самое последнее сообщение

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