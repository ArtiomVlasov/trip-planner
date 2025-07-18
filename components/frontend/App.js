// App.js
import React, { useEffect, useState } from 'react';
import MapComponent from './components/maps/MapComponent'; // см. ниже

export default function App() {
  const [apiKey, setApiKey] = useState(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/maps-key')
      .then((res) => res.json())
      .then((data) => setApiKey(data.apiKey));
  }, []);

  if (!apiKey) {
    return <div>Загрузка ключа карты...</div>;
  }

  return <MapComponent apiKey={apiKey} />;
}