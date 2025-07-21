import { useState, useEffect, useRef, useMemo } from 'react';
import polyline from '@mapbox/polyline';

export function useSharedMapLogic(apiKey) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState({});
  const [routeData, setRouteData] = useState([]);
  const messagesEndRef = useRef(null);

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
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages]);

  return {
    messages,
    text,
    setText,
    expanded,
    path,
    handleSend,
    toggleExpand,
    messagesEndRef,
  };
}