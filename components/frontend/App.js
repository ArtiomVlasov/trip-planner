import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  GoogleMap,
  Marker,
  Polyline,
  useJsApiLoader,
} from '@react-google-maps/api';
import polyline from '@mapbox/polyline';
import './App.css';

const containerStyle = {
  width: '100%',
  height: '200px',
};

const defaultCenter = {
  lat: 51.513,
  lng: -0.1,
};


const segments = [
  {
        "distanceMeters": 38,
        "staticDuration": "30s",
        "polyline": {
            "encodedPolyline": "aclyHxmREvB"
        },
        "startLocation": {
            "latLng": {
                "latitude": 51.512969999999996,
                "longitude": -0.09964569999999999
            }
        },
        "endLocation": {
            "latLng": {
                "latitude": 51.512998599999996,
                "longitude": -0.1002467
            }
        },
        "navigationInstruction": {
            "maneuver": "DEPART",
            "instructions": "Head west on Carter Ln toward New Bell Yard"
        },
        "localizedValues": {
            "distance": {
                "text": "38 m"
            },
            "staticDuration": {
                "text": "1 min"
            }
        },
        "travelMode": "WALK"
    },
    {
        "distanceMeters": 55,
        "staticDuration": "51s",
        "polyline": {
            "encodedPolyline": "gclyHpqR_AI_@YU_@"
        },
        "startLocation": {
            "latLng": {
                "latitude": 51.512998599999996,
                "longitude": -0.1002467
            }
        },
        "endLocation": {
            "latLng": {
                "latitude": 51.5135862,
                "longitude": -0.0999147
            }
        },
        "navigationInstruction": {
            "maneuver": "TURN_RIGHT",
            "instructions": "Turn right onto Dean's Ct"
        },
        "localizedValues": {
            "distance": {
                "text": "55 m"
            },
            "staticDuration": {
                "text": "1 min"
            }
        },
        "travelMode": "WALK"
    },
    {
        "distanceMeters": 23,
        "staticDuration": "29s",
        "polyline": {
            "encodedPolyline": "}flyHloR[p@"
        },
        "startLocation": {
            "latLng": {
                "latitude": 51.5135862,
                "longitude": -0.0999147
            }
        },
        "endLocation": {
            "latLng": {
                "latitude": 51.5137301,
                "longitude": -0.1001628
            }
        },
        "navigationInstruction": {
            "maneuver": "TURN_LEFT",
            "instructions": "Turn left onto St. Paul's Churchyard"
        },
        "localizedValues": {
            "distance": {
                "text": "23 m"
            },
            "staticDuration": {
                "text": "1 min"
            }
        },
        "travelMode": "WALK"
    },
    {
        "distanceMeters": 152,
        "staticDuration": "127s",
        "polyline": {
            "encodedPolyline": "yglyH~pR[c@Qe@Ee@EMKIWqDGg@"
        },
        "startLocation": {
            "latLng": {
                "latitude": 51.5137301,
                "longitude": -0.1001628
            }
        },
        "endLocation": {
            "latLng": {
                "latitude": 51.5142445,
                "longitude": -0.0983916
            }
        },
        "navigationInstruction": {
            "maneuver": "TURN_RIGHT",
            "instructions": "Turn right to stay on St. Paul's Churchyard"
        },
        "localizedValues": {
            "distance": {
                "text": "0.2 km"
            },
            "staticDuration": {
                "text": "2 mins"
            }
        },
        "travelMode": "WALK"
    },
    {
        "distanceMeters": 20,
        "staticDuration": "21s",
        "polyline": {
            "encodedPolyline": "_klyH|eRb@A"
        },
        "startLocation": {
            "latLng": {
                "latitude": 51.5142445,
                "longitude": -0.0983916
            }
        },
        "endLocation": {
            "latLng": {
                "latitude": 51.5140628,
                "longitude": -0.0983826
            }
        },
        "navigationInstruction": {
            "maneuver": "TURN_RIGHT",
            "instructions": "Turn right onto Canon Aly\nTake the stairs"
        },
        "localizedValues": {
            "distance": {
                "text": "20 m"
            },
            "staticDuration": {
                "text": "1 min"
            }
        },
        "travelMode": "WALK"
    },
    {
        "distanceMeters": 20,
        "staticDuration": "21s",
        "polyline": {
            "encodedPolyline": "{ilyHzeRc@@"
        },
        "startLocation": {
            "latLng": {
                "latitude": 51.5140628,
                "longitude": -0.0983826
            }
        },
        "endLocation": {
            "latLng": {
                "latitude": 51.5142445,
                "longitude": -0.0983916
            }
        },
        "navigationInstruction": {
            "maneuver": "DEPART",
            "instructions": "Head north on Canon Aly\nTake the stairs"
        },
        "localizedValues": {
            "distance": {
                "text": "20 m"
            },
            "staticDuration": {
                "text": "1 min"
            }
        },
        "travelMode": "WALK"
    },
    {
        "distanceMeters": 152,
        "staticDuration": "116s",
        "polyline": {
            "encodedPolyline": "_klyH|eRNdBNrBJHH^Hf@R`@PR"
        },
        "startLocation": {
            "latLng": {
                "latitude": 51.5142445,
                "longitude": -0.0983916
            }
        },
        "endLocation": {
            "latLng": {
                "latitude": 51.5137301,
                "longitude": -0.1001628
            }
        },
        "navigationInstruction": {
            "maneuver": "TURN_LEFT",
            "instructions": "Turn left onto St. Paul's Churchyard"
        },
        "localizedValues": {
            "distance": {
                "text": "0.2 km"
            },
            "staticDuration": {
                "text": "2 mins"
            }
        },
        "travelMode": "WALK"
    },
    {
        "distanceMeters": 23,
        "staticDuration": "18s",
        "polyline": {
            "encodedPolyline": "yglyH~pRZq@"
        },
        "startLocation": {
            "latLng": {
                "latitude": 51.5137301,
                "longitude": -0.1001628
            }
        },
        "endLocation": {
            "latLng": {
                "latitude": 51.5135862,
                "longitude": -0.0999147
            }
        },
        "navigationInstruction": {
            "maneuver": "TURN_LEFT",
            "instructions": "Turn left to stay on St. Paul's Churchyard"
        },
        "localizedValues": {
            "distance": {
                "text": "23 m"
            },
            "staticDuration": {
                "text": "1 min"
            }
        },
        "travelMode": "WALK"
    },
    {
        "distanceMeters": 55,
        "staticDuration": "50s",
        "polyline": {
            "encodedPolyline": "}flyHloR^f@TP~@H"
        },
        "startLocation": {
            "latLng": {
                "latitude": 51.5135862,
                "longitude": -0.0999147
            }
        },
        "endLocation": {
            "latLng": {
                "latitude": 51.512998599999996,
                "longitude": -0.1002467
            }
        },
        "navigationInstruction": {
            "maneuver": "TURN_RIGHT",
            "instructions": "Turn right onto Dean's Ct"
        },
        "localizedValues": {
            "distance": {
                "text": "55 m"
            },
            "staticDuration": {
                "text": "1 min"
            }
        },
        "travelMode": "WALK"
    },
    {
        "distanceMeters": 38,
        "staticDuration": "33s",
        "polyline": {
            "encodedPolyline": "gclyHpqRDwB"
        },
        "startLocation": {
            "latLng": {
                "latitude": 51.512998599999996,
                "longitude": -0.1002467
            }
        },
        "endLocation": {
            "latLng": {
                "latitude": 51.512969999999996,
                "longitude": -0.09964569999999999
            }
        },
        "navigationInstruction": {
            "maneuver": "TURN_LEFT",
            "instructions": "Turn left onto Carter Ln\nDestination will be on the right"
        },
        "localizedValues": {
            "distance": {
                "text": "38 m"
            },
            "staticDuration": {
                "text": "1 min"
            }
        },
        "travelMode": "WALK"
    }
];

export default function App() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState({});
  const messagesEndRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: 'Ключ',
  });

  const path = useMemo(() => {
    let points = [];
    segments.forEach((segment) => {
      const decoded = polyline.decode(segment.polyline.encodedPolyline);
      const coords = decoded.map(([lat, lng]) => ({ lat, lng }));
      points = points.concat(coords);
    });
    return points;
  }, [segments]);

  const handleSend = () => {
    if (!text.trim()) return;
    const id = Date.now().toString();
    setMessages((prev) => [...prev, { id, text }]);
    setText('');
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="app">
      <div className="messages">
        {[...messages].reverse().map((msg) => (
          <div key={msg.id} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div className="message-bubble">
                <div className="message-text">{msg.text}</div>
                <button onClick={() => toggleExpand(msg.id)} className="toggle-btn">
                  {expanded[msg.id] ? 'Свернуть карту' : 'Показать карту'}
                </button>
              </div>
            </div>

            {expanded[msg.id] && isLoaded && (
              <div className="map-container">
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '200px', borderRadius: '12px' }}
                  center={path.length > 0 ? path[0] : defaultCenter}
                  zoom={16}
                >
                  {/* Маркеры начала и конца маршрута */}
                  {path.length > 0 && (
                    <>
                      <Marker position={path[0]} label="Start" />
                      <Marker position={path[path.length - 1]} label="End" />
                    </>
                  )}

                  {/* Полилиния маршрута */}
                  <Polyline
                    path={path}
                    options={{
                      strokeColor: '#007AFF',
                      strokeOpacity: 0.8,
                      strokeWeight: 5,
                    }}
                  />
                </GoogleMap>
              </div>
            )}
          </div>
        ))}
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